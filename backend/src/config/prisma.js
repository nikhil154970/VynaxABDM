const { PrismaClient } = require('@prisma/client');

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('pool_timeout')) {
  const sep = dbUrl.includes('?') ? '&' : '?';
  dbUrl += `${sep}pool_timeout=60&connection_limit=5&connect_timeout=30&keepalives=1&keepalives_idle=20&keepalives_interval=10&keepalives_count=5`;
}

function isDbDisconnectError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || err || '');
  return (
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1017' ||
    code === 'P2024' ||
    /connect|connection|timeout|closed|pool|ECONNRESET|ETIMEDOUT|Connection terminated|Engine is not yet connected|kind:\s*Closed/i.test(msg)
  );
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => {
  if (isDbDisconnectError(e)) return;
  console.error('prisma:error', e.message);
});

prisma.$on('warn', (e) => {
  if (isDbDisconnectError(e)) return;
  console.warn('prisma:warn', e.message);
});

let heartbeatTimer;
let heartbeatRunning = false;
/** Single-flight reconnect — prevents "Engine is not yet connected" during parallel API calls. */
let reconnectPromise = null;

function setConnectedFlag(value) {
  try {
    const { setDbConnected } = require('../lib/dbState');
    setDbConnected(Boolean(value));
  } catch {
    // ignore
  }
}

async function reconnectPrisma() {
  if (reconnectPromise) return reconnectPromise;

  reconnectPromise = (async () => {
    try {
      try {
        await prisma.$disconnect();
      } catch {
        // ignore
      }
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      setConnectedFlag(true);
    } catch (err) {
      setConnectedFlag(false);
      throw err;
    } finally {
      reconnectPromise = null;
    }
  })();

  return reconnectPromise;
}

/** Light ping; one reconnect at a time for all callers. */
async function ensureDbConnection() {
  if (reconnectPromise) {
    await reconnectPromise;
    return true;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    setConnectedFlag(true);
    return true;
  } catch (err) {
    if (!isDbDisconnectError(err)) throw err;
    await reconnectPrisma();
    return true;
  }
}

async function startHeartbeat() {
  stopHeartbeat();
  const HEARTBEAT_MS = 60 * 1000;
  const tick = async () => {
    if (heartbeatRunning) return;
    heartbeatRunning = true;
    try {
      await ensureDbConnection();
    } catch {
      setConnectedFlag(false);
    } finally {
      heartbeatRunning = false;
    }
  };
  try {
    await tick();
  } catch {
    // startup may still be connecting
  }
  heartbeatTimer = setInterval(tick, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function withDbRetry(fn, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      if (reconnectPromise) await reconnectPromise;
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isDbDisconnectError(err) || i === retries) throw err;
      try {
        await reconnectPrisma();
      } catch {
        // retry loop continues
      }
    }
  }
  throw lastErr;
}

module.exports = {
  prisma,
  isDbDisconnectError,
  withDbRetry,
  ensureDbConnection,
  reconnectPrisma,
  startHeartbeat,
  stopHeartbeat,
};
