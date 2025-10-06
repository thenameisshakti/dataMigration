import { faker } from "@faker-js/faker";
import { connect, close } from "./connection.js";
import { config } from "../config/config.js";
import { logger } from "../config/logger.js";

/**
 * Seed users and their orders (order + shipment docs)
 * Some orders are older than 3 months → for migration testing
 */
const USER_COUNT = parseInt(process.env.USER_COUNT || "1000", 10);
const ORDERS_PER_USER = parseInt(process.env.ORDERS_PER_USER || "5", 10);
const STALE_PERCENT = parseFloat(process.env.STALE_PERCENT || "0.2");
const BATCH_SIZE = config.batchSize;

async function seed() {
  const db = await connect();
  const usersCol = db.collection("users");
  const ordersCol = db.collection("order_container");

  logger.info({ USER_COUNT, ORDERS_PER_USER, STALE_PERCENT }, "Starting seed process");

  // -------------------------------
  // 1️⃣ Insert Users
  // -------------------------------
  const users = Array.from({ length: USER_COUNT }).map(() => ({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    country: faker.location.country(),
    createdAt: faker.date.past({ years: 2 })
  }));

  const userInsert = await usersCol.insertMany(users);
  const userIds = Object.values(userInsert.insertedIds);
  logger.info(`Inserted ${userIds.length} users.`);

  // -------------------------------
  // 2️⃣ Insert Orders + Shipments
  // -------------------------------
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  let buffer = [];

  for (const userId of userIds) {
    for (let i = 0; i < ORDERS_PER_USER; i++) {
      const isStale = Math.random() < STALE_PERCENT;
      const createdAt = isStale
        ? faker.date.between({ from: "2023-01-01T00:00:00.000Z", to: threeMonthsAgo })
        : faker.date.recent({ days: 30 });

      const orderId = faker.string.uuid();

      // Order document
      const orderDoc = {
        userId,
        orderId,
        orderType: "order",
        status: "completed",
        createdAt,
        updatedAt: createdAt,
        payload: {
          items: [
            {
              sku: faker.string.alphanumeric(8).toUpperCase(),
              qty: faker.number.int({ min: 1, max: 5 }),
              price: Number(faker.commerce.price({ min: 10, max: 200 }))
            }
          ],
          total: Number(faker.commerce.price({ min: 20, max: 500 }))
        }
      };

      // Shipment document
      const shipmentDoc = {
        userId,
        orderId,
        orderType: "shipment",
        status: "shipped",
        createdAt,
        updatedAt: createdAt,
        payload: {
          carrier: faker.company.name(),
          trackingId: faker.string.uuid(),
          expectedDelivery: faker.date.future({ years: 0.1 })
        }
      };

      buffer.push(orderDoc, shipmentDoc);

      // Insert in batches for performance
      if (buffer.length >= BATCH_SIZE) {
        await ordersCol.insertMany(buffer);
        logger.info(`Inserted ${buffer.length} order_container docs`);
        buffer = [];
      }
    }
  }

  if (buffer.length) {
    await ordersCol.insertMany(buffer);
    logger.info(`Inserted final batch of ${buffer.length} order_container docs`);
  }

  // -------------------------------
  // ✅ Final Logs
  // -------------------------------
  const usersCount = await usersCol.countDocuments();
  const ordersCount = await ordersCol.countDocuments();
  logger.info(`Seeding complete. Users: ${usersCount}, Orders: ${ordersCount}`);

  await close();
}

seed().catch(async (err) => {
  logger.error(err, "❌ Seed failed");
  await close();
  process.exit(1);
});
