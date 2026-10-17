const { prisma } = require('../../../config/prisma');
const { createPendingAllocationRequest } = require('../../../lib/allocationWorkflow');

async function executeRecoveryWardTransfer({
  sessionId,
  bedId,
  wardId,
  userId,
  requestedByName = 'Reception',
}) {
  const session = await prisma.surgerySession.findUnique({
    where: { id: sessionId },
    include: {
      surgerySchedule: {
        include: {
          otRequest: {
            include: {
              patient: { select: { id: true, name: true, uhid: true } },
            },
          },
        },
      },
      recoveryRecord: true,
    },
  });

  if (!session) return { error: { status: 404, message: 'Surgery session not found' } };
  if (!session.recoveryRecord) {
    return { error: { status: 400, message: 'No recovery record found' } };
  }
  if (session.recoveryRecord.status === 'TRANSFERRED') {
    return { error: { status: 409, message: 'Patient already transferred from recovery' } };
  }
  if (session.recoveryRecord.transferRequestStatus !== 'PENDING') {
    return { error: { status: 400, message: 'No pending reception transfer request for this patient' } };
  }

  const admissionId = session.surgerySchedule?.otRequest?.ipdId;
  if (!admissionId) return { error: { status: 400, message: 'No admission found for this patient' } };

  const bed = await prisma.bed.findUnique({
    where: { id: bedId },
    include: { ward: true },
  });
  if (!bed) return { error: { status: 404, message: 'Bed not found' } };
  if (bed.status !== 'AVAILABLE') return { error: { status: 400, message: 'Bed is not available' } };
  if (bed.wardId !== wardId) return { error: { status: 400, message: 'Bed does not belong to the selected ward' } };

  const patient = session.surgerySchedule.otRequest.patient;
  const otRequestId = session.surgerySchedule.otRequest.id;

  const result = await prisma.$transaction(async (tx) => {
    const admission = await tx.admission.findUnique({
      where: { id: admissionId },
      select: { bedId: true, wardId: true },
    });

    const oldWard = admission?.wardId
      ? await tx.ward.findUnique({ where: { id: admission.wardId }, select: { name: true } })
      : null;

    if (admission?.bedId) {
      await tx.bed.update({
        where: { id: admission.bedId },
        data: { status: 'MAINTENANCE', maintenanceUntil: new Date(Date.now() + 3600000) },
      });
    }

    await tx.bed.update({ where: { id: bedId }, data: { status: 'OCCUPIED' } });

    await tx.admission.update({
      where: { id: admissionId },
      data: { bedId, wardId, bedNumber: bed.code },
    });

    await tx.bedTransfer.create({
      data: {
        admissionId,
        fromBedId: admission?.bedId || null,
        toBedId: bedId,
        createdByUserId: userId,
        reason: 'Transferred from Recovery Room',
      },
    });

    const wardType = bed.ward.type;
    await tx.recoveryRecord.update({
      where: { surgerySessionId: sessionId },
      data: {
        status: 'TRANSFERRED',
        transferredTo: wardType,
        transferredAt: new Date(),
        transferRequestStatus: 'COMPLETED',
      },
    });

    await tx.recoveryTransfer.create({
      data: {
        recoveryRecordId: session.recoveryRecord.id,
        transferType: wardType,
        fromLocation: oldWard?.name || 'Recovery Room',
        toLocation: bed.ward.name,
        assignedBedId: bedId,
        assignedBedCode: bed.code,
        reason: 'Patient transferred to ' + bed.ward.name,
        transferredById: userId,
      },
    });

    await tx.recoveryTimeline.create({
      data: {
        recoveryRecordId: session.recoveryRecord.id,
        eventType: 'TRANSFERRED',
        eventDescription: 'Reception completed transfer to ' + bed.ward.name + ' (Bed ' + bed.code + ')',
        createdBy: userId,
      },
    });

    await tx.otRequest.update({
      where: { id: otRequestId },
      data: {
        status: 'COMPLETED',
        statusHistory: { create: { status: 'COMPLETED', changedBy: userId } },
      },
    });

    const allocationRequest = await createPendingAllocationRequest(tx, {
      patientId: patient.id,
      uhid: patient.uhid,
      patientName: patient.name,
      admissionId,
      sourceModule: 'IPD',
      department: bed.ward.name,
      requestedStaffType: 'NURSE',
      reason: `Nurse required after recovery transfer to ${bed.ward.name} (Bed ${bed.code})`,
      priority: 'HIGH',
      requestedById: userId,
      requestedByName,
      historyAction: 'REQUEST_CREATED_RECOVERY_TRANSFER',
    });

    return { wardName: bed.ward.name, bedCode: bed.code, allocationRequest, patientName: patient.name };
  }, { maxWait: 15000, timeout: 30000 });

  try {
    const hrUsers = await prisma.user.findMany({
      where: { role: 'HR_MANAGER', isActive: true },
      select: { id: true },
      take: 10,
    });
    for (const hr of hrUsers) {
      await prisma.notification.create({
        data: {
          userId: hr.id,
          type: 'ALERT',
          severity: 'INFO',
          title: 'Nurse Allocation Required',
          message: `${result.patientName || 'Patient'} transferred from Recovery to ${result.wardName}. Assign nurse via IPD allocation request.`,
        },
      });
    }
  } catch { /* best-effort */ }

  return {
    message: `Patient transferred to ${result.wardName} (Bed ${result.bedCode}). Nurse allocation request sent to HR.`,
    allocationRequest: result.allocationRequest,
  };
}

module.exports = { executeRecoveryWardTransfer };
