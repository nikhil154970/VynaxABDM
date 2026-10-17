const { prisma } = require('../../../config/prisma');
const { emitAbdmClinicalEvent, EVENT } = require('../../abdm/lib/abdmHealthRecord');
const { createPendingAllocationRequest, createApprovedAllocationWithAssignment } = require('../../../lib/allocationWorkflow');
const { triggerCriticalAlert } = require('../../../lib/notificationHelpers');
const { canUserAssignNurse, getUserCurrentShiftType } = require('../../../lib/shiftHelpers');
const {
  applyAyushmanAdmissionBilling,
  getLatestPatientSponsor,
} = require('../../../utils/ayushmanBilling');
const { syncHospitalBedMasters } = require('../../../lib/hospitalBedMaster');

let bedMasterEnsured = false;
let bedMasterEnsuring = null;

// Keep bed stats consistent with admin/beds modules: ignore legacy DW-* beds + legacy ward.
const LEGACY_WARD_NAME = 'Default Ward (temporary)';

function bedStatsWhereBase() {
  return {
    ward: { isActive: true },
    NOT: [{ code: { startsWith: 'DW-' } }, { ward: { name: LEGACY_WARD_NAME } }],
  };
}

function normalizeString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
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

function parseDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeAdmissionStatus(v) {
  const s = normalizeString(v).toUpperCase().replace(/\s+/g, '_');
  if (!s) return null;
  if (s === 'ADMITTED') return 'ADMITTED';
  if (s === 'UNDER_TREATMENT') return 'UNDER_TREATMENT';
  if (s === 'READY_FOR_DISCHARGE') return 'READY_FOR_DISCHARGE';
  if (s === 'DISCHARGE_REQUESTED') return 'DISCHARGE_REQUESTED';
  return null;
}

/** Open IPD stays — excludes discharged rows (READY_FOR_DISCHARGE + dischargeDate). */
const OPEN_ADMISSION_STATUSES = ['ADMITTED', 'UNDER_TREATMENT', 'DISCHARGE_REQUESTED'];

function isOpenAdmissionWhere(extra = {}) {
  return {
    ...extra,
    dischargeDate: null,
    status: { in: OPEN_ADMISSION_STATUSES },
  };
}

function buildAdmissionNotesText({ diagnosis, notes, expectedStay }) {
  const parts = [];
  const dx = normalizeString(diagnosis);
  if (dx) parts.push(`Diagnosis: ${dx}`);
  const n = normalizeString(notes);
  if (n) parts.push(`Notes: ${n}`);
  const stay = normalizeString(expectedStay);
  if (stay) parts.push(`Expected stay (days): ${stay}`);
  return parts.length ? parts.join('\n') : null;
}

async function clearReferAdmitForPatient(tx, patientId) {
  if (!patientId) return;
  await tx.consultation.updateMany({
    where: { patientId, disposition: 'REFER_ADMIT' },
    data: { disposition: 'NORMAL' },
  });
}

function admissionStatusLabel(v) {
  const s = String(v || '').toUpperCase();
  if (s === 'ADMITTED') return 'Admitted';
  if (s === 'UNDER_TREATMENT') return 'Under Treatment';
  if (s === 'READY_FOR_DISCHARGE') return 'Ready for Discharge';
  if (s === 'DISCHARGE_REQUESTED') return 'Discharge Requested';
  return s || 'Admitted';
}

function visitStatusForAdmission(admStatus) {
  const s = String(admStatus || '').toUpperCase();
  if (s === 'READY_FOR_DISCHARGE') return 'ACTIVE';
  if (s === 'DISCHARGE_REQUESTED') return 'ACTIVE';
  if (s === 'UNDER_TREATMENT') return 'ACTIVE';
  return 'ADMITTED';
}

function ymdFromDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

async function releaseExpiredMaintenanceBeds(txOrPrisma = prisma) {
  const nowIso = new Date().toISOString();
  try {
    await txOrPrisma.$executeRawUnsafe(
      `UPDATE "Bed"
       SET "status" = 'AVAILABLE', "maintenanceUntil" = NULL
       WHERE "status" = 'MAINTENANCE' AND "maintenanceUntil" IS NOT NULL AND "maintenanceUntil" <= '${nowIso}'`,
    );
  } catch {
    // Older schemas without maintenance window should not break flows.
  }
}

/** Short readable label for old rows created before `ipdNumber` existed. */
function legacyIpdNumber(id, admissionDate, createdAt) {
  const when = admissionDate || createdAt || new Date();
  const ymd = ymdFromDate(when) || ymdFromDate(new Date());
  const hex = String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase();
  return `IPD-${ymd}-${hex}`;
}

function resolvedIpdNumber(row) {
  const n = normalizeString(row?.ipdNumber);
  if (n) return n;
  return legacyIpdNumber(row.id, row.admissionDate, row.createdAt);
}

let admissionSupportsAssignedNurseCache;
function admissionSupportsAssignedNurse() {
  if (typeof admissionSupportsAssignedNurseCache === 'boolean') return admissionSupportsAssignedNurseCache;
  try {
    const fields = prisma?._runtimeDataModel?.models?.Admission?.fields || [];
    admissionSupportsAssignedNurseCache = fields.some((f) => f?.name === 'nurseId');
  } catch {
    admissionSupportsAssignedNurseCache = false;
  }
  return admissionSupportsAssignedNurseCache;
}

async function allocateNextIpdNumber(tx, admissionDate) {
  const dayStart = toStartOfDay(admissionDate);
  const ymd = ymdFromDate(dayStart);
  if (!ymd) throw new Error('IPD_DATE_INVALID');
  const prefix = `IPD-${ymd}-`;
  // One query — avoids dozens of round-trips inside $transaction (Neon / interactive tx timeouts).
  const agg = await tx.admission.aggregate({
    where: { ipdNumber: { startsWith: prefix } },
    _max: { ipdNumber: true },
  });
  let next = 1;
  const maxStr = agg._max.ipdNumber;
  if (maxStr && String(maxStr).startsWith(prefix)) {
    const tail = String(maxStr).slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  if (next > 9999) throw new Error('IPD_NUMBER_EXHAUSTED');
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/**
 * Ensure hospital bed master exists.
 *
 * Frontend bed tracker uses human-friendly codes (e.g. "ICU1", "G/W 4", "PVT 1").
 * We keep the same code in DB so allocation/transfer/search stays consistent.
 */
async function ensureHospitalBedMaster() {
  if (bedMasterEnsured) return;
  if (bedMasterEnsuring) return bedMasterEnsuring;

  bedMasterEnsuring = (async () => {
  // Remove legacy temporary ward + DW beds (created earlier for testing).
  // Delete only if not referenced by admissions/transfers.
  const legacy = await prisma.ward.findFirst({
    where: { name: 'Default Ward (temporary)' },
    select: { id: true },
  });
  if (legacy?.id) {
    try {
      const legacyBeds = await prisma.bed.findMany({
        where: { wardId: legacy.id },
        select: { id: true, code: true },
      });
      const legacyBedIds = legacyBeds.map((b) => b.id);

      const [admissionRefs, transferFromRefs, transferToRefs] = await Promise.all([
        legacyBedIds.length ? prisma.admission.count({ where: { bedId: { in: legacyBedIds } } }) : 0,
        legacyBedIds.length ? prisma.bedTransfer.count({ where: { fromBedId: { in: legacyBedIds } } }) : 0,
        legacyBedIds.length ? prisma.bedTransfer.count({ where: { toBedId: { in: legacyBedIds } } }) : 0,
      ]);

      const hasRefs = admissionRefs + transferFromRefs + transferToRefs > 0;
      if (!hasRefs) {
        await prisma.$transaction(async (tx) => {
          await tx.bed.deleteMany({ where: { wardId: legacy.id } });
          await tx.ward.delete({ where: { id: legacy.id } });
        });
      } else {
        // If referenced, keep DB integrity: just deactivate the ward and hide it from receptionist listings.
        await prisma.ward.update({ where: { id: legacy.id }, data: { isActive: false } });
      }
    } catch {
      // ignore cleanup errors
    }
  }

  await syncHospitalBedMasters(prisma);

  bedMasterEnsured = true;
  bedMasterEnsuring = null;
  })()
    .catch((e) => {
      bedMasterEnsuring = null;
      throw e;
    });

  return bedMasterEnsuring;
}

async function listWards(req, res) {
  await ensureHospitalBedMaster();
  const wards = await prisma.ward.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, type: true, isActive: true },
  });
  return res.json({ items: wards });
}

async function listBeds(req, res) {
  await releaseExpiredMaintenanceBeds(prisma);
  await ensureHospitalBedMaster();
  const wardId = normalizeString(req.query.wardId);
  const status = normalizeString(req.query.status).toUpperCase();
  const where = { ward: { isActive: true } };
  if (wardId) where.wardId = wardId;
  if (status && ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'].includes(status)) where.status = status;
  const beds = await prisma.bed.findMany({
    where,
    orderBy: [{ ward: { name: 'asc' } }, { code: 'asc' }],
    select: {
      id: true,
      code: true,
      status: true,
      wardId: true,
      ward: { select: { name: true, type: true } },
    },
  });
  return res.json({
    items: beds.map((b) => ({
      id: b.id,
      code: b.code,
      status: b.status,
      maintenanceUntil: null,
      wardId: b.wardId,
      wardName: b.ward?.name || '',
      wardType: b.ward?.type || 'GENERAL',
    })),
  });
}

async function updateBedStatus(req, res) {
  const id = normalizeString(req.params.id);
  const next = normalizeString(req.body?.status).toUpperCase();
  if (!id) return res.status(400).json({ message: 'Bed id is required' });
  if (!['AVAILABLE', 'MAINTENANCE'].includes(next)) {
    return res.status(400).json({ message: 'status must be AVAILABLE or MAINTENANCE' });
  }

  const bed = await prisma.bed.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!bed) return res.status(404).json({ message: 'Bed not found' });
  if (bed.status === 'OCCUPIED') return res.status(409).json({ message: 'Cannot change status of an occupied bed' });

  const updated = await prisma.bed.update({
    where: { id },
    data: { status: next },
    select: { id: true, code: true, status: true, wardId: true },
  });
  return res.json({ bed: updated });
}

async function listNurseLookup(req, res) {
  const q = normalizeString(req.query.q).toLowerCase();
  const rows = await prisma.user.findMany({
    where: { role: 'NURSE', isActive: true },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, email: true },
    take: 200,
  });
  const items = rows
    .map((n) => ({ id: n.id, name: n.name || '', email: n.email || '' }))
    .filter((n) => (q ? `${n.name} ${n.email}`.toLowerCase().includes(q) : true));
  return res.json({ items });
}

async function listActiveAdmissions(req, res) {
  await releaseExpiredMaintenanceBeds(prisma);
  const q = normalizeString(req.query.q).toLowerCase();
  const wardId = normalizeString(req.query.wardId);
  const department = normalizeString(req.query.department);
  const doctorId = normalizeString(req.query.doctorId);
  const status = normalizeAdmissionStatus(req.query.status);

  const where = isOpenAdmissionWhere();
  if (status) where.status = status;
  if (wardId) where.wardId = wardId;
  if (department && department.toLowerCase() !== 'all') where.department = department;
  if (doctorId && doctorId.toLowerCase() !== 'all') where.doctorId = doctorId;
  if (q) {
    where.AND = [
      {
        OR: [
          { ipdNumber: { contains: q, mode: 'insensitive' } },
          {
            patient: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { uhid: { contains: q, mode: 'insensitive' } },
                { mobile: { contains: q } },
              ],
            },
          },
        ],
      },
    ];
  }

  const [patients, totalBeds, occupiedBeds] = await Promise.all([
    prisma.admission.findMany({
      where,
      orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      select: {
        id: true,
        ipdNumber: true,
        admissionDate: true,
        status: true,
        department: true,
        admissionType: true,
        bedNumber: true,
        ward: { select: { name: true, type: true } },
        bed: { select: { code: true } },
        patientId: true,
        doctorId: true,
        patient: { select: { id: true, uhid: true, name: true, mobile: true, age: true, gender: true, bloodGroup: true } },
        doctor: { select: { id: true, user: { select: { name: true } } } },
        ...(admissionSupportsAssignedNurse()
          ? {
              nurse: { select: { name: true, email: true } },
            }
          : {}),
        billing: { select: { admissionCharge: true, roomChargePerDay: true, advance: true } },
        createdAt: true,
      },
    }),
    prisma.bed.count({ where: bedStatsWhereBase() }),
    prisma.bed.count({ where: { ...bedStatsWhereBase(), status: 'OCCUPIED' } }),
  ]);

  return res.json({
    bedStats: { totalBeds, occupiedBeds },
    patients: patients.map((a) => {
      const bill = a.billing || {};
      const admissionDate = a.admissionDate ? new Date(a.admissionDate) : null;
      const daysSinceAdmission = admissionDate
        ? Math.max(1, Math.floor((Date.now() - admissionDate.getTime()) / 86400000))
        : 1;
      const admissionCharge = Number(bill.admissionCharge) || 0;
      const roomTariffPerDay = Number(bill.roomChargePerDay) || 0;
      const advancePaid = Number(bill.advance) || 0;
      const estRoomCharge = roomTariffPerDay * daysSinceAdmission;
      const estimatedBillTotal = admissionCharge + estRoomCharge;
      const billingPending = Math.max(0, estimatedBillTotal - advancePaid);

      return {
        id: a.id,
        patientId: a.patientId,
        doctorId: a.doctorId,
        ipdNumber: resolvedIpdNumber(a),
        uhid: a.patient?.uhid || null,
        name: a.patient?.name || '',
        mobile: a.patient?.mobile || '',
        age: a.patient?.age ?? null,
        gender: a.patient?.gender ? String(a.patient.gender) : '',
        ward: a.ward?.type === 'ICU' ? 'ICU' : a.ward?.type === 'PRIVATE' ? 'Private' : 'General',
        wardName: a.ward?.name || '',
        bed: a.bed?.code || a.bedNumber || '',
        doctor: a.doctor?.user?.name || '',
        nurse: admissionSupportsAssignedNurse() ? (a.nurse?.name || a.nurse?.email || '') : '',
        department: a.department || '',
        admissionDate: a.admissionDate,
        status: admissionStatusLabel(a.status),
        billingPending,
        bloodGroup: a.patient?.bloodGroup || '',
        roomTariffPerDay: roomTariffPerDay || null,
      };
    }),
  });
}

async function listPendingDoctorReferrals(req, res) {
  const q = normalizeString(req.query.q).toLowerCase();

  const consults = await prisma.consultation.findMany({
    where: { disposition: 'REFER_ADMIT' },
    orderBy: [{ createdAt: 'desc' }],
    take: 300,
    select: {
      id: true,
      createdAt: true,
      diagnosis: true,
      symptoms: true,
      suggestedWardType: true,
      patientId: true,
      patient: { select: { id: true, uhid: true, name: true, mobile: true, age: true, gender: true } },
      doctor: { select: { id: true, user: { select: { name: true } } } },
      appointment: { select: { id: true, department: true } },
    },
  });

  // Keep latest referral per patient.
  const latestByPatient = new Map();
  for (const c of consults) {
    if (!c.patientId || latestByPatient.has(c.patientId)) continue;
    latestByPatient.set(c.patientId, c);
  }

  const rows = Array.from(latestByPatient.values());
  const patientIds = rows.map((r) => r.patientId).filter(Boolean);

  const referByByPatient = new Map();
  if (patientIds.length) {
    const visits = await prisma.receptionVisit.findMany({
      where: { patientId: { in: patientIds } },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      select: { patientId: true, referBy: true },
    });
    for (const v of visits) {
      if (!v.patientId || referByByPatient.has(v.patientId)) continue;
      const referBy = normalizeString(v.referBy) || '';
      if (!referBy) continue;
      referByByPatient.set(v.patientId, referBy);
    }
  }

  // Exclude patients already in IPD or who were admitted from this referral.
  const admissionsForPatients = patientIds.length
    ? await prisma.admission.findMany({
        where: { patientId: { in: patientIds } },
        select: { patientId: true, createdAt: true },
      })
    : [];
  const activeAdmissions = patientIds.length
    ? await prisma.admission.findMany({
        where: isOpenAdmissionWhere({ patientId: { in: patientIds } }),
        select: { patientId: true },
      })
    : [];
  const activeSet = new Set(activeAdmissions.map((a) => a.patientId));

  const referralFulfilled = (patientId, referralAt) => {
    const refMs = referralAt ? new Date(referralAt).getTime() : 0;
    return admissionsForPatients.some(
      (a) => a.patientId === patientId && new Date(a.createdAt).getTime() >= refMs,
    );
  };

  const items = rows
    .filter((r) => !activeSet.has(r.patientId) && !referralFulfilled(r.patientId, r.createdAt))
    .map((r) => ({
      referralId: r.id,
      consultationId: r.id,
      patientId: r.patient?.id || r.patientId,
      uhid: r.patient?.uhid || '',
      name: r.patient?.name || '',
      mobile: r.patient?.mobile || '',
      age: r.patient?.age ?? null,
      gender: r.patient?.gender ? String(r.patient.gender) : '',
      department: r.appointment?.department || '',
      doctorId: r.doctor?.id || null,
      referringDoctor: r.doctor?.user?.name || '',
      consultantBy: r.doctor?.user?.name || '',
      referBy: referByByPatient.get(r.patientId) || '',
      provisionalDiagnosis: r.diagnosis || '',
      clinicalNote: r.symptoms || '',
      requestedAt: r.createdAt,
      suggestedWardType: r.suggestedWardType ? String(r.suggestedWardType) : null,
      suggestedAdmissionType:
        String(r.suggestedWardType || '').toUpperCase() === 'ICU'
          ? 'ICU'
          : String(r.suggestedWardType || '').toUpperCase() === 'PRIVATE'
            ? 'Private Room'
            : 'General Ward',
    }))
    .filter((r) => {
      if (!q) return true;
      const blob = `${r.name} ${r.uhid} ${r.mobile} ${r.department} ${r.referringDoctor} ${r.referBy} ${r.provisionalDiagnosis}`.toLowerCase();
      return blob.includes(q);
    });

  return res.json({ items });
}

async function fulfillDoctorReferral(req, res) {
  const id = normalizeString(req.params.id);
  if (!id) return res.status(400).json({ message: 'Referral id is required' });

  const consult = await prisma.consultation.findUnique({
    where: { id },
    select: { id: true, disposition: true },
  });
  if (!consult) return res.status(404).json({ message: 'Referral not found' });
  if (String(consult.disposition || '').toUpperCase() !== 'REFER_ADMIT') {
    return res.json({ ok: true, alreadyFulfilled: true });
  }

  await prisma.consultation.update({
    where: { id },
    data: { disposition: 'NORMAL' },
  });
  return res.json({ ok: true });
}

function wardCategoryShort(wardType) {
  const v = String(wardType || '').toUpperCase();
  if (v === 'ICU') return 'ICU';
  if (v === 'PRIVATE') return 'Private';
  return 'General';
}

function wardDisplayLine(ward) {
  if (!ward) return '';
  const cat = wardCategoryShort(ward.type);
  const name = normalizeString(ward.name);
  return name ? `${name} (${cat})` : cat;
}

async function listNurseApprovedDischargeQueue(req, res) {
  await releaseExpiredMaintenanceBeds(prisma);
  const rows = await prisma.admission.findMany({
    where: {
      status: 'DISCHARGE_REQUESTED',
      dischargeDate: null,
    },
    orderBy: [{ dischargeRequestedAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      patientId: true,
      dischargeRequestedAt: true,
      patient: { select: { id: true, name: true, uhid: true } },
      ward: { select: { name: true, type: true } },
      bed: { select: { code: true } },
      nurse: { select: { name: true, email: true } },
      doctor: { select: { user: { select: { name: true } } } },
    },
  });

  const items = rows.map((a) => ({
    id: a.id,
    patientId: a.patient?.id || a.patientId || '',
    name: a.patient?.name || '',
    uhid: a.patient?.uhid || '',
    ward: wardDisplayLine(a.ward),
    bed: a.bed?.code || '—',
    dischargeApproved: true,
    approvedBy: a.nurse?.name || a.nurse?.email || '—',
    approvalTime: a.dischargeRequestedAt,
    doctor: a.doctor?.user?.name || '',
  }));

  return res.json({ items });
}

/**
 * Past IPD discharges (reception finalized: dischargeDate set).
 * Bill totals = IPD bills for this admission only; pending = current unpaid on those bills.
 */
async function listDischargeHistory(req, res) {
  try {
    const qRaw = normalizeString(req.query.q);
    const doctorId = normalizeString(req.query.doctorId);
    const fromD = parseDateOnly(req.query.fromDate);
    const toD = parseDateOnly(req.query.toDate);

    const page = Number.isFinite(Number(req.query.page)) ? Math.max(1, Math.trunc(Number(req.query.page))) : 1;
    const limit = Number.isFinite(Number(req.query.limit)) ? Math.min(200, Math.max(1, Math.trunc(Number(req.query.limit)))) : 100;
    const skip = (page - 1) * limit;

    /** @type {import('@prisma/client').Prisma.AdmissionWhereInput} */
    const where = {
      dischargeDate: {
        not: null,
        ...(fromD ? { gte: toStartOfDay(fromD) } : {}),
        ...(toD ? { lte: toEndOfDay(toD) } : {}),
      },
      ...(doctorId ? { doctorId } : {}),
      ...(qRaw
        ? {
            OR: [
              { patient: { name: { contains: qRaw, mode: 'insensitive' } } },
              { patient: { uhid: { contains: qRaw, mode: 'insensitive' } } },
              { ipdNumber: { contains: qRaw, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows, doctorIdGroups] = await Promise.all([
      prisma.admission.count({ where }),
      prisma.admission.findMany({
        where,
        orderBy: [{ dischargeDate: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          dischargeDate: true,
          dischargeSummaryData: true,
          bedNumber: true,
          patient: { select: { name: true, uhid: true } },
          doctor: { include: { user: { select: { name: true } } } },
          ...(admissionSupportsAssignedNurse() ? { nurse: { select: { name: true, email: true } } } : {}),
          ward: { select: { name: true, type: true } },
          bed: { select: { code: true } },
          bills: {
            where: { NOT: { status: 'CANCELLED' } },
            select: { totalAmount: true, paidAmount: true, status: true },
          },
        },
      }),
      prisma.admission.groupBy({
        by: ['doctorId'],
        /** doctorId is required on Admission — do not use `{ not: null }` on UUID (Prisma 6 rejects `not: null`). */
        where: { dischargeDate: { not: null } },
      }),
    ]);

    const doctorIds = doctorIdGroups.map((r) => r.doctorId).filter(Boolean);
    const doctors =
      doctorIds.length > 0
        ? await prisma.doctor.findMany({
            where: { id: { in: doctorIds } },
            include: { user: { select: { name: true } } },
          })
        : [];
    doctors.sort((a, b) => String(a.user?.name || '').localeCompare(String(b.user?.name || ''), undefined, { sensitivity: 'base' }));

    const doctorOptions = doctors.map((d) => ({
      id: d.id,
      name: d.user?.name || 'Doctor',
    }));

    const items = rows.map((a) => {
      const bills = a.bills || [];
      const pendingTotal = bills.reduce((s, b) => s + billPendingAmount(b), 0);
      const totalBill = bills.reduce((s, b) => s + Math.max(0, Number(b.totalAmount) || 0), 0);
      const paidBill = Math.max(0, totalBill - pendingTotal);
      const dischargeStatus = pendingTotal > 0 ? 'Discharged with Dues' : 'Discharged';
      const wardLabel = normalizeString(a.ward?.name) || wardCategoryShort(a.ward?.type);
      const bedCode = normalizeString(a.bed?.code) || normalizeString(a.bedNumber) || '—';
      const nurseApprovedBy = admissionSupportsAssignedNurse()
        ? normalizeString(a.nurse?.name) || normalizeString(a.nurse?.email) || '—'
        : '—';

      return {
        id: a.id,
        name: a.patient?.name || '',
        uhid: a.patient?.uhid || '',
        ward: wardLabel,
        bed: bedCode,
        doctor: a.doctor?.user?.name || '—',
        nurseApprovedBy,
        dischargedAt: a.dischargeDate ? a.dischargeDate.toISOString() : null,
        dischargeStatus,
        dischargeSummary: a.dischargeSummaryData || null,
        hasDischargeSummary: Boolean(a.dischargeSummaryData),
        dischargeType:
          a.dischargeSummaryData && typeof a.dischargeSummaryData === 'object'
            ? String(a.dischargeSummaryData.dischargeType || 'normal').toLowerCase()
            : 'normal',
        billingSummary: { total: totalBill, paid: paidBill, pending: pendingTotal },
      };
    });

    return res.json({
      items,
      doctorOptions,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('listDischargeHistory', e);
    return res.status(500).json({ message: 'Could not load discharge history' });
  }
}

function billPendingAmount(b) {
  const st = String(b?.status || '').toUpperCase();
  if (st === 'CANCELLED') return 0;
  const total = Math.max(0, b?.totalAmount || 0);
  const paidRaw = Math.max(0, b?.paidAmount || 0);
  const payments = Array.isArray(b?.payments) ? b.payments : [];
  const paidByPayments = payments.reduce((s, p) => s + Math.max(0, p?.amount || 0), 0);
  const paid = Math.max(paidRaw, paidByPayments);
  return Math.max(0, total - paid);
}

function isIpdVisitType(vt) {
  return String(vt || '').toUpperCase() === 'IPD';
}

/**
 * Bills that belong to this IPD stay for clearance/discharge:
 * - rows linked with admissionId, or
 * - legacy IPD rows with no admissionId but billDate on/after admission (common when billing omitted admissionId).
 * OPD and other admissions are excluded from this stay's balance.
 */
function billBelongsToAdmissionStay(bill, admission) {
  if (!bill || !admission?.id) return false;
  if (bill.admissionId === admission.id) return true;
  if (bill.admissionId != null && bill.admissionId !== admission.id) return false;
  if (!isIpdVisitType(bill.visitType)) return false;
  const since = admission.admissionDate ? new Date(admission.admissionDate).getTime() : 0;
  const bd = bill.billDate ? new Date(bill.billDate).getTime() : 0;
  return bd >= since;
}

function billOnOrAfterAdmission(bill, admission) {
  if (!bill || !admission) return false;
  const since = admission.admissionDate ? new Date(admission.admissionDate).getTime() : 0;
  const bd = bill.billDate
    ? new Date(bill.billDate).getTime()
    : bill.createdAt
      ? new Date(bill.createdAt).getTime()
      : 0;
  return bd >= since;
}

function isLabRelatedBill(bill) {
  if (!bill) return false;
  if (Array.isArray(bill.labOrders) && bill.labOrders.length) return true;
  const notes = String(bill.notes || '').toLowerCase();
  if (notes.includes('lab order') || notes.includes('lab advice') || notes.includes('opd lab')) return true;
  const items = Array.isArray(bill.lineItems) ? bill.lineItems : [];
  return items.some((i) => /lab\s*test|laboratory/i.test(String(i.description || '')));
}

function isOtRelatedBill(bill) {
  if (!bill) return false;
  if (bill.otRequest) return true;
  const notes = String(bill.notes || '').toLowerCase();
  if (/\bot\b/.test(notes) || notes.includes('operation') || notes.includes('surgery')) return true;
  const items = Array.isArray(bill.lineItems) ? bill.lineItems : [];
  return items.some((i) => /\bot\b|operation|surgery/i.test(String(i.description || '')));
}

function mapPendingBillRow(b) {
  return {
    id: b.id,
    billNumber: b.billNumber,
    visitType: b.visitType,
    status: b.status,
    totalAmount: b.totalAmount,
    paidAmount: b.paidAmount,
    pending: billPendingAmount(b),
    admissionId: b.admissionId,
    category: isLabRelatedBill(b) ? 'LAB' : isOtRelatedBill(b) ? 'OT' : 'GENERAL',
  };
}

/**
 * Pre-discharge checks: nurse approval already done; all patient bills settled;
 * no lab orders stuck in pending billing since admission.
 */
async function getDischargeClearances(req, res) {
  await releaseExpiredMaintenanceBeds(prisma);
  const id = normalizeString(req.params.id);
  const admission = await prisma.admission.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      dischargeRequestedAt: true,
      dischargeDate: true,
      patientId: true,
      admissionDate: true,
      notesText: true,
      clinicalCondition: true,
      patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, mobile: true } },
      doctor: { select: { user: { select: { name: true } } } },
      ward: { select: { name: true, type: true } },
      bed: { select: { code: true } },
    },
  });
  if (!admission) return res.status(404).json({ message: 'Admission not found' });
  if (admission.dischargeDate) return res.status(400).json({ message: 'Admission is already closed' });
  if (String(admission.status || '').toUpperCase() !== 'DISCHARGE_REQUESTED') {
    return res.status(400).json({ message: 'Discharge must be nurse-approved before clearance checks' });
  }

  const nursingClearance = true;
  const nursingDetail =
    'Nurse discharge request is on file. Clinical condition at approval was reviewed by assigned nursing.';

  const allPatientBills = await prisma.bill.findMany({
    where: {
      patientId: admission.patientId,
      NOT: { status: 'CANCELLED' },
    },
    orderBy: [{ billDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      billNumber: true,
      visitType: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
      admissionId: true,
      billDate: true,
      createdAt: true,
      notes: true,
      payments: { select: { amount: true } },
      lineItems: { select: { description: true } },
      labOrders: { select: { id: true, orderNumber: true } },
      otRequest: { select: { id: true, requestNumber: true } },
    },
  });

  const sinceAdmissionBills = allPatientBills.filter((b) => billOnOrAfterAdmission(b, admission));
  const patientBills = allPatientBills.filter((b) => billBelongsToAdmissionStay(b, admission));
  const otherPatientBills = allPatientBills.filter((b) => !billBelongsToAdmissionStay(b, admission));

  const labRelatedPendingBills = sinceAdmissionBills
    .filter((b) => billPendingAmount(b) > 0 && isLabRelatedBill(b))
    .map(mapPendingBillRow);

  const otRelatedPendingBills = sinceAdmissionBills
    .filter((b) => billPendingAmount(b) > 0 && isOtRelatedBill(b) && !isLabRelatedBill(b))
    .map(mapPendingBillRow);

  const blockingBills = patientBills
    .filter((b) => billPendingAmount(b) > 0 && !isLabRelatedBill(b))
    .map(mapPendingBillRow);

  const otherPendingBills = otherPatientBills
    .filter((b) => billPendingAmount(b) > 0 && billOnOrAfterAdmission(b, admission) && !isLabRelatedBill(b))
    .map(mapPendingBillRow);

  const otherPatientBillingPending = otherPendingBills.reduce((s, b) => s + (b.pending || 0), 0);

  const since = admission.admissionDate || new Date(0);
  const labOrders = await prisma.labOrder.findMany({
    where: {
      patientId: admission.patientId,
      createdAt: { gte: since },
      NOT: { status: 'CANCELLED' },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
    },
  });

  const blockingLabOrders = labOrders
    .filter((lo) => String(lo.status || '').toUpperCase() === 'PENDING_BILLING')
    .map((lo) => ({
      id: lo.id,
      orderNumber: lo.orderNumber,
      reason: 'Lab order is not billed yet — complete lab billing before discharge.',
    }));

  const pharmacyDueBills = await prisma.pharmacyBill.findMany({
    where: {
      patientId: admission.patientId,
      billingType: 'HOSPITAL_PATIENT',
      status: { in: ['PENDING_PAYMENT', 'PARTIALLY_PAID'] },
    },
    select: {
      id: true,
      billNumber: true,
      grandTotal: true,
      paidAmount: true,
      pendingAmount: true,
      status: true,
    },
  });
  const pharmacyDue = {
    totalAmount: pharmacyDueBills.reduce((s, b) => s + Number(b.grandTotal || 0), 0),
    paidAmount: pharmacyDueBills.reduce((s, b) => s + Number(b.paidAmount || 0), 0),
    pendingAmount: pharmacyDueBills.reduce((s, b) => s + Number(b.pendingAmount || 0), 0),
    bills: pharmacyDueBills,
  };

  const billingClearance = blockingBills.length === 0;
  const labBillingPendingTotal = labRelatedPendingBills.reduce((s, b) => s + (b.pending || 0), 0);
  const otBillingPendingTotal = otRelatedPendingBills.reduce((s, b) => s + (b.pending || 0), 0);
  const labClearance = blockingLabOrders.length === 0 && labRelatedPendingBills.length === 0;
  const billingPendingTotal = blockingBills.reduce((s, b) => s + (b.pending || 0), 0);
  const otherBillingPendingTotal = otherPendingBills.reduce((s, b) => s + (b.pending || 0), 0);
  const totalPatientBillingPending =
    billingPendingTotal + labBillingPendingTotal + otBillingPendingTotal + otherBillingPendingTotal;
  const grandTotalOutstanding = totalPatientBillingPending + Number(pharmacyDue.pendingAmount || 0);
  const allClear =
    nursingClearance &&
    billingClearance &&
    labClearance &&
    otRelatedPendingBills.length === 0 &&
    Number(pharmacyDue.pendingAmount || 0) === 0;
  const mayDischargeWithBillingDues =
    nursingClearance && labClearance && otRelatedPendingBills.length === 0 && !billingClearance;

  const clearedBills = patientBills
    .filter((b) => billPendingAmount(b) === 0)
    .map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      visitType: b.visitType,
      totalAmount: b.totalAmount,
      paidAmount: b.paidAmount,
    }));

  const billingSummary = {
    ipdStayPending: billingPendingTotal,
    labBillsPending: labBillingPendingTotal,
    otBillsPending: otBillingPendingTotal,
    otherPending: otherBillingPendingTotal,
    pharmacyPending: Number(pharmacyDue.pendingAmount || 0),
    totalOutstanding: grandTotalOutstanding,
    clearedBillCount: clearedBills.length,
  };

  return res.json({
    admissionId: admission.id,
    patient: admission.patient,
    ward: wardDisplayLine(admission.ward),
    bed: admission.bed?.code || '—',
    doctor: admission.doctor?.user?.name || '',
    nursingClearance,
    nursingDetail,
    billingClearance,
    billingPendingTotal,
    blockingBills,
    labClearance,
    blockingLabOrders,
    blockingLabBills: labRelatedPendingBills,
    labBillingPendingTotal,
    blockingOtBills: otRelatedPendingBills,
    otBillingPendingTotal,
    billingSummary,
    allClear,
    clearedBills,
    totalPatientBillingPending,
    mayDischargeWithBillingDues,
    otherPatientBillingPending,
    otherPendingBills,
    pharmacyDue,
  });
}

async function getAdmissionDetail(req, res) {
  const id = normalizeString(req.params.id);
  const admission = await prisma.admission.findUnique({
    where: { id },
    select: {
      id: true,
      ipdNumber: true,
      admissionDate: true,
      createdAt: true,
      dischargeDate: true,
      dischargeRequestedAt: true,
      status: true,
      department: true,
      admissionType: true,
      notesText: true,
      dischargeSummaryData: true,
      treatmentPlan: { select: { id: true, description: true, instructions: true, medicines: true, updatedAt: true, createdAt: true } },
      ward: { select: { id: true, name: true, type: true } },
      bed: { select: { id: true, code: true, status: true } },
      patient: { select: { id: true, uhid: true, name: true, mobile: true, age: true, gender: true, bloodGroup: true, allergies: true } },
      doctor: { select: { id: true, user: { select: { name: true } } } },
      ...(admissionSupportsAssignedNurse()
        ? { nurse: { select: { name: true, email: true } } }
        : {}),
      billing: { select: { admissionCharge: true, roomChargePerDay: true, advance: true, paymentMode: true, paymentStatus: true } },
      transfers: {
        orderBy: [{ createdAt: 'desc' }],
        take: 20,
        select: {
          id: true,
          createdAt: true,
          reason: true,
          fromBed: { select: { code: true, ward: { select: { name: true } } } },
          toBed: { select: { code: true, ward: { select: { name: true } } } },
        },
      },
    },
  });
  if (!admission) return res.status(404).json({ message: 'Admission not found' });

  const vitalsLatest = await prisma.vitals.findFirst({
    where: { admissionId: id },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      bp: true,
      temp: true,
      pulse: true,
      spo2: true,
      oxygenTherapy: true,
      createdAt: true,
    },
  });

  return res.json({
    admission: {
      ...admission,
      ipdNumber: resolvedIpdNumber(admission),
      vitalsLatest: vitalsLatest || null,
    },
  });
}

async function canAssignNurse(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;
    const allowed = await canUserAssignNurse(userId, userRole);
    const shift = allowed ? (await getUserCurrentShiftType(userId)) || 'DAY' : null;
    return res.json({ canAssignNurse: allowed, shift });
  } catch (e) {
    console.error('canAssignNurse error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function listAvailableNurses(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;
    const allowed = await canUserAssignNurse(userId, userRole);
    if (!allowed) return res.status(403).json({ message: 'Not authorized to assign nurses' });

    const users = await prisma.user.findMany({
      where: { role: 'NURSE', isActive: true },
      select: { id: true, name: true, employeeId: true, department: true },
      orderBy: { name: 'asc' },
    });

    const admissions = await prisma.admission.findMany({
      where: { status: { in: ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'] }, nurseId: { not: null } },
      select: { nurseId: true },
    });
    const countMap = {};
    for (const a of admissions) countMap[a.nurseId] = (countMap[a.nurseId] || 0) + 1;

    const nurses = users.map((u) => ({
      id: u.id,
      name: u.name,
      employeeId: u.employeeId,
      department: u.department || '—',
      activePatients: countMap[u.id] || 0,
    }));

    return res.json({ nurses });
  } catch (e) {
    console.error('listAvailableNurses error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createAdmission(req, res) {
  await releaseExpiredMaintenanceBeds(prisma);
  const body = req.body || {};
  const uhid = normalizeString(body.uhid);
  const doctorId = normalizeString(body.doctorId);
  const wardId = normalizeString(body.wardId);
  const bedId = normalizeString(body.bedId);
  const department = normalizeString(body.department) || null;
  const admissionType = normalizeString(body.admissionType) || null;
  const admissionDate = parseDateOnly(body.admissionDate) || new Date();
  const status = normalizeAdmissionStatus(body.status) || 'ADMITTED';
  const notesText = buildAdmissionNotesText({
    diagnosis: body.diagnosis,
    notes: body.notes,
    expectedStay: body.expectedStay,
  });
  const emergencyName = normalizeString(body.emergencyName) || null;
  const emergencyPhone = normalizeString(body.emergencyPhone) || null;

  const userId = req.user?.userId || req.user?.id;
  const userRole = req.user?.role;
  const nurseId = normalizeString(body.nurseId) || null;

  // Pre-validate nurse if provided (before the admission transaction)
  const assignAllowed = await canUserAssignNurse(userId, userRole);
  let nurseUser = null;
  if (nurseId) {
    if (!assignAllowed) return res.status(403).json({ message: 'Not authorized to assign a nurse directly' });
    nurseUser = await prisma.user.findUnique({ where: { id: nurseId }, select: { id: true, name: true, role: true, isActive: true } });
    if (!nurseUser) return res.status(400).json({ message: 'Nurse not found' });
    if (nurseUser.role !== 'NURSE') return res.status(400).json({ message: 'Selected user is not a nurse' });
    if (!nurseUser.isActive) return res.status(400).json({ message: 'Nurse is inactive' });
  }

  const billing = body.billing || {};
  let admissionCharge = Number.isFinite(Number(billing.admissionCharge)) ? Math.trunc(Number(billing.admissionCharge)) : 0;
  let roomChargePerDay = Number.isFinite(Number(billing.roomChargePerDay)) ? Math.trunc(Number(billing.roomChargePerDay)) : 0;
  let advance = Number.isFinite(Number(billing.advance)) ? Math.trunc(Number(billing.advance)) : 0;
  let paymentMode = billing.paymentMode != null ? normalizeString(billing.paymentMode) || null : null;
  let paymentStatus = billing.paymentStatus != null ? normalizeString(billing.paymentStatus) || null : null;

  const patient = await prisma.patient.findUnique({ where: { uhid }, select: { id: true, uhid: true, name: true } });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const sponsor = await getLatestPatientSponsor(prisma, patient.id);
  const ayushmanBilling = applyAyushmanAdmissionBilling({
    sponsor,
    admissionCharge,
    roomChargePerDay,
    advance,
    paymentStatus,
    paymentMode,
  });
  admissionCharge = ayushmanBilling.admissionCharge;
  roomChargePerDay = ayushmanBilling.roomChargePerDay;
  advance = ayushmanBilling.advance;
  paymentMode = ayushmanBilling.paymentMode;
  paymentStatus = ayushmanBilling.paymentStatus;

  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true, user: { select: { name: true, isActive: true } } } });
  if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
  if (!doctor.user?.isActive) return res.status(403).json({ message: 'Doctor is inactive' });
  const txOptions = { maxWait: 10_000, timeout: 25_000 };

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
    const openAdmission = await tx.admission.findFirst({
      where: isOpenAdmissionWhere({ patientId: patient.id }),
      select: { id: true, ipdNumber: true },
    });
    if (openAdmission) throw new Error('PATIENT_ALREADY_ADMITTED');

    const bed = await tx.bed.findUnique({
      where: { id: bedId },
      select: { id: true, status: true, code: true, wardId: true },
    });
    if (!bed) throw new Error('BED_NOT_FOUND');
    if (bed.wardId !== wardId) throw new Error('BED_WARD_MISMATCH');
    if (bed.status !== 'AVAILABLE') throw new Error('BED_NOT_AVAILABLE');

    try {
      await tx.$executeRawUnsafe(
        `UPDATE "Bed" SET "status" = 'OCCUPIED', "maintenanceUntil" = NULL WHERE "id" = '${bedId}'`,
      );
    } catch {
      await tx.bed.update({ where: { id: bedId }, data: { status: 'OCCUPIED' } });
    }

    const ipdNumber = await allocateNextIpdNumber(tx, admissionDate);

    const admission = await tx.admission.create({
      data: {
        ipdNumber,
        patientId: patient.id,
        doctorId: doctor.id,
        wardId,
        bedId,
        bedNumber: bed.code,
        department,
        admissionType,
        admissionDate,
        status,
        notesText,
        billing: {
          create: { admissionCharge, roomChargePerDay, advance, paymentMode, paymentStatus },
        },
      },
      select: { id: true, ipdNumber: true, admissionDate: true, status: true, patientId: true },
    });

    if (emergencyName || emergencyPhone) {
      await tx.patient.update({
        where: { id: patient.id },
        data: {
          ...(emergencyName ? { emergencyName } : {}),
          ...(emergencyPhone ? { emergencyPhone } : {}),
        },
      });
    }

    // Sync ReceptionVisit to IPD
    const dayStart = toStartOfDay(admissionDate);
    const dayEnd = toEndOfDay(admissionDate);
    const latestVisit = await tx.receptionVisit.findFirst({
      where: { patientId: patient.id, visitDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    const visitStatus = visitStatusForAdmission(status);
    const doctorName = doctor.user?.name || null;
    if (latestVisit?.id) {
      await tx.receptionVisit.update({
        where: { id: latestVisit.id },
        data: { visitType: 'IPD', status: visitStatus, department, doctorName, visitDate: admissionDate },
      });
    } else {
      await tx.receptionVisit.create({
        data: { patientId: patient.id, visitType: 'IPD', status: visitStatus, department, doctorName, visitDate: admissionDate },
      });
    }

    await clearReferAdmitForPatient(tx, patient.id);

    return admission;
  }, txOptions);
  } catch (e) {
    const msg = e?.message;
    if (msg === 'PATIENT_ALREADY_ADMITTED') {
      return res.status(409).json({ message: 'Patient already has an active IPD admission' });
    }
    if (msg === 'BED_NOT_FOUND') return res.status(404).json({ message: 'Bed not found' });
    if (msg === 'BED_WARD_MISMATCH') return res.status(400).json({ message: 'Selected bed does not belong to the chosen ward' });
    if (msg === 'BED_NOT_AVAILABLE') return res.status(409).json({ message: 'Bed not available' });
    console.error('createAdmission', e);
    return res.status(500).json({ message: 'Could not create admission' });
  }

  let allocationRequestId = null;
  let nurseAssigned = false;

  if (nurseUser) {
    // Night-shift: nurse already validated above
    try {
      // Set nurseId directly on admission
      await prisma.admission.update({
        where: { id: created.id },
        data: { nurseId: nurseUser.id },
      });

      const receptionName = req.user?.name || 'Receptionist';
      const shiftLabel = (await getUserCurrentShiftType(userId)) || 'DAY';

      const allocation = await createApprovedAllocationWithAssignment(prisma, {
        patientId: patient.id,
        uhid: patient.uhid,
        patientName: patient.name,
        admissionId: created.id,
        sourceModule: 'IPD',
        department,
        requestedStaffType: 'NURSE',
        reason: `Night IPD admit — nurse assigned by reception. Department: ${department || 'general'} ward`,
        priority: 'MEDIUM',
        assignedToId: nurseUser.id,
        assignedToName: nurseUser.name,
        assignedById: userId,
        assignedByName: receptionName,
        assignedShift: shiftLabel,
        remarks: JSON.stringify({ assignedBy: 'NIGHT_RECEPTION', receptionistId: userId, receptionistName: receptionName }),
      });
      allocationRequestId = allocation.id;
      nurseAssigned = true;

      // Notify the assigned nurse
      try {
        await prisma.notification.create({
          data: {
            userId: nurseUser.id,
            type: 'ALERT',
            severity: 'INFO',
            title: 'New Patient Assigned',
            message: `Patient ${patient.name} (${patient.uhid}) has been assigned to you. Admitted to ${department || 'general'} ward. (Night reception assignment)`,
          },
        });
      } catch (notifyErr) {
        console.error('Night reception nurse notification error:', notifyErr.message);
      }
    } catch (err) {
      console.error('Night reception nurse assignment failed:', err.message);
      // Fall back to HR pending request
      try {
        await createPendingAllocationRequest(prisma, {
          patientId: patient.id, uhid: patient.uhid, patientName: patient.name,
          admissionId: created.id, sourceModule: 'IPD', department,
          requestedStaffType: 'NURSE',
          reason: `Nurse required for patient admitted to ${department || 'general'} ward`,
          priority: 'MEDIUM',
          requestedById: userId || '00000000-0000-0000-0000-000000000000',
          requestedByName: req.user?.name || 'System',
        });
      } catch (fallbackErr) {
        console.error('Fallback allocation request failed:', fallbackErr.message);
      }
    }
  } else if (assignAllowed) {
    // Night receptionist but no nurse selected → fall back to HR pending request
    try {
      await createPendingAllocationRequest(prisma, {
        patientId: patient.id, uhid: patient.uhid, patientName: patient.name,
        admissionId: created.id, sourceModule: 'IPD', department,
        requestedStaffType: 'NURSE',
        reason: `Nurse required for patient admitted to ${department || 'general'} ward`,
        priority: 'MEDIUM',
        requestedById: userId || '00000000-0000-0000-0000-000000000000',
        requestedByName: req.user?.name || 'System',
      });
    } catch (err) {
      console.error('Failed to create allocation request for admission:', err.message);
    }
  } else {
    // Day receptionist → standard HR pending request
    try {
      await createPendingAllocationRequest(prisma, {
        patientId: patient.id, uhid: patient.uhid, patientName: patient.name,
        admissionId: created.id, sourceModule: 'IPD', department,
        requestedStaffType: 'NURSE',
        reason: `Nurse required for patient admitted to ${department || 'general'} ward`,
        priority: 'MEDIUM',
        requestedById: userId || '00000000-0000-0000-0000-000000000000',
        requestedByName: req.user?.name || 'System',
      });
    } catch (err) {
      console.error('Failed to create allocation request for admission:', err.message);
    }
  }

  if (admissionType === 'ICU' || department === 'Emergency & Trauma Care') {
    const title = admissionType === 'ICU' ? 'ICU Admission Registered' : 'Emergency Admission Registered';
    const msg = `Patient ${patient.name || 'Patient'} (${patient.uhid || ''}) admitted to ${admissionType === 'ICU' ? 'ICU' : 'Emergency & Trauma Care'}.`;
    await triggerCriticalAlert(title, msg);
  }

  setImmediate(() => {
    emitAbdmClinicalEvent({
      type: EVENT.IPD_ADMISSION,
      sourceId: created.id,
      patientId: created.patientId || patient.id,
    }).catch((err) => {
      console.error('[abdm-hr] IPD emit failed', created.id, err?.message);
    });
  });

  return res.status(201).json({ admission: created, hrRequest: !nurseAssigned, nurseAssigned, allocationRequestId });
}

async function transferBed(req, res) {
  await releaseExpiredMaintenanceBeds(prisma);
  const admissionId = normalizeString(req.body?.admissionId);
  const toBedId = normalizeString(req.body?.toBedId);
  const reason = normalizeString(req.body?.reason) || null;
  if (!admissionId || !toBedId) return res.status(400).json({ message: 'admissionId and toBedId are required' });

  try {
    const createdByUserId = normalizeString(req.user?.userId) || null;
    const result = await prisma.$transaction(
      async (tx) => {
      const admission = await tx.admission.findUnique({
        where: { id: admissionId },
        select: { id: true, bedId: true, wardId: true, status: true },
      });
      if (!admission) throw new Error('ADMISSION_NOT_FOUND');

      const toBed = await tx.bed.findUnique({
        where: { id: toBedId },
        select: { id: true, status: true, code: true, wardId: true },
      });
      if (!toBed) throw new Error('BED_NOT_FOUND');
      if (toBed.status !== 'AVAILABLE') throw new Error('BED_NOT_AVAILABLE');

      // free old bed if present
      if (admission.bedId) {
        const maintenanceUntil = new Date(Date.now() + 60 * 60 * 1000);
        try {
          await tx.$executeRawUnsafe(
            `UPDATE "Bed" SET "status" = 'MAINTENANCE', "maintenanceUntil" = '${maintenanceUntil.toISOString()}' WHERE "id" = '${admission.bedId}'`,
          );
        } catch {
          await tx.bed.update({ where: { id: admission.bedId }, data: { status: 'AVAILABLE' } });
        }
      }

      try {
        await tx.$executeRawUnsafe(
          `UPDATE "Bed" SET "status" = 'OCCUPIED', "maintenanceUntil" = NULL WHERE "id" = '${toBedId}'`,
        );
      } catch {
        await tx.bed.update({ where: { id: toBedId }, data: { status: 'OCCUPIED' } });
      }

      await tx.bedTransfer.create({
        data: { admissionId, fromBedId: admission.bedId, toBedId, reason, createdByUserId },
      });

      const updated = await tx.admission.update({
        where: { id: admissionId },
        data: { bedId: toBedId, wardId: toBed.wardId, bedNumber: toBed.code },
        select: { id: true, bedId: true, wardId: true, bedNumber: true },
      });

      return updated;
    },
      { maxWait: 10_000, timeout: 25_000 },
    );

    return res.json({ admission: result });
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg === 'ADMISSION_NOT_FOUND') return res.status(404).json({ message: 'Admission not found' });
    if (msg === 'BED_NOT_FOUND') return res.status(404).json({ message: 'Bed not found' });
    if (msg === 'BED_NOT_AVAILABLE') return res.status(409).json({ message: 'Bed not available' });
    return res.status(500).json({ message: 'Failed to transfer bed' });
  }
}

async function listTransferHistory(req, res) {
  const q = normalizeString(req.query.q).toLowerCase();
  const admissionId = normalizeString(req.query.admissionId);
  const wardId = normalizeString(req.query.wardId);
  const fromWardId = normalizeString(req.query.fromWardId);
  const toWardId = normalizeString(req.query.toWardId);
  const fromBedId = normalizeString(req.query.fromBedId);
  const toBedId = normalizeString(req.query.toBedId);
  const fromDate = parseDateTime(req.query.fromDate) || parseDateOnly(req.query.fromDate);
  const toDate = parseDateTime(req.query.toDate) || parseDateOnly(req.query.toDate);

  const page = Number.isFinite(Number(req.query.page)) ? Math.max(1, Math.trunc(Number(req.query.page))) : 1;
  const limit = Number.isFinite(Number(req.query.limit)) ? Math.min(200, Math.max(1, Math.trunc(Number(req.query.limit)))) : 20;
  const skip = (page - 1) * limit;

  /** @type {import('@prisma/client').Prisma.BedTransferWhereInput} */
  const where = {};

  if (admissionId) where.admissionId = admissionId;
  if (fromBedId) where.fromBedId = fromBedId;
  if (toBedId) where.toBedId = toBedId;

  if (fromWardId) where.fromBed = { wardId: fromWardId };
  if (toWardId) where.toBed = { wardId: toWardId };
  if (wardId) {
    where.OR = [{ fromBed: { wardId } }, { toBed: { wardId } }];
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDate) where.createdAt.lte = toDate;
  }

  if (q) {
    const search = {
      OR: [
        { reason: { contains: q, mode: 'insensitive' } },
        { admission: { ipdNumber: { contains: q, mode: 'insensitive' } } },
        {
          admission: {
            patient: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { uhid: { contains: q, mode: 'insensitive' } },
                { mobile: { contains: q } },
              ],
            },
          },
        },
        { fromBed: { code: { contains: q, mode: 'insensitive' } } },
        { toBed: { code: { contains: q, mode: 'insensitive' } } },
        { fromBed: { ward: { name: { contains: q, mode: 'insensitive' } } } },
        { toBed: { ward: { name: { contains: q, mode: 'insensitive' } } } },
        { createdBy: { name: { contains: q, mode: 'insensitive' } } },
        { createdBy: { email: { contains: q, mode: 'insensitive' } } },
      ],
    };

    if (Array.isArray(where.OR) && where.OR.length) {
      where.AND = [...(where.AND || []), { OR: where.OR }, search];
      delete where.OR;
    } else {
      where.AND = [...(where.AND || []), search];
    }
  }

  const [total, rows] = await Promise.all([
    prisma.bedTransfer.count({ where }),
    prisma.bedTransfer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        reason: true,
        admissionId: true,
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        admission: {
          select: {
            id: true,
            ipdNumber: true,
            department: true,
            status: true,
            admissionDate: true,
            patient: { select: { id: true, name: true, uhid: true, mobile: true, age: true, gender: true } },
            doctor: { select: { user: { select: { name: true } } } },
            ...(admissionSupportsAssignedNurse() ? { nurse: { select: { name: true, email: true } } } : {}),
          },
        },
        fromBed: { select: { id: true, code: true, ward: { select: { id: true, name: true, type: true } } } },
        toBed: { select: { id: true, code: true, ward: { select: { id: true, name: true, type: true } } } },
      },
    }),
  ]);

  const items = rows.map((t) => {
    const admission = t.admission || {};
    const patient = admission.patient || {};
    return {
      id: t.id,
      createdAt: t.createdAt,
      reason: t.reason || '',
      admissionId: t.admissionId,
      ipdNumber: admission ? resolvedIpdNumber(admission) : '',
      department: admission.department || '',
      admissionStatus: admissionStatusLabel(admission.status),
      admissionDate: admission.admissionDate || null,
      patient: {
        id: patient.id || '',
        name: patient.name || '',
        uhid: patient.uhid || '',
        mobile: patient.mobile || '',
        age: patient.age ?? null,
        gender: patient.gender ? String(patient.gender) : '',
      },
      doctorName: admission?.doctor?.user?.name || '',
      nurseName: admissionSupportsAssignedNurse() ? admission?.nurse?.name || admission?.nurse?.email || '' : '',
      from: {
        bedId: t.fromBed?.id || null,
        bedCode: t.fromBed?.code || '',
        wardId: t.fromBed?.ward?.id || null,
        wardName: t.fromBed?.ward?.name || '',
        wardType: t.fromBed?.ward?.type || '',
      },
      to: {
        bedId: t.toBed?.id || null,
        bedCode: t.toBed?.code || '',
        wardId: t.toBed?.ward?.id || null,
        wardName: t.toBed?.ward?.name || '',
        wardType: t.toBed?.ward?.type || '',
      },
      createdBy: t.createdBy
        ? { id: t.createdBy.id, name: t.createdBy.name || '', email: t.createdBy.email || '', role: t.createdBy.role || '' }
        : null,
    };
  });

  return res.json({
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    items,
  });
}

async function dischargeAdmission(req, res) {
  await releaseExpiredMaintenanceBeds(prisma);
  const id = normalizeString(req.params.id);
  const now = new Date();
  const dischargeWithDues =
    req.body &&
    (req.body.dischargeWithDues === true ||
      req.body.dischargeWithDues === 'true' ||
      req.body.dischargeWithDues === 1 ||
      req.body.dischargeWithDues === '1');
  const dischargeSummary =
    req.body?.dischargeSummary != null && typeof req.body.dischargeSummary === 'object'
      ? req.body.dischargeSummary
      : null;
  try {
  const updated = await prisma.$transaction(
    async (tx) => {
    const admission = await tx.admission.findUnique({
      where: { id },
      select: {
        id: true,
        patientId: true,
        bedId: true,
        admissionDate: true,
        status: true,
        dischargeDate: true,
        dischargeRequestedAt: true,
      },
    });
    if (!admission) throw new Error('ADMISSION_NOT_FOUND');
    if (admission.dischargeDate) throw new Error('ALREADY_DISCHARGED');
    if (String(admission.status || '').toUpperCase() !== 'DISCHARGE_REQUESTED') {
      throw new Error('INVALID_DISCHARGE_STATUS');
    }

    if (!dischargeWithDues) {
      // Same scope as getDischargeClearances (admission-linked + in-stay orphan IPD bills), with Payment rows.
      const allPatientBills = await tx.bill.findMany({
        where: {
          patientId: admission.patientId,
          NOT: { status: 'CANCELLED' },
        },
        select: {
          totalAmount: true,
          paidAmount: true,
          status: true,
          billNumber: true,
          admissionId: true,
          visitType: true,
          billDate: true,
          createdAt: true,
          notes: true,
          payments: { select: { amount: true } },
          lineItems: { select: { description: true } },
          labOrders: { select: { id: true } },
          otRequest: { select: { id: true } },
        },
      });
      const unpaid = allPatientBills.filter(
        (b) => billBelongsToAdmissionStay(b, admission) && billPendingAmount(b) > 0 && !isLabRelatedBill(b),
      );
      if (unpaid.length) throw new Error('BILLING_NOT_CLEAR');
    }

    const since = admission.admissionDate || new Date(0);
    const labOrders = await tx.labOrder.findMany({
      where: {
        patientId: admission.patientId,
        createdAt: { gte: since },
        NOT: { status: 'CANCELLED' },
      },
      select: { status: true, orderNumber: true },
    });
    const labBlocked = labOrders.some((lo) => String(lo.status || '').toUpperCase() === 'PENDING_BILLING');
    if (labBlocked) throw new Error('LAB_NOT_CLEAR');

    if (!dischargeWithDues) {
      const allPatientBillsForLab = await tx.bill.findMany({
        where: {
          patientId: admission.patientId,
          NOT: { status: 'CANCELLED' },
        },
        select: {
          totalAmount: true,
          paidAmount: true,
          status: true,
          billNumber: true,
          admissionId: true,
          visitType: true,
          billDate: true,
          createdAt: true,
          notes: true,
          payments: { select: { amount: true } },
          lineItems: { select: { description: true } },
          labOrders: { select: { id: true } },
          otRequest: { select: { id: true } },
        },
      });
      const unpaidLabBills = allPatientBillsForLab.filter(
        (b) =>
          billOnOrAfterAdmission(b, admission) &&
          billPendingAmount(b) > 0 &&
          isLabRelatedBill(b),
      );
      if (unpaidLabBills.length) throw new Error('LAB_BILL_NOT_CLEAR');
      const unpaidOtBills = allPatientBillsForLab.filter(
        (b) =>
          billOnOrAfterAdmission(b, admission) &&
          billPendingAmount(b) > 0 &&
          isOtRelatedBill(b) &&
          !isLabRelatedBill(b),
      );
      if (unpaidOtBills.length) throw new Error('OT_BILL_NOT_CLEAR');
    }

    // Vacated bed: housekeeping / turnover — MAINTENANCE for 1h, then AVAILABLE (see releaseExpiredMaintenanceBeds).
    if (admission.bedId) {
      const cleaningUntil = new Date(now.getTime() + 60 * 60 * 1000);
      try {
        await tx.$executeRawUnsafe(
          `UPDATE "Bed" SET "status" = 'MAINTENANCE', "maintenanceUntil" = '${cleaningUntil.toISOString()}' WHERE "id" = '${admission.bedId}'`,
        );
      } catch {
        await tx.bed.update({
          where: { id: admission.bedId },
          data: { status: 'MAINTENANCE', maintenanceUntil: cleaningUntil },
        });
      }
    }

    const row = await tx.admission.update({
      where: { id },
      data: {
        dischargeDate: now,
        status: 'READY_FOR_DISCHARGE',
        dischargeRequestedAt: null,
        ...(dischargeSummary ? { dischargeSummaryData: dischargeSummary } : {}),
      },
      select: { id: true, patientId: true, dischargeDate: true, status: true, admissionDate: true },
    });

    // Update reception visit to discharged
    const dayStart = toStartOfDay(row.admissionDate);
    const dayEnd = toEndOfDay(row.admissionDate);
    const latestVisit = await tx.receptionVisit.findFirst({
      where: { patientId: admission.patientId, visitDate: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (latestVisit?.id) {
      await tx.receptionVisit.update({ where: { id: latestVisit.id }, data: { visitType: 'IPD', status: 'DISCHARGED' } });
    }

    await clearReferAdmitForPatient(tx, admission.patientId);

    return row;
  },
    { maxWait: 10_000, timeout: 25_000 },
  );

  if (updated?.dischargeDate) {
    setImmediate(() => {
      emitAbdmClinicalEvent({
        type: EVENT.DISCHARGE,
        sourceId: updated.id,
        patientId: updated.patientId,
      }).catch((err) => {
        console.error('[abdm-hr] DS emit failed', updated.id, err?.message);
      });
    });
  }

  return res.json({ admission: updated });
  } catch (e) {
    const msg = e && e.message;
    if (msg === 'ADMISSION_NOT_FOUND') return res.status(404).json({ message: 'Admission not found' });
    if (msg === 'ALREADY_DISCHARGED') return res.status(400).json({ message: 'This admission is already discharged' });
    if (msg === 'INVALID_DISCHARGE_STATUS') {
      return res.status(400).json({ message: 'Discharge must be nurse-approved before it can be finalized' });
    }
    if (msg === 'BILLING_NOT_CLEAR') {
      return res.status(400).json({
        message:
          'All bills for this admission must be fully paid before final discharge. Clear pending amounts in billing (or use discharge with dues if policy allows).',
      });
    }
    if (msg === 'LAB_NOT_CLEAR') {
      return res.status(400).json({
        message: 'Lab orders are still pending billing. Complete lab billing before final discharge.',
      });
    }
    if (msg === 'LAB_BILL_NOT_CLEAR') {
      return res.status(400).json({
        message: 'Lab bills are still unpaid. Collect lab bill payment before final discharge.',
      });
    }
    if (msg === 'OT_BILL_NOT_CLEAR') {
      return res.status(400).json({
        message: 'OT bills are still unpaid. Collect OT bill payment before final discharge.',
      });
    }
    console.error('dischargeAdmission', e);
    return res.status(500).json({ message: 'Could not complete discharge' });
  }
}

async function updateAdmissionNotes(req, res) {
  const id = normalizeString(req.params.id);
  const notesText = normalizeString(req.body?.notesText);
  if (!notesText) return res.status(400).json({ message: 'notesText is required' });
  const admission = await prisma.admission.update({
    where: { id },
    data: { notesText },
    select: { id: true, notesText: true },
  });
  return res.json({ admission });
}

async function updateDischargeSummary(req, res) {
  const id = normalizeString(req.params.id);
  const dischargeSummary =
    req.body?.dischargeSummary != null && typeof req.body.dischargeSummary === 'object'
      ? req.body.dischargeSummary
      : null;
  if (!dischargeSummary) return res.status(400).json({ message: 'dischargeSummary object is required' });

  const existing = await prisma.admission.findUnique({
    where: { id },
    select: { id: true, dischargeDate: true },
  });
  if (!existing) return res.status(404).json({ message: 'Admission not found' });
  if (!existing.dischargeDate) {
    return res.status(400).json({ message: 'Patient is not discharged yet. Complete discharge from the summary form.' });
  }

  const admission = await prisma.admission.update({
    where: { id },
    data: { dischargeSummaryData: dischargeSummary },
    select: { id: true, dischargeSummaryData: true },
  });
  return res.json({ admission });
}

module.exports = {
  listWards,
  listBeds,
  updateBedStatus,
  listNurseLookup,
  listActiveAdmissions,
  listPendingDoctorReferrals,
  fulfillDoctorReferral,
  listNurseApprovedDischargeQueue,
  getDischargeClearances,
  getAdmissionDetail,
  canAssignNurse,
  listAvailableNurses,
  createAdmission,
  transferBed,
  listTransferHistory,
  listDischargeHistory,
  dischargeAdmission,
  updateDischargeSummary,
  updateAdmissionNotes,
};

