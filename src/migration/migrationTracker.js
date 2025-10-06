const { connect, close } = require("../db/connectDB.js");
const { config } = require("../config/config.js");
const logger = require("../config/logger.js");

// Initialize or get the tracker document

async function getOrCreateTracker() {
  const db = await connect();
  const trackerCol = db.collection("migration_cron_task");

  let tracker = await trackerCol.findOne({ process_name: "migration_script" });

  if (!tracker) {
    await trackerCol.insertOne({
      process_name: "migration_script",
      lastCompletedUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tracker = await trackerCol.findOne({ process_name: "migration_script" });
    logger.info("🆕 Created new migration tracker document");
  } else {
    logger.info(
      `📄 Loaded existing tracker with lastCompletedUserId: ${tracker.lastCompletedUserId}`
    );
  }

  return tracker;
}

// Update tracker after processing a user

async function updateTracker(lastUserId) {
  const db = await connect();
  const trackerCol = db.collection("migration_cron_task");

  await trackerCol.updateOne(
    { process_name: "migration_script" },
    {
      $set: {
        lastCompletedUserId: lastUserId,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  logger.info(`🔁 Tracker updated: lastCompletedUserId = ${lastUserId}`);
}

//Fetch the last completed user ID

async function getLastCompletedUserId() {
  const db = await connect();
  const trackerCol = db.collection("migration_cron_task");

  const tracker = await trackerCol.findOne({
    process_name: "migration_script",
  });
  if (!tracker) return null;

  logger.info(`📍 Last completed user ID: ${tracker.lastCompletedUserId}`);
  return tracker.lastCompletedUserId;
}

//Close MongoDB connection (optional cleanup)

async function closeTrackerConnection() {
  await close();
  logger.info("🔒 Tracker DB connection closed");
}

// Exports

module.exports = {
  getOrCreateTracker,
  updateTracker,
  getLastCompletedUserId,
  closeTrackerConnection,
};
