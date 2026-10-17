function parseMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function toRanges(startM, endM) {
  if (endM > startM) return [[startM, endM]];
  return [[startM, 1440], [0, endM]];
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const aRanges = toRanges(aStart, aEnd);
  const bRanges = toRanges(bStart, bEnd);
  for (const [s1, e1] of aRanges) {
    for (const [s2, e2] of bRanges) {
      if (s1 < e2 && s2 < e1) return true;
    }
  }
  return false;
}

function shiftsTimeOverlap(shiftA, shiftB) {
  if (!shiftA || !shiftB) return false;
  return rangesOverlap(
    parseMinutes(shiftA.startTime),
    parseMinutes(shiftA.endTime),
    parseMinutes(shiftB.startTime),
    parseMinutes(shiftB.endTime),
  );
}

function computeShiftStatus(shift, referenceDate = new Date(), now = new Date()) {
  if (!shift?.isActive) return 'INACTIVE';

  const startTimeStr = shift.startTime;
  const endTimeStr = shift.endTime;

  if (!startTimeStr || !endTimeStr) return 'UPCOMING';

  const ref = new Date(referenceDate);
  const baseDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());

  const [sh, sm] = startTimeStr.split(':').map(Number);
  const [eh, em] = endTimeStr.split(':').map(Number);

  const startDate = new Date(baseDate.getTime());
  startDate.setHours(sh, sm, 0, 0);

  const endDate = new Date(baseDate.getTime());
  if (eh < sh || (eh === sh && em <= sm)) {
    // Spans midnight
    endDate.setDate(endDate.getDate() + 1);
  }
  endDate.setHours(eh, em, 0, 0);

  if (now < startDate) {
    return 'UPCOMING';
  } else if (now >= startDate && now < endDate) {
    return 'RUNNING';
  } else {
    return 'COMPLETED';
  }
}

function legacyShiftEnum(shift) {
  const n = String(shift?.name || '').toLowerCase();
  if (n.includes('morning')) return 'MORNING';
  if (n.includes('evening')) return 'EVENING';
  if (n.includes('night')) return 'NIGHT';
  const startM = parseMinutes(shift?.startTime);
  if (startM >= 360 && startM < 840) return 'MORNING';
  if (startM >= 840 && startM < 1320) return 'EVENING';
  return 'NIGHT';
}

function todayStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function formatShiftLabel(shift) {
  if (!shift) return '—';
  return `${shift.name} (${shift.startTime}–${shift.endTime})`;
}

/**
 * Check if user has an active shift of a given type right now.
 * shiftType is matched against shift name (case-insensitive) first,
 * then by start-time range: MORNING (06:00-14:00), EVENING (14:00-22:00), NIGHT (22:00-06:00).
 */
async function isUserOnShiftType(userId, shiftType) {
  if (!userId || !shiftType) return false;
  const { prisma } = require('../config/prisma');
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const assignments = await prisma.shiftAssignment.findMany({
    where: { employeeId: userId },
    include: { shift: true },
  });

  const target = shiftType.toUpperCase();

  return assignments.some((a) => {
    if (!a.shift?.isActive) return false;
    const name = String(a.shift.name || '').toLowerCase();
    if (name.includes(target.toLowerCase())) return true;

    const startM = parseMinutes(a.shift.startTime);
    const endM = parseMinutes(a.shift.endTime);

    // Check by time range
    if (endM > startM) {
      if (!(currentMinutes >= startM && currentMinutes < endM)) return false;
    } else {
      if (!(currentMinutes >= startM || currentMinutes < endM)) return false;
    }

    // Map start time to shift type
    if (target === 'MORNING') return startM >= 360 && startM < 840;
    if (target === 'EVENING') return startM >= 840 && startM < 1320;
    if (target === 'NIGHT') return startM >= 1320 || startM < 360;
    return false;
  });
}

/**
 * Shorthand: check if user is currently on a night shift.
 */
async function isUserOnNightShift(userId) {
  return isUserOnShiftType(userId, 'NIGHT');
}

/**
 * Shorthand: check if user is currently on an evening shift.
 */
async function isUserOnEveningShift(userId) {
  return isUserOnShiftType(userId, 'EVENING');
}

/**
 * Can this user directly assign a nurse during IPD admit?
 * SUPER_ADMIN always yes. Night- or evening-shift RECEPTIONIST yes.
 * Dev env flag: ALLOW_RECEPTION_NURSE_ASSIGN=1 bypasses all checks.
 *
 * Detection logic:
 * 1. Shift name contains "evening" or "night" (case-insensitive)
 * 2. Shift's time range overlaps with evening block (14:00-22:00) or night block (22:00-06:00)
 */
async function canUserAssignNurse(userId, userRole) {
  if (!userId) return false;
  if (userRole === 'SUPER_ADMIN') return true;
  if (String(process.env.ALLOW_RECEPTION_NURSE_ASSIGN || '') === '1') return true;
  if (userRole !== 'RECEPTIONIST') return false;

  const activeShift = await getUserCurrentShiftType(userId);
  if (activeShift === 'EVENING' || activeShift === 'NIGHT') return true;

  const { prisma } = require('../config/prisma');

  const assignments = await prisma.shiftAssignment.findMany({
    where: { employeeId: userId },
    include: { shift: true },
  });

  const hasEveningOrNightRoster = assignments.some((a) => {
    if (!a.shift?.isActive) return false;
    const name = String(a.shift.name || '').toLowerCase();
    if (name.includes('night') || name.includes('evening')) return true;

    const startM = parseMinutes(a.shift.startTime);
    const endM = parseMinutes(a.shift.endTime);

    if (rangesOverlap(startM, endM, 1320, 1440) || rangesOverlap(startM, endM, 0, 360)) return true;
    if (rangesOverlap(startM, endM, 840, 1320)) return true;

    return false;
  });

  if (hasEveningOrNightRoster) return true;

  // No HR shift row — allow during evening/night wall-clock (e.g. demo receptionist)
  if (!assignments.length) {
    const m = new Date().getHours() * 60 + new Date().getMinutes();
    if (m >= 840 && m < 1320) return true;
    if (m >= 1320 || m < 360) return true;
  }

  return false;
}

/**
 * Returns the current shift type the user is actively on:
 * 'NIGHT', 'EVENING', 'MORNING', or null.
 *
 * Uses name match first, then checks which time block the shift overlaps with.
 * For shifts that cover multiple blocks, priority: MORNING < EVENING < NIGHT.
 */
async function getUserCurrentShiftType(userId) {
  if (!userId) return null;
  const { prisma } = require('../config/prisma');
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const assignments = await prisma.shiftAssignment.findMany({
    where: { employeeId: userId },
    include: { shift: true },
  });

  for (const a of assignments) {
    if (!a.shift?.isActive) continue;
    const name = String(a.shift.name || '').toLowerCase();
    if (name.includes('night')) return 'NIGHT';
    if (name.includes('evening')) return 'EVENING';
    if (name.includes('morning')) return 'MORNING';

    const startM = parseMinutes(a.shift.startTime);
    const endM = parseMinutes(a.shift.endTime);

    // Check if currently running
    let running;
    if (endM > startM) {
      running = currentMinutes >= startM && currentMinutes < endM;
    } else {
      running = currentMinutes >= startM || currentMinutes < endM;
    }
    if (!running) continue;

    // Check time-block overlap — pick the most specific block
    if (rangesOverlap(startM, endM, 1320, 1440) || rangesOverlap(startM, endM, 0, 360)) return 'NIGHT';
    if (rangesOverlap(startM, endM, 840, 1320)) return 'EVENING';
    if (rangesOverlap(startM, endM, 360, 840)) return 'MORNING';
  }
  return null;
}

module.exports = {
  parseMinutes,
  shiftsTimeOverlap,
  computeShiftStatus,
  legacyShiftEnum,
  todayStart,
  formatShiftLabel,
  isUserOnNightShift,
  isUserOnEveningShift,
  isUserOnShiftType,
  getUserCurrentShiftType,
  canUserAssignNurse,
};
