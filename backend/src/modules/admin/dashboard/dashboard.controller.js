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

const REVENUE_CATEGORIES = ['OPD', 'IPD', 'LAB', 'OT', 'PHARMACY'];

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

function isLabRelatedBill(bill) {
  if (!bill) return false;
  if (Array.isArray(bill.labOrders) && bill.labOrders.length) return true;
  const notes = String(bill.notes || '').toLowerCase();
  if (notes.includes('lab order') || notes.includes('lab advice') || notes.includes('opd lab')) return true;
  const items = Array.isArray(bill.lineItems) ? bill.lineItems : [];
  return items.some((i) => /lab\s*test|laboratory/i.test(String(i.description || '')));
}

function isOtRelatedBill(bill) {
  if (!bill) return false;
  if (bill.otRequest) return true;
  const notes = String(bill.notes || '').toLowerCase();
  if (/\bot\b/.test(notes) || notes.includes('operation') || notes.includes('surgery')) return true;
  const items = Array.isArray(bill.lineItems) ? bill.lineItems : [];
  return items.some((i) => /\bot\b|operation|surgery/i.test(String(i.description || '')));
}

function categorizeHospitalBill(bill) {
  if (!bill) return 'OPD';
  if (isLabRelatedBill(bill)) return 'LAB';
  if (isOtRelatedBill(bill)) return 'OT';
  if (String(bill.visitType || '').toUpperCase() === 'IPD') return 'IPD';
  return 'OPD';
}

function billPaidFromRecord(b) {
  const paidRaw = Math.max(0, Number(b?.paidAmount) || 0);
  const payments = Array.isArray(b?.payments) ? b.payments : [];
  const paidByPayments = payments.reduce((s, p) => s + Math.max(0, Number(p?.amount) || 0), 0);
  return Math.max(paidRaw, paidByPayments);
}

function isPaidStatus(v) {
  const s = String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return s === 'PAID';
}

function calendarYmd(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function inclusiveDaysBetween(startDate, endDate) {
  const a = toStartOfDay(new Date(startDate));
  const b = toStartOfDay(new Date(endDate));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  const diff = Math.floor((b.getTime() - a.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

const ACTIVE_BILL_STATUSES = { notIn: ['CANCELLED', 'DRAFT'] };

function emptyCategoryStats() {
  return { billed: 0, collected: 0, pending: 0, count: 0, paymentCount: 0, pendingCount: 0 };
}

function buildCategoryMap() {
  return Object.fromEntries(REVENUE_CATEGORIES.map((k) => [k, emptyCategoryStats()]));
}

function sumCategoryStats(map, keys) {
  const safeMap = map || {};
  return keys.reduce(
    (acc, key) => {
      const row = safeMap[key] || emptyCategoryStats();
      acc.billed += row.billed;
      acc.collected += row.collected;
      acc.pending += row.pending;
      acc.count += row.count;
      acc.paymentCount += row.paymentCount;
      acc.pendingCount += row.pendingCount;
      return acc;
    },
    emptyCategoryStats(),
  );
}

function revenuePctChange(prev, curr) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function isDbUnavailableError(e) {
  const code = String(e?.code || '');
  if (code === 'P1001' || code === 'P1002' || code === 'P1003' || code === 'P1017') return true;
  const msg = String(e?.message || '').toLowerCase();
  if (msg.includes("can't reach database server")) return true;
  if (msg.includes('connection') && msg.includes('timeout')) return true;
  if (msg.includes('terminating connection') || msg.includes('closed the connection')) return true;
  return false;
}

function emptyAdminOverview() {
  return {
    stats: {
      totalPatients: 0,
      opdToday: 0,
      receptionOpdVisitsToday: 0,
      opdPatientsToday: 0,
      ipdActive: 0,
      admissionsToday: 0,
      otAdmissionsToday: 0,
      revenueToday: 0,
      labResultsToday: 0,
      billsTodayCount: 0,
      labOrdersToday: 0,
      consultationsToday: 0,
      labPendingReports: 0,
      doctors: { total: 0, active: 0, inactive: 0 },
      users: { total: 0, active: 0, inactive: 0 },
      beds: { total: 0, available: 0, occupied: 0 },
      labReports: { total: 0, pending: 0 },
      pharmacyOrders: { total: 0, lowStockAlerts: 0 },
      ot: {
        scheduledToday: 0,
        inProgress: 0,
        completedToday: 0,
        recoveryPatients: 0,
        totalEquipment: 0,
        allocatedEquipment: 0,
        totalConsumables: 0,
      },
    },
    charts: {
      opdRevenueByDay: [],
      ipdRevenueByDay: [],
      opdAppointmentStatus: [],
      opdVisitStatus: [],
    },
    doctorsSchedule: [],
    recentPatients: [],
  };
}

function emptyRevenueSnapshot(fromDate, toDate, categoryFilter) {
  return {
    summary: {
      totalCollected: 0,
      totalBilled: 0,
      totalPending: 0,
      collectedCount: 0,
      billedCount: 0,
      pendingCount: 0,
      collectedChange: 0,
      billedChange: 0,
    },
    categoryBreakdown: REVENUE_CATEGORIES.map((categoryKey) => ({
      category: categoryKey === 'LAB' ? 'Lab' : categoryKey === 'PHARMACY' ? 'Pharmacy' : categoryKey,
      categoryKey,
      billed: 0,
      collected: 0,
      pending: 0,
      count: 0,
      pendingCount: 0,
      pctChange: 0,
    })).filter((c) => categoryFilter === 'ALL' || c.categoryKey === categoryFilter),
    dailySeries: [],
    recentTransactions: [],
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      days: Math.max(1, Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1),
      category: categoryFilter,
    },
  };
}

async function computeRevenueForRange(fromDate, toDate) {
  const daysDiff = Math.max(1, Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1);
  const dayKeys = buildDayKeys(fromDate, daysDiff);
  const billedByDayCat = Object.fromEntries(
    REVENUE_CATEGORIES.map((c) => [c, Object.fromEntries(dayKeys.map((k) => [k, 0]))]),
  );
  const collectedByDayCat = Object.fromEntries(
    REVENUE_CATEGORIES.map((c) => [c, Object.fromEntries(dayKeys.map((k) => [k, 0]))]),
  );

  const billSelect = {
    id: true,
    billNumber: true,
    billDate: true,
    visitType: true,
    status: true,
    totalAmount: true,
    paidAmount: true,
    notes: true,
    lineItems: { select: { description: true } },
    labOrders: { select: { id: true } },
    otRequest: { select: { id: true } },
    payments: { select: { amount: true } },
    patient: { select: { name: true, uhid: true } },
  };

  const [hospitalBills, billPayments, pharmBills, pharmPayments] = await Promise.all([
    prisma.bill.findMany({
      where: { billDate: { gte: fromDate, lte: toDate }, status: ACTIVE_BILL_STATUSES },
      select: billSelect,
    }),
    prisma.billPayment.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate } },
      select: {
        id: true,
        amount: true,
        mode: true,
        createdAt: true,
        bill: { select: billSelect },
      },
    }),
    prisma.pharmacyBill.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate }, NOT: { status: 'CANCELLED' } },
      select: {
        id: true,
        billNumber: true,
        grandTotal: true,
        paidAmount: true,
        pendingAmount: true,
        createdAt: true,
        patientName: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.pharmacyPayment.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate } },
      select: {
        id: true,
        amount: true,
        paymentMode: true,
        createdAt: true,
        bill: { select: { billNumber: true, patientName: true } },
      },
    }),
  ]);

  const cats = buildCategoryMap();

  for (const b of hospitalBills) {
    const cat = categorizeHospitalBill(b);
    const billed = Math.round(Number(b.totalAmount) || 0);
    const pending = billPendingAmount(b);
    cats[cat].billed += billed;
    cats[cat].pending += pending;
    cats[cat].count += 1;
    if (pending > 0) cats[cat].pendingCount += 1;
    const billPaymentsArr = Array.isArray(b.payments) ? b.payments : [];
    if (billPaymentsArr.length === 0) {
      const directPaid = Math.max(0, Math.round(Number(b.paidAmount) || 0));
      cats[cat].collected += directPaid;
    }
    const dayKey = new Date(b.billDate).toISOString().slice(0, 10);
    if (billedByDayCat[cat][dayKey] !== undefined) billedByDayCat[cat][dayKey] += billed;
  }

  for (const b of pharmBills) {
    const billed = Math.round(Number(b.grandTotal) || 0);
    const pending = Math.round(Number(b.pendingAmount) || 0);
    cats.PHARMACY.billed += billed;
    cats.PHARMACY.pending += pending;
    cats.PHARMACY.count += 1;
    if (pending > 0) cats.PHARMACY.pendingCount += 1;
    const pharmPaymentsArr = Array.isArray(b.payments) ? b.payments : [];
    if (pharmPaymentsArr.length === 0) {
      const directPaid = Math.max(0, Math.round(Number(b.paidAmount) || 0));
      cats.PHARMACY.collected += directPaid;
    }
    const dayKey = new Date(b.createdAt).toISOString().slice(0, 10);
    if (billedByDayCat.PHARMACY[dayKey] !== undefined) billedByDayCat.PHARMACY[dayKey] += billed;
  }

  for (const p of billPayments) {
    const cat = categorizeHospitalBill(p.bill);
    const amt = Math.round(Number(p.amount) || 0);
    cats[cat].collected += amt;
    cats[cat].paymentCount += 1;
    const dayKey = new Date(p.createdAt).toISOString().slice(0, 10);
    if (collectedByDayCat[cat][dayKey] !== undefined) collectedByDayCat[cat][dayKey] += amt;
  }

  for (const p of pharmPayments) {
    const amt = Math.round(Number(p.amount) || 0);
    cats.PHARMACY.collected += amt;
    cats.PHARMACY.paymentCount += 1;
    const dayKey = new Date(p.createdAt).toISOString().slice(0, 10);
    if (collectedByDayCat.PHARMACY[dayKey] !== undefined) collectedByDayCat.PHARMACY[dayKey] += amt;
  }

  const shadowTx = await addDirectOpdIpdRevenue(fromDate, toDate, cats, billedByDayCat, collectedByDayCat, hospitalBills);

  const recentTransactions = [
    ...shadowTx,
    ...billPayments.map((p) => ({
      id: p.id,
      billNumber: p.bill?.billNumber || '—',
      patientName: p.bill?.patient?.name || '—',
      uhid: p.bill?.patient?.uhid || '—',
      category: categorizeHospitalBill(p.bill),
      visitType: p.bill?.visitType || '—',
      amount: Math.round(Number(p.amount) || 0),
      mode: p.mode,
      date: p.createdAt,
    })),
    ...pharmPayments.map((p) => ({
      id: p.id,
      billNumber: p.bill?.billNumber || '—',
      patientName: p.bill?.patientName || '—',
      uhid: '—',
      category: 'PHARMACY',
      visitType: 'PHARMACY',
      amount: Math.round(Number(p.amount) || 0),
      mode: p.paymentMode,
      date: p.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  return { cats, dayKeys, billedByDayCat, collectedByDayCat, recentTransactions };
}

async function addDirectOpdIpdRevenue(fromDate, toDate, cats, billedByDayCat, collectedByDayCat, hospitalBills) {
  const shadowTx = [];

  const [appointments, visits, admissions] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: fromDate, lte: toDate }, fee: { gt: 0 } },
      select: {
        id: true,
        fee: true,
        paymentStatus: true,
        paymentMode: true,
        date: true,
        createdAt: true,
        opdNumber: true,
        token: true,
        patient: { select: { name: true, uhid: true } },
        bills: { where: { status: ACTIVE_BILL_STATUSES }, select: { id: true } },
      },
    }),
    prisma.receptionVisit.findMany({
      where: { visitDate: { gte: fromDate, lte: toDate }, registrationFee: { gt: 0 } },
      select: {
        registrationFee: true,
        paymentStatus: true,
        paymentMode: true,
        visitDate: true,
        createdAt: true,
        patient: { select: { name: true, uhid: true } },
      },
    }),
    prisma.admission.findMany({
      where: {
        admissionDate: { lte: toDate },
        OR: [{ dischargeDate: null }, { dischargeDate: { gte: fromDate } }],
        billing: { isNot: null },
      },
      select: {
        admissionDate: true,
        dischargeDate: true,
        ipdNumber: true,
        patient: { select: { name: true, uhid: true } },
        billing: {
          select: {
            admissionCharge: true,
            roomChargePerDay: true,
            advance: true,
            paymentStatus: true,
            paymentMode: true,
            createdAt: true,
          },
        },
        bills: {
          where: { status: ACTIVE_BILL_STATUSES },
          select: { totalAmount: true, paidAmount: true, payments: { select: { amount: true } } },
        },
      },
    }),
  ]);

  for (const ap of appointments) {
    if (ap.bills.length > 0) continue;
    const fee = Math.round(Number(ap.fee) || 0);
    const paid = isPaidStatus(ap.paymentStatus) ? fee : 0;
    const pending = Math.max(0, fee - paid);
    cats.OPD.billed += fee;
    cats.OPD.collected += paid;
    cats.OPD.pending += pending;
    cats.OPD.count += 1;
    if (pending > 0) cats.OPD.pendingCount += 1;
    const billDay = calendarYmd(ap.date);
    if (billedByDayCat.OPD[billDay] !== undefined) billedByDayCat.OPD[billDay] += fee;
    if (paid > 0) {
      const payDay = calendarYmd(ap.createdAt);
      if (collectedByDayCat.OPD[payDay] !== undefined) collectedByDayCat.OPD[payDay] += paid;
      shadowTx.push({
        id: `appt-${ap.id}`,
        billNumber: ap.opdNumber || ap.token || 'APPT',
        patientName: ap.patient?.name || '—',
        uhid: ap.patient?.uhid || '—',
        category: 'OPD',
        visitType: 'OPD',
        amount: paid,
        mode: ap.paymentMode || 'Cash',
        date: ap.createdAt,
      });
    }
  }

  const billPatientUhidSet = new Set(
    (hospitalBills || []).map((b) => b.patient?.uhid).filter(Boolean)
  );

  for (const v of visits) {
    const fee = Math.round(Number(v.registrationFee) || 0);
    const paid = isPaidStatus(v.paymentStatus) ? fee : 0;
    const pending = Math.max(0, fee - paid);
    cats.OPD.billed += fee;
    if (!billPatientUhidSet.has(v.patient?.uhid)) {
      cats.OPD.collected += paid;
    }
    cats.OPD.pending += pending;
    cats.OPD.count += 1;
    if (pending > 0) cats.OPD.pendingCount += 1;
    const billDay = calendarYmd(v.visitDate);
    if (billedByDayCat.OPD[billDay] !== undefined) billedByDayCat.OPD[billDay] += fee;
    if (!billPatientUhidSet.has(v.patient?.uhid) && paid > 0) {
      const payDay = calendarYmd(v.createdAt);
      if (collectedByDayCat.OPD[payDay] !== undefined) collectedByDayCat.OPD[payDay] += paid;
      shadowTx.push({
        id: `visit-${payDay}-${v.patient?.uhid || 'reg'}`,
        billNumber: 'REG',
        patientName: v.patient?.name || '—',
        uhid: v.patient?.uhid || '—',
        category: 'OPD',
        visitType: 'OPD',
        amount: paid,
        mode: v.paymentMode || 'Cash',
        date: v.createdAt,
      });
    }
  }

  for (const adm of admissions) {
    const billing = adm.billing;
    if (!billing) continue;
    const asOf = adm.dischargeDate
      ? new Date(Math.min(toEndOfDay(adm.dischargeDate).getTime(), toDate.getTime()))
      : toDate;
    if (asOf < fromDate) continue;

    const days = inclusiveDaysBetween(adm.admissionDate, asOf);
    const expected = Math.round(Number(billing.admissionCharge) || 0)
      + Math.round(Number(billing.roomChargePerDay) || 0) * days;

    let billTotal = 0;
    let billPaid = 0;
    for (const b of adm.bills) {
      billTotal += Math.round(Number(b.totalAmount) || 0);
      billPaid += billPaidFromRecord(b);
    }

    const unbilled = Math.max(0, expected - billTotal);
    if (unbilled <= 0) continue;

    const advancePaid = isPaidStatus(billing.paymentStatus) ? Math.round(Number(billing.advance) || 0) : 0;
    const shadowCollected = Math.max(0, Math.min(unbilled, advancePaid - billPaid));
    const shadowPending = Math.max(0, unbilled - shadowCollected);

    cats.IPD.billed += unbilled;
    cats.IPD.collected += shadowCollected;
    cats.IPD.pending += shadowPending;
    cats.IPD.count += 1;
    if (shadowPending > 0) cats.IPD.pendingCount += 1;

    const billDay = calendarYmd(adm.admissionDate);
    if (billedByDayCat.IPD[billDay] !== undefined) billedByDayCat.IPD[billDay] += unbilled;
    if (shadowCollected > 0) {
      const payDay = calendarYmd(billing.createdAt);
      if (collectedByDayCat.IPD[payDay] !== undefined) collectedByDayCat.IPD[payDay] += shadowCollected;
      shadowTx.push({
        id: `ipd-${adm.ipdNumber || billDay}`,
        billNumber: adm.ipdNumber || 'IPD',
        patientName: adm.patient?.name || '—',
        uhid: adm.patient?.uhid || '—',
        category: 'IPD',
        visitType: 'IPD',
        amount: shadowCollected,
        mode: billing.paymentMode || 'Cash',
        date: billing.createdAt,
      });
    }
  }

  return shadowTx;
}

function buildDailySeries(dayKeys, billedByDayCat, collectedByDayCat, categoryKeys) {
  return dayKeys.map((date) => {
    const d = new Date(`${date}T12:00:00`);
    let billed = 0;
    let collected = 0;
    for (const key of categoryKeys) {
      billed += billedByDayCat[key]?.[date] || 0;
      collected += collectedByDayCat[key]?.[date] || 0;
    }
    return {
      date,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      billed,
      collected,
    };
  });
}

function categoryBreakdownFromMap(cats, prevCats) {
  const labels = { OPD: 'OPD', IPD: 'IPD', LAB: 'Lab', OT: 'OT', PHARMACY: 'Pharmacy' };
  return REVENUE_CATEGORIES.map((key) => {
    const row = cats[key] || emptyCategoryStats();
    const prev = prevCats[key] || emptyCategoryStats();
    return {
      category: labels[key] || key,
      categoryKey: key,
      billed: row.billed,
      collected: row.collected,
      pending: row.pending,
      count: row.count,
      pendingCount: row.pendingCount,
      pctChange: revenuePctChange(prev.billed, row.billed),
    };
  });
}

async function getAdminOverview(req, res) {
  try {
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
    todayRevenueData,
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
    otScheduledToday,
    otInProgress,
    otCompletedToday,
    totalEquipment,
    allocatedEquipmentCount,
    totalConsumables,
    recoveryPatients,
  ] = await Promise.all([
    prisma.patient.count({}),
    prisma.appointment.count({ where: { date: { gte: todayStart, lte: todayEnd } } }),
    prisma.admission.count({
      where: { status: { in: ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'] } },
    }),
    computeRevenueForRange(todayStart, todayEnd),
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
    prisma.surgerySchedule.count({
      where: { surgeryDate: { gte: todayStart, lte: todayEnd }, status: 'SCHEDULED' },
    }),
    prisma.surgerySchedule.count({
      where: { status: 'IN_PROGRESS' },
    }),
    prisma.surgerySchedule.count({
      where: { surgeryDate: { gte: todayStart, lte: todayEnd }, status: 'COMPLETED' },
    }),
    prisma.equipmentInventory.count({ where: { isActive: true } }),
    prisma.equipmentAllocation.count({ where: { returnedAt: null } }),
    prisma.consumableInventory.count({ where: { isActive: true } }),
    prisma.surgerySession.count({ where: { status: 'RECOVERY' } }),
  ]);

  const revenueToday = Math.round(sumCategoryStats(todayRevenueData?.cats, REVENUE_CATEGORIES).collected);
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
      ot: {
        scheduledToday: otScheduledToday,
        inProgress: otInProgress,
        completedToday: otCompletedToday,
        recoveryPatients,
        totalEquipment,
        allocatedEquipment: allocatedEquipmentCount,
        totalConsumables,
      },
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
  } catch (e) {
    if (isDbUnavailableError(e)) {
      console.error('[admin/dashboard/overview] database unavailable:', e.message);
      return res.json(emptyAdminOverview());
    }
    console.error('[admin/dashboard/overview] failed:', e);
    return res.status(500).json({ message: 'Failed to load dashboard' });
  }
}

async function getRevenueSnapshot(req, res) {
  try {
  const now = new Date();
  const rawFrom = req.query.from;
  const rawTo = req.query.to;
  const categoryFilter = String(req.query.category || 'ALL').toUpperCase();

  const toDate = rawTo ? toEndOfDay(new Date(rawTo)) : toEndOfDay(now);
  let fromDate;
  if (rawFrom) {
    fromDate = toStartOfDay(new Date(rawFrom));
  } else {
    fromDate = toStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  }
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return res.status(400).json({ message: 'Invalid date range' });
  }

  const daysDiff = Math.max(1, Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1);
  const prevTo = new Date(fromDate.getTime() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - daysDiff + 1);
  prevFrom.setHours(0, 0, 0, 0);

  const [current, previous] = await Promise.all([
    computeRevenueForRange(fromDate, toDate),
    computeRevenueForRange(prevFrom, prevTo),
  ]);

  const activeKeys =
    categoryFilter === 'ALL' || !REVENUE_CATEGORIES.includes(categoryFilter)
      ? REVENUE_CATEGORIES
      : [categoryFilter];

  const summaryStats = sumCategoryStats(current?.cats, activeKeys);
  const prevSummaryStats = sumCategoryStats(previous?.cats, activeKeys);

  let categoryBreakdown = categoryBreakdownFromMap(current?.cats || buildCategoryMap(), previous?.cats || buildCategoryMap());
  if (categoryFilter !== 'ALL' && REVENUE_CATEGORIES.includes(categoryFilter)) {
    categoryBreakdown = categoryBreakdown.filter((c) => c.categoryKey === categoryFilter);
  }

  const dailySeries = buildDailySeries(
    current.dayKeys,
    current.billedByDayCat,
    current.collectedByDayCat,
    activeKeys,
  );

  let recentTransactions = current.recentTransactions;
  if (categoryFilter !== 'ALL' && REVENUE_CATEGORIES.includes(categoryFilter)) {
    recentTransactions = recentTransactions.filter((tx) => tx.category === categoryFilter);
  }

  return res.json({
    summary: {
      totalCollected: summaryStats.collected,
      totalBilled: summaryStats.billed,
      totalPending: summaryStats.pending,
      collectedCount: summaryStats.paymentCount,
      billedCount: summaryStats.count,
      pendingCount: summaryStats.pendingCount,
      collectedChange: revenuePctChange(prevSummaryStats.collected, summaryStats.collected),
      billedChange: revenuePctChange(prevSummaryStats.billed, summaryStats.billed),
    },
    categoryBreakdown,
    dailySeries,
    recentTransactions,
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      days: daysDiff,
      category: categoryFilter,
    },
  });
  } catch (e) {
    if (isDbUnavailableError(e)) {
      console.error('[admin/dashboard/revenue-snapshot] database unavailable:', e.message);
      const now = new Date();
      const rawFrom = req.query.from;
      const rawTo = req.query.to;
      const categoryFilter = String(req.query.category || 'ALL').toUpperCase();
      const toDate = rawTo ? toEndOfDay(new Date(rawTo)) : toEndOfDay(now);
      const fromDate = rawFrom
        ? toStartOfDay(new Date(rawFrom))
        : toStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date range' });
      }
      return res.json(emptyRevenueSnapshot(fromDate, toDate, categoryFilter));
    }
    console.error('[admin/dashboard/revenue-snapshot] failed:', e);
    return res.status(500).json({ message: 'Could not load revenue analytics' });
  }
}

async function getCriticalAlerts(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';

  try {
    const alerts = await prisma.notification.findMany({
      where: {
        userId,
        type: 'ALERT',
        severity: 'CRITICAL',
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        message: true,
        readAt: true,
        createdAt: true,
      },
    });

    return res.json({ alerts });
  } catch (err) {
    console.error('Failed to get critical alerts:', err);
    return res.status(500).json({ message: 'Failed to fetch critical alerts' });
  }
}

async function markAlertRead(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  const id = req.params.id;
  if (!id) return res.status(400).json({ message: 'Alert ID is required' });

  try {
    const alert = await prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return res.json({ message: 'Alert marked as read', alert: updated });
  } catch (err) {
    console.error('Failed to mark alert as read:', err);
    return res.status(500).json({ message: 'Failed to mark alert as read' });
  }
}

async function markAllAlertsRead(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Access token required' });

  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        type: 'ALERT',
        severity: 'CRITICAL',
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return res.json({ message: 'All critical alerts marked as read' });
  } catch (err) {
    console.error('Failed to mark all alerts read:', err);
    return res.status(500).json({ message: 'Failed to mark all alerts read' });
  }
}

module.exports = {
  getAdminOverview,
  getRevenueSnapshot,
  getCriticalAlerts,
  markAlertRead,
  markAllAlertsRead,
};
