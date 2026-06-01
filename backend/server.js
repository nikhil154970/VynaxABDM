const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/app');
const { prisma } = require('./src/config/prisma');
const { seedSuperAdmin } = require('./src/lib/seedSuperAdmin');

const PORT = process.env.PORT || 5000;

function safeDbTarget(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}/${u.pathname.replace(/^\//, '')}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

const start = async () => {
  const target = safeDbTarget(process.env.DATABASE_URL || '');
  console.log(`[db] Connecting to ${target} ...`);

  let dbConnected = false;

  const connectDb = async () => {
    await prisma.$connect();
    dbConnected = true;
  };

  try {
    await connectDb();
    console.log('[db] Connected');

    try {
      const { email } = await seedSuperAdmin(prisma);
      console.log(`[db] SUPER_ADMIN ready (${email})`);
    } catch (seedErr) {
      console.error('[db] Seed failed (check migrations: npm run prisma:migrate)');
      console.error(seedErr);
    }
  } catch (err) {
    console.error('[db] Connection failed (server will still start; will retry every 10s)');
    console.error(err?.message || err);
  }

  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  let reconnecting = false;
  const reconnectTimer = setInterval(async () => {
    if (reconnecting || dbConnected) return;
    reconnecting = true;
    try {
      await connectDb();
      console.log('[db] Reconnected');
      try {
        const { email } = await seedSuperAdmin(prisma);
        console.log(`[db] SUPER_ADMIN ready (${email})`);
      } catch (seedErr) {
        console.error('[db] Seed failed after reconnect');
        console.error(seedErr?.message || seedErr);
      }
    } catch {
      // Initial error already logged; stay quiet until next attempt.
    } finally {
      reconnecting = false;
    }
  }, 10_000);

  const shutdown = async () => {
    clearInterval(reconnectTimer);
    server.close(() => {});
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start().catch(console.error);
