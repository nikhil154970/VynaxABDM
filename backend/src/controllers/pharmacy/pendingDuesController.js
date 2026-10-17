const { prisma } = require('../../config/prisma');
const { isUuid, toNum, roundMoney, PRISMA_TX } = require('../../lib/pharmacy/billingHelpers');
const {
  PENDING_BILL_STATUSES,
  computeDueDate,
  deriveDueStatus,
  resolvePatientType,
  mapDueRow,
  buildPendingWhere,
  filterByPatientTypeAndStatus,
  mapPayment,
  applyPaymentToBill,
} = require('../../lib/pharmacy/pendingDuesHelpers');

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
  grandTotal: true,
  paidAmount: true,
  pendingAmount: true,
  status: true,
  dueDate: true,
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

async function enrichBillsWithTypes(bills) {
  const patientIds = [...new Set(bills.map((b) => b.patientId).filter(Boolean))];
  const ipdSet = await getIpdPatientIds(patientIds);
  const billIds = bills.map((b) => b.id);
  const payments = billIds.length
    ? await prisma.pharmacyPayment.findMany({
        where: { billId: { in: billIds } },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  const paymentsByBill = payments.reduce((acc, p) => {
    if (!acc[p.billId]) acc[p.billId] = [];
    acc[p.billId].push(p);
    return acc;
  }, {});

  return bills.map((bill) => {
    const patientType = resolvePatientType(bill, ipdSet);
    return mapDueRow(bill, { patientType, payments: paymentsByBill[bill.id] || [] });
  });
}

async function fetchPendingBills(extraWhere = {}) {
  return prisma.pharmacyBill.findMany({
    where: {
      status: { in: PENDING_BILL_STATUSES },
      pendingAmount: { gt: 0 },
      NOT: { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
      ...extraWhere,
    },
    orderBy: { createdAt: 'desc' },
    select: BILL_SELECT,
  });
}

const getSummary = async (req, res) => {
  try {
    const bills = await fetchPendingBills();
    const rows = await enrichBillsWithTypes(bills);

    const totalPendingAccounts = rows.length;
    const totalOutstandingAmount = roundMoney(rows.reduce((s, r) => s + r.pendingAmount, 0));
    const ipdPending = rows.filter((r) => r.patientType === 'IPD').length;
    const opdPending = rows.filter((r) => r.patientType === 'OPD').length;
    const overdueAccounts = rows.filter((r) => r.status === 'OVERDUE').length;

    return res.json({
      summary: {
        totalPendingAccounts,
        totalOutstandingAmount,
        ipdPending,
        opdPending,
        overdueAccounts,
      },
    });
  } catch (err) {
    console.error('[pharmacy/pending-dues] summary', err);
    return res.status(500).json({ message: 'Failed to fetch pending dues summary' });
  }
};

const listPendingDues = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { where, patientType, statusFilter } = buildPendingWhere({
      q: req.query.q,
      patientType: req.query.patientType,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    const bills = await prisma.pharmacyBill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: BILL_SELECT,
    });

    let rows = await enrichBillsWithTypes(bills);
    rows = filterByPatientTypeAndStatus(rows, { patientType, statusFilter });

    const total = rows.length;
    const start = (page - 1) * limit;
    const items = rows.slice(start, start + limit);

    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error('[pharmacy/pending-dues] list', err);
    return res.status(500).json({ message: 'Failed to fetch pending dues' });
  }
};

const getPatientPendingDues = async (req, res) => {
  try {
    const patientId = req.params.patientId;
    if (!isUuid(patientId)) return res.status(400).json({ message: 'Invalid patient id' });

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true },
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const bills = await prisma.pharmacyBill.findMany({
      where: {
        patientId,
        billingType: 'HOSPITAL_PATIENT',
        status: { in: PENDING_BILL_STATUSES },
        pendingAmount: { gt: 0 },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        ...BILL_SELECT,
        items: { orderBy: { id: 'asc' }, select: { id: true, medicineName: true, quantity: true, amount: true } },
      },
    });

    const ipdSet = await getIpdPatientIds([patientId]);
    const patientType = bills.length ? resolvePatientType(bills[0], ipdSet) : 'OPD';

    const billIds = bills.map((b) => b.id);
    const payments = billIds.length
      ? await prisma.pharmacyPayment.findMany({
          where: { billId: { in: billIds } },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const dueRows = bills.map((bill) =>
      mapDueRow(bill, { patientType: resolvePatientType(bill, ipdSet), payments: payments.filter((p) => p.billId === bill.id) })
    );

    const totalAmount = roundMoney(bills.reduce((s, b) => s + Number(b.grandTotal), 0));
    const paidAmount = roundMoney(bills.reduce((s, b) => s + Number(b.paidAmount), 0));
    const pendingAmount = roundMoney(bills.reduce((s, b) => s + Number(b.pendingAmount), 0));

    return res.json({
      patient,
      patientType,
      summary: {
        totalBills: bills.length,
        totalAmount,
        paidAmount,
        pendingAmount,
      },
      outstandingBills: dueRows,
      recentPayments: payments.slice(0, 10).map(mapPayment),
      paymentHistory: payments.map(mapPayment),
    });
  } catch (err) {
    console.error('[pharmacy/pending-dues] patient', err);
    return res.status(500).json({ message: 'Failed to fetch patient pending dues' });
  }
};

const checkPatientDues = async (req, res) => {
  try {
    const patientId = req.params.patientId;
    if (!isUuid(patientId)) return res.status(400).json({ message: 'Invalid patient id' });

    const bills = await prisma.pharmacyBill.findMany({
      where: {
        patientId,
        billingType: 'HOSPITAL_PATIENT',
        status: { in: PENDING_BILL_STATUSES },
        pendingAmount: { gt: 0 },
      },
      select: {
        id: true,
        billNumber: true,
        grandTotal: true,
        paidAmount: true,
        pendingAmount: true,
        status: true,
        dueDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPendingAmount = roundMoney(bills.reduce((s, b) => s + Number(b.pendingAmount), 0));
    const hasPendingDues = totalPendingAmount > 0;

    return res.json({
      patientId,
      hasPendingDues,
      totalPendingAmount,
      billCount: bills.length,
      bills: bills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        totalAmount: toNum(b.grandTotal),
        paidAmount: toNum(b.paidAmount),
        pendingAmount: toNum(b.pendingAmount),
        status: deriveDueStatus(b),
        dueDate: b.dueDate,
      })),
      warning: hasPendingDues ? 'Patient has pending pharmacy dues.' : null,
    });
  } catch (err) {
    console.error('[pharmacy/pending-dues] check', err);
    return res.status(500).json({ message: 'Failed to check pharmacy dues' });
  }
};

const collectPayment = async (req, res) => {
  try {
    const body = req.body || {};
    const billId = String(body.billId || '').trim();
    const amountReceived = roundMoney(Number(body.amountReceived ?? body.amount ?? 0));
    const paymentModeRaw = String(body.paymentMode || 'CASH').trim().toUpperCase();
    const paymentModes = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'MIXED'];
    const paymentMode = paymentModes.includes(paymentModeRaw) ? paymentModeRaw : null;
    const notes = String(body.notes || '').trim() || null;
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();

    if (!isUuid(billId)) return res.status(400).json({ message: 'Valid bill id is required' });
    if (!paymentMode) return res.status(400).json({ message: 'Valid payment mode is required' });
    if (amountReceived <= 0) return res.status(400).json({ message: 'Amount received must be greater than zero' });
    if (Number.isNaN(paymentDate.getTime())) return res.status(400).json({ message: 'Invalid payment date' });

    const bill = await prisma.pharmacyBill.findUnique({ where: { id: billId } });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (!PENDING_BILL_STATUSES.includes(bill.status)) {
      return res.status(400).json({ message: 'This bill has no pending dues' });
    }

    const currentPending = roundMoney(Number(bill.pendingAmount));
    if (amountReceived > currentPending) {
      return res.status(400).json({ message: `Amount exceeds pending balance of ₹${currentPending}` });
    }

    const { paidAmount, pendingAmount, status } = applyPaymentToBill(bill, amountReceived);

    const result = await prisma.$transaction(
      async (tx) => {
        const payment = await tx.pharmacyPayment.create({
          data: {
            billId: bill.id,
            patientId: bill.patientId || null,
            amount: amountReceived,
            paymentMode,
            notes,
            createdBy: req.user?.userId || null,
            createdAt: paymentDate,
          },
        });

        const updatedBill = await tx.pharmacyBill.update({
          where: { id: bill.id },
          data: {
            paidAmount,
            pendingAmount,
            status,
            paymentMode,
            dueDate: pendingAmount > 0 ? bill.dueDate || computeDueDate() : null,
          },
          select: BILL_SELECT,
        });

        return { payment, updatedBill };
      },
      PRISMA_TX
    );

    const ipdSet = bill.patientId ? await getIpdPatientIds([bill.patientId]) : new Set();
    const dueRow = mapDueRow(result.updatedBill, {
      patientType: resolvePatientType(result.updatedBill, ipdSet),
      payments: [result.payment],
    });

    return res.status(201).json({
      message: pendingAmount <= 0 ? 'Payment collected — bill cleared' : 'Payment collected successfully',
      payment: mapPayment(result.payment),
      bill: dueRow,
    });
  } catch (err) {
    console.error('[pharmacy/pending-dues] payment', err);
    return res.status(500).json({ message: err?.message || 'Failed to collect payment' });
  }
};

const getBillDetails = async (req, res) => {
  try {
    const billId = req.params.billId;
    if (!isUuid(billId)) return res.status(400).json({ message: 'Invalid bill id' });

    const bill = await prisma.pharmacyBill.findUnique({
      where: { id: billId },
      select: {
        ...BILL_SELECT,
        items: { orderBy: { id: 'asc' } },
      },
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    const payments = await prisma.pharmacyPayment.findMany({
      where: { billId },
      orderBy: { createdAt: 'desc' },
    });

    const ipdSet = bill.patientId ? await getIpdPatientIds([bill.patientId]) : new Set();
    const patientType = resolvePatientType(bill, ipdSet);

    return res.json({
      bill: mapDueRow(bill, { patientType, payments }),
      patient: bill.patient || {
        name: bill.patientName || bill.customerName,
        uhid: bill.patientUhid,
        mobile: bill.customerMobile,
      },
      items: (bill.items || []).map((i) => ({
        id: i.id,
        medicineName: i.medicineName,
        quantity: i.quantity,
        amount: toNum(i.amount),
      })),
      paymentHistory: payments.map(mapPayment),
    });
  } catch (err) {
    console.error('[pharmacy/pending-dues] bill-details', err);
    return res.status(500).json({ message: 'Failed to fetch bill details' });
  }
};

module.exports = {
  getSummary,
  listPendingDues,
  getPatientPendingDues,
  checkPatientDues,
  collectPayment,
  getBillDetails,
};
