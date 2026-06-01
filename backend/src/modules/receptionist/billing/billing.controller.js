const { prisma } = require('../../../config/prisma');
const {
  isAyushmanSponsor,
  sponsorDisplayLabel,
  getLatestPatientSponsor,
  loadAyushmanPatientIdSet,
  parseLineItemsAllowZero,
  buildAyushmanBillLinesFromDescriptions,
  createAyushmanBillTotals,
  applyAyushmanToBillRow,
  applyAyushmanToBillDetail,
  applyAyushmanVisitBilling,
  applyAyushmanAppointmentBilling,
  applyAyushmanAdmissionBilling,
} = require('../../../utils/ayushmanBilling');

function normalizeString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
}

let labTestsSupportCache = null;
function consultationSupportsLabTests() {
  if (labTestsSupportCache != null) return labTestsSupportCache;
  try {
    const model = prisma?._runtimeDataModel?.models?.Consultation;
    if (!model) {
      labTestsSupportCache = false;
      return labTestsSupportCache;
    }
    const fields = Array.isArray(model.fields) ? model.fields : Object.values(model.fields || {});
    labTestsSupportCache = fields.some((f) => f && f.name === 'labTests');
    return labTestsSupportCache;
  } catch {
    labTestsSupportCache = false;
    return labTestsSupportCache;
  }
}

function parseOptionalInt(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(Math.round(n));
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

function ymdFromDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function billDateToYmd(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function computeBillStatus(paid, total) {
  const p = Math.max(0, paid);
  const t = Math.max(0, total);
  if (t <= 0) return 'PAID';
  if (p <= 0) return 'PENDING';
  if (p >= t) return 'PAID';
  return 'PARTIAL';
}

function statusToUi(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return 'Paid';
  if (s === 'PARTIAL') return 'Partial';
  return 'Pending';
}

function uiStatusToEnum(label) {
  const s = normalizeString(label).toLowerCase();
  if (s === 'paid') return 'PAID';
  if (s === 'partial') return 'PARTIAL';
  if (s === 'pending') return 'PENDING';
  return null;
}

async function allocateNextBillNumber(tx, billDate) {
  const dayStart = toStartOfDay(billDate);
  const ymd = ymdFromDate(dayStart);
  if (!ymd) throw new Error('BILL_DATE_INVALID');
  const prefix = `BILL-${ymd}-`;
  const agg = await tx.bill.aggregate({
    where: { billNumber: { startsWith: prefix } },
    _max: { billNumber: true },
  });
  let next = 1;
  const maxStr = agg._max.billNumber;
  if (maxStr && String(maxStr).startsWith(prefix)) {
    const tail = String(maxStr).slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  if (next > 9999) throw new Error('BILL_NUMBER_EXHAUSTED');
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function mapVisitType(v) {
  const s = normalizeString(v).toUpperCase();
  if (s === 'IPD') return 'IPD';
  return 'OPD';
}

function isPaidStatus(v) {
  const s = String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return s === 'PAID';
}

/** Calendar date in local TZ (matches how appointment `date` is usually interpreted in the UI). */
function calendarYmd(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Pick the appointment that billing / OPD should follow — not simply `date DESC`,
 * or a future follow-up can hide today's paid booking.
 */
function pickAppointmentForBilling(recentRows) {
  if (!Array.isArray(recentRows) || !recentRows.length) return null;
  const todayYmd = calendarYmd(new Date());
  const todayRows = recentRows.filter((a) => calendarYmd(a.date) === todayYmd);
  const paidToday = todayRows.find((a) => isPaidStatus(a.paymentStatus));
  if (paidToday) return paidToday;
  if (todayRows.length) return todayRows[0];
  return recentRows[0];
}

/** Prefer today's OPD visit when inferring registration fee / payment (same as appointments). */
function pickOpdVisitForBilling(recentVisits) {
  if (!Array.isArray(recentVisits) || !recentVisits.length) return null;
  const todayYmd = calendarYmd(new Date());
  const todayRows = recentVisits.filter((v) => calendarYmd(v.visitDate) === todayYmd);
  const paidRegToday = todayRows.find((v) => isPaidStatus(v.paymentStatus));
  if (paidRegToday) return paidRegToday;
  if (todayRows.length) return todayRows[0];
  return recentVisits[0];
}

/** Calendar days from admission (inclusive) to today for room-charge math. */
function inclusiveAdmissionBillDays(admissionDate) {
  const a = toStartOfDay(new Date(admissionDate));
  const b = toStartOfDay(new Date());
  const diffDays = Math.floor((b.getTime() - a.getTime()) / 86400000);
  return Math.max(1, diffDays + 1);
}

function buildAdmissionSuggestedLines(admission) {
  const billing = admission.billing;
  if (!billing) return { lines: [], suggestedDiscount: 0 };
  const days = inclusiveAdmissionBillDays(admission.admissionDate);
  const ward = admission.ward?.name ? String(admission.ward.name) : '';
  const lines = [];
  if (billing.admissionCharge > 0) {
    lines.push({ description: 'Admission charge', quantity: 1, unitPrice: billing.admissionCharge });
  }
  if (billing.roomChargePerDay > 0) {
    const label = ward ? `Room charges (${days} day(s) · ${ward})` : `Room charges (${days} day(s))`;
    lines.push({ description: label, quantity: days, unitPrice: billing.roomChargePerDay });
  }
  const suggestedDiscount = Math.max(0, billing.advance || 0);
  return { lines, suggestedDiscount };
}

/**
 * Room days already invoiced (from line descriptions).
 * Admission line detection is secondary — caller should treat "any bill on this admission" as admission already used once.
 */
function aggregateBilledIpdPackageFromLineItems(allLineItems) {
  let admissionLineOnBill = false;
  let billedRoomDays = 0;
  if (!Array.isArray(allLineItems)) return { admissionLineOnBill, billedRoomDays };
  for (const li of allLineItems) {
    const desc = normalizeString(li.description);
    if (desc === 'Admission charge' || desc.startsWith('Admission charge')) admissionLineOnBill = true;
    if (desc.startsWith('Room charges')) {
      billedRoomDays += Math.max(0, parseOptionalInt(li.quantity) || 0);
    }
  }
  return { admissionLineOnBill, billedRoomDays };
}

/**
 * New charges only: admission line if never billed; room line for extra calendar days vs already-billed room days.
 */
function buildIncrementalIpdPackageLines(admission, billedAdmission, billedRoomDays) {
  const billing = admission.billing;
  if (!billing) return { lines: [], suggestedDiscount: 0 };
  const currentDays = inclusiveAdmissionBillDays(admission.admissionDate);
  const ward = admission.ward?.name ? String(admission.ward.name) : '';
  const lines = [];
  if (!billedAdmission && billing.admissionCharge > 0) {
    lines.push({ description: 'Admission charge', quantity: 1, unitPrice: billing.admissionCharge });
  }
  const extraDays = Math.max(0, currentDays - billedRoomDays);
  if (billing.roomChargePerDay > 0 && extraDays > 0) {
    const label = ward ? `Room charges (${extraDays} day(s) · ${ward})` : `Room charges (${extraDays} day(s))`;
    lines.push({ description: label, quantity: extraDays, unitPrice: billing.roomChargePerDay });
  }
  const suggestedDiscount =
    billedAdmission || billedRoomDays > 0 ? 0 : Math.max(0, billing.advance || 0);
  return { lines, suggestedDiscount };
}

function buildLabTestSuggestedLines(labTests) {
  if (!Array.isArray(labTests)) return [];
  return labTests
    .map((t) => {
      const name = normalizeString(t?.testName || t?.name);
      if (!name) return null;
      const quantity = Math.max(1, parseOptionalInt(t?.quantity) || 1);
      const unitPrice = Math.max(0, parseOptionalInt(t?.price ?? t?.unitPrice) || 0);
      return {
        description: `Lab Test: ${name}`,
        quantity,
        unitPrice,
      };
    })
    .filter(Boolean);
}

function extractLabTestsFromPrescription(prescription) {
  if (!Array.isArray(prescription)) return [];
  return prescription
    .map((p) => normalizeString(p?.labTest || p?.testName || p?.test || ''))
    .filter(Boolean)
    .map((name) => ({ testName: name, quantity: 1, price: 0 }));
}

function mapBillRow(b) {
  const pending = Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0));
  return {
    id: b.id,
    billNumber: b.billNumber,
    patientName: b.patient?.name || '',
    uhid: b.patient?.uhid || '',
    visitType: b.visitType === 'IPD' ? 'IPD' : 'OPD',
    total: b.totalAmount,
    paid: b.paidAmount,
    pending,
    paymentStatus: statusToUi(b.status),
    paymentMode: b.lastPaymentMode || '—',
    date: billDateToYmd(b.billDate),
  };
}

async function syncLinkedAppointment(tx, bill) {
  if (!bill.appointmentId) return;
  const paid = bill.paidAmount || 0;
  const total = bill.totalAmount || 0;
  const mode = normalizeString(bill.lastPaymentMode) || null;
  const paymentStatus = paid >= total ? 'PAID' : 'PENDING';
  await tx.appointment.update({
    where: { id: bill.appointmentId },
    data: {
      paymentStatus,
      ...(mode ? { paymentMode: mode } : {}),
    },
  });
}

async function syncAdmissionBillingRow(tx, bill) {
  if (!bill.admissionId) return;
  const paid = bill.paidAmount || 0;
  const total = bill.totalAmount || 0;
  const paymentStatus = paid >= total ? 'PAID' : 'PENDING';
  const mode = normalizeString(bill.lastPaymentMode) || undefined;
  await tx.admissionBilling.updateMany({
    where: { admissionId: bill.admissionId },
    data: {
      paymentStatus,
      ...(mode ? { paymentMode: mode } : {}),
    },
  });
}

function isDbUnavailableError(e) {
  const code = String(e?.code || '');
  // Prisma connection / db errors
  if (code === 'P1001' || code === 'P1002' || code === 'P1003' || code === 'P1017') return true;
  const msg = String(e?.message || '').toLowerCase();
  if (msg.includes("can't reach database server")) return true;
  if (msg.includes('connection') && msg.includes('timeout')) return true;
  if (msg.includes('terminating connection') || msg.includes('closed the connection')) return true;
  return false;
}

async function computeGlobalSummary() {
  try {
    const now = new Date();
    const todayStart = toStartOfDay(now);
    const todayEnd = toEndOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = toEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const [revToday, revMonth, paidCount, partialCount, pendingCount] = await Promise.all([
      prisma.billPayment.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      prisma.billPayment.aggregate({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.bill.count({ where: { status: 'PAID' } }),
      prisma.bill.count({ where: { status: 'PARTIAL' } }),
      prisma.bill.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      revenueToday: revToday._sum.amount || 0,
      revenueMonth: revMonth._sum.amount || 0,
      paidCount,
      partialCount,
      pendingCount,
    };
  } catch (e) {
    // Reception dashboard should not crash if DB is temporarily unreachable.
    if (isDbUnavailableError(e)) {
      return {
        revenueToday: 0,
        revenueMonth: 0,
        paidCount: 0,
        partialCount: 0,
        pendingCount: 0,
      };
    }
    throw e;
  }
}

async function listBills(req, res) {
  try {
    const qRaw = normalizeString(req.query.q);
    const visitFilter = normalizeString(req.query.visitType);
    const paymentStatusUi = normalizeString(req.query.paymentStatus);
    const statusEnum = uiStatusToEnum(paymentStatusUi);
    const paymentMode = normalizeString(req.query.paymentMode);
    const dateFrom = normalizeString(req.query.dateFrom);
    const dateTo = normalizeString(req.query.dateTo);

    const where = {};

    if (visitFilter && (visitFilter.toUpperCase() === 'OPD' || visitFilter.toUpperCase() === 'IPD')) {
      where.visitType = visitFilter.toUpperCase() === 'IPD' ? 'IPD' : 'OPD';
    }

    if (statusEnum) where.status = statusEnum;

    if (paymentMode) where.lastPaymentMode = paymentMode;

    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      const [yf, mf, df] = dateFrom.split('-').map((x) => Number(x));
      const d0 = new Date(yf, mf - 1, df);
      if (!Number.isNaN(d0.getTime())) where.billDate = { ...(where.billDate || {}), gte: toStartOfDay(d0) };
    }
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      const [yt, mt, dt] = dateTo.split('-').map((x) => Number(x));
      const d1 = new Date(yt, mt - 1, dt);
      if (!Number.isNaN(d1.getTime())) where.billDate = { ...(where.billDate || {}), lte: toEndOfDay(d1) };
    }

    if (qRaw) {
      where.OR = [
        { billNumber: { contains: qRaw, mode: 'insensitive' } },
        { patient: { name: { contains: qRaw, mode: 'insensitive' } } },
        { patient: { uhid: { contains: qRaw, mode: 'insensitive' } } },
      ];
    }

    const [items, summary] = await Promise.all([
      prisma.bill.findMany({
        where,
        orderBy: [{ billDate: 'desc' }, { createdAt: 'desc' }],
        take: 500,
        include: {
          patient: { select: { id: true, name: true, uhid: true } },
        },
      }),
      computeGlobalSummary(),
    ]);

    const ayushmanIds = await loadAyushmanPatientIdSet(
      prisma,
      items.map((b) => b.patient?.id).filter(Boolean),
    );

    return res.json({
      items: items.map((b) => {
        const row = mapBillRow(b);
        return ayushmanIds.has(b.patient?.id) ? applyAyushmanToBillRow(row) : row;
      }),
      summary,
    });
  } catch (e) {
    if (isDbUnavailableError(e)) {
      return res.json({
        items: [],
        summary: { revenueToday: 0, revenueMonth: 0, paidCount: 0, partialCount: 0, pendingCount: 0 },
        degraded: true,
        message: 'Billing summary temporarily unavailable',
      });
    }
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not load bills' });
  }
}

async function getBillDetail(req, res) {
  const id = normalizeString(req.params.id);
  if (!id) return res.status(400).json({ message: 'Bill id is required' });

  const b = await prisma.bill.findUnique({
    where: { id },
    include: {
      patient: { select: { name: true, uhid: true, mobile: true } },
      lineItems: { orderBy: { createdAt: 'asc' } },
      payments: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!b) return res.status(404).json({ message: 'Bill not found' });

  const sponsor = await getLatestPatientSponsor(prisma, b.patientId);
  const ayushman = isAyushmanSponsor(sponsor);
  const row = mapBillRow(b);
  const items = (b.lineItems || []).map((it) => ({
    name: it.description,
    qty: it.quantity,
    price: it.unitPrice,
    total: it.lineTotal,
  }));
  const payments = (b.payments || []).map((p) => ({
    date: p.createdAt.toISOString(),
    amount: p.amount,
    mode: p.mode,
    by: 'Reception',
  }));

  const payload = {
    ...row,
    notes: b.notes || '',
    subtotal: b.subtotalAmount,
    discount: b.discountAmount,
    tax: b.taxAmount,
    createdAt: b.billDate instanceof Date ? b.billDate.toISOString() : b.billDate,
    mobile: b.patient?.mobile || '',
    doctorName: '',
    sponsor,
    sponsorLabel: sponsorDisplayLabel(sponsor),
    isAyushman: ayushman,
    items,
    payments,
  };

  return res.json(ayushman ? applyAyushmanToBillDetail(payload) : payload);
}

async function getBillingContext(req, res) {
  const patientId = normalizeString(req.query.patientId);
  if (!patientId) return res.status(400).json({ message: 'patientId is required' });

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, name: true, uhid: true, mobile: true },
  });
  if (!patient) return res.status(404).json({ message: 'Patient not found' });

  const recentAppointments = await prisma.appointment.findMany({
    where: { patientId },
    orderBy: [{ createdAt: 'desc' }],
    take: 40,
    include: {
      doctor: { include: { user: { select: { name: true } } } },
    },
  });
  const appointment = pickAppointmentForBilling(recentAppointments);
  const latestConsultationForAppt = appointment?.id
    ? await prisma.consultation.findFirst({
        where: { patientId, appointmentId: appointment.id },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          createdAt: true,
          ...(consultationSupportsLabTests() ? { labTests: true } : {}),
          prescription: true,
          diagnosis: true,
          disposition: true,
        },
      })
    : null;
  const rawLabTests = consultationSupportsLabTests()
    ? latestConsultationForAppt?.labTests
    : extractLabTestsFromPrescription(latestConsultationForAppt?.prescription);
  const suggestedLabTests = buildLabTestSuggestedLines(rawLabTests);

  const recentOpdVisits = await prisma.receptionVisit.findMany({
    where: { patientId, visitType: 'OPD' },
    orderBy: [{ createdAt: 'desc' }],
    take: 30,
    select: {
      registrationFee: true,
      paymentStatus: true,
      paymentMode: true,
      department: true,
      doctorName: true,
      visitDate: true,
      sponsor: true,
    },
  });
  const latestOpdVisit = pickOpdVisitForBilling(recentOpdVisits);
  const sponsor = (await getLatestPatientSponsor(prisma, patientId)) || latestOpdVisit?.sponsor || '';
  const ayushman = isAyushmanSponsor(sponsor);

  const admission = await prisma.admission.findFirst({
    where: {
      patientId,
      dischargeDate: null,
      status: { in: ['ADMITTED', 'UNDER_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGE_REQUESTED'] },
    },
    orderBy: [{ admissionDate: 'desc' }],
    include: {
      ward: { select: { name: true } },
      bed: { select: { code: true } },
      billing: true,
    },
  });

  let ipdSuggest = admission ? buildAdmissionSuggestedLines(admission) : { lines: [], suggestedDiscount: 0 };
  let priorIpdBills = null;
  let ipdStaySummary = null;

  if (admission?.id) {
    const admissionBillsFull = await prisma.bill.findMany({
      where: { admissionId: admission.id, NOT: { status: 'CANCELLED' } },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        billNumber: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        createdAt: true,
        lineItems: { select: { description: true, quantity: true, lineTotal: true } },
        payments: { orderBy: { createdAt: 'asc' }, select: { id: true, amount: true, mode: true, createdAt: true, note: true } },
      },
    });

    const flatLines = admissionBillsFull.flatMap((b) => b.lineItems || []);
    const fromLines = aggregateBilledIpdPackageFromLineItems(flatLines);
    /** Admission fee is only on the first bill for this admission — any prior non-cancelled bill blocks it. */
    const billedAdmission = admissionBillsFull.length > 0 || fromLines.admissionLineOnBill;
    const billedRoomDays = fromLines.billedRoomDays;
    ipdSuggest = buildIncrementalIpdPackageLines(admission, billedAdmission, billedRoomDays);

    const currentBillDays = inclusiveAdmissionBillDays(admission.admissionDate);
    const br = admission.billing || {};
    const expectedRoom = Math.max(0, (br.roomChargePerDay || 0) * currentBillDays);
    const expectedAdmission = Math.max(0, br.admissionCharge || 0);
    ipdStaySummary = {
      currentBillDays,
      billedRoomDays,
      billedAdmission,
      admissionCharge: br.admissionCharge || 0,
      roomChargePerDay: br.roomChargePerDay || 0,
      advance: br.advance || 0,
      expectedPackageSubtotal: expectedAdmission + expectedRoom,
    };

    if (admissionBillsFull.length > 0) {
      const effectivePaid = (b) => {
        const paidRaw = Math.max(0, b?.paidAmount || 0);
        const payments = Array.isArray(b?.payments) ? b.payments : [];
        const paidByPayments = payments.reduce((s, p) => s + Math.max(0, p?.amount || 0), 0);
        return Math.max(paidRaw, paidByPayments);
      };
      const billPending = (b) => Math.max(0, (b?.totalAmount || 0) - effectivePaid(b));

      const outstandingTotal = admissionBillsFull.reduce(
        (s, b) => s + billPending(b),
        0,
      );
      const totalBilled = admissionBillsFull.reduce((s, b) => s + (b.totalAmount || 0), 0);
      const totalPaid = admissionBillsFull.reduce((s, b) => s + effectivePaid(b), 0);
      const allFullySettled = admissionBillsFull.every((b) => {
        const st = String(b.status || '').toUpperCase();
        return st === 'PAID' || effectivePaid(b) >= (b.totalAmount || 0);
      });
      const paymentHistory = [];
      for (const b of admissionBillsFull) {
        for (const p of b.payments || []) {
          paymentHistory.push({
            id: p.id,
            billId: b.id,
            billNumber: b.billNumber,
            amount: p.amount,
            mode: p.mode,
            at: p.createdAt,
            note: p.note,
          });
        }
      }
      paymentHistory.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      priorIpdBills = {
        count: admissionBillsFull.length,
        outstandingTotal,
        totalBilled,
        totalPaid,
        allFullySettled,
        lastBillNumber: admissionBillsFull[admissionBillsFull.length - 1]?.billNumber || null,
        bills: admissionBillsFull.map((b) => ({
          id: b.id,
          billNumber: b.billNumber,
          totalAmount: b.totalAmount,
          paidAmount: effectivePaid(b),
          pending: billPending(b),
          status: b.status,
          createdAt: b.createdAt,
        })),
        paymentHistory,
      };
    }
  }

  let apptPayload = appointment
    ? {
        id: appointment.id,
        fee: appointment.fee ?? 0,
        paymentStatus: appointment.paymentStatus,
        paymentMode: appointment.paymentMode,
        date: appointment.date,
        department: appointment.department,
        doctorName: appointment.doctor?.user?.name || '',
        isPaidAtBooking: (appointment.fee ?? 0) > 0 && isPaidStatus(appointment.paymentStatus),
      }
    : null;
  if (apptPayload && ayushman) {
    const a = applyAyushmanAppointmentBilling({
      sponsor,
      fee: apptPayload.fee,
      paymentStatus: apptPayload.paymentStatus,
      paymentMode: apptPayload.paymentMode,
    });
    apptPayload = {
      ...apptPayload,
      fee: a.fee,
      paymentStatus: a.paymentStatus,
      paymentMode: a.paymentMode,
      isPaidAtBooking: true,
    };
  }

  let visitPayload = latestOpdVisit
    ? {
        registrationFee: latestOpdVisit.registrationFee ?? 0,
        paymentStatus: latestOpdVisit.paymentStatus,
        paymentMode: latestOpdVisit.paymentMode,
        department: latestOpdVisit.department,
        doctorName: latestOpdVisit.doctorName,
        visitDate: latestOpdVisit.visitDate,
        isPaidAtBooking:
          (latestOpdVisit.registrationFee ?? 0) > 0 && isPaidStatus(latestOpdVisit.paymentStatus),
      }
    : null;
  if (visitPayload && ayushman) {
    const v = applyAyushmanVisitBilling({
      sponsor,
      registrationFee: visitPayload.registrationFee,
      paymentStatus: visitPayload.paymentStatus,
      paymentMode: visitPayload.paymentMode,
    });
    visitPayload = {
      ...visitPayload,
      registrationFee: v.registrationFee,
      paymentStatus: v.paymentStatus,
      paymentMode: v.paymentMode,
      isPaidAtBooking: true,
    };
  }

  if (ayushman && admission?.billing) {
    const ab = applyAyushmanAdmissionBilling({
      sponsor,
      admissionCharge: admission.billing.admissionCharge,
      roomChargePerDay: admission.billing.roomChargePerDay,
      advance: admission.billing.advance,
      paymentStatus: admission.billing.paymentStatus,
      paymentMode: admission.billing.paymentMode,
    });
    admission.billing = { ...admission.billing, ...ab };
  }
  if (ayushman && priorIpdBills?.bills) {
    priorIpdBills = {
      ...priorIpdBills,
      outstandingTotal: 0,
      allFullySettled: true,
      bills: priorIpdBills.bills.map((b) => {
        const mapped = applyAyushmanToBillRow({
          total: b.totalAmount,
          paid: b.paidAmount,
          pending: b.pending,
          paymentStatus: b.status,
        });
        return {
          ...b,
          paidAmount: mapped.paid,
          pending: mapped.pending,
          status: 'PAID',
        };
      }),
    };
  }

  const out = {
    patient: {
      id: patient.id,
      name: patient.name,
      uhid: patient.uhid,
      phone: patient.mobile || '',
    },
    sponsor,
    sponsorLabel: sponsorDisplayLabel(sponsor),
    isAyushman: ayushman,
    appointment: apptPayload,
    consultationLab: latestConsultationForAppt
      ? {
          consultationId: latestConsultationForAppt.id,
          consultationDate: latestConsultationForAppt.createdAt,
          disposition: latestConsultationForAppt.disposition,
          diagnosis: latestConsultationForAppt.diagnosis || '',
          suggestedLineItems: suggestedLabTests,
        }
      : null,
    latestOpdVisit: visitPayload,
    admission: admission
      ? {
          id: admission.id,
          ipdNumber: admission.ipdNumber,
          wardName: admission.ward?.name || '',
          bedCode: admission.bed?.code || admission.bedNumber || '',
          admissionDate: admission.admissionDate,
          billDays: inclusiveAdmissionBillDays(admission.admissionDate),
          suggestedLineItems: ipdSuggest.lines,
          suggestedDiscount: ipdSuggest.suggestedDiscount,
          ipdStaySummary,
          billing: admission.billing
            ? {
                admissionCharge: admission.billing.admissionCharge,
                roomChargePerDay: admission.billing.roomChargePerDay,
                advance: admission.billing.advance,
                paymentMode: admission.billing.paymentMode,
                paymentStatus: admission.billing.paymentStatus,
              }
            : null,
          priorIpdBills,
        }
      : null,
  };

  return res.json(out);
}

function parseLineItems(body) {
  const raw = Array.isArray(body.items) ? body.items : [];
  const lines = [];
  for (const it of raw) {
    const desc = normalizeString(it.description || it.name);
    if (!desc) continue;
    const qtyRaw = parseOptionalInt(it.quantity);
    const qty = qtyRaw == null || qtyRaw < 1 ? 1 : qtyRaw;
    const unit = Math.max(0, parseOptionalInt(it.unitPrice ?? it.price) ?? 0);
    const lineTotal = qty * unit;
    if (lineTotal <= 0) continue;
    lines.push({ description: desc, quantity: qty, unitPrice: unit, lineTotal });
  }
  return lines;
}

async function createBill(req, res) {
  const body = req.body || {};
  const patientId = normalizeString(body.patientId);
  if (!patientId) return res.status(400).json({ message: 'patientId is required' });

  const visitType = mapVisitType(body.visitType || body.billingType || 'OPD');
  const discountAmount = Math.max(0, parseOptionalInt(body.discountAmount ?? body.discount) ?? 0);
  const taxAmount = Math.max(0, parseOptionalInt(body.taxAmount ?? body.tax) ?? 0);
  const notes = normalizeString(body.notes) || null;
  const appointmentId = normalizeString(body.appointmentId) || null;
  const admissionId = normalizeString(body.admissionId) || null;
  const initialPaid = Math.max(0, parseOptionalInt(body.initialPaid ?? body.paid) ?? 0);
  const initialMode = normalizeString(body.initialPaymentMode || body.paymentMode) || 'Cash';

  const sponsor = await getLatestPatientSponsor(prisma, patientId);
  const ayushman = isAyushmanSponsor(sponsor);

  let lines = parseLineItems(body);
  if (ayushman && !lines.length) {
    lines = parseLineItemsAllowZero(body.items);
    if (!lines.length) {
      lines = buildAyushmanBillLinesFromDescriptions(
        (Array.isArray(body.items) ? body.items : []).map((it) => it.description || it.name),
      );
    }
  }
  if (!lines.length) return res.status(400).json({ message: 'At least one line item is required' });

  let subtotalAmount = lines.reduce((s, l) => s + l.lineTotal, 0);
  let totalAmount = Math.max(0, subtotalAmount - discountAmount + taxAmount);
  if (totalAmount <= 0) {
    return res.status(400).json({ message: 'Total must be greater than zero' });
  }

  let paid0 = Math.min(initialPaid, totalAmount);
  let status0 = computeBillStatus(paid0, totalAmount);
  let lastMode = paid0 > 0 ? initialMode : null;
  const discountFinal = discountAmount;
  const taxFinal = taxAmount;

  if (ayushman) {
    const z = createAyushmanBillTotals({
      subtotalAmount,
      discountAmount: discountFinal,
      taxAmount: taxFinal,
      totalAmount,
    });
    subtotalAmount = z.subtotalAmount;
    totalAmount = z.totalAmount;
    paid0 = z.paidAmount;
    status0 = z.status;
    lastMode = z.lastPaymentMode;
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const patient = await tx.patient.findUnique({ where: { id: patientId }, select: { id: true } });
        if (!patient) throw Object.assign(new Error('PATIENT_NOT_FOUND'), { code: 404 });

        if (appointmentId) {
          const ap = await tx.appointment.findFirst({
            where: { id: appointmentId, patientId },
            select: { id: true },
          });
          if (!ap) throw Object.assign(new Error('APPOINTMENT_NOT_FOUND'), { code: 400 });
        }
        if (admissionId) {
          const ad = await tx.admission.findFirst({
            where: { id: admissionId, patientId },
            select: { id: true },
          });
          if (!ad) throw Object.assign(new Error('ADMISSION_NOT_FOUND'), { code: 400 });
        }

        const billDate = body.billDate ? new Date(body.billDate) : new Date();
        if (Number.isNaN(billDate.getTime())) throw Object.assign(new Error('INVALID_BILL_DATE'), { code: 400 });

        const billNumber = await allocateNextBillNumber(tx, billDate);

        const bill = await tx.bill.create({
          data: {
            billNumber,
            patientId,
            visitType,
            status: status0,
            subtotalAmount,
            discountAmount: discountFinal,
            taxAmount: taxFinal,
            totalAmount,
            paidAmount: paid0,
            lastPaymentMode: lastMode,
            notes: ayushman ? `${notes ? `${notes} · ` : ''}PAID BY AYUSHMAN` : notes,
            appointmentId,
            admissionId,
            billDate,
            lineItems: {
              create: lines.map((l) => ({
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
              })),
            },
            ...(paid0 > 0
              ? {
                  payments: {
                    create: [
                      {
                        amount: paid0,
                        mode: ayushman ? lastMode : initialMode,
                        note: ayushman
                          ? normalizeString(body.paymentNote) || 'Ayushman Bharat'
                          : normalizeString(body.paymentNote) || null,
                      },
                    ],
                  },
                }
              : {}),
          },
          select: {
            id: true,
            billNumber: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
          },
        });

        const full = await tx.bill.findUnique({
          where: { id: bill.id },
          include: { patient: { select: { name: true, uhid: true } } },
        });

        await syncLinkedAppointment(tx, full);
        await syncAdmissionBillingRow(tx, full);

        return full;
      },
      { maxWait: 10000, timeout: 25000 },
    );

    const ayushmanIds = await loadAyushmanPatientIdSet(prisma, [patientId]);
    const row = ayushmanIds.has(patientId) ? applyAyushmanToBillRow(mapBillRow(result)) : mapBillRow(result);
    const receiptId =
      (result.paidAmount || 0) > 0
        ? `RCPT-${String(result.billNumber || '').replace(/\D/g, '').slice(-8)}${Date.now().toString(36).slice(-4)}`
        : null;

    return res.status(201).json({
      ok: true,
      bill: row,
      receiptId,
    });
  } catch (e) {
    if (e && e.message === 'PATIENT_NOT_FOUND') return res.status(404).json({ message: 'Patient not found' });
    if (e && e.message === 'APPOINTMENT_NOT_FOUND') return res.status(400).json({ message: 'Appointment not found for patient' });
    if (e && e.message === 'ADMISSION_NOT_FOUND') return res.status(400).json({ message: 'Admission not found for patient' });
    if (e && e.message === 'INVALID_BILL_DATE') return res.status(400).json({ message: 'Invalid billDate' });
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not create bill' });
  }
}

async function listPatientPayments(req, res) {
  const patientId = normalizeString(req.query.patientId);
  if (!patientId) return res.status(400).json({ message: 'patientId is required' });

  try {
    const rows = await prisma.billPayment.findMany({
      where: { bill: { patientId } },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        amount: true,
        mode: true,
        note: true,
        createdAt: true,
        bill: {
          select: {
            id: true,
            billNumber: true,
            visitType: true,
            patient: { select: { name: true, uhid: true } },
          },
        },
      },
    });

    const items = rows.map((r) => ({
      id: r.id,
      billId: r.bill.id,
      billNumber: r.bill.billNumber,
      visitType: r.bill.visitType,
      patientName: r.bill.patient?.name ?? '',
      uhid: r.bill.patient?.uhid ?? '',
      amount: r.amount,
      mode: r.mode,
      note: r.note,
      paidAt: r.createdAt,
    }));

    return res.json({ items });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not load payments' });
  }
}

async function addBillPayment(req, res) {
  const id = normalizeString(req.params.id);
  const body = req.body || {};
  const amount = parseOptionalInt(body.amount);
  const mode = normalizeString(body.mode || body.paymentMode) || 'Cash';
  const note = normalizeString(body.note) || null;

  if (!id) return res.status(400).json({ message: 'Bill id is required' });
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid amount is required' });

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const bill = await tx.bill.findUnique({
          where: { id },
          select: {
            id: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
            billNumber: true,
            payments: { select: { amount: true } },
          },
        });
        if (!bill) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });

        const paidRaw = Math.max(0, bill.paidAmount || 0);
        const paidByPayments = (bill.payments || []).reduce((s, p) => s + Math.max(0, p?.amount || 0), 0);
        const effectivePaid = Math.max(paidRaw, paidByPayments);
        const pending = Math.max(0, (bill.totalAmount || 0) - effectivePaid);
        const pay = Math.min(amount, pending);
        if (pay <= 0) throw Object.assign(new Error('NOTHING_TO_PAY'), { code: 400 });

        await tx.billPayment.create({
          data: { billId: bill.id, amount: pay, mode, note },
        });

        const paidAmount = effectivePaid + pay;
        const status = computeBillStatus(paidAmount, bill.totalAmount);

        const saved = await tx.bill.update({
          where: { id: bill.id },
          data: {
            paidAmount,
            status,
            lastPaymentMode: mode,
          },
          include: { patient: { select: { name: true, uhid: true } } },
        });

        await syncLinkedAppointment(tx, saved);
        await syncAdmissionBillingRow(tx, saved);

        return saved;
      },
      { maxWait: 10000, timeout: 25000 },
    );

    return res.json({
      ok: true,
      bill: mapBillRow(updated),
      receiptId: `RCPT-${String(updated.billNumber || '').replace(/\D/g, '').slice(-8)}${Date.now().toString(36).slice(-4)}`,
    });
  } catch (e) {
    if (e && e.message === 'NOT_FOUND') return res.status(404).json({ message: 'Bill not found' });
    if (e && e.message === 'NOTHING_TO_PAY') return res.status(400).json({ message: 'No pending balance on this bill' });
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ message: 'Could not record payment' });
  }
}

module.exports = {
  listBills,
  getBillDetail,
  getBillingContext,
  listPatientPayments,
  createBill,
  addBillPayment,
};
