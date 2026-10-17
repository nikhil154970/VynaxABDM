const { prisma } = require('../../../config/prisma');
const { createPendingAllocationRequest } = require('../../../lib/allocationWorkflow');
const { autoReleaseCleaningRooms } = require('./roomHelper');

function parseOptionalInt(v) {
  if (v == null) return 0;
  const n = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function timeToMinutes(t) {
  if (!t) return 0;
  const parts = String(t).split(':');
  return parseInt(parts[0] || '0', 10) * 60 + parseInt(parts[1] || '0', 10);
}

function parseDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function localDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function combineDateAndTime(surgeryDate, startTime) {
  const [h, m] = String(startTime || '0:0').split(':').map(Number);
  const dt = new Date(surgeryDate);
  dt.setHours(h, m, 0, 0);
  return dt;
}

/** IN_PROGRESS without session = broken start; reset so patient shows in Today's list again */
async function repairOrphanSchedules() {
  const orphans = await prisma.surgerySchedule.findMany({
    where: { status: 'IN_PROGRESS', surgerySession: null },
    select: { id: true, otRequestId: true },
  });
  if (!orphans.length) return 0;

  await prisma.$transaction(async (tx) => {
    for (const o of orphans) {
      await tx.surgerySchedule.update({ where: { id: o.id }, data: { status: 'SCHEDULED' } });
      await tx.otRequest.update({ where: { id: o.otRequestId }, data: { status: 'SCHEDULED' } });
    }
  });

  console.warn(`[ot] Repaired ${orphans.length} orphan surgery schedule(s) (IN_PROGRESS without session → SCHEDULED)`);
  return orphans.length;
}

async function checkOverlap(tx, otRoomId, surgeryDate, startTime, duration, excludeId) {
  const start = timeToMinutes(startTime);
  const end = start + duration;
  const where = {
    otRoomId,
    surgeryDate: new Date(surgeryDate),
    status: { notIn: ['CANCELLED'] },
  };
  if (excludeId) where.id = { not: excludeId };

  const existing = await tx.surgerySchedule.findMany({ where, select: { id: true, startTime: true, estimatedDuration: true } });
  for (const s of existing) {
    const sStart = timeToMinutes(s.startTime);
    const sEnd = sStart + s.estimatedDuration;
    if (start < sEnd && end > sStart) return s.id;
  }
  return null;
}

async function checkStaffOverlap(tx, field, staffId, surgeryDate, startTime, duration, excludeId) {
  const start = timeToMinutes(startTime);
  const end = start + duration;
  const where = {
    [field]: staffId,
    surgeryDate: new Date(surgeryDate),
    status: { notIn: ['CANCELLED'] },
  };
  if (excludeId) where.id = { not: excludeId };

  const existing = await tx.surgerySchedule.findMany({ where, select: { id: true, startTime: true, estimatedDuration: true } });
  for (const s of existing) {
    const sStart = timeToMinutes(s.startTime);
    const sEnd = sStart + s.estimatedDuration;
    if (start < sEnd && end > sStart) return s.id;
  }
  return null;
}

// ─── Stats ───
async function getStats(req, res) {
  try {
    const { start: today, end: tomorrow } = localDayBounds();

    const pendingScheduling = await prisma.otRequest.count({
      where: { billId: { not: null }, surgerySchedule: null, status: { in: ['APPROVED_FOR_OT', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED'] } },
    });

    const scheduledToday = await prisma.surgerySchedule.count({
      where: { surgeryDate: { gte: today, lt: tomorrow }, status: 'SCHEDULED', surgerySession: null },
    });

    const upcoming = await prisma.surgerySchedule.count({
      where: { surgeryDate: { gte: tomorrow }, status: 'SCHEDULED' },
    });

    const delayed = await prisma.surgerySchedule.count({
      where: { status: 'DELAYED' },
    });

    return res.json({ pendingScheduling, scheduledToday, upcoming, delayed });
  } catch (err) {
    console.error('surgery stats error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── List pending (APPROVED_FOR_OT, not yet scheduled) ───
async function listPending(req, res) {
  try {
    const { search, uhid, priority, page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const where = { surgerySchedule: null, preOperativeAssessment: { isNot: null }, billId: { not: null } };
    if (search) where.patient = { name: { contains: String(search), mode: 'insensitive' } };
    if (uhid) where.uhid = { contains: String(uhid), mode: 'insensitive' };
    if (priority) where.priority = String(priority);

    const [items, total] = await Promise.all([
      prisma.otRequest.findMany({
        where,
        skip,
        take: Math.min(100, Math.max(1, Number(limit))),
        orderBy: { billDate: 'desc' },
        include: {
          patient: { select: { id: true, name: true, uhid: true } },
          doctor: { select: { id: true, user: { select: { id: true, name: true } }, specialization: true } },
          nurse: { select: { id: true, name: true } },
          admission: { select: { id: true, ipdNumber: true } },
          bill: { select: { billNumber: true } },
        },
      }),
      prisma.otRequest.count({ where }),
    ]);

    return res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('listPending error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── List scheduled surgeries ───
async function listScheduled(req, res) {
  try {
    const { search, uhid, status, date, page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.surgeryDate = { gte: d, lt: next };
    }

    const [items, total] = await Promise.all([
      prisma.surgerySchedule.findMany({
        where,
        skip,
        take: Math.min(100, Math.max(1, Number(limit))),
        orderBy: { surgeryDate: 'desc' },
        include: {
          otRequest: {
            include: {
              patient: { select: { id: true, name: true, uhid: true } },
              doctor: { select: { id: true, user: { select: { id: true, name: true } }, specialization: true } },
              admission: { select: { id: true, ipdNumber: true } },
            },
          },
          otRoom: { select: { id: true, roomNumber: true, roomName: true } },
          surgeon: { select: { id: true, user: { select: { name: true } }, specialization: true } },
          assistantSurgeon: { select: { id: true, user: { select: { name: true } }, specialization: true } },
          otNurse: { select: { id: true, name: true } },
          anaesthetist: { select: { id: true, user: { select: { name: true } }, specialization: true } },
        },
      }),
      prisma.surgerySchedule.count({ where }),
    ]);

    const mapped = items.map((s) => {
      const reqData = s.otRequest;
      return {
        id: s.id,
        otRequestId: s.otRequestId,
        surgeryDate: s.surgeryDate,
        startTime: s.startTime,
        estimatedDuration: s.estimatedDuration,
        status: s.status,
        remarks: s.remarks,
        createdAt: s.createdAt,
        patient: reqData?.patient || null,
        uhid: reqData?.uhid || null,
        requestNumber: reqData?.requestNumber || null,
        surgeryRecommendation: reqData?.surgeryRecommendation || null,
        priority: reqData?.priority || null,
        billDate: reqData?.billDate || null,
        doctor: reqData?.doctor || null,
        admission: reqData?.admission || null,
        otRoom: s.otRoom,
        surgeon: s.surgeon,
        assistantSurgeon: s.assistantSurgeon,
        otNurse: s.otNurse,
        anaesthetist: s.anaesthetist,
      };
    });

    return res.json({ items: mapped, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('listScheduled error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Schedule surgery ───
async function scheduleSurgery(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { otRequestId, surgeryDate, startTime, estimatedDuration, otRoomId, surgeonId, assistantSurgeonId, anaesthetistId, remarks } = req.body;

    if (!otRequestId) return res.status(400).json({ message: 'OT request is required' });
    if (!surgeryDate) return res.status(400).json({ message: 'Surgery date is required' });
    if (!startTime) return res.status(400).json({ message: 'Surgery time is required' });
    if (!estimatedDuration || estimatedDuration < 1) return res.status(400).json({ message: 'Valid estimated duration is required' });
    if (!otRoomId) return res.status(400).json({ message: 'OT Room is mandatory' });
    if (!surgeonId) return res.status(400).json({ message: 'Surgeon is mandatory' });
    if (!anaesthetistId) return res.status(400).json({ message: 'Anaesthetist is mandatory' });

    const sDate = parseDateOnly(surgeryDate);
    if (!sDate) return res.status(400).json({ message: 'Invalid surgery date' });
    const { start: todayStart, end: tomorrowStart } = localDayBounds();
    if (sDate < todayStart) return res.status(400).json({ message: 'Surgery date cannot be in the past' });

    const otRequest = await prisma.otRequest.findUnique({
      where: { id: otRequestId },
      select: { id: true, status: true, surgerySchedule: { select: { id: true } } },
    });
    if (!otRequest) return res.status(404).json({ message: 'OT request not found' });
    // Allow scheduling if pre-assessment completed, regardless of billing status
    const hasAssessment = await prisma.preOperativeAssessment.findUnique({ where: { otRequestId }, select: { id: true } });
    if (!hasAssessment) return res.status(400).json({ message: 'Pre-operative assessment must be completed before scheduling' });
    if (otRequest.surgerySchedule) return res.status(409).json({ message: 'Surgery already scheduled for this patient' });

    const dur = parseOptionalInt(estimatedDuration);
    if (dur < 1) return res.status(400).json({ message: 'Estimated duration must be at least 1 minute' });

    const isToday = sDate >= todayStart && sDate < tomorrowStart;

    const result = await prisma.$transaction(async (tx) => {
      const roomConflict = await checkOverlap(tx, otRoomId, sDate, startTime, dur, null);
      if (roomConflict) throw new Error('OT Room is already booked at this time');

      const surgeonConflict = await checkStaffOverlap(tx, 'surgeonId', surgeonId, sDate, startTime, dur, null);
      if (surgeonConflict) throw new Error('Surgeon is already scheduled at this time');

      const anaesthetistConflict = await checkStaffOverlap(tx, 'anaesthetistId', anaesthetistId, sDate, startTime, dur, null);
      if (anaesthetistConflict) throw new Error('Anaesthetist is already scheduled at this time');

      const schedule = await tx.surgerySchedule.create({
        data: {
          otRequestId,
          surgeryDate: sDate,
          startTime,
          estimatedDuration: dur,
          otRoomId,
          surgeonId,
          assistantSurgeonId: assistantSurgeonId || null,
          anaesthetistId,
          remarks: remarks || null,
          status: 'SCHEDULED',
          createdBy: userId,
        },
        include: {
          otRequest: { include: { patient: { select: { name: true, uhid: true } } } },
          otRoom: { select: { roomNumber: true, roomName: true } },
          surgeon: { select: { id: true, user: { select: { name: true } } } },
          assistantSurgeon: { select: { id: true, user: { select: { name: true } } } },
          anaesthetist: { select: { id: true, user: { select: { name: true } } } },
        },
      });

      await tx.otRequest.update({
        where: { id: otRequestId },
        data: {
          status: 'SCHEDULED',
          statusHistory: {
            create: { status: 'SCHEDULED', changedBy: userId },
          },
        },
      });

      return schedule;
    }, { maxWait: 15000, timeout: 30000 });

    try {
      const { createActivityLog } = require('../../../utils/activityLog');
      await createActivityLog({ userId, action: 'UPDATE_OT_REQUEST_STATUS', module: 'OT' });
    } catch { /* best-effort */ }

    // Notifications
    try {
      const notifyUserIds = [];
      const surgeonUser = await prisma.doctor.findUnique({ where: { id: result.surgeonId }, select: { userId: true } });
      if (surgeonUser) notifyUserIds.push(surgeonUser.userId);
      const anaesthetistUser = await prisma.doctor.findUnique({ where: { id: result.anaesthetistId }, select: { userId: true } });
      if (anaesthetistUser) notifyUserIds.push(anaesthetistUser.userId);

      const uniqueIds = [...new Set(notifyUserIds.filter(Boolean))];
      if (uniqueIds.length > 0) {
        const patientName = result.otRequest?.patient?.name || 'Patient';
        await prisma.notification.createMany({
          data: uniqueIds.map((uid) => ({
            userId: uid,
            type: 'UPDATE',
            severity: 'INFO',
            title: 'Surgery Scheduled Successfully',
            message: `Surgery for ${patientName} scheduled on ${new Date(sDate).toLocaleDateString('en-IN')} at ${startTime}`,
          })),
        });
      }
    } catch (notifyErr) {
      console.warn('Surgery notification failed:', notifyErr?.message || notifyErr);
    }

    // Auto-create allocation request for HR to assign OT nurse
    try {
      const otReqWithPatient = await prisma.otRequest.findUnique({
        where: { id: otRequestId },
        select: { patientId: true, patient: { select: { name: true, uhid: true } } },
      });
      if (otReqWithPatient) {
        await createPendingAllocationRequest(prisma, {
          patientId: otReqWithPatient.patientId,
          uhid: otReqWithPatient.patient.uhid,
          patientName: otReqWithPatient.patient.name,
          otRequestId,
          sourceModule: 'OT',
          requestedStaffType: 'NURSE',
          priority: 'HIGH',
          reason: `OT nurse required for scheduled surgery on ${new Date(sDate).toLocaleDateString('en-IN')} at ${startTime}`,
          requestedById: userId,
          requestedByName: req.user?.name || 'OT Technician',
        });
      }
    } catch (allocErr) {
      console.error('Failed to create OT allocation request:', allocErr?.message || allocErr);
    }

    return res.status(201).json({
      ok: true,
      schedule: result,
      routing: isToday ? 'today' : 'upcoming',
    });
  } catch (err) {
    console.error('scheduleSurgery error:', err);
    if (err.message?.includes('already booked') || err.message?.includes('already scheduled') || err.message?.includes('already assigned')) {
      return res.status(409).json({ message: err.message });
    }
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

// ─── Get today's surgeries (upcoming for today, not yet delayed) ───
async function getTodaySurgeries(req, res) {
  try {
    await repairOrphanSchedules();

    const { start: today, end: tomorrow } = localDayBounds();
    const now = new Date();

    const all = await prisma.surgerySchedule.findMany({
      where: {
        surgeryDate: { gte: today, lt: tomorrow },
        status: 'SCHEDULED',
        surgerySession: null,
      },
      orderBy: { startTime: 'asc' },
      include: {
        surgerySession: { select: { id: true, status: true } },
        otRequest: { include: { patient: { select: { name: true, uhid: true } }, preOperativeAssessment: { include: { assessedBy: { select: { name: true } } } } } },
        otRoom: { select: { roomNumber: true, roomName: true } },
        surgeon: { select: { id: true, userId: true, user: { select: { name: true } } } },
        otNurse: { select: { id: true, name: true } },
        anaesthetist: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    const items = all.map((s) => {
      const scheduledDateTime = combineDateAndTime(s.surgeryDate, s.startTime);
      const computedStatus = scheduledDateTime < now ? 'delayed' : 'scheduled';
      const delayMinutes = computedStatus === 'delayed'
        ? Math.max(0, Math.round((now - scheduledDateTime) / 60000))
        : 0;
      return { ...s, computedStatus, delayMinutes };
    });

    return res.json({ items });
  } catch (err) {
    console.error('getTodaySurgeries error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Get upcoming surgeries ───
async function getUpcomingSurgeries(req, res) {
  try {
    const { end: tomorrow } = localDayBounds();

    const items = await prisma.surgerySchedule.findMany({
      where: { surgeryDate: { gte: tomorrow }, status: 'SCHEDULED' },
      orderBy: { surgeryDate: 'asc' },
      include: {
        otRequest: { include: { patient: { select: { name: true, uhid: true } }, preOperativeAssessment: { include: { assessedBy: { select: { name: true } } } } } },
        otRoom: { select: { roomNumber: true, roomName: true } },
        surgeon: { select: { id: true, userId: true, user: { select: { name: true } } } },
        otNurse: { select: { id: true, name: true } },
        anaesthetist: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    const enriched = items.map(s => {
      const computedStatus = s.rescheduledAt ? 'rescheduled' : 'scheduled';
      return { ...s, computedStatus };
    });

    return res.json({ items: enriched });
  } catch (err) {
    console.error('getUpcomingSurgeries error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Get delayed surgeries ───
async function getDelayedSurgeries(req, res) {
  try {
    const now = new Date();

    const allScheduled = await prisma.surgerySchedule.findMany({
      where: { status: 'SCHEDULED' },
      include: {
        otRequest: { include: { patient: { select: { name: true, uhid: true, mobile: true } }, preOperativeAssessment: { include: { assessedBy: { select: { name: true } } } } } },
        otRoom: { select: { roomNumber: true, roomName: true } },
        surgeon: { select: { id: true, userId: true, user: { select: { name: true } } } },
        otNurse: { select: { id: true, name: true } },
        anaesthetist: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: [{ surgeryDate: 'asc' }, { startTime: 'asc' }],
    });

    const delayed = allScheduled.filter((s) => {
      const scheduledDateTime = combineDateAndTime(s.surgeryDate, s.startTime);
      return scheduledDateTime < now;
    });

    // Create notifications for newly delayed surgeries
    for (const s of delayed) {
      try {
        const existingNotify = await prisma.notification.findFirst({
          where: { title: 'Surgery Delayed', message: { contains: s.id } },
        });
        if (!existingNotify) {
          const patientName = s.otRequest?.patient?.name || 'Patient';
          const notifyUserIds = [];
          if (s.surgeon?.userId) notifyUserIds.push(s.surgeon.userId);
          if (s.otNurseId) notifyUserIds.push(s.otNurseId);

          const uniqueIds = [...new Set(notifyUserIds.filter(Boolean))];
          if (uniqueIds.length > 0) {
            await prisma.notification.createMany({
              data: uniqueIds.map((uid) => ({
                userId: uid,
                type: 'ALERT',
                severity: 'WARNING',
                title: 'Surgery Delayed',
                message: `Surgery for ${patientName} (${s.otRequest?.patient?.uhid || ''}) scheduled at ${s.startTime} is delayed. Surgery ID: ${s.id}`,
              })),
            });
          }
        }
      } catch (notifyErr) {
        console.error('Delay notification error for surgery', s.id, ':', notifyErr?.message || notifyErr);
      }
    }

    const enriched = delayed.map((s) => {
      const scheduledDateTime = combineDateAndTime(s.surgeryDate, s.startTime);
      const delayMinutes = Math.round((now - scheduledDateTime) / 60000);
      return {
        ...s,
        computedStatus: 'delayed',
        delayMinutes,
        rescheduledAt: s.rescheduledAt || null,
        rescheduleReason: s.rescheduleReason || null,
      };
    });

    return res.json({ items: enriched });
  } catch (err) {
    console.error('getDelayedSurgeries error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Resources for dropdowns ───
async function getOtRooms(req, res) {
  try {
    await autoReleaseCleaningRooms();
    const rooms = await prisma.otRoom.findMany({
      orderBy: { roomNumber: 'asc' },
    });
    return res.json({ items: rooms });
  } catch (err) {
    console.error('getOtRooms error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getRoomStats(req, res) {
  try {
    await autoReleaseCleaningRooms();
    const groups = await prisma.otRoom.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const all = await prisma.otRoom.count();
    const stats = { total: all };
    for (const g of groups) {
      stats[g.status.toLowerCase()] = g._count.id;
    }
    stats.available = stats.available || 0;
    stats.occupied = stats.occupied || 0;
    stats.cleaning = stats.cleaning || 0;
    stats.maintenance = stats.maintenance || 0;
    stats.inactive = stats.inactive || 0;
    return res.json({ stats });
  } catch (err) {
    console.error('getRoomStats error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getRoomDetail(req, res) {
  try {
    await autoReleaseCleaningRooms();
    const { id } = req.params;
    const room = await prisma.otRoom.findUnique({
      where: { id },
      include: {
        surgerySchedules: {
          where: { status: { in: ['IN_PROGRESS', 'SCHEDULED'] } },
          include: {
            otRequest: {
              select: {
                requestNumber: true,
                patient: { select: { id: true, name: true, uhid: true } },
              },
            },
            surgerySession: {
              select: { id: true, startTime: true, status: true },
            },
          },
          orderBy: { surgeryDate: 'desc' },
          take: 1,
        },
      },
    });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const currentSchedule = room.surgerySchedules?.[0] || null;
    const patient = currentSchedule?.otRequest?.patient || null;
    const session = currentSchedule?.surgerySession || null;

    const detail = {
      id: room.id,
      roomNumber: room.roomNumber,
      roomName: room.roomName,
      floor: room.floor,
      status: room.status,
      occupiedSince: room.occupiedSince,
      expectedAvailableAt: room.expectedAvailableAt,
      currentPatient: patient ? { name: patient.name, uhid: patient.uhid } : null,
      currentSurgery: currentSchedule ? { requestNumber: currentSchedule.otRequest?.requestNumber, sessionStatus: session?.status, startedAt: session?.startTime } : null,
    };

    return res.json({ room: detail });
  } catch (err) {
    console.error('getRoomDetail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Room CRUD (OT technician level) ───
async function createOtRoom(req, res) {
  try {
    const { roomNumber, roomName, floor } = req.body;
    if (!roomNumber || !roomName) return res.status(400).json({ message: 'Room number and name are required' });

    const existing = await prisma.otRoom.findUnique({ where: { roomNumber } });
    if (existing) return res.status(409).json({ message: 'Room with this number already exists' });

    const room = await prisma.otRoom.create({
      data: { roomNumber: String(roomNumber).trim(), roomName: String(roomName).trim(), floor: floor || null },
    });
    return res.status(201).json({ ok: true, room });
  } catch (err) {
    console.error('createOtRoom error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateOtRoom(req, res) {
  try {
    const { id } = req.params;
    const { roomNumber, roomName, floor, status } = req.body;

    const room = await prisma.otRoom.findUnique({ where: { id } });
    if (!room) return res.status(404).json({ message: 'OT Room not found' });

    const data = {};
    if (roomNumber !== undefined) data.roomNumber = String(roomNumber).trim();
    if (roomName !== undefined) data.roomName = String(roomName).trim();
    if (floor !== undefined) data.floor = floor;
    if (status !== undefined) data.status = status;

    if (data.roomNumber && data.roomNumber !== room.roomNumber) {
      const dup = await prisma.otRoom.findUnique({ where: { roomNumber: data.roomNumber } });
      if (dup) return res.status(409).json({ message: 'Room with this number already exists' });
    }

    const updated = await prisma.otRoom.update({ where: { id }, data });
    return res.json({ ok: true, room: updated });
  } catch (err) {
    console.error('updateOtRoom error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteOtRoom(req, res) {
  try {
    const { id } = req.params;
    const scheduleCount = await prisma.surgerySchedule.count({ where: { otRoomId: id } });
    if (scheduleCount > 0) return res.status(400).json({ message: 'Cannot delete room with scheduled surgeries' });

    await prisma.otRoom.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('deleteOtRoom error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getDoctors(req, res) {
  try {
    const doctors = await prisma.doctor.findMany({
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    return res.json({ items: doctors });
  } catch (err) {
    console.error('getDoctors error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getNurses(req, res) {
  try {
    const nurses = await prisma.user.findMany({
      where: { role: 'NURSE', isActive: true },
      select: { id: true, name: true, employeeId: true },
      orderBy: { name: 'asc' },
    });
    return res.json({ items: nurses });
  } catch (err) {
    console.error('getNurses error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function rescheduleSurgery(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { scheduleId, surgeryDate, startTime, reason, otRoomId } = req.body;
    if (!scheduleId) return res.status(400).json({ message: 'Schedule ID is required' });
    if (!surgeryDate) return res.status(400).json({ message: 'New surgery date is required' });
    if (!startTime) return res.status(400).json({ message: 'New surgery time is required' });

    const existing = await prisma.surgerySchedule.findUnique({
      where: { id: scheduleId },
      include: {
        surgerySession: { select: { id: true, status: true } },
        otRequest: { select: { id: true, requestNumber: true, patient: { select: { name: true, uhid: true } } } },
      },
    });
    if (!existing) return res.status(404).json({ message: 'Surgery schedule not found' });
    if (existing.surgerySession) {
      return res.status(409).json({ message: 'Cannot reschedule — surgery already started' });
    }

    const sDate = parseDateOnly(surgeryDate);
    if (!sDate) return res.status(400).json({ message: 'Invalid surgery date' });

    const data = {
      surgeryDate: sDate,
      startTime,
      rescheduledAt: new Date(),
      rescheduleReason: reason || null,
      status: 'SCHEDULED',
    };

    // If a new room is provided and different from current, update it
    if (otRoomId && otRoomId !== existing.otRoomId) {
      const room = await prisma.otRoom.findUnique({ where: { id: otRoomId } });
      if (!room) return res.status(404).json({ message: 'OT Room not found' });
      if (room.status !== 'AVAILABLE') return res.status(400).json({ message: 'Selected room is not available' });

      // Check for scheduling conflicts in the new room
      const overlap = await prisma.$transaction((tx) =>
        checkOverlap(tx, otRoomId, sDate, startTime, existing.estimatedDuration, scheduleId)
      );
      if (overlap) return res.status(409).json({ message: `Room selected is already scheduled at this time` });

      data.otRoomId = otRoomId;
    }

    const updated = await prisma.surgerySchedule.update({
      where: { id: scheduleId },
      data,
      include: {
        otRequest: { include: { patient: { select: { name: true, uhid: true } } } },
        otRoom: { select: { roomNumber: true, roomName: true } },
        surgeon: { select: { id: true, user: { select: { name: true } } } },
        otNurse: { select: { id: true, name: true } },
        anaesthetist: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    // Notify assigned nurse about reschedule
    if (existing.otNurseId) {
      try {
        await prisma.notification.create({
          data: {
            userId: existing.otNurseId,
            type: 'ALERT',
            severity: 'WARNING',
            title: 'Surgery Rescheduled',
            message: `OT for ${existing.otRequest?.patient?.name || 'patient'} (${existing.otRequest?.requestNumber || ''}) rescheduled to ${sDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${startTime}.${reason ? ' Reason: ' + reason : ''}`,
          },
        });
      } catch { /* best-effort */ }
    }
    // Also check for HR-assigned nurses via AllocationRequest
    try {
      const allocations = await prisma.allocationRequest.findMany({
        where: { otRequestId: existing.otRequestId, status: 'APPROVED', assignedToId: { not: null } },
        select: { assignedToId: true },
      });
      for (const al of allocations) {
        if (al.assignedToId && al.assignedToId !== existing.otNurseId) {
          await prisma.notification.create({
            data: {
              userId: al.assignedToId,
              type: 'ALERT',
              severity: 'WARNING',
              title: 'Surgery Rescheduled',
              message: `OT for ${existing.otRequest?.patient?.name || 'patient'} (${existing.otRequest?.requestNumber || ''}) rescheduled to ${sDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${startTime}.${reason ? ' Reason: ' + reason : ''}`,
            },
          });
        }
      }
    } catch { /* best-effort */ }

    return res.json({ ok: true, schedule: updated });
  } catch (err) {
    console.error('rescheduleSurgery error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}

module.exports = { getStats, listPending, listScheduled, scheduleSurgery, getTodaySurgeries, getUpcomingSurgeries, getDelayedSurgeries, getOtRooms, getRoomStats, getRoomDetail, createOtRoom, updateOtRoom, deleteOtRoom, getDoctors, getNurses, rescheduleSurgery };
