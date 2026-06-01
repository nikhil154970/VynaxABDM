const { prisma } = require('../../../config/prisma');

async function getDoctorIdFromUser(req) {
  const userId = req.user?.userId;
  if (!userId) return null;
  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  if (!doctor) return null;
  return doctor.id;
}

function normalizeMedicines(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((m) => ({
      medicine: String(m?.medicine || m?.name || '').trim(),
      dosage: String(m?.dosage || '').trim(),
      duration: String(m?.duration || '').trim(),
    }))
    .filter((m) => m.medicine || m.dosage || m.duration);
}

async function upsertTreatment(req, res) {
  const doctorId = await getDoctorIdFromUser(req);
  if (!doctorId) return res.status(404).json({ message: 'Doctor profile not found' });

  const admissionId = req.body?.admission_id || req.body?.admissionId;
  const description = String(req.body?.description || '').trim();
  const instructions = String(req.body?.instructions || '').trim();
  const medicines = normalizeMedicines(req.body?.medicines);

  if (!admissionId) return res.status(400).json({ message: 'admission_id is required' });
  if (!description) return res.status(400).json({ message: 'description is required' });

  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: { id: true, doctorId: true } });
  if (!admission) return res.status(404).json({ message: 'Admission not found' });
  if (admission.doctorId !== doctorId) return res.status(403).json({ message: 'Access denied' });

  const row = await prisma.treatmentPlan.upsert({
    where: { admissionId },
    create: { admissionId, description, medicines, instructions },
    update: { description, medicines, instructions },
    select: { id: true, admissionId: true, description: true, medicines: true, instructions: true, updatedAt: true },
  });

  return res.status(201).json({
    treatment: {
      id: row.id,
      admission_id: row.admissionId,
      description: row.description,
      medicines: row.medicines,
      instructions: row.instructions,
      updated_at: row.updatedAt,
    },
  });
}

async function getTreatment(req, res) {
  const doctorId = await getDoctorIdFromUser(req);
  if (!doctorId) return res.status(404).json({ message: 'Doctor profile not found' });

  const admissionId = req.params.admission_id;
  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: { id: true, doctorId: true } });
  if (!admission) return res.status(404).json({ message: 'Admission not found' });
  if (admission.doctorId !== doctorId) return res.status(403).json({ message: 'Access denied' });

  const row = await prisma.treatmentPlan.findUnique({
    where: { admissionId },
    select: { id: true, admissionId: true, description: true, medicines: true, instructions: true, updatedAt: true },
  });

  return res.json({
    treatment: row
      ? {
          id: row.id,
          admission_id: row.admissionId,
          description: row.description,
          medicines: row.medicines,
          instructions: row.instructions,
          updated_at: row.updatedAt,
        }
      : null,
  });
}

module.exports = { upsertTreatment, getTreatment };

