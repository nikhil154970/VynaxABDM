const { prisma } = require('../../config/prisma');
const {
  computeShiftStatus,
  shiftsTimeOverlap,
  legacyShiftEnum,
  todayStart,
} = require('../../lib/shiftHelpers');

async function listShifts(req, res) {
  try {
    const today = todayStart();

    // Fetch today's duties to get live shift counts
    const todayDuties = await prisma.dutyRoster.findMany({
      where: { date: today },
      select: { employeeId: true, shift: true },
    });

    const shifts = await prisma.shift.findMany({
      orderBy: { startTime: 'asc' },
    });

    const result = shifts.map((s) => {
      const shiftEnum = legacyShiftEnum(s);
      const uniqueEmpsForShift = [...new Set(
        todayDuties
          .filter((d) => d.shift === shiftEnum)
          .map((d) => d.employeeId)
      )];
      return {
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        status: computeShiftStatus(s),
        employeeCount: uniqueEmpsForShift.length,
      };
    });

    return res.json({ items: result });
  } catch (err) {
    console.error('listShifts error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createShift(req, res) {
  try {
    const { name, startTime, endTime } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ message: 'Name, start time, and end time are required' });
    }

    const activeShifts = await prisma.shift.findMany({ where: { isActive: true } });
    const candidate = { startTime: String(startTime).trim(), endTime: String(endTime).trim() };
    const overlap = activeShifts.find((s) => shiftsTimeOverlap(s, candidate));
    if (overlap) {
      return res.status(409).json({
        message: `Time overlaps with active shift "${overlap.name}" (${overlap.startTime}–${overlap.endTime})`,
      });
    }

    const shift = await prisma.shift.create({
      data: { name: String(name).trim(), startTime: candidate.startTime, endTime: candidate.endTime },
    });
    return res.status(201).json({ ok: true, shift: { ...shift, status: computeShiftStatus(shift) } });
  } catch (err) {
    console.error('createShift error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateShift(req, res) {
  try {
    const { id } = req.params;
    const { name, startTime, endTime, isActive } = req.body;

    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Shift not found' });

    const next = {
      startTime: startTime !== undefined ? String(startTime).trim() : existing.startTime,
      endTime: endTime !== undefined ? String(endTime).trim() : existing.endTime,
    };
    const activeShifts = await prisma.shift.findMany({
      where: { isActive: true, id: { not: id } },
    });
    const overlap = activeShifts.find((s) => shiftsTimeOverlap(s, next));
    if (overlap && isActive !== false) {
      return res.status(409).json({
        message: `Time overlaps with active shift "${overlap.name}"`,
      });
    }

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (startTime !== undefined) data.startTime = next.startTime;
    if (endTime !== undefined) data.endTime = next.endTime;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const shift = await prisma.shift.update({ where: { id }, data });
    return res.json({ ok: true, shift: { ...shift, status: computeShiftStatus(shift) } });
  } catch (err) {
    console.error('updateShift error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function toggleShift(req, res) {
  try {
    const { id } = req.params;
    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Shift not found' });

    const shift = await prisma.shift.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    return res.json({ ok: true, shift: { ...shift, status: computeShiftStatus(shift) } });
  } catch (err) {
    console.error('toggleShift error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getShiftEmployees(req, res) {
  try {
    const { id } = req.params;
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) return res.status(404).json({ message: 'Shift not found' });

    const today = todayStart();
    const shiftEnum = legacyShiftEnum(shift);

    const assignments = await prisma.shiftAssignment.findMany({
      where: { shiftId: id },
      include: {
        employee: { select: { id: true, name: true, email: true, role: true, department: true, isActive: true } },
        assignedBy: { select: { id: true, name: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const dutyRosters = await prisma.dutyRoster.findMany({
      where: { date: today, shift: shiftEnum },
      select: { id: true, employeeId: true, employeeName: true, dutyType: true, dutyLocation: true, wardType: true, status: true },
    });

    const assignedEmpIds = new Set(assignments.map((a) => a.employeeId));
    const employeeIds = assignments.map((a) => a.employeeId);

    const activeAllocations = employeeIds.length
      ? await prisma.allocationRequest.findMany({
        where: { assignedToId: { in: employeeIds }, status: { in: ['APPROVED', 'PENDING'] } },
        select: { assignedToId: true, sourceModule: true },
      })
      : [];

    const workloadMap = {};
    for (const al of activeAllocations) {
      if (!workloadMap[al.assignedToId]) workloadMap[al.assignedToId] = { patients: 0, ot: 0 };
      if (al.sourceModule === 'OT') workloadMap[al.assignedToId].ot++;
      else workloadMap[al.assignedToId].patients++;
    }

    const dutyMap = {};
    for (const d of dutyRosters) {
      if (assignedEmpIds.has(d.employeeId)) {
        dutyMap[d.employeeId] = d;
      }
    }

    const employees = assignments.map((a) => ({
      ...a,
      workload: workloadMap[a.employeeId] || { patients: 0, ot: 0 },
      duty: dutyMap[a.employeeId] || null,
      shiftStatus: computeShiftStatus(shift),
      source: 'ASSIGNMENT',
    }));

    // Add dynamic duties from DutyRoster that aren't in ShiftAssignment
    const dynamicDuties = dutyRosters.filter((d) => !assignedEmpIds.has(d.employeeId));
    if (dynamicDuties.length > 0) {
      const dynamicEmpIds = dynamicDuties.map((d) => d.employeeId);
      const dynamicUsers = await prisma.user.findMany({
        where: { id: { in: dynamicEmpIds } },
        select: { id: true, name: true, email: true, role: true, department: true, isActive: true },
      });
      const userMap = {};
      for (const u of dynamicUsers) {
        userMap[u.id] = u;
      }

      const dynamicAllocations = await prisma.allocationRequest.findMany({
        where: { assignedToId: { in: dynamicEmpIds }, status: { in: ['APPROVED', 'PENDING'] } },
        select: { assignedToId: true, sourceModule: true },
      });
      const dynamicWorkloadMap = {};
      for (const al of dynamicAllocations) {
        if (!dynamicWorkloadMap[al.assignedToId]) dynamicWorkloadMap[al.assignedToId] = { patients: 0, ot: 0 };
        if (al.sourceModule === 'OT') dynamicWorkloadMap[al.assignedToId].ot++;
        else dynamicWorkloadMap[al.assignedToId].patients++;
      }

      for (const d of dynamicDuties) {
        const user = userMap[d.employeeId] || { id: d.employeeId, name: d.employeeName, role: 'Staff' };
        employees.push({
          id: `ROSTER_${d.id}`,
          shiftId: id,
          employeeId: d.employeeId,
          employee: user,
          workload: dynamicWorkloadMap[d.employeeId] || { patients: 0, ot: 0 },
          duty: d,
          shiftStatus: computeShiftStatus(shift),
          source: 'ROSTER',
        });
      }
    }

    return res.json({ shift: { ...shift, status: computeShiftStatus(shift) }, employees });
  } catch (err) {
    console.error('getShiftEmployees error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createDutyForAssignment(tx, {
  shift,
  employee,
  userId,
  wardType,
  dutyLocation,
  department,
  startTime,
  endTime,
}) {
  const today = todayStart();
  const creator = await tx.user.findUnique({ where: { id: userId }, select: { name: true } });

  let resolvedDutyType = 'EMERGENCY';
  let resolvedLocation = dutyLocation || employee.department || employee.role || 'Hospital';

  const roleUpper = String(employee.role || '').toUpperCase();
  if (roleUpper === 'RECEPTIONIST') {
    resolvedLocation = dutyLocation || 'Reception';
  } else if (roleUpper === 'PHARMACIST') {
    resolvedLocation = dutyLocation || 'Pharmacy';
  } else if (roleUpper === 'LAB_TECHNICIAN') {
    resolvedLocation = dutyLocation || 'Laboratory';
  } else if (roleUpper === 'OT_TECHNICIAN') {
    resolvedDutyType = 'OT';
    resolvedLocation = dutyLocation || 'Operation Theatre';
  } else if (wardType) {
    resolvedDutyType = 'WARD';
    const wardLabels = { GENERAL: 'General Ward', ICU: 'ICU', PRIVATE: 'Private Ward' };
    resolvedLocation = dutyLocation || wardLabels[wardType] || wardType;
  }

  return tx.dutyRoster.create({
    data: {
      date: today,
      shift: legacyShiftEnum(shift),
      employeeId: employee.id,
      employeeName: employee.name,
      department: department || employee.department || null,
      dutyType: resolvedDutyType,
      wardType: wardType || null,
      dutyLocation: resolvedLocation,
      startTime: startTime || shift.startTime,
      endTime: endTime || shift.endTime,
      status: 'UPCOMING',
      createdById: userId,
      createdByName: creator?.name || 'HR',
    },
  });
}

async function assignEmployeeToShift(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { shiftId, employeeId, reason, wardType, dutyLocation, department, startTime, endTime } = req.body;
    if (!shiftId || !employeeId) {
      return res.status(400).json({ message: 'Shift ID and Employee ID are required' });
    }

    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    if (!shift.isActive) return res.status(400).json({ message: 'Cannot assign to an inactive shift' });

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, role: true, department: true, isActive: true },
    });
    if (!employee || !employee.isActive) {
      return res.status(404).json({ message: 'Employee not found or inactive' });
    }
    if (employee.role === 'DOCTOR' || employee.role === 'NURSE') {
      return res.status(400).json({ message: 'Doctors and Nurses cannot be assigned to shifts here. Use staff allocation for clinical roles.' });
    }

    const validWard = ['GENERAL', 'ICU', 'PRIVATE'];
    const resolvedWard = wardType && validWard.includes(String(wardType).toUpperCase())
      ? String(wardType).toUpperCase()
      : null;

    const existingAssignments = await prisma.shiftAssignment.findMany({
      where: { employeeId },
      include: { shift: true },
    });

    // Employee can only have one active assignment. If they already have one, remove it first.
    for (const existing of existingAssignments) {
      if (existing.shiftId === shiftId) {
        return res.status(409).json({ message: 'Employee is already assigned to this shift' });
      }
      // Remove old assignment for a different shift (cleanup history first to satisfy foreign key constraints)
      await prisma.shiftHistory.deleteMany({ where: { assignmentId: existing.id } });
      await prisma.shiftAssignment.delete({ where: { id: existing.id } });
    }

    const result = await prisma.$transaction(async (tx) => {
      const as = await tx.shiftAssignment.create({
        data: { shiftId, employeeId, assignedById: userId },
      });
      await tx.shiftHistory.create({
        data: {
          assignmentId: as.id,
          action: 'CREATED',
          changedById: userId,
          reason: reason || null,
        },
      });
      const duty = await createDutyForAssignment(tx, {
        shift,
        employee,
        userId,
        wardType: resolvedWard,
        dutyLocation,
        department,
        startTime,
        endTime,
      });
      return { assignment: as, duty };
    });

    const wardLabels = { GENERAL: 'General', ICU: 'ICU', PRIVATE: 'Private' };
    try {
      await prisma.notification.create({
        data: {
          userId: employeeId,
          type: 'ALERT',
          severity: 'INFO',
          title: 'Shift Assigned',
          message: `You are assigned to ${shift.name} (${shift.startTime}–${shift.endTime}). Ward: ${wardLabels[resolvedWard] || resolvedWard}.`,
        },
      });
    } catch { /* best-effort */ }

    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error('assignEmployeeToShift error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function removeShiftAssignment(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;

    if (id.startsWith('ROSTER_')) {
      const dutyId = id.substring(7);
      const existing = await prisma.dutyRoster.findUnique({ where: { id: dutyId } });
      if (!existing) return res.status(404).json({ message: 'Duty not found' });
      await prisma.dutyRoster.delete({ where: { id: dutyId } });
      return res.json({ ok: true });
    }

    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: { shift: true, employee: { select: { id: true, name: true } } },
    });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    await prisma.$transaction(async (tx) => {
      // Cleanup history first to satisfy foreign key constraints
      await tx.shiftHistory.deleteMany({ where: { assignmentId: id } });
      await tx.shiftAssignment.delete({ where: { id } });
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('removeShiftAssignment error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function changeEmployeeShift(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const { newShiftId, reason } = req.body;
    if (!newShiftId) return res.status(400).json({ message: 'New shift ID is required' });

    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: { shift: true },
    });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const newShift = await prisma.shift.findUnique({ where: { id: newShiftId } });
    if (!newShift) return res.status(404).json({ message: 'New shift not found' });
    if (!newShift.isActive) return res.status(400).json({ message: 'Target shift is inactive' });

    const today = todayStart();
    const others = await prisma.shiftAssignment.findMany({
      where: {
        employeeId: assignment.employeeId,
        assignedDate: { gte: today },
        id: { not: id },
      },
      include: { shift: true },
    });
    const conflict = others.find((a) => a.shift?.isActive && shiftsTimeOverlap(a.shift, newShift));
    if (conflict) {
      return res.status(409).json({
        message: `Overlaps with existing shift "${conflict.shift.name}"`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.shiftHistory.create({
        data: {
          assignmentId: id,
          action: 'CHANGED',
          previousShiftId: assignment.shiftId,
          newShiftId,
          changedById: userId,
          reason: reason || null,
        },
      });
      await tx.shiftAssignment.update({
        where: { id },
        data: { shiftId: newShiftId },
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('changeEmployeeShift error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getShiftStats(req, res) {
  try {
    const today = todayStart();

    // Fetch today's duties to get live daily shift stats
    const todayDuties = await prisma.dutyRoster.findMany({
      where: { date: today },
    });

    // We also fetch the employees to filter by non-clinical roles
    const nonClinicalUsers = await prisma.user.findMany({
      where: { role: { in: ['OT_TECHNICIAN', 'LAB_TECHNICIAN', 'RECEPTIONIST', 'PHARMACIST'] }, isActive: true },
      select: { id: true, role: true },
    });
    const nonClinicalIds = new Set(nonClinicalUsers.map((u) => u.id));

    const todayNonClinicalDuties = todayDuties.filter((d) => nonClinicalIds.has(d.employeeId));

    const allShifts = await prisma.shift.findMany({ orderBy: { startTime: 'asc' } });
    const shiftBreakdown = allShifts.map((s) => {
      const shiftEnum = legacyShiftEnum(s);
      const uniqueEmpsForShift = [...new Set(
        todayNonClinicalDuties
          .filter((d) => d.shift === shiftEnum)
          .map((d) => d.employeeId)
      )];
      return {
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive,
        status: computeShiftStatus(s),
        assignedCount: uniqueEmpsForShift.length,
      };
    });

    const uniqueAssignedToday = [...new Set(todayNonClinicalDuties.map((d) => d.employeeId))];
    const allStaff = nonClinicalUsers.length;

    // Busy staff count (e.g. general staff allocated to a patient/department)
    const busyStaff = await prisma.allocationRequest.count({
      where: { assignedToId: { in: uniqueAssignedToday }, status: { in: ['APPROVED', 'PENDING'] } },
    });

    const runningShifts = allShifts.filter((s) => s.isActive && computeShiftStatus(s) === 'RUNNING').length;

    return res.json({
      stats: {
        totalStaffOnDuty: uniqueAssignedToday.length,
        availableStaff: Math.max(0, allStaff - uniqueAssignedToday.length),
        busyStaff,
        runningShifts,
        totalStaff: allStaff,
        shiftBreakdown,
      },
    });
  } catch (err) {
    console.error('getShiftStats error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getAvailableEmployees(req, res) {
  try {
    const { role, search } = req.query;

    const where = { isActive: true };
    if (role) where.role = { in: Array.isArray(role) ? role : [role] };
    else where.role = { in: ['NURSE', 'OT_TECHNICIAN', 'LAB_TECHNICIAN', 'RECEPTIONIST', 'PHARMACIST'] };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, department: true, employeeId: true, isActive: true },
      orderBy: { name: 'asc' },
    });

    const allAssignments = await prisma.shiftAssignment.findMany({
      include: { shift: { select: { id: true, name: true, startTime: true, endTime: true, isActive: true } } },
    });

    const assignmentMap = {};
    for (const a of allAssignments) {
      if (!assignmentMap[a.employeeId]) assignmentMap[a.employeeId] = [];
      assignmentMap[a.employeeId].push({ id: a.id, shift: { ...a.shift, status: computeShiftStatus(a.shift) } });
    }

    const activeAllocations = await prisma.allocationRequest.findMany({
      where: { status: { in: ['APPROVED', 'PENDING'] } },
      select: { assignedToId: true, sourceModule: true },
    });

    const workloadMap = {};
    for (const al of activeAllocations) {
      if (!workloadMap[al.assignedToId]) workloadMap[al.assignedToId] = { patients: 0, ot: 0 };
      if (al.sourceModule === 'OT') workloadMap[al.assignedToId].ot++;
      else workloadMap[al.assignedToId].patients++;
    }

    const result = employees.map((emp) => {
      const empAssignments = assignmentMap[emp.id] || [];
      const hasShift = empAssignments.length > 0;
      const wl = workloadMap[emp.id] || { patients: 0, ot: 0 };
      return {
        ...emp,
        assignments: empAssignments,
        workload: wl,
        availability: !hasShift ? 'Available' : wl.patients + wl.ot > 0 ? 'Busy' : 'On Shift',
      };
    });

    return res.json({ items: result });
  } catch (err) {
    console.error('getAvailableEmployees error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getShiftHistory(req, res) {
  try {
    const { id } = req.params;
    const history = await prisma.shiftHistory.findMany({
      where: { assignment: { shiftId: id } },
      include: {
        changedBy: { select: { id: true, name: true } },
        previousShift: { select: { id: true, name: true, startTime: true, endTime: true } },
        newShift: { select: { id: true, name: true, startTime: true, endTime: true } },
        assignment: { include: { employee: { select: { id: true, name: true, role: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ items: history });
  } catch (err) {
    console.error('getShiftHistory error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  listShifts,
  createShift,
  updateShift,
  toggleShift,
  getShiftEmployees,
  assignEmployeeToShift,
  removeShiftAssignment,
  changeEmployeeShift,
  getShiftStats,
  getAvailableEmployees,
  getShiftHistory,
};
