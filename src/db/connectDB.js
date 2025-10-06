const { MongoClient } = require("mongodb");
const { config } = require("../config/config.js");
const logger = require("../config/logger.js");

let client;
let db;

async function connect() {
  if (db) return db;

  client = new MongoClient(config.mongoUri, { maxPoolSize: 20 });

  await client.connect();
  db = client.db(config.dbName);

  logger.info("✅ Connected to MongoDB");
  return db;
}

async function close() {
  if (client) {
    await client.close();
    logger.info("🔒 MongoDB connection closed");
  }
}

module.exports = {
  connect,
  close,
};
