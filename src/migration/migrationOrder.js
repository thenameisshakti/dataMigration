const { ObjectId } = require("mongodb");
const { connect, close } = require("../db/connectDB.js");
const { config } = require("../config/config.js");
const logger = require("../config/logger.js");
const { getOrCreateTracker, updateTracker } = require("./migrationTracker.js");

// Helper: calculate stale threshold date

function getStaleThreshold(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Helper: merge order + shipment docs

function mergeOrderAndShipment(groupedDocs) {
  const order = groupedDocs.find((d) => d.orderType === "order") || null;
  const shipment = groupedDocs.find((d) => d.orderType === "shipment") || null;

  return {
    orderId: order?.orderId || shipment?.orderId,
    userId: order?.userId || shipment?.userId,
    archivedAt: new Date(),
    order,
    shipment,
  };
}

// Process one user’s stale orders

async function processUser(db, user) {
  const ordersCol = db.collection("order_container");
  const archiveCol = db.collection("archive_order");

  const threshold = getStaleThreshold(config.staleDays || 90);
  const staleOrders = await ordersCol
    .find({ userId: user._id, updatedAt: { $lt: threshold } })
    .toArray();

  if (!staleOrders.length) {
    logger.info(`🟡 No stale orders for user ${user._id}`);
    return 0;
  }

  const grouped = staleOrders.reduce((acc, doc) => {
    (acc[doc.orderId] = acc[doc.orderId] || []).push(doc);
    return acc;
  }, {});

  const mergedDocs = Object.values(grouped).map((group) =>
    mergeOrderAndShipment(group)
  );

  // Upsert merged docs
  const bulkOps = mergedDocs.map((doc) => ({
    updateOne: {
      filter: { orderId: doc.orderId },
      update: { $setOnInsert: doc },
      upsert: true,
    },
  }));
  if (bulkOps.length) await archiveCol.bulkWrite(bulkOps);

  // Delete originals
  const allOrderIds = Object.keys(grouped);
  await ordersCol.deleteMany({
    userId: user._id,
    orderId: { $in: allOrderIds },
  });

  logger.info(`✅ User ${user._id} migrated ${mergedDocs.length} stale orders`);
  return mergedDocs.length;
}

//  MAIN MIGRATION FLOW

async function runMigration() {
  let db;

  try {
    db = await connect();
    const usersCol = db.collection("users");

    const tracker = await getOrCreateTracker();
    const lastUserId = tracker.lastCompletedUserId;

    const query = lastUserId ? { _id: { $gt: new ObjectId(lastUserId) } } : {};
    const usersCursor = usersCol.find(query).sort({ _id: 1 });

    for await (const user of usersCursor) {
      logger.info(`➡️ Processing user: ${user._id}`);

      try {
        await processUser(db, user);
        await updateTracker(user._id);
      } catch (err) {
        logger.error(err, `❌ Error migrating user ${user._id}`);
        break;
      }
    }

    logger.info("🎯 Migration complete for all users.");
  } catch (err) {
    logger.error(err, "❌ Migration script failed");
  } finally {
    await close();
    logger.info("🔒 MongoDB connection closed");
  }
}

runMigration();
module.exports = runMigration;
