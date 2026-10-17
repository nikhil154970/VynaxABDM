const { prisma } = require('../../../config/prisma');
const {
  saveSurgeryReportDraft,
  completeSurgeryWithReport,
} = require('../../ot/surgery/surgeryLifecycle');

function getDoctorId(userId) {
  return prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
}

exports.getMyScheduledSurgeries = async (req, res) => {
  try {
    const doctor = await getDoctorId(req.user.userId || req.user.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const schedules = await prisma.surgerySchedule.findMany({
      where: { surgeonId: doctor.id },
      orderBy: { surgeryDate: 'desc' },
      include: {
        otRequest: {
          include: {
            patient: { select: { id: true, name: true, uhid: true, mobile: true, gender: true } },
            admission: { select: { id: true, ipdNumber: true } },
          },
        },
        otRoom: { select: { id: true, roomName: true, roomNumber: true } },
        surgeon: { select: { id: true, user: { select: { name: true } } } },
        assistantSurgeon: { select: { id: true, user: { select: { name: true } } } },
        anaesthetist: { select: { id: true, user: { select: { name: true } } } },
        otNurse: { select: { id: true, name: true } },
        surgerySession: { select: { id: true, status: true, startTime: true, endTime: true } },
        createdByUser: { select: { id: true, name: true } },
      },
    });

    return res.json({ items: schedules });
  } catch (err) {
    console.error('getMyScheduledSurgeries error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getSurgeryReportData = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const doctor = await getDoctorId(req.user.userId || req.user.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const schedule = await prisma.surgerySchedule.findUnique({
      where: { id: scheduleId },
      include: {
        otRequest: {
          include: {
            patient: { select: { id: true, name: true, uhid: true, mobile: true, gender: true, dob: true } },
            admission: { select: { id: true, ipdNumber: true, ward: true, bedNumber: true } },
          },
        },
        otRoom: { select: { roomName: true, roomNumber: true } },
        surgeon: { select: { id: true, user: { select: { name: true } } } },
        assistantSurgeon: { select: { id: true, user: { select: { name: true } } } },
        anaesthetist: { select: { id: true, user: { select: { name: true } } } },
        otNurse: { select: { id: true, name: true } },
        surgerySession: {
          include: { postSurgeryNote: true },
        },
      },
    });
    if (!schedule) return res.status(404).json({ message: 'Surgery schedule not found' });
    if (schedule.surgeonId !== doctor.id) return res.status(403).json({ message: 'Access denied' });

    return res.json({ schedule });
  } catch (err) {
    console.error('getSurgeryReportData error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.saveSurgeryReportDraft = async (req, res) => {
  try {
    const { scheduleId, report } = req.body;
    if (!scheduleId || !report) {
      return res.status(400).json({ message: 'scheduleId and report are required' });
    }

    const doctor = await getDoctorId(req.user.userId || req.user.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const result = await saveSurgeryReportDraft({
      scheduleId,
      report,
      surgeonDoctorId: doctor.id,
      userId: req.user.userId || req.user.id,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.json({ message: 'Draft saved', postSurgeryNote: result.note });
  } catch (err) {
    console.error('saveSurgeryReportDraft error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.completeSurgery = async (req, res) => {
  try {
    const { scheduleId, report } = req.body;
    if (!scheduleId || !report) {
      return res.status(400).json({ message: 'scheduleId and report are required' });
    }

    const doctor = await getDoctorId(req.user.userId || req.user.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const result = await completeSurgeryWithReport({
      scheduleId,
      report,
      surgeonDoctorId: doctor.id,
      userId: req.user.userId || req.user.id,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    try {
      const info = await prisma.surgerySchedule.findUnique({
        where: { id: scheduleId },
        select: {
          createdBy: true,
          otNurseId: true,
          otRequest: { select: { patient: { select: { name: true, uhid: true } } } },
        },
      });
      const message = `Surgery completed for ${info?.otRequest?.patient?.name || 'patient'}. Patient moved to Recovery Room.`;
      for (const uid of [info?.createdBy, info?.otNurseId].filter(Boolean)) {
        await prisma.notification.create({
          data: {
            userId: uid,
            type: 'UPDATE',
            severity: 'INFO',
            title: 'Surgery Completed',
            message,
          },
        });
      }
    } catch { /* best-effort */ }

    try {
      const { createActivityLog } = require('../../../utils/activityLog');
      await createActivityLog({ userId: req.user.userId || req.user.id, action: 'COMPLETE_SURGERY', module: 'OT' });
    } catch { /* best-effort */ }

    return res.json({ message: result.message });
  } catch (err) {
    console.error('completeSurgery error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getMyRecoveryPatients = async (req, res) => {
  try {
    const doctor = await getDoctorId(req.user.userId || req.user.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const schedules = await prisma.surgerySchedule.findMany({
      where: { surgeonId: doctor.id, surgerySession: { recoveryRecord: { isNot: null } } },
      include: {
        otRequest: {
          include: {
            patient: { select: { id: true, name: true, uhid: true, mobile: true, gender: true } },
            admission: { select: { id: true, ipdNumber: true, ward: true, bedNumber: true } },
          },
        },
        surgerySession: {
          include: {
            recoveryRecord: {
              include: {
                assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
                timeline: { orderBy: { createdAt: 'desc' } },
              },
            },
            postSurgeryNote: true,
          },
        },
        otRoom: { select: { roomName: true } },
        surgeon: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: { surgeryDate: 'desc' },
    });

    const items = schedules
      .filter((s) => s.surgerySession?.recoveryRecord)
      .map((s) => ({
        scheduleId: s.id,
        sessionId: s.surgerySession.id,
        patientName: s.otRequest?.patient?.name || 'Unknown',
        uhid: s.otRequest?.patient?.uhid || '',
        admissionNumber: s.otRequest?.admission?.ipdNumber || '',
        surgeryName: s.otRequest?.surgeryRecommendation || '',
        otRoom: s.otRoom?.roomName || '',
        recoveryStatus: s.surgerySession.recoveryRecord.status,
        assignedNurse: s.otRequest?.admission?.ward || '',
        currentLocation: s.surgerySession.recoveryRecord.transferredTo || 'Recovery Room',
        latestAssessment: s.surgerySession.recoveryRecord.assessments[0] || null,
        timeline: s.surgerySession.recoveryRecord.timeline || [],
        admittedAt: s.surgerySession.recoveryRecord.admittedAt,
        transferredAt: s.surgerySession.recoveryRecord.transferredAt,
      }));

    return res.json({ items });
  } catch (err) {
    console.error('getMyRecoveryPatients error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getRecoveryDetail = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const doctor = await getDoctorId(req.user.userId || req.user.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });

    const session = await prisma.surgerySession.findUnique({
      where: { id: sessionId },
      include: {
        surgerySchedule: {
          include: {
            otRequest: { include: { patient: true, admission: true } },
            otRoom: true,
          },
        },
        recoveryRecord: {
          include: {
            assessments: { orderBy: { createdAt: 'desc' } },
            timeline: { orderBy: { createdAt: 'desc' } },
            transfers: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!session) return res.status(404).json({ message: 'Surgery session not found' });

    return res.json({ session });
  } catch (err) {
    console.error('getRecoveryDetail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getRecoveryAssessments = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const assessments = await prisma.recoveryAssessment.findMany({
      where: { recoveryRecord: { surgerySessionId: sessionId } },
      orderBy: { createdAt: 'desc' },
      include: { assessedBy: { select: { name: true } } },
    });
    return res.json({ assessments });
  } catch (err) {
    console.error('getRecoveryAssessments error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getRecoveryTimeline = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const timeline = await prisma.recoveryTimeline.findMany({
      where: { recoveryRecord: { surgerySessionId: sessionId } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ timeline });
  } catch (err) {
    console.error('getRecoveryTimeline error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
