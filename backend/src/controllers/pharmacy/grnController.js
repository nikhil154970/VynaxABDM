const { prisma } = require('../../config/prisma');
const { GRN_STATUSES, PO_FOR_GRN, ALLOWED_GST } = require('../../lib/pharmacy/constants');
const {
  normalizeString,
  parseNumber,
  parseDate,
  isUuid,
  mapGrn,
  grnInclude,
  poInclude,
} = require('../../lib/pharmacy/helpers');

/** Remote Postgres (Render) needs a longer interactive tx than Prisma's 5s default. */
const PRISMA_TX = { maxWait: 15_000, timeout: 30_000 };

function calcLineAmount(receivedQty, purchasePrice, gstPercentage) {
  const qty = Math.max(0, receivedQty);
  const price = Math.max(0, purchasePrice);
  const gst = Math.max(0, gstPercentage);
  const lineBase = qty * price;
  const lineGst = lineBase * (gst / 100);
  return {
    lineBase,
    lineGst,
    amount: Math.round((lineBase + lineGst) * 100) / 100,
  };
}

function calcGrnTotals(items) {
  let subTotal = 0;
  let gstAmount = 0;
  items.forEach((item) => {
    const { lineBase, lineGst } = calcLineAmount(item.receivedQty, item.purchasePrice, item.gstPercentage);
    subTotal += lineBase;
    gstAmount += lineGst;
  });
  return {
    subTotal: Math.round(subTotal * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    grandTotal: Math.round((subTotal + gstAmount) * 100) / 100,
  };
}

async function generateGrnNumber() {
  const last = await prisma.pharmacyGrn.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { grnNumber: true },
  });
  let next = 1;
  if (last?.grnNumber) {
    const match = String(last.grnNumber).match(/GRN-(\d+)/i);
    if (match) next = parseInt(match[1], 10) + 1;
  }
  return `GRN-${String(next).padStart(4, '0')}`;
}

async function getReceivedQtyByPo(poId, excludeGrnId = null) {
  const completed = await prisma.pharmacyGrn.findMany({
    where: {
      purchaseOrderId: poId,
      status: 'Completed',
      ...(excludeGrnId ? { NOT: { id: excludeGrnId } } : {}),
    },
    include: { items: true },
  });
  const map = new Map();
  completed.forEach((grn) => {
    (grn.items || []).forEach((item) => {
      const key = item.medicineId;
      const stockQty = (item.receivedQty || 0) + (item.freeQty || 0);
      map.set(key, (map.get(key) || 0) + stockQty);
    });
  });
  return map;
}

function computeReceiptStatus(poItems, receivedMap, currentGrnItems) {
  const currentByMed = new Map();
  currentGrnItems.forEach((item) => {
    const key = item.medicineId;
    const stockQty = (item.receivedQty || 0) + (item.freeQty || 0);
    currentByMed.set(key, (currentByMed.get(key) || 0) + stockQty);
  });

  let allFull = true;
  let anyReceived = false;

  poItems.forEach((poItem) => {
    const key = poItem.medicineId;
    const ordered = poItem.quantity || 0;
    const prev = receivedMap.get(key) || 0;
    const current = currentByMed.get(key) || 0;
    const total = prev + current;
    if (total > 0) anyReceived = true;
    if (total < ordered) allFull = false;
  });

  if (!anyReceived) return 'Partial';
  return allFull ? 'Full' : 'Partial';
}

async function updatePoDeliveryStatus(poId) {
  const po = await prisma.pharmacyPurchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true },
  });
  if (!po || po.status === 'Cancelled') return;

  const receivedMap = await getReceivedQtyByPo(poId);
  let allFull = true;
  let anyReceived = false;

  (po.items || []).forEach((item) => {
    const key = item.medicineId;
    const ordered = item.quantity || 0;
    const received = receivedMap.get(key) || 0;
    if (received > 0) anyReceived = true;
    if (received < ordered) allFull = false;
  });

  let nextStatus = po.status;
  if (anyReceived && allFull) nextStatus = 'Delivered';
  else if (anyReceived) nextStatus = 'Partially Delivered';
  else if (['Partially Delivered', 'Delivered'].includes(po.status)) nextStatus = 'Approved';

  if (nextStatus !== po.status) {
    await prisma.pharmacyPurchaseOrder.update({
      where: { id: poId },
      data: { status: nextStatus },
    });
  }
}

async function resolveGrnItems(rawItems, po) {
  const errors = [];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { errors: [{ field: 'items', message: 'At least one medicine line is required' }] };
  }

  const poQtyMap = new Map((po.items || []).map((i) => [i.medicineId, i.quantity]));

  const resolved = [];
  for (let i = 0; i < rawItems.length; i += 1) {
    const row = rawItems[i] || {};
    const medicineId = normalizeString(row.medicineId);
    const batchNumber = normalizeString(row.batchNumber);
    const expiryDate = parseDate(row.expiryDate);
    const orderedQty = parseNumber(row.orderedQty, NaN);
    const receivedQty = parseNumber(row.receivedQty, NaN);
    const freeQty = parseNumber(row.freeQty, 0);
    const purchasePrice = parseNumber(row.purchasePrice, NaN);
    const sellingPrice = parseNumber(row.sellingPrice, NaN);
    const mrp = parseNumber(row.mrp, NaN);
    const gstPercentage = parseNumber(row.gstPercentage, NaN);

    if (!medicineId || !isUuid(medicineId)) {
      errors.push({ field: `items[${i}].medicineId`, message: 'Valid medicine is required' });
      continue;
    }
    if (!batchNumber) {
      errors.push({ field: `items[${i}].batchNumber`, message: 'Batch number is required' });
      continue;
    }
    if (!expiryDate) {
      errors.push({ field: `items[${i}].expiryDate`, message: 'Expiry date is required' });
      continue;
    }
    if (!Number.isFinite(receivedQty) || receivedQty < 0) {
      errors.push({ field: `items[${i}].receivedQty`, message: 'Received qty is required' });
      continue;
    }
    if (receivedQty === 0 && freeQty === 0) {
      errors.push({ field: `items[${i}].receivedQty`, message: 'Enter received or free quantity' });
      continue;
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      errors.push({ field: `items[${i}].purchasePrice`, message: 'Purchase price is required' });
      continue;
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      errors.push({ field: `items[${i}].sellingPrice`, message: 'Selling price is required' });
      continue;
    }
    if (!Number.isFinite(mrp) || mrp < 0) {
      errors.push({ field: `items[${i}].mrp`, message: 'MRP is required' });
      continue;
    }
    if (!Number.isFinite(gstPercentage) || !ALLOWED_GST.includes(gstPercentage)) {
      errors.push({ field: `items[${i}].gstPercentage`, message: 'GST must be 0, 5, 12, 18, or 28' });
      continue;
    }

    const medicine = await prisma.pharmacyMedicine.findUnique({ where: { id: medicineId } });
    if (!medicine) {
      errors.push({ field: `items[${i}].medicineId`, message: 'Medicine not found' });
      continue;
    }

    const poOrdered = poQtyMap.get(medicineId) ?? orderedQty;
    const medicineName = normalizeString(row.medicineName) || medicine.medicineName;
    const { amount } = calcLineAmount(receivedQty, purchasePrice, gstPercentage);

    resolved.push({
      medicineId,
      medicineName,
      orderedQty: Number.isFinite(orderedQty) ? orderedQty : poOrdered,
      receivedQty,
      freeQty: Math.max(0, freeQty),
      batchNumber,
      expiryDate,
      purchasePrice,
      sellingPrice,
      mrp,
      gstPercentage,
      amount,
    });
  }

  if (errors.length) return { errors };
  if (!resolved.length) {
    return { errors: [{ field: 'items', message: 'At least one valid line is required' }] };
  }
  return { items: resolved };
}

async function validateGrnPayload(body, { isUpdate = false, existingGrn = null } = {}) {
  const errors = [];
  const purchaseOrderId =
    body.purchaseOrderId !== undefined ? normalizeString(body.purchaseOrderId) : undefined;

  if (!isUpdate && !purchaseOrderId) {
    errors.push({ field: 'purchaseOrderId', message: 'Purchase order is required' });
  }
  if (purchaseOrderId && !isUuid(purchaseOrderId)) {
    errors.push({ field: 'purchaseOrderId', message: 'Invalid purchase order' });
  }
  if (existingGrn && existingGrn.status !== 'Draft') {
    errors.push({ field: 'status', message: 'Only draft GRN can be edited' });
  }

  if (errors.length) return { errors };

  const poId = purchaseOrderId || existingGrn.purchaseOrderId;
  const po = await prisma.pharmacyPurchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true, supplier: true },
  });
  if (!po) return { errors: [{ field: 'purchaseOrderId', message: 'Purchase order not found' }] };
  if (!PO_FOR_GRN.includes(po.status)) {
    return {
      errors: [
        {
          field: 'purchaseOrderId',
          message: 'PO must be Approved or Partially Delivered to create GRN',
        },
      ],
    };
  }

  let items;
  if (!isUpdate || body.items !== undefined) {
    const itemResult = await resolveGrnItems(body.items, po);
    if (itemResult.errors) return itemResult;
    items = itemResult.items;
  }

  const receivedDate = body.receivedDate !== undefined ? parseDate(body.receivedDate) : undefined;
  if (body.receivedDate !== undefined && !receivedDate) {
    return { errors: [{ field: 'receivedDate', message: 'Valid received date is required' }] };
  }

  const totals = items ? calcGrnTotals(items) : null;
  const receivedMap = await getReceivedQtyByPo(po.id, existingGrn?.id);
  const receiptStatus = items ? computeReceiptStatus(po.items, receivedMap, items) : undefined;

  const supplier = po.supplier;

  return {
    po,
    supplier,
    data: {
      ...(purchaseOrderId
        ? {
            purchaseOrderId: po.id,
            poNumber: po.poNumber,
            supplierId: supplier.id,
            supplierName: supplier.supplierName || po.supplierName,
          }
        : {}),
      ...(items ? { items, ...totals, receiptStatus } : {}),
      ...(body.invoiceNumber !== undefined ? { invoiceNumber: normalizeString(body.invoiceNumber) || null } : {}),
      ...(body.invoiceDate !== undefined ? { invoiceDate: parseDate(body.invoiceDate) } : {}),
      ...(receivedDate ? { receivedDate } : {}),
      ...(body.remarks !== undefined ? { remarks: normalizeString(body.remarks) || null } : {}),
    },
  };
}

function buildListWhere(query) {
  const where = {};
  const status = normalizeString(query.status);
  if (status && status !== 'all' && GRN_STATUSES.includes(status)) where.status = status;

  const search = normalizeString(query.search || query.q);
  if (search) {
    where.OR = [
      { grnNumber: { contains: search, mode: 'insensitive' } },
      { poNumber: { contains: search, mode: 'insensitive' } },
      { supplierName: { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const dateFrom = normalizeString(query.dateFrom);
  const dateTo = normalizeString(query.dateTo);
  if (dateFrom || dateTo) {
    where.receivedDate = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) where.receivedDate.gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        where.receivedDate.lte = d;
      }
    }
    if (!Object.keys(where.receivedDate).length) delete where.receivedDate;
  }

  return where;
}

async function buildStats(where = {}) {
  const [totalGrn, pendingGrn, completedGrn, valueAgg] = await Promise.all([
    prisma.pharmacyGrn.count({ where }),
    prisma.pharmacyGrn.count({ where: { ...where, status: 'Draft' } }),
    prisma.pharmacyGrn.count({ where: { ...where, status: 'Completed' } }),
    prisma.pharmacyGrn.aggregate({
      where: { ...where, status: 'Completed' },
      _sum: { grandTotal: true },
    }),
  ]);
  return {
    totalGrn,
    pendingGrn,
    completedGrn,
    inventoryAddedValue: Number(valueAgg._sum.grandTotal ?? 0),
  };
}

async function fetchGrn(id) {
  return prisma.pharmacyGrn.findUnique({ where: { id }, include: grnInclude });
}

function itemCreateRows(items) {
  return items.map((item) => ({
    medicineId: item.medicineId,
    medicineName: item.medicineName,
    orderedQty: item.orderedQty,
    receivedQty: item.receivedQty,
    freeQty: item.freeQty,
    batchNumber: item.batchNumber,
    expiryDate: item.expiryDate,
    purchasePrice: item.purchasePrice,
    sellingPrice: item.sellingPrice,
    mrp: item.mrp,
    gstPercentage: item.gstPercentage,
    amount: item.amount,
  }));
}

async function createGrnRecord(grnNumber, data, createdBy) {
  const { items, subTotal, gstAmount, grandTotal, receiptStatus, receivedDate, ...header } = data;
  return prisma.pharmacyGrn.create({
    data: {
      grnNumber,
      ...header,
      receivedDate: receivedDate || new Date(),
      subTotal,
      gstAmount,
      grandTotal,
      receiptStatus: receiptStatus || 'Partial',
      status: 'Draft',
      createdBy,
      items: { create: itemCreateRows(items) },
    },
    include: grnInclude,
  });
}

async function replaceGrnItems(grnId, items, totals, receiptStatus) {
  await prisma.pharmacyGrnItem.deleteMany({ where: { grnId } });
  return prisma.pharmacyGrn.update({
    where: { id: grnId },
    data: {
      subTotal: totals.subTotal,
      gstAmount: totals.gstAmount,
      grandTotal: totals.grandTotal,
      receiptStatus: receiptStatus || 'Partial',
      items: { create: itemCreateRows(items) },
    },
    include: grnInclude,
  });
}

const getPurchaseOrdersForGrn = async (req, res) => {
  try {
    const orders = await prisma.pharmacyPurchaseOrder.findMany({
      where: { status: { in: PO_FOR_GRN } },
      orderBy: { updatedAt: 'desc' },
      include: poInclude,
    });

    return res.json({
      purchaseOrders: orders.map((o) => ({
        id: o.id,
        poNumber: o.poNumber,
        supplierId: o.supplierId,
        supplierName: o.supplierName,
        status: o.status,
        grandTotal: Number(o.grandTotal),
        items: (o.items || []).map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          orderedQty: item.quantity,
          purchasePrice: Number(item.purchasePrice),
          gstPercentage: item.gstPercentage,
        })),
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    console.error('[pharmacy/grn] purchase-orders', err);
    return res.status(500).json({ message: 'Failed to fetch purchase orders for GRN' });
  }
};

const createGrn = async (req, res) => {
  try {
    const validation = await validateGrnPayload(req.body);
    if (validation.errors) {
      return res.status(400).json({ message: 'Validation error', errors: validation.errors });
    }

    const grnNumber = await generateGrnNumber();
    const grn = await createGrnRecord(grnNumber, validation.data, req.user?.userId || null);

    return res.status(201).json({ message: 'GRN created', grn: mapGrn(grn) });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'GRN number conflict, please retry' });
    }
    console.error('[pharmacy/grn] create', err);
    return res.status(500).json({ message: 'Failed to create GRN' });
  }
};

const getGrns = async (req, res) => {
  try {
    const where = buildListWhere(req.query);
    const grns = await prisma.pharmacyGrn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: grnInclude,
    });

    const stats = await buildStats(where.status ? { status: where.status } : {});

    return res.json({
      grns: grns.map(mapGrn),
      stats,
    });
  } catch (err) {
    console.error('[pharmacy/grn] list', err);
    return res.status(500).json({ message: 'Failed to fetch GRN list' });
  }
};

const getGrnById = async (req, res) => {
  try {
    const grn = await fetchGrn(req.params.id);
    if (!grn) return res.status(404).json({ message: 'GRN not found' });
    return res.json({ grn: mapGrn(grn) });
  } catch (err) {
    console.error('[pharmacy/grn] get', err);
    return res.status(500).json({ message: 'Failed to fetch GRN' });
  }
};

const updateGrn = async (req, res) => {
  try {
    const grn = await prisma.pharmacyGrn.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!grn) return res.status(404).json({ message: 'GRN not found' });
    if (grn.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft GRN can be updated' });
    }

    const validation = await validateGrnPayload(req.body, { isUpdate: true, existingGrn: grn });
    if (validation.errors) {
      return res.status(400).json({ message: 'Validation error', errors: validation.errors });
    }

    const { items, subTotal, gstAmount, grandTotal, receiptStatus, ...header } = validation.data;

    let updated;
    if (items) {
      await prisma.pharmacyGrn.update({ where: { id: grn.id }, data: header });
      updated = await replaceGrnItems(grn.id, items, { subTotal, gstAmount, grandTotal }, receiptStatus);
    } else {
      updated = await prisma.pharmacyGrn.update({
        where: { id: grn.id },
        data: header,
        include: grnInclude,
      });
    }

    return res.json({ message: 'GRN updated', grn: mapGrn(updated) });
  } catch (err) {
    console.error('[pharmacy/grn] update', err);
    return res.status(500).json({ message: 'Failed to update GRN' });
  }
};

async function applyInventoryFromGrn(tx, grn) {
  for (const item of grn.items) {
    const stockQty = (item.receivedQty || 0) + (item.freeQty || 0);
    if (stockQty <= 0) continue;

    // Nested create = one round-trip per line (avoids tx timeout on remote Postgres).
    await tx.pharmacyInventoryBatch.create({
      data: {
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        mrp: item.mrp,
        qty: stockQty,
        availableQty: stockQty,
        gstPercentage: item.gstPercentage,
        supplierId: grn.supplierId,
        grnId: grn.id,
        status: 'ACTIVE',
        stockTransactions: {
          create: {
            medicineId: item.medicineId,
            type: 'GRN_IN',
            qtyIn: stockQty,
            qtyOut: 0,
            balance: stockQty,
            referenceType: 'GRN',
            referenceId: grn.id,
            notes: `GRN ${grn.grnNumber} batch ${item.batchNumber}`,
          },
        },
      },
    });
  }
}

const completeGrn = async (req, res) => {
  try {
    const grn = await prisma.pharmacyGrn.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!grn) return res.status(404).json({ message: 'GRN not found' });
    if (grn.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft GRN can be completed' });
    }

    const validation = await validateGrnPayload(
      {
        purchaseOrderId: grn.purchaseOrderId,
        items: grn.items.map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          orderedQty: item.orderedQty,
          receivedQty: item.receivedQty,
          freeQty: item.freeQty,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          purchasePrice: Number(item.purchasePrice),
          sellingPrice: Number(item.sellingPrice),
          mrp: Number(item.mrp),
          gstPercentage: item.gstPercentage,
        })),
        receivedDate: grn.receivedDate,
        invoiceNumber: grn.invoiceNumber,
        invoiceDate: grn.invoiceDate,
        remarks: grn.remarks,
      },
      { isUpdate: true, existingGrn: grn }
    );
    if (validation.errors) {
      return res.status(400).json({ message: 'Validation error', errors: validation.errors });
    }

    await prisma.$transaction(
      async (tx) => {
        const completed = await tx.pharmacyGrn.update({
          where: { id: grn.id },
          data: {
            status: 'Completed',
            receiptStatus: validation.data.receiptStatus || grn.receiptStatus,
          },
          include: { items: true },
        });
        await applyInventoryFromGrn(tx, completed);
      },
      PRISMA_TX
    );

    await updatePoDeliveryStatus(grn.purchaseOrderId);

    const populated = await fetchGrn(grn.id);
    return res.json({
      message: 'GRN completed and inventory updated',
      grn: mapGrn(populated),
    });
  } catch (err) {
    console.error('[pharmacy/grn] complete', err);
    return res.status(500).json({
      message: err?.message || 'Failed to complete GRN',
    });
  }
};

const cancelGrn = async (req, res) => {
  try {
    const grn = await prisma.pharmacyGrn.findUnique({ where: { id: req.params.id } });
    if (!grn) return res.status(404).json({ message: 'GRN not found' });
    if (grn.status === 'Cancelled') {
      return res.status(400).json({ message: 'GRN is already cancelled' });
    }
    if (grn.status === 'Completed') {
      return res.status(400).json({ message: 'Completed GRN cannot be cancelled' });
    }

    const updated = await prisma.pharmacyGrn.update({
      where: { id: grn.id },
      data: { status: 'Cancelled' },
      include: grnInclude,
    });

    return res.json({ message: 'GRN cancelled', grn: mapGrn(updated) });
  } catch (err) {
    console.error('[pharmacy/grn] cancel', err);
    return res.status(500).json({ message: 'Failed to cancel GRN' });
  }
};

function formatPoDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function buildPrintPayload(grn) {
  const supplier = grn.supplier;
  return {
    hospital: {
      nameEn: 'NEW H T HOSPITAL',
      nameHi: 'नैतिक हॉस्पिटल एण्ड सर्जिकल सेन्टर',
      address: 'ANAND BIHAR COLONY, BHIKHARIPUR BLW, VARANASI, U.P - 221004',
      phone: '+91 91409 78130',
      email: 'naitikhospital@gmail.com',
    },
    grnNumber: grn.grnNumber,
    poNumber: grn.poNumber,
    status: grn.status,
    receiptStatus: grn.receiptStatus,
    invoiceNumber: grn.invoiceNumber || '—',
    invoiceDate: formatPoDate(grn.invoiceDate),
    receivedDate: formatPoDate(grn.receivedDate),
    totalItems: (grn.items || []).length,
    supplier: {
      supplierName: grn.supplierName,
      address: supplier
        ? [supplier.address, supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(', ')
        : '',
      phone: supplier?.phone || '',
      gstNumber: supplier?.gstNumber || '',
    },
    items: (grn.items || []).map((item, idx) => ({
      sno: idx + 1,
      medicineName: item.medicineName,
      batchNumber: item.batchNumber,
      expiryDate: formatPoDate(item.expiryDate),
      orderedQty: item.orderedQty,
      receivedQty: item.receivedQty,
      freeQty: item.freeQty || 0,
      purchasePrice: Number(item.purchasePrice),
      sellingPrice: Number(item.sellingPrice),
      mrp: Number(item.mrp),
      gstPercentage: item.gstPercentage,
      amount: Number(item.amount),
    })),
    subTotal: Number(grn.subTotal),
    gstAmount: Number(grn.gstAmount),
    grandTotal: Number(grn.grandTotal),
    remarks: grn.remarks || '',
    preparedBy: grn.createdBy || 'Pharmacist',
  };
}

const getGrnPrint = async (req, res) => {
  try {
    const grn = await fetchGrn(req.params.id);
    if (!grn) return res.status(404).json({ message: 'GRN not found' });
    const printData = await buildPrintPayload(grn);
    return res.json({ printData });
  } catch (err) {
    console.error('[pharmacy/grn] print', err);
    return res.status(500).json({ message: 'Failed to load GRN for print' });
  }
};

module.exports = {
  getPurchaseOrdersForGrn,
  createGrn,
  getGrns,
  getGrnById,
  updateGrn,
  completeGrn,
  cancelGrn,
  getGrnPrint,
};
