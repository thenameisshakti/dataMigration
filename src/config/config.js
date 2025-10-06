const dotenv = require("dotenv");
dotenv.config();

const config = {
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/stale_migration_db",
  dbName: process.env.DB_NAME || "stale_migration_db",
  batchSize: parseInt(process.env.BATCH_SIZE || "1000", 10),
  userCount: parseInt(process.env.USER_COUNT || "1000", 10),
  ordersPerUser: parseInt(process.env.ORDERS_PER_USER || "5", 10),
  stalePercent: parseFloat(process.env.STALE_PERCENT || "0.2"),
  logLevel: process.env.LOG_LEVEL || "info",
};

module.exports = { config };
