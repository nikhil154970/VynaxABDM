const { prisma } = require('../../config/prisma');

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;

function normalizeString(v) {
  if (v == null) return '';
  return String(v).trim();
}

function normalizePhone(v) {
  const digits = normalizeString(v).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function parseNumber(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStatusApi(status) {
  return status === 'INACTIVE' ? 'inactive' : 'active';
}

function toStatusDb(status) {
  return normalizeString(status).toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE';
}

function mapSupplier(row) {
  if (!row) return null;
  return {
    id: row.id,
    supplierName: row.supplierName,
    companyName: row.companyName || '',
    contactPerson: row.contactPerson || '',
    phone: row.phone,
    email: row.email || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    pincode: row.pincode || '',
    gstNumber: row.gstNumber,
    drugLicenseNumber: row.drugLicenseNumber || '',
    panNumber: row.panNumber || '',
    bankName: row.bankName || '',
    accountNumber: row.accountNumber || '',
    ifscCode: row.ifscCode || '',
    creditLimit: row.creditLimit != null ? Number(row.creditLimit) : 0,
    paymentTerms: row.paymentTerms || '',
    notes: row.notes || '',
    status: toStatusApi(row.status),
    outstandingAmount: Number(row.outstandingAmount ?? 0),
    totalPurchases: Number(row.totalPurchases ?? 0),
    createdBy: row.createdBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validateSupplierPayload(body, { isUpdate = false } = {}) {
  const errors = [];
  const supplierName = normalizeString(body.supplierName);
  const phone = normalizePhone(body.phone);
  const gstNumber = normalizeString(body.gstNumber).toUpperCase();
  const email = normalizeString(body.email);

  if (!isUpdate || body.supplierName !== undefined) {
    if (!supplierName) errors.push({ field: 'supplierName', message: 'Supplier name is required' });
  }
  if (!isUpdate || body.phone !== undefined) {
    if (!phone) errors.push({ field: 'phone', message: 'Phone number is required' });
    else if (!PHONE_REGEX.test(phone)) {
      errors.push({ field: 'phone', message: 'Enter a valid 10-digit Indian mobile number' });
    }
  }
  if (!isUpdate || body.gstNumber !== undefined) {
    if (!gstNumber) errors.push({ field: 'gstNumber', message: 'GST number is required' });
    else if (!GST_REGEX.test(gstNumber)) {
      errors.push({ field: 'gstNumber', message: 'Invalid GST format (15 characters)' });
    }
  }
  if (email && !EMAIL_REGEX.test(email)) {
    errors.push({ field: 'email', message: 'Invalid email address' });
  }

  if (errors.length) return { errors };
  return {
    data: {
      supplierName,
      companyName: normalizeString(body.companyName) || null,
      contactPerson: normalizeString(body.contactPerson) || null,
      phone,
      email: email || null,
      address: normalizeString(body.address) || null,
      city: normalizeString(body.city) || null,
      state: normalizeString(body.state) || null,
      pincode: normalizeString(body.pincode) || null,
      gstNumber,
      drugLicenseNumber: normalizeString(body.drugLicenseNumber) || null,
      panNumber: normalizeString(body.panNumber).toUpperCase() || null,
      bankName: normalizeString(body.bankName) || null,
      accountNumber: normalizeString(body.accountNumber) || null,
      ifscCode: normalizeString(body.ifscCode).toUpperCase() || null,
      creditLimit: parseNumber(body.creditLimit, 0),
      paymentTerms: normalizeString(body.paymentTerms) || null,
      notes: normalizeString(body.notes) || null,
    },
  };
}

function buildListWhere(query) {
  const where = {};
  const status = normalizeString(query.status).toLowerCase();
  if (status === 'active' || status === 'inactive') {
    where.status = toStatusDb(status);
  }
  const search = normalizeString(query.search || query.q);
  if (search) {
    where.OR = [
      { supplierName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { gstNumber: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
}

async function buildStats(where = {}) {
  const [totalSuppliers, activeSuppliers, agg] = await Promise.all([
    prisma.pharmacySupplier.count({ where }),
    prisma.pharmacySupplier.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.pharmacySupplier.aggregate({
      where,
      _sum: { outstandingAmount: true, totalPurchases: true },
    }),
  ]);
  return {
    totalSuppliers,
    activeSuppliers,
    pendingPayments: Number(agg._sum.outstandingAmount ?? 0),
    totalPurchases: Number(agg._sum.totalPurchases ?? 0),
  };
}

const createSupplier = async (req, res) => {
  try {
    const { errors, data } = validateSupplierPayload(req.body);
    if (errors) return res.status(400).json({ message: 'Validation error', errors });

    const existing = await prisma.pharmacySupplier.findFirst({
      where: { gstNumber: data.gstNumber },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ message: 'A supplier with this GST number already exists' });
    }

    const supplier = await prisma.pharmacySupplier.create({
      data: {
        ...data,
        status: 'ACTIVE',
        createdBy: req.user?.userId || null,
      },
    });

    return res.status(201).json({ message: 'Supplier created', supplier: mapSupplier(supplier) });
  } catch (err) {
    console.error('[pharmacy/suppliers] create', err);
    return res.status(500).json({ message: 'Failed to create supplier' });
  }
};

const getSuppliers = async (req, res) => {
  try {
    const where = buildListWhere(req.query);
    const suppliers = await prisma.pharmacySupplier.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    const statsWhere = {};
    const status = normalizeString(req.query.status).toLowerCase();
    if (status === 'active' || status === 'inactive') {
      statsWhere.status = toStatusDb(status);
    }
    const stats = await buildStats(statsWhere);

    return res.json({
      suppliers: suppliers.map(mapSupplier),
      stats,
    });
  } catch (err) {
    console.error('[pharmacy/suppliers] list', err);
    return res.status(500).json({ message: 'Failed to fetch suppliers' });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const supplier = await prisma.pharmacySupplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    return res.json({ supplier: mapSupplier(supplier) });
  } catch (err) {
    console.error('[pharmacy/suppliers] get', err);
    return res.status(500).json({ message: 'Failed to fetch supplier' });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const existing = await prisma.pharmacySupplier.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Supplier not found' });

    const { errors, data } = validateSupplierPayload(req.body, { isUpdate: true });
    if (errors) return res.status(400).json({ message: 'Validation error', errors });

    const patch = {};
    Object.keys(data).forEach((key) => {
      if (req.body[key] !== undefined) patch[key] = data[key];
    });

    if (patch.gstNumber && patch.gstNumber !== existing.gstNumber) {
      const dup = await prisma.pharmacySupplier.findFirst({
        where: { gstNumber: patch.gstNumber, NOT: { id: existing.id } },
        select: { id: true },
      });
      if (dup) return res.status(409).json({ message: 'A supplier with this GST number already exists' });
    }

    const supplier = await prisma.pharmacySupplier.update({
      where: { id: req.params.id },
      data: patch,
    });

    return res.json({ message: 'Supplier updated', supplier: mapSupplier(supplier) });
  } catch (err) {
    console.error('[pharmacy/suppliers] update', err);
    return res.status(500).json({ message: 'Failed to update supplier' });
  }
};

const deactivateSupplier = async (req, res) => {
  try {
    const existing = await prisma.pharmacySupplier.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Supplier not found' });

    const supplier = await prisma.pharmacySupplier.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE' },
    });

    return res.json({ message: 'Supplier deactivated', supplier: mapSupplier(supplier) });
  } catch (err) {
    console.error('[pharmacy/suppliers] deactivate', err);
    return res.status(500).json({ message: 'Failed to deactivate supplier' });
  }
};

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deactivateSupplier,
};
