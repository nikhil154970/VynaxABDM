const { prisma } = require('../../config/prisma');
const { PO_STATUSES, ALLOWED_GST } = require('../../lib/pharmacy/constants');
const {
  normalizeString,
  parseNumber,
  isUuid,
  mapPurchaseOrder,
  poInclude,
  toNum,
} = require('../../lib/pharmacy/helpers');

function calcLineTotals(quantity, purchasePrice, gstPercentage) {
  const qty = Math.max(0, quantity);
  const price = Math.max(0, purchasePrice);
  const gst = Math.max(0, gstPercentage);
  const lineBase = qty * price;
  const lineGst = lineBase * (gst / 100);
  return {
    lineBase,
    lineGst,
    amount: lineBase + lineGst,
  };
}

function calcOrderTotals(items) {
  let subTotal = 0;
  let gstAmount = 0;
  items.forEach((item) => {
    const { lineBase, lineGst } = calcLineTotals(item.quantity, item.purchasePrice, item.gstPercentage);
    subTotal += lineBase;
    gstAmount += lineGst;
  });
  return {
    subTotal: Math.round(subTotal * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    grandTotal: Math.round((subTotal + gstAmount) * 100) / 100,
  };
}

async function generatePoNumber() {
  const last = await prisma.pharmacyPurchaseOrder.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { poNumber: true },
  });
  let next = 1;
  if (last?.poNumber) {
    const match = String(last.poNumber).match(/PO-(\d+)/i);
    if (match) next = parseInt(match[1], 10) + 1;
  }
  return `PO-${String(next).padStart(4, '0')}`;
}

async function resolveItems(rawItems) {
  const errors = [];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { errors: [{ field: 'items', message: 'At least one medicine is required' }] };
  }

  const resolved = [];
  for (let i = 0; i < rawItems.length; i += 1) {
    const row = rawItems[i] || {};
    const medicineId = normalizeString(row.medicineId);
    const quantity = parseNumber(row.quantity, NaN);
    const purchasePrice = parseNumber(row.purchasePrice, NaN);
    const gstPercentage = parseNumber(row.gstPercentage, NaN);

    if (!medicineId || !isUuid(medicineId)) {
      errors.push({ field: `items[${i}].medicineId`, message: 'Valid medicine is required' });
      continue;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      errors.push({ field: `items[${i}].quantity`, message: 'Quantity must be at least 1' });
      continue;
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      errors.push({ field: `items[${i}].purchasePrice`, message: 'Purchase price is required' });
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

    const medicineName = normalizeString(row.medicineName) || medicine.medicineName;
    const { amount } = calcLineTotals(quantity, purchasePrice, gstPercentage);

    resolved.push({
      medicineId,
      medicineName,
      quantity,
      purchasePrice,
      gstPercentage,
      amount: Math.round(amount * 100) / 100,
    });
  }

  if (errors.length) return { errors };
  if (!resolved.length) {
    return { errors: [{ field: 'items', message: 'At least one valid medicine is required' }] };
  }
  return { items: resolved };
}

async function validatePayload(body, { isUpdate = false, existingStatus } = {}) {
  const errors = [];
  const supplierId = body.supplierId !== undefined ? normalizeString(body.supplierId) : undefined;
  const remarks = body.remarks !== undefined ? normalizeString(body.remarks) : undefined;
  const submitAs = normalizeString(body.submitAs || body.action).toLowerCase();

  let status;
  if (!isUpdate || body.status !== undefined || body.submitAs !== undefined || body.action !== undefined) {
    if (submitAs === 'submit' || submitAs === 'pending') status = 'Pending';
    else if (submitAs === 'draft') status = 'Draft';
    else if (body.status) {
      const s = normalizeString(body.status);
      if (!PO_STATUSES.includes(s)) {
        errors.push({ field: 'status', message: 'Invalid status' });
      } else status = s;
    } else if (!isUpdate) status = 'Draft';
  }

  if (!isUpdate && !supplierId) {
    errors.push({ field: 'supplierId', message: 'Supplier is required' });
  }
  if (isUpdate && supplierId !== undefined && !supplierId) {
    errors.push({ field: 'supplierId', message: 'Supplier is required' });
  }
  if (supplierId && !isUuid(supplierId)) {
    errors.push({ field: 'supplierId', message: 'Invalid supplier' });
  }

  if (existingStatus && !['Draft', 'Pending'].includes(existingStatus)) {
    errors.push({ field: 'status', message: 'Only draft or pending orders can be edited' });
  }

  if (errors.length) return { errors };

  let supplier = null;
  if (supplierId) {
    supplier = await prisma.pharmacySupplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return { errors: [{ field: 'supplierId', message: 'Supplier not found' }] };
    if (supplier.status === 'INACTIVE') {
      return { errors: [{ field: 'supplierId', message: 'Supplier is inactive' }] };
    }
  }

  let items;
  if (!isUpdate || body.items !== undefined) {
    const itemResult = await resolveItems(body.items);
    if (itemResult.errors) return itemResult;
    items = itemResult.items;
  }

  const totals = items ? calcOrderTotals(items) : null;

  return {
    supplier,
    data: {
      ...(supplier ? { supplierId: supplier.id, supplierName: supplier.supplierName } : {}),
      ...(items
        ? {
            items,
            subTotal: totals.subTotal,
            gstAmount: totals.gstAmount,
            grandTotal: totals.grandTotal,
          }
        : {}),
      ...(remarks !== undefined ? { remarks: remarks || null } : {}),
      ...(status ? { status } : {}),
    },
  };
}

function buildListWhere(query) {
  const where = {};
  const status = normalizeString(query.status);
  if (status && status !== 'all' && PO_STATUSES.includes(status)) {
    where.status = status;
  }

  const search = normalizeString(query.search || query.q);
  if (search) {
    where.OR = [
      { poNumber: { contains: search, mode: 'insensitive' } },
      { supplierName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const dateFrom = normalizeString(query.dateFrom);
  const dateTo = normalizeString(query.dateTo);
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }
    if (!Object.keys(where.createdAt).length) delete where.createdAt;
  }

  return where;
}

async function buildStats(where = {}) {
  const [totalPurchaseOrders, pendingOrders, approvedOrders, valueAgg] = await Promise.all([
    prisma.pharmacyPurchaseOrder.count({ where }),
    prisma.pharmacyPurchaseOrder.count({ where: { ...where, status: 'Pending' } }),
    prisma.pharmacyPurchaseOrder.count({ where: { ...where, status: 'Approved' } }),
    prisma.pharmacyPurchaseOrder.aggregate({
      where: { ...where, NOT: { status: 'Cancelled' } },
      _sum: { grandTotal: true },
    }),
  ]);

  return {
    totalPurchaseOrders,
    pendingOrders,
    approvedOrders,
    totalPurchaseValue: Number(valueAgg._sum.grandTotal ?? 0),
  };
}

async function fetchOrder(id) {
  return prisma.pharmacyPurchaseOrder.findUnique({
    where: { id },
    include: poInclude,
  });
}

async function createOrderWithItems(poNumber, data, createdBy) {
  const { items, subTotal, gstAmount, grandTotal, supplierId, supplierName, remarks, status } = data;
  return prisma.pharmacyPurchaseOrder.create({
    data: {
      poNumber,
      supplierId,
      supplierName,
      subTotal,
      gstAmount,
      grandTotal,
      remarks,
      status,
      createdBy,
      items: {
        create: items.map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          gstPercentage: item.gstPercentage,
          amount: item.amount,
        })),
      },
    },
    include: poInclude,
  });
}

async function replaceOrderItems(orderId, items, totals) {
  await prisma.pharmacyPurchaseOrderItem.deleteMany({ where: { purchaseOrderId: orderId } });
  return prisma.pharmacyPurchaseOrder.update({
    where: { id: orderId },
    data: {
      subTotal: totals.subTotal,
      gstAmount: totals.gstAmount,
      grandTotal: totals.grandTotal,
      items: {
        create: items.map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          gstPercentage: item.gstPercentage,
          amount: item.amount,
        })),
      },
    },
    include: poInclude,
  });
}

const createPurchaseOrder = async (req, res) => {
  try {
    const validation = await validatePayload(req.body);
    if (validation.errors) {
      return res.status(400).json({ message: 'Validation error', errors: validation.errors });
    }

    const poNumber = await generatePoNumber();
    const order = await createOrderWithItems(poNumber, validation.data, req.user?.userId || null);

    return res.status(201).json({
      message: 'Purchase order created',
      purchaseOrder: mapPurchaseOrder(order),
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'PO number conflict, please retry' });
    }
    console.error('[pharmacy/purchase-orders] create', err);
    return res.status(500).json({ message: 'Failed to create purchase order' });
  }
};

const getPurchaseOrders = async (req, res) => {
  try {
    const where = buildListWhere(req.query);
    const orders = await prisma.pharmacyPurchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: poInclude,
    });

    const statsWhere = {};
    if (where.status) statsWhere.status = where.status;
    const stats = await buildStats(statsWhere);

    return res.json({
      purchaseOrders: orders.map(mapPurchaseOrder),
      stats,
    });
  } catch (err) {
    console.error('[pharmacy/purchase-orders] list', err);
    return res.status(500).json({ message: 'Failed to fetch purchase orders' });
  }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const order = await fetchOrder(req.params.id);
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    return res.json({ purchaseOrder: mapPurchaseOrder(order) });
  } catch (err) {
    console.error('[pharmacy/purchase-orders] get', err);
    return res.status(500).json({ message: 'Failed to fetch purchase order' });
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const order = await prisma.pharmacyPurchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });

    if (!['Draft', 'Pending'].includes(order.status)) {
      return res.status(400).json({ message: 'Only draft or pending orders can be updated' });
    }

    const validation = await validatePayload(req.body, {
      isUpdate: true,
      existingStatus: order.status,
    });
    if (validation.errors) {
      return res.status(400).json({ message: 'Validation error', errors: validation.errors });
    }

    const { items, subTotal, gstAmount, grandTotal, supplierId, supplierName, remarks, status } =
      validation.data;

    const patch = {
      ...(supplierId ? { supplierId, supplierName } : {}),
      ...(remarks !== undefined ? { remarks: remarks || null } : {}),
      ...(status ? { status } : {}),
    };

    let updated;
    if (items) {
      await prisma.pharmacyPurchaseOrder.update({ where: { id: order.id }, data: patch });
      updated = await replaceOrderItems(order.id, items, { subTotal, gstAmount, grandTotal });
    } else {
      updated = await prisma.pharmacyPurchaseOrder.update({
        where: { id: order.id },
        data: patch,
        include: poInclude,
      });
    }

    return res.json({
      message: 'Purchase order updated',
      purchaseOrder: mapPurchaseOrder(updated),
    });
  } catch (err) {
    console.error('[pharmacy/purchase-orders] update', err);
    return res.status(500).json({ message: 'Failed to update purchase order' });
  }
};

const approvePurchaseOrder = async (req, res) => {
  try {
    const order = await prisma.pharmacyPurchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending orders can be approved' });
    }

    const updated = await prisma.pharmacyPurchaseOrder.update({
      where: { id: order.id },
      data: { status: 'Approved' },
      include: poInclude,
    });

    return res.json({
      message: 'Purchase order approved',
      purchaseOrder: mapPurchaseOrder(updated),
    });
  } catch (err) {
    console.error('[pharmacy/purchase-orders] approve', err);
    return res.status(500).json({ message: 'Failed to approve purchase order' });
  }
};

const cancelPurchaseOrder = async (req, res) => {
  try {
    const order = await prisma.pharmacyPurchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'Purchase order is already cancelled' });
    }
    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'Delivered orders cannot be cancelled' });
    }

    const updated = await prisma.pharmacyPurchaseOrder.update({
      where: { id: order.id },
      data: { status: 'Cancelled' },
      include: poInclude,
    });

    return res.json({
      message: 'Purchase order cancelled',
      purchaseOrder: mapPurchaseOrder(updated),
    });
  } catch (err) {
    console.error('[pharmacy/purchase-orders] cancel', err);
    return res.status(500).json({ message: 'Failed to cancel purchase order' });
  }
};

function formatPoDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatSupplierPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone || '';
}

function buildSupplierAddress(supplier) {
  if (!supplier) return '';
  return [supplier.address, supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(', ');
}

function dominantGstLabel(items) {
  if (!items?.length) return 'GST';
  const rates = [...new Set(items.map((i) => i.gstPercentage))];
  if (rates.length === 1) return `GST (${rates[0]}%)`;
  return 'GST';
}

async function buildPrintPayload(order) {
  const supplier = order.supplier;
  const medicineIds = (order.items || []).map((i) => i.medicineId);
  const medicines = medicineIds.length
    ? await prisma.pharmacyMedicine.findMany({ where: { id: { in: medicineIds } } })
    : [];
  const medMap = new Map(medicines.map((m) => [m.id, m]));

  const poDate = order.createdAt;
  const deliveryDate = addDays(poDate, 4);
  const paymentTerm = normalizeString(supplier?.paymentTerms) || '30 Days';

  const items = (order.items || []).map((item, idx) => {
    const med = medMap.get(item.medicineId) || {};
    const brandName = normalizeString(med.brandName) || item.medicineName;
    const genericName = normalizeString(med.genericName);
    const unit = normalizeString(med.dosageForm) || 'Unit';
    const hsnCode = normalizeString(med.hsnCode) || '—';
    return {
      sno: idx + 1,
      medicineName: item.medicineName,
      brandName,
      genericName,
      displayName: genericName ? `${brandName} (${genericName})` : brandName,
      hsnCode,
      quantity: item.quantity,
      unit,
      rate: toNum(item.purchasePrice),
      gstPercentage: item.gstPercentage,
      amount: toNum(item.amount),
    };
  });

  return {
    hospital: {
      nameEn: 'NEW H T HOSPITAL',
      nameHi: 'नैतिक हॉस्पिटल एण्ड सर्जिकल सेन्टर',
      address: 'ANAND BIHAR COLONY, BHIKHARIPUR BLW, VARANASI, U.P - 221004',
      phone: '+91 91409 78130',
      email: 'naitikhospital@gmail.com',
    },
    poNumber: order.poNumber,
    poDate: formatPoDate(poDate),
    deliveryDate: formatPoDate(deliveryDate),
    paymentTerm,
    totalItems: items.length,
    transport: 'Supplier',
    status: order.status,
    remarks:
      normalizeString(order.remarks) ||
      'Kindly supply the above medicines as per order. Ensure original packing & proper expiry.',
    supplier: {
      supplierName: order.supplierName,
      companyName: supplier?.companyName || '',
      address: buildSupplierAddress(supplier),
      phone: formatSupplierPhone(supplier?.phone),
      gstNumber: supplier?.gstNumber || '—',
      contactPerson: supplier?.contactPerson || '',
    },
    items,
    subTotal: toNum(order.subTotal),
    gstAmount: toNum(order.gstAmount),
    grandTotal: toNum(order.grandTotal),
    gstLabel: dominantGstLabel(order.items),
    preparedBy: order.createdBy || 'Pharmacist',
    printGeneratedAt: new Date().toISOString(),
  };
}

const getPurchaseOrderPrint = async (req, res) => {
  try {
    const order = await fetchOrder(req.params.id);
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    const printData = await buildPrintPayload(order);
    return res.json({ printData });
  } catch (err) {
    console.error('[pharmacy/purchase-orders] print', err);
    return res.status(500).json({ message: 'Failed to load purchase order for print' });
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    const order = await prisma.pharmacyPurchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Purchase order not found' });
    if (order.status !== 'Draft') {
      return res.status(400).json({ message: 'Only draft purchase orders can be deleted' });
    }

    await prisma.pharmacyPurchaseOrder.delete({ where: { id: order.id } });
    return res.json({ message: 'Purchase order deleted' });
  } catch (err) {
    console.error('[pharmacy/purchase-orders] delete', err);
    return res.status(500).json({ message: 'Failed to delete purchase order' });
  }
};

module.exports = {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  getPurchaseOrderPrint,
  updatePurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  deletePurchaseOrder,
};
