/**
 * Canonical nurse assignment workflow.
 * HR approve/assign is the only path that should call applyNurseAssignment.
 * Operational modules may only create PENDING AllocationRequest records.
 */
const { prisma } = require('../config/prisma');

async function nextAllocationRequestNumber(client) {
  const db = client || prisma;
  const year = new Date().getFullYear();
  const prefix = `AR-${year}-`;
  const last = await db.allocationRequest.findFirst({
    where: { requestNumber: { startsWith: prefix } },
    orderBy: { requestNumber: 'desc' },
    select: { requestNumber: true },
  });
  let seq = 1;
  if (last) {
    const parts = last.requestNumber.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function createPendingAllocationRequest(client, {
  patientId,
  uhid,
  patientName,
  admissionId = null,
  otRequestId = null,
  sourceModule,
  department = null,
  requestedStaffType = 'NURSE',
  reason = null,
  priority = 'MEDIUM',
  requestedById,
  requestedByName,
  historyAction = 'REQUEST_CREATED',
}) {
  const db = client || prisma;
  const requestNumber = await nextAllocationRequestNumber(db);
  return db.allocationRequest.create({
    data: {
      requestNumber,
      patientId,
      uhid,
      patientName,
      admissionId,
      otRequestId,
      sourceModule,
      department,
      requestedStaffType,
      reason,
      priority,
      status: 'PENDING',
      requestedById,
      requestedByName,
      history: {
        create: {
          action: historyAction,
          userId: requestedById,
          userName: requestedByName,
          details: JSON.stringify({ sourceModule, requestedStaffType, priority }),
        },
      },
    },
  });
}

async function applyNurseAssignment(client, request, assignedToId) {
  const db = client || prisma;
  let admissionId = request.admissionId || null;

  if (!admissionId && request.otRequestId) {
    const ot = await db.otRequest.findUnique({
      where: { id: request.otRequestId },
      select: { ipdId: true },
    });
    admissionId = ot?.ipdId || null;
  }

  if (admissionId) {
    await db.admission.update({
      where: { id: admissionId },
      data: { nurseId: assignedToId },
    });
  }

  if (request.sourceModule === 'OT' && request.otRequestId) {
    const existingSch = await db.surgerySchedule.findUnique({ where: { otRequestId: request.otRequestId } });
    if (existingSch) {
      await db.surgerySchedule.update({
        where: { otRequestId: request.otRequestId },
        data: { otNurseId: assignedToId },
      });
    }
  }

  if (request.sourceModule === 'WARD_TRANSFER' || request.sourceModule === 'RECOVERY') {
    let recoveryRecordId = null;
    try {
      const parsed = JSON.parse(request.remarks || '{}');
      recoveryRecordId = parsed.recoveryRecordId || null;
    } catch { /* ignore */ }

    if (recoveryRecordId) {
      await db.recoveryRecord.updateMany({
        where: { id: recoveryRecordId },
        data: { assignedNurseId: assignedToId },
      });
    } else if (request.otRequestId) {
      const schedule = await db.surgerySchedule.findUnique({
        where: { otRequestId: request.otRequestId },
        select: { id: true },
      });
      if (schedule?.id) {
        const session = await db.surgerySession.findUnique({
          where: { surgeryScheduleId: schedule.id },
          select: { id: true },
        });
        if (session?.id) {
          await db.recoveryRecord.updateMany({
            where: { surgerySessionId: session.id },
            data: { assignedNurseId: assignedToId },
          });
        }
      }
    }
  }
}

async function releaseNurseAssignment(client, allocation) {
  const db = client || prisma;
  if (allocation.admissionId) {
    await db.admission.update({
      where: { id: allocation.admissionId },
      data: { nurseId: null },
    });
  }

  if (allocation.sourceModule === 'OT' && allocation.otRequestId) {
    await db.surgerySchedule.updateMany({
      where: { otRequestId: allocation.otRequestId },
      data: { otNurseId: null },
    });
  }

  if (allocation.sourceModule === 'WARD_TRANSFER' || allocation.sourceModule === 'RECOVERY') {
    let recoveryRecordId = null;
    try {
      const parsed = JSON.parse(allocation.remarks || '{}');
      recoveryRecordId = parsed.recoveryRecordId || null;
    } catch { /* ignore */ }

    if (recoveryRecordId) {
      await db.recoveryRecord.updateMany({
        where: { id: recoveryRecordId },
        data: { assignedNurseId: null },
      });
    } else if (allocation.otRequestId) {
      const schedule = await db.surgerySchedule.findUnique({
        where: { otRequestId: allocation.otRequestId },
        select: { id: true },
      });
      if (schedule?.id) {
        const session = await db.surgerySession.findUnique({
          where: { surgeryScheduleId: schedule.id },
          select: { id: true },
        });
        if (session?.id) {
          await db.recoveryRecord.updateMany({
            where: { surgerySessionId: session.id },
            data: { assignedNurseId: null },
          });
        }
      }
    }
  }
}

/**
 * Create an allocation request in APPROVED state with nurse assigned.
 * Used by night-shift receptionist for direct nurse assignment.
 */
async function createApprovedAllocationWithAssignment(client, {
  patientId,
  uhid,
  patientName,
  admissionId,
  sourceModule,
  department = null,
  requestedStaffType = 'NURSE',
  reason = null,
  priority = 'MEDIUM',
  assignedToId,
  assignedToName,
  assignedById,
  assignedByName,
  assignedShift = 'NIGHT',
  remarks = null,
}) {
  const db = client || prisma;
  const requestNumber = await nextAllocationRequestNumber(db);

  const request = await db.allocationRequest.create({
    data: {
      requestNumber,
      patientId,
      uhid,
      patientName,
      admissionId,
      sourceModule,
      department,
      requestedStaffType,
      reason,
      priority,
      status: 'APPROVED',
      requestedById: assignedById,
      requestedByName: assignedByName,
      assignedToId,
      assignedToName,
      assignedById,
      assignedByName,
      assignedAt: new Date(),
      assignedShift,
      approvedById: assignedById,
      approvedByName: assignedByName,
      approvedAt: new Date(),
      remarks: remarks || JSON.stringify({ assignedBy: 'NIGHT_RECEPTION', receptionistId: assignedById, receptionistName: assignedByName }),
      history: {
        createMany: {
          data: [
            {
              action: 'REQUEST_CREATED',
              userId: assignedById,
              userName: assignedByName,
              details: JSON.stringify({ sourceModule, requestedStaffType, priority }),
            },
            {
              action: 'STAFF_ASSIGNED',
              userId: assignedById,
              userName: assignedByName,
              details: JSON.stringify({ assignedToId, assignedToName, shift: assignedShift, assignedBy: 'NIGHT_RECEPTION' }),
            },
          ],
        },
      },
    },
  });

  await applyNurseAssignment(db, request, assignedToId);
  return request;
}

module.exports = {
  nextAllocationRequestNumber,
  createPendingAllocationRequest,
  createApprovedAllocationWithAssignment,
  applyNurseAssignment,
  releaseNurseAssignment,
};
