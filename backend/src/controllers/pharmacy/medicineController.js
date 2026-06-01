const { prisma } = require('../../config/prisma');
const { ALLOWED_GST } = require('../../lib/pharmacy/constants');
const {
  normalizeString,
  parseNumber,
  parseBool,
  catalogStatusApi,
  catalogStatusDb,
  toNum,
} = require('../../lib/pharmacy/helpers');

function mapMedicine(row) {
  if (!row) return null;
  return {
    id: row.id,
    medicineName: row.medicineName,
    genericName: row.genericName || '',
    brandName: row.brandName || '',
    category: row.category,
    dosageForm: row.dosageForm || '',
    strength: row.strength || '',
    manufacturer: row.manufacturer || '',
    hsnCode: row.hsnCode || '',
    gstPercentage: row.gstPercentage,
    barcode: row.barcode || '',
    description: row.description || '',
    defaultMRP: toNum(row.defaultMRP),
    defaultPurchasePrice: toNum(row.defaultPurchasePrice),
    defaultSellingPrice: toNum(row.defaultSellingPrice),
    prescriptionRequired: Boolean(row.prescriptionRequired),
    expiryApplicable: Boolean(row.expiryApplicable),
    status: catalogStatusApi(row.status),
    createdBy: row.createdBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validateMedicinePayload(body, { isUpdate = false } = {}) {
  const errors = [];
  const medicineName = normalizeString(body.medicineName);
  const category = normalizeString(body.category);
  const gstPercentage = body.gstPercentage !== undefined ? parseNumber(body.gstPercentage, NaN) : NaN;
  const barcode = normalizeString(body.barcode);
  const defaultMRP = parseNumber(body.defaultMRP, 0);
  const defaultPurchasePrice = parseNumber(body.defaultPurchasePrice, 0);
  const defaultSellingPrice = parseNumber(body.defaultSellingPrice, 0);

  if (!isUpdate || body.medicineName !== undefined) {
    if (!medicineName) errors.push({ field: 'medicineName', message: 'Medicine name is required' });
  }
  if (!isUpdate || body.category !== undefined) {
    if (!category) errors.push({ field: 'category', message: 'Category is required' });
  }
  if (!isUpdate || body.gstPercentage !== undefined) {
    if (!Number.isFinite(gstPercentage)) {
      errors.push({ field: 'gstPercentage', message: 'GST percentage is required' });
    } else if (!ALLOWED_GST.includes(gstPercentage)) {
      errors.push({ field: 'gstPercentage', message: 'GST must be 0, 5, 12, 18, or 28' });
    }
  }

  if (defaultMRP < 0) errors.push({ field: 'defaultMRP', message: 'MRP cannot be negative' });
  if (defaultPurchasePrice < 0) {
    errors.push({ field: 'defaultPurchasePrice', message: 'Purchase price cannot be negative' });
  }
  if (defaultSellingPrice < 0) {
    errors.push({ field: 'defaultSellingPrice', message: 'Selling price cannot be negative' });
  }

  if (errors.length) return { errors };

  const statusRaw = normalizeString(body.status).toLowerCase();
  const status =
    statusRaw === 'inactive' ? 'INACTIVE' : statusRaw === 'active' ? 'ACTIVE' : undefined;

  return {
    data: {
      medicineName,
      genericName: normalizeString(body.genericName) || null,
      brandName: normalizeString(body.brandName) || null,
      category,
      dosageForm: normalizeString(body.dosageForm) || null,
      strength: normalizeString(body.strength) || null,
      manufacturer: normalizeString(body.manufacturer) || null,
      hsnCode: normalizeString(body.hsnCode) || null,
      gstPercentage: Number.isFinite(gstPercentage) ? gstPercentage : undefined,
      barcode: barcode || null,
      description: normalizeString(body.description) || null,
      defaultMRP,
      defaultPurchasePrice,
      defaultSellingPrice,
      prescriptionRequired: parseBool(body.prescriptionRequired, false),
      expiryApplicable: parseBool(body.expiryApplicable, true),
      ...(status ? { status } : {}),
    },
  };
}

function buildListWhere(query) {
  const where = {};
  const status = normalizeString(query.status).toLowerCase();
  if (status === 'active' || status === 'inactive') {
    where.status = catalogStatusDb(status);
  }

  const category = normalizeString(query.category);
  if (category && category !== 'all') where.category = category;

  const search = normalizeString(query.search || query.q);
  if (search) {
    where.OR = [
      { medicineName: { contains: search, mode: 'insensitive' } },
      { genericName: { contains: search, mode: 'insensitive' } },
      { brandName: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
      { manufacturer: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
}

async function buildStats(where = {}) {
  const [totalMedicines, activeMedicines, prescriptionMedicines, categories] = await Promise.all([
    prisma.pharmacyMedicine.count({ where }),
    prisma.pharmacyMedicine.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.pharmacyMedicine.count({
      where: { ...where, status: 'ACTIVE', prescriptionRequired: true },
    }),
    prisma.pharmacyMedicine.findMany({
      where: { ...where, NOT: { category: '' } },
      distinct: ['category'],
      select: { category: true },
    }),
  ]);
  const categoryList = categories.map((c) => c.category).filter(Boolean).sort();
  return {
    totalMedicines,
    activeMedicines,
    prescriptionMedicines,
    categoriesCount: categoryList.length,
    categories: categoryList,
  };
}

const createMedicine = async (req, res) => {
  try {
    const { errors, data } = validateMedicinePayload(req.body);
    if (errors) return res.status(400).json({ message: 'Validation error', errors });

    if (data.barcode) {
      const dup = await prisma.pharmacyMedicine.findFirst({ where: { barcode: data.barcode } });
      if (dup) return res.status(409).json({ message: 'A medicine with this barcode already exists' });
    }

    const medicine = await prisma.pharmacyMedicine.create({
      data: {
        ...data,
        status: data.status || 'ACTIVE',
        barcode: data.barcode || null,
        createdBy: req.user?.userId || null,
      },
    });

    return res.status(201).json({ message: 'Medicine created', medicine: mapMedicine(medicine) });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'A medicine with this barcode already exists' });
    }
    console.error('[pharmacy/medicines] create', err);
    return res.status(500).json({ message: 'Failed to create medicine' });
  }
};

const getMedicines = async (req, res) => {
  try {
    const where = buildListWhere(req.query);
    const medicines = await prisma.pharmacyMedicine.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    const statsWhere = {};
    const status = normalizeString(req.query.status).toLowerCase();
    if (status === 'active' || status === 'inactive') statsWhere.status = catalogStatusDb(status);
    if (where.category) statsWhere.category = where.category;

    const stats = await buildStats(statsWhere);

    return res.json({
      medicines: medicines.map(mapMedicine),
      stats,
    });
  } catch (err) {
    console.error('[pharmacy/medicines] list', err);
    return res.status(500).json({ message: 'Failed to fetch medicines' });
  }
};

const getMedicineById = async (req, res) => {
  try {
    const medicine = await prisma.pharmacyMedicine.findUnique({ where: { id: req.params.id } });
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });
    return res.json({ medicine: mapMedicine(medicine) });
  } catch (err) {
    console.error('[pharmacy/medicines] get', err);
    return res.status(500).json({ message: 'Failed to fetch medicine' });
  }
};

const updateMedicine = async (req, res) => {
  try {
    const existing = await prisma.pharmacyMedicine.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Medicine not found' });

    const { errors, data } = validateMedicinePayload(req.body, { isUpdate: true });
    if (errors) return res.status(400).json({ message: 'Validation error', errors });

    const patch = {};
    Object.keys(data).forEach((key) => {
      if (req.body[key] !== undefined) patch[key] = data[key];
    });

    if (patch.barcode !== undefined) {
      if (!patch.barcode) {
        patch.barcode = null;
      } else if (patch.barcode !== existing.barcode) {
        const dup = await prisma.pharmacyMedicine.findFirst({
          where: { barcode: patch.barcode, NOT: { id: existing.id } },
        });
        if (dup) return res.status(409).json({ message: 'A medicine with this barcode already exists' });
      }
    }

    const medicine = await prisma.pharmacyMedicine.update({
      where: { id: req.params.id },
      data: patch,
    });

    return res.json({ message: 'Medicine updated', medicine: mapMedicine(medicine) });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'A medicine with this barcode already exists' });
    }
    console.error('[pharmacy/medicines] update', err);
    return res.status(500).json({ message: 'Failed to update medicine' });
  }
};

const deactivateMedicine = async (req, res) => {
  try {
    const existing = await prisma.pharmacyMedicine.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Medicine not found' });

    const medicine = await prisma.pharmacyMedicine.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE' },
    });

    return res.json({ message: 'Medicine deactivated', medicine: mapMedicine(medicine) });
  } catch (err) {
    console.error('[pharmacy/medicines] deactivate', err);
    return res.status(500).json({ message: 'Failed to deactivate medicine' });
  }
};

module.exports = {
  createMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  deactivateMedicine,
};
