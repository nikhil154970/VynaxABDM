require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { canUserAssignNurse, getUserCurrentShiftType } = require('../src/lib/shiftHelpers');

async function main() {
  const p = new PrismaClient();
  try {
    for (const email of ['vishal@gmail.com', 'receptionist@gmail.com', 'receptionist@vyanx.local']) {
      const u = await p.user.findFirst({ where: { email } });
      if (!u) {
        console.log(email, 'not found');
        continue;
      }
      const assignments = await p.shiftAssignment.findMany({
        where: { employeeId: u.id },
        include: { shift: true },
      });
      console.log('\n', email, {
        assignments: assignments.map((a) => ({ name: a.shift?.name, isActive: a.shift?.isActive, start: a.shift?.startTime, end: a.shift?.endTime })),
        canAssign: await canUserAssignNurse(u.id, 'RECEPTIONIST'),
        shiftType: await getUserCurrentShiftType(u.id),
      });
    }
  } finally {
    await p.$disconnect();
  }
}

main().catch(console.error);
