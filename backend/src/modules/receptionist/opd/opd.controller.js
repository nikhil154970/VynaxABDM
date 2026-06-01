const { prisma } = require('../../../config/prisma');

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

function apptStatusToLabel(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'WAITING') return 'Waiting';
  if (v === 'IN_PROGRESS') return 'In Consultation';
  if (v === 'COMPLETED') return 'Completed';
  return v || 'Waiting';
}

function visitTypeLabel(v) {
  const s = String(v || '').toUpperCase();
  if (s === 'IPD') return 'IPD';
  return 'OPD';
}

function visitStatusToLabel(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'WAITING') return 'Waiting';
  if (v === 'IN_CONSULTATION') return 'In Consultation';
  if (v === 'COMPLETED') return 'Completed';
  if (v === 'ADMITTED') return 'Admitted';
  if (v === 'ACTIVE') return 'Active';
  if (v === 'DISCHARGED') return 'Discharged';
  return v || 'Waiting';
}

function safeISODateOnly(d) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/** Human-readable test names from Consultation.labTests JSON (array of { testName, … }). */
function labelsFromLabTestsJson(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    if (x && typeof x === 'object') {
      const n = x.testName || x.name || x.labTest || x.label;
      if (n) out.push(String(n).trim());
    }
  }
  return out.filter(Boolean);
}

async function getTodayOPD(req, res) {
  const day = parseDateOnly(req.query.date) || new Date();
  const dayStart = toStartOfDay(day);
  const dayEnd = toEndOfDay(day);

  const rows = await prisma.appointment.findMany({
    where: { date: { gte: dayStart, lte: dayEnd } },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      opdNumber: true,
      token: true,
      date: true,
      time: true,
      status: true,
      department: true,
      patient: { select: { id: true, uhid: true, name: true, mobile: true, age: true, gender: true } },
      doctor: { select: { id: true, user: { select: { name: true } } } },
    },
  });

  const apptIds = rows.map((r) => r.id);
  const latestConsultByApptId = new Map();
  const latestConsultByPatientId = new Map();
  if (apptIds.length) {
    const consults = await prisma.consultation.findMany({
      where: {
        OR: [
          { appointmentId: { in: apptIds } },
          { patientId: { in: rows.map((r) => r.patient?.id).filter(Boolean) }, createdAt: { gte: dayStart, lte: dayEnd } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }],
      take: Math.min(500, apptIds.length * 3),
      select: {
        appointmentId: true,
        patientId: true,
        createdAt: true,
        symptoms: true,
        diagnosis: true,
        prescription: true,
        followUpDate: true,
        disposition: true,
        labTests: true,
      },
    });
    for (const c of consults) {
      if (!c.appointmentId) continue;
      if (!latestConsultByApptId.has(c.appointmentId)) latestConsultByApptId.set(c.appointmentId, c);
    }
    for (const c of consults) {
      if (!c.patientId) continue;
      if (!latestConsultByPatientId.has(c.patientId)) latestConsultByPatientId.set(c.patientId, c);
    }
  }

  const genderLabel = (g) => {
    const s = String(g || '').toUpperCase();
    if (s === 'MALE') return 'Male';
    if (s === 'FEMALE') return 'Female';
    if (s === 'OTHER') return 'Other';
    return '';
  };

  return res.json({
    date: safeISODateOnly(dayStart),
    items: rows.map((a) => ({
      consultation: latestConsultByApptId.get(a.id) || latestConsultByPatientId.get(a.patient?.id) || null,
      id: a.id,
      opdNumber: a.opdNumber || '',
      token: a.token,
      patientId: a.patient?.id || null,
      patientName: a.patient?.name || '',
      uhid: a.patient?.uhid || null,
      mobile: a.patient?.mobile || '',
      age: a.patient?.age ?? null,
      gender: genderLabel(a.patient?.gender),
      doctor: a.doctor?.user?.name || '',
      doctorId: a.doctor?.id || null,
      department: a.department || '',
      timeSlot: a.time || '',
      status: apptStatusToLabel(a.status),
      visitType: 'OPD',
    })),
  });
}

async function listHistoryPatients(req, res) {
  const q = normalizeString(req.query.q).toLowerCase();

  // Latest consultations per patient (across all doctors)
  const latestConsultations = await prisma.consultation.findMany({
    where: q
      ? {
          patient: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { uhid: { contains: q, mode: 'insensitive' } },
              { mobile: { contains: q } },
            ],
          },
        }
      : {},
    orderBy: [{ createdAt: 'desc' }],
    take: 500, // cap; de-duped to unique UHIDs below
    select: {
      id: true,
      createdAt: true,
      patientId: true,
      disposition: true,
      labTests: true,
      patient: { select: { uhid: true, name: true, mobile: true } },
      doctor: { select: { user: { select: { name: true } } } },
    },
  });

  // De-dupe by UHID keeping latest
  const seen = new Set();
  const items = [];
  const patientIds = [];
  for (const c of latestConsultations) {
    const uhid = c.patient?.uhid;
    if (!uhid) continue;
    if (seen.has(uhid)) continue;
    seen.add(uhid);
    items.push({
      patientId: c.patientId,
      uhid,
      name: c.patient?.name || '',
      mobile: c.patient?.mobile || '',
      latestVisitDate: c.createdAt,
      latestDoctor: c.doctor?.user?.name || '—',
      latestDepartment: '—',
      latestStatus: 'Completed',
      latestDisposition: c.disposition || 'NORMAL',
      labTestLabels: labelsFromLabTestsJson(c.labTests),
    });
    patientIds.push(c.patientId);
    if (items.length >= 150) break;
  }

  // Batch enrich from ReceptionVisit + Appointment (interconnected sources)
  const [visits, appts] = await Promise.all([
    prisma.receptionVisit.findMany({
      where: { patientId: { in: patientIds } },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      select: { patientId: true, department: true, doctorName: true, status: true, visitDate: true },
      take: Math.max(200, patientIds.length * 5),
    }),
    prisma.appointment.findMany({
      where: { patientId: { in: patientIds } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        patientId: true,
        department: true,
        status: true,
        date: true,
        opdNumber: true,
        doctor: { select: { user: { select: { name: true } } } },
      },
      take: Math.max(200, patientIds.length * 5),
    }),
  ]);

  const latestVisitByPatientId = new Map();
  for (const v of visits) {
    if (!latestVisitByPatientId.has(v.patientId)) latestVisitByPatientId.set(v.patientId, v);
  }
  const latestApptByPatientId = new Map();
  for (const a of appts) {
    if (!latestApptByPatientId.has(a.patientId)) latestApptByPatientId.set(a.patientId, a);
  }

  const enriched = items.map((row) => {
    const v = latestVisitByPatientId.get(row.patientId) || null;
    const a = latestApptByPatientId.get(row.patientId) || null;
    return {
      uhid: row.uhid,
      opdNumber: a?.opdNumber || '',
      latestAppointmentId: a?.id || null,
      name: row.name,
      mobile: row.mobile,
      latestVisitDate: row.latestVisitDate,
      latestDoctor: v?.doctorName || a?.doctor?.user?.name || row.latestDoctor || '—',
      latestDepartment: v?.department || a?.department || '—',
      latestStatus: v?.status ? visitStatusToLabel(v.status) : a?.status ? apptStatusToLabel(a.status) : row.latestStatus || 'Completed',
      latestDisposition: row.latestDisposition || 'NORMAL',
      labTestLabels: row.labTestLabels || [],
    };
  });

  return res.json({ items: enriched });
}

async function getPatientTimeline(req, res) {
  const uhid = normalizeString(req.params.uhid);
  const from = parseDateOnly(req.query.from);
  const to = parseDateOnly(req.query.to);
  const doctor = normalizeString(req.query.doctor);
  const department = normalizeString(req.query.department);
  const visitType = normalizeString(req.query.visitType);

  const patient = await prisma.patient.findUnique({
    where: { uhid },
    select: { id: true, uhid: true, name: true, mobile: true, age: true, gender: true, bloodGroup: true, allergies: true },
  });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const latestVisit = await prisma.receptionVisit.findFirst({
    where: { patientId: patient.id },
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    select: { department: true, doctorName: true, status: true },
  });

  const latestAppt = await prisma.appointment.findFirst({
    where: { patientId: patient.id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { department: true, status: true, doctor: { select: { user: { select: { name: true } } } } },
  });

  const where = { patientId: patient.id };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = toStartOfDay(from);
    if (to) where.createdAt.lte = toEndOfDay(to);
  }
  if (doctor && doctor !== 'All') where.doctor = { user: { name: { equals: doctor } } };
  if (visitType && visitType !== 'All') {
    // We only expose OPD consultation timeline here for now.
    if (visitType.toUpperCase() !== 'OPD') return res.json({ patient, items: [] });
  }

  // Filter by department via appointment join (if available)
  const items = await prisma.consultation.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      createdAt: true,
      symptoms: true,
      diagnosis: true,
      prescription: true,
      followUpDate: true,
      disposition: true,
      labTests: true,
      doctor: { select: { user: { select: { name: true } } } },
    },
  });

  // NOTE: Prisma relation consultation->appointment is not available until migration + prisma generate.
  // Use latest ReceptionVisit department as best-effort filter for now.
  const deptSnap = latestVisit?.department || latestAppt?.department || '';
  const filtered = department && department !== 'All' ? items.filter(() => deptSnap === department) : items;

  return res.json({
    patient,
    items: filtered.map((c) => ({
      id: c.id,
      date: c.createdAt,
      visitType: visitTypeLabel('OPD'),
      doctor: latestVisit?.doctorName || latestAppt?.doctor?.user?.name || c.doctor?.user?.name || '—',
      department: latestVisit?.department || latestAppt?.department || '—',
      status: latestVisit?.status
        ? visitStatusToLabel(latestVisit.status)
        : latestAppt?.status
          ? apptStatusToLabel(latestAppt.status)
          : 'Completed',
      disposition: c.disposition || 'NORMAL',
      symptoms: c.symptoms,
      diagnosis: c.diagnosis,
      notes: '', // reserved
      prescription: c.prescription,
      labTests: c.labTests,
      labTestLabels: labelsFromLabTestsJson(c.labTests),
      labReports: [],
      followUpDate: c.followUpDate,
      followUpRemarks: '',
      billing: { fee: 0, paymentStatus: '—' },
    })),
  });
}

async function getOpdAppointmentDetails(req, res) {
  const id = normalizeString(req.params.id);
  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      opdNumber: true,
      token: true,
      date: true,
      time: true,
      status: true,
      department: true,
      patient: { select: { id: true, uhid: true, name: true, mobile: true, age: true, gender: true } },
      doctor: { select: { id: true, user: { select: { name: true } } } },
    },
  });
  if (!appt) return res.status(404).json({ message: 'Appointment not found' });

  let consult = await prisma.consultation.findFirst({
    where: { appointmentId: appt.id },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      createdAt: true,
      symptoms: true,
      diagnosis: true,
      prescription: true,
      followUpDate: true,
      disposition: true,
      labTests: true,
    },
  });

  // Fallback for legacy consultations where appointmentId wasn't stored:
  // pick latest consultation for same patient+doctor on the same appointment day.
  if (!consult && appt.patient?.id && appt.doctor?.id && appt.date) {
    const dayStart = toStartOfDay(appt.date);
    const dayEnd = toEndOfDay(appt.date);
    consult = await prisma.consultation.findFirst({
      where: {
        patientId: appt.patient.id,
        doctorId: appt.doctor.id,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        createdAt: true,
        symptoms: true,
        diagnosis: true,
        prescription: true,
        followUpDate: true,
        disposition: true,
        labTests: true,
      },
    });
  }

  const genderLabel = (g) => {
    const s = String(g || '').toUpperCase();
    if (s === 'MALE') return 'Male';
    if (s === 'FEMALE') return 'Female';
    if (s === 'OTHER') return 'Other';
    return '';
  };

  const consultationOut = consult
    ? {
        ...consult,
        labTestLabels: labelsFromLabTestsJson(consult.labTests),
      }
    : null;

  return res.json({
    item: {
      id: appt.id,
      opdNumber: appt.opdNumber || '',
      token: appt.token,
      patientId: appt.patient?.id || null,
      patientName: appt.patient?.name || '',
      uhid: appt.patient?.uhid || null,
      mobile: appt.patient?.mobile || '',
      age: appt.patient?.age ?? null,
      gender: genderLabel(appt.patient?.gender),
      doctor: appt.doctor?.user?.name || '',
      doctorId: appt.doctor?.id || null,
      department: appt.department || '',
      timeSlot: appt.time || '',
      status: apptStatusToLabel(appt.status),
      visitType: 'OPD',
      consultation: consultationOut,
    },
  });
}

module.exports = { getTodayOPD, listHistoryPatients, getPatientTimeline, getOpdAppointmentDetails };

