const dotenv = require("dotenv");
dotenv.config({
    path: './.env'
}

);

function getEnv(key) {
  return process.env[key];
}

module.exports = getEnv;
