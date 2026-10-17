require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * One-time reconciliation for IPD bills created before advance-adjustment was applied.
 *
 * Older bills recorded only the cash collected on the bill, leaving the admission
 * advance sitting unused in AdmissionBilling.advance. This produced a wrong
 * "Pending" (e.g. Total 3700, Paid 1200, Pending 2500 while 2500 advance existed).
 *
 * This script credits any unused admission advance against that admission's
 * non-cancelled bills (oldest first), records an "Advance Adjustment" payment,
 * updates the bill status/paidAmount, and zeroes the consumed advance.
 * It is idempotent: once advance is consumed to 0 it does nothing further.
 */
function billPaid(b) {
  const paidRaw = Math.max(0, Number(b.paidAmount) || 0);
  const byPayments = (b.payments || []).reduce((s, p) => s + Math.max(0, Number(p.amount) || 0), 0);
  return Math.max(paidRaw, byPayments);
}

function computeStatus(paid, total) {
  const p = Math.max(0, paid);
  const t = Math.max(0, total);
  if (t <= 0) return 'PAID';
  if (p <= 0) return 'PENDING';
  if (p >= t) return 'PAID';
  return 'PARTIAL';
}

async function main() {
  const rows = await prisma.admissionBilling.findMany({
    where: { advance: { gt: 0 } },
    select: { id: true, admissionId: true, advance: true },
  });

  console.log(`Found ${rows.length} admission(s) with unused advance.`);
  let touchedBills = 0;
  let touchedAdmissions = 0;

  for (const row of rows) {
    let advanceLeft = Math.max(0, Number(row.advance) || 0);
    if (advanceLeft <= 0) continue;

    const bills = await prisma.bill.findMany({
      where: { admissionId: row.admissionId, NOT: { status: 'CANCELLED' } },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, billNumber: true, totalAmount: true, paidAmount: true, status: true, payments: { select: { amount: true } } },
    });
    if (!bills.length) continue;

    let consumedForAdmission = 0;

    for (const b of bills) {
      if (advanceLeft <= 0) break;
      const paid = billPaid(b);
      const pending = Math.max(0, (Number(b.totalAmount) || 0) - paid);
      if (pending <= 0) continue;

      const apply = Math.min(advanceLeft, pending);
      if (apply <= 0) continue;

      const newPaid = paid + apply;
      const newStatus = computeStatus(newPaid, Number(b.totalAmount) || 0);

      await prisma.$transaction(async (tx) => {
        await tx.bill.update({
          where: { id: b.id },
          data: {
            paidAmount: newPaid,
            status: newStatus,
            payments: {
              create: [{ amount: apply, mode: 'Advance Adjustment', note: 'Advance adjusted from admission (reconcile)' }],
            },
          },
        });
      });

      advanceLeft -= apply;
      consumedForAdmission += apply;
      touchedBills += 1;
      console.log(`  Bill ${b.billNumber}: applied advance ₹${apply} → paid ₹${newPaid}, status ${newStatus}`);
    }

    if (consumedForAdmission > 0) {
      await prisma.admissionBilling.update({
        where: { id: row.id },
        data: { advance: advanceLeft },
      });
      touchedAdmissions += 1;
      console.log(`  Admission ${row.admissionId}: advance ${row.advance} → ${advanceLeft}`);
    }
  }

  console.log(`Done. Updated ${touchedBills} bill(s) across ${touchedAdmissions} admission(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
