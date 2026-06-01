const { prisma } = require('../src/config/prisma');

async function main() {
  const code = 'ICU 12';

  const existing = await prisma.bed.findUnique({
    where: { code },
    select: { id: true, code: true, status: true, wardId: true },
  });
  if (existing) {
    console.log('Already exists:', existing);
    return;
  }

  const ward = await prisma.ward.findFirst({ where: { name: 'ICU' }, select: { id: true, name: true } });
  if (!ward) throw new Error('ICU ward not found');

  const bed = await prisma.bed.create({
    data: { wardId: ward.id, code, status: 'AVAILABLE' },
    select: { id: true, code: true, status: true, wardId: true },
  });
  console.log('Created:', bed);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });

