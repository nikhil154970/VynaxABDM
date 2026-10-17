const { ensureDbConnection } = require('../config/prisma');
const { isDbConnected, setDbConnected } = require('./dbState');

async function ensureDbConnected() {
  try {
    await ensureDbConnection();
    setDbConnected(true);
    return true;
  } catch (err) {
    setDbConnected(false);
    throw err;
  }
}

module.exports = { ensureDbConnected };
