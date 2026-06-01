const { prisma } = require('../../../config/prisma');

// Keep admin dashboard bed counts aligned with beds module defaults.
// (Legacy "default ward/beds" are hidden in the app, so they should not affect stats.)
const LEGACY_WARD_NAME = 'Default Ward (temporary)';

function bedStatsWhereBase() {
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

function safeISOTime(t) {
  try {
    return new Date(t).toISOString();
  } catch {
    return null;
  }
}

function visitStatusLabel(v) {
  const s = String(v || '').toUpperCase();
  if (s === 'IN_CONSULTATION') return 'Consulting';
  if (s === 'ADMITTED') return 'Admitted';
  if (s === 'DISCHARGED') return 'Discharged';
  if (s === 'COMPLETED') return 'Completed';
  return 'Waiting';
}

function buildDayKeys(chartStart, days) {
  const keys = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(chartStart);
    d.setDate(chartStart.getDate() + i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function buildRevenueSeries(bills, dayKeys) {
  const opd = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  const ipd = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  for (const b of bills) {
    const key = new Date(b.billDate).toISOString().slice(0, 10);
    if (opd[key] === undefined) continue;
    const amt = Number(b.totalAmount) || 0;
    if (b.visitType === 'IPD') ipd[key] += amt;
    else opd[key] += amt;
  }
  const toRow = (date, revenue) => {
    const d = new Date(`${date}T12:00:00`);
    return {
      date,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue,
    };
  };
  return {
    opdSeries: dayKeys.map((date) => toRow(date, opd[date])),
    ipdSeries: dayKeys.map((date) => toRow(date, ipd[date])),
  };
}

async function getAdminOverview(req, res) {
  const now = new Date();
  const todayStart = toStartOfDay(now);
  const todayEnd = toEndOfDay(now);
  const chartDays = 14;
  const chartStart = new Date(todayStart);
  chartStart.setDate(chartStart.getDate() - (chartDays - 1));
  const dayKeys = buildDayKeys(chartStart, chartDays);

  const [
    totalPatients,
    opdToday,
    ipdActive,
    revenueTodayAgg,
    totalUsers,
    activeUsers,
    totalDoctors,
    activeDoctors,
    totalBeds,
    availableBeds,
    occupiedBeds,
    recentVisits,
    receptionOpdVisitsToday,
    admissionsToday,
    otAdmissionsToday,
    labResultsToday,
    billsTodayCount,
    labOrdersToday,
    consultationsToday,
    labPendingReports,
    billsForSeries,
    appointmentStatusGroups,
    receptionStatusGroups,
    doctorsSchedule,
  ] = await Promise.all([
    prisma.patient.count({}),
    prisma.appointment.count({ where: { date: { gte: todayStart, lte: todayEnd } } }),
    prisma.admission.count({
      where: { status: { in: ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'] } },
    }),
    prisma.billPayment.aggregate({ where: { createdAt: { gte: todayStart, lte: todayEnd } }, _sum: { amount: true } }),
    prisma.user.count({}),
    prisma.user.count({ where: { isActive: true } }),
    prisma.doctor.count({}),
    prisma.doctor.count({ where: { user: { isActive: true } } }),
    prisma.bed.count({ where: bedStatsWhereBase() }),
    prisma.bed.count({ where: { ...bedStatsWhereBase(), status: 'AVAILABLE' } }),
    prisma.bed.count({ where: { ...bedStatsWhereBase(), status: 'OCCUPIED' } }),
    prisma.receptionVisit.findMany({
      where: { visitDate: { gte: todayStart, lte: todayEnd } },
      orderBy: [{ createdAt: 'desc' }],
      take: 8,
      select: {
        id: true,
        token: true,
        status: true,
        doctorName: true,
        createdAt: true,
        patient: { select: { uhid: true, name: true, age: true } },
      },
    }),
    prisma.receptionVisit.count({
      where: { visitDate: { gte: todayStart, lte: todayEnd }, visitType: 'OPD' },
    }),
    prisma.admission.count({
      where: { admissionDate: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.admission.count({
      where: {
        admissionDate: { gte: todayStart, lte: todayEnd },
        OR: [
          { admissionType: { contains: 'OT', mode: 'insensitive' } },
          { admissionType: { contains: 'operation', mode: 'insensitive' } },
          { department: { contains: 'OT', mode: 'insensitive' } },
          { department: { contains: 'surgery', mode: 'insensitive' } },
        ],
      },
    }),
    prisma.labResult.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.bill.count({
      where: { billDate: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.labOrder.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.consultation.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.labOrder.count({
      where: { reportStatus: 'PENDING', status: { not: 'CANCELLED' } },
    }),
    prisma.bill.findMany({
      where: { billDate: { gte: chartStart, lte: todayEnd } },
      select: { billDate: true, visitType: true, totalAmount: true },
    }),
    prisma.appointment.groupBy({
      by: ['status'],
      where: { date: { gte: todayStart, lte: todayEnd } },
      _count: { id: true },
    }),
    prisma.receptionVisit.groupBy({
      by: ['status'],
      where: { visitDate: { gte: todayStart, lte: todayEnd }, visitType: 'OPD' },
      _count: { id: true },
    }),
    prisma.doctor.findMany({
      select: {
        id: true,
        specialization: true,
        phone: true,
        user: { select: { name: true, email: true, isActive: true } },
        availability: {
          select: { dayOfWeek: true, startTime: true, endTime: true, isAvailable: true },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: { user: { name: 'asc' } },
    }),
  ]);

  const revenueToday = revenueTodayAgg?._sum?.amount || 0;
  const { opdSeries, ipdSeries } = buildRevenueSeries(billsForSeries, dayKeys);

  const apptStatusMap = Object.fromEntries(
    (appointmentStatusGroups || []).map((g) => [String(g.status), g._count.id])
  );
  const opdAppointmentDonut = [
    { name: 'Completed', value: apptStatusMap.COMPLETED || 0, key: 'COMPLETED' },
    { name: 'Waiting', value: apptStatusMap.WAITING || 0, key: 'WAITING' },
    { name: 'In progress', value: apptStatusMap.IN_PROGRESS || 0, key: 'IN_PROGRESS' },
  ];

  const visitStatusMap = Object.fromEntries(
    (receptionStatusGroups || []).map((g) => [String(g.status), g._count.id])
  );
  const opdVisitDonut = [
    { name: 'Completed', value: visitStatusMap.COMPLETED || 0 },
    { name: 'Waiting', value: visitStatusMap.WAITING || 0 },
    { name: 'In consultation', value: visitStatusMap.IN_CONSULTATION || 0 },
    { name: 'Admitted', value: visitStatusMap.ADMITTED || 0 },
    { name: 'Active / discharged', value: (visitStatusMap.ACTIVE || 0) + (visitStatusMap.DISCHARGED || 0) },
  ];

  const doctorsOut = doctorsSchedule.map((d) => {
    const avail = (d.availability || [])
      .filter((a) => a.isAvailable)
      .map((a) => ({
        day: a.dayOfWeek,
        start: a.startTime,
        end: a.endTime,
      }));
    return {
      id: d.id,
      name: d.user?.name || '—',
      email: d.user?.email || null,
      active: d.user?.isActive !== false,
      specialization: d.specialization,
      phone: d.phone,
      availabilitySummary: avail.length
        ? avail.map((x) => `${x.day.slice(0, 3)} ${x.start}–${x.end}`).join(', ')
        : 'No slots marked available',
    };
  });

  const opdPatientsToday = opdToday + receptionOpdVisitsToday;

  return res.json({
    stats: {
      totalPatients,
      opdToday,
      receptionOpdVisitsToday,
      opdPatientsToday,
      ipdActive,
      admissionsToday,
      otAdmissionsToday,
      revenueToday,
      labResultsToday,
      billsTodayCount,
      labOrdersToday,
      consultationsToday,
      labPendingReports,
      doctors: { total: totalDoctors, active: activeDoctors, inactive: Math.max(0, totalDoctors - activeDoctors) },
      users: { total: totalUsers, active: activeUsers, inactive: Math.max(0, totalUsers - activeUsers) },
      beds: { total: totalBeds, available: availableBeds, occupied: occupiedBeds },
      labReports: { total: labResultsToday, pending: labPendingReports },
      pharmacyOrders: { total: billsTodayCount, lowStockAlerts: 0 },
    },
    charts: {
      opdRevenueByDay: opdSeries,
      ipdRevenueByDay: ipdSeries,
      opdAppointmentStatus: opdAppointmentDonut,
      opdVisitStatus: opdVisitDonut,
    },
    doctorsSchedule: doctorsOut,
    recentPatients: recentVisits.map((v) => ({
      id: v.patient?.uhid || v.id,
      name: v.patient?.name || '',
      age: v.patient?.age ?? null,
      doctor: v.doctorName || '—',
      status: visitStatusLabel(v.status),
      time: safeISOTime(v.createdAt),
      token: v.token || null,
    })),
  });
}

module.exports = { getAdminOverview };
