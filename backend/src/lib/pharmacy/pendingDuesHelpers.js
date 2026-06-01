const { roundMoney, derivePaymentStatus, toNum } = require('./billingHelpers');

const DUE_TERM_DAYS = 7;

const PENDING_BILL_STATUSES = ['PENDING_PAYMENT', 'PARTIALLY_PAID'];

function computeDueDate(fromDate = new Date()) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + DUE_TERM_DAYS);
  return d;
}

function deriveDueStatus(bill) {
  const pending = roundMoney(Number(bill.pendingAmount || 0));
  if (pending <= 0) return 'CLEARED';
  let dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
  if (!dueDate && bill.createdAt) {
    dueDate = computeDueDate(bill.createdAt);
  }
  if (dueDate && !Number.isNaN(dueDate.getTime()) && new Date() > dueDate) return 'OVERDUE';
  if (bill.status === 'PARTIALLY_PAID') return 'PARTIALLY_PAID';
  return 'PENDING';
}

function dueStatusLabel(status) {
  const map = {
    PENDING: 'Pending',
    PARTIALLY_PAID: 'Partially Paid',
    OVERDUE: 'Overdue',
    CLEARED: 'Cleared',
  };
  return map[status] || status;
}

function patientTypeLabel(type) {
  const map = { IPD: 'IPD', OPD: 'OPD', WALK_IN: 'Walk-In' };
  return map[type] || type;
}

function resolvePatientType(bill, ipdPatientIds) {
  if (bill.billingType === 'WALK_IN') return 'WALK_IN';
  if (bill.patientId && ipdPatientIds.has(bill.patientId)) return 'IPD';
  const token = String(bill.tokenNumber || '');
  if (/^IPD/i.test(token)) return 'IPD';
  return 'OPD';
}

function getLastPaymentDate(bill, payments = []) {
  if (payments.length) {
    const sorted = [...payments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted[0].createdAt;
  }
  if (Number(bill.paidAmount || 0) > 0) return bill.updatedAt || bill.createdAt;
  return null;
}

function mapDueRow(bill, { patientType, payments = [] }) {
  const dueStatus = deriveDueStatus(bill);
  const lastPaymentDate = getLastPaymentDate(bill, payments);
  return {
    id: bill.id,
    billId: bill.id,
    billNumber: bill.billNumber,
    patientId: bill.patientId || null,
    patientName: bill.patientName || bill.patient?.name || bill.customerName || '—',
    patientUhid: bill.patientUhid || bill.patient?.uhid || '—',
    patientMobile: bill.patient?.mobile || bill.customerMobile || '',
    patientType,
    patientTypeLabel: patientTypeLabel(patientType),
    billingType: bill.billingType,
    totalAmount: toNum(bill.grandTotal),
    paidAmount: toNum(bill.paidAmount),
    pendingAmount: toNum(bill.pendingAmount),
    lastPaymentDate,
    dueDate: bill.dueDate || null,
    status: dueStatus,
    statusLabel: dueStatusLabel(dueStatus),
    billStatus: bill.status,
    createdAt: bill.createdAt,
  };
}

function buildPendingWhere({ q, patientType, status, dateFrom, dateTo } = {}) {
  const where = {
    status: { in: PENDING_BILL_STATUSES },
    pendingAmount: { gt: 0 },
    NOT: { status: 'CANCELLED' },
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

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  return { where, patientType, statusFilter: status };
}

function filterByPatientTypeAndStatus(rows, { patientType, statusFilter }) {
  let filtered = rows;
  if (patientType) {
    const pt = String(patientType).toUpperCase();
    filtered = filtered.filter((r) => r.patientType === pt);
  }
  if (statusFilter) {
    const sf = String(statusFilter).toUpperCase();
    filtered = filtered.filter((r) => r.status === sf);
  }
  return filtered;
}

function mapPayment(row) {
  return {
    id: row.id,
    billId: row.billId,
    patientId: row.patientId || null,
    amount: toNum(row.amount),
    paymentMode: row.paymentMode,
    paymentModeLabel: String(row.paymentMode || '')
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' '),
    notes: row.notes || '',
    createdBy: row.createdBy || null,
    createdAt: row.createdAt,
  };
}

function applyPaymentToBill(bill, amountReceived) {
  const grandTotal = roundMoney(Number(bill.grandTotal));
  const currentPaid = roundMoney(Number(bill.paidAmount));
  const newPaid = roundMoney(currentPaid + amountReceived);
  const pendingAmount = roundMoney(Math.max(0, grandTotal - newPaid));
  const status = derivePaymentStatus(grandTotal, newPaid, false);
  return { paidAmount: newPaid, pendingAmount, status };
}

module.exports = {
  DUE_TERM_DAYS,
  PENDING_BILL_STATUSES,
  computeDueDate,
  deriveDueStatus,
  dueStatusLabel,
  patientTypeLabel,
  resolvePatientType,
  getLastPaymentDate,
  mapDueRow,
  buildPendingWhere,
  filterByPatientTypeAndStatus,
  mapPayment,
  applyPaymentToBill,
};
