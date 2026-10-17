require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function localDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function combineDateAndTime(surgeryDate, startTime) {
  const [h, m] = String(startTime || '0:0').split(':').map(Number);
  const dt = new Date(surgeryDate);
  dt.setHours(h, m, 0, 0);
  return dt;
}

async function main() {
  const { start: today, end: tomorrow } = localDayBounds();
  const now = new Date();

  const all = await prisma.surgerySchedule.findMany({
    where: {
      surgeryDate: { gte: today, lt: tomorrow },
      status: 'SCHEDULED',
      surgerySession: null,
    },
    include: { otRequest: { include: { patient: { select: { name: true, uhid: true } } } } },
  });

  const items = all.map((s) => {
    const scheduledDateTime = combineDateAndTime(s.surgeryDate, s.startTime);
    const computedStatus = scheduledDateTime < now ? 'delayed' : 'scheduled';
    return {
      patient: s.otRequest?.patient?.name,
      uhid: s.otRequest?.patient?.uhid,
      startTime: s.startTime,
      computedStatus,
    };
  });

  console.log('Today list after fix:', JSON.stringify(items, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
