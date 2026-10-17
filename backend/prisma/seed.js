const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { seedSuperAdmin } = require('../src/lib/seedSuperAdmin');
const { seedDemoStaff } = require('../src/lib/seedDemoStaff');
const { seedPharmacyMedicines } = require('../src/lib/seedPharmacyMedicines');

const prisma = new PrismaClient();

async function main() {
  const { email } = await seedSuperAdmin(prisma);
  // eslint-disable-next-line no-console
  console.log(`Seeded SUPER_ADMIN: ${email} (password from SUPER_ADMIN_PASSWORD in .env)`);

  const demo = await seedDemoStaff(prisma);
  // eslint-disable-next-line no-console
  console.log(`Demo staff: ${demo.users.length} roles ready (password: ${demo.password})`);
  for (const u of demo.users) {
    // eslint-disable-next-line no-console
    console.log(`  - ${u.role}: ${u.email} or username "${u.username}"`);
  }

  const meds = await seedPharmacyMedicines(prisma);
  // eslint-disable-next-line no-console
  console.log(
    `Pharmacy medicines: ${meds.created} created, ${meds.skipped} already present (${meds.total} in seed set).`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
