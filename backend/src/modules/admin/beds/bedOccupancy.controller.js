const { prisma } = require('../../../config/prisma');

const LEGACY_WARD_NAME = 'Default Ward (temporary)';
const ACTIVE_STATUSES = ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'];

function bedStatsWhereBase() {
  return {
    ward: { isActive: true },
    NOT: [{ code: { startsWith: 'DW-' } }, { ward: { name: LEGACY_WARD_NAME } }],
  };
}

async function releaseExpiredMaintenanceBeds() {
  const nowIso = new Date().toISOString();
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Bed" SET "status" = 'AVAILABLE', "maintenanceUntil" = NULL WHERE "status" = 'MAINTENANCE' AND "maintenanceUntil" IS NOT NULL AND "maintenanceUntil" <= '${nowIso}'`,
    );
  } catch {
    // ignore when column unavailable
  }
}

function toStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toEndOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isoDayKey(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildDayKeys(from, days) {
  const keys = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    keys.push(isoDayKey(d));
  }
  return keys.filter(Boolean);
}

function normalizeString(v) {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  return String(v).trim();
}

function toInt(v) {
  return Math.round(Number(v || 0));
}

function pctChange(prev, curr) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

const WARD_TYPE_LABELS = {
  GENERAL: 'General',
  ICU: 'ICU',
  PRIVATE: 'Private',
};

function buildTransferWhere(from, to, wardId, wardType) {
  const base = { createdAt: { gte: from, lte: to } };
  if (wardId) {
    return {
      ...base,
      OR: [{ toBed: { wardId } }, { fromBed: { wardId } }],
    };
  }
  if (wardType) {
    return {
      ...base,
      OR: [{ toBed: { ward: { type: wardType } } }, { fromBed: { ward: { type: wardType } } }],
    };
  }
  return base;
}

// Estimated daily occupancy from admission records.
// For a given day, a bed is "occupied" if there is an Admission linked to that bed
// where admissionDate <= day-end AND (dischargeDate IS NULL OR dischargeDate > day-start).
function estimateDailyOccupancy(allOpenAdmissions, dayKeys, totalBeds) {
  const result = [];
  for (const date of dayKeys) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    let occupied = 0;
    let dayAdmissions = 0;
    let dayDischarges = 0;
    for (const a of allOpenAdmissions) {
      const admDate = new Date(a.admissionDate);
      if (admDate <= dayEnd) {
        if (a.admissionDate >= dayStart && a.admissionDate <= dayEnd) dayAdmissions += 1;
        const disDate = a.dischargeDate ? new Date(a.dischargeDate) : null;
        if (!disDate || disDate > dayStart) {
          occupied += 1;
        }
        if (disDate && disDate >= dayStart && disDate <= dayEnd) dayDischarges += 1;
      }
    }
    const pct = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;
    const d = new Date(`${date}T12:00:00`);
    result.push({
      date,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      occupied,
      totalBeds,
      occupancyPct: pct,
      admissions: dayAdmissions,
      discharges: dayDischarges,
    });
  }
  return result;
}

async function getBedOccupancyAnalytics(req, res) {
  try {
  await releaseExpiredMaintenanceBeds();

  const rawTo = parseDateOnly(req.query.to) || new Date();
  const rawFrom = parseDateOnly(req.query.from);
  const to = toEndOfDay(rawTo);
  const from = rawFrom ? toStartOfDay(rawFrom) : (() => {
    const d = new Date(to);
    d.setDate(d.getDate() - 30);
    return toStartOfDay(d);
  })();

  const wardId = normalizeString(req.query.wardId) || null;
  const wardType = normalizeString(req.query.wardType) || null;
  const daysDiff = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1);
  const dayKeys = buildDayKeys(from, daysDiff);

  const prevFrom = new Date(from);
  prevFrom.setDate(prevFrom.getDate() - daysDiff);
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevToEnd = toEndOfDay(prevTo);

  const bedWhereBase = bedStatsWhereBase();

  const admissionWhereBase = {
    ...(wardId ? { wardId } : {}),
    ...(wardType ? { ward: { type: wardType } } : {}),
  };

  const [
    allBeds,
    activeAdmissionsNow,
    newAdmissionsInPeriod,
    dischargesInPeriod,
    prevAdmissionsCount,
    prevDischargesCount,
    transfersInPeriod,
    prevTransfersCount,
    recentTransfersRows,
    longestOccupiedRows,
    allOpenForPeriod,
    previousOpenForPeriod,
  ] = await Promise.all([
    prisma.bed.findMany({
      where: {
        ...bedWhereBase,
        ...(wardId ? { wardId } : {}),
        ...(wardType ? { ward: { type: wardType } } : {}),
      },
      select: {
        id: true,
        code: true,
        status: true,
        wardId: true,
        ward: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ ward: { type: 'asc' } }, { ward: { name: 'asc' } }, { code: 'asc' }],
    }),
    prisma.admission.count({
      where: {
        dischargeDate: null,
        status: { in: ACTIVE_STATUSES },
        bedId: { not: null },
        ...admissionWhereBase,
      },
    }),
    prisma.admission.count({
      where: {
        admissionDate: { gte: from, lte: to },
        bedId: { not: null },
        ...admissionWhereBase,
      },
    }),
    prisma.admission.count({
      where: {
        dischargeDate: { gte: from, lte: to },
        bedId: { not: null },
        ...admissionWhereBase,
      },
    }),
    prisma.admission.count({
      where: {
        admissionDate: { gte: prevFrom, lte: prevToEnd },
        bedId: { not: null },
        ...admissionWhereBase,
      },
    }),
    prisma.admission.count({
      where: {
        dischargeDate: { gte: prevFrom, lte: prevToEnd },
        bedId: { not: null },
        ...admissionWhereBase,
      },
    }),
    prisma.bedTransfer.count({
      where: buildTransferWhere(from, to, wardId, wardType),
    }),
    prisma.bedTransfer.count({
      where: buildTransferWhere(prevFrom, prevToEnd, wardId, wardType),
    }),
    prisma.bedTransfer.findMany({
      where: buildTransferWhere(from, to, wardId, wardType),
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        reason: true,
        fromBed: { select: { code: true, ward: { select: { name: true } } } },
        toBed: { select: { code: true, ward: { select: { name: true } } } },
        admission: {
          select: {
            ipdNumber: true,
            patient: { select: { name: true, uhid: true } },
          },
        },
      },
    }),
    prisma.admission.findMany({
      where: {
        dischargeDate: null,
        status: { in: ACTIVE_STATUSES },
        bedId: { not: null },
        ...admissionWhereBase,
      },
      orderBy: { admissionDate: 'asc' },
      take: 20,
      select: {
        id: true,
        admissionDate: true,
        bed: { select: { code: true, ward: { select: { name: true } } } },
        patient: { select: { name: true, uhid: true } },
      },
    }),
    prisma.admission.findMany({
      where: {
        // All admissions that were open during the period
        admissionDate: { lte: to },
        OR: [
          { dischargeDate: null },
          { dischargeDate: { gte: from } },
        ],
        bedId: { not: null },
        ...admissionWhereBase,
      },
      select: { id: true, admissionDate: true, dischargeDate: true },
      take: 100000,
    }),
    prisma.admission.findMany({
      where: {
        admissionDate: { lte: prevToEnd },
        OR: [
          { dischargeDate: null },
          { dischargeDate: { gte: prevFrom } },
        ],
        bedId: { not: null },
        ...admissionWhereBase,
      },
      select: { id: true, admissionDate: true, dischargeDate: true },
      take: 100000,
    }),
  ]);

  const totalBeds = allBeds.length;
  const availableBeds = allBeds.filter((b) => b.status === 'AVAILABLE').length;
  const occupiedBeds = allBeds.filter((b) => b.status === 'OCCUPIED').length;
  const maintenanceBeds = allBeds.filter((b) => b.status === 'MAINTENANCE').length;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const statusBreakdown = [
    { status: 'Available', count: availableBeds },
    { status: 'Occupied', count: occupiedBeds },
    { status: 'Maintenance', count: maintenanceBeds },
  ];

  // By ward type
  const byWardTypeMap = new Map();
  for (const b of allBeds) {
    const wt = (b.ward?.type || 'GENERAL');
    if (!byWardTypeMap.has(wt)) {
      byWardTypeMap.set(wt, { totalBeds: 0, occupied: 0, available: 0, maintenance: 0 });
    }
    const entry = byWardTypeMap.get(wt);
    entry.totalBeds += 1;
    if (b.status === 'OCCUPIED') entry.occupied += 1;
    else if (b.status === 'AVAILABLE') entry.available += 1;
    else if (b.status === 'MAINTENANCE') entry.maintenance += 1;
  }
  const byWardType = Array.from(byWardTypeMap.entries())
    .map(([wt, counts]) => ({
      wardType: WARD_TYPE_LABELS[wt] || wt,
      totalBeds: counts.totalBeds,
      occupied: counts.occupied,
      available: counts.available,
      maintenance: counts.maintenance,
      occupancyPct: counts.totalBeds > 0 ? Math.round((counts.occupied / counts.totalBeds) * 100) : 0,
    }))
    .sort((a, b) => b.occupancyPct - a.occupancyPct);

  // By ward
  const byWardMap = new Map();
  for (const b of allBeds) {
    const wid = b.wardId;
    if (!byWardMap.has(wid)) {
      byWardMap.set(wid, {
        wardId: wid,
        wardName: b.ward?.name || 'Unknown',
        wardType: WARD_TYPE_LABELS[b.ward?.type || 'GENERAL'] || 'General',
        totalBeds: 0, occupied: 0, available: 0, maintenance: 0,
      });
    }
    const entry = byWardMap.get(wid);
    entry.totalBeds += 1;
    if (b.status === 'OCCUPIED') entry.occupied += 1;
    else if (b.status === 'AVAILABLE') entry.available += 1;
    else if (b.status === 'MAINTENANCE') entry.maintenance += 1;
  }
  const byWard = Array.from(byWardMap.values())
    .map((w) => ({
      ...w,
      occupancyPct: w.totalBeds > 0 ? Math.round((w.occupied / w.totalBeds) * 100) : 0,
    }))
    .sort((a, b) => b.occupancyPct - a.occupancyPct);

  // Occupancy by day (estimated from admissions)
  const occupancyByDay = estimateDailyOccupancy(allOpenForPeriod, dayKeys, totalBeds);

  const avgOccupancyPctInPeriod = occupancyByDay.length > 0
    ? Math.round(occupancyByDay.reduce((s, d) => s + d.occupancyPct, 0) / occupancyByDay.length)
    : 0;

  // Avg LOS from discharged in period
  const dischargedAdms = allOpenForPeriod.filter((a) => a.dischargeDate && a.dischargeDate >= from && a.dischargeDate <= to);
  let avgLengthOfStayDays = 0;
  if (dischargedAdms.length > 0) {
    let totalDays = 0;
    let cnt = 0;
    for (const a of dischargedAdms) {
      const diff = (new Date(a.dischargeDate) - new Date(a.admissionDate)) / (1000 * 60 * 60 * 24);
      totalDays += diff;
      cnt += 1;
    }
    avgLengthOfStayDays = cnt > 0 ? Math.round((totalDays / cnt) * 10) / 10 : 0;
  }

  // Top wards by occupancy
  const topWardsByOccupancy = [...byWard]
    .sort((a, b) => b.occupancyPct - a.occupancyPct)
    .slice(0, 10);

  // Recent transfers
  const recentTransfers = (recentTransfersRows || []).map((t) => ({
    at: t.createdAt,
    patientName: t.admission?.patient?.name || '—',
    uhid: t.admission?.patient?.uhid || '—',
    ipdNumber: t.admission?.ipdNumber || '—',
    fromBed: t.fromBed ? `${t.fromBed.code} (${t.fromBed.ward?.name || ''})` : '—',
    toBed: t.toBed ? `${t.toBed.code} (${t.toBed.ward?.name || ''})` : '—',
    fromWard: t.fromBed?.ward?.name || '—',
    toWard: t.toBed?.ward?.name || '—',
    reason: t.reason || '—',
  }));

  // Longest occupied beds
  const longestOccupiedBeds = (longestOccupiedRows || []).map((a) => {
    const daysOccupied = Math.round((new Date() - new Date(a.admissionDate)) / (1000 * 60 * 60 * 24));
    return {
      bedCode: a.bed?.code || '—',
      wardName: a.bed?.ward?.name || '—',
      patientName: a.patient?.name || '—',
      uhid: a.patient?.uhid || '—',
      daysOccupied,
      admissionDate: a.admissionDate,
    };
  });

  return res.json({
    range: { from: isoDayKey(from), to: isoDayKey(to) },
    summary: {
      totalBeds,
      availableBeds,
      occupiedBeds,
      maintenanceBeds,
      occupancyPct,
      activeAdmissionsNow,
      newAdmissionsInPeriod,
      dischargesInPeriod,
      transfersInPeriod,
      avgOccupancyPctInPeriod,
      avgLengthOfStayDays,
      changeVsPrevPeriod: {
        admissions: pctChange(prevAdmissionsCount, newAdmissionsInPeriod),
        discharges: pctChange(prevDischargesCount, dischargesInPeriod),
        occupancyPct: pctChange(prevPeriodOccupancyPct(previousOpenForPeriod, totalBeds, prevFrom, prevToEnd), occupancyPct),
      },
    },
    statusBreakdown,
    byWardType,
    byWard,
    occupancyByDay,
    topWardsByOccupancy,
    recentTransfers,
    longestOccupiedBeds,
  });
  } catch (err) {
    console.error('getBedOccupancyAnalytics error:', err);
    return res.status(500).json({ message: 'Failed to load occupancy analytics' });
  }
}

function prevPeriodOccupancyPct(admissions, totalBeds, from, to) {
  if (totalBeds === 0 || !admissions.length) return 0;
  const daysDiff = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1);
  const keys = buildDayKeys(from, daysDiff);
  const daily = estimateDailyOccupancy(admissions, keys, totalBeds);
  if (daily.length === 0) return 0;
  return Math.round(daily.reduce((s, d) => s + d.occupancyPct, 0) / daily.length);
}

module.exports = { getBedOccupancyAnalytics };
