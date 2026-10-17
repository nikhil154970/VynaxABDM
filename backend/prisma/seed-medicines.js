const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { seedPharmacyMedicines } = require('../src/lib/seedPharmacyMedicines');

const prisma = new PrismaClient();

seedPharmacyMedicines(prisma)
  .then((result) => {
    // eslint-disable-next-line no-console
    console.log(
      `Done: ${result.created} created, ${result.skipped} skipped (${result.total} medicines in seed).`
    );
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
