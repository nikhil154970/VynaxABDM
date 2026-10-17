const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.patient.findMany({
    where: { abhaAddress: { equals: '91477844163659@sbx', mode: 'insensitive' } },
    select: { name: true, uhid: true, abhaAddress: true, abhaNumber: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
