const { prisma } = require('../../../config/prisma');
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
              registrationNumber: true,
            },
          },
        },
      });
    }

    return { patient, visit };
  },
    { maxWait: 10_000, timeout: 25_000 },
  );

  return res.status(201).json({
    message: 'Patient registered',
    patient: saved.patient,
    visit: flattenVisitRow(saved.visit),
  });
}

async function listPatients(req, res) {
  const q = normalizeString(req.query.q);
  const visitType = normalizeString(req.query.visitType);
  const gender = normalizeString(req.query.gender);
  const department = normalizeString(req.query.department);
  const date = normalizeString(req.query.date); // yyyy-mm-dd

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

  const [total, rows] = await Promise.all([
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
          },
        },
      },
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

  return res.json({
    page,
    pageSize,
    total,
    items: rows.map(flattenVisitRow),
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
  if (!q || q.length < 2) return res.json({ items: [] });

  const visits = await prisma.receptionVisit.findMany({
    where: {
      patient: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { uhid: { contains: q, mode: 'insensitive' } },
          { mobile: { contains: q } },
        ],
      },
    },
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    take: 15,
    include: {
      patient: { select: { uhid: true, registrationNumber: true, name: true, mobile: true, dob: true, age: true, gender: true, address: true } },
    },
  });

  // de-dupe by UHID
  const seen = new Set();
  const uniq = [];
  for (const v of visits) {
    const uhid = v.patient?.uhid;
    if (!uhid) continue;
    if (seen.has(uhid)) continue;
    seen.add(uhid);
    uniq.push(flattenVisitRow(v));
    if (uniq.length >= 7) break;
  }

  return res.json({ items: uniq });
}

async function getPatientDetails(req, res) {
  const uhid = normalizeString(req.params.uhid);
  if (!uhid) return res.status(400).json({ message: 'UHID is required' });

  const patient = await prisma.patient.findUnique({
    where: { uhid },
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
      aadhaarId: true,
      bloodGroup: true,
      allergies: true,
      heightCm: true,
      weightKg: true,
      emergencyName: true,
      emergencyPhone: true,
      emergencyRelation: true,
      createdAt: true,
    },
  });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const visits = await prisma.receptionVisit.findMany({
    where: { patientId: patient.id },
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    take: 30,
  });

  const latest = visits[0] || null;

  // Token should appear only after appointment is booked.
  // So, read token from Appointment (source of truth), not from ReceptionVisit.
  const latestAppt = await prisma.appointment.findFirst({
    where: { patientId: patient.id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { token: true, opdNumber: true, date: true, createdAt: true },
  });

  // Billing summary should come from booked appointments (not from registration fee)
  const appts = await prisma.appointment.findMany({
    where: { patientId: patient.id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    select: { fee: true, paymentStatus: true, date: true, createdAt: true },
  });

  const normalizePay = (v) => String(v || '').trim().toUpperCase();
  const hasAnyAppointment = Array.isArray(appts) && appts.length > 0;
  const sponsorLatest = latest?.sponsor || '';
  const billing = hasAnyAppointment
      ? (() => {
          let total = 0;
          let paid = 0;
          let pending = 0;
          let lastPaymentDate = null;

          for (const a of appts) {
            const fee = typeof a.fee === 'number' ? a.fee : 0;
            if (fee <= 0) continue;
            total += fee;
            const ps = normalizePay(a.paymentStatus);
            if (ps === 'PAID') {
              paid += fee;
              if (!lastPaymentDate) lastPaymentDate = a.date || a.createdAt || null;
            } else if (ps === 'PENDING') {
              pending += fee;
            }
          }

          return { total, paid, pending, lastPaymentDate };
        })()
      : null;

  const g = String(patient.gender || '');
  const genderLabel = g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : g === 'OTHER' ? 'Other' : null;

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
    status: latest ? visitEnumToLabel(latest.status) : 'Waiting',
    visitType: latest?.visitType || 'OPD',
    doctor: latest?.doctorName || '',
    token: latest?.token || '', // legacy compatibility; UI should prefer appointmentToken
    appointmentToken: latestAppt?.token || '',
    opdNumber: latestAppt?.opdNumber || '',
    appointmentDate: latestAppt?.date || latestAppt?.createdAt || null,
    department: latest?.department || '',
    address: patient.address || '',
    aadhaarId: patient.aadhaarId || '',
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
    admission:
      latest?.visitType === 'IPD' || latest?.status === 'ADMITTED'
        ? {
            ward: 'General Ward',
            bed: 'G-04',
            date: latest?.visitDate || patient.createdAt,
            room: 'G-1',
            transferHistory: [],
          }
        : null,
    billing,
    consultation: {
      status: latest?.status === 'COMPLETED' ? 'Completed' : 'Pending',
      lastDate: latest?.visitDate || patient.createdAt,
      visitStatus: latest ? visitEnumToLabel(latest.status) : 'Waiting',
    },
    history: visits
      .slice()
      .reverse()
      .map((v) => ({
        date: v.visitDate,
        doctor: v.doctorName || '',
        department: v.department || '',
        visitType: v.visitType,
        status: visitEnumToLabel(v.status),
        token: v.token || '',
      }))
      .reverse(),
    alerts: [
      ...((billing?.pending || 0) > 0 ? [{ type: 'payment', text: 'Pending payment due' }] : []),
      ...(latest?.visitType === 'OPD' && visitEnumToLabel(latest?.status) === 'Waiting'
        ? [{ type: 'consult', text: `Waiting for Dr. ${latest?.doctorName || '—'}` }]
        : []),
    ],
  });
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

