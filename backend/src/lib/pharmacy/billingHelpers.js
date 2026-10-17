const { isUuid, toNum } = require('./helpers');

const PRISMA_TX = { maxWait: 15_000, timeout: 45_000 };

const BILL_INCLUDE = {
  items: { orderBy: { id: 'asc' } },
  patient: { select: { id: true, name: true, uhid: true, mobile: true } },
};

function normalizeString(v) {
  if (v == null) return '';
  return String(v).trim();
}

function parseNumber(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function calcLineAmount(qty, sellingPrice, discountPercent, gstPercentage) {
  const quantity = Math.max(0, parseInt(qty, 10) || 0);
  const price = Math.max(0, parseNumber(sellingPrice, 0));
  const disc = Math.min(100, Math.max(0, parseNumber(discountPercent, 0)));
  const gst = Math.max(0, parseInt(gstPercentage, 10) || 0);

  const basePrice = price / (1 + gst / 100);
  const lineBase = quantity * basePrice;
  const afterDisc = lineBase - (lineBase * disc) / 100;
  const lineGst = (afterDisc * gst) / 100;
  return {
    quantity,
    lineBase: roundMoney(lineBase),
    afterDisc: roundMoney(afterDisc),
    lineGst: roundMoney(lineGst),
    amount: roundMoney(afterDisc + lineGst),
  };
}

function calcBillTotals(items) {
  let subTotal = 0;
  let discount = 0;
  let gstAmount = 0;
  items.forEach((row) => {
    const price = parseNumber(row.sellingPrice ?? row.mrp, 0);
    const qty = Math.max(0, parseInt(row.quantity, 10) || 0);
    const discPct = parseNumber(row.discountPercent, 0);
    const gst = parseInt(row.gstPercentage, 10) || 0;

    const basePrice = price / (1 + gst / 100);
    const lineBase = qty * basePrice;
    const lineDisc = (lineBase * discPct) / 100;
    const afterDisc = lineBase - lineDisc;

    subTotal += lineBase;
    discount += lineDisc;
    gstAmount += (afterDisc * gst) / 100;
  });
  return {
    subTotal: roundMoney(subTotal),
    discount: roundMoney(discount),
    gstAmount: roundMoney(gstAmount),
    grandTotal: roundMoney(subTotal - discount + gstAmount),
  };
}

function derivePaymentStatus(grandTotal, paidAmount, isDraft = false) {
  if (isDraft) return 'DRAFT';
  const total = roundMoney(grandTotal);
  const paid = roundMoney(paidAmount);
  if (paid <= 0) return 'PENDING_PAYMENT';
  if (paid >= total) return 'PAID';
  return 'PARTIALLY_PAID';
}

function statusApi(status) {
  const map = {
    DRAFT: 'Draft',
    PENDING_PAYMENT: 'Pending Payment',
    PARTIALLY_PAID: 'Partially Paid',
    PAID: 'Paid',
    CANCELLED: 'Cancelled',
  };
  return map[status] || status;
}

function billingTypeApi(t) {
  return t === 'WALK_IN' ? 'Walk-in' : 'Hospital';
}

function paymentModeApi(m) {
  if (!m) return '';
  return String(m).charAt(0) + String(m).slice(1).toLowerCase();
}

function mapBill(row) {
  if (!row) return null;
  return {
    id: row.id,
    billNumber: row.billNumber,
    billingType: row.billingType,
    billingTypeLabel: billingTypeApi(row.billingType),
    patientId: row.patientId || null,
    receptionVisitId: row.receptionVisitId || null,
    customerName: row.customerName || '',
    customerMobile: row.customerMobile || '',
    patientName: row.patientName || row.patient?.name || row.customerName || '',
    patientUhid: row.patientUhid || row.patient?.uhid || '',
    tokenNumber: row.tokenNumber || '',
    doctorName: row.doctorName || '',
    department: row.department || '',
    visitDate: row.visitDate,
    subTotal: toNum(row.subTotal),
    discount: toNum(row.discount),
    gstAmount: toNum(row.gstAmount),
    grandTotal: toNum(row.grandTotal),
    paidAmount: toNum(row.paidAmount),
    pendingAmount: toNum(row.pendingAmount),
    paymentMode: row.paymentMode || null,
    paymentModeLabel: paymentModeApi(row.paymentMode),
    status: row.status,
    statusLabel: statusApi(row.status),
    dispenseStatus: row.dispenseStatus,
    remarks: row.remarks || '',
    createdBy: row.createdBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: (row.items || []).map((item) => ({
      id: item.id,
      medicineId: item.medicineId,
      inventoryBatchId: item.inventoryBatchId,
      medicineName: item.medicineName,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      quantity: item.quantity,
      mrp: toNum(item.mrp),
      sellingPrice: toNum(item.sellingPrice),
      discountPercent: toNum(item.discountPercent),
      gstPercentage: item.gstPercentage,
      amount: toNum(item.amount),
    })),
  };
}

module.exports = {
  PRISMA_TX,
  BILL_INCLUDE,
  normalizeString,
  parseNumber,
  roundMoney,
  calcLineAmount,
  calcBillTotals,
  derivePaymentStatus,
  mapBill,
  isUuid,
  toNum,
  statusApi,
};
