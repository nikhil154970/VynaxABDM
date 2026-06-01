const { prisma } = require('../../config/prisma');

function normalizeString(v) {
  return String(v ?? '').trim();
}

function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toEndOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function deriveAvailability({ availableQty, lowStockThreshold = 5 }) {
  const qty = Number(availableQty || 0);
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (qty <= lowStockThreshold) return 'LOW_STOCK';
  return 'AVAILABLE';
}

function mapQueueRow(row) {
  return {
    id: row.id,
    tokenNumber: row.tokenNumber,
    status: row.status,
    sentAt: row.sentAt,
    billedBillId: row.billedBillId || null,
    prescriptionCount: row.items?.length || 0,
    patient: {
      id: row.patient?.id,
      name: row.patient?.name || '',
      uhid: row.patient?.uhid || '',
      mobile: row.patient?.mobile || '',
      age: row.patient?.age ?? null,
      gender: row.patient?.gender || null,
    },
    doctor: {
      id: row.doctor?.id || null,
      name: row.doctor?.user?.name || '',
      department: row.appointment?.department || '',
    },
    sentByReceptionist: {
      id: row.sentByReceptionist?.id,
      name: row.sentByReceptionist?.name || '',
    },
    items: (row.items || []).map((i) => ({
      id: i.id,
      medicineId: i.medicineId || null,
      medicineName: i.medicineName,
      dosage: i.dosage || '',
      frequency: i.frequency || '',
      duration: i.duration || '',
      quantity: i.quantity,
    })),
  };
}

async function attachInventoryAvailability(queue) {
  const medicineIds = [...new Set((queue.items || []).map((i) => i.medicineId).filter(Boolean))];
  if (!medicineIds.length) {
    queue.items = (queue.items || []).map((i) => ({
      ...i,
      inventory: { status: 'UNKNOWN', availableQty: 0 },
    }));
    return queue;
  }

  const batches = await prisma.pharmacyInventoryBatch.groupBy({
    by: ['medicineId'],
    where: { medicineId: { in: medicineIds }, status: 'ACTIVE' },
    _sum: { availableQty: true },
  });
  const byMed = new Map(batches.map((b) => [b.medicineId, Number(b._sum.availableQty || 0)]));

  queue.items = (queue.items || []).map((i) => {
    const availableQty = i.medicineId ? byMed.get(i.medicineId) ?? 0 : 0;
    const invStatus = i.medicineId ? deriveAvailability({ availableQty }) : 'UNKNOWN';
    return {
      ...i,
      inventory: {
        status: invStatus,
        availableQty,
      },
    };
  });

  return queue;
}

// GET /api/pharmacy/queue/summary
async function getQueueSummary(req, res) {
  try {
    const dateRaw = normalizeString(req.query.date);
    const day = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(day.getTime())) return res.status(400).json({ message: 'Invalid date' });
    const start = toStartOfDay(day);
    const end = toEndOfDay(day);

    const [waiting, inProgress, billedToday, pendingQueue] = await Promise.all([
      prisma.pharmacyQueue.count({ where: { status: 'WAITING' } }),
      prisma.pharmacyQueue.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.pharmacyQueue.count({ where: { status: 'BILLED', updatedAt: { gte: start, lte: end } } }),
      prisma.pharmacyQueue.count({ where: { status: { in: ['WAITING', 'IN_PROGRESS'] } } }),
    ]);

    return res.json({
      summary: { waiting, inProgress, billedToday, pendingQueue },
      date: start.toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error('[pharmacy/queue] summary', err);
    return res.status(500).json({ message: 'Failed to fetch queue summary' });
  }
}

// GET /api/pharmacy/queue
async function listQueue(req, res) {
  try {
    const q = normalizeString(req.query.q).toLowerCase();
    const statusRaw = normalizeString(req.query.status).toUpperCase();
    const status = ['WAITING', 'IN_PROGRESS', 'BILLED'].includes(statusRaw) ? statusRaw : null;
    const dateRaw = normalizeString(req.query.date);
    const day = dateRaw ? new Date(dateRaw) : null;
    if (dateRaw && Number.isNaN(day.getTime())) return res.status(400).json({ message: 'Invalid date' });

    const page = Math.max(1, safeInt(req.query.page, 1));
    const limit = Math.min(50, Math.max(10, safeInt(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    const dayRange = day ? { gte: toStartOfDay(day), lte: toEndOfDay(day) } : null;

    const where = {
      ...(status ? { status } : {}),
      ...(dayRange ? { sentAt: dayRange } : {}),
      ...(q
        ? {
            OR: [
              { tokenNumber: { contains: q, mode: 'insensitive' } },
              { patient: { name: { contains: q, mode: 'insensitive' } } },
              { patient: { uhid: { contains: q, mode: 'insensitive' } } },
              { patient: { mobile: { contains: q } } },
            ],
          }
        : {}),
    };

    const include = {
      patient: { select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true } },
      doctor: { select: { id: true, user: { select: { name: true } } } },
      appointment: { select: { id: true, department: true } },
      sentByReceptionist: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: 'asc' } },
    };

    const [total, rows] = await Promise.all([
      prisma.pharmacyQueue.count({ where }),
      prisma.pharmacyQueue.findMany({
        where,
        include,
        orderBy: [{ status: 'asc' }, { sentAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return res.json({
      page,
      limit,
      total,
      items: rows.map(mapQueueRow),
    });
  } catch (err) {
    console.error('[pharmacy/queue] list', err);
    return res.status(500).json({ message: 'Failed to fetch pharmacy queue' });
  }
}

// GET /api/pharmacy/queue/:id
async function getQueueById(req, res) {
  try {
    const id = normalizeString(req.params.id);
    const row = await prisma.pharmacyQueue.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
        appointment: { select: { id: true, department: true, token: true } },
        sentByReceptionist: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) return res.status(404).json({ message: 'Queue entry not found' });

    const withInv = await attachInventoryAvailability(mapQueueRow(row));
    return res.json({ item: withInv });
  } catch (err) {
    console.error('[pharmacy/queue] get', err);
    return res.status(500).json({ message: 'Failed to fetch queue entry' });
  }
}

// POST /api/pharmacy/queue  (RECEPTIONIST only)
async function createQueueEntry(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Access token required' });

    const body = req.body || {};
    const patientId = normalizeString(body.patientId);
    const appointmentId = normalizeString(body.appointmentId);
    const prescriptionId = normalizeString(body.prescriptionId);
    const doctorId = normalizeString(body.doctorId);
    const tokenNumber = normalizeString(body.tokenNumber);
    const sentAtRaw = body.sentAt;
    const sentAt = sentAtRaw ? new Date(sentAtRaw) : new Date();
    if (!patientId) return res.status(400).json({ message: 'patientId is required' });
    if (!tokenNumber) return res.status(400).json({ message: 'tokenNumber is required' });
    if (Number.isNaN(sentAt.getTime())) return res.status(400).json({ message: 'sentAt must be a valid date' });

    const itemsRaw = Array.isArray(body.items) ? body.items : [];
    if (!itemsRaw.length) return res.status(400).json({ message: 'At least one medicine is required' });

    const items = itemsRaw
      .map((r) => ({
        medicineId: normalizeString(r.medicineId) || null,
        medicineName: normalizeString(r.medicineName),
        dosage: normalizeString(r.dosage) || null,
        frequency: normalizeString(r.frequency) || null,
        duration: normalizeString(r.duration) || null,
        quantity: Math.max(1, safeInt(r.quantity, 1)),
      }))
      .filter((r) => r.medicineName);

    if (!items.length) return res.status(400).json({ message: 'At least one valid medicine is required' });

    const entry = await prisma.pharmacyQueue.create({
      data: {
        patientId,
        appointmentId: appointmentId || null,
        prescriptionId: prescriptionId || null,
        doctorId: doctorId || null,
        sentByReceptionistId: userId,
        tokenNumber,
        sentAt,
        status: 'WAITING',
        items: {
          create: items.map((i) => ({
            medicineId: i.medicineId,
            medicineName: i.medicineName,
            dosage: i.dosage,
            frequency: i.frequency,
            duration: i.duration,
            quantity: i.quantity,
          })),
        },
      },
      include: {
        patient: { select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
        appointment: { select: { id: true, department: true } },
        sentByReceptionist: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    });

    return res.status(201).json({ item: mapQueueRow(entry) });
  } catch (err) {
    // Unique tokenNumber clash
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'Patient already in pharmacy queue for this token number' });
    }
    console.error('[pharmacy/queue] create', err);
    return res.status(500).json({ message: err?.message || 'Failed to create queue entry' });
  }
}

// PUT /api/pharmacy/queue/:id/in-progress
async function markInProgress(req, res) {
  try {
    const id = normalizeString(req.params.id);
    const existing = await prisma.pharmacyQueue.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) return res.status(404).json({ message: 'Queue entry not found' });
    if (existing.status === 'BILLED') return res.status(400).json({ message: 'Already billed' });

    const updated = await prisma.pharmacyQueue.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
    return res.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error('[pharmacy/queue] in-progress', err);
    return res.status(500).json({ message: 'Failed to update queue status' });
  }
}

// PUT /api/pharmacy/queue/:id/billed
async function markBilled(req, res) {
  try {
    const id = normalizeString(req.params.id);
    const billId = normalizeString(req.body?.billId);
    const existing = await prisma.pharmacyQueue.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) return res.status(404).json({ message: 'Queue entry not found' });

    const updated = await prisma.pharmacyQueue.update({
      where: { id },
      data: {
        status: 'BILLED',
        ...(billId ? { billedBillId: billId } : {}),
      },
    });
    return res.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error('[pharmacy/queue] billed', err);
    return res.status(500).json({ message: 'Failed to update queue status' });
  }
}

module.exports = {
  getQueueSummary,
  listQueue,
  getQueueById,
  createQueueEntry,
  markInProgress,
  markBilled,
};

