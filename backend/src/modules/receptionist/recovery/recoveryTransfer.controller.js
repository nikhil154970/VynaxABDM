const { prisma } = require('../../../config/prisma');
const { executeRecoveryWardTransfer } = require('../../ot/recovery/recoveryTransferHelper');

async function listPendingTransfers(req, res) {
  try {
    const items = await prisma.recoveryRecord.findMany({
      where: {
        transferRequestStatus: 'PENDING',
        status: 'READY_FOR_TRANSFER',
      },
      orderBy: { transferRequestedAt: 'asc' },
      include: {
        surgerySession: {
          include: {
            surgerySchedule: {
              include: {
                otRequest: {
                  include: {
                    patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, mobile: true } },
                    admission: {
                      select: {
                        id: true,
                        ipdNumber: true,
                        bedNumber: true,
                        ward: { select: { id: true, name: true } },
                        bed: { select: { id: true, code: true } },
                      },
                    },
                  },
                },
                otRoom: { select: { roomName: true, roomNumber: true } },
                surgeon: { select: { user: { select: { name: true } } } },
              },
            },
            postSurgeryNote: { select: { surgeryOutcome: true, procedureSummary: true } },
          },
        },
        assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const mapped = items.map((rr) => ({
      recoveryRecordId: rr.id,
      sessionId: rr.surgerySessionId,
      status: rr.status,
      transferRequestStatus: rr.transferRequestStatus,
      transferRequestedAt: rr.transferRequestedAt,
      preferredWardType: rr.preferredWardType,
      latestAssessment: rr.assessments[0] || null,
      patient: rr.surgerySession?.surgerySchedule?.otRequest?.patient || null,
      admission: rr.surgerySession?.surgerySchedule?.otRequest?.admission || null,
      surgeryName: rr.surgerySession?.surgerySchedule?.otRequest?.surgeryRecommendation || '',
      surgeon: rr.surgerySession?.surgerySchedule?.surgeon?.user?.name || '',
      otRoom: rr.surgerySession?.surgerySchedule?.otRoom?.roomName || '',
    }));

    return res.json({ items: mapped });
  } catch (err) {
    console.error('listPendingTransfers error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function completeRecoveryTransfer(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { recoveryRecordId } = req.params;
    const { wardId, bedId } = req.body;

    const rr = await prisma.recoveryRecord.findUnique({
      where: { id: recoveryRecordId },
      select: { surgerySessionId: true, transferRequestStatus: true, status: true },
    });
    if (!rr) return res.status(404).json({ message: 'Recovery record not found' });

    const result = await executeRecoveryWardTransfer({
      sessionId: rr.surgerySessionId,
      bedId,
      wardId,
      userId,
      requestedByName: req.user?.name || 'Reception',
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.json({
      ok: true,
      message: result.message,
      allocationRequest: result.allocationRequest,
    });
  } catch (err) {
    console.error('completeRecoveryTransfer error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

module.exports = { listPendingTransfers, completeRecoveryTransfer };
