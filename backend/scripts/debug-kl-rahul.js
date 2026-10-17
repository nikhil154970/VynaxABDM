require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const schedules = await prisma.surgerySchedule.findMany({
    where: {
      otRequest: {
        patient: { name: { contains: 'Rahul', mode: 'insensitive' } },
      },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      surgerySession: true,
      otRequest: {
        include: {
          patient: { select: { name: true, uhid: true } },
          statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      },
    },
  });

  console.log(JSON.stringify(schedules, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
