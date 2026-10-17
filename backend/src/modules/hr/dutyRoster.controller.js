const { prisma } = require('../../config/prisma');
const { computeShiftStatus, legacyShiftEnum, todayStart } = require('../../lib/shiftHelpers');

// ─── Helpers ───

function toDateOnly(d) {
  if (!d) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  if (typeof d === 'string') {
    return new Date(d.slice(0, 10) + 'T00:00:00.000Z');
  }
  const dt = new Date(d);
  if (dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0 && dt.getUTCMilliseconds() === 0) {
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  }
  return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
}

const WORKLOAD_LIMITS = {
  GENERAL: 8,
  PRIVATE: 4,
  ICU: 2,
  RECOVERY: 3,
  OT: 1,
  GENERAL_WARD: 8,
  PRIVATE_WARD: 4,
};

// ─── Notification Helper ───

async function notifyDutyChange(action, duty, changedById) {
  try {
    const notifyIds = [];

    // Notify the assigned employee
    if (duty.employeeId && duty.employeeId !== changedById) {
      notifyIds.push(duty.employeeId);
    }

    // Notify all HR managers + super admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ['HR_MANAGER', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true },
    });
    for (const a of admins) {
      if (a.id !== changedById) notifyIds.push(a.id);
    }

    const uniqueIds = [...new Set(notifyIds)];
    if (uniqueIds.length === 0) return;

    const actions = { CREATED: 'assigned', UPDATED: 'updated', DELETED: 'removed' };
    const label = actions[action] || 'updated';
    const dateStr = duty.date ? new Date(duty.date).toLocaleDateString('en-IN') : '';

    await prisma.notification.createMany({
      data: uniqueIds.map((uid) => ({
        userId: uid,
        type: 'UPDATE',
        severity: 'INFO',
        title: `Duty ${label}`,
        message: `Duty for ${duty.employeeName || 'staff'} on ${dateStr} (${duty.shift || ''} - ${duty.dutyType || ''}) has been ${label}${action === 'DELETED' ? '' : '.'}`,
      })),
    });
  } catch (err) {
    console.warn('Duty notification failed:', err?.message || err);
  }
}

/**
 * Compute status based on current time vs startTime/endTime.
 * UPCOMING -> ON_DUTY -> COMPLETED.
 * Also marks as OFF_DUTY if endTime has passed and no other duty overlaps.
 */
function computeStatus(duty) {
  const now = new Date();

  // 1. Resolve start/end times
  let startTimeStr = duty.startTime;
  let endTimeStr = duty.endTime;

  if (!startTimeStr || !endTimeStr) {
    const s = String(duty.shift || '').toUpperCase();
    if (s === 'MORNING') {
      startTimeStr = '06:00';
      endTimeStr = '14:00';
    } else if (s === 'EVENING') {
      startTimeStr = '14:00';
      endTimeStr = '22:00';
    } else if (s === 'NIGHT') {
      startTimeStr = '22:00';
      endTimeStr = '06:00';
    }
  }

  if (!startTimeStr || !endTimeStr) {
    const today = toDateOnly(now);
    const dutyDate = toDateOnly(duty.date);
    if (dutyDate > today) return 'UPCOMING';
    if (dutyDate < today) return 'COMPLETED';
    return 'ON_DUTY';
  }

  // 2. Build start and end Date objects
  const dutyDate = toDateOnly(duty.date);

  const [sh, sm] = startTimeStr.split(':').map(Number);
  const [eh, em] = endTimeStr.split(':').map(Number);

  const startDate = new Date(dutyDate.getTime());
  startDate.setHours(sh, sm, 0, 0);

  const endDate = new Date(dutyDate.getTime());
  if (eh < sh || (eh === sh && em <= sm)) {
    // Spans midnight: end date is next day
    endDate.setDate(endDate.getDate() + 1);
  }
  endDate.setHours(eh, em, 0, 0);

  // 3. Compare with 'now'
  if (now < startDate) {
    return 'UPCOMING';
  } else if (now >= startDate && now < endDate) {
    return 'ON_DUTY';
  } else {
    return 'COMPLETED';
  }
}

async function updateStatuses() {
  const now = new Date();
  const today = toDateOnly(now);

  const duties = await prisma.dutyRoster.findMany({ where: { date: today } });

  for (const duty of duties) {
    const computed = computeStatus(duty);
    if (duty.status !== computed) {
      await prisma.dutyRoster.update({
        where: { id: duty.id },
        data: { status: computed },
      });
    }
  }
}

// ─── Conflict Detection ───

async function checkOverlap(employeeId, date, shift, startTime, endTime, excludeId) {
  const dateObj = toDateOnly(date);
  const where = {
    employeeId,
    date: dateObj,
    shift,
  };
  if (excludeId) where.id = { not: excludeId };

  const existing = await prisma.dutyRoster.findMany({ where });

  // Check time overlap
  if (startTime && endTime) {
    const [nsH, nsM] = startTime.split(':').map(Number);
    const [neH, neM] = endTime.split(':').map(Number);
    const newStart = nsH * 60 + nsM;
    const newEnd = neH * 60 + neM;

    for (const ex of existing) {
      if (!ex.startTime || !ex.endTime) continue;
      const [esH, esM] = ex.startTime.split(':').map(Number);
      const [eeH, eeM] = ex.endTime.split(':').map(Number);
      const exStart = esH * 60 + esM;
      const exEnd = eeH * 60 + eeM;

      // New (newStart - newEnd) overlaps with existing (exStart - exEnd)
      if (newStart < exEnd && newEnd > exStart) {
        return {
          conflict: true,
          existingDuty: ex,
          message: `Employee already has a "${ex.dutyType}" duty from ${ex.startTime} to ${ex.endTime} (${ex.dutyLocation || 'N/A'})`,
        };
      }
    }
  }

  return { conflict: false };
}

async function checkWorkloadLimit(dutyType, wardType, employeeId, date, shift, patientCount, excludeId) {
  const dateObj = toDateOnly(date);
  const where = {
    employeeId,
    date: dateObj,
    shift,
    dutyType: dutyType,
    id: excludeId ? { not: excludeId } : undefined,
  };

  const existingSameType = await prisma.dutyRoster.findMany({ where });
  const existingPatientCount = existingSameType.reduce((sum, d) => sum + (d.patientCount || 0), 0);
  const totalPatients = existingPatientCount + (patientCount || 0);

  // New dedicated ward types
  if (dutyType === 'GENERAL_WARD' || dutyType === 'PRIVATE_WARD' || dutyType === 'ICU') {
    const limit = WORKLOAD_LIMITS[dutyType] || WORKLOAD_LIMITS.ICU;
    if (limit !== undefined && totalPatients > limit) {
      return { allowed: false, message: `${dutyType.replace(/_/g, ' ')} workload limit is ${limit} patients. Current would be ${totalPatients}.` };
    }
  }

  // Legacy WARD type (auto-assigned from allocation)
  if (dutyType === 'WARD') {
    const wt = wardType || 'GENERAL';
    const limit = WORKLOAD_LIMITS[wt];
    if (limit !== undefined && totalPatients > limit) {
      return { allowed: false, message: `${wt} ward workload limit is ${limit} patients. Current would be ${totalPatients}.` };
    }
  }

  if (dutyType === 'RECOVERY') {
    if (totalPatients > WORKLOAD_LIMITS.RECOVERY) {
      return { allowed: false, message: `Recovery workload limit is ${WORKLOAD_LIMITS.RECOVERY} patients. Current would be ${totalPatients}.` };
    }
  }

  if (dutyType === 'OT') {
    const existingCount = existingSameType.length;
    if (existingCount >= WORKLOAD_LIMITS.OT) {
      return { allowed: false, message: `OT nurse can only have ${WORKLOAD_LIMITS.OT} active OT duty per shift.` };
    }
  }

  return { allowed: true };
}

// ─── CRUD ───

async function listDutyRosters(req, res) {
  try {
    await updateStatuses();

    const {
      date, startDate, endDate, employeeId, shift,
      dutyType, status, search, page: pageStr, limit: limitStr,
    } = req.query;

    const page = Math.max(1, parseInt(pageStr, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 50));
    const skip = (page - 1) * limit;

    // ── 1. DutyRoster (new system) ──
    const drWhere = {};
    if (date) drWhere.date = toDateOnly(date);
    if (startDate) drWhere.date = { ...drWhere.date, gte: toDateOnly(startDate) };
    if (endDate) drWhere.date = { ...drWhere.date, lte: toDateOnly(endDate) };
    if (employeeId) drWhere.employeeId = employeeId;
    if (shift) drWhere.shift = shift;
    if (dutyType) drWhere.dutyType = dutyType;
    if (status) drWhere.status = status;
    if (search) {
      drWhere.OR = [
        { employeeName: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { dutyLocation: { contains: search, mode: 'insensitive' } },
      ];
    }

    // ── 2. AllocationRequest (existing nurse-to-patient assignments) ──
    const allocWhere = {
      status: 'APPROVED',
      assignedToId: { not: null },
      assignedShift: shift || undefined,
    };
    if (employeeId) allocWhere.assignedToId = employeeId;
    if (dutyType) {
      const moduleMap = { WARD: 'IPD', OT: 'OT', RECOVERY: 'RECOVERY' };
      const srcModule = moduleMap[dutyType];
      if (srcModule) allocWhere.sourceModule = srcModule;
    }
    if (search) {
      allocWhere.OR = [
        { assignedToName: { contains: search, mode: 'insensitive' } },
        { patientName: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ];
    }

    // ── 3. NurseDuty (existing simple ward assignments) ──
    const ndWhere = {};
    if (employeeId) ndWhere.nurseId = employeeId;
    if (shift) ndWhere.shift = shift;
    if (search) {
      ndWhere.OR = [
        { nurseName: { contains: search, mode: 'insensitive' } },
        { wardName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Apply date filters to AllocationRequest and NurseDuty
    const dateFilter = date ? toDateOnly(date) : null;
    const sdFilter = startDate ? toDateOnly(startDate) : null;
    const edFilter = endDate ? toDateOnly(endDate) : null;

    const [dutyRosterItems, allocationItems, nurseDutyItems] = await Promise.all([
      prisma.dutyRoster.findMany({ where: drWhere, orderBy: [{ date: 'desc' }, { startTime: 'asc' }] }),
      prisma.allocationRequest.findMany({ where: allocWhere, orderBy: { createdAt: 'desc' } }),
      prisma.nurseDuty.findMany({ where: ndWhere, orderBy: { dutyDate: 'desc' } }),
    ]);

    // ── Map AllocationRequest → duty format ──
    const moduleToDutyType = { IPD: 'WARD', OT: 'OT', RECOVERY: 'RECOVERY' };
    const allocAsDuties = allocationItems
      .filter((a) => {
        if (dateFilter && a.assignedAt) return toDateOnly(a.assignedAt).getTime() === dateFilter.getTime();
        if (sdFilter && a.assignedAt && a.assignedAt < sdFilter) return false;
        if (edFilter && a.assignedAt && a.assignedAt > new Date(edFilter.getTime() + 86400000)) return false;
        return true;
      })
      .map((a) => {
        const item = {
          id: `alloc_${a.id}`,
          date: a.assignedAt || a.createdAt,
          shift: a.assignedShift || a.requiredShift || '',
          employeeId: a.assignedToId || '',
          employeeName: a.assignedToName || '',
          department: a.department || '',
          dutyType: moduleToDutyType[a.sourceModule] || 'WARD',
          dutyLocation: `${a.sourceModule} - ${a.uhid}`,
          startTime: null,
          endTime: null,
          status: 'ON_DUTY',
          remarks: `Patient: ${a.patientName} (${a.uhid})`,
          wardType: null,
          assignedPatientIds: JSON.stringify([a.patientId]),
          bedIds: null,
          otRoomName: a.sourceModule === 'OT' ? a.uhid : null,
          surgeryId: null,
          surgeonName: null,
          timeSlot: null,
          recoveryRoomName: a.sourceModule === 'RECOVERY' ? a.uhid : null,
          patientCount: 1,
          createdById: a.assignedById || '',
          createdByName: a.assignedByName || '',
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          _source: 'allocation',
        };
        const live = computeStatus(item);
        item.status = live;
        item.liveStatus = live;
        return item;
      });

    // ── Map NurseDuty → duty format ──
    const ndAsDuties = nurseDutyItems
      .filter((n) => {
        if (dateFilter) return toDateOnly(n.dutyDate).getTime() === dateFilter.getTime();
        if (sdFilter && n.dutyDate < sdFilter) return false;
        if (edFilter && n.dutyDate > new Date(edFilter.getTime() + 86400000)) return false;
        return true;
      })
      .map((n) => {
        const item = {
          id: `nduty_${n.id}`,
          date: n.dutyDate,
          shift: n.shift,
          employeeId: n.nurseId,
          employeeName: n.nurseName,
          department: 'Nursing',
          dutyType: 'WARD',
          dutyLocation: n.wardName,
          startTime: null,
          endTime: null,
          status: 'ON_DUTY',
          remarks: `Ward: ${n.wardName}`,
          wardType: null,
          assignedPatientIds: null,
          bedIds: null,
          otRoomName: null,
          surgeryId: null,
          surgeonName: null,
          timeSlot: null,
          recoveryRoomName: null,
          patientCount: 0,
          createdById: '',
          createdByName: '',
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
          _source: 'nurseDuty',
        };
        const live = computeStatus(item);
        item.status = live;
        item.liveStatus = live;
        return item;
      });

    // ── Enrich DutyRoster items with live status ──
    const enrichedDR = dutyRosterItems.map((d) => ({
      ...d,
      liveStatus: computeStatus(d),
      _source: 'dutyRoster',
    }));

    // ── Merge & sort ──
    const allItems = [...enrichedDR, ...allocAsDuties, ...ndAsDuties];
    allItems.sort((a, b) => {
      const dateCmp = new Date(b.date) - new Date(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.startTime || '') < (b.startTime || '') ? -1 : 1;
    });

    const total = allItems.length;
    const paginated = allItems.slice(skip, skip + limit);

    const employeeIds = [...new Set(paginated.map((i) => i.employeeId).filter(Boolean))];
    const users = await prisma.user.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, role: true },
    });
    const userRoleMap = new Map();
    users.forEach((u) => userRoleMap.set(u.id, u.role));

    const enrichedPaginated = paginated.map((item) => ({
      ...item,
      employeeRole: userRoleMap.get(item.employeeId) || 'Staff',
    }));

    return res.json({ items: enrichedPaginated, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('listDutyRosters error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getDutyRosterDetail(req, res) {
  try {
    const { id } = req.params;
    const duty = await prisma.dutyRoster.findUnique({ where: { id } });
    if (!duty) return res.status(404).json({ message: 'Duty not found' });

    // Parse JSON fields for the frontend
    let patients = [];
    let beds = [];
    try { patients = JSON.parse(duty.assignedPatientIds || '[]'); } catch { patients = []; }
    try { beds = JSON.parse(duty.bedIds || '[]'); } catch { beds = []; }

    return res.json({ ...duty, patients, beds, liveStatus: computeStatus(duty) });
  } catch (err) {
    console.error('getDutyRosterDetail error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createDutyRoster(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const {
      date, shift, employeeId, employeeName, department,
      dutyType, dutyLocation, startTime, endTime,
      remarks, wardType, assignedPatientIds, bedIds,
      otRoomName, surgeryId, surgeonName, timeSlot,
      recoveryRoomName, patientCount,
    } = req.body;

    if (!date || !shift || !employeeId || !employeeName || !dutyType) {
      return res.status(400).json({ message: 'Date, shift, employee, and duty type are required' });
    }

    const manualPatientIds = Array.isArray(assignedPatientIds) ? assignedPatientIds : [];
    if (manualPatientIds.length > 0) {
      return res.status(400).json({
        message: 'Patient nurse assignments must be done via HR Allocation Requests, not duty roster.',
      });
    }

    // Conflict check
    const overlap = await checkOverlap(employeeId, date, shift, startTime, endTime);
    if (overlap.conflict) {
      return res.status(409).json({ message: overlap.message, conflict: overlap.existingDuty });
    }

    // Workload check
    const pc = Math.max(0, parseInt(patientCount, 10) || 0);
    const wlCheck = await checkWorkloadLimit(dutyType, wardType, employeeId, date, shift, pc);
    if (!wlCheck.allowed) {
      return res.status(409).json({ message: wlCheck.message });
    }

    // Get creator name
    const creator = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const duty = await prisma.dutyRoster.create({
      data: {
        date: toDateOnly(date),
        shift,
        employeeId,
        employeeName,
        department: department || null,
        dutyType,
        dutyLocation: dutyLocation || null,
        startTime: startTime || null,
        endTime: endTime || null,
        remarks: remarks || null,
        wardType: wardType || null,
        assignedPatientIds: null,
        bedIds: bedIds ? JSON.stringify(bedIds) : null,
        otRoomName: otRoomName || null,
        surgeryId: surgeryId || null,
        surgeonName: surgeonName || null,
        timeSlot: timeSlot || null,
        recoveryRoomName: recoveryRoomName || null,
        patientCount: pc,
        createdById: userId,
        createdByName: creator?.name || 'Unknown',
      },
    });

    notifyDutyChange('CREATED', duty, userId);

    return res.status(201).json({ ok: true, duty: { ...duty, liveStatus: computeStatus(duty) } });
  } catch (err) {
    console.error('createDutyRoster error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateDutyRoster(req, res) {
  try {
    const { id } = req.params;
    const existing = await prisma.dutyRoster.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Duty not found' });

    const {
      date, shift, employeeId, employeeName, department,
      dutyType, dutyLocation, startTime, endTime,
      remarks, wardType, assignedPatientIds, bedIds,
      otRoomName, surgeryId, surgeonName, timeSlot,
      recoveryRoomName, patientCount,
    } = req.body;

    const finalDate = date ? toDateOnly(date) : existing.date;
    const finalShift = shift || existing.shift;
    const finalEmployeeId = employeeId || existing.employeeId;
    const finalEmployeeName = employeeName || existing.employeeName;
    const finalDutyType = dutyType || existing.dutyType;
    const finalStartTime = startTime !== undefined ? startTime : existing.startTime;
    const finalEndTime = endTime !== undefined ? endTime : existing.endTime;

    const manualPatientIds = Array.isArray(assignedPatientIds) ? assignedPatientIds : [];
    if (assignedPatientIds !== undefined && manualPatientIds.length > 0) {
      return res.status(400).json({
        message: 'Patient nurse assignments must be done via HR Allocation Requests, not duty roster.',
      });
    }

    // Conflict check (exclude self)
    const overlap = await checkOverlap(finalEmployeeId, finalDate, finalShift, finalStartTime, finalEndTime, id);
    if (overlap.conflict) {
      return res.status(409).json({ message: overlap.message, conflict: overlap.existingDuty });
    }

    // Workload check
    const pc = patientCount !== undefined ? Math.max(0, parseInt(patientCount, 10) || 0) : existing.patientCount;
    const finalWardType = wardType !== undefined ? wardType : existing.wardType;
    const wlCheck = await checkWorkloadLimit(finalDutyType, finalWardType, finalEmployeeId, finalDate, finalShift, pc, id);
    if (!wlCheck.allowed) {
      return res.status(409).json({ message: wlCheck.message });
    }

    const data = {};
    if (date !== undefined) data.date = finalDate;
    if (shift !== undefined) data.shift = finalShift;
    if (employeeId !== undefined) data.employeeId = employeeId;
    if (employeeName !== undefined) data.employeeName = employeeName;
    if (department !== undefined) data.department = department;
    if (dutyType !== undefined) data.dutyType = dutyType;
    if (dutyLocation !== undefined) data.dutyLocation = dutyLocation;
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;
    if (remarks !== undefined) data.remarks = remarks;
    if (wardType !== undefined) data.wardType = wardType;
    if (assignedPatientIds !== undefined) {
      // Patient lists on duty roster are synced from HR allocation only — never set manually via API.
    }
    if (bedIds !== undefined) data.bedIds = JSON.stringify(bedIds);
    if (otRoomName !== undefined) data.otRoomName = otRoomName;
    if (surgeryId !== undefined) data.surgeryId = surgeryId;
    if (surgeonName !== undefined) data.surgeonName = surgeonName;
    if (timeSlot !== undefined) data.timeSlot = timeSlot;
    if (recoveryRoomName !== undefined) data.recoveryRoomName = recoveryRoomName;
    if (patientCount !== undefined) data.patientCount = pc;

    const duty = await prisma.dutyRoster.update({ where: { id }, data });
    notifyDutyChange('UPDATED', duty, req.user?.userId);
    return res.json({ ok: true, duty: { ...duty, liveStatus: computeStatus(duty) } });
  } catch (err) {
    console.error('updateDutyRoster error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteDutyRoster(req, res) {
  try {
    const { id } = req.params;

    if (id.startsWith('nduty_')) {
      const actualId = id.substring(6);
      const existing = await prisma.nurseDuty.findUnique({ where: { id: actualId } });
      if (!existing) return res.status(404).json({ message: 'Duty not found' });

      await prisma.nurseDuty.delete({ where: { id: actualId } });
      return res.json({ ok: true });
    }

    if (id.startsWith('alloc_')) {
      const actualId = id.substring(6);
      const existing = await prisma.allocationRequest.findUnique({ where: { id: actualId } });
      if (!existing) return res.status(404).json({ message: 'Duty not found' });

      await prisma.allocationRequest.update({
        where: { id: actualId },
        data: {
          status: 'PENDING',
          assignedToId: null,
          assignedToName: null,
          assignedById: null,
          assignedByName: null,
          assignedAt: null,
        },
      });
      return res.json({ ok: true });
    }

    // Standard DutyRoster
    const existing = await prisma.dutyRoster.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Duty not found' });

    await prisma.dutyRoster.delete({ where: { id } });
    notifyDutyChange('DELETED', existing, req.user?.userId);
    return res.json({ ok: true });
  } catch (err) {
    if (err && err.code === 'P2025') return res.status(404).json({ message: 'Duty not found' });
    console.error('deleteDutyRoster error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Statistics / Dashboard ───

async function getDutyStats(req, res) {
  try {
    await updateStatuses();
    const today = toDateOnly();

    // Fetch DutyRoster for today
    const dutyRosterItems = await prisma.dutyRoster.findMany({
      where: { date: today }
    });

    // Fetch AllocationRequest for today
    const allocationItems = await prisma.allocationRequest.findMany({
      where: {
        status: 'APPROVED',
        assignedToId: { not: null },
      }
    });
    const todayAllocations = allocationItems.filter(a => {
      if (!a.assignedAt) return false;
      return toDateOnly(a.assignedAt).getTime() === today.getTime();
    });

    // Fetch NurseDuty for today
    const nurseDutyItems = await prisma.nurseDuty.findMany({
      where: { dutyDate: today }
    });

    const moduleToDutyType = { IPD: 'WARD', OT: 'OT', RECOVERY: 'RECOVERY', WARD_TRANSFER: 'RECOVERY' };

    const mappedDuties = [
      ...dutyRosterItems.map(d => ({
        shift: d.shift,
        dutyType: d.dutyType,
        status: computeStatus(d)
      })),
      ...todayAllocations.map(a => {
        const item = {
          date: a.assignedAt || a.createdAt,
          shift: a.assignedShift || a.requiredShift || '',
          startTime: null,
          endTime: null,
        };
        return {
          shift: item.shift,
          dutyType: moduleToDutyType[a.sourceModule] || 'WARD',
          status: computeStatus(item)
        };
      }),
      ...nurseDutyItems.map(n => {
        const item = {
          date: n.dutyDate,
          shift: n.shift,
          startTime: null,
          endTime: null,
        };
        return {
          shift: item.shift,
          dutyType: 'WARD',
          status: computeStatus(item)
        };
      })
    ];

    let onDuty = 0;
    let upcoming = 0;
    let completed = 0;
    const typeMap = {};
    const shiftMap = {};

    for (const d of mappedDuties) {
      if (d.status === 'ON_DUTY') onDuty++;
      else if (d.status === 'UPCOMING') upcoming++;
      else if (d.status === 'COMPLETED') completed++;

      if (d.dutyType) {
        typeMap[d.dutyType] = (typeMap[d.dutyType] || 0) + 1;
      }
      if (d.shift) {
        shiftMap[d.shift] = (shiftMap[d.shift] || 0) + 1;
      }
    }

    return res.json({
      totalToday: mappedDuties.length,
      onDuty,
      upcoming,
      completed,
      byType: typeMap,
      byShift: shiftMap,
    });
  } catch (err) {
    console.error('getDutyStats error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// ─── Helpers for merging allocation/nurseDuty into nurse's view ───

const MODULE_TO_DUTY_TYPE = { IPD: 'WARD', OT: 'OT', RECOVERY: 'RECOVERY', WARD_TRANSFER: 'RECOVERY' };

function allocToDutyItem(a) {
  const item = {
    id: `alloc_${a.id}`,
    date: a.assignedAt || a.createdAt,
    shift: a.assignedShift || a.requiredShift || '',
    employeeId: a.assignedToId || '',
    employeeName: a.assignedToName || '',
    department: a.department || '',
    dutyType: MODULE_TO_DUTY_TYPE[a.sourceModule] || 'WARD',
    dutyLocation: `${a.patientName} (${a.uhid})`,
    startTime: null,
    endTime: null,
    status: 'ON_DUTY',
    remarks: `Patient: ${a.patientName} (${a.uhid})`,
    wardType: null,
    assignedPatientIds: JSON.stringify([a.patientId]),
    bedIds: null,
    otRoomName: null,
    surgeryId: null,
    surgeonName: null,
    timeSlot: null,
    recoveryRoomName: a.sourceModule === 'RECOVERY' || a.sourceModule === 'WARD_TRANSFER' ? a.uhid : null,
    patientCount: 1,
    createdById: a.assignedById || '',
    createdByName: a.assignedByName || '',
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    patients: [a.patientId],
    beds: [],
    _source: 'allocation',
  };
  const live = computeStatus(item);
  item.status = live;
  item.liveStatus = live;
  return item;
}

function ndutyToDutyItem(n) {
  const item = {
    id: `nduty_${n.id}`,
    date: n.dutyDate,
    shift: n.shift,
    employeeId: n.nurseId,
    employeeName: n.nurseName,
    department: 'Nursing',
    dutyType: 'WARD',
    dutyLocation: n.wardName,
    startTime: null,
    endTime: null,
    status: 'ON_DUTY',
    remarks: `Ward: ${n.wardName}`,
    wardType: null,
    assignedPatientIds: null,
    bedIds: null,
    otRoomName: null,
    surgeryId: null,
    surgeonName: null,
    timeSlot: null,
    recoveryRoomName: null,
    patientCount: 0,
    createdById: '',
    createdByName: '',
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    patients: [],
    beds: [],
    _source: 'nurseDuty',
  };
  const live = computeStatus(item);
  item.status = live;
  item.liveStatus = live;
  return item;
}

function shiftAssignmentToDutyItem(a) {
  const s = a.shift;
  const date = a.assignedDate;
  const status = computeShiftStatus(s, date);
  const dutyStatus = status === 'RUNNING' ? 'ON_DUTY' : status === 'COMPLETED' ? 'COMPLETED' : 'UPCOMING';
  return {
    id: `shift_${a.id}`,
    date,
    shift: legacyShiftEnum(s),
    employeeId: a.employeeId,
    employeeName: a.employee?.name || '',
    dutyType: 'WARD',
    dutyLocation: s?.name || 'Shift',
    startTime: s?.startTime || null,
    endTime: s?.endTime || null,
    status: dutyStatus,
    liveStatus: dutyStatus,
    patients: [],
    beds: [],
    _source: 'shiftAssignment',
    shiftName: s?.name,
    shiftStatus: status,
  };
}

function enrichDutyRosterItem(d) {
  return {
    ...d,
    liveStatus: computeStatus(d),
    patients: tryParseJson(d.assignedPatientIds, []),
    beds: tryParseJson(d.bedIds, []),
    _source: 'dutyRoster',
  };
}

function sameDay(a, b) {
  if (!a || !b) return false;
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function isAllocOnDate(a, dateObj) {
  if (!a.assignedAt) return false;
  return sameDay(a.assignedAt, dateObj);
}

function isNdutyOnDate(n, dateObj) {
  return sameDay(n.dutyDate, dateObj);
}

// ─── Nurse Dashboard (view only) ───

async function getMyDuties(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    await updateStatuses();

    const today = toDateOnly();
    const { date, status } = req.query;

    // DutyRoster filter
    const drWhere = { employeeId: userId };
    if (date) drWhere.date = toDateOnly(date);
    else drWhere.date = { gte: today };
    if (status) drWhere.status = status;

    // Allocation filter
    const allocWhere = {
      status: 'APPROVED',
      assignedToId: userId,
    };

    // NurseDuty filter
    const ndWhere = { nurseId: userId };
    if (date) {
      ndWhere.dutyDate = toDateOnly(date);
    }

    const [dutyRosterItems, allocationItems, nurseDutyItems, shiftAssignments] = await Promise.all([
      prisma.dutyRoster.findMany({ where: drWhere, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] }),
      prisma.allocationRequest.findMany({ where: allocWhere, orderBy: { createdAt: 'desc' } }),
      prisma.nurseDuty.findMany({ where: ndWhere, orderBy: { dutyDate: 'desc' } }),
      prisma.shiftAssignment.findMany({
        where: {
          employeeId: userId,
          assignedDate: date
            ? { gte: toDateOnly(date), lt: new Date(toDateOnly(date).getTime() + 86400000) }
            : { gte: today },
        },
        include: { shift: true, employee: { select: { name: true } } },
      }),
    ]);

    const dateObj = date ? toDateOnly(date) : null;

    const allocAsDuties = allocationItems
      .filter((a) => {
        if (dateObj) return isAllocOnDate(a, dateObj);
        if (a.assignedAt && a.assignedAt < today) return false;
        return true;
      })
      .map(allocToDutyItem);

    const ndAsDuties = nurseDutyItems
      .filter((n) => {
        if (dateObj) return isNdutyOnDate(n, dateObj);
        if (n.dutyDate < today) return false;
        return true;
      })
      .map(ndutyToDutyItem);

    const shiftAsDuties = shiftAssignments.map(shiftAssignmentToDutyItem);

    const enriched = [
      ...dutyRosterItems.map(enrichDutyRosterItem),
      ...allocAsDuties,
      ...ndAsDuties,
      ...shiftAsDuties,
    ];

    // Remove duplicates (same shift + dutyType from different sources)
    const seen = new Set();
    const deduped = [];
    for (const item of enriched) {
      const key = `${item.shift}|${item.dutyType}|${item.dutyLocation}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }

    deduped.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (da !== db) return da - db;
      return (a.startTime || '') < (b.startTime || '') ? -1 : 1;
    });

    return res.json({ items: deduped });
  } catch (err) {
    console.error('getMyDuties error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getTodayDuty(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    await updateStatuses();

    const today = toDateOnly();

    const [dutyRosterItems, allocationItems, nurseDutyItems] = await Promise.all([
      prisma.dutyRoster.findMany({
        where: { employeeId: userId, date: today },
        orderBy: { startTime: 'asc' },
      }),
      prisma.allocationRequest.findMany({
        where: { status: 'APPROVED', assignedToId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.nurseDuty.findMany({
        where: { nurseId: userId, dutyDate: today },
        orderBy: { dutyDate: 'desc' },
      }),
    ]);

    const allocAsDuties = allocationItems
      .filter((a) => isAllocOnDate(a, today))
      .map(allocToDutyItem);

    const ndAsDuties = nurseDutyItems
      .filter((n) => isNdutyOnDate(n, today))
      .map(ndutyToDutyItem);

    const enriched = [
      ...dutyRosterItems.map(enrichDutyRosterItem),
      ...allocAsDuties,
      ...ndAsDuties,
    ];

    // Deduplicate
    const seen = new Set();
    const deduped = [];
    for (const item of enriched) {
      const key = `${item.shift}|${item.dutyType}|${item.dutyLocation}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }

    deduped.sort((a, b) => {
      return (a.startTime || '') < (b.startTime || '') ? -1 : 1;
    });

    return res.json({ items: deduped });
  } catch (err) {
    console.error('getTodayDuty error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

function tryParseJson(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = {
  listDutyRosters,
  getDutyRosterDetail,
  createDutyRoster,
  updateDutyRoster,
  deleteDutyRoster,
  getDutyStats,
  getMyDuties,
  getTodayDuty,
};
