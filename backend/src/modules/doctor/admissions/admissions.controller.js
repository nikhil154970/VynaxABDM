const { prisma } = require('../../../config/prisma');

function ymdFromDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function legacyIpdNumber(id, admissionDate, createdAt) {
  const when = admissionDate || createdAt || new Date();
  const ymd = ymdFromDate(when) || ymdFromDate(new Date());
  const hex = String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase();
  return `IPD-${ymd}-${hex}`;
}

function resolvedIpdNumber(row) {
  const n = String(row?.ipdNumber || '').trim();
  if (n) return n;
  return legacyIpdNumber(row.id, row.admissionDate, row.createdAt);
}

async function getDoctorAdmissions(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

  const admissions = await prisma.admission.findMany({
    where: { doctorId: doctor.id },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      ipdNumber: true,
      status: true,
      bedNumber: true,
      admissionDate: true,
      createdAt: true,
      patient: { select: { id: true, name: true, uhid: true } },
    },
  });

  return res.json({
    admissions: admissions.map((a) => ({
      id: a.id,
      ipd_number: resolvedIpdNumber(a),
      status: a.status,
      bed_number: a.bedNumber || null,
      admission_date: a.admissionDate || a.createdAt,
      createdAt: a.createdAt,
      patient_id: a.patient?.id,
      patient_name: a.patient?.name,
      uhid: a.patient?.uhid || null,
    })),
  });
}

async function getAdmissionById(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

  const { id } = req.params;
  const admission = await prisma.admission.findUnique({
    where: { id },
    select: {
      id: true,
      ipdNumber: true,
      status: true,
      bedNumber: true,
      admissionDate: true,
      createdAt: true,
      doctorId: true,
      patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, basicHistory: true } },
    },
  });

  if (!admission) return res.status(404).json({ message: 'Admission not found' });
  if (admission.doctorId !== doctor.id) return res.status(403).json({ message: 'Access denied' });

  return res.json({
    admission: {
      id: admission.id,
      ipd_number: resolvedIpdNumber(admission),
      status: admission.status,
      bed_number: admission.bedNumber || null,
      admission_date: admission.admissionDate || admission.createdAt,
      createdAt: admission.createdAt,
      patient_id: admission.patient?.id,
      patient_name: admission.patient?.name,
      uhid: admission.patient?.uhid || null,
      patient_age: typeof admission.patient?.age === 'number' ? admission.patient.age : null,
      patient_gender: admission.patient?.gender || null,
      basic_history: admission.patient?.basicHistory || null,
    },
  });
}

module.exports = { getDoctorAdmissions, getAdmissionById };

