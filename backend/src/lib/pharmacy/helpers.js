const { UUID_RE } = require('./constants');

function normalizeString(v) {
  if (v == null) return '';
  return String(v).trim();
}

function parseNumber(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseBool(v, fallback = false) {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return fallback;
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isUuid(v) {
  return UUID_RE.test(normalizeString(v));
}

function toNum(v) {
  return v != null ? Number(v) : 0;
}

function catalogStatusApi(status) {
  return status === 'INACTIVE' ? 'inactive' : 'active';
}

function catalogStatusDb(status) {
  return normalizeString(status).toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE';
}

function batchStatusApi(status) {
  if (status === 'DEPLETED') return 'depleted';
  if (status === 'EXPIRED') return 'expired';
  return 'active';
}

function batchStatusDb(status) {
  const s = normalizeString(status).toLowerCase();
  if (s === 'depleted') return 'DEPLETED';
  if (s === 'expired') return 'EXPIRED';
  return 'ACTIVE';
}

function mapSupplierBrief(supplier) {
  if (!supplier) return null;
  return {
    id: supplier.id,
    supplierName: supplier.supplierName,
    companyName: supplier.companyName || '',
    phone: supplier.phone,
    email: supplier.email || '',
    gstNumber: supplier.gstNumber,
    contactPerson: supplier.contactPerson || '',
    address: supplier.address || '',
    city: supplier.city || '',
    state: supplier.state || '',
    pincode: supplier.pincode || '',
  };
}

const poInclude = {
  supplier: true,
  items: { orderBy: { id: 'asc' } },
};

const grnInclude = {
  supplier: true,
  purchaseOrder: { select: { id: true, poNumber: true, status: true, grandTotal: true } },
  items: { orderBy: { id: 'asc' } },
};

function mapPurchaseOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    poNumber: order.poNumber,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    supplier: mapSupplierBrief(order.supplier),
    items: (order.items || []).map((item) => ({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      quantity: item.quantity,
      purchasePrice: toNum(item.purchasePrice),
      gstPercentage: item.gstPercentage,
      amount: toNum(item.amount),
    })),
    subTotal: toNum(order.subTotal),
    gstAmount: toNum(order.gstAmount),
    grandTotal: toNum(order.grandTotal),
    remarks: order.remarks || '',
    status: order.status,
    createdBy: order.createdBy || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function mapGrn(grn) {
  if (!grn) return null;
  const po = grn.purchaseOrder;
  return {
    id: grn.id,
    grnNumber: grn.grnNumber,
    purchaseOrderId: grn.purchaseOrderId,
    poNumber: grn.poNumber,
    supplierId: grn.supplierId,
    supplierName: grn.supplierName,
    invoiceNumber: grn.invoiceNumber || '',
    invoiceDate: grn.invoiceDate,
    receivedDate: grn.receivedDate,
    items: (grn.items || []).map((item) => ({
      id: item.id,
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      orderedQty: item.orderedQty,
      receivedQty: item.receivedQty,
      freeQty: item.freeQty ?? 0,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      purchasePrice: toNum(item.purchasePrice),
      sellingPrice: toNum(item.sellingPrice),
      mrp: toNum(item.mrp),
      gstPercentage: item.gstPercentage,
      amount: toNum(item.amount),
      stockQty: (item.receivedQty || 0) + (item.freeQty || 0),
    })),
    subTotal: toNum(grn.subTotal),
    gstAmount: toNum(grn.gstAmount),
    grandTotal: toNum(grn.grandTotal),
    remarks: grn.remarks || '',
    receiptStatus: grn.receiptStatus || 'Partial',
    status: grn.status,
    createdBy: grn.createdBy || null,
    createdAt: grn.createdAt,
    updatedAt: grn.updatedAt,
    purchaseOrder: po
      ? {
          id: po.id,
          poNumber: po.poNumber,
          status: po.status,
          grandTotal: toNum(po.grandTotal),
        }
      : null,
    supplier: grn.supplier
      ? {
          id: grn.supplier.id,
          supplierName: grn.supplier.supplierName,
          phone: grn.supplier.phone,
          gstNumber: grn.supplier.gstNumber,
          address: [grn.supplier.address, grn.supplier.city, grn.supplier.state, grn.supplier.pincode]
            .filter(Boolean)
            .join(', '),
        }
      : null,
  };
}

module.exports = {
  normalizeString,
  parseNumber,
  parseBool,
  parseDate,
  isUuid,
  toNum,
  catalogStatusApi,
  catalogStatusDb,
  batchStatusApi,
  batchStatusDb,
  mapSupplierBrief,
  poInclude,
  grnInclude,
  mapPurchaseOrder,
  mapGrn,
};
