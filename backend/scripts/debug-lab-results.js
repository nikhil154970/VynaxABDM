require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();

function compact(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function main() {
  const orders = await p.labOrder.findMany({
    where: { status: 'IN_PROGRESS' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      items: true,
      results: true,
      patient: { select: { name: true, uhid: true } },
    },
  });

  for (const o of orders) {
    console.log('\n---', o.orderNumber, o.patient?.name, o.patient?.uhid, '---');
    console.log(
      'Items:',
      o.items.map((i) => ({ name: i.testName, category: i.category, id: i.id })),
    );
    console.log(
      'Results:',
      o.results.map((r) => ({
        testName: r.testName,
        value: r.value,
        remarks: r.remarks,
        orderItemId: r.orderItemId,
      })),
    );
    for (const item of o.items) {
      const itemKey = compact(item.testName);
      const matched = o.results.filter((r) => {
        const v = String(r.value || '').trim();
        if (!v) return false;
        if (r.orderItemId === item.id) return true;
        if (compact(r.testName) === itemKey) return true;
        if (compact(r.remarks) === itemKey) return true;
        if (compact(r.remarks).includes(itemKey) || itemKey.includes(compact(r.remarks))) return true;
        return false;
      });
      console.log(`  Item "${item.testName}" -> matched results: ${matched.length}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
