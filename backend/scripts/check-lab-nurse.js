const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  try {
    const cols = await p.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'TestAdvice' ORDER BY column_name
    `;
    console.log('TestAdvice columns:', cols.map((c) => c.column_name).join(', '));

    const tests = await p.labTest.findMany({
      take: 10,
      select: { id: true, name: true, isActive: true, price: true },
    });
    console.log('LabTest count:', await p.labTest.count());
    console.log('LabTest sample:', JSON.stringify(tests, null, 2));

    const pending = await p.testAdvice.count({ where: { status: 'PENDING_BILLING' } });
    console.log('Pending TestAdvice count:', pending);

    const pendingRows = await p.testAdvice.findMany({
      where: { status: 'PENDING_BILLING' },
      include: {
        items: { include: { test: { select: { name: true } } } },
        patient: { select: { uhid: true, name: true } },
      },
    });
    console.log(
      'Pending rows:',
      pendingRows.map((a) => ({
        id: a.id,
        source: a.source,
        patient: a.patient?.name,
        uhid: a.patient?.uhid,
        tests: a.items.map((i) => i.test?.name),
      })),
    );
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
}

main();
