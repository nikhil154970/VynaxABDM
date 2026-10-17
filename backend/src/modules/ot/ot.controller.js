const { prisma } = require('../../config/prisma');

const getDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const now = new Date();

    const [
      // Summary counts
      scheduledToday,
      inProgressCount,
      pendingScheduling,
      upcoming,
      delayed,
      inRecovery,
      readyTransfer,
      completedToday,
      pendingOtRequests,

      // Room stats
      roomsTotal,
      roomsAvailable,
      roomsOccupied,
      roomsCleaning,
      roomsMaintenance,

      // Pipeline counts
      pipelineApproved,
      pipelineScheduled,
      pipelineInProgress,
      pipelineInRecovery,
      pipelineCompleted,

      // Notifications
      notifCount,

      // Today schedule detail
      todayScheduleRaw,

      // In progress detail
      inProgressRaw,

      // Delayed alerts
      delayedRaw,

      // Recovery summary
      recoveryUnderObs,
      recoveryStable,
      recoveryCritical,
      recoveryReadyTransfer,
    ] = await Promise.all([
      prisma.surgerySchedule.count({ where: { surgeryDate: { gte: today, lt: tomorrow }, status: 'SCHEDULED' } }),
      prisma.surgerySession.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.otRequest.count({ where: { status: 'APPROVED_FOR_OT', billDate: { gte: today } } }),
      prisma.surgerySchedule.count({ where: { surgeryDate: { gte: tomorrow } } }),
      prisma.surgerySchedule.count({ where: { status: { in: ['DELAYED', 'RESCHEDULED'] } } }),
      prisma.surgerySession.count({ where: { status: 'IN_RECOVERY' } }),
      prisma.recoveryRecord.count({ where: { transferRequestStatus: 'APPROVED' } }),
      prisma.surgerySession.count({ where: { status: 'COMPLETED', endTime: { gte: today } } }),
      prisma.otRequest.count({ where: { status: { notIn: ['COMPLETED', 'IN_RECOVERY'] } } }),

      prisma.otRoom.count(),
      prisma.otRoom.count({ where: { status: 'AVAILABLE' } }),
      prisma.otRoom.count({ where: { status: 'OCCUPIED' } }),
      prisma.otRoom.count({ where: { status: 'CLEANING' } }),
      prisma.otRoom.count({ where: { status: 'MAINTENANCE' } }),

      prisma.otRequest.count({ where: { status: 'APPROVED_FOR_OT' } }),
      prisma.surgerySchedule.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      prisma.surgerySession.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.surgerySession.count({ where: { status: 'IN_RECOVERY' } }),
      prisma.surgerySession.count({ where: { status: 'COMPLETED' } }),

      prisma.notification.count({ where: { type: 'ALERT', createdAt: { gte: today } } }),

      prisma.surgerySchedule.findMany({
        where: { surgeryDate: { gte: today, lt: tomorrow } },
        orderBy: { startTime: 'asc' },
        take: 20,
        include: {
          otRoom: { select: { roomName: true } },
          otRequest: { select: { requestNumber: true, patient: { select: { name: true, uhid: true } }, priority: true } },
          surgeon: { select: { user: { select: { name: true } } } },
        },
      }),

      prisma.surgerySession.findMany({
        where: { status: 'IN_PROGRESS' },
        include: {
          surgerySchedule: {
            include: {
              otRoom: { select: { roomName: true } },
              otRequest: { select: { patient: { select: { name: true, uhid: true } } } },
              surgeon: { select: { user: { select: { name: true } } } },
            },
          },
        },
      }),

      prisma.surgerySchedule.findMany({
        where: { status: { in: ['DELAYED', 'RESCHEDULED'] }, surgeryDate: { gte: today } },
        orderBy: { startTime: 'asc' },
        take: 10,
        include: {
          otRequest: { select: { patient: { select: { name: true, uhid: true } } } },
        },
      }),

      prisma.recoveryRecord.count({ where: { status: 'UNDER_OBSERVATION' } }),
      prisma.recoveryRecord.count({ where: { status: 'STABLE' } }),
      prisma.recoveryRecord.count({ where: { status: 'CRITICAL' } }),
      prisma.recoveryRecord.count({ where: { transferRequestStatus: 'APPROVED' } }),
    ]);

    // ─── Build response ───

    const todaySchedule = todayScheduleRaw.map((s) => ({
      id: s.id,
      requestNumber: s.otRequest?.requestNumber,
      patientName: s.otRequest?.patient?.name || 'Unknown',
      uhid: s.otRequest?.patient?.uhid || '',
      surgeryDate: s.surgeryDate,
      startTime: s.startTime,
      otRoom: s.otRoom?.roomName || '—',
      surgeonName: s.surgeon?.user?.name || '—',
      status: s.status,
      priority: s.otRequest?.priority || 'Normal',
    }));

    const inProgressList = inProgressRaw.map((s) => {
      const elapsed = now - new Date(s.startTime).getTime();
      return {
        sessionId: s.id,
        patientName: s.surgerySchedule?.otRequest?.patient?.name || 'Unknown',
        uhid: s.surgerySchedule?.otRequest?.patient?.uhid || '',
        otRoom: s.surgerySchedule?.otRoom?.roomName || '—',
        surgeonName: s.surgerySchedule?.surgeon?.user?.name || '—',
        startTime: s.startTime,
        elapsedMinutes: Math.floor(elapsed / 60000),
      };
    });

    const delayedAlerts = delayedRaw.map((s) => ({
      id: s.id,
      patientName: s.otRequest?.patient?.name || 'Unknown',
      uhid: s.otRequest?.patient?.uhid || '',
      delayMinutes: s.status === 'DELAYED' ? 30 : 0,
      scheduledTime: s.startTime || '—',
    }));

    const roomStats = {
      total: roomsTotal,
      available: roomsAvailable,
      occupied: roomsOccupied,
      cleaning: roomsCleaning,
      maintenance: roomsMaintenance,
    };

    return res.json({
      summary: {
        todaySurgeries: scheduledToday + inProgressCount,
        scheduledToday,
        inProgress: inProgressCount,
        pendingScheduling,
        upcoming,
        delayed,
        inRecovery,
        readyForTransfer: readyTransfer,
        completedToday,
        pendingOtRequests,
        roomsTotal,
        roomsAvailable,
        roomsOccupied,
        roomsCleaning,
        unreadNotifications: notifCount,
      },
      pipeline: [
        { key: 'APPROVED_FOR_OT', label: 'Approved', count: pipelineApproved },
        { key: 'SCHEDULED', label: 'Scheduled', count: pipelineScheduled },
        { key: 'IN_PROGRESS', label: 'In Progress', count: pipelineInProgress },
        { key: 'IN_RECOVERY', label: 'Recovery', count: pipelineInRecovery },
        { key: 'COMPLETED', label: 'Completed', count: pipelineCompleted },
      ],
      todaySchedule,
      inProgressList,
      delayedAlerts,
      recoverySummary: {
        total: recoveryUnderObs + recoveryStable + recoveryCritical,
        underObservation: recoveryUnderObs,
        stable: recoveryStable,
        critical: recoveryCritical,
        readyForTransfer: recoveryReadyTransfer,
      },
      roomStats,
      meta: {
        date: today.toISOString().slice(0, 10),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const listOtRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const where = {
      status: {
        in: [
          'OT_REQUEST_CREATED',
          'PAYMENT_PENDING',
          'PAYMENT_COMPLETED',
          'APPROVED_FOR_OT',
        ],
      },
      NOT: {
        status: 'OT_REQUEST_CREATED',
        preOperativeAssessment: null,
      },
    };

    const [items, total] = await Promise.all([
      prisma.otRequest.findMany({
        where,
        skip,
        take: Math.min(100, Math.max(1, Number(limit))),
        orderBy: [{ billDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          patient: { select: { id: true, name: true, uhid: true } },
          doctor: { select: { id: true, user: { select: { name: true } } } },
          nurse: { select: { id: true, name: true } },
          admission: { select: { id: true, ipdNumber: true, bedNumber: true, ward: { select: { name: true } } } },
          bill: { select: { billNumber: true, totalAmount: true, paidAmount: true, status: true } },
        },
      }),
      prisma.otRequest.count({ where }),
    ]);

    return res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('ot listOtRequests error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getDashboard, listOtRequests };
