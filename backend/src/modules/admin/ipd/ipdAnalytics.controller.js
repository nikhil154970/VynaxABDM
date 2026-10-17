const { prisma } = require('../../../config/prisma');

const ACTIVE_STATUSES = ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'];
const LEGACY_WARD_NAME = 'Default Ward (temporary)';

function legacyWardExclude() {
  return {
    ward: { isActive: true },
    NOT: [{ code: { startsWith: 'DW-' } }, { ward: { name: LEGACY_WARD_NAME } }],
  };
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

function sumByDay(rows, dateField) {
  const map = new Map();
  for (const r of rows || []) {
    const key = isoDayKey(r?.[dateField]);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function billPendingAmount(b) {
  const st = String(b?.status || '').toUpperCase();
  if (st === 'CANCELLED') return 0;
  const total = Math.max(0, Number(b?.totalAmount) || 0);
  const paidRaw = Math.max(0, Number(b?.paidAmount) || 0);
  const payments = Array.isArray(b?.payments) ? b.payments : [];
  const paidByPayments = payments.reduce((s, p) => s + Math.max(0, Number(p?.amount) || 0), 0);
  const paid = Math.max(paidRaw, paidByPayments);
  return Math.max(0, Math.round(total - paid));
}

function toInt(v) {
  return Math.round(Number(v || 0));
}

function pctChange(prev, curr) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function normalizeString(v) {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  return String(v).trim();
}

function buildAdmissionBillFilter(department, doctorId, wardType) {
  const admission = {};
  if (department) admission.department = department;
  if (doctorId) admission.doctorId = doctorId;
  if (wardType) admission.ward = { type: wardType };
  return Object.keys(admission).length ? { admission } : {};
}

function buildAdmissionFilter(department, doctorId, wardType) {
  return {
    ...(department ? { department } : {}),
    ...(doctorId ? { doctorId } : {}),
    ...(wardType ? { ward: { type: wardType } } : {}),
  };
}

function sumAmountByDay(rows, dateField, amountField = 'totalAmount') {
  const map = new Map();
  for (const r of rows || []) {
    const key = isoDayKey(r?.[dateField]);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + toInt(r?.[amountField]));
  }
  return map;
}

const WARD_TYPE_LABELS = {
  GENERAL: 'General',
  ICU: 'ICU',
  PRIVATE: 'Private',
  UNKNOWN: 'Unknown',
};

const STATUS_LABEL_MAP = {
  ADMITTED: 'Admitted',
  UNDER_TREATMENT: 'Under Treatment',
  READY_FOR_DISCHARGE: 'Ready for Discharge',
  DISCHARGE_REQUESTED: 'Discharge Requested',
};

async function getIpdAnalytics(req, res) {
  try {
  const rawTo = parseDateOnly(req.query.to) || new Date();
  const rawFrom = parseDateOnly(req.query.from);
  const to = toEndOfDay(rawTo);
  const from = rawFrom ? toStartOfDay(rawFrom) : (() => {
    const d = new Date(to);
    d.setDate(d.getDate() - 30);
    return toStartOfDay(d);
  })();

  const department = normalizeString(req.query.department) || null;
  const doctorId = normalizeString(req.query.doctorId) || null;
  const wardType = normalizeString(req.query.wardType) || null;
  const daysDiff = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1);

  const prevFrom = new Date(from);
  prevFrom.setDate(prevFrom.getDate() - daysDiff);
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevToEnd = toEndOfDay(prevTo);

  const admissionWhereRange = {
    admissionDate: { gte: from, lte: to },
    ...buildAdmissionFilter(department, doctorId, wardType),
  };

  const admissionWhereActive = {
    dischargeDate: null,
    status: { in: ACTIVE_STATUSES },
    ...buildAdmissionFilter(department, doctorId, wardType),
  };

  const dischargeWhere = {
    dischargeDate: { gte: from, lte: to },
    ...buildAdmissionFilter(department, doctorId, wardType),
  };

  const admissionBillFilter = buildAdmissionBillFilter(department, doctorId, wardType);

  const billWhere = {
    billDate: { gte: from, lte: to },
    visitType: 'IPD',
    status: { not: 'CANCELLED' },
    ...admissionBillFilter,
  };

  const billPaymentWhere = {
    createdAt: { gte: from, lte: to },
    bill: {
      visitType: 'IPD',
      status: { not: 'CANCELLED' },
      ...(admissionBillFilter.admission ? { admission: admissionBillFilter.admission } : {}),
    },
  };

  const prevAdmissionWhereRange = {
    admissionDate: { gte: prevFrom, lte: prevToEnd },
    ...buildAdmissionFilter(department, doctorId, wardType),
  };

  const prevBillWhere = {
    billDate: { gte: prevFrom, lte: prevToEnd },
    visitType: 'IPD',
    status: { not: 'CANCELLED' },
    ...admissionBillFilter,
  };

  const prevDischargeWhere = {
    dischargeDate: { gte: prevFrom, lte: prevToEnd },
    ...buildAdmissionFilter(department, doctorId, wardType),
  };

  const [
    activeAdmissionsNow,
    newAdmissionsInPeriod,
    dischargesInPeriod,
    icuPatientsNow,
    dischargeRequestedNow,
    totalBeds,
    occupiedBeds,
    ipdBilledAgg,
    ipdCollectedAgg,
    ipdBillsDetail,
    prevAdmissionsCount,
    prevDischargesCount,
    prevRevenueAgg,
    statusGroups,
    admissionForDaySeries,
    dischargeDatesForLos,
    dischargeForDaySeries,
    payForDaySeries,
    deptGroups,
    deptActiveGroups,
    wardTypeGroups,
    wardAdmissionGroups,
    doctorGroups,
    doctorDischargeGroups,
    recentAdmissionsRows,
    recentDischargedRows,
  ] = await Promise.all([
    prisma.admission.count({ where: admissionWhereActive }),
    prisma.admission.count({ where: admissionWhereRange }),
    prisma.admission.count({ where: dischargeWhere }),
    (!wardType || wardType === 'ICU')
      ? prisma.admission.count({
          where: {
            dischargeDate: null,
            status: { in: ACTIVE_STATUSES },
            ward: { type: 'ICU' },
            ...buildAdmissionFilter(department, doctorId, wardType === 'ICU' ? 'ICU' : null),
          },
        })
      : Promise.resolve(0),
    prisma.admission.count({
      where: {
        ...admissionWhereActive,
        status: 'DISCHARGE_REQUESTED',
      },
    }),
    prisma.bed.count({ where: legacyWardExclude() }),
    prisma.bed.count({ where: { ...legacyWardExclude(), status: 'OCCUPIED' } }),
    prisma.bill.aggregate({
      where: billWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.billPayment.aggregate({
      where: billPaymentWhere,
      _sum: { amount: true },
    }),
    prisma.bill.findMany({
      where: billWhere,
      select: {
        billDate: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        payments: { select: { amount: true } },
        admission: { select: { department: true, doctorId: true } },
      },
      take: 100000,
    }),
    prisma.admission.count({ where: prevAdmissionWhereRange }),
    prisma.admission.count({ where: prevDischargeWhere }),
    prisma.bill.aggregate({
      where: prevBillWhere,
      _sum: { totalAmount: true },
    }),
    prisma.admission.groupBy({
      by: ['status'],
      where: admissionWhereActive,
      _count: { id: true },
    }),
    prisma.admission.findMany({
      where: admissionWhereRange,
      select: { admissionDate: true },
      take: 100000,
    }),
    prisma.admission.findMany({
      where: { ...dischargeWhere, dischargeDate: { not: null } },
      select: { admissionDate: true, dischargeDate: true },
      take: 100000,
    }),
    prisma.admission.findMany({
      where: { ...dischargeWhere, dischargeDate: { not: null } },
      select: { dischargeDate: true },
      take: 100000,
    }),
    prisma.billPayment.findMany({
      where: billPaymentWhere,
      select: { createdAt: true, amount: true },
      take: 100000,
    }),
    prisma.admission.groupBy({
      by: ['department'],
      where: admissionWhereRange,
      _count: { department: true },
      orderBy: { _count: { department: 'desc' } },
      take: 20,
    }),
    prisma.admission.groupBy({
      by: ['department'],
      where: {
        dischargeDate: null,
        status: { in: ACTIVE_STATUSES },
        department: { not: null },
        ...buildAdmissionFilter(null, doctorId, wardType),
      },
      _count: { id: true },
    }),
    prisma.admission.groupBy({
      by: ['wardId'],
      where: admissionWhereActive,
      _count: { wardId: true },
    }),
    prisma.admission.groupBy({
      by: ['wardId'],
      where: admissionWhereRange,
      _count: { id: true },
    }),
    prisma.admission.groupBy({
      by: ['doctorId'],
      where: admissionWhereRange,
      _count: { doctorId: true },
      orderBy: { _count: { doctorId: 'desc' } },
      take: 20,
    }),
    prisma.admission.groupBy({
      by: ['doctorId'],
      where: dischargeWhere,
      _count: { id: true },
    }),
    prisma.admission.findMany({
      where: admissionWhereRange,
      orderBy: { admissionDate: 'desc' },
      take: 20,
      select: {
        id: true,
        ipdNumber: true,
        admissionDate: true,
        department: true,
        status: true,
        patient: { select: { name: true, uhid: true } },
        ward: { select: { name: true, type: true } },
        doctor: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.admission.findMany({
      where: { ...dischargeWhere, dischargeDate: { not: null } },
      orderBy: { dischargeDate: 'desc' },
      take: 20,
      select: {
        id: true,
        ipdNumber: true,
        admissionDate: true,
        dischargeDate: true,
        patient: { select: { name: true, uhid: true } },
        bills: {
          where: { visitType: 'IPD', status: { not: 'CANCELLED' } },
          select: {
            id: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
            payments: { select: { amount: true } },
          },
          take: 100,
        },
      },
    }),
  ]);

  const ipdRevenueBilled = toInt(ipdBilledAgg._sum?.totalAmount);
  const ipdRevenueCollected = toInt(ipdCollectedAgg._sum?.amount);
  let ipdRevenuePending = 0;
  const revenueByDept = new Map();
  const revenueByDoctor = new Map();
  for (const b of ipdBillsDetail || []) {
    ipdRevenuePending += billPendingAmount(b);
    const dept = b.admission?.department;
    if (dept) revenueByDept.set(dept, (revenueByDept.get(dept) || 0) + toInt(b.totalAmount));
    const did = b.admission?.doctorId;
    if (did) revenueByDoctor.set(did, (revenueByDoctor.get(did) || 0) + toInt(b.totalAmount));
  }

  let totalLosDays = 0;
  let countLos = 0;
  for (const adm of dischargeDatesForLos || []) {
    if (adm.admissionDate && adm.dischargeDate) {
      const diff = (new Date(adm.dischargeDate) - new Date(adm.admissionDate)) / (1000 * 60 * 60 * 24);
      totalLosDays += diff;
      countLos += 1;
    }
  }
  const avgLengthOfStayDays = countLos > 0 ? Math.round((totalLosDays / countLos) * 10) / 10 : 0;

  const dayKeys = buildDayKeys(from, daysDiff);
  const admissionDayMap = sumByDay(admissionForDaySeries, 'admissionDate');
  const dischargeDayMap = new Map();
  for (const r of dischargeForDaySeries || []) {
    const key = isoDayKey(r.dischargeDate);
    if (!key) continue;
    dischargeDayMap.set(key, (dischargeDayMap.get(key) || 0) + 1);
  }

  const admissionsByDay = dayKeys.map((date) => {
    const d = new Date(`${date}T12:00:00`);
    return {
      date,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      admissions: admissionDayMap.get(date) || 0,
      discharges: dischargeDayMap.get(date) || 0,
    };
  });

  const billDayMap = sumAmountByDay(ipdBillsDetail, 'billDate', 'totalAmount');
  const collectedDayMap = new Map();
  for (const p of payForDaySeries || []) {
    const key = isoDayKey(p.createdAt);
    if (!key) continue;
    collectedDayMap.set(key, (collectedDayMap.get(key) || 0) + toInt(p.amount));
  }

  const revenueByDay = dayKeys.map((date) => {
    const d = new Date(`${date}T12:00:00`);
    return {
      date,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      billed: billDayMap.get(date) || 0,
      collected: collectedDayMap.get(date) || 0,
    };
  });

  const statusBreakdown = (statusGroups || []).map((g) => ({
    status: STATUS_LABEL_MAP[g.status] || g.status,
    count: g._count.id,
  }));

  if (statusBreakdown.length === 0) {
    statusBreakdown.push({ status: 'No active admissions', count: 0 });
  }

  const activeByDept = new Map(
    (deptActiveGroups || []).map((g) => [g.department, g._count.id]),
  );

  const byDepartment = (deptGroups || []).filter((d) => d.department).map((d) => ({
    department: d.department || 'Unknown',
    admissions: d._count.department,
    activeNow: activeByDept.get(d.department) || 0,
    revenue: revenueByDept.get(d.department) || 0,
  }));

  const wardIds = new Set([
    ...(wardTypeGroups || []).map((g) => g.wardId).filter(Boolean),
    ...(wardAdmissionGroups || []).map((g) => g.wardId).filter(Boolean),
  ]);
  const wardsById = wardIds.size
    ? await prisma.ward.findMany({
        where: { id: { in: [...wardIds] } },
        select: { id: true, type: true, name: true },
      })
    : [];
  const wardTypeMap = new Map(wardsById.map((w) => [w.id, w.type]));

  const byWardTypeMap = new Map();
  let unassignedActive = 0;
  for (const g of wardTypeGroups || []) {
    if (!g.wardId) {
      unassignedActive += g._count.wardId;
      continue;
    }
    const wt = wardTypeMap.get(g.wardId) || 'UNKNOWN';
    byWardTypeMap.set(wt, (byWardTypeMap.get(wt) || 0) + g._count.wardId);
  }

  const admissionsByWardType = new Map();
  let unassignedAdmissions = 0;
  for (const g of wardAdmissionGroups || []) {
    if (!g.wardId) {
      unassignedAdmissions += g._count.id;
      continue;
    }
    const wt = wardTypeMap.get(g.wardId) || 'UNKNOWN';
    admissionsByWardType.set(wt, (admissionsByWardType.get(wt) || 0) + g._count.id);
  }

  const byWardType = [];
  for (const [wt, cnt] of byWardTypeMap) {
    byWardType.push({
      wardType: WARD_TYPE_LABELS[wt] || wt,
      activeNow: cnt,
      admissions: admissionsByWardType.get(wt) || 0,
    });
  }
  if (unassignedActive > 0 || unassignedAdmissions > 0) {
    byWardType.push({
      wardType: 'Unassigned',
      activeNow: unassignedActive,
      admissions: unassignedAdmissions,
    });
  }

  const doctorIds = (doctorGroups || []).map((d) => d.doctorId).filter(Boolean);
  const doctorRows = doctorIds.length
    ? await prisma.doctor.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, specialization: true, user: { select: { name: true } } },
      })
    : [];
  const byDoctorId = new Map(doctorRows.map((d) => [d.id, d]));

  const doctorDischargeMap = new Map(
    (doctorDischargeGroups || []).map((g) => [g.doctorId, g._count.id]),
  );

  const topDoctors = (doctorGroups || []).map((d) => ({
    doctorId: d.doctorId,
    name: byDoctorId.get(d.doctorId)?.user?.name || '—',
    admissions: d._count.doctorId,
    discharges: doctorDischargeMap.get(d.doctorId) || 0,
    revenue: revenueByDoctor.get(d.doctorId) || 0,
  })).sort((a, b) => b.admissions - a.admissions);

  const recentAdmissions = (recentAdmissionsRows || []).map((a) => ({
    at: a.admissionDate,
    ipdNumber: a.ipdNumber || '—',
    patientName: a.patient?.name || '—',
    uhid: a.patient?.uhid || '—',
    department: a.department || '—',
    ward: a.ward ? `${a.ward.name} (${a.ward.type})` : '—',
    doctorName: a.doctor?.user?.name || '—',
    status: STATUS_LABEL_MAP[a.status] || a.status,
  }));

  const recentDischarges = (recentDischargedRows || []).map((a) => {
    let daysStay = 0;
    if (a.admissionDate && a.dischargeDate) {
      daysStay = Math.round((new Date(a.dischargeDate) - new Date(a.admissionDate)) / (1000 * 60 * 60 * 24));
    }
    let hasDues = false;
    for (const b of a.bills || []) {
      if (billPendingAmount(b) > 0) { hasDues = true; break; }
    }
    return {
      at: a.dischargeDate,
      ipdNumber: a.ipdNumber || '—',
      patientName: a.patient?.name || '—',
      uhid: a.patient?.uhid || '—',
      lengthOfStayDays: daysStay,
      dischargeStatus: hasDues ? 'Discharged with Dues' : 'Discharged',
    };
  });

  const bedOccupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return res.json({
    range: { from: isoDayKey(from), to: isoDayKey(to) },
    summary: {
      activeAdmissionsNow,
      newAdmissionsInPeriod,
      dischargesInPeriod,
      avgLengthOfStayDays,
      icuPatientsNow,
      dischargeRequestedNow,
      bedOccupancyPct,
      bedsTotal: totalBeds,
      bedsOccupied: occupiedBeds,
      ipdRevenueBilled,
      ipdRevenueCollected,
      ipdRevenuePending,
      changeVsPrevPeriod: {
        admissions: pctChange(prevAdmissionsCount, newAdmissionsInPeriod),
        discharges: pctChange(prevDischargesCount, dischargesInPeriod),
        revenue: pctChange(toInt(prevRevenueAgg._sum?.totalAmount), ipdRevenueBilled),
      },
    },
    statusBreakdown,
    admissionsByDay,
    revenueByDay,
    byDepartment,
    byWardType,
    topDoctors,
    recentAdmissions,
    recentDischarges,
  });
  } catch (err) {
    console.error('getIpdAnalytics error:', err);
    return res.status(500).json({ message: 'Failed to load IPD analytics' });
  }
}

module.exports = { getIpdAnalytics };
