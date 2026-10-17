const { prisma } = require('../../../config/prisma');

const CLEANING_DURATION_MS = 30 * 60 * 1000;

function buildPostSurgeryNoteData(report = {}) {
  return {
    surgeryOutcome: report.surgeryOutcome || null,
    procedureSummary: report.procedurePerformed || report.procedureSummary || null,
    operationFindings: report.operationFindings || null,
    complications: report.complications || null,
    bloodLoss: report.bloodLoss || null,
    specialInstructions: report.specialInstructions || null,
    preOperativeDiagnosis: report.preOperativeDiagnosis || null,
    postOperativeDiagnosis: report.postOperativeDiagnosis || null,
    anaesthesiaType: report.anaesthesiaType || null,
    implantsUsed: report.implantsUsed || null,
    specimenCollected: report.specimenCollected || null,
    surgeonNotes: report.procedureSummary || null,
    followUpInstructions: report.specialInstructions || null,
  };
}

function validateSurgeryReport(report) {
  if (!report || typeof report !== 'object') {
    return 'Surgery report is required';
  }
  if (!String(report.surgeryOutcome || '').trim()) {
    return 'Surgery Outcome is required';
  }
  const procedure = String(report.procedurePerformed || report.procedureSummary || '').trim();
  if (!procedure) {
    return 'Procedure Performed is required in the surgery report';
  }
  return null;
}

async function upsertPostSurgeryNote(tx, sessionId, report) {
  const data = buildPostSurgeryNoteData(report);
  return tx.postSurgeryNote.upsert({
    where: { surgerySessionId: sessionId },
    update: data,
    create: { surgerySessionId: sessionId, ...data },
  });
}

async function scheduleEquipmentReturns(tx, equipmentAllocations = []) {
  const expectedReturnAt = new Date(Date.now() + CLEANING_DURATION_MS);
  for (const alloc of equipmentAllocations) {
    if (!alloc.returnedAt) {
      await tx.equipmentAllocation.update({
        where: { id: alloc.id },
        data: { expectedReturnAt },
      });
    }
  }
}

async function finalizeSurgeryWithReport(tx, {
  sessionId,
  scheduleId,
  otRoomId,
  report,
  userId,
  equipmentAllocations = [],
  otRequestId,
}) {
  const now = new Date();
  const cleaningUntil = new Date(now.getTime() + CLEANING_DURATION_MS);

  await upsertPostSurgeryNote(tx, sessionId, report);

  await tx.surgerySession.update({
    where: { id: sessionId },
    data: { status: 'RECOVERY', endTime: now },
  });

  await tx.surgerySchedule.update({
    where: { id: scheduleId },
    data: { status: 'COMPLETED' },
  });

  if (otRoomId) {
    await tx.otRoom.update({
      where: { id: otRoomId },
      data: {
        status: 'CLEANING',
        occupiedSince: null,
        expectedAvailableAt: cleaningUntil,
      },
    });
  }

  await scheduleEquipmentReturns(tx, equipmentAllocations);

  const existingRR = await tx.recoveryRecord.findUnique({ where: { surgerySessionId: sessionId } });
  if (!existingRR) {
    const rr = await tx.recoveryRecord.create({
      data: {
        surgerySessionId: sessionId,
        status: 'UNDER_OBSERVATION',
        admittedAt: now,
      },
    });
    await tx.recoveryTimeline.create({
      data: {
        recoveryRecordId: rr.id,
        eventType: 'RECOVERY_STARTED',
        eventDescription: 'Surgery completed. Patient moved to Recovery Room.',
        createdBy: userId,
      },
    });

    if (otRequestId) {
      await tx.otRequest.update({
        where: { id: otRequestId },
        data: {
          status: 'IN_RECOVERY',
          statusHistory: {
            create: { status: 'IN_RECOVERY', changedBy: userId },
          },
        },
      });
    }
  }

  return { completedAt: now };
}

async function saveSurgeryReportDraft({ scheduleId, report, surgeonDoctorId, userId }) {
  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id: scheduleId },
    include: { surgerySession: true },
  });
  if (!schedule) return { error: { status: 404, message: 'Surgery schedule not found' } };
  if (schedule.surgeonId !== surgeonDoctorId) {
    return { error: { status: 403, message: 'Only the assigned surgeon can save this report' } };
  }
  if (!schedule.surgerySession) {
    return { error: { status: 400, message: 'Surgery has not been started by OT yet' } };
  }
  if (!['IN_PROGRESS', 'RECOVERY'].includes(schedule.surgerySession.status)) {
    return { error: { status: 400, message: 'Report can only be saved while surgery is active or in recovery' } };
  }

  const note = await upsertPostSurgeryNote(prisma, schedule.surgerySession.id, report);
  return { note };
}

async function completeSurgeryWithReport({ scheduleId, report, surgeonDoctorId, userId }) {
  const validationError = validateSurgeryReport(report);
  if (validationError) return { error: { status: 400, message: validationError } };

  const schedule = await prisma.surgerySchedule.findUnique({
    where: { id: scheduleId },
    include: {
      surgerySession: { include: { equipmentAllocations: true, recoveryRecord: true } },
    },
  });
  if (!schedule) return { error: { status: 404, message: 'Surgery schedule not found' } };
  if (schedule.surgeonId !== surgeonDoctorId) {
    return { error: { status: 403, message: 'Only the assigned surgeon can complete this surgery' } };
  }

  const session = schedule.surgerySession;
  if (!session) {
    return { error: { status: 400, message: 'Surgery must be started by OT Technician before completion' } };
  }
  if (session.status === 'RECOVERY' && session.recoveryRecord) {
    return { error: { status: 409, message: 'Surgery already completed and patient is in recovery' } };
  }
  if (session.status !== 'IN_PROGRESS') {
    return { error: { status: 400, message: `Cannot complete surgery with session status ${session.status}` } };
  }

  await prisma.$transaction(async (tx) => {
    await finalizeSurgeryWithReport(tx, {
      sessionId: session.id,
      scheduleId: schedule.id,
      otRoomId: schedule.otRoomId,
      report,
      userId,
      equipmentAllocations: session.equipmentAllocations || [],
      otRequestId: schedule.otRequestId,
    });
  }, { maxWait: 15000, timeout: 30000 });

  return { message: 'Surgery completed. Patient moved to Recovery Room.' };
}

function disabledCompletionHandler(_req, res) {
  return res.status(403).json({
    message: 'Surgery completion is restricted to the assigned surgeon via Surgery Report.',
  });
}

function disabledStartHandler(_req, res) {
  return res.status(403).json({
    message: 'Only OT Technician can start surgery. Use OT surgery workflow start.',
  });
}

module.exports = {
  buildPostSurgeryNoteData,
  validateSurgeryReport,
  upsertPostSurgeryNote,
  finalizeSurgeryWithReport,
  saveSurgeryReportDraft,
  completeSurgeryWithReport,
  disabledCompletionHandler,
  disabledStartHandler,
};
