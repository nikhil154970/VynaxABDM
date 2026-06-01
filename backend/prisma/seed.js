const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { seedSuperAdmin } = require('../src/lib/seedSuperAdmin');

const prisma = new PrismaClient();

async function main() {
  const { email } = await seedSuperAdmin(prisma);
  // eslint-disable-next-line no-console
  console.log(`Seeded SUPER_ADMIN: ${email}`);
  // eslint-disable-next-line no-console
  console.log('Synced hospital wards + beds (only missing bed codes were created).');
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
