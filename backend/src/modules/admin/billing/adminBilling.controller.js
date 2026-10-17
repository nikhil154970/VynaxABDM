const { prisma } = require('../../../config/prisma');

function normalizeString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
}

function toStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toEndOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function billDateToYmd(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function billPendingAmount(b) {
  const st = String(b?.status || '').toUpperCase();
  if (st === 'CANCELLED') return 0;
  const total = Math.max(0, Number(b?.totalAmount) || 0);
  const paidRaw = Math.max(0, Number(b?.paidAmount) || 0);
  const payments = Array.isArray(b?.payments) ? b.payments : [];
  const paidByPayments = payments.reduce((s, p) => s + Math.max(0, Number(p?.amount) || 0), 0);
  const paid = Math.max(paidRaw, paidByPayments);
  return Math.max(0, Math.round(total - paid));
}

function billPaidAmount(b) {
  const paidRaw = Math.max(0, Number(b?.paidAmount) || 0);
  const payments = Array.isArray(b?.payments) ? b.payments : [];
  const paidByPayments = payments.reduce((s, p) => s + Math.max(0, Number(p?.amount) || 0), 0);
  return Math.max(paidRaw, paidByPayments);
}

function derivePaymentStatus(b, pending, paid) {
  const st = String(b?.status || '').toUpperCase();
  if (st === 'CANCELLED') return 'Cancelled';
  if (pending <= 0 && (Number(b?.totalAmount) || 0) > 0) return 'Paid';
  if (paid > 0 && pending > 0) return 'Partial';
  if (st === 'PAID') return 'Paid';
  if (st === 'PARTIAL') return 'Partial';
  return 'Pending';
}

function uiStatusToEnum(label) {
  const s = normalizeString(label).toLowerCase();
  if (s === 'paid') return 'PAID';
  if (s === 'partial') return 'PARTIAL';
  if (s === 'pending') return 'PENDING';
  return null;
}

function isLabRelatedBill(b) {
  if (!b) return false;
  if (Array.isArray(b.labOrders) && b.labOrders.length) return true;
  const notes = String(b.notes || '').toLowerCase();
  if (notes.includes('lab order') || notes.includes('lab advice') || notes.includes('opd lab')) return true;
  const items = Array.isArray(b.lineItems) ? b.lineItems : [];
  return items.some((i) => /lab\s*test|laboratory/i.test(String(i.description || '')));
}

function isOtRelatedBill(b) {
  if (!b) return false;
  if (b.otRequest) return true;
  const notes = String(b.notes || '').toLowerCase();
  if (/\bot\b/.test(notes) || notes.includes('operation') || notes.includes('surgery')) return true;
  const items = Array.isArray(b.lineItems) ? b.lineItems : [];
  return items.some((i) => /\bot\b|operation|surgery/i.test(String(i.description || '')));
}

function categorizeBill(b) {
  if (!b) return 'OPD';
  if (isLabRelatedBill(b)) return 'LAB';
  if (isOtRelatedBill(b)) return 'OT';
  if (String(b.visitType || '').toUpperCase() === 'IPD') return 'IPD';
  return 'OPD';
}

function buildBillWhere(req) {
  const qRaw = normalizeString(req.query.q);
  const visitFilter = normalizeString(req.query.visitType);
  const paymentStatusUi = normalizeString(req.query.paymentStatus);
  const statusEnum = uiStatusToEnum(paymentStatusUi);
  const paymentMode = normalizeString(req.query.paymentMode);
  const dateFrom = normalizeString(req.query.dateFrom);
  const dateTo = normalizeString(req.query.dateTo);
  const category = normalizeString(req.query.category).toUpperCase();

  const where = {
    NOT: { status: 'CANCELLED' },
  };

  if (visitFilter && (visitFilter.toUpperCase() === 'OPD' || visitFilter.toUpperCase() === 'IPD')) {
    where.visitType = visitFilter.toUpperCase() === 'IPD' ? 'IPD' : 'OPD';
  }
  if (statusEnum) where.status = statusEnum;
  if (paymentMode) where.lastPaymentMode = paymentMode;

  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    const [yf, mf, df] = dateFrom.split('-').map(Number);
    const d0 = new Date(yf, mf - 1, df);
    if (!Number.isNaN(d0.getTime())) where.billDate = { ...(where.billDate || {}), gte: toStartOfDay(d0) };
  }
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    const [yt, mt, dt] = dateTo.split('-').map(Number);
    const d1 = new Date(yt, mt - 1, dt);
    if (!Number.isNaN(d1.getTime())) where.billDate = { ...(where.billDate || {}), lte: toEndOfDay(d1) };
  }
  if (qRaw) {
    where.OR = [
      { billNumber: { contains: qRaw, mode: 'insensitive' } },
      { patient: { name: { contains: qRaw, mode: 'insensitive' } } },
      { patient: { uhid: { contains: qRaw, mode: 'insensitive' } } },
    ];
  }

  if (category === 'LAB') {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { labOrders: { some: {} } },
          { notes: { contains: 'lab', mode: 'insensitive' } },
          { lineItems: { some: { description: { contains: 'lab', mode: 'insensitive' } } } },
        ],
      },
    ];
  } else if (category === 'OT') {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { otRequest: { isNot: null } },
          { notes: { contains: 'ot', mode: 'insensitive' } },
          { lineItems: { some: { description: { contains: 'ot', mode: 'insensitive' } } } },
        ],
      },
    ];
  } else if (category === 'IPD') {
    where.visitType = 'IPD';
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      { labOrders: { none: {} } },
      { otRequest: null },
    ];
  } else if (category === 'OPD') {
    where.visitType = 'OPD';
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      { labOrders: { none: {} } },
      { otRequest: null },
    ];
  }

  return where;
}

function mapAdminBillRow(b) {
  const paid = billPaidAmount(b);
  const pending = billPendingAmount(b);
  const total = Math.max(0, Number(b.totalAmount) || 0);
  return {
    id: b.id,
    billNumber: b.billNumber,
    patientName: b.patient?.name || '',
    uhid: b.patient?.uhid || '',
    visitType: b.visitType === 'IPD' ? 'IPD' : 'OPD',
    category: categorizeBill(b),
    total,
    paid,
    pending,
    paymentStatus: derivePaymentStatus(b, pending, paid),
    paymentMode: b.lastPaymentMode || '—',
    date: billDateToYmd(b.billDate),
  };
}

async function computeSummaryForWhere(where) {
  const now = new Date();
  const todayStart = toStartOfDay(now);
  const todayEnd = toEndOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = toEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const billWhere = { ...where, NOT: { status: 'CANCELLED' } };

  const [rows, paidCount, partialCount, pendingCount, revToday, revMonth] = await Promise.all([
    prisma.bill.findMany({
      where: billWhere,
      select: {
        totalAmount: true,
        paidAmount: true,
        status: true,
        payments: { select: { amount: true } },
      },
      take: 10000,
    }),
    prisma.bill.count({ where: { ...billWhere, status: 'PAID' } }),
    prisma.bill.count({ where: { ...billWhere, status: 'PARTIAL' } }),
    prisma.bill.count({ where: { ...billWhere, status: 'PENDING' } }),
    prisma.billPayment.aggregate({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        bill: billWhere,
      },
      _sum: { amount: true },
    }),
    prisma.billPayment.aggregate({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
        bill: billWhere,
      },
      _sum: { amount: true },
    }),
  ]);

  let totalBilled = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let exactPaid = 0;
  let exactPartial = 0;
  let exactPending = 0;

  for (const b of rows) {
    const paid = billPaidAmount(b);
    const pending = billPendingAmount(b);
    const total = Math.max(0, Number(b.totalAmount) || 0);
    totalBilled += total;
    totalCollected += paid;
    totalPending += pending;
    const ui = derivePaymentStatus(b, pending, paid);
    if (ui === 'Paid') exactPaid += 1;
    else if (ui === 'Partial') exactPartial += 1;
    else if (ui === 'Pending') exactPending += 1;
  }

  return {
    total: rows.length,
    paidCount: exactPaid,
    partialCount: exactPartial,
    pendingCount: exactPending,
    statusPaidCount: paidCount,
    statusPartialCount: partialCount,
    statusPendingCount: pendingCount,
    totalBilled,
    totalCollected,
    totalPending,
    revenueToday: Math.round(Number(revToday._sum?.amount) || 0),
    revenueMonth: Math.round(Number(revMonth._sum?.amount) || 0),
  };
}

async function listAdminBills(req, res) {
  try {
    const where = buildBillWhere(req);

    const [items, summary] = await Promise.all([
      prisma.bill.findMany({
        where,
        orderBy: [{ billDate: 'desc' }, { createdAt: 'desc' }],
        take: 500,
        include: {
          patient: { select: { id: true, name: true, uhid: true } },
          labOrders: { select: { id: true } },
          otRequest: { select: { id: true } },
          lineItems: { select: { description: true } },
          payments: { select: { amount: true } },
        },
      }),
      computeSummaryForWhere(where),
    ]);

    return res.json({
      items: items.map(mapAdminBillRow),
      summary,
    });
  } catch (e) {
    console.error('listAdminBills error:', e);
    return res.status(500).json({ message: 'Could not load bills' });
  }
}

module.exports = { listAdminBills };
