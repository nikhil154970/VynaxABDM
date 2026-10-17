const bcrypt = require('bcrypt');
const { prisma } = require('../../../config/prisma');
const { triggerCriticalAlert } = require('../../../lib/notificationHelpers');
const {
  isAyushmanSponsor,
  applyAyushmanVisitBilling,
} = require('../../../utils/ayushmanBilling');

function normalizeString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
}

function parseOptionalInt(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parsePhrAddress(input) {
  if (input == null || input === '') return null;
  if (Array.isArray(input)) {
    const cleaned = input.map((x) => normalizeString(x)).filter(Boolean);
    return cleaned.length ? cleaned : null;
  }
  const raw = normalizeString(input);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.map((x) => normalizeString(x)).filter(Boolean);
      return cleaned.length ? cleaned : null;
    }
  } catch {
    // fall through
  }
  return [raw];
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

const OPEN_ADMISSION_STATUSES = ['ADMITTED', 'UNDER_TREATMENT', 'DISCHARGE_REQUESTED'];

function calculateAgeFromDob(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age < 0 ? null : age;
}

async function generateUniqueUHID() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  for (let i = 0; i < 10; i += 1) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const uhid = `UH${y}${m}${d}${rand}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await prisma.patient.findUnique({ where: { uhid }, select: { id: true } });
    if (!exists) return uhid;
  }
  throw new Error('Failed to generate UHID');
}

function mapVisitStatusToEnum(status) {
  const s = normalizeString(status).toLowerCase();
  if (!s) return 'WAITING';
  if (s === 'waiting') return 'WAITING';
  if (s === 'in consultation' || s === 'in_consultation') return 'IN_CONSULTATION';
  if (s === 'completed') return 'COMPLETED';
  if (s === 'admitted') return 'ADMITTED';
  if (s === 'active') return 'ACTIVE';
  if (s === 'discharged') return 'DISCHARGED';
  return 'WAITING';
}

function mapVisitTypeToEnum(visitType) {
  const s = normalizeString(visitType).toLowerCase();
  if (s === 'ipd') return 'IPD';
  return 'OPD';
}

function visitEnumToLabel(e) {
  const v = String(e || '');
  if (v === 'IN_CONSULTATION') return 'In Consultation';
  if (v === 'WAITING') return 'Waiting';
  if (v === 'COMPLETED') return 'Completed';
  if (v === 'ADMITTED') return 'Admitted';
  if (v === 'ACTIVE') return 'Active';
  if (v === 'DISCHARGED') return 'Discharged';
  return v || 'Waiting';
}

function formatSeq(prefix, n) {
  const num = Number(n);
  const safe = Number.isFinite(num) && num >= 0 ? Math.trunc(num) : 0;
  // Pad to 3 for early numbers; will naturally expand for lakhs+.
  return `${prefix}-${String(safe).padStart(3, '0')}`;
}

function flattenVisitRow(row) {
  const g = String(row.patient?.gender || '');
  const genderLabel = g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : g === 'OTHER' ? 'Other' : null;
  return {
    id: row.id,
    patientId: row.patientId,
    uhid: row.patient?.uhid || null,
    registrationNumber: row.patient?.registrationNumber || '',
    name: row.patient?.name || '',
    phone: row.patient?.mobile || '',
    dob: row.patient?.dob || null,
    age: row.patient?.age ?? calculateAgeFromDob(row.patient?.dob),
    gender: genderLabel,
    address: row.patient?.address || '',
    abhaNumber: row.patient?.abhaNumber || row.patient?.healthIdNumber || '',
    abhaAddress: row.patient?.abhaAddress || '',
    abhaStatus: row.patient?.abhaStatus || '',
    phrAddress: Array.isArray(row.patient?.phrAddress) ? row.patient.phrAddress : [],
    healthIdNumber: row.patient?.healthIdNumber || row.patient?.abhaNumber || '',
    isAbhaVerified: Boolean(row.patient?.isAbhaVerified),
    mobileVerified: Boolean(row.patient?.mobileVerified),
    aadhaarVerified: Boolean(row.patient?.aadhaarVerified),
    abdmVerifiedAt: row.patient?.abdmVerifiedAt || null,
    hipLinked: Boolean(row.patient?.hipLinked),
    careContextId: row.patient?.careContextId || '',
    careContextStatus: row.patient?.careContextStatus || '',
    linkedAt: row.patient?.linkedAt || null,
    syncStatus: row.patient?.syncStatus || '',
    registrationSource: row.patient?.registrationSource || 'RECEPTION',
    hasPortal: Boolean(row.patient?.patientAuth),
    portalLoggedIn: Boolean(row.patient?.patientAuth?.lastLoginAt),
    visitType: row.visitType,
    department: row.department || '',
    doctor: row.doctorName || '',
    visitDate: row.visitDate,
    token: row.token || '',
    paymentStatus: row.paymentStatus || '',
    paymentMode: row.paymentMode || '',
    registrationFee: row.registrationFee ?? null,
    status: visitEnumToLabel(row.status),
    referBy: row.referBy || '',
    sponsor: row.sponsor || '',
    createdAt: row.createdAt,
  };
}

function flattenPatientRow(patient) {
  return {
    id: null,
    patientId: patient.id,
    uhid: patient.uhid,
    registrationNumber: patient.registrationNumber || '',
    name: patient.name,
    phone: patient.mobile || '',
    dob: patient.dob || null,
    age: patient.age ?? null,
    gender: patient.gender === 'MALE' ? 'Male' : patient.gender === 'FEMALE' ? 'Female' : patient.gender === 'OTHER' ? 'Other' : null,
    address: patient.address || '',
    abhaNumber: patient.abhaNumber || patient.healthIdNumber || '',
    abhaAddress: patient.abhaAddress || '',
    abhaStatus: patient.abhaStatus || '',
    phrAddress: Array.isArray(patient.phrAddress) ? patient.phrAddress : [],
    healthIdNumber: patient.healthIdNumber || patient.abhaNumber || '',
    isAbhaVerified: Boolean(patient.isAbhaVerified),
    mobileVerified: Boolean(patient.mobileVerified),
    aadhaarVerified: Boolean(patient.aadhaarVerified),
    abdmVerifiedAt: patient.abdmVerifiedAt || null,
    hipLinked: Boolean(patient.hipLinked),
    careContextId: patient.careContextId || '',
    careContextStatus: patient.careContextStatus || '',
    linkedAt: patient.linkedAt || null,
    syncStatus: patient.syncStatus || '',
    registrationSource: patient.registrationSource || 'RECEPTION',
    hasPortal: Boolean(patient.patientAuth),
    portalLoggedIn: Boolean(patient.patientAuth?.lastLoginAt),
    visitType: null,
    department: '',
    doctor: '',
    visitDate: patient.createdAt,
    token: '',
    paymentStatus: '',
    paymentMode: '',
    registrationFee: null,
    status: 'Registered',
    referBy: '',
    sponsor: '',
    createdAt: patient.createdAt,
  };
}

async function registerPatient(req, res) {
  const body = req.body || {};
  const visitId = normalizeString(body.visitId);

  const fullName = normalizeString(body.fullName || body.name);
  const mobile = normalizeString(body.phone || body.mobile);
  const gender = normalizeString(body.gender);
  const address = normalizeString(body.address);

  const dob = body.dob ? new Date(body.dob) : null;
  const dobValid = !dob || !Number.isNaN(dob.getTime());
  const ageFromBody = parseOptionalInt(body.age);

  if (!fullName) return res.status(400).json({ message: 'Full name is required' });
  if (!/^\d{10}$/.test(mobile)) return res.status(400).json({ message: 'Enter a valid 10-digit mobile number' });
  if (!dobValid) return res.status(400).json({ message: 'Invalid date of birth' });
  if (!dob && (ageFromBody == null || ageFromBody < 0)) {
    return res.status(400).json({ message: 'Age is required when Date of birth is not provided' });
  }
  if (!gender) return res.status(400).json({ message: 'Gender is required' });
  if (!address) return res.status(400).json({ message: 'Address is required' });

  const genderEnum =
    String(gender).toLowerCase() === 'male' ? 'MALE' : String(gender).toLowerCase() === 'female' ? 'FEMALE' : 'OTHER';

  const uhid = normalizeString(body.uhid) || (await generateUniqueUHID());
  const age = ageFromBody ?? calculateAgeFromDob(dob);

  const patientData = {
    name: fullName,
    uhid,
    age,
    gender: genderEnum,
    mobile,
    dob,
    aadhaarId: normalizeString(body.aadhaarId) || null,
    abhaNumber: normalizeString(body.abhaNumber) || null,
    abhaAddress: normalizeString(body.abhaAddress) || null,
    abhaStatus: normalizeString(body.abhaStatus) || null,
    phrAddress: parsePhrAddress(body.phrAddress),
    healthIdNumber: normalizeString(body.healthIdNumber || body.abhaNumber) || null,
    isAbhaVerified: Boolean(body.isAbhaVerified) && Boolean(normalizeString(body.abhaNumber) || normalizeString(body.abhaAddress)),
    mobileVerified: Boolean(body.mobileVerified),
    aadhaarVerified: Boolean(body.aadhaarVerified),
    abdmVerifiedAt: (() => {
      if (body.abdmVerifiedAt) {
        const d = new Date(body.abdmVerifiedAt);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      if (Boolean(body.isAbhaVerified) && Boolean(normalizeString(body.abhaNumber) || normalizeString(body.abhaAddress))) {
        return new Date();
      }
      return null;
    })(),
    address,
    bloodGroup: normalizeString(body.bloodGroup) || null,
    allergies: normalizeString(body.allergies) || null,
    heightCm: parseOptionalInt(body.heightCm),
    weightKg: parseOptionalInt(body.weightKg),
    emergencyName: normalizeString(body.emergencyName) || null,
    emergencyPhone: normalizeString(body.emergencyPhone) || null,
    emergencyRelation: normalizeString(body.emergencyRelation) || null,
  };

  const visitType = mapVisitTypeToEnum(body.visitType);
  const status = mapVisitStatusToEnum(body.status);
  const visitDate = body.visitDate ? new Date(body.visitDate) : new Date();
  const visitDateValid = !Number.isNaN(visitDate.getTime());
  if (!visitDateValid) return res.status(400).json({ message: 'Invalid visitDate' });

  const referBy = normalizeString(body.referBy) || null;
  const sponsor = normalizeString(body.sponsor) || null;
  const ayushmanVisit = applyAyushmanVisitBilling({
    sponsor,
    registrationFee: parseOptionalInt(body.registrationFee),
    paymentStatus: normalizeString(body.paymentStatus) || null,
    paymentMode: normalizeString(body.paymentMode) || null,
  });
  const registrationFee = ayushmanVisit.registrationFee;
  const paymentMode = ayushmanVisit.paymentMode;
  const paymentStatus = ayushmanVisit.paymentStatus;

  // Token should be generated at appointment booking time (not at registration).
  // Keep these fields null during registration.
  const queueNumber = null;
  const token = null;

  const department = normalizeString(body.department) || null;
  const doctorName = normalizeString(body.doctor || body.doctorName) || null;

  // Remote Postgres (Render) can be slow; default interactive tx timeout (5s) can expire mid-request.
  // Increase timeout so patient registration doesn't randomly fail under latency.
  const saved = await prisma.$transaction(
    async (tx) => {
    const existing = await tx.patient.findUnique({
      where: { uhid },
      select: { id: true, registrationNumber: true },
    });

    let patient;
    if (existing?.id) {
      patient = await tx.patient.update({
        where: { id: existing.id },
        data: patientData,
        select: {
          id: true,
          uhid: true,
          name: true,
          mobile: true,
          dob: true,
          age: true,
          gender: true,
          address: true,
          abhaNumber: true,
          abhaAddress: true,
          abhaStatus: true,
          phrAddress: true,
          healthIdNumber: true,
          isAbhaVerified: true,
          mobileVerified: true,
          aadhaarVerified: true,
          abdmVerifiedAt: true,
          regSeq: true,
          registrationNumber: true,
        },
      });
    } else {
      patient = await tx.patient.create({
        data: patientData,
        select: {
          id: true,
          uhid: true,
          name: true,
          mobile: true,
          dob: true,
          age: true,
          gender: true,
          address: true,
          abhaNumber: true,
          abhaAddress: true,
          abhaStatus: true,
          phrAddress: true,
          healthIdNumber: true,
          isAbhaVerified: true,
          mobileVerified: true,
          aadhaarVerified: true,
          abdmVerifiedAt: true,
          regSeq: true,
          registrationNumber: true,
        },
      });

      // Generate REG-xxx after we have the auto-increment regSeq.
      const regNo = formatSeq('REG', patient.regSeq);
      patient = await tx.patient.update({
        where: { id: patient.id },
        data: { registrationNumber: regNo },
        select: {
          id: true,
          uhid: true,
          name: true,
          mobile: true,
          dob: true,
          age: true,
          gender: true,
          address: true,
          abhaNumber: true,
          abhaAddress: true,
          abhaStatus: true,
          phrAddress: true,
          healthIdNumber: true,
          isAbhaVerified: true,
          mobileVerified: true,
          aadhaarVerified: true,
          abdmVerifiedAt: true,
          regSeq: true,
          registrationNumber: true,
        },
      });
    }

    // If editing from Patient List, update the same visit row (no duplicate list entry).
    let visit;
    if (visitId) {
      const updated = await tx.receptionVisit.updateMany({
        where: { id: visitId, patientId: patient.id },
        data: {
          visitType,
          status,
          visitDate,
          department,
          doctorName,
          registrationFee,
          paymentMode,
          paymentStatus,
          referBy,
          sponsor,
        },
      });
      if (!updated.count) {
        throw new Error('Visit not found for update');
      }
      visit = await tx.receptionVisit.findUnique({
        where: { id: visitId },
        include: {
          patient: { select: { uhid: true, name: true, mobile: true, dob: true, age: true, gender: true, address: true } },
        },
      });
    } else {
      // Edit mode without visitId: update the latest existing visit instead of creating duplicate
      const existingVisit = await tx.receptionVisit.findFirst({
        where: { patientId: patient.id },
        orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      });
      if (existingVisit) {
        visit = await tx.receptionVisit.update({
          where: { id: existingVisit.id },
          data: {
            visitType,
            status,
            visitDate,
            department,
            doctorName,
            registrationFee,
            paymentMode,
            paymentStatus,
            referBy,
            sponsor,
          },
          include: {
            patient: {
              select: {
                uhid: true,
                name: true,
                mobile: true,
                dob: true,
                age: true,
                gender: true,
                address: true,
                abhaNumber: true,
                abhaAddress: true,
                abhaStatus: true,
                phrAddress: true,
                healthIdNumber: true,
                isAbhaVerified: true,
          mobileVerified: true,
          aadhaarVerified: true,
          abdmVerifiedAt: true,
                registrationNumber: true,
              },
            },
          },
        });
      } else {
        visit = await tx.receptionVisit.create({
          data: {
            patientId: patient.id,
            visitType,
            status,
            visitDate,
            token,
            queueNumber,
            department,
            doctorName,
            registrationFee,
            paymentMode,
            paymentStatus,
            referBy,
            sponsor,
          },
          include: {
            patient: {
              select: {
                uhid: true,
                name: true,
                mobile: true,
                dob: true,
                age: true,
                gender: true,
                address: true,
                abhaNumber: true,
                abhaAddress: true,
                abhaStatus: true,
                phrAddress: true,
                healthIdNumber: true,
                isAbhaVerified: true,
          mobileVerified: true,
          aadhaarVerified: true,
          abdmVerifiedAt: true,
                registrationNumber: true,
              },
            },
          },
        });
      }
    }

    // Enable Patient Portal if requested
    if (req.body.enablePortal) {
      const portalPassword = req.body.portalPassword || '';
      if (!portalPassword || portalPassword.length < 6) throw new Error('Portal password must be at least 6 characters');
      const hashed = await bcrypt.hash(portalPassword, 12);
      const existingAuth = await tx.patientAuth.findUnique({ where: { patientId: patient.id } });
      if (!existingAuth) {
        await tx.patientAuth.create({ data: { patientId: patient.id, password: hashed } });
      }
    }

    return { patient, visit };
  },
    { maxWait: 10_000, timeout: 25_000 },
  );

  if (saved.visit?.department === 'Emergency & Trauma Care') {
    const title = 'Emergency Patient Registered';
    const msg = `Patient ${saved.patient?.name || 'Patient'} (${saved.patient?.uhid || ''}) registered under Emergency & Trauma Care department.`;
    await triggerCriticalAlert(title, msg);
  }

  return res.status(201).json({
    message: 'Patient registered',
    patient: saved.patient,
    visit: flattenVisitRow(saved.visit),
    hipLink: null,
  });
}

async function listPatients(req, res) {
  const q = normalizeString(req.query.q);
  const visitType = normalizeString(req.query.visitType);
  const gender = normalizeString(req.query.gender);
  const department = normalizeString(req.query.department);
  const date = normalizeString(req.query.date); // yyyy-mm-dd
  const dateFrom = normalizeString(req.query.dateFrom);
  const dateTo = normalizeString(req.query.dateTo);
 
  const forExport = String(req.query.export || '') === '1';
  const page = Math.max(1, parseOptionalInt(req.query.page) || 1);
  const pageSize = forExport
    ? Math.min(5000, Math.max(1, parseOptionalInt(req.query.pageSize) || 5000))
    : Math.min(50, Math.max(1, parseOptionalInt(req.query.pageSize) || 8));
  const skip = forExport ? 0 : (page - 1) * pageSize;
 
  const where = {};
  if (visitType && visitType.toLowerCase() !== 'all') where.visitType = mapVisitTypeToEnum(visitType);
  if (department && department.toLowerCase() !== 'all') where.department = department;
 
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) where.visitDate = { gte: toStartOfDay(d), lte: toEndOfDay(d) };
  } else {
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      const d0 = new Date(`${dateFrom}T00:00:00.000Z`);
      if (!Number.isNaN(d0.getTime())) where.visitDate = { ...(where.visitDate || {}), gte: toStartOfDay(d0) };
    }
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      const d1 = new Date(`${dateTo}T00:00:00.000Z`);
      if (!Number.isNaN(d1.getTime())) where.visitDate = { ...(where.visitDate || {}), lte: toEndOfDay(d1) };
    }
  }

  const patientWhere = {};
  if (q) {
    patientWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { uhid: { contains: q, mode: 'insensitive' } },
      { mobile: { contains: q } },
    ];
  }
  if (gender && gender.toLowerCase() !== 'all') {
    patientWhere.gender = gender.toLowerCase() === 'male' ? 'MALE' : gender.toLowerCase() === 'female' ? 'FEMALE' : 'OTHER';
  }

  if (Object.keys(patientWhere).length) where.patient = patientWhere;

  const [total, rows, selfPatients] = await Promise.all([
    prisma.receptionVisit.count({ where }),
    prisma.receptionVisit.findMany({
      where,
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: pageSize,
      include: {
        patient: {
          select: {
            uhid: true,
            registrationNumber: true,
            name: true,
            mobile: true,
            dob: true,
            age: true,
            gender: true,
            address: true,
            abhaNumber: true,
            abhaAddress: true,
            abhaStatus: true,
            phrAddress: true,
            healthIdNumber: true,
            isAbhaVerified: true,
          mobileVerified: true,
          aadhaarVerified: true,
          abdmVerifiedAt: true,
          hipLinked: true,
          careContextId: true,
          careContextStatus: true,
          linkedAt: true,
          syncStatus: true,
registrationSource: true,
            patientAuth: { select: { id: true, lastLoginAt: true } },
          },
        },
      },
    }),
    prisma.patient.findMany({
      where: { registrationSource: 'SELF' },
      select: {
        id: true,
        uhid: true,
        registrationNumber: true,
        name: true,
        mobile: true,
        dob: true,
        age: true,
        gender: true,
        address: true,
        abhaNumber: true,
        abhaAddress: true,
        abhaStatus: true,
        phrAddress: true,
        healthIdNumber: true,
        isAbhaVerified: true,
          mobileVerified: true,
          aadhaarVerified: true,
          abdmVerifiedAt: true,
          hipLinked: true,
          careContextId: true,
          careContextStatus: true,
          linkedAt: true,
          syncStatus: true,
registrationSource: true,
        createdAt: true,
        patientAuth: { select: { id: true, lastLoginAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const today = new Date();
  const todayStart = toStartOfDay(today);
  const todayEnd = toEndOfDay(today);
  const [todayRegs, ipdActive, discharged] = await Promise.all([
    prisma.receptionVisit.count({ where: { visitDate: { gte: todayStart, lte: todayEnd } } }),
    prisma.receptionVisit.count({ where: { visitType: 'IPD', NOT: [{ status: 'DISCHARGED' }] } }),
    prisma.receptionVisit.count({ where: { status: 'DISCHARGED' } }),
  ]);

  const items = rows.map(flattenVisitRow);
  // Deduplicate by UHID keeping the latest visit per patient
  const seenUhids = new Set();
  const deduped = [];
  for (const item of items) {
    if (item.uhid && seenUhids.has(item.uhid)) continue;
    if (item.uhid) seenUhids.add(item.uhid);
    deduped.push(item);
  }
  const selfItems = selfPatients.map(flattenPatientRow);
  // Merge self-registered patients into the list, avoiding duplicates by uhid
  const existingUhids = new Set(deduped.map((i) => i.uhid).filter(Boolean));
  for (const s of selfItems) {
    if (s.uhid && !existingUhids.has(s.uhid)) {
      deduped.unshift(s);
      existingUhids.add(s.uhid);
    }
  }

  return res.json({
    page,
    pageSize,
    total: total + selfItems.length,
    items: deduped,
    stats: {
      total,
      todayRegs,
      ipdActive,
      discharged,
    },
  });
}

async function searchPatients(req, res) {
  const q = normalizeString(req.query.q);
  const where = {};
  if (q && q.length >= 2) {
    where.patient = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { uhid: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q } },
      ],
    };
  }

  const visits = await prisma.receptionVisit.findMany({
    where,
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    take: 30,
    include: {
      patient: {
        select: {
          uhid: true,
          registrationNumber: true,
          name: true,
          mobile: true,
          dob: true,
          age: true,
          gender: true,
          address: true,
          abhaNumber: true,
          abhaAddress: true,
          abhaStatus: true,
          phrAddress: true,
          healthIdNumber: true,
          isAbhaVerified: true,
          mobileVerified: true,
          aadhaarVerified: true,
          abdmVerifiedAt: true,
        },
      },
    },
  });

  const seen = new Set();
  const uniq = [];
  for (const v of visits) {
    const uhid = v.patient?.uhid;
    if (!uhid) continue;
    if (seen.has(uhid)) continue;
    seen.add(uhid);
    uniq.push(flattenVisitRow(v));
    if (uniq.length >= 10) break;
  }

  return res.json({ items: uniq });
}

async function getPatientDetails(req, res) {
  try {
    const uhid = normalizeString(req.params.uhid);
    if (!uhid) return res.status(400).json({ message: 'UHID is required' });

    const patient = await prisma.patient.findUnique({
      where: { uhid },
      select: {
        id: true, uhid: true, registrationNumber: true, name: true, mobile: true,
        dob: true, age: true, gender: true, address: true, aadhaarId: true,
        abhaNumber: true, abhaAddress: true, abhaStatus: true, phrAddress: true, healthIdNumber: true,
        isAbhaVerified: true, mobileVerified: true, aadhaarVerified: true, abdmVerifiedAt: true,
        hipLinked: true, careContextId: true, careContextStatus: true, linkedAt: true, syncStatus: true,
        hipLinkRequestId: true, hipReferenceNumber: true,
        bloodGroup: true, allergies: true, heightCm: true, weightKg: true,
        emergencyName: true, emergencyPhone: true, emergencyRelation: true, createdAt: true,
      },
    });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const [visits, activeAdmission, latestConsultation, latestAppt, appts] = await Promise.all([
      prisma.receptionVisit.findMany({
        where: { patientId: patient.id },
        orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
        take: 30,
      }),
      prisma.admission.findFirst({
        where: { patientId: patient.id, dischargeDate: null, status: { in: OPEN_ADMISSION_STATUSES } },
        orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, ipdNumber: true, admissionDate: true, status: true, department: true, admissionType: true, bedNumber: true, bedId: true, wardId: true },
      }),
      prisma.consultation.findFirst({
        where: { patientId: patient.id },
        orderBy: [{ createdAt: 'desc' }],
        select: { disposition: true, referredDepartment: true, referredDoctorId: true },
      }),
      prisma.appointment.findFirst({
        where: { patientId: patient.id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { token: true, opdNumber: true, date: true, createdAt: true },
      }),
      prisma.appointment.findMany({
        where: { patientId: patient.id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        select: { fee: true, paymentStatus: true, date: true, createdAt: true },
      }),
    ]);

    // Resolve bed/ward names separately to avoid relation FK errors
    let wardName = '';
    let bedCode = '';
    if (activeAdmission) {
      if (activeAdmission.wardId) {
        try {
          const w = await prisma.ward.findUnique({ where: { id: activeAdmission.wardId }, select: { name: true } });
          wardName = w?.name || '';
        } catch { /* ignore */ }
      }
      if (activeAdmission.bedId) {
        try {
          const b = await prisma.bed.findUnique({ where: { id: activeAdmission.bedId }, select: { code: true } });
          bedCode = b?.code || '';
        } catch { /* ignore */ }
      }
    }

    // Resolve referred doctor name separately
    let referredDoctorName = '';
    if (latestConsultation?.referredDoctorId) {
      try {
        const doc = await prisma.doctor.findUnique({
          where: { id: latestConsultation.referredDoctorId },
          select: { user: { select: { name: true } } },
        });
        referredDoctorName = doc?.user?.name || '';
      } catch { /* ignore */ }
    }

    const latest = visits[0] || null;
    const normalizePay = (v) => String(v || '').trim().toUpperCase();
    const hasAnyAppointment = Array.isArray(appts) && appts.length > 0;
    const sponsorLatest = latest?.sponsor || '';
    const billing = hasAnyAppointment
        ? (() => {
            let total = 0, paid = 0, pending = 0, lastPaymentDate = null;
            for (const a of appts) {
              const fee = typeof a.fee === 'number' ? a.fee : 0;
              if (fee <= 0) continue;
              total += fee;
              const ps = normalizePay(a.paymentStatus);
              if (ps === 'PAID') { paid += fee; if (!lastPaymentDate) lastPaymentDate = a.date || a.createdAt || null; }
              else if (ps === 'PENDING') { pending += fee; }
            }
            return { total, paid, pending, lastPaymentDate };
          })()
        : null;

    const genderLabel = patient.gender === 'MALE' ? 'Male' : patient.gender === 'FEMALE' ? 'Female' : patient.gender === 'OTHER' ? 'Other' : null;

    return res.json({
      id: patient.id,
      latestVisitId: latest?.id || null,
      uhid: patient.uhid,
      registrationNumber: patient.registrationNumber || '',
      name: patient.name,
      phone: patient.mobile,
      dob: patient.dob,
      age: patient.age ?? calculateAgeFromDob(patient.dob),
      gender: genderLabel,
      registrationFee: latest?.registrationFee ?? null,
      paymentMode: latest?.paymentMode || '',
      paymentStatus: latest?.paymentStatus || '',
      status: latest ? visitEnumToLabel(latest.status) : 'Waiting',
      visitType: latest?.visitType || 'OPD',
      doctor: latest?.doctorName || '',
      token: latest?.token || '',
      appointmentToken: latestAppt?.token || '',
      opdNumber: latestAppt?.opdNumber || '',
      appointmentDate: latestAppt?.date || latestAppt?.createdAt || null,
      department: latest?.department || '',
      address: patient.address || '',
      aadhaarId: patient.aadhaarId || '',
      abhaNumber: patient.abhaNumber || patient.healthIdNumber || '',
      abhaAddress: patient.abhaAddress || '',
      abhaStatus: patient.abhaStatus || '',
      phrAddress: Array.isArray(patient.phrAddress) ? patient.phrAddress : [],
      healthIdNumber: patient.healthIdNumber || patient.abhaNumber || '',
      isAbhaVerified: Boolean(patient.isAbhaVerified),
      mobileVerified: Boolean(patient.mobileVerified),
      aadhaarVerified: Boolean(patient.aadhaarVerified),
      abdmVerifiedAt: patient.abdmVerifiedAt || null,
      hipLinked: Boolean(patient.hipLinked),
      careContextId: patient.careContextId || '',
      careContextStatus: patient.careContextStatus || '',
      linkedAt: patient.linkedAt || null,
      syncStatus: patient.syncStatus || '',
      bloodGroup: patient.bloodGroup || '',
      allergies: patient.allergies || '',
      heightCm: patient.heightCm ?? null,
      weightKg: patient.weightKg ?? null,
      emergencyName: patient.emergencyName || '',
      emergencyPhone: patient.emergencyPhone || '',
      emergencyRelation: patient.emergencyRelation || '',
      referBy: latest?.referBy || '',
      sponsor: sponsorLatest,
      isAyushman: isAyushmanSponsor(sponsorLatest),
      hasActiveIpdAdmission: Boolean(activeAdmission),
      activeAdmission: activeAdmission ? { id: activeAdmission.id, ipdNumber: activeAdmission.ipdNumber || '', admissionDate: activeAdmission.admissionDate, status: activeAdmission.status, department: activeAdmission.department || '', admissionType: activeAdmission.admissionType || '', ward: wardName, bed: bedCode || activeAdmission.bedNumber || '' } : null,
      admission: activeAdmission ? { ward: wardName || activeAdmission.admissionType || 'General Ward', bed: bedCode || activeAdmission.bedNumber || '', date: activeAdmission.admissionDate, ipdNumber: activeAdmission.ipdNumber || '', transferHistory: [] } : null,
      billing,
      consultation: { status: latest?.status === 'COMPLETED' ? 'Completed' : 'Pending', lastDate: latest?.visitDate || patient.createdAt, visitStatus: latest ? visitEnumToLabel(latest.status) : 'Waiting', disposition: latestConsultation?.disposition || null, referredDepartment: latestConsultation?.referredDepartment || null, referredDoctorId: latestConsultation?.referredDoctorId || null, referredDoctorName },
      history: visits.slice().reverse().map((v) => ({ date: v.visitDate, doctor: v.doctorName || '', department: v.department || '', visitType: v.visitType, status: visitEnumToLabel(v.status), token: v.token || '' })).reverse(),
      alerts: [...((billing?.pending || 0) > 0 ? [{ type: 'payment', text: 'Pending payment due' }] : []), ...(latest?.visitType === 'OPD' && visitEnumToLabel(latest?.status) === 'Waiting' ? [{ type: 'consult', text: `Waiting for Dr. ${latest?.doctorName || '—'}` }] : [])],
    });
  } catch (err) {
    console.error('[getPatientDetails] Error:', err?.message || err);
    console.error('[getPatientDetails] Stack:', err?.stack || '(no stack)');
    return res.status(500).json({ message: err?.message || 'Failed to load patient details' });
  }
}

async function admitPatient(req, res) {
  const uhid = normalizeString(req.params.uhid);
  if (!uhid) return res.status(400).json({ message: 'UHID is required' });

  const patient = await prisma.patient.findUnique({ where: { uhid }, select: { id: true } });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const latest = await prisma.receptionVisit.findFirst({
    where: { patientId: patient.id },
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, visitType: true },
  });
  if (!latest) return res.status(404).json({ message: 'Visit not found for patient' });
  if (latest.visitType === 'IPD') return res.json({ message: 'Already admitted' });

  await prisma.receptionVisit.update({
    where: { id: latest.id },
    data: { visitType: 'IPD', status: 'ADMITTED' },
  });

  return res.json({ message: 'Patient admitted' });
}

module.exports = {
  registerPatient,
  listPatients,
  searchPatients,
  getPatientDetails,
  admitPatient,
};

