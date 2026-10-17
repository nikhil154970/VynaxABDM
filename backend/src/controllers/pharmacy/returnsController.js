const { prisma } = require('../../config/prisma');
const {
  PRISMA_TX,
  isUuid,
  roundMoney,
  toNum,
  generateReturnNumber,
  getReturnedQtyMap,
  mapReturnRow,
  applyReturnStock,
  buildListWhere,
} = require('../../lib/pharmacy/returnsHelpers');

const RETURN_INCLUDE = {
  items: { orderBy: { id: 'asc' } },
  bill: { select: { billNumber: true } },
  supplier: { select: { supplierName: true } },
  patient: { select: { name: true, uhid: true, mobile: true } },
};

async function fetchUserNames(ids) {
  if (!ids.length) return {};
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return users.reduce((acc, u) => {
    acc[u.id] = u.name;
    return acc;
  }, {});
}

const getSummary = async (req, res) => {
  try {
    const [total, customer, vendor, expired, valueAgg] = await Promise.all([
      prisma.pharmacyReturn.count({ where: { NOT: { status: 'CANCELLED' } } }),
      prisma.pharmacyReturn.count({ where: { returnType: 'CUSTOMER_RETURN', NOT: { status: 'CANCELLED' } } }),
      prisma.pharmacyReturn.count({
        where: { returnType: { in: ['VENDOR_RETURN', 'DAMAGED_RETURN'] }, NOT: { status: 'CANCELLED' } },
      }),
      prisma.pharmacyReturn.count({ where: { returnType: 'EXPIRED_RETURN', NOT: { status: 'CANCELLED' } } }),
      prisma.pharmacyReturn.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
    ]);

    return res.json({
      summary: {
        totalReturns: total,
        customerReturns: customer,
        vendorReturns: vendor,
        expiredReturns: expired,
        returnValue: roundMoney(Number(valueAgg._sum.totalAmount || 0)),
      },
    });
  } catch (err) {
    console.error('[pharmacy/returns] summary', err);
    return res.status(500).json({ message: 'Failed to fetch returns summary' });
  }
};

const listReturns = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const where = buildListWhere({
      q: req.query.q,
      returnType: req.query.returnType,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      tab: req.query.tab,
    });

    const rows = await prisma.pharmacyReturn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { ...RETURN_INCLUDE, _count: { select: { items: true } } },
    });

    const userIds = [...new Set(rows.flatMap((r) => [r.createdBy, r.approvedBy].filter(Boolean)))];
    const userMap = await fetchUserNames(userIds);

    const mapped = rows.map((r) => mapReturnRow(r, userMap));
    const total = mapped.length;
    const items = mapped.slice((page - 1) * limit, page * limit);

    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error('[pharmacy/returns] list', err);
    return res.status(500).json({ message: 'Failed to fetch returns' });
  }
};

const getReturnById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid return id' });

    const row = await prisma.pharmacyReturn.findUnique({
      where: { id },
      include: RETURN_INCLUDE,
    });
    if (!row) return res.status(404).json({ message: 'Return not found' });

    const userMap = await fetchUserNames([row.createdBy, row.approvedBy].filter(Boolean));
    return res.json({ return: mapReturnRow(row, userMap) });
  } catch (err) {
    console.error('[pharmacy/returns] get', err);
    return res.status(500).json({ message: 'Failed to fetch return' });
  }
};

const searchBills = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ bills: [] });

    const bills = await prisma.pharmacyBill.findMany({
      where: {
        status: { in: ['PAID', 'PARTIALLY_PAID', 'PENDING_PAYMENT'] },
        OR: [
          { billNumber: { contains: q, mode: 'insensitive' } },
          { patientName: { contains: q, mode: 'insensitive' } },
          { patientUhid: { contains: q, mode: 'insensitive' } },
          { customerName: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { items: { orderBy: { id: 'asc' } } },
    });

    const billItemIds = bills.flatMap((b) => b.items.map((i) => i.id));
    const returnedMap = await getReturnedQtyMap(prisma, billItemIds);

    const result = bills.map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      patientName: b.patientName || b.customerName || '—',
      patientUhid: b.patientUhid || '—',
      grandTotal: toNum(b.grandTotal),
      createdAt: b.createdAt,
      items: b.items.map((item) => {
        const returned = returnedMap.get(item.id) || 0;
        const sold = item.quantity;
        return {
          id: item.id,
          medicineId: item.medicineId,
          inventoryBatchId: item.inventoryBatchId,
          medicineName: item.medicineName,
          batchNumber: item.batchNumber,
          quantitySold: sold,
          quantityReturned: returned,
          maxReturnQty: Math.max(0, sold - returned),
          sellingPrice: toNum(item.sellingPrice),
          mrp: toNum(item.mrp),
        };
      }),
    }));

    return res.json({ bills: result });
  } catch (err) {
    console.error('[pharmacy/returns] search-bills', err);
    return res.status(500).json({ message: 'Failed to search bills' });
  }
};

const getExpiredBatches = async (req, res) => {
  try {
    const now = new Date();
    const batches = await prisma.pharmacyInventoryBatch.findMany({
      where: {
        availableQty: { gt: 0 },
        OR: [{ expiryDate: { lt: now } }, { status: 'EXPIRED' }],
      },
      orderBy: { expiryDate: 'asc' },
      include: { supplier: { select: { supplierName: true } } },
      take: 50,
    });

    return res.json({
      batches: batches.map((b) => ({
        id: b.id,
        medicineId: b.medicineId,
        medicineName: b.medicineName,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        availableQty: b.availableQty,
        purchasePrice: toNum(b.purchasePrice),
        purchaseValue: roundMoney(b.availableQty * toNum(b.purchasePrice)),
        supplierName: b.supplier?.supplierName || '—',
        supplierId: b.supplierId,
      })),
    });
  } catch (err) {
    console.error('[pharmacy/returns] expired-batches', err);
    return res.status(500).json({ message: 'Failed to fetch expired batches' });
  }
};

const getSupplierBatches = async (req, res) => {
  try {
    const supplierId = req.query.supplierId;
    if (!isUuid(supplierId)) return res.status(400).json({ message: 'Valid supplier id required' });

    const batches = await prisma.pharmacyInventoryBatch.findMany({
      where: { supplierId, availableQty: { gt: 0 }, status: 'ACTIVE' },
      orderBy: [{ expiryDate: 'asc' }, { medicineName: 'asc' }],
      take: 100,
    });

    return res.json({
      batches: batches.map((b) => ({
        id: b.id,
        medicineId: b.medicineId,
        medicineName: b.medicineName,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        availableQty: b.availableQty,
        purchasePrice: toNum(b.purchasePrice),
        sellingPrice: toNum(b.sellingPrice),
      })),
    });
  } catch (err) {
    console.error('[pharmacy/returns] supplier-batches', err);
    return res.status(500).json({ message: 'Failed to fetch batches' });
  }
};

async function createReturnRecord(data, items, userId) {
  const returnNumber = await generateReturnNumber(prisma);
  const totalAmount = roundMoney(items.reduce((s, i) => s + i.amount, 0));

  return prisma.pharmacyReturn.create({
    data: {
      returnNumber,
      returnType: data.returnType,
      status: 'PENDING',
      billId: data.billId || null,
      supplierId: data.supplierId || null,
      patientId: data.patientId || null,
      referenceNumber: data.referenceNumber || null,
      patientName: data.patientName || null,
      supplierName: data.supplierName || null,
      refundType: data.refundType || null,
      totalAmount,
      remarks: data.remarks || null,
      createdBy: userId || null,
      items: { create: items },
    },
    include: RETURN_INCLUDE,
  });
}

const createCustomerReturn = async (req, res) => {
  try {
    const body = req.body || {};
    const billId = body.billId;
    if (!isUuid(billId)) return res.status(400).json({ message: 'Valid bill id required' });

    const bill = await prisma.pharmacyBill.findUnique({
      where: { id: billId },
      include: { items: true },
    });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (['DRAFT', 'CANCELLED'].includes(bill.status)) {
      return res.status(400).json({ message: 'Bill is not eligible for return' });
    }

    const lineItems = Array.isArray(body.items) ? body.items : [];
    if (!lineItems.length) return res.status(400).json({ message: 'At least one return item required' });

    const returnedMap = await getReturnedQtyMap(
      prisma,
      bill.items.map((i) => i.id)
    );

    const resolvedItems = [];
    for (const line of lineItems) {
      const billItem = bill.items.find((i) => i.id === line.billItemId);
      if (!billItem) return res.status(400).json({ message: 'Invalid bill item' });

      const returnQty = Math.max(0, parseInt(line.returnQty ?? line.quantity, 10) || 0);
      if (returnQty <= 0) return res.status(400).json({ message: 'Return quantity must be greater than zero' });

      const alreadyReturned = returnedMap.get(billItem.id) || 0;
      const maxQty = billItem.quantity - alreadyReturned;
      if (returnQty > maxQty) {
        return res.status(400).json({
          message: `Return qty exceeds sold qty for ${billItem.medicineName}. Max: ${maxQty}`,
        });
      }

      const sellingPrice = toNum(billItem.sellingPrice);
      const unitPaidAmount = toNum(billItem.amount) / billItem.quantity;
      resolvedItems.push({
        medicineId: billItem.medicineId,
        inventoryBatchId: billItem.inventoryBatchId,
        billItemId: billItem.id,
        medicineName: billItem.medicineName,
        batchNumber: billItem.batchNumber,
        quantity: returnQty,
        purchasePrice: toNum(billItem.mrp),
        sellingPrice,
        amount: roundMoney(returnQty * unitPaidAmount),
        reason: String(line.reason || body.reason || '').trim() || null,
      });
    }

    const refundRaw = String(body.refundType || 'CASH').toUpperCase();
    const refundTypes = ['CASH', 'UPI', 'STORE_CREDIT', 'NO_REFUND'];
    const refundType = refundTypes.includes(refundRaw) ? refundRaw : 'CASH';

    const userId = req.user?.userId || null;
    const returnMeta = {
      returnType: 'CUSTOMER_RETURN',
      billId: bill.id,
      patientId: bill.patientId,
      referenceNumber: bill.billNumber,
      patientName: bill.patientName || bill.customerName,
      refundType,
      remarks: body.remarks || null,
    };

    const completed = await prisma.$transaction(
      async (tx) => {
        const returnNumber = await generateReturnNumber(tx);
        const totalAmount = roundMoney(resolvedItems.reduce((s, i) => s + i.amount, 0));

        const created = await tx.pharmacyReturn.create({
          data: {
            returnNumber,
            returnType: returnMeta.returnType,
            status: 'PENDING',
            billId: returnMeta.billId,
            patientId: returnMeta.patientId,
            referenceNumber: returnMeta.referenceNumber,
            patientName: returnMeta.patientName,
            refundType: returnMeta.refundType,
            totalAmount,
            remarks: returnMeta.remarks,
            createdBy: userId,
            items: { create: resolvedItems },
          },
          include: { items: true },
        });

        await applyReturnStock(tx, created);

        return tx.pharmacyReturn.update({
          where: { id: created.id },
          data: {
            status: 'COMPLETED',
            approvedBy: userId,
            approvedAt: new Date(),
          },
          include: RETURN_INCLUDE,
        });
      },
      PRISMA_TX
    );

    const userMap = await fetchUserNames([completed.createdBy, completed.approvedBy].filter(Boolean));
    return res.status(201).json({
      message: 'Customer return completed — inventory updated',
      return: mapReturnRow(completed, userMap),
    });
  } catch (err) {
    console.error('[pharmacy/returns] customer', err);
    return res.status(500).json({ message: err?.message || 'Failed to create customer return' });
  }
};

const createVendorReturn = async (req, res) => {
  try {
    const body = req.body || {};
    const supplierId = body.supplierId;
    if (!isUuid(supplierId)) return res.status(400).json({ message: 'Valid supplier id required' });

    const supplier = await prisma.pharmacySupplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

    const lineItems = Array.isArray(body.items) ? body.items : [];
    if (!lineItems.length) return res.status(400).json({ message: 'At least one return item required' });

    const returnTypeRaw = String(body.returnType || 'VENDOR_RETURN').toUpperCase();
    const returnType = returnTypeRaw === 'DAMAGED_RETURN' ? 'DAMAGED_RETURN' : 'VENDOR_RETURN';

    const resolvedItems = [];
    for (const line of lineItems) {
      const batchId = line.inventoryBatchId;
      if (!isUuid(batchId)) return res.status(400).json({ message: 'Valid batch id required' });

      const batch = await prisma.pharmacyInventoryBatch.findUnique({ where: { id: batchId } });
      if (!batch) return res.status(404).json({ message: 'Batch not found' });
      if (batch.supplierId !== supplierId) {
        return res.status(400).json({ message: 'Batch does not belong to selected supplier' });
      }

      const returnQty = Math.max(0, parseInt(line.returnQty ?? line.quantity, 10) || 0);
      if (returnQty <= 0) return res.status(400).json({ message: 'Return quantity must be greater than zero' });
      if (returnQty > batch.availableQty) {
        return res.status(400).json({ message: `Insufficient stock in batch ${batch.batchNumber}` });
      }

      const purchasePrice = toNum(batch.purchasePrice);
      const gst = Number(batch.gstPercentage) || 0;
      const amount = returnQty * purchasePrice * (1 + gst / 100);
      resolvedItems.push({
        medicineId: batch.medicineId,
        inventoryBatchId: batch.id,
        billItemId: null,
        medicineName: batch.medicineName,
        batchNumber: batch.batchNumber,
        quantity: returnQty,
        purchasePrice,
        sellingPrice: toNum(batch.sellingPrice),
        amount: roundMoney(amount),
        reason: String(line.reason || body.reason || '').trim() || null,
      });
    }

    const created = await createReturnRecord(
      {
        returnType,
        supplierId: supplier.id,
        referenceNumber: supplier.supplierName,
        supplierName: supplier.supplierName,
        remarks: body.remarks || null,
      },
      resolvedItems,
      req.user?.userId
    );

    const userMap = await fetchUserNames([created.createdBy].filter(Boolean));
    return res.status(201).json({
      message: 'Vendor return created — pending approval',
      return: mapReturnRow(created, userMap),
    });
  } catch (err) {
    console.error('[pharmacy/returns] vendor', err);
    return res.status(500).json({ message: err?.message || 'Failed to create vendor return' });
  }
};

const createExpiredReturn = async (req, res) => {
  try {
    const body = req.body || {};
    const batchIds = Array.isArray(body.batchIds) ? body.batchIds : body.inventoryBatchId ? [body.inventoryBatchId] : [];
    if (!batchIds.length) return res.status(400).json({ message: 'At least one batch required' });

    const resolvedItems = [];
    let supplierId = null;
    let supplierName = null;

    for (const batchId of batchIds) {
      if (!isUuid(batchId)) continue;
      const batch = await prisma.pharmacyInventoryBatch.findUnique({
        where: { id: batchId },
        include: { supplier: { select: { supplierName: true } } },
      });
      if (!batch || batch.availableQty <= 0) continue;

      const now = new Date();
      if (batch.expiryDate >= now && batch.status !== 'EXPIRED') {
        return res.status(400).json({ message: `Batch ${batch.batchNumber} is not expired` });
      }

      supplierId = batch.supplierId;
      supplierName = batch.supplier?.supplierName || null;
      const purchasePrice = toNum(batch.purchasePrice);
      const qty = batch.availableQty;
      const gst = Number(batch.gstPercentage) || 0;
      const amount = qty * purchasePrice * (1 + gst / 100);

      resolvedItems.push({
        medicineId: batch.medicineId,
        inventoryBatchId: batch.id,
        billItemId: null,
        medicineName: batch.medicineName,
        batchNumber: batch.batchNumber,
        quantity: qty,
        purchasePrice,
        sellingPrice: toNum(batch.sellingPrice),
        amount: roundMoney(amount),
        reason: String(body.reason || 'Expired medicine return').trim(),
      });
    }

    if (!resolvedItems.length) return res.status(400).json({ message: 'No valid expired batches' });

    const created = await createReturnRecord(
      {
        returnType: 'EXPIRED_RETURN',
        supplierId,
        referenceNumber: supplierName,
        supplierName,
        remarks: body.remarks || null,
      },
      resolvedItems,
      req.user?.userId
    );

    const userMap = await fetchUserNames([created.createdBy].filter(Boolean));
    return res.status(201).json({
      message: 'Expired return created — pending approval',
      return: mapReturnRow(created, userMap),
    });
  } catch (err) {
    console.error('[pharmacy/returns] expired', err);
    return res.status(500).json({ message: err?.message || 'Failed to create expired return' });
  }
};

const approveReturn = async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid return id' });

    const existing = await prisma.pharmacyReturn.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ message: 'Return not found' });
    if (existing.status === 'COMPLETED') return res.status(400).json({ message: 'Return already completed' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ message: 'Return is cancelled' });

    const updated = await prisma.$transaction(
      async (tx) => {
        await applyReturnStock(tx, existing);
        return tx.pharmacyReturn.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            approvedBy: req.user?.userId || null,
            approvedAt: new Date(),
          },
          include: RETURN_INCLUDE,
        });
      },
      PRISMA_TX
    );

    const userMap = await fetchUserNames([updated.createdBy, updated.approvedBy].filter(Boolean));
    return res.json({
      message: 'Return approved — inventory updated',
      return: mapReturnRow(updated, userMap),
    });
  } catch (err) {
    console.error('[pharmacy/returns] approve', err);
    return res.status(500).json({ message: err?.message || 'Failed to approve return' });
  }
};

const cancelReturn = async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ message: 'Invalid return id' });

    const existing = await prisma.pharmacyReturn.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Return not found' });
    if (existing.status === 'COMPLETED') {
      return res.status(400).json({ message: 'Completed return cannot be cancelled' });
    }
    if (existing.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Return already cancelled' });
    }

    const updated = await prisma.pharmacyReturn.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: RETURN_INCLUDE,
    });

    const userMap = await fetchUserNames([updated.createdBy].filter(Boolean));
    return res.json({
      message: 'Return cancelled',
      return: mapReturnRow(updated, userMap),
    });
  } catch (err) {
    console.error('[pharmacy/returns] cancel', err);
    return res.status(500).json({ message: 'Failed to cancel return' });
  }
};

module.exports = {
  getSummary,
  listReturns,
  getReturnById,
  searchBills,
  getExpiredBatches,
  getSupplierBatches,
  createCustomerReturn,
  createVendorReturn,
  createExpiredReturn,
  approveReturn,
  cancelReturn,
};
