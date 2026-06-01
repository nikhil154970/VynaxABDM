const { toNum, roundMoney } = require('./billingHelpers');
const { deriveDueStatus, dueStatusLabel } = require('./pendingDuesHelpers');

const LOW_STOCK_MIN = Number(process.env.PHARMACY_LOW_STOCK_MIN) || 20;
const BILL_FINALIZED = { status: { notIn: ['DRAFT', 'CANCELLED'] } };

function resolveReportDateRange(preset, dateFrom, dateTo) {
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
  if (p === 'today') return { gte: startOfDay(now), lte: endOfDay(now) };
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
  if (p === 'this_year') {
    const d = new Date(now.getFullYear(), 0, 1);
    return { gte: startOfDay(d), lte: endOfDay(now) };
  }
  if (p === 'custom' || dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.gte = startOfDay(new Date(dateFrom));
    if (dateTo) range.lte = endOfDay(new Date(dateTo));
    if (Object.keys(range).length) return range;
  }
  return null;
}

function dateFilterFromQuery(query) {
  return resolveReportDateRange(query.datePreset, query.dateFrom, query.dateTo);
}

function withCreatedAt(range) {
  if (!range) return {};
  return { createdAt: range };
}

function withReceivedDate(range) {
  if (!range) return {};
  return { receivedDate: range };
}

function daysUntil(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function groupByDay(rows, dateField, valueField) {
  const map = new Map();
  rows.forEach((row) => {
    const raw = row[dateField];
    if (!raw) return;
    const key = new Date(raw).toISOString().slice(0, 10);
    map.set(key, roundMoney((map.get(key) || 0) + toNum(row[valueField])));
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount, label: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }));
}

function groupByMonth(rows, dateField, valueField) {
  const map = new Map();
  rows.forEach((row) => {
    const raw = row[dateField];
    if (!raw) return;
    const d = new Date(raw);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, roundMoney((map.get(key) || 0) + toNum(row[valueField])));
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => {
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      return { date: key, amount, label };
    });
}

function paymentModeLabel(mode) {
  if (!mode) return '—';
  return String(mode)
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function billStatusLabel(status) {
  const map = {
    PAID: 'Paid',
    PARTIALLY_PAID: 'Partially Paid',
    PENDING_PAYMENT: 'Pending',
    CANCELLED: 'Cancelled',
    DRAFT: 'Draft',
  };
  return map[status] || status;
}

function returnTypeLabel(t) {
  const map = {
    CUSTOMER_RETURN: 'Customer Return',
    VENDOR_RETURN: 'Vendor Return',
    EXPIRED_RETURN: 'Expired Return',
    DAMAGED_RETURN: 'Damaged Return',
  };
  return map[t] || t;
}

function returnStatusLabel(s) {
  const map = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return map[s] || s;
}

async function aggregateStockByMedicine(prisma) {
  const batches = await prisma.pharmacyInventoryBatch.findMany({
    where: { status: { in: ['ACTIVE', 'DEPLETED'] } },
    select: {
      medicineId: true,
      medicineName: true,
      availableQty: true,
      purchasePrice: true,
      expiryDate: true,
      batchNumber: true,
    },
  });
  const map = new Map();
  for (const b of batches) {
    const cur = map.get(b.medicineId) || {
      medicineId: b.medicineId,
      medicineName: b.medicineName,
      availableQty: 0,
      inventoryValue: 0,
      batchCount: 0,
      nearestExpiry: null,
    };
    cur.availableQty += b.availableQty;
    cur.inventoryValue = roundMoney(cur.inventoryValue + b.availableQty * toNum(b.purchasePrice));
    cur.batchCount += 1;
    if (b.expiryDate && (!cur.nearestExpiry || new Date(b.expiryDate) < new Date(cur.nearestExpiry))) {
      cur.nearestExpiry = b.expiryDate;
    }
    map.set(b.medicineId, cur);
  }
  return map;
}

module.exports = {
  LOW_STOCK_MIN,
  BILL_FINALIZED,
  resolveReportDateRange,
  dateFilterFromQuery,
  withCreatedAt,
  withReceivedDate,
  daysUntil,
  groupByDay,
  groupByMonth,
  paymentModeLabel,
  billStatusLabel,
  returnTypeLabel,
  returnStatusLabel,
  deriveDueStatus,
  dueStatusLabel,
  aggregateStockByMedicine,
  toNum,
  roundMoney,
};
