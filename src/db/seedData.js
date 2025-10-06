const { faker } = require("@faker-js/faker");
const { connect, close } = require("./connectDB.js");
const { config } = require("../config/config.js");
const logger = require("../config/logger.js");

async function seed() {
  const { userCount, ordersPerUser, stalePercent } = config;

  logger.info(
    { userCount, ordersPerUser, stalePercent, batchSize },
    "🚀 Starting seed process"
  );

  const db = await connect();
  const usersCol = db.collection("users");
  const ordersCol = db.collection("order_container");

  const users = Array.from({ length: userCount }).map(() => ({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    country: faker.location.country(),
    createdAt: faker.date.past({ years: 2 }),
  }));

  const userInsert = await usersCol.insertMany(users);
  //   console.log(userInsert)
  const userIds = Object.values(userInsert.insertedIds);
  logger.info(`✅ Inserted ${userIds.length} users.`);

  //  Insert Orders + Shipments

  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  let buffer = [];

  for (const userId of userIds) {
    for (let i = 0; i < ordersPerUser; i++) {
      const isStale = Math.random() < stalePercent;
      const createdAt = isStale
        ? faker.date.between({
            from: "2023-01-01T00:00:00.000Z",
            to: threeMonthsAgo,
          })
        : faker.date.recent({ days: 30 });

      const orderId = faker.string.uuid();

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
              price: Number(faker.commerce.price({ min: 10, max: 200 })),
            },
          ],
          total: Number(faker.commerce.price({ min: 20, max: 500 })),
        },
      };

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
          expectedDelivery: faker.date.future({ years: 0.1 }),
        },
      };

      buffer.push(orderDoc, shipmentDoc);

      // Batch insert for performance
      if (buffer.length >= batchSize) {
        await ordersCol.insertMany(buffer);
        logger.info(`📦 Inserted ${buffer.length} order_container docs`);
        buffer = [];
      }
    }
  }

  // Insert any remaining docs
  if (buffer.length) {
    await ordersCol.insertMany(buffer);
    logger.info(
      `📦 Inserted final batch of ${buffer.length} order_container docs`
    );
  }

  // Final Logs

  const usersCount = await usersCol.countDocuments();
  const ordersCount = await ordersCol.countDocuments();
  logger.info(
    `✅ Seeding complete. Users: ${usersCount}, Orders: ${ordersCount}`
  );

  await close();
}

seed().catch(async (err) => {
  logger.error({ err }, "❌ Seed failed");
  await close();
  process.exit(1);
});

module.exports = seed;
