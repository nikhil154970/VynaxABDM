const { prisma } = require('../../../config/prisma');

const LEGACY_WARD_NAME = 'Default Ward (temporary)';

function normalizeString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
}

function normalizeWardType(v) {
  const s = normalizeString(v).toUpperCase();
  if (!s) return null;
  if (s === 'ICU') return 'ICU';
  if (s === 'PRIVATE') return 'PRIVATE';
  if (s === 'GENERAL') return 'GENERAL';
  return null;
}

function normalizeBedStatus(v) {
  const s = normalizeString(v).toUpperCase();
  if (!s) return null;
  if (s === 'AVAILABLE') return 'AVAILABLE';
  if (s === 'OCCUPIED') return 'OCCUPIED';
  if (s === 'MAINTENANCE') return 'MAINTENANCE';
  return null;
}

async function releaseExpiredMaintenanceBeds() {
  const nowIso = new Date().toISOString();
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Bed"
       SET "status" = 'AVAILABLE', "maintenanceUntil" = NULL
       WHERE "status" = 'MAINTENANCE' AND "maintenanceUntil" IS NOT NULL AND "maintenanceUntil" <= '${nowIso}'`,
    );
  } catch {
    // Ignore when column is unavailable in older schema.
  }
}

async function listWards(req, res) {
  const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
  const includeLegacy = String(req.query.includeLegacy || '').toLowerCase() === 'true';
  const wards = await prisma.ward.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(includeLegacy ? {} : { name: { not: LEGACY_WARD_NAME } }),
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, type: true, isActive: true, createdAt: true, _count: { select: { beds: true } } },
  });
  return res.json({
    items: wards.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      isActive: w.isActive,
      createdAt: w.createdAt,
      bedCount: w._count?.beds ?? 0,
    })),
  });
}

async function createWard(req, res) {
  const name = normalizeString(req.body?.name);
  const type = normalizeWardType(req.body?.type) || 'GENERAL';
  if (!name) return res.status(400).json({ message: 'name is required' });
  try {
    const ward = await prisma.ward.create({
      data: { name, type, isActive: true },
      select: { id: true, name: true, type: true, isActive: true, createdAt: true },
    });
    return res.status(201).json({ ward });
  } catch (e) {
    if (String(e?.code || '') === 'P2002') return res.status(409).json({ message: 'Ward name already exists' });
    return res.status(500).json({ message: 'Failed to create ward' });
  }
}

async function updateWard(req, res) {
  const id = normalizeString(req.params.id);
  const name = req.body?.name != null ? normalizeString(req.body.name) : undefined;
  const type = req.body?.type != null ? normalizeWardType(req.body.type) : undefined;
  const isActive = req.body?.isActive != null ? Boolean(req.body.isActive) : undefined;

  if (!id) return res.status(400).json({ message: 'Ward id is required' });
  if (name !== undefined && !name) return res.status(400).json({ message: 'name cannot be empty' });
  if (type !== undefined && !type) return res.status(400).json({ message: 'Invalid ward type' });

  try {
    const ward = await prisma.ward.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : null),
        ...(type !== undefined ? { type } : null),
        ...(isActive !== undefined ? { isActive } : null),
      },
      select: { id: true, name: true, type: true, isActive: true, createdAt: true },
    });
    return res.json({ ward });
  } catch (e) {
    if (String(e?.code || '') === 'P2025') return res.status(404).json({ message: 'Ward not found' });
    if (String(e?.code || '') === 'P2002') return res.status(409).json({ message: 'Ward name already exists' });
    return res.status(500).json({ message: 'Failed to update ward' });
  }
}

async function listBeds(req, res) {
  await releaseExpiredMaintenanceBeds();
  const wardId = normalizeString(req.query.wardId);
  const includeInactiveWards = String(req.query.includeInactiveWards || '').toLowerCase() === 'true';
  const status = normalizeBedStatus(req.query.status);
  const includeLegacy = String(req.query.includeLegacy || '').toLowerCase() === 'true';

  const where = {};
  if (wardId) where.wardId = wardId;
  if (status) where.status = status;
  if (!includeInactiveWards) where.ward = { isActive: true };
  if (!includeLegacy) {
    where.NOT = [
      { code: { startsWith: 'DW-' } },
      { ward: { name: LEGACY_WARD_NAME } },
    ];
  }

  const beds = await prisma.bed.findMany({
    where,
    orderBy: [{ ward: { type: 'asc' } }, { ward: { name: 'asc' } }, { code: 'asc' }],
    select: {
      id: true,
      code: true,
      status: true,
      createdAt: true,
      wardId: true,
      ward: { select: { name: true, type: true, isActive: true } },
    },
  });

  return res.json({
    items: beds.map((b) => ({
      id: b.id,
      code: b.code,
      status: b.status,
      maintenanceUntil: null,
      createdAt: b.createdAt,
      wardId: b.wardId,
      wardName: b.ward?.name || '',
      wardType: b.ward?.type || 'GENERAL',
      wardIsActive: Boolean(b.ward?.isActive),
    })),
  });
}

async function createBed(req, res) {
  const wardId = normalizeString(req.body?.wardId);
  const code = normalizeString(req.body?.code);
  if (!wardId) return res.status(400).json({ message: 'wardId is required' });
  if (!code) return res.status(400).json({ message: 'code is required' });
  try {
    const bed = await prisma.bed.create({
      data: { wardId, code, status: 'AVAILABLE' },
      select: { id: true, code: true, status: true, wardId: true, createdAt: true },
    });
    return res.status(201).json({ bed });
  } catch (e) {
    if (String(e?.code || '') === 'P2002') return res.status(409).json({ message: 'Bed code already exists' });
    return res.status(500).json({ message: 'Failed to create bed' });
  }
}

async function updateBed(req, res) {
  await releaseExpiredMaintenanceBeds();
  const id = normalizeString(req.params.id);
  const code = req.body?.code != null ? normalizeString(req.body.code) : undefined;
  const wardId = req.body?.wardId != null ? normalizeString(req.body.wardId) : undefined;
  const status = req.body?.status != null ? normalizeBedStatus(req.body.status) : undefined;

  if (!id) return res.status(400).json({ message: 'Bed id is required' });
  if (code !== undefined && !code) return res.status(400).json({ message: 'code cannot be empty' });
  if (status !== undefined && !status) return res.status(400).json({ message: 'Invalid bed status' });

  const existing = await prisma.bed.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) return res.status(404).json({ message: 'Bed not found' });
  if (existing.status === 'OCCUPIED' && (status === 'AVAILABLE' || status === 'MAINTENANCE')) {
    // allow changing occupied bed status only via discharge/transfer workflows
    return res.status(409).json({ message: 'Cannot change status of an occupied bed from admin' });
  }

  try {
    const bed = await prisma.bed.update({
      where: { id },
      data: {
        ...(code !== undefined ? { code } : null),
        ...(wardId !== undefined ? { wardId } : null),
        ...(status !== undefined ? { status } : null),
      },
      select: { id: true, code: true, status: true, wardId: true, createdAt: true },
    });
    return res.json({ bed });
  } catch (e) {
    if (String(e?.code || '') === 'P2002') return res.status(409).json({ message: 'Bed code already exists' });
    return res.status(500).json({ message: 'Failed to update bed' });
  }
}

async function deleteBed(req, res) {
  const id = normalizeString(req.params.id);
  if (!id) return res.status(400).json({ message: 'Bed id is required' });

  const bed = await prisma.bed.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!bed) return res.status(404).json({ message: 'Bed not found' });
  if (bed.status === 'OCCUPIED') return res.status(409).json({ message: 'Cannot delete an occupied bed' });

  const [admissionRefs, transferFromRefs, transferToRefs] = await Promise.all([
    prisma.admission.count({ where: { bedId: id } }),
    prisma.bedTransfer.count({ where: { fromBedId: id } }),
    prisma.bedTransfer.count({ where: { toBedId: id } }),
  ]);
  const hasRefs = admissionRefs + transferFromRefs + transferToRefs > 0;
  if (hasRefs) {
    return res.status(409).json({ message: 'Cannot delete bed because it is referenced by IPD records' });
  }

  await prisma.bed.delete({ where: { id } });
  return res.json({ ok: true });
}

module.exports = {
  listWards,
  createWard,
  updateWard,
  listBeds,
  createBed,
  updateBed,
  deleteBed,
};

