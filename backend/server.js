const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/app');
const { prisma, startHeartbeat, ensureDbConnection, stopHeartbeat } = require('./src/config/prisma');
const { seedSuperAdmin } = require('./src/lib/seedSuperAdmin');
const { seedDemoStaff } = require('./src/lib/seedDemoStaff');
const { seedDefaultShifts } = require('./src/lib/seedDefaultShifts');
const { autoReleaseCleaningRooms, autoReturnEquipment } = require('./src/modules/ot/surgery/roomHelper');
const { setDbConnected } = require('./src/lib/dbState');

const PORT = process.env.PORT || 5000;
const DB_RETRY_ATTEMPTS = 10;
const DB_RETRY_DELAY_MS = 3000;
const OT_MAINTENANCE_MS = 5 * 60 * 1000;

function safeDbTarget(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}/${u.pathname.replace(/^\//, '')}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fixExistingPharmacyBills() {
  try {
    const bills = await prisma.pharmacyBill.findMany({
      where: {
        patientId: { not: null },
        NOT: { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
      },
      select: {
        id: true,
        patientId: true,
        tokenNumber: true,
        createdAt: true,
      },
    });
    if (bills.length === 0) return;

    let updatedCount = 0;
    for (const bill of bills) {
      const adms = await prisma.admission.findMany({
        where: { patientId: bill.patientId },
      });
      const isIpd = adms.some((adm) => {
        const billTime = new Date(bill.createdAt).getTime();
        const start = new Date(adm.admissionDate).getTime();
        const end = adm.dischargeDate ? new Date(adm.dischargeDate).getTime() : Date.now();
        return billTime >= start && billTime <= end;
      });
      if (isIpd) {
        let token = bill.tokenNumber || '';
        token = `IPD-${token}`.replace(/-$/, '');
        await prisma.pharmacyBill.update({
          where: { id: bill.id },
          data: { tokenNumber: token },
        });
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.log(`[db] Fixed tokenNumber prefix for ${updatedCount} existing IPD/OT pharmacy bills.`);
    }
  } catch (err) {
    console.error('[db] Failed to run existing pharmacy bills prefix migration:', err);
  }
}

async function runSeeds() {
  try {
    const { email } = await seedSuperAdmin(prisma);
    console.log(`[db] SUPER_ADMIN ready (${email})`);
    await fixExistingPharmacyBills();
  } catch (seedErr) {
    console.error('[db] Seed failed (check migrations: npm run prisma:migrate)');
    console.error(seedErr?.message || seedErr);
  }
}

// Prevent random async errors from killing the whole server during dev
process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled rejection (server keeps running):', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[process] Uncaught exception (server keeps running):', err?.message || err);
});

const start = async () => {
  if (!process.env.JWT_SECRET) {
    console.error('[auth] JWT_SECRET is missing in .env — login will fail');
  }

  const target = safeDbTarget(process.env.DATABASE_URL || '');
  console.log(`[db] Connecting to ${target} ...`);

  const connectDb = async () => {
    await prisma.$connect();
    await ensureDbConnection();
    setDbConnected(true);
  };

  setDbConnected(false);

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (stable - no auto-restart)`);
    // OT maintenance - 60s is enough; avoids hammering DB when cloud PG is idle
    setInterval(autoReleaseCleaningRooms, OT_MAINTENANCE_MS);
    setInterval(autoReturnEquipment, OT_MAINTENANCE_MS);
  });

  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(`[server] Port ${PORT} already in use. Stop the other process or run: npm run dev:restart`);
      process.exit(1);
    }
    console.error('[server] Failed to start:', err?.message || err);
    process.exit(1);
  });

  (async () => {
    for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt += 1) {
      try {
        await connectDb();
        startHeartbeat().catch((err) => console.error('[db] Heartbeat failed:', err?.message || err));
        console.log('[db] Connected');
        runSeeds().catch((err) => console.error('[db] Background seed failed:', err?.message || err));
        return;
      } catch (err) {
        setDbConnected(false);
        console.error(`[db] Connection attempt ${attempt}/${DB_RETRY_ATTEMPTS} failed`);
        console.error(err?.message || err);
        if (attempt === DB_RETRY_ATTEMPTS) {
          console.error('[db] Could not connect yet. API will keep running and retry in background.');
          return;
        }
        await sleep(DB_RETRY_DELAY_MS);
      }
    }
  })().catch((err) => {
    console.error('[db] Background connection loop failed:', err?.message || err);
  });
  const shutdown = async () => {
    stopHeartbeat();
    server.close(() => {});
    setDbConnected(false);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start().catch((err) => {
  console.error('[server] Startup failed:', err?.message || err);
});

