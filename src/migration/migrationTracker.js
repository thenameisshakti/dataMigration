import { getOrCreateTracker, updateTracker, getLastCompletedUserId } from "./migrationTracker.js";

import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import pino from "pino";

dotenv.config();

// --------------------------------------------
// ✅ Logger setup
// --------------------------------------------
const logger = pino({
  level: "info",
  transport: { target: "pino-pretty", options: { colorize: true } }
});

// --------------------------------------------
// ✅ Environment configuration
// --------------------------------------------
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/stale_migration_db";
const DB_NAME = process.env.DB_NAME || "stale_migration_db";

let client;
let db;

// --------------------------------------------
// ✅ Connect to MongoDB (shared by all functions)
// --------------------------------------------
async function connectDB() {
  if (db) return db;
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  logger.info("✅ Connected to MongoDB for tracker operations");
  return db;
}

// --------------------------------------------
// ✅ 1️⃣ Initialize or get the tracker document
// If it doesn't exist, create one.
// --------------------------------------------
export async function getOrCreateTracker() {
  const database = await connectDB();
  const trackerCol = database.collection("migration_cron_task");

  let tracker = await trackerCol.findOne({ process_name: "migration_script" });

  if (!tracker) {
    await trackerCol.insertOne({
      process_name: "migration_script",
      lastCompletedUserId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    tracker = await trackerCol.findOne({ process_name: "migration_script" });
    logger.info("🆕 Created new migration tracker document");
  } else {
    logger.info(`📄 Loaded existing tracker with lastCompletedUserId: ${tracker.lastCompletedUserId}`);
  }

  return tracker;
}

// --------------------------------------------
// ✅ 2️⃣ Update tracker after processing a user
// This is called after each user's migration completes.
// --------------------------------------------
export async function updateTracker(lastUserId) {
  const database = await connectDB();
  const trackerCol = database.collection("migration_cron_task");

  await trackerCol.updateOne(
    { process_name: "migration_script" },
    {
      $set: {
        lastCompletedUserId: lastUserId,
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );

  logger.info(`🔁 Tracker updated: lastCompletedUserId = ${lastUserId}`);
}

// --------------------------------------------
// ✅ 3️⃣ Fetch the last completed user ID
// Used by migration script to know where to resume.
// --------------------------------------------
export async function getLastCompletedUserId() {
  const database = await connectDB();
  const trackerCol = database.collection("migration_cron_task");

  const tracker = await trackerCol.findOne({ process_name: "migration_script" });
  if (!tracker) return null;

  logger.info(`📍 Last completed user ID: ${tracker.lastCompletedUserId}`);
  return tracker.lastCompletedUserId;
}

// --------------------------------------------
// ✅ 4️⃣ Close MongoDB connection (optional cleanup)
// --------------------------------------------
export async function closeTrackerConnection() {
  if (client) {
    await client.close();
    logger.info("🔒 Tracker DB connection closed");
  }
}
