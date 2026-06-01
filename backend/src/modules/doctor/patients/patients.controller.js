const { prisma } = require('../../../config/prisma');

async function getDoctorIdFromUser(req) {
  const userId = req.user?.userId;
  if (!userId) return null;
  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return null;
  return doctor.id;
}

function prescriptionToText(prescription) {
  if (!prescription) return '';
  if (typeof prescription === 'string') return prescription;
  if (Array.isArray(prescription)) {
    return prescription
      .map((m) => {
        const name = String(m?.medicine || m?.name || '').trim();
        const dosage = String(m?.dosage || '').trim();
        const duration = String(m?.duration || '').trim();
        const parts = [name, dosage, duration].filter(Boolean);
        return parts.join(' ');
      })
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

async function getHistoryByUHID(req, res) {
  const doctorId = await getDoctorIdFromUser(req);
  if (!doctorId) return res.status(404).json({ message: 'Doctor profile not found' });

  const uhid = String(req.params.uhid || '').trim();
  if (!uhid) return res.status(400).json({ message: 'UHID is required' });

  const patient = await prisma.patient.findUnique({
    where: { uhid },
    select: { id: true, name: true, uhid: true, age: true, gender: true, mobile: true },
  });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const [consultations, admissions] = await Promise.all([
    prisma.consultation.findMany({
      where: { patientId: patient.id, doctorId },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, diagnosis: true, prescription: true, followUpDate: true, createdAt: true },
    }),
    prisma.admission.findMany({
      where: { patientId: patient.id, doctorId },
      orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, status: true, admissionDate: true, createdAt: true },
    }),
  ]);

  const records = [
    ...consultations.map((c) => ({
      id: c.id,
      date: c.createdAt,
      type: 'OPD',
      diagnosis: c.diagnosis,
      prescription: prescriptionToText(c.prescription),
      follow_up: c.followUpDate,
    })),
    ...admissions.map((a) => ({
      id: a.id,
      date: a.admissionDate || a.createdAt,
      type: 'IPD',
      diagnosis: String(a.status || '').replace(/_/g, ' '),
      prescription: '',
      follow_up: null,
    })),
  ].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

  return res.json({
    patient: {
      id: patient.id,
      name: patient.name,
      uhid: patient.uhid,
      age: patient.age ?? null,
      gender: patient.gender ?? null,
      mobile: patient.mobile ?? null,
    },
    records,
  });
}

async function getFullHistoryByPatientId(req, res) {
  const doctorId = await getDoctorIdFromUser(req);
  if (!doctorId) return res.status(404).json({ message: 'Doctor profile not found' });

  const patientId = req.params.id;
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, name: true, uhid: true, age: true, gender: true },
  });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const [consultations, admissions] = await Promise.all([
    prisma.consultation.findMany({
      where: { patientId, doctorId },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, diagnosis: true, prescription: true, followUpDate: true, createdAt: true },
    }),
    prisma.admission.findMany({
      where: { patientId, doctorId },
      orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, status: true, admissionDate: true, createdAt: true },
    }),
  ]);

  const records = [
    ...consultations.map((c) => ({
      id: c.id,
      date: c.createdAt,
      type: 'OPD',
      diagnosis: c.diagnosis,
      prescription: prescriptionToText(c.prescription),
      follow_up: c.followUpDate,
      detail: { consultation_id: c.id },
    })),
    ...admissions.map((a) => ({
      id: a.id,
      date: a.admissionDate || a.createdAt,
      type: 'IPD',
      diagnosis: String(a.status || '').replace(/_/g, ' '),
      prescription: '',
      follow_up: null,
      detail: { admission_id: a.id },
    })),
  ].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

  return res.json({
    patient: {
      id: patient.id,
      name: patient.name,
      uhid: patient.uhid,
      age: patient.age ?? null,
      gender: patient.gender ?? null,
    },
    records,
  });
}

module.exports = { getHistoryByUHID, getFullHistoryByPatientId };

