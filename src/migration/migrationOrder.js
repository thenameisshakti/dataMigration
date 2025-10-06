#!/usr/bin/env node
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import pino from "pino";
import { getOrCreateTracker, updateTracker } from "./migrationTracker.js"; // ✅ tracker integration

dotenv.config();

// --------------------------------------------
// Logger setup
// --------------------------------------------
const logger = pino({
  level: "info",
  transport: { target: "pino-pretty", options: { colorize: true } }
});

// --------------------------------------------
// Environment
// --------------------------------------------
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/stale_migration_db";
const DB_NAME = process.env.DB_NAME || "stale_migration_db";
const STALE_DAYS = parseInt(process.env.STALE_DAYS || "90", 10);

// --------------------------------------------
// Connect to MongoDB
// --------------------------------------------
let client;
let db;
async function connectDB() {
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  logger.info("✅ Connected to MongoDB");
}

// --------------------------------------------
// Helper: calculate stale threshold date
// --------------------------------------------
function getStaleThreshold(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// --------------------------------------------
// Helper: merge order + shipment docs
// --------------------------------------------
function mergeOrderAndShipment(groupedDocs) {
  const order = groupedDocs.find((d) => d.orderType === "order") || null;
  const shipment = groupedDocs.find((d) => d.orderType === "shipment") || null;

  return {
    orderId: order?.orderId || shipment?.orderId,
    userId: order?.userId || shipment?.userId,
    archivedAt: new Date(),
    order,
    shipment
  };
}

// --------------------------------------------
// Process one user’s stale orders
// --------------------------------------------
async function processUser(user) {
  const ordersCol = db.collection("order_container");
  const archiveCol = db.collection("archive_order");

  const threshold = getStaleThreshold(STALE_DAYS);
  const staleOrders = await ordersCol.find({ userId: user._id, updatedAt: { $lt: threshold } }).toArray();

  if (!staleOrders.length) {
    logger.info(`🟡 No stale orders for user ${user._id}`);
    return 0;
  }

  // Group by orderId
  const grouped = staleOrders.reduce((acc, doc) => {
    (acc[doc.orderId] = acc[doc.orderId] || []).push(doc);
    return acc;
  }, {});

  const mergedDocs = Object.values(grouped).map((group) => mergeOrderAndShipment(group));

  // Upsert merged docs into archive_order
  const bulkOps = mergedDocs.map((doc) => ({
    updateOne: {
      filter: { orderId: doc.orderId },
      update: { $setOnInsert: doc },
      upsert: true
    }
  }));
  if (bulkOps.length) await archiveCol.bulkWrite(bulkOps);

  // Delete originals
  const allOrderIds = Object.keys(grouped);
  await ordersCol.deleteMany({ userId: user._id, orderId: { $in: allOrderIds } });

  logger.info(`✅ User ${user._id} migrated ${mergedDocs.length} stale orders`);
  return mergedDocs.length;
}

// --------------------------------------------
// 🚀 MAIN MIGRATION FLOW (where your block goes)
// --------------------------------------------
async function runMigration() {
  try {
    await connectDB();

    const usersCol = db.collection("users");

    // 🔹 Load or create tracker
    const tracker = await getOrCreateTracker();
    const lastUserId = tracker.lastCompletedUserId;

    // 🔹 Build query for next users
    const query = lastUserId ? { _id: { $gt: new ObjectId(lastUserId) } } : {};
    const usersCursor = usersCol.find(query).sort({ _id: 1 });

    // 🔹 Process users sequentially
    for await (const user of usersCursor) {
      logger.info(`➡️ Processing user: ${user._id}`);

      try {
        await processUser(user);
        // 🔹 Update tracker after successful migration
        await updateTracker(user._id);
      } catch (err) {
        logger.error(err, `❌ Error migrating user ${user._id}`);
        // Stop here — next run resumes from this user
        break;
      }
    }

    logger.info("🎯 Migration complete for all users.");
  } catch (err) {
    logger.error(err, "❌ Migration script failed");
  } finally {
    if (client) await client.close();
    logger.info("🔒 MongoDB connection closed");
  }
}

runMigration();
