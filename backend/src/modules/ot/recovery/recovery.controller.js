const { prisma } = require('../../../config/prisma');
const { autoReleaseCleaningRooms } = require('../surgery/roomHelper');

// ─── List Recovery Patients ───

async function listRecoveryPatients(req, res) {
  try {
    const { recoveryStatus } = req.query;
    let where = { recoveryRecord: { isNot: null } };
    if (recoveryStatus) {
      const statuses = recoveryStatus.split(',').filter(Boolean);
      where = {
        recoveryRecord: {
          is: {
            status: statuses.length === 1 ? statuses[0] : { in: statuses },
          },
        },
      };
    }

    const items = await prisma.surgerySession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        surgerySchedule: {
          include: {
            otRequest: {
              include: {
                patient: { select: { id: true, name: true, uhid: true, age: true, gender: true } },
                admission: {
                  select: { id: true, ipdNumber: true, bedNumber: true, ward: { select: { id: true, name: true } }, bed: { select: { id: true, code: true } } },
                },
              },
            },
            otRoom: { select: { id: true, roomNumber: true, roomName: true } },
            surgeon: { select: { id: true, user: { select: { name: true } } } },
            assistantSurgeon: { select: { id: true, user: { select: { name: true } } } },
            anaesthetist: { select: { id: true, user: { select: { name: true } } } },
            otNurse: { select: { id: true, name: true } },
          },
        },
        recoveryRecord: {
          include: {
            timeline: { orderBy: { createdAt: 'asc' } },
            assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
            transfers: { orderBy: { createdAt: 'desc' } },
          },
        },
        postSurgeryNote: true,
      },
    });

    return res.json({ items });
  } catch (err) {
    console.error('listRecoveryPatients error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Get Recovery Details ───

async function getRecoveryDetails(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await prisma.surgerySession.findUnique({
      where: { id: sessionId },
      include: {
        surgerySchedule: {
          include: {
            otRequest: {
              include: {
                patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, mobile: true } },
                admission: {
                  include: {
                    ward: { select: { id: true, name: true } },
                    bed: { select: { id: true, code: true } },
                  },
                },
                preOperativeAssessment: {
                  include: { assessedBy: { select: { name: true } } },
                },
              },
            },
            otRoom: { select: { id: true, roomNumber: true, roomName: true } },
            surgeon: { select: { id: true, user: { select: { name: true, id: true } } } },
            assistantSurgeon: { select: { id: true, user: { select: { name: true } } } },
            anaesthetist: { select: { id: true, user: { select: { name: true } } } },
            otNurse: { select: { id: true, name: true } },
          },
        },
        recoveryRecord: {
          include: {
            timeline: { orderBy: { createdAt: 'asc' } },
            assessments: { orderBy: { createdAt: 'desc' } },
            transfers: { orderBy: { createdAt: 'desc' } },
          },
        },
        postSurgeryNote: true,
        equipmentAllocations: { include: { equipment: { select: { equipmentName: true, category: true } } } },
        auditTrails: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!session) return res.status(404).json({ message: 'Recovery session not found' });

    const startTime = session.startTime;
    const endTime = session.endTime || new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = Math.floor(durationMs / 3600000);
    const durationMinutes = Math.floor((durationMs % 3600000) / 60000);

    return res.json({
      session: {
        ...session,
        duration: durationHours + 'h ' + durationMinutes + 'm',
        durationMinutes: Math.floor(durationMs / 60000),
      },
    });
  } catch (err) {
    console.error('getRecoveryDetails error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Save Recovery Assessment (always creates new record) ───

async function saveRecoveryAssessment(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { sessionId } = req.params;
    const body = req.body;
    if (!sessionId) return res.status(400).json({ message: 'Session ID is required' });

    const session = await prisma.surgerySession.findUnique({
      where: { id: sessionId },
      include: { recoveryRecord: true },
    });
    if (!session) return res.status(404).json({ message: 'Surgery session not found' });
    if (!session.recoveryRecord) return res.status(400).json({ message: 'No recovery record found' });

    const rr = session.recoveryRecord;

    const assessmentData = {
      recoveryRecordId: rr.id,
      bpSystolic: body.bpSystolic != null ? parseInt(body.bpSystolic, 10) : null,
      bpDiastolic: body.bpDiastolic != null ? parseInt(body.bpDiastolic, 10) : null,
      pulse: body.pulse != null ? parseInt(body.pulse, 10) : null,
      temperature: body.temperature != null ? parseFloat(body.temperature) : null,
      spo2: body.spo2 != null ? parseInt(body.spo2, 10) : null,
      respiratoryRate: body.respiratoryRate != null ? parseInt(body.respiratoryRate, 10) : null,
      painScore: body.painScore != null ? parseInt(body.painScore, 10) : null,
      consciousnessLevel: body.consciousnessLevel || null,
      surgicalSiteAssessment: body.surgicalSiteAssessment || null,
      postAnaesthesiaMonitoring: body.postAnaesthesiaMonitoring || null,
      recoveryNotes: body.recoveryNotes || null,
      status: body.status || null,
      assessedById: userId,
    };

    // Always create a NEW assessment record (never overwrite)
    const assessment = await prisma.recoveryAssessment.create({ data: assessmentData });

    // Update recovery record with latest values
    const rrUpdate = {};
    if (body.status) rrUpdate.status = body.status;
    if (body.consciousnessLevel) rrUpdate.consciousnessLevel = body.consciousnessLevel;
    if (body.surgicalSiteAssessment) rrUpdate.surgicalSiteAssessment = body.surgicalSiteAssessment;
    if (body.postAnaesthesiaMonitoring) rrUpdate.postAnaesthesiaMonitoring = body.postAnaesthesiaMonitoring;
    if (Object.keys(rrUpdate).length) {
      await prisma.recoveryRecord.update({ where: { id: rr.id }, data: rrUpdate });
    }

    // Add timeline entry
    await prisma.recoveryTimeline.create({
      data: {
        recoveryRecordId: rr.id,
        eventType: body.status ? 'STATUS_UPDATE' : 'ASSESSMENT_UPDATE',
        eventDescription: body.status
          ? 'Status changed to ' + body.status.replace(/_/g, ' ')
          : 'Recovery assessment recorded',
        createdBy: userId,
      },
    });

    return res.json({ ok: true, assessment });
  } catch (err) {
    console.error('saveRecoveryAssessment error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

// ─── Get Assessment History (vitals history) ───

async function getAssessmentHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await prisma.surgerySession.findUnique({
      where: { id: sessionId },
      select: { recoveryRecord: { select: { id: true } } },
    });
    if (!session?.recoveryRecord) return res.json({ assessments: [] });

    const assessments = await prisma.recoveryAssessment.findMany({
      where: { recoveryRecordId: session.recoveryRecord.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assessedBy: { select: { id: true, name: true } },
      },
    });

    return res.json({ assessments });
  } catch (err) {
    console.error('getAssessmentHistory error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Get Available Beds by Ward Type ───

async function getAvailableBedsByType(req, res) {
  try {
    const { wardType } = req.query;
    if (!wardType) return res.status(400).json({ message: 'Ward type is required (ICU, PRIVATE, GENERAL)' });

    const wardTypeUpper = wardType.toUpperCase();
    if (!['ICU', 'PRIVATE', 'GENERAL'].includes(wardTypeUpper)) {
      return res.status(400).json({ message: 'Invalid ward type. Use ICU, PRIVATE, or GENERAL' });
    }

    const beds = await prisma.bed.findMany({
      where: {
        status: 'AVAILABLE',
        ward: { type: wardTypeUpper, isActive: true },
      },
      include: { ward: { select: { id: true, name: true, type: true } } },
      orderBy: { code: 'asc' },
    });

    return res.json({ beds });
  } catch (err) {
    console.error('getAvailableBedsByType error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Transfer Patient from Recovery (disabled — use Reception workflow) ───

async function transferPatient(req, res) {
  return res.status(403).json({
    message: 'Recovery transfers are completed by Reception after a transfer request is raised.',
  });
}

// ─── Request Reception Transfer (after post-assessment & Ready For Transfer) ───

async function requestReceptionTransfer(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { recoveryRecordId, preferredWardType } = req.body;
    if (!recoveryRecordId) {
      return res.status(400).json({ message: 'Recovery record ID is required' });
    }

    const rr = await prisma.recoveryRecord.findUnique({
      where: { id: recoveryRecordId },
      include: {
        assessments: { take: 1 },
        surgerySession: {
          include: {
            surgerySchedule: {
              include: {
                otRequest: {
                  include: { patient: { select: { name: true, uhid: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!rr) return res.status(404).json({ message: 'Recovery record not found' });
    if (rr.status !== 'READY_FOR_TRANSFER') {
      return res.status(400).json({ message: 'Patient must be marked Ready For Transfer before requesting ward transfer' });
    }
    if (rr.transferRequestStatus === 'PENDING') {
      return res.status(409).json({ message: 'Transfer request already pending with Reception' });
    }
    if (rr.transferRequestStatus === 'COMPLETED' || rr.status === 'TRANSFERRED') {
      return res.status(409).json({ message: 'Patient has already been transferred' });
    }
    if (!rr.assessments?.length) {
      return res.status(400).json({ message: 'Post-assessment is required before transfer request' });
    }

    const patient = rr.surgerySession?.surgerySchedule?.otRequest?.patient;

    await prisma.$transaction(async (tx) => {
      await tx.recoveryRecord.update({
        where: { id: recoveryRecordId },
        data: {
          transferRequestStatus: 'PENDING',
          transferRequestedAt: new Date(),
          transferRequestedById: userId,
          preferredWardType: preferredWardType || null,
        },
      });

      await tx.recoveryTimeline.create({
        data: {
          recoveryRecordId: rr.id,
          eventType: 'TRANSFER_REQUESTED',
          eventDescription: preferredWardType
            ? `Transfer requested to Reception (preferred: ${preferredWardType})`
            : 'Transfer requested to Reception for ward assignment',
          createdBy: userId,
        },
      });
    });

    try {
      const receptionists = await prisma.user.findMany({
        where: { role: 'RECEPTIONIST', isActive: true },
        select: { id: true },
        take: 20,
      });
      for (const r of receptionists) {
        await prisma.notification.create({
          data: {
            userId: r.id,
            type: 'ALERT',
            severity: 'INFO',
            title: 'Recovery Transfer Request',
            message: `${patient?.name || 'Patient'} (${patient?.uhid || ''}) is ready for ward transfer from Recovery Room.`,
          },
        });
      }
    } catch { /* best-effort */ }

    return res.json({
      ok: true,
      message: 'Transfer request sent to Reception. They will assign ward, room and bed.',
    });
  } catch (err) {
    console.error('requestReceptionTransfer error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

/** @deprecated — use request-reception-transfer */
async function nurseRequestTransfer(req, res) {
  return res.status(410).json({
    message: 'This endpoint is removed. Use POST /ot/recovery/request-reception-transfer. Nurse assignment is handled by HR via Allocation Requests.',
  });
}

async function nursePendingTransfers(req, res) {
  return res.status(410).json({
    message: 'This endpoint is removed. Ward transfers are handled by Reception; HR assigns nurses via Allocation Requests.',
    transfers: [],
  });
}

async function nurseAssignTransfer(req, res) {
  return res.status(410).json({
    message: 'Direct nurse assignment is not allowed. HR must approve an Allocation Request.',
  });
}

// ─── Get Transfer History ───

async function getTransferHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await prisma.surgerySession.findUnique({
      where: { id: sessionId },
      select: { recoveryRecord: { select: { id: true } } },
    });
    if (!session?.recoveryRecord) return res.json({ transfers: [] });

    const transfers = await prisma.recoveryTransfer.findMany({
      where: { recoveryRecordId: session.recoveryRecord.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ transfers });
  } catch (err) {
    console.error('getTransferHistory error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Get Recovery Timeline ───

async function getRecoveryTimeline(req, res) {
  try {
    const { sessionId } = req.params;
    const timeline = await prisma.recoveryTimeline.findMany({
      where: { recoveryRecord: { surgerySessionId: sessionId } },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ timeline });
  } catch (err) {
    console.error('getRecoveryTimeline error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  listRecoveryPatients,
  getRecoveryDetails,
  saveRecoveryAssessment,
  getAssessmentHistory,
  getAvailableBedsByType,
  transferPatient,
  getTransferHistory,
  getRecoveryTimeline,
  requestReceptionTransfer,
  nurseRequestTransfer,
  nursePendingTransfers,
  nurseAssignTransfer,
};
