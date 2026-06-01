const { prisma } = require('../../config/prisma');
const { BILL_INCLUDE, PRISMA_TX, isUuid, roundMoney, toNum } = require('../../lib/pharmacy/billingHelpers');
const { resolvePatientType } = require('../../lib/pharmacy/pendingDuesHelpers');
const {
  buildHistoryWhere,
  filterByPatientType,
  mapHistoryRow,
  mapPaymentRow,
  buildPrintData,
} = require('../../lib/pharmacy/billingHistoryHelpers');
const { restoreStockFromBill, stockWasDeducted } = require('../../lib/pharmacy/billingStockHelpers');

const BILL_SELECT = {
  id: true,
  billNumber: true,
  billingType: true,
  patientId: true,
  patientName: true,
  patientUhid: true,
  customerName: true,
  customerMobile: true,
  tokenNumber: true,
  doctorName: true,
  department: true,
  visitDate: true,
  subTotal: true,
  discount: true,
  gstAmount: true,
  grandTotal: true,
  paidAmount: true,
  pendingAmount: true,
  paymentMode: true,
  status: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  patient: { select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true } },
};

async function getIpdPatientIds(patientIds) {
  if (!patientIds.length) return new Set();
  const admissions = await prisma.admission.findMany({
    where: {
      patientId: { in: patientIds },
      status: { in: ['ADMITTED', 'DISCHARGE_REQUESTED'] },
    },
    select: { patientId: true },
  });
  return new Set(admissions.map((a) => a.patientId));
}

async function fetchUserNames(userIds) {
  if (!userIds.length) return {};
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  return users.reduce((acc, u) => {
    acc[u.id] = u.name;
    return acc;
  }, {});
}

async function enrichBills(bills) {
  const patientIds = [...new Set(bills.map((b) => b.patientId).filter(Boolean))];
  const ipdSet = await getIpdPatientIds(patientIds);
  const creatorIds = [...new Set(bills.map((b) => b.createdBy).filter(Boolean))];
  const userMap = await fetchUserNames(creatorIds);

  return bills.map((bill) => {
    const patientType = resolvePatientType(bill, ipdSet);
    return mapHistoryRow(bill, {
      patientType,
      createdByName: bill.createdBy ? userMap[bill.createdBy] || 'Staff' : '—',
    });
  });
}

const getSummary = async (req, res) => {
  try {
    const where = buildHistoryWhere({
      datePreset: req.query.datePreset,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    const [totalBills, paidBills, pendingBills, cancelledBills, revenueAgg] = await Promise.all([
      prisma.pharmacyBill.count({ where }),
      prisma.pharmacyBill.count({ where: { ...where, status: 'PAID' } }),
      prisma.pharmacyBill.count({
        where: { ...where, status: { in: ['PENDING_PAYMENT', 'PARTIALLY_PAID'] } },
      }),
      prisma.pharmacyBill.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.pharmacyBill.aggregate({
        where: { ...where, status: { in: ['PAID', 'PARTIALLY_PAID', 'PENDING_PAYMENT'] } },
        _sum: { grandTotal: true },
      }),
    ]);

    return res.json({
      summary: {
        totalBills,
        totalRevenue: roundMoney(Number(revenueAgg._sum.grandTotal || 0)),
        paidBills,
        pendingBills,
        cancelledBills,
      },
    });
  } catch (err) {
    console.error('[pharmacy/billing-history] summary', err);
    return res.status(500).json({ message: 'Failed to fetch billing history summary' });
  }
};

const listBillingHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const where = buildHistoryWhere({
      q: req.query.q,
      status: req.query.status,
      paymentMode: req.query.paymentMode,
      datePreset: req.query.datePreset,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    const bills = await prisma.pharmacyBill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: BILL_SELECT,
    });

    let rows = await enrichBills(bills);
    rows = filterByPatientType(rows, req.query.patientType);

    const total = rows.length;
    const start = (page - 1) * limit;
    const items = rows.slice(start, start + limit);

    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error('[pharmacy/billing-history] list', err);
    return res.status(500).json({ message: 'Failed to fetch billing history' });
  }
};

const getBillDetails = async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid bill id' });

    const bill = await prisma.pharmacyBill.findUnique({
      where: { id },
      include: {
        ...BILL_INCLUDE,
        items: { orderBy: { id: 'asc' } },
      },
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    const ipdSet = bill.patientId ? await getIpdPatientIds([bill.patientId]) : new Set();
    const patientType = resolvePatientType(bill, ipdSet);
    const userMap = await fetchUserNames([bill.createdBy].filter(Boolean));

    const payments = await prisma.pharmacyPayment.findMany({
      where: { billId: id },
      orderBy: { createdAt: 'desc' },
    });
    const paymentUserMap = await fetchUserNames([...new Set(payments.map((p) => p.createdBy).filter(Boolean))]);

    let patientHistory = [];
    if (bill.patientId) {
      const patientBills = await prisma.pharmacyBill.findMany({
        where: {
          patientId: bill.patientId,
          NOT: { status: 'DRAFT' },
        },
        orderBy: { createdAt: 'desc' },
        select: BILL_SELECT,
      });
      patientHistory = await enrichBills(patientBills);
    }

    const row = mapHistoryRow(bill, {
      patientType,
      createdByName: bill.createdBy ? userMap[bill.createdBy] || 'Staff' : '—',
    });

    return res.json({
      bill: row,
      patient: bill.patient || {
        name: bill.patientName || bill.customerName,
        uhid: bill.patientUhid,
        mobile: bill.customerMobile,
      },
      items: (bill.items || []).map((item) => ({
        id: item.id,
        medicineName: item.medicineName,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        mrp: toNum(item.mrp),
        discountPercent: toNum(item.discountPercent),
        gstPercentage: item.gstPercentage,
        amount: toNum(item.amount),
      })),
      paymentHistory: payments.map((p) => mapPaymentRow(p, paymentUserMap)),
      patientBillingHistory: patientHistory,
      printData: buildPrintData(bill, bill.items || []),
    });
  } catch (err) {
    console.error('[pharmacy/billing-history] details', err);
    return res.status(500).json({ message: 'Failed to fetch bill details' });
  }
};

const getPatientBillingHistory = async (req, res) => {
  try {
    const patientId = req.params.patientId;
    if (!isUuid(patientId)) return res.status(400).json({ message: 'Invalid patient id' });

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, name: true, uhid: true, mobile: true },
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const bills = await prisma.pharmacyBill.findMany({
      where: { patientId, NOT: { status: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
      select: BILL_SELECT,
    });

    const items = await enrichBills(bills);
    const totalAmount = roundMoney(bills.reduce((s, b) => s + Number(b.grandTotal), 0));
    const paidAmount = roundMoney(bills.reduce((s, b) => s + Number(b.paidAmount), 0));

    return res.json({
      patient,
      items,
      summary: { totalBills: bills.length, totalAmount, paidAmount },
    });
  } catch (err) {
    console.error('[pharmacy/billing-history] patient', err);
    return res.status(500).json({ message: 'Failed to fetch patient billing history' });
  }
};

const cancelBill = async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid bill id' });

    const existing = await prisma.pharmacyBill.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Bill not found' });
    if (existing.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Bill is already cancelled' });
    }
    if (existing.status === 'DRAFT') {
      return res.status(400).json({ message: 'Draft bills cannot be cancelled from history' });
    }

    const bill = await prisma.$transaction(
      async (tx) => {
        if (stockWasDeducted(existing.status)) {
          await restoreStockFromBill(tx, existing);
        }
        return tx.pharmacyBill.update({
          where: { id: existing.id },
          data: { status: 'CANCELLED', pendingAmount: 0, dispenseStatus: 'DISPENSED' },
          include: BILL_INCLUDE,
        });
      },
      PRISMA_TX
    );

    const ipdSet = bill.patientId ? await getIpdPatientIds([bill.patientId]) : new Set();
    const userMap = await fetchUserNames([bill.createdBy].filter(Boolean));

    return res.json({
      message: 'Bill cancelled and inventory restored',
      bill: mapHistoryRow(bill, {
        patientType: resolvePatientType(bill, ipdSet),
        createdByName: bill.createdBy ? userMap[bill.createdBy] || 'Staff' : '—',
      }),
    });
  } catch (err) {
    console.error('[pharmacy/billing-history] cancel', err);
    return res.status(500).json({ message: err?.message || 'Failed to cancel bill' });
  }
};

module.exports = {
  getSummary,
  listBillingHistory,
  getBillDetails,
  getPatientBillingHistory,
  cancelBill,
};
