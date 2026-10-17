const { prisma } = require('../../../config/prisma');

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

function normalizeString(v) {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  return String(v).trim();
}

async function getOpdAnalytics(req, res) {
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
  const daysDiff = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1);

  // Optional filters
  const apptWhere = {
    date: { gte: from, lte: to },
    ...(department ? { department } : {}),
    ...(doctorId ? { doctorId } : {}),
  };
  const visitWhere = {
    visitDate: { gte: from, lte: to },
    visitType: 'OPD',
    ...(department ? { department } : {}),
  };
  const consultationWhere = {
    createdAt: { gte: from, lte: to },
    ...(department ? { appointment: { department } } : {}),
    ...(doctorId ? { doctorId } : {}),
  };

  const billWhere = {
    billDate: { gte: from, lte: to },
    visitType: 'OPD',
    status: { not: 'CANCELLED' },
    ...(department || doctorId
      ? {
          appointment: {
            ...(department ? { department } : {}),
            ...(doctorId ? { doctorId } : {}),
          },
        }
      : {}),
  };

  const paymentWhere = {
    createdAt: { gte: from, lte: to },
    bill: {
      visitType: 'OPD',
      status: { not: 'CANCELLED' },
      ...(department || doctorId
        ? {
            appointment: {
              ...(department ? { department } : {}),
              ...(doctorId ? { doctorId } : {}),
            },
          }
        : {}),
    },
  };

  const pendingBillWhere = {
    billDate: { gte: from, lte: to },
    visitType: 'OPD',
    status: { in: ['PENDING', 'PARTIAL'] },
    ...(department || doctorId
      ? {
          appointment: {
            ...(department ? { department } : {}),
            ...(doctorId ? { doctorId } : {}),
          },
        }
      : {}),
  };

  // Previous period
  const prevFrom = new Date(from);
  prevFrom.setDate(prevFrom.getDate() - daysDiff);
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevToEnd = toEndOfDay(prevTo);

  const prevBillWhere = {
    billDate: { gte: prevFrom, lte: prevToEnd },
    visitType: 'OPD',
    status: { not: 'CANCELLED' },
    ...(department || doctorId
      ? {
          appointment: {
            ...(department ? { department } : {}),
            ...(doctorId ? { doctorId } : {}),
          },
        }
      : {}),
  };

  const todayStart = toStartOfDay(new Date());
  const todayEnd = toEndOfDay(new Date());

  const [
    appointments,
    receptionVisits,
    consultations,
    consultationsWithDispo,
    opdBillsAgg,
    opdPayAgg,
    opdPendingAgg,
    labTopAgg,
    prevApptCount,
    prevRevenueAgg,
    apptGroups,
    visitGroups,
    apptForSeries,
    visitForSeries,
    billForSeries,
    payForSeries,
    deptGroups,
    doctorGroups,
    diagnosisRows,
    apptForRecent,
    visitForRecent,
    uniqueApptPidsQuery,
    uniqueVisitPidsQuery,
  ] = await Promise.all([
    // Total appointments in range
    prisma.appointment.count({ where: apptWhere }),
    // Total reception visits in range
    prisma.receptionVisit.count({ where: visitWhere }),
    // Total consultations in range
    prisma.consultation.count({ where: consultationWhere }),
    // Consultations with disposition data (for REFER_ADMIT count + diagnosis extraction)
    prisma.consultation.findMany({
      where: consultationWhere,
      select: { disposition: true, diagnosis: true },
      take: 50000,
    }),
    // OPD billed total
    prisma.bill.aggregate({
      where: billWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // OPD collected (payments by date)
    prisma.billPayment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
    }),
    // OPD pending
    prisma.bill.aggregate({
      where: pendingBillWhere,
      _sum: { totalAmount: true, paidAmount: true },
    }),
    // Top lab tests advised
    prisma.labOrderItem.groupBy({
      by: ['testName'],
      where: {
        labOrder: {
          createdAt: { gte: from, lte: to },
          appointment: {
            date: { gte: from, lte: to },
            ...(department ? { department } : {}),
            ...(doctorId ? { doctorId } : {}),
          },
        },
      },
      _count: { testName: true },
      orderBy: { _count: { testName: 'desc' } },
      take: 10,
    }),
    // Previous period appointment count
    prisma.appointment.count({
      where: {
        date: { gte: prevFrom, lte: prevToEnd },
        ...(department ? { department } : {}),
        ...(doctorId ? { doctorId } : {}),
      },
    }),
    // Previous period OPD revenue
    prisma.bill.aggregate({
      where: prevBillWhere,
      _sum: { totalAmount: true },
    }),
    // Appointments grouped by status
    prisma.appointment.groupBy({
      by: ['status'],
      where: apptWhere,
      _count: { id: true },
    }),
    // Reception visits grouped by status
    prisma.receptionVisit.groupBy({
      by: ['status'],
      where: visitWhere,
      _count: { id: true },
    }),
    // Daily series - appointments
    prisma.appointment.findMany({
      where: apptWhere,
      select: { date: true },
      take: 100000,
    }),
    // Daily series - reception visits
    prisma.receptionVisit.findMany({
      where: visitWhere,
      select: { visitDate: true },
      take: 100000,
    }),
    // Daily series - OPD bills
    prisma.bill.findMany({
      where: billWhere,
      select: { billDate: true, totalAmount: true },
      take: 100000,
    }),
    // Daily series - OPD payments
    prisma.billPayment.findMany({
      where: paymentWhere,
      select: { createdAt: true, amount: true },
      take: 100000,
    }),
    // Top departments
    prisma.appointment.groupBy({
      by: ['department'],
      where: apptWhere,
      _count: { department: true },
      orderBy: { _count: { department: 'desc' } },
      take: 20,
    }),
    // Top doctors
    prisma.appointment.groupBy({
      by: ['doctorId'],
      where: apptWhere,
      _count: { doctorId: true },
      orderBy: { _count: { doctorId: 'desc' } },
      take: 20,
    }),
    // Diagnosis extraction
    prisma.consultation.findMany({
      where: consultationWhere,
      select: { diagnosis: true },
      take: 100000,
    }),
    // Recent OPD appointments
    prisma.appointment.findMany({
      where: apptWhere,
      orderBy: { date: 'desc' },
      take: 20,
      select: {
        id: true,
        date: true,
        token: true,
        status: true,
        department: true,
        patient: { select: { name: true, uhid: true } },
        doctor: { select: { user: { select: { name: true } }, specialization: true } },
      },
    }),
    // Recent OPD reception visits
    prisma.receptionVisit.findMany({
      where: visitWhere,
      orderBy: { visitDate: 'desc' },
      take: 20,
      select: {
        id: true,
        visitDate: true,
        token: true,
        status: true,
        department: true,
        doctorName: true,
        patient: { select: { name: true, uhid: true } },
      },
    }),
    // Unique patients (distinct IDs)
    prisma.appointment.findMany({
      where: apptWhere,
      distinct: ['patientId'],
      select: { patientId: true },
      take: 200000,
    }),
    prisma.receptionVisit.findMany({
      where: visitWhere,
      distinct: ['patientId'],
      select: { patientId: true },
      take: 200000,
    }),
  ]);

  // Real-time "now" counts (today regardless of filter)
  const [waitingApptsNow, inProgressApptsNow] = await Promise.all([
    prisma.appointment.count({ where: { date: { gte: todayStart, lte: todayEnd }, status: 'WAITING' } }),
    prisma.appointment.count({ where: { date: { gte: todayStart, lte: todayEnd }, status: 'IN_PROGRESS' } }),
  ]);

  const toInt = (v) => Math.round(Number(v || 0));

  // Referred for admission
  const referredForAdmit = (consultationsWithDispo || []).filter(
    (c) => c.disposition === 'REFER_ADMIT',
  ).length;

  const completedConsultations = (consultationsWithDispo || []).length;

  // Revenue
  const opdBilled = toInt(opdBillsAgg._sum?.totalAmount);
  const opdCollected = toInt(opdPayAgg._sum?.amount);
  const opdPendingTotal = toInt(opdPendingAgg._sum?.totalAmount) - toInt(opdPendingAgg._sum?.paidAmount);

  // Previous period
  const prevAppts = prevApptCount || 0;
  const prevRevenue = toInt(prevRevenueAgg._sum?.totalAmount);
  const pctChange = (prev, curr) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  // Status breakdown
  const apptStatusMap = Object.fromEntries(
    (apptGroups || []).map((g) => [g.status, g._count.id]),
  );
  const statusBreakdownAppts = [
    { status: 'WAITING', label: 'Waiting', count: apptStatusMap.WAITING || 0 },
    { status: 'IN_PROGRESS', label: 'In consultation', count: apptStatusMap.IN_PROGRESS || 0 },
    { status: 'COMPLETED', label: 'Completed', count: apptStatusMap.COMPLETED || 0 },
  ];

  const visitStatusMap = Object.fromEntries(
    (visitGroups || []).map((g) => [g.status, g._count.id]),
  );
  const statusBreakdownVisits = [
    { status: 'WAITING', count: visitStatusMap.WAITING || 0 },
    { status: 'IN_CONSULTATION', count: visitStatusMap.IN_CONSULTATION || 0 },
    { status: 'COMPLETED', count: visitStatusMap.COMPLETED || 0 },
  ];

  // Visits by day
  const dayKeys = buildDayKeys(from, daysDiff);
  const apptDayMap = sumByDay(apptForSeries, 'date');
  const visitDayMap = sumByDay(visitForSeries, 'visitDate');

  const visitsByDay = dayKeys.map((date) => {
    const d = new Date(`${date}T12:00:00`);
    const appts = apptDayMap.get(date) || 0;
    const visits = visitDayMap.get(date) || 0;
    return {
      date,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      appointments: appts,
      receptionVisits: visits,
      total: appts + visits,
    };
  });

  // Revenue by day
  const billDayMap = sumByDay(billForSeries, 'billDate');
  const collectedDayMap = new Map();
  for (const p of payForSeries || []) {
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

  // Top departments
  const byDepartment = (deptGroups || []).map((d) => ({
    department: d.department || 'Unknown',
    appointments: d._count?.department || 0,
    revenue: 0,
  }));

  // Top doctors with name lookup
  const doctorIds = (doctorGroups || []).map((d) => d.doctorId).filter(Boolean);
  const doctorRows = doctorIds.length
    ? await prisma.doctor.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, specialization: true, user: { select: { name: true } } },
      })
    : [];
  const byDoctorId = new Map(doctorRows.map((d) => [d.id, d]));

  // Get doctor-level revenue
  const doctorRevenueResults = doctorIds.length
    ? await Promise.all(
        doctorIds.map((did) =>
          prisma.bill.aggregate({
            where: {
              billDate: { gte: from, lte: to },
              visitType: 'OPD',
              status: { not: 'CANCELLED' },
              appointment: { doctorId: did },
            },
            _sum: { totalAmount: true },
          }),
        ),
      )
    : [];

  const completedByDoctor = doctorIds.length
    ? await Promise.all(
        doctorIds.map((did) =>
          prisma.appointment.count({
            where: { ...apptWhere, doctorId: did, status: 'COMPLETED' },
          }),
        ),
      )
    : [];

  const doctorRevenueMap = new Map();
  doctorIds.forEach((id, i) => {
    doctorRevenueMap.set(id, toInt(doctorRevenueResults?.[i]?._sum?.totalAmount));
  });
  const completedMap = new Map();
  doctorIds.forEach((id, i) => {
    completedMap.set(id, completedByDoctor?.[i] || 0);
  });

  const topDoctors = (doctorGroups || []).map((d) => ({
    doctorId: d.doctorId,
    name: byDoctorId.get(d.doctorId)?.user?.name || '—',
    department: byDoctorId.get(d.doctorId)?.specialization || '',
    appointments: d._count?.doctorId || 0,
    completed: completedMap.get(d.doctorId) || 0,
    revenue: doctorRevenueMap.get(d.doctorId) || 0,
  }));

  // Top diagnoses
  const diagMap = new Map();
  for (const r of diagnosisRows || []) {
    const s = normalizeString(r.diagnosis);
    if (!s) continue;
    const k = s.toLowerCase();
    diagMap.set(k, { label: s, count: (diagMap.get(k)?.count || 0) + 1 });
  }
  const topDiagnoses = Array.from(diagMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top advised lab tests
  const topLabTests = (labTopAgg || []).map((t) => ({
    testName: t.testName || '—',
    count: t._count?.testName || 0,
  }));

  // Recent OPD activity (merged from both sources, sorted by date desc)
  const recentAppts = (apptForRecent || []).map((a) => ({
    at: a.date,
    patientName: a.patient?.name || '—',
    uhid: a.patient?.uhid || '—',
    doctorName: a.doctor?.user?.name || '—',
    department: a.department || '—',
    status: a.status,
    token: a.token || '',
    source: 'APPOINTMENT',
  }));
  const recentVisits = (visitForRecent || []).map((v) => ({
    at: v.visitDate,
    patientName: v.patient?.name || '—',
    uhid: v.patient?.uhid || '—',
    doctorName: v.doctorName || '—',
    department: v.department || '—',
    status: v.status,
    token: v.token || '',
    source: 'RECEPTION',
  }));
  const recentOpdActivity = [...recentAppts, ...recentVisits]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 20);

  const uniquePatientIds = new Set([
    ...(uniqueApptPidsQuery || []).map((x) => x.patientId),
    ...(uniqueVisitPidsQuery || []).map((x) => x.patientId),
  ]);
  const uniquePatients = uniquePatientIds.size;

  const opdToIpdConversionPct = completedConsultations > 0
    ? Math.round((referredForAdmit / completedConsultations) * 1000) / 10
    : 0;

  const visitCount = appointments + receptionVisits;
  const avgConsultationsPerDay = daysDiff > 0
    ? Math.round((consultationsWithDispo.length / daysDiff) * 10) / 10
    : 0;

  return res.json({
    range: { from: isoDayKey(from), to: isoDayKey(to) },
    summary: {
      totalOpdVisits: visitCount,
      appointmentsCount: appointments,
      receptionVisitsCount: receptionVisits,
      uniquePatients,
      completedConsultations,
      waitingNow: waitingApptsNow,
      inConsultationNow: inProgressApptsNow,
      referredForAdmit,
      opdToIpdConversionPct,
      opdRevenueBilled: opdBilled,
      opdRevenueCollected: opdCollected,
      opdRevenuePending: Math.max(0, opdPendingTotal),
      avgConsultationsPerDay,
      changeVsPrevPeriod: {
        visits: pctChange(prevAppts, appointments),
        revenue: pctChange(prevRevenue, opdBilled),
      },
    },
    statusBreakdown: {
      appointments: statusBreakdownAppts,
      receptionVisits: statusBreakdownVisits,
    },
    visitsByDay,
    revenueByDay,
    topDepartments: byDepartment,
    topDoctors,
    topDiagnoses,
    topAdvisedLabTests: topLabTests,
    recentOpdActivity,
  });
}

module.exports = { getOpdAnalytics };
