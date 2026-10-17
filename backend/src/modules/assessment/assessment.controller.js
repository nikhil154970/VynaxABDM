const { prisma } = require('../../config/prisma');

const TX_OPTS = { maxWait: 15000, timeout: 30000 };

async function notifyReceptionOtReady(otRequest, patientName, uhid) {
  try {
    const receptionists = await prisma.user.findMany({
      where: { role: 'RECEPTIONIST', isActive: true },
      select: { id: true },
    });
    if (receptionists.length === 0) return;
    await prisma.notification.createMany({
      data: receptionists.map((u) => ({
        userId: u.id,
        type: 'UPDATE',
        severity: 'INFO',
        title: 'OT Pre-Assessment Complete',
        message: `Pre-assessment done for ${patientName} (${uhid}). OT request ${otRequest.requestNumber} is ready for billing at reception.`,
      })),
    });
  } catch (notifyErr) {
    console.warn('OT reception notification failed:', notifyErr?.message || notifyErr);
  }
}

async function submitPreOpAssessment(req, res) {
  try {
    const userId = req.user.userId;
    const { otRequestId } = req.params;
    const body = req.body;

    const otRequest = await prisma.otRequest.findUnique({
      where: { id: otRequestId },
      include: { patient: { select: { name: true, uhid: true } } },
    });
    if (!otRequest) return res.status(404).json({ message: 'OT request not found' });
    if (otRequest.nurseId !== userId) {
      return res.status(403).json({ message: 'Not authorized for this OT request' });
    }

    const existing = await prisma.preOperativeAssessment.findUnique({ where: { otRequestId } });
    if (existing) return res.status(409).json({ message: 'Pre-operative assessment already exists for this OT request. Use PUT to update.' });

    const otUpdate = {};
    if (body.surgeryRecommendation?.trim()) otUpdate.surgeryRecommendation = body.surgeryRecommendation.trim();
    if (body.diagnosis?.trim()) otUpdate.diagnosis = body.diagnosis.trim();
    if (body.priority && ['Normal', 'Urgent'].includes(body.priority)) otUpdate.priority = body.priority;
    if (body.expectedSurgeryDate) otUpdate.expectedSurgeryDate = new Date(body.expectedSurgeryDate);

    // Reception list + Generate OT Bill require OT_REQUEST_CREATED without bill
    if (!otRequest.billId) {
      otUpdate.status = 'OT_REQUEST_CREATED';
    }

    const assessment = await prisma.$transaction(async (tx) => {
      if (Object.keys(otUpdate).length > 0) {
        await tx.otRequest.update({
          where: { id: otRequestId },
          data: otUpdate,
        });
      }
      if (!otRequest.billId) {
        await tx.otRequestStatusHistory.create({
          data: { otRequestId, status: 'OT_REQUEST_CREATED', changedBy: userId },
        });
      }

      const created = await tx.preOperativeAssessment.create({
        data: {
          otRequestId,
          bpSystolic: body.bpSystolic ? parseInt(body.bpSystolic, 10) : null,
          bpDiastolic: body.bpDiastolic ? parseInt(body.bpDiastolic, 10) : null,
          pulse: body.pulse ? parseInt(body.pulse, 10) : null,
          temperature: body.temperature ? parseFloat(body.temperature) : null,
          spo2: body.spo2 ? parseInt(body.spo2, 10) : null,
          respiratoryRate: body.respiratoryRate ? parseInt(body.respiratoryRate, 10) : null,
          heightCm: body.heightCm ? parseInt(body.heightCm, 10) : null,
          weightKg: body.weightKg ? parseInt(body.weightKg, 10) : null,
          bmi: body.bmi ? parseFloat(body.bmi) : null,
          diabetes: Boolean(body.diabetes),
          hypertension: Boolean(body.hypertension),
          asthma: Boolean(body.asthma),
          heartDisease: Boolean(body.heartDisease),
          kidneyDisease: Boolean(body.kidneyDisease),
          knownAllergies: body.knownAllergies || null,
          currentMedications: body.currentMedications || null,
          previousSurgeries: body.previousSurgeries || null,
          nurseNotes: body.nurseNotes || null,
          consentObtained: Boolean(body.consentObtained),
          labReportsAvailable: Boolean(body.labReportsAvailable),
          fastingCompleted: Boolean(body.fastingCompleted),
          bloodAvailable: Boolean(body.bloodAvailable),
          surgicalSiteVerified: Boolean(body.surgicalSiteVerified),
          patientIdentityVerified: Boolean(body.patientIdentityVerified),
          assessedById: userId,
          status: 'COMPLETED',
        },
        include: {
          assessedBy: { select: { id: true, name: true } },
        },
      });

      return created;
    }, TX_OPTS);
    await notifyReceptionOtReady(
      otRequest,
      otRequest.patient?.name || 'Patient',
      otRequest.patient?.uhid || otRequest.uhid || ''
    );

    try {
      const { createActivityLog } = require('../../utils/activityLog');
      await createActivityLog({ userId, action: 'SUBMIT_PRE_OP_ASSESSMENT', module: 'OT' });
    } catch { /* best-effort */ }

    return res.status(201).json({
      assessment,
      message: 'Pre-assessment submitted. Patient sent to reception for OT billing.',
    });
  } catch (err) {
    console.error('submitPreOpAssessment error:', err?.message || err, err?.stack || '');
    console.error('submitPreOpAssessment body keys:', Object.keys(req?.body || {}));
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

async function updatePreOpAssessment(req, res) {
  try {
    const userId = req.user.userId;
    const { otRequestId } = req.params;
    const body = req.body;

    const existing = await prisma.preOperativeAssessment.findUnique({ where: { otRequestId } });
    if (!existing) return res.status(404).json({ message: 'No pre-operative assessment found. Use POST to create.' });

    const assessment = await prisma.preOperativeAssessment.update({
      where: { otRequestId },
      data: {
        bpSystolic: body.bpSystolic !== undefined && body.bpSystolic !== '' ? parseInt(body.bpSystolic, 10) : undefined,
        bpDiastolic: body.bpDiastolic !== undefined && body.bpDiastolic !== '' ? parseInt(body.bpDiastolic, 10) : undefined,
        pulse: body.pulse !== undefined && body.pulse !== '' ? parseInt(body.pulse, 10) : undefined,
        temperature: body.temperature !== undefined && body.temperature !== '' ? parseFloat(body.temperature) : undefined,
        spo2: body.spo2 !== undefined && body.spo2 !== '' ? parseInt(body.spo2, 10) : undefined,
        respiratoryRate: body.respiratoryRate !== undefined && body.respiratoryRate !== '' ? parseInt(body.respiratoryRate, 10) : undefined,
        heightCm: body.heightCm !== undefined && body.heightCm !== '' ? parseInt(body.heightCm, 10) : undefined,
        weightKg: body.weightKg !== undefined && body.weightKg !== '' ? parseInt(body.weightKg, 10) : undefined,
        bmi: body.bmi !== undefined && body.bmi !== '' ? parseFloat(body.bmi) : undefined,
        diabetes: body.diabetes !== undefined ? Boolean(body.diabetes) : undefined,
        hypertension: body.hypertension !== undefined ? Boolean(body.hypertension) : undefined,
        asthma: body.asthma !== undefined ? Boolean(body.asthma) : undefined,
        heartDisease: body.heartDisease !== undefined ? Boolean(body.heartDisease) : undefined,
        kidneyDisease: body.kidneyDisease !== undefined ? Boolean(body.kidneyDisease) : undefined,
        knownAllergies: body.knownAllergies !== undefined ? (body.knownAllergies || null) : undefined,
        currentMedications: body.currentMedications !== undefined ? (body.currentMedications || null) : undefined,
        previousSurgeries: body.previousSurgeries !== undefined ? (body.previousSurgeries || null) : undefined,
        nurseNotes: body.nurseNotes !== undefined ? (body.nurseNotes || null) : undefined,
        consentObtained: body.consentObtained !== undefined ? Boolean(body.consentObtained) : undefined,
        labReportsAvailable: body.labReportsAvailable !== undefined ? Boolean(body.labReportsAvailable) : undefined,
        fastingCompleted: body.fastingCompleted !== undefined ? Boolean(body.fastingCompleted) : undefined,
        bloodAvailable: body.bloodAvailable !== undefined ? Boolean(body.bloodAvailable) : undefined,
        surgicalSiteVerified: body.surgicalSiteVerified !== undefined ? Boolean(body.surgicalSiteVerified) : undefined,
        patientIdentityVerified: body.patientIdentityVerified !== undefined ? Boolean(body.patientIdentityVerified) : undefined,
        assessedById: userId,
      },
      include: {
        assessedBy: { select: { id: true, name: true } },
      },
    });

    return res.json({ assessment });
  } catch (err) {
    console.error('updatePreOpAssessment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getPreOpAssessment(req, res) {
  try {
    const { otRequestId } = req.params;

    const assessment = await prisma.preOperativeAssessment.findUnique({
      where: { otRequestId },
      include: {
        assessedBy: { select: { id: true, name: true } },
      },
    });

    if (!assessment) return res.status(404).json({ message: 'Pre-operative assessment not found for this OT request' });

    return res.json({ assessment });
  } catch (err) {
    console.error('getPreOpAssessment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { submitPreOpAssessment, updatePreOpAssessment, getPreOpAssessment };
