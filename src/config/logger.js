const pino = require("pino");
const { config } = require("./config.js");

const logger = pino({
  level: config.logLevel || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  },
});

module.exports = logger;
