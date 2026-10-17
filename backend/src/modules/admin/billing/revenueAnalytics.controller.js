const { prisma } = require('../../../config/prisma');

const REVENUE_CATEGORIES = ['OPD', 'IPD', 'LAB', 'OT', 'PHARMACY'];

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

function buildDayKeys(from, days) {
  const keys = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
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

function revenuePctChange(prev, curr) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function toInt(v) {
  return Math.round(Number(v || 0));
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

function billPaidFromRecord(b) {
  const paidRaw = Math.max(0, Number(b?.paidAmount) || 0);
  const payments = Array.isArray(b?.payments) ? b.payments : [];
  const paidByPayments = payments.reduce((s, p) => s + Math.max(0, Number(p?.amount) || 0), 0);
  return Math.max(paidRaw, paidByPayments);
}

const ACTIVE_BILL_STATUSES = { notIn: ['CANCELLED', 'DRAFT'] };

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
  payments: { select: { amount: true, mode: true } },
  patient: { select: { name: true, uhid: true } },
};

async function getRevenueAnalytics(req, res) {
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

  // Previous period (equal length)
  const prevTo = new Date(fromDate.getTime() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - daysDiff + 1);
  prevFrom.setHours(0, 0, 0, 0);

  // Monthly trend: last 6 months (always, independent of date filter)
  const monthKeys = [];
  for (let i = 5; i >= 0; i -= 1) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push({
      month: m.toISOString().slice(0, 7),
      label: m.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      from: toStartOfDay(m),
      to: toEndOfDay(new Date(m.getFullYear(), m.getMonth() + 1, 0)),
    });
  }

  // Pending aging: all non-cancelled bills with pending > 0
  const allPendingBills = await prisma.bill.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      id: true,
      billDate: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      payments: { select: { amount: true } },
    },
  });

  // Compute pending for current period
  const [currentData, prevData, ...monthData] = await Promise.all([
    computeRevenueForRange(fromDate, toDate),
    computeRevenueForRange(prevFrom, prevTo),
    ...monthKeys.map((mk) => computeRevenueForRange(mk.from, mk.to)),
  ]);

  const activeKeys =
    categoryFilter === 'ALL' || !REVENUE_CATEGORIES.includes(categoryFilter)
      ? REVENUE_CATEGORIES
      : [categoryFilter];

  // Summary
  const currTotal = sumStats(currentData.cats, activeKeys);
  const prevTotal = sumStats(prevData.cats, activeKeys);

  const totalBilled = currTotal.billed;
  const totalCollected = currTotal.collected;
  const totalPending = currTotal.pending;
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0;
  const transactionCount = currTotal.paymentCount;

  // Avg bill value across all categories in filter
  let allBillsInRange = [];
  if (categoryFilter === 'ALL' || !REVENUE_CATEGORIES.includes(categoryFilter)) {
    allBillsInRange = currentData.allBills || [];
  } else {
    allBillsInRange = (currentData.allBills || []).filter(
      (b) => categorizeHospitalBill(b) === categoryFilter,
    );
  }
  const billCountForAvg = allBillsInRange.length;
  const avgBillValue = billCountForAvg > 0 ? Math.round(totalBilled / billCountForAvg) : 0;

  // Category mix
  let categoryMix = REVENUE_CATEGORIES.map((key) => {
    const row = currentData.cats[key] || emptyStats();
    return {
      category: key === 'LAB' ? 'Lab' : key === 'OT' ? 'OT' : key === 'PHARMACY' ? 'Pharmacy' : key,
      categoryKey: key,
      billed: row.billed,
      collected: row.collected,
      pending: row.pending,
      sharePct: totalBilled > 0 ? Math.round((row.billed / totalBilled) * 1000) / 10 : 0,
      avgBill: row.count > 0 ? Math.round(row.billed / row.count) : 0,
      billCount: row.count,
    };
  });

  if (categoryFilter !== 'ALL' && REVENUE_CATEGORIES.includes(categoryFilter)) {
    categoryMix = categoryMix.filter((c) => c.categoryKey === categoryFilter);
  }

  // Payment mode breakdown
  const modeMap = new Map();
  for (const p of currentData.billPayments || []) {
    const mode = p.mode || 'Other';
    if (!modeMap.has(mode)) modeMap.set(mode, { amount: 0, count: 0 });
    const entry = modeMap.get(mode);
    entry.amount += toInt(p.amount);
    entry.count += 1;
  }
  for (const p of currentData.pharmPayments || []) {
    const mode = p.paymentMode || 'Other';
    if (!modeMap.has(mode)) modeMap.set(mode, { amount: 0, count: 0 });
    const entry = modeMap.get(mode);
    entry.amount += toInt(p.amount);
    entry.count += 1;
  }
  for (const p of currentData.shadowPayments || []) {
    const mode = p.mode || 'Other';
    if (!modeMap.has(mode)) modeMap.set(mode, { amount: 0, count: 0 });
    const entry = modeMap.get(mode);
    entry.amount += toInt(p.amount);
    entry.count += 1;
  }
  const totalPayments = totalCollected;
  const paymentModeBreakdown = Array.from(modeMap.entries())
    .map(([mode, vals]) => ({
      mode,
      amount: vals.amount,
      count: vals.count,
      sharePct: totalPayments > 0 ? Math.round((vals.amount / totalPayments) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Monthly trend
  const monthlyTrend = monthKeys.map((mk, i) => {
    const md = monthData[i] || { cats: buildCategoryMap(), allBills: [] };
    const ms = sumStats(md.cats, REVENUE_CATEGORIES);
    return {
      month: mk.month,
      label: mk.label,
      billed: ms.billed,
      collected: ms.collected,
    };
  });

  // Daily series
  const dayKeys = buildDayKeys(fromDate, daysDiff);
  const dailySeries = dayKeys.map((date) => {
    const d = new Date(`${date}T12:00:00`);
    let billed = 0;
    let collected = 0;
    for (const key of activeKeys) {
      billed += currentData.billedByDayCat[key]?.[date] || 0;
      collected += currentData.collectedByDayCat[key]?.[date] || 0;
    }
    return {
      date,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      billed,
      collected,
    };
  });

  // Pending aging: bills + direct OPD/IPD sources with outstanding balance
  const agingBuckets = [
    { bucket: '0-7 days', min: 0, max: 7, amount: 0, count: 0 },
    { bucket: '8-30 days', min: 8, max: 30, amount: 0, count: 0 },
    { bucket: '31-90 days', min: 31, max: 90, amount: 0, count: 0 },
    { bucket: '90+ days', min: 91, max: Infinity, amount: 0, count: 0 },
  ];

  for (const b of allPendingBills) {
    const pending = billPendingAmount(b);
    if (pending <= 0) continue;
    const ageDays = Math.max(0, Math.round((toDate - new Date(b.billDate)) / (1000 * 60 * 60 * 24)));
    for (const bucket of agingBuckets) {
      if (ageDays >= bucket.min && ageDays <= bucket.max) {
        bucket.amount += pending;
        bucket.count += 1;
        break;
      }
    }
  }

  const [pendingAppointments, pendingAdmissions] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        fee: { gt: 0 },
        paymentStatus: { not: 'PAID' },
        bills: { none: { status: ACTIVE_BILL_STATUSES } },
      },
      select: { fee: true, date: true },
    }),
    prisma.admission.findMany({
      where: {
        OR: [{ dischargeDate: null }, { dischargeDate: { gte: fromDate } }],
        billing: { isNot: null },
      },
      select: {
        admissionDate: true,
        dischargeDate: true,
        billing: {
          select: { admissionCharge: true, roomChargePerDay: true, advance: true, paymentStatus: true },
        },
        bills: {
          where: { status: ACTIVE_BILL_STATUSES },
          select: { totalAmount: true, paidAmount: true, payments: { select: { amount: true } } },
        },
      },
    }),
  ]);

  for (const ap of pendingAppointments) {
    const pending = toInt(ap.fee);
    if (pending <= 0) continue;
    const ageDays = Math.max(0, Math.round((toDate - new Date(ap.date)) / (1000 * 60 * 60 * 24)));
    for (const bucket of agingBuckets) {
      if (ageDays >= bucket.min && ageDays <= bucket.max) {
        bucket.amount += pending;
        bucket.count += 1;
        break;
      }
    }
  }

  for (const adm of pendingAdmissions) {
    const billing = adm.billing;
    if (!billing) continue;
    const asOf = adm.dischargeDate ? toEndOfDay(adm.dischargeDate) : toDate;
    const days = inclusiveDaysBetween(adm.admissionDate, asOf);
    const expected = toInt(billing.admissionCharge) + toInt(billing.roomChargePerDay) * days;
    let billTotal = 0;
    let billPaid = 0;
    for (const b of adm.bills) {
      billTotal += toInt(b.totalAmount);
      billPaid += billPaidFromRecord(b);
    }
    const unbilled = Math.max(0, expected - billTotal);
    const advancePaid = isPaidStatus(billing.paymentStatus) ? toInt(billing.advance) : 0;
    const pending = Math.max(0, unbilled - Math.max(0, Math.min(unbilled, advancePaid - billPaid)));
    if (pending <= 0) continue;
    const ageDays = Math.max(0, Math.round((toDate - new Date(adm.admissionDate)) / (1000 * 60 * 60 * 24)));
    for (const bucket of agingBuckets) {
      if (ageDays >= bucket.min && ageDays <= bucket.max) {
        bucket.amount += pending;
        bucket.count += 1;
        break;
      }
    }
  }

  return res.json({
    summary: {
      totalBilled,
      totalCollected,
      totalPending,
      collectionRate,
      avgBillValue,
      transactionCount,
      billedChange: revenuePctChange(prevTotal.billed, currTotal.billed),
      collectedChange: revenuePctChange(prevTotal.collected, currTotal.collected),
      pendingChange: revenuePctChange(prevTotal.pending, currTotal.pending),
    },
    categoryMix,
    paymentModeBreakdown,
    monthlyTrend,
    dailySeries,
    pendingAging: agingBuckets,
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      days: daysDiff,
      category: categoryFilter,
    },
  });
  } catch (e) {
    console.error('getRevenueAnalytics error:', e);
    return res.status(500).json({ message: 'Could not load revenue analytics' });
  }
}

// ─── Helpers ──────────────────────────────────────────────

function emptyStats() {
  return { billed: 0, collected: 0, pending: 0, count: 0, paymentCount: 0, pendingCount: 0 };
}

function buildCategoryMap() {
  return Object.fromEntries(REVENUE_CATEGORIES.map((k) => [k, emptyStats()]));
}

function sumStats(map, keys) {
  return keys.reduce(
    (acc, key) => {
      const row = map[key] || emptyStats();
      acc.billed += row.billed;
      acc.collected += row.collected;
      acc.pending += row.pending;
      acc.count += row.count;
      acc.paymentCount += row.paymentCount;
      acc.pendingCount += row.pendingCount;
      return acc;
    },
    emptyStats(),
  );
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
        pendingAmount: true,
        createdAt: true,
        patientName: true,
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
    const billed = toInt(b.totalAmount);
    const pending = billPendingAmount(b);
    cats[cat].billed += billed;
    cats[cat].pending += pending;
    cats[cat].count += 1;
    if (pending > 0) cats[cat].pendingCount += 1;
    const dayKey = new Date(b.billDate).toISOString().slice(0, 10);
    if (billedByDayCat[cat][dayKey] !== undefined) billedByDayCat[cat][dayKey] += billed;
  }

  for (const b of pharmBills) {
    const billed = toInt(b.grandTotal);
    const pending = toInt(b.pendingAmount);
    cats.PHARMACY.billed += billed;
    cats.PHARMACY.pending += pending;
    cats.PHARMACY.count += 1;
    if (pending > 0) cats.PHARMACY.pendingCount += 1;
    const dayKey = new Date(b.createdAt).toISOString().slice(0, 10);
    if (billedByDayCat.PHARMACY[dayKey] !== undefined) billedByDayCat.PHARMACY[dayKey] += billed;
  }

  for (const p of billPayments) {
    const cat = categorizeHospitalBill(p.bill);
    const amt = toInt(p.amount);
    cats[cat].collected += amt;
    cats[cat].paymentCount += 1;
    const dayKey = new Date(p.createdAt).toISOString().slice(0, 10);
    if (collectedByDayCat[cat][dayKey] !== undefined) collectedByDayCat[cat][dayKey] += amt;
  }

  for (const p of pharmPayments) {
    const amt = toInt(p.amount);
    cats.PHARMACY.collected += amt;
    cats.PHARMACY.paymentCount += 1;
    const dayKey = new Date(p.createdAt).toISOString().slice(0, 10);
    if (collectedByDayCat.PHARMACY[dayKey] !== undefined) collectedByDayCat.PHARMACY[dayKey] += amt;
  }

  const shadowPayments = await addDirectOpdIpdRevenue(
    fromDate,
    toDate,
    cats,
    billedByDayCat,
    collectedByDayCat,
  );

  return {
    cats,
    dayKeys,
    billedByDayCat,
    collectedByDayCat,
    allBills: hospitalBills,
    billPayments,
    pharmPayments,
    pharmBills,
    shadowPayments,
  };
}

/**
 * Revenue that lives outside the Bill table:
 * - OPD appointment consultation fees (Appointment.fee)
 * - OPD registration fees (ReceptionVisit.registrationFee)
 * - IPD room/admission accrual not yet on a formal Bill (AdmissionBilling)
 */
async function addDirectOpdIpdRevenue(fromDate, toDate, cats, billedByDayCat, collectedByDayCat) {
  const shadowPayments = [];

  const [appointments, visits, admissions] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        fee: { gt: 0 },
      },
      select: {
        id: true,
        fee: true,
        paymentStatus: true,
        paymentMode: true,
        date: true,
        createdAt: true,
        bills: { where: { status: ACTIVE_BILL_STATUSES }, select: { id: true } },
      },
    }),
    prisma.receptionVisit.findMany({
      where: {
        visitDate: { gte: fromDate, lte: toDate },
        registrationFee: { gt: 0 },
      },
      select: {
        registrationFee: true,
        paymentStatus: true,
        paymentMode: true,
        visitDate: true,
        createdAt: true,
      },
    }),
    prisma.admission.findMany({
      where: {
        admissionDate: { lte: toDate },
        OR: [{ dischargeDate: null }, { dischargeDate: { gte: fromDate } }],
        billing: { isNot: null },
      },
      select: {
        id: true,
        admissionDate: true,
        dischargeDate: true,
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
          select: {
            totalAmount: true,
            paidAmount: true,
            payments: { select: { amount: true } },
          },
        },
      },
    }),
  ]);

  for (const ap of appointments) {
    if (ap.bills.length > 0) continue;
    const fee = toInt(ap.fee);
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
      shadowPayments.push({ mode: ap.paymentMode || 'Cash', amount: paid });
    }
  }

  for (const v of visits) {
    const fee = toInt(v.registrationFee);
    const paid = isPaidStatus(v.paymentStatus) ? fee : 0;
    const pending = Math.max(0, fee - paid);
    cats.OPD.billed += fee;
    cats.OPD.collected += paid;
    cats.OPD.pending += pending;
    cats.OPD.count += 1;
    if (pending > 0) cats.OPD.pendingCount += 1;
    const billDay = calendarYmd(v.visitDate);
    if (billedByDayCat.OPD[billDay] !== undefined) billedByDayCat.OPD[billDay] += fee;
    if (paid > 0) {
      const payDay = calendarYmd(v.createdAt);
      if (collectedByDayCat.OPD[payDay] !== undefined) collectedByDayCat.OPD[payDay] += paid;
      shadowPayments.push({ mode: v.paymentMode || 'Cash', amount: paid });
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
    const expected = toInt(billing.admissionCharge) + toInt(billing.roomChargePerDay) * days;

    let billTotal = 0;
    let billPaid = 0;
    for (const b of adm.bills) {
      billTotal += toInt(b.totalAmount);
      billPaid += billPaidFromRecord(b);
    }

    const unbilled = Math.max(0, expected - billTotal);
    if (unbilled <= 0) continue;

    const advancePaid = isPaidStatus(billing.paymentStatus) ? toInt(billing.advance) : 0;
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
      shadowPayments.push({ mode: billing.paymentMode || 'Cash', amount: shadowCollected });
    }
  }

  return shadowPayments;
}

module.exports = { getRevenueAnalytics };
