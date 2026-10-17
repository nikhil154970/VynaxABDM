const DEFAULT_SHIFTS = [
  { name: 'Morning Shift', startTime: '06:00', endTime: '14:00' },
  { name: 'Evening Shift', startTime: '14:00', endTime: '22:00' },
  { name: 'Night Shift', startTime: '22:00', endTime: '06:00' },
];

async function seedDefaultShifts(prisma) {
  let created = 0;
  for (const s of DEFAULT_SHIFTS) {
    const existing = await prisma.shift.findFirst({
      where: { name: s.name },
      select: { id: true },
    });
    if (!existing) {
      await prisma.shift.create({ data: { ...s, isActive: true } });
      created += 1;
    }
  }
  if (created > 0) {
    console.log(`[db] Default shifts seeded (${created} new)`);
  }
  return { created };
}

module.exports = { seedDefaultShifts, DEFAULT_SHIFTS };
