const { toNum, roundMoney } = require('./billingHelpers');
const { getHospitalPrintMeta } = require('../hospitalBranding');
const { resolvePatientType, patientTypeLabel } = require('./pendingDuesHelpers');

const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_PAYMENT: 'Pending',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

const STATUS_FILTER_MAP = {
  PAID: 'PAID',
  PENDING: 'PENDING_PAYMENT',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  CANCELLED: 'CANCELLED',
};

function historyStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function paymentModeLabel(mode) {
  if (!mode) return '—';
  return String(mode)
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function resolveDateRange(preset, dateFrom, dateTo) {
  const now = new Date();
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  const p = String(preset || '').toLowerCase();
  if (p === 'today') {
    return { gte: startOfDay(now), lte: endOfDay(now) };
  }
  if (p === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { gte: startOfDay(y), lte: endOfDay(y) };
  }
  if (p === 'this_week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return { gte: startOfDay(d), lte: endOfDay(now) };
  }
  if (p === 'this_month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { gte: startOfDay(d), lte: endOfDay(now) };
  }
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.gte = startOfDay(new Date(dateFrom));
    if (dateTo) range.lte = endOfDay(new Date(dateTo));
    return Object.keys(range).length ? range : null;
  }
  return null;
}

function buildHistoryWhere({
  q,
  status,
  paymentMode,
  datePreset,
  dateFrom,
  dateTo,
} = {}) {
  const where = {
    NOT: [
      { status: 'DRAFT' },
      { tokenNumber: { startsWith: 'IPD', mode: 'insensitive' } },
    ],
  };

  if (q) {
    const term = String(q).trim();
    where.OR = [
      { billNumber: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
      { patientUhid: { contains: term, mode: 'insensitive' } },
      { customerName: { contains: term, mode: 'insensitive' } },
      { customerMobile: { contains: term, mode: 'insensitive' } },
      { patient: { mobile: { contains: term, mode: 'insensitive' } } },
      { patient: { uhid: { contains: term, mode: 'insensitive' } } },
      { patient: { name: { contains: term, mode: 'insensitive' } } },
    ];
  }

  if (status) {
    const mapped = STATUS_FILTER_MAP[String(status).toUpperCase()] || status;
    where.status = mapped;
  }

  if (paymentMode) {
    where.paymentMode = String(paymentMode).toUpperCase();
  }

  const createdAt = resolveDateRange(datePreset, dateFrom, dateTo);
  if (createdAt) where.createdAt = createdAt;

  return where;
}

function filterByPatientType(rows, patientType) {
  if (!patientType) return rows;
  const pt = String(patientType).toUpperCase();
  return rows.filter((r) => r.patientType === pt);
}

function mapHistoryRow(bill, { patientType, createdByName = '—' } = {}) {
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    patientId: bill.patientId || null,
    patientName: bill.patientName || bill.patient?.name || bill.customerName || '—',
    patientUhid: bill.patientUhid || bill.patient?.uhid || '—',
    patientMobile: bill.patient?.mobile || bill.customerMobile || '',
    patientType,
    patientTypeLabel: patientTypeLabel(patientType),
    billingType: bill.billingType,
    billDate: bill.createdAt,
    totalAmount: toNum(bill.grandTotal),
    paidAmount: toNum(bill.paidAmount),
    pendingAmount: toNum(bill.pendingAmount),
    paymentMode: bill.paymentMode || null,
    paymentModeLabel: paymentModeLabel(bill.paymentMode),
    status: bill.status,
    statusLabel: historyStatusLabel(bill.status),
    createdBy: bill.createdBy || null,
    createdByName,
    doctorName: bill.doctorName || '',
    department: bill.department || '',
    subTotal: toNum(bill.subTotal),
    discount: toNum(bill.discount),
    gstAmount: toNum(bill.gstAmount),
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
  };
}

function mapPaymentRow(row, userMap = {}) {
  return {
    id: row.id,
    billId: row.billId,
    amount: toNum(row.amount),
    paymentMode: row.paymentMode,
    paymentModeLabel: paymentModeLabel(row.paymentMode),
    notes: row.notes || '',
    createdBy: row.createdBy || null,
    collectedBy: row.createdBy ? userMap[row.createdBy] || 'Staff' : '—',
    createdAt: row.createdAt,
  };
}

function buildPrintData(bill, items) {
  return {
    hospital: getHospitalPrintMeta(),
    billNumber: bill.billNumber,
    billDate: bill.createdAt,
    billingType: bill.billingType === 'WALK_IN' ? 'Walk-in Customer' : 'Hospital Patient',
    status: bill.status,
    patient: {
      name: bill.patientName || bill.customerName || '—',
      uhid: bill.patientUhid || '—',
      mobile: bill.customerMobile || bill.patient?.mobile || '—',
      token: bill.tokenNumber || '—',
      doctor: bill.doctorName || '—',
      department: bill.department || '—',
      visitDate: bill.visitDate,
    },
    items: items.map((item, idx) => ({
      sno: idx + 1,
      medicineName: item.medicineName,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      quantity: item.quantity,
      mrp: toNum(item.mrp),
      discountPercent: toNum(item.discountPercent),
      gstPercentage: item.gstPercentage,
      amount: toNum(item.amount),
    })),
    subTotal: toNum(bill.subTotal),
    discount: toNum(bill.discount),
    gstAmount: toNum(bill.gstAmount),
    grandTotal: toNum(bill.grandTotal),
    paidAmount: toNum(bill.paidAmount),
    pendingAmount: toNum(bill.pendingAmount),
    paymentMode: bill.paymentMode || '—',
    printGeneratedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildHistoryWhere,
  filterByPatientType,
  mapHistoryRow,
  mapPaymentRow,
  buildPrintData,
  historyStatusLabel,
  paymentModeLabel,
  STATUS_FILTER_MAP,
};
