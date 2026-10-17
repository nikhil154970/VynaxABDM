require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const orphans = await prisma.surgerySchedule.findMany({
    where: { status: 'IN_PROGRESS', surgerySession: null },
    include: { otRequest: { include: { patient: { select: { name: true } } } } },
  });

  for (const o of orphans) {
    await prisma.surgerySchedule.update({ where: { id: o.id }, data: { status: 'SCHEDULED' } });
    await prisma.otRequest.update({ where: { id: o.otRequestId }, data: { status: 'SCHEDULED' } });
    console.log('Repaired:', o.otRequest?.patient?.name);
  }

  if (!orphans.length) console.log('No orphan schedules found');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
