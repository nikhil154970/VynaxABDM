const { prisma } = require('../../config/prisma');

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

function fmtLabel(d) {
  const dt = new Date(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dt.getDate()} ${months[dt.getMonth()]}`;
}

async function getHrReportsAnalytics(req, res) {
  try {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = req.query.from || firstOfMonth.toISOString().slice(0, 10);
    const to = req.query.to || now.toISOString().slice(0, 10);
    const reportType = (req.query.reportType || 'ALL').toUpperCase();

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    const days = Math.max(1, Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24)));

    const meta = { from: fromDate.toISOString(), to: toDate.toISOString(), days, reportType };

    const [
      workforceRows,
      deptUsers,
      allocSummary,
      allocGroupSource,
      allocGroupPriority,
      allocGroupStatus,
      allocByDayRaw,
      avgApprovalRaw,
      dutySummary,
      dutyByTypeRaw,
      dutyByShiftRaw,
      dutyByDayRaw,
      shiftAssignCount,
      shiftUniqueStaff,
      shiftChanges,
      topStaffRaw,
      recentRejectionsRaw,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { id: true }, where: { role: { not: 'SUPER_ADMIN' } } }),
      prisma.user.findMany({ where: { role: { not: 'SUPER_ADMIN' } }, select: { id: true, department: true, role: true, isActive: true } }),
      prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'TRANSFERRED')::int AS transferred,
          COUNT(*) FILTER (WHERE priority = 'CRITICAL' AND status = 'PENDING')::int AS critical
        FROM "AllocationRequest"
        WHERE "createdAt" >= $1 AND "createdAt" <= $2
      `, fromDate, toDate),
      prisma.$queryRawUnsafe(`
        SELECT "sourceModule" AS source, COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved
        FROM "AllocationRequest"
        WHERE "createdAt" >= $1 AND "createdAt" <= $2
        GROUP BY "sourceModule" ORDER BY count DESC
      `, fromDate, toDate),
      prisma.$queryRawUnsafe(`
        SELECT priority, COUNT(*)::int AS count
        FROM "AllocationRequest"
        WHERE "createdAt" >= $1 AND "createdAt" <= $2
        GROUP BY priority ORDER BY count DESC
      `, fromDate, toDate),
      prisma.$queryRawUnsafe(`
        SELECT status, COUNT(*)::int AS count
        FROM "AllocationRequest"
        WHERE "createdAt" >= $1 AND "createdAt" <= $2
        GROUP BY status ORDER BY count DESC
      `, fromDate, toDate),
      prisma.$queryRawUnsafe(`
        SELECT DATE("createdAt") AS date, COUNT(*)::int AS created,
          COUNT(*) FILTER (WHERE status != 'PENDING')::int AS resolved
        FROM "AllocationRequest"
        WHERE "createdAt" >= $1 AND "createdAt" <= $2
        GROUP BY DATE("createdAt") ORDER BY date
      `, fromDate, toDate),
      prisma.$queryRawUnsafe(`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM ("approvedAt" - "createdAt")) / 3600), 0)::numeric(10,1) AS avg_hours
        FROM "AllocationRequest"
        WHERE "approvedAt" IS NOT NULL AND "createdAt" >= $1 AND "createdAt" <= $2
      `, fromDate, toDate),
      prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'ON_DUTY')::int AS on_duty,
          COUNT(*) FILTER (WHERE status = 'UPCOMING')::int AS upcoming,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'OFF_DUTY')::int AS off_duty
        FROM "DutyRoster"
        WHERE date >= $1::date AND date <= $2::date
      `, from, to),
      prisma.$queryRawUnsafe(`
        SELECT "dutyType", COUNT(*)::int AS count
        FROM "DutyRoster"
        WHERE date >= $1::date AND date <= $2::date
        GROUP BY "dutyType" ORDER BY count DESC
      `, from, to),
      prisma.$queryRawUnsafe(`
        SELECT shift, COUNT(*)::int AS count
        FROM "DutyRoster"
        WHERE date >= $1::date AND date <= $2::date
        GROUP BY shift ORDER BY count DESC
      `, from, to),
      prisma.$queryRawUnsafe(`
        SELECT DATE(date) AS date, COUNT(*)::int AS count
        FROM "DutyRoster"
        WHERE date >= $1::date AND date <= $2::date
        GROUP BY DATE(date) ORDER BY date
      `, from, to),
      prisma.shiftAssignment.count({ where: { assignedDate: { gte: fromDate, lte: toDate } } }),
      prisma.shiftAssignment.findMany({ where: { assignedDate: { gte: fromDate, lte: toDate } }, select: { employeeId: true }, distinct: ['employeeId'] }),
      prisma.shiftHistory.count({ where: { createdAt: { gte: fromDate, lte: toDate }, action: 'CHANGED' } }),
      prisma.$queryRawUnsafe(`
        SELECT a."assignedToId" AS "employeeId", COALESCE(u.name, a."assignedToName") AS name, u.role,
          COUNT(DISTINCT a.id)::int AS "allocationCount",
          COALESCE(dc.duty_count, 0)::int AS "dutyCount"
        FROM "AllocationRequest" a
        LEFT JOIN "User" u ON u.id = a."assignedToId"
        LEFT JOIN (SELECT "employeeId"::text AS eid, COUNT(*)::int AS duty_count FROM "DutyRoster" WHERE date >= $1::date AND date <= $2::date GROUP BY "employeeId") dc ON dc.eid = a."assignedToId"::text
        WHERE a."assignedToId" IS NOT NULL AND a."createdAt" >= $3 AND a."createdAt" <= $4
        GROUP BY a."assignedToId", a."assignedToName", u.name, u.role, dc.duty_count
        ORDER BY "allocationCount" DESC
        LIMIT 10
      `, from, to, fromDate, toDate),
      prisma.$queryRawUnsafe(`
        SELECT "requestNumber", "patientName", "rejectionReason" AS reason, "rejectedAt"
        FROM "AllocationRequest"
        WHERE status = 'REJECTED' AND "rejectedAt" >= $1 AND "rejectedAt" <= $2 AND "rejectionReason" IS NOT NULL
        ORDER BY "rejectedAt" DESC LIMIT 10
      `, fromDate, toDate),
    ]);

    // ─── Build workforce summary ───
    const roleMap = { DOCTOR: 0, NURSE: 0, RECEPTIONIST: 0, OT_TECHNICIAN: 0, LAB_TECHNICIAN: 0, PHARMACIST: 0 };
    for (const r of workforceRows) {
      const key = r.role;
      if (key in roleMap) roleMap[key] = r._count.id;
    }
    const totalStaff = deptUsers.length;
    const activeStaff = deptUsers.filter((u) => u.isActive).length;
    const unassignedDept = deptUsers.filter((u) => !u.department).length;
    const allocatedStaff = await prisma.allocationRequest.count({
      where: { assignedToId: { not: null }, status: { in: ['APPROVED', 'PENDING'] } },
    });
    const availableStaff = deptUsers.filter((u) => u.isActive).length - allocatedStaff;

    const workforce = {
      total: totalStaff, active: activeStaff, inactive: totalStaff - activeStaff,
      doctors: roleMap.DOCTOR, nurses: roleMap.NURSE, receptionists: roleMap.RECEPTIONIST,
      otTechnicians: roleMap.OT_TECHNICIAN, labTechnicians: roleMap.LAB_TECHNICIAN, pharmacists: roleMap.PHARMACIST,
      available: Math.max(0, availableStaff), assigned: allocatedStaff, unassignedDept,
    };

    // ─── Workforce by role ───
    const workforceByRole = workforceRows
      .filter((r) => r.role !== 'SUPER_ADMIN')
      .map((r) => {
        const active = deptUsers.filter((u) => u.role === r.role && u.isActive).length;
        return { role: r.role, count: r._count.id, active };
      });

    // ─── Workforce by department ───
    const deptMap = {};
    for (const u of deptUsers) {
      const d = u.department || 'Unassigned';
      if (!deptMap[d]) deptMap[d] = { total: 0, available: 0, assigned: 0 };
      deptMap[d].total++;
      if (u.isActive) deptMap[d].available++;
    }
    const workforceByDepartment = Object.entries(deptMap).map(([department, v]) => ({
      department, total: v.total, available: v.available, assigned: v.assigned,
    })).sort((a, b) => b.total - a.total);

    // ─── Allocations by source ───
    const allocationsBySource = Array.isArray(allocGroupSource) ? allocGroupSource.map((r) => ({
      source: r.source, count: r.count, pending: r.pending, approved: r.approved,
    })) : [];

    // ─── Allocations by priority ───
    const allocationsByPriority = Array.isArray(allocGroupPriority) ? allocGroupPriority.map((r) => ({
      priority: r.priority, count: r.count,
    })) : [];

    // ─── Allocations by status ───
    const allocationsByStatus = Array.isArray(allocGroupStatus) ? allocGroupStatus.map((r) => ({
      status: r.status, count: r.count,
    })) : [];

    // ─── Allocations by day ───
    const allocationsByDay = Array.isArray(allocByDayRaw) ? allocByDayRaw.map((r) => ({
      date: r.date, label: fmtLabel(r.date), created: r.created, resolved: r.resolved,
    })) : [];

    // ─── Duty by type ───
    const dutyByType = Array.isArray(dutyByTypeRaw) ? dutyByTypeRaw.map((r) => ({
      dutyType: r.dutyType, count: r.count,
    })) : [];

    // ─── Duty by shift ───
    const dutyByShift = Array.isArray(dutyByShiftRaw) ? dutyByShiftRaw.map((r) => ({
      shift: r.shift, count: r.count,
    })) : [];

    // ─── Duty by day ───
    const dutyByDay = Array.isArray(dutyByDayRaw) ? dutyByDayRaw.map((r) => ({
      date: r.date, label: fmtLabel(r.date), count: r.count,
    })) : [];

    // ─── Shift summary ───
    const dr = Array.isArray(dutySummary) && dutySummary.length > 0 ? dutySummary[0] : { total: 0, on_duty: 0, upcoming: 0, completed: 0, off_duty: 0 };

    return res.json({
      summary: {
        workforce,
        allocations: {
          total: allocSummary?.[0]?.total || 0,
          pending: allocSummary?.[0]?.pending || 0,
          approved: allocSummary?.[0]?.approved || 0,
          rejected: allocSummary?.[0]?.rejected || 0,
          completed: allocSummary?.[0]?.completed || 0,
          transferred: allocSummary?.[0]?.transferred || 0,
          critical: allocSummary?.[0]?.critical || 0,
          avgApprovalHours: Number(avgApprovalRaw?.[0]?.avg_hours || 0),
        },
        duty: {
          totalDuties: dr.total,
          onDuty: dr.on_duty,
          upcoming: dr.upcoming,
          completed: dr.completed,
          offDuty: dr.off_duty,
        },
        shifts: {
          totalAssignments: shiftAssignCount,
          uniqueStaffAssigned: shiftUniqueStaff.length,
          shiftChanges,
        },
      },
      workforceByRole,
      workforceByDepartment,
      allocationsBySource,
      allocationsByPriority,
      allocationsByStatus,
      allocationsByDay,
      dutyByType,
      dutyByShift,
      dutyByDay,
      topAssignedStaff: Array.isArray(topStaffRaw) ? topStaffRaw.map((r) => ({
        employeeId: r.employeeId, name: r.name || 'Unknown', role: r.role || 'N/A',
        allocationCount: r.allocationCount, dutyCount: r.dutyCount,
      })) : [],
      recentRejections: Array.isArray(recentRejectionsRaw) ? recentRejectionsRaw.map((r) => ({
        requestNumber: r.requestNumber, patientName: r.patientName,
        reason: r.reason, rejectedAt: r.rejectedAt,
      })) : [],
      meta,
    });
  } catch (err) {
    console.error('getHrReportsAnalytics error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getHrReportsAnalytics };
