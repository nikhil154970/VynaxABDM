const { prisma } = require('../../../config/prisma');
const { emitAbdmClinicalEvent, EVENT } = require('../../abdm/lib/abdmHealthRecord');

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
  const selectedTestIdsRaw = req.body?.selectedTestIds || req.body?.selected_test_ids || [];
  const selectedTestIds = Array.isArray(selectedTestIdsRaw)
    ? selectedTestIdsRaw.map((x) => Number(x)).filter((n) => Number.isInteger(n))
    : [];

  if (!admissionId) return res.status(400).json({ message: 'admission_id is required' });
  if (!description) return res.status(400).json({ message: 'description is required' });

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { id: true, doctorId: true, patientId: true },
  });
  if (!admission) return res.status(404).json({ message: 'Admission not found' });
  if (admission.doctorId !== doctorId) return res.status(403).json({ message: 'Access denied' });

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.treatmentPlan.upsert({
      where: { admissionId },
      create: { admissionId, description, medicines, instructions },
      update: { description, medicines, instructions },
      select: { id: true, admissionId: true, description: true, medicines: true, instructions: true, updatedAt: true },
    });

    await tx.treatmentPlanHistory.create({
      data: {
        admissionId,
        doctorId,
        description,
        medicines,
        instructions,
      },
    });

    const existingAdvice = await tx.testAdvice.findMany({
      where: { admissionId },
      include: { items: { select: { testId: true } } },
    });
    const alreadyAdvisedIds = new Set(existingAdvice.flatMap((a) => a.items.map((it) => it.testId)));

    const newTestIds = selectedTestIds.filter((id) => !alreadyAdvisedIds.has(id));

    if (newTestIds.length > 0) {
      await tx.testAdvice.create({
        data: {
          patientId: admission.patientId,
          doctorId,
          admissionId,
          source: 'IPD_TREATMENT',
          status: 'PENDING_BILLING',
          items: {
            create: newTestIds.map((id) => ({ testId: id })),
          },
        },
      });
    }

    return { row, selectedTestIds };
  });

  setImmediate(() => {
    emitAbdmClinicalEvent({
      type: EVENT.IPD_PRESCRIPTION,
      sourceId: result.row.id,
      patientId: admission.patientId,
    }).catch((err) => {
      console.error('[abdm-hr] IPD-RX emit failed', result.row.id, err?.message);
    });
  });

  return res.status(201).json({
    treatment: {
      id: result.row.id,
      admission_id: result.row.admissionId,
      description: result.row.description,
      medicines: result.row.medicines,
      instructions: result.row.instructions,
      updated_at: result.row.updatedAt,
    },
    selectedTestIds: result.selectedTestIds,
  });
}

async function getTreatment(req, res) {
  const doctorId = await getDoctorIdFromUser(req);
  if (!doctorId) return res.status(404).json({ message: 'Doctor profile not found' });

  const admissionId = req.params.admission_id;
  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: { id: true, doctorId: true } });
  if (!admission) return res.status(404).json({ message: 'Admission not found' });
  if (admission.doctorId !== doctorId) return res.status(403).json({ message: 'Access denied' });

  const [row, existingAdvice] = await Promise.all([
    prisma.treatmentPlan.findUnique({
      where: { admissionId },
      select: { id: true, admissionId: true, description: true, medicines: true, instructions: true, updatedAt: true },
    }),
    prisma.testAdvice.findMany({
      where: { admissionId },
      include: { items: { select: { testId: true } } },
    }),
  ]);

  const selectedTestIds = existingAdvice.flatMap((a) => a.items.map((it) => it.testId));

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
    selectedTestIds,
  });
}

module.exports = { upsertTreatment, getTreatment };

