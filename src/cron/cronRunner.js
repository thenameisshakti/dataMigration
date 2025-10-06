const cron = require("node-cron");
const logger = require("../config/logger.js");
const runMigration = require("../migration/migrationOrder.js");

// Schedule: every day at 2:00 AM
cron.schedule(" 0 2 * * *", async () => {
  logger.info(" Starting scheduled migration task (2:00 AM)");

  try {
    await runMigration();
    logger.info("Migration task completed successfully");
  } catch (err) {
    logger.error(err, "Migration task failed");
  }
});
