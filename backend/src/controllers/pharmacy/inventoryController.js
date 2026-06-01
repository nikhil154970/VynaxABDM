const { prisma } = require('../../config/prisma');
const { normalizeString, isUuid, batchStatusApi, toNum } = require('../../lib/pharmacy/helpers');

const LOW_STOCK_MIN = Number(process.env.PHARMACY_LOW_STOCK_MIN) || 20;
const NEAR_EXPIRY_DAYS = Number(process.env.PHARMACY_NEAR_EXPIRY_DAYS) || 90;

function stockStatus(available) {
  const qty = Number(available) || 0;
  if (qty <= 0) return 'Out of Stock';
  if (qty < LOW_STOCK_MIN) return 'Low Stock';
  return 'In Stock';
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

function expiryTone(days) {
  if (days == null) return 'normal';
  if (days < 30) return 'critical';
  if (days < 60) return 'warning';
  if (days < 90) return 'caution';
  return 'normal';
}

async function aggregateBatchByMedicine() {
  const batches = await prisma.pharmacyInventoryBatch.findMany({
    where: { status: { in: ['ACTIVE', 'DEPLETED', 'EXPIRED'] } },
    select: {
      medicineId: true,
      medicineName: true,
      qty: true,
      availableQty: true,
      expiryDate: true,
      purchasePrice: true,
      createdAt: true,
    },
  });

  const now = new Date();
  const nearExpiryEnd = new Date(now);
  nearExpiryEnd.setDate(nearExpiryEnd.getDate() + NEAR_EXPIRY_DAYS);

  const map = new Map();
  for (const b of batches) {
    let agg = map.get(b.medicineId);
    if (!agg) {
      agg = {
        medicineId: b.medicineId,
        medicineName: b.medicineName,
        totalStock: 0,
        availableStock: 0,
        batchCount: 0,
        inventoryValue: 0,
        nearestExpiry: null,
        lastGrnAt: null,
        hasNearExpiry: false,
      };
      map.set(b.medicineId, agg);
    }
    agg.totalStock += b.qty;
    agg.availableStock += b.availableQty;
    if (b.availableQty > 0) {
      agg.batchCount += 1;
      agg.inventoryValue += b.availableQty * toNum(b.purchasePrice);
      if (!agg.nearestExpiry || b.expiryDate < agg.nearestExpiry) {
        agg.nearestExpiry = b.expiryDate;
      }
      if (b.expiryDate >= now && b.expiryDate <= nearExpiryEnd) {
        agg.hasNearExpiry = true;
      }
      if (!agg.lastGrnAt || b.createdAt > agg.lastGrnAt) {
        agg.lastGrnAt = b.createdAt;
      }
    }
  }
  return map;
}

function buildInventoryRows(batchMap, medicines) {
  return medicines.map((med) => {
    const agg = batchMap.get(med.id) || null;
    const availableStock = agg?.availableStock ?? 0;
    const totalStock = agg?.totalStock ?? 0;
    const nearestExpiry = agg?.nearestExpiry || null;
    const days = daysUntil(nearestExpiry);

    return {
      medicineId: med.id,
      medicineName: med.medicineName,
      genericName: med.genericName || '',
      category: med.category,
      totalStock,
      availableStock,
      batchCount: agg?.batchCount ?? 0,
      nearestExpiry,
      daysToExpiry: days,
      inventoryValue: Math.round((agg?.inventoryValue ?? 0) * 100) / 100,
      minimumLevel: LOW_STOCK_MIN,
      requiredQty: Math.max(0, LOW_STOCK_MIN - availableStock),
      status: stockStatus(availableStock),
      lastGrnAt: agg?.lastGrnAt || null,
      lastUpdated: agg?.lastGrnAt || med.updatedAt,
      isNearExpiry: Boolean(agg?.hasNearExpiry),
    };
  });
}

function applyListFilters(rows, query) {
  let list = [...rows];
  const search = normalizeString(query.search || query.q);
  const category = normalizeString(query.category);
  const filter = normalizeString(query.filter).toLowerCase();

  if (search) {
    const s = search.toLowerCase();
    list = list.filter(
      (r) =>
        r.medicineName.toLowerCase().includes(s) || r.genericName.toLowerCase().includes(s)
    );
  }

  if (category && category !== 'all') {
    list = list.filter((r) => r.category === category);
  }

  if (filter === 'low_stock' || filter === 'low-stock') {
    list = list.filter((r) => r.status === 'Low Stock');
  } else if (filter === 'out_of_stock' || filter === 'out-of-stock') {
    list = list.filter((r) => r.status === 'Out of Stock');
  } else if (filter === 'near_expiry' || filter === 'near-expiry') {
    list = list.filter((r) => r.isNearExpiry && r.availableStock > 0);
  } else if (filter === 'in_stock' || filter === 'in-stock') {
    list = list.filter((r) => r.status === 'In Stock');
  }

  list.sort((a, b) => a.medicineName.localeCompare(b.medicineName));
  return list;
}

function buildSummary(rows) {
  const totalMedicines = rows.length;
  const totalStockQuantity = rows.reduce((s, r) => s + r.availableStock, 0);
  const lowStockMedicines = rows.filter((r) => r.status === 'Low Stock').length;
  const nearExpiryMedicines = rows.filter((r) => r.isNearExpiry && r.availableStock > 0).length;
  const inventoryValue = rows.reduce((s, r) => s + r.inventoryValue, 0);

  return {
    totalMedicines,
    totalStockQuantity,
    lowStockMedicines,
    nearExpiryMedicines,
    inventoryValue: Math.round(inventoryValue * 100) / 100,
    lowStockMinimum: LOW_STOCK_MIN,
    nearExpiryDays: NEAR_EXPIRY_DAYS,
  };
}

function formatReference(tx) {
  if (tx.referenceType === 'GRN' && tx.notes) {
    const m = String(tx.notes).match(/GRN\s+(\S+)/i);
    if (m) return `GRN ${m[1]}`;
  }
  if (tx.type === 'GRN_IN') return 'GRN';
  if (tx.type === 'SALE_OUT') return 'Bill';
  if (tx.type === 'RETURN_IN') return 'Return';
  return tx.referenceType || tx.type;
}

const getInventorySummary = async (req, res) => {
  try {
    const medicines = await prisma.pharmacyMedicine.findMany({ where: { status: 'ACTIVE' } });
    const batchMap = await aggregateBatchByMedicine();
    const rows = buildInventoryRows(batchMap, medicines);
    return res.json({ summary: buildSummary(rows) });
  } catch (err) {
    console.error('[pharmacy/inventory] summary', err);
    return res.status(500).json({ message: 'Failed to fetch inventory summary' });
  }
};

const getInventoryList = async (req, res) => {
  try {
    let medicines = await prisma.pharmacyMedicine.findMany({ where: { status: 'ACTIVE' } });
    const batchMap = await aggregateBatchByMedicine();

    const batchSearch = normalizeString(req.query.batchSearch);
    if (batchSearch) {
      const batchHits = await prisma.pharmacyInventoryBatch.findMany({
        where: { batchNumber: { contains: batchSearch, mode: 'insensitive' } },
        distinct: ['medicineId'],
        select: { medicineId: true },
      });
      const hitSet = new Set(batchHits.map((b) => b.medicineId));
      medicines = medicines.filter((m) => hitSet.has(m.id));
    }

    const allMedicines = await prisma.pharmacyMedicine.findMany({ where: { status: 'ACTIVE' } });
    const allRows = buildInventoryRows(batchMap, allMedicines);
    const rows = applyListFilters(buildInventoryRows(batchMap, medicines), req.query);
    const categories = [...new Set(medicines.map((m) => m.category).filter(Boolean))].sort();

    return res.json({
      inventory: rows,
      summary: buildSummary(allRows),
      categories,
    });
  } catch (err) {
    console.error('[pharmacy/inventory] list', err);
    return res.status(500).json({ message: 'Failed to fetch inventory' });
  }
};

const getInventoryByMedicine = async (req, res) => {
  try {
    if (!isUuid(req.params.medicineId)) {
      return res.status(400).json({ message: 'Invalid medicine id' });
    }

    const medicine = await prisma.pharmacyMedicine.findUnique({
      where: { id: req.params.medicineId },
    });
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });

    const batches = await prisma.pharmacyInventoryBatch.findMany({
      where: { medicineId: medicine.id },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        supplier: { select: { supplierName: true } },
        grn: { select: { grnNumber: true, receivedDate: true } },
      },
    });

    const ledger = await prisma.pharmacyStockTransaction.findMany({
      where: { medicineId: medicine.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { batch: { select: { batchNumber: true, expiryDate: true } } },
    });

    const availableStock = batches.reduce((s, b) => s + b.availableQty, 0);
    const totalStock = batches.reduce((s, b) => s + b.qty, 0);
    const inventoryValue = batches.reduce(
      (s, b) => s + b.availableQty * toNum(b.purchasePrice),
      0
    );
    const lastGrnAt = batches.reduce((max, b) => {
      const t = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return t > max ? t : max;
    }, 0);

    const expiryRows = batches
      .filter((b) => b.availableQty > 0)
      .map((b) => {
        const days = daysUntil(b.expiryDate);
        return {
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          daysRemaining: days,
          stock: b.availableQty,
          tone: expiryTone(days),
        };
      })
      .sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));

    return res.json({
      overview: {
        medicineId: medicine.id,
        medicineName: medicine.medicineName,
        genericName: medicine.genericName || '',
        category: medicine.category,
        totalStock,
        availableStock,
        batchCount: batches.filter((b) => b.availableQty > 0).length,
        inventoryValue: Math.round(inventoryValue * 100) / 100,
        minimumLevel: LOW_STOCK_MIN,
        requiredQty: Math.max(0, LOW_STOCK_MIN - availableStock),
        status: stockStatus(availableStock),
        lastGrnAt: lastGrnAt ? new Date(lastGrnAt) : null,
        lastUpdated: batches[0]?.updatedAt || medicine.updatedAt,
      },
      batches: batches.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        purchasePrice: toNum(b.purchasePrice),
        sellingPrice: toNum(b.sellingPrice),
        mrp: toNum(b.mrp),
        availableQty: b.availableQty,
        qty: b.qty,
        supplierName: b.supplier?.supplierName || '—',
        grnNumber: b.grn?.grnNumber || '—',
        grnId: b.grnId,
        receivedDate: b.grn?.receivedDate || b.createdAt,
        status: batchStatusApi(b.status),
        daysRemaining: daysUntil(b.expiryDate),
        expiryTone: expiryTone(daysUntil(b.expiryDate)),
      })),
      expiryDetails: expiryRows,
      ledger: ledger.map((tx) => ({
        id: tx.id,
        date: tx.createdAt,
        medicineName: medicine.medicineName,
        type: tx.type,
        reference: formatReference(tx),
        qtyIn: tx.qtyIn || 0,
        qtyOut: tx.qtyOut || 0,
        balance: tx.balance,
        batchNumber: tx.batch?.batchNumber || '—',
        notes: tx.notes || '',
      })),
    });
  } catch (err) {
    console.error('[pharmacy/inventory] detail', err);
    return res.status(500).json({ message: 'Failed to fetch inventory details' });
  }
};

const getLowStock = async (req, res) => {
  try {
    const medicines = await prisma.pharmacyMedicine.findMany({ where: { status: 'ACTIVE' } });
    const batchMap = await aggregateBatchByMedicine();
    const rows = buildInventoryRows(batchMap, medicines).filter(
      (r) => r.status === 'Low Stock' || r.status === 'Out of Stock'
    );
    return res.json({ lowStock: rows });
  } catch (err) {
    console.error('[pharmacy/inventory] low-stock', err);
    return res.status(500).json({ message: 'Failed to fetch low stock' });
  }
};

const getNearExpiry = async (req, res) => {
  try {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + NEAR_EXPIRY_DAYS);

    const batches = await prisma.pharmacyInventoryBatch.findMany({
      where: {
        availableQty: { gt: 0 },
        expiryDate: { gte: now, lte: end },
        status: 'ACTIVE',
      },
      orderBy: { expiryDate: 'asc' },
    });

    const medicineIds = [...new Set(batches.map((b) => b.medicineId))];
    const medicines = medicineIds.length
      ? await prisma.pharmacyMedicine.findMany({ where: { id: { in: medicineIds } } })
      : [];
    const medMap = new Map(medicines.map((m) => [m.id, m]));

    const nearExpiry = batches.map((b) => {
      const med = medMap.get(b.medicineId);
      const days = daysUntil(b.expiryDate);
      return {
        medicineId: b.medicineId,
        medicineName: b.medicineName,
        genericName: med?.genericName || '',
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        daysRemaining: days,
        stock: b.availableQty,
        tone: expiryTone(days),
      };
    });

    return res.json({ nearExpiry, nearExpiryDays: NEAR_EXPIRY_DAYS });
  } catch (err) {
    console.error('[pharmacy/inventory] near-expiry', err);
    return res.status(500).json({ message: 'Failed to fetch near expiry' });
  }
};

const getStockLedger = async (req, res) => {
  try {
    const where = {};
    const medicineId = normalizeString(req.query.medicineId);
    if (medicineId && isUuid(medicineId)) {
      where.medicineId = medicineId;
    }

    const type = normalizeString(req.query.type);
    if (type) where.type = type;

    const dateFrom = normalizeString(req.query.dateFrom);
    const dateTo = normalizeString(req.query.dateTo);
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

    const search = normalizeString(req.query.search || req.query.q);
    if (search) {
      const meds = await prisma.pharmacyMedicine.findMany({
        where: {
          OR: [
            { medicineName: { contains: search, mode: 'insensitive' } },
            { genericName: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      where.medicineId = { in: meds.map((m) => m.id) };
    }

    const txs = await prisma.pharmacyStockTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        medicine: { select: { medicineName: true, genericName: true } },
        batch: { select: { batchNumber: true } },
      },
    });

    const ledger = txs.map((tx) => ({
      id: tx.id,
      date: tx.createdAt,
      medicineId: tx.medicineId,
      medicineName: tx.medicine?.medicineName || '—',
      transactionType: tx.type,
      reference: formatReference(tx),
      qtyIn: tx.qtyIn || 0,
      qtyOut: tx.qtyOut || 0,
      balance: tx.balance,
      batchNumber: tx.batch?.batchNumber || '—',
      notes: tx.notes || '',
    }));

    return res.json({ ledger });
  } catch (err) {
    console.error('[pharmacy/inventory] ledger', err);
    return res.status(500).json({ message: 'Failed to fetch stock ledger' });
  }
};

module.exports = {
  getInventorySummary,
  getInventoryList,
  getInventoryByMedicine,
  getLowStock,
  getNearExpiry,
  getStockLedger,
};
