const { roundMoney, toNum, isUuid, PRISMA_TX } = require('./billingHelpers');

const RETURN_TYPE_LABELS = {
  CUSTOMER_RETURN: 'Customer Return',
  VENDOR_RETURN: 'Vendor Return',
  EXPIRED_RETURN: 'Expired Return',
  DAMAGED_RETURN: 'Damaged Return',
};

const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const REFUND_LABELS = {
  CASH: 'Cash',
  UPI: 'UPI',
  STORE_CREDIT: 'Store Credit',
  NO_REFUND: 'No Refund',
};

function returnTypeLabel(t) {
  return RETURN_TYPE_LABELS[t] || t;
}

function statusLabel(s) {
  return STATUS_LABELS[s] || s;
}

function refundTypeLabel(r) {
  if (!r) return '—';
  return REFUND_LABELS[r] || r;
}

async function generateReturnNumber(prisma) {
  const last = await prisma.pharmacyReturn.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { returnNumber: true },
  });
  const match = last?.returnNumber?.match(/RET-(\d+)/i);
  const next = match ? parseInt(match[1], 10) + 1 : 1;
  return `RET-${String(next).padStart(6, '0')}`;
}

async function getReturnedQtyMap(prisma, billItemIds) {
  if (!billItemIds.length) return new Map();
  const rows = await prisma.pharmacyReturnItem.findMany({
    where: {
      billItemId: { in: billItemIds },
      pharmacyReturn: { status: 'COMPLETED' },
    },
    select: { billItemId: true, quantity: true },
  });
  const map = new Map();
  rows.forEach((r) => {
    if (!r.billItemId) return;
    map.set(r.billItemId, (map.get(r.billItemId) || 0) + r.quantity);
  });
  return map;
}

function mapReturnRow(row, userMap = {}) {
  const itemCount = row.items?.length ?? row._count?.items ?? 0;
  return {
    id: row.id,
    returnNumber: row.returnNumber,
    returnType: row.returnType,
    returnTypeLabel: returnTypeLabel(row.returnType),
    status: row.status,
    statusLabel: statusLabel(row.status),
    billId: row.billId || null,
    supplierId: row.supplierId || null,
    patientId: row.patientId || null,
    referenceNumber: row.referenceNumber || row.bill?.billNumber || '—',
    patientName: row.patientName || row.patient?.name || '—',
    supplierName: row.supplierName || row.supplier?.supplierName || '—',
    refundType: row.refundType || null,
    refundTypeLabel: refundTypeLabel(row.refundType),
    totalAmount: toNum(row.totalAmount),
    remarks: row.remarks || '',
    medicineCount: itemCount,
    createdBy: row.createdBy || null,
    createdByName: row.createdBy ? userMap[row.createdBy] || 'Staff' : '—',
    approvedBy: row.approvedBy || null,
    approvedByName: row.approvedBy ? userMap[row.approvedBy] || 'Staff' : '—',
    approvedAt: row.approvedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: (row.items || []).map(mapReturnItem),
  };
}

function mapReturnItem(item) {
  return {
    id: item.id,
    medicineId: item.medicineId,
    inventoryBatchId: item.inventoryBatchId,
    billItemId: item.billItemId || null,
    medicineName: item.medicineName,
    batchNumber: item.batchNumber,
    quantity: item.quantity,
    purchasePrice: toNum(item.purchasePrice),
    sellingPrice: toNum(item.sellingPrice),
    amount: toNum(item.amount),
    reason: item.reason || '',
  };
}

function stockTxTypeForReturn(returnType) {
  if (returnType === 'CUSTOMER_RETURN') return 'CUSTOMER_RETURN';
  if (returnType === 'VENDOR_RETURN') return 'VENDOR_RETURN';
  if (returnType === 'EXPIRED_RETURN') return 'EXPIRED_RETURN';
  return 'DAMAGED_RETURN';
}

async function applyReturnStock(tx, returnRecord) {
  const txType = stockTxTypeForReturn(returnRecord.returnType);
  const isIncrease = returnRecord.returnType === 'CUSTOMER_RETURN';

  for (const item of returnRecord.items) {
    const batch = await tx.pharmacyInventoryBatch.findUnique({
      where: { id: item.inventoryBatchId },
    });
    if (!batch) throw new Error(`Batch not found for ${item.medicineName}`);

    let newBalance;
    let qtyIn = 0;
    let qtyOut = 0;

    if (returnRecord.returnType === 'EXPIRED_RETURN') {
      qtyOut = batch.availableQty;
      newBalance = 0;
      await tx.pharmacyInventoryBatch.update({
        where: { id: batch.id },
        data: { availableQty: 0, status: 'EXPIRED' },
      });
    } else if (isIncrease) {
      qtyIn = item.quantity;
      newBalance = batch.availableQty + item.quantity;
      await tx.pharmacyInventoryBatch.update({
        where: { id: batch.id },
        data: { availableQty: newBalance, status: 'ACTIVE' },
      });
    } else {
      if (batch.availableQty < item.quantity) {
        throw new Error(`Insufficient stock for ${item.medicineName} batch ${item.batchNumber}`);
      }
      qtyOut = item.quantity;
      newBalance = batch.availableQty - item.quantity;
      await tx.pharmacyInventoryBatch.update({
        where: { id: batch.id },
        data: {
          availableQty: newBalance,
          status: newBalance <= 0 ? 'DEPLETED' : 'ACTIVE',
        },
      });
    }

    await tx.pharmacyStockTransaction.create({
      data: {
        medicineId: item.medicineId,
        batchId: batch.id,
        type: txType,
        qtyIn,
        qtyOut,
        balance: newBalance,
        referenceType: 'PHARMACY_RETURN',
        referenceId: returnRecord.id,
        notes: `${returnRecord.returnNumber} — ${item.medicineName} batch ${item.batchNumber}`,
      },
    });
  }
}

function buildListWhere({ q, returnType, dateFrom, dateTo, status, tab } = {}) {
  const where = {};
  if (returnType) where.returnType = returnType;
  if (status) where.status = status;

  if (tab === 'customer') where.returnType = 'CUSTOMER_RETURN';
  if (tab === 'vendor') where.returnType = { in: ['VENDOR_RETURN', 'DAMAGED_RETURN'] };
  if (tab === 'expired') where.returnType = 'EXPIRED_RETURN';
  if (tab === 'history') {
    /* all types */
  }

  if (q) {
    const term = String(q).trim();
    where.OR = [
      { returnNumber: { contains: term, mode: 'insensitive' } },
      { referenceNumber: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
      { supplierName: { contains: term, mode: 'insensitive' } },
      { items: { some: { medicineName: { contains: term, mode: 'insensitive' } } } },
      { bill: { billNumber: { contains: term, mode: 'insensitive' } } },
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

  return where;
}

module.exports = {
  PRISMA_TX,
  isUuid,
  roundMoney,
  toNum,
  generateReturnNumber,
  getReturnedQtyMap,
  mapReturnRow,
  mapReturnItem,
  applyReturnStock,
  buildListWhere,
  returnTypeLabel,
  statusLabel,
  refundTypeLabel,
};
