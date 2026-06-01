const { prisma } = require('../../../config/prisma');

async function getDoctorIdFromUser(req) {
  const userId = req.user?.userId;
  if (!userId) return null;
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!doctor) return null;
  return { doctorId: doctor.id, doctorName: doctor.user?.name || 'Doctor' };
}

async function createIpdNote(req, res) {
  const doc = await getDoctorIdFromUser(req);
  if (!doc) return res.status(404).json({ message: 'Doctor profile not found' });

  const admissionId = req.body?.admission_id || req.body?.admissionId;
  const note = String(req.body?.note || '').trim();
  if (!admissionId) return res.status(400).json({ message: 'admission_id is required' });
  if (!note) return res.status(400).json({ message: 'note is required' });

  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: { id: true, doctorId: true } });
  if (!admission) return res.status(404).json({ message: 'Admission not found' });
  if (admission.doctorId !== doc.doctorId) return res.status(403).json({ message: 'Access denied' });

  const row = await prisma.ipdNote.create({
    data: { admissionId, doctorId: doc.doctorId, note },
    select: { id: true, note: true, createdAt: true },
  });

  return res.status(201).json({
    note: {
      id: row.id,
      admission_id: admissionId,
      note: row.note,
      created_at: row.createdAt,
      doctor_name: doc.doctorName,
    },
  });
}

async function listIpdNotes(req, res) {
  const doc = await getDoctorIdFromUser(req);
  if (!doc) return res.status(404).json({ message: 'Doctor profile not found' });

  const admissionId = req.params.admission_id;
  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: { id: true, doctorId: true } });
  if (!admission) return res.status(404).json({ message: 'Admission not found' });
  if (admission.doctorId !== doc.doctorId) return res.status(403).json({ message: 'Access denied' });

  const notes = await prisma.ipdNote.findMany({
    where: { admissionId },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, note: true, createdAt: true },
  });

  return res.json({
    notes: notes.map((n) => ({
      id: n.id,
      admission_id: admissionId,
      note: n.note,
      created_at: n.createdAt,
      doctor_name: doc.doctorName,
    })),
  });
}

module.exports = { createIpdNote, listIpdNotes };

