const AYUSHMAN_PAYMENT_LABEL = 'PAID BY AYUSHMAN';

function normalizeSponsor(sponsor) {
  return String(sponsor || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function isAyushmanSponsor(sponsor) {
  const s = normalizeSponsor(sponsor);
  return s === 'AYUSHMAN' || s === 'AYUSHMAN BHARAT' || s.includes('AYUSHMAN');
}

function sponsorDisplayLabel(sponsor) {
  return isAyushmanSponsor(sponsor) ? 'Ayushman' : '';
}

function applyAyushmanVisitBilling({ sponsor, registrationFee, paymentStatus, paymentMode }) {
  if (!isAyushmanSponsor(sponsor)) {
    return { registrationFee, paymentStatus, paymentMode };
  }
  return {
    registrationFee,
    paymentStatus: 'PAID',
    paymentMode: paymentMode || AYUSHMAN_PAYMENT_LABEL,
  };
}

function applyAyushmanAppointmentBilling({ sponsor, fee, paymentStatus, paymentMode }) {
  if (!isAyushmanSponsor(sponsor)) {
    return { fee, paymentStatus, paymentMode };
  }
  return {
    fee,
    paymentStatus: 'PAID',
    paymentMode: paymentMode || AYUSHMAN_PAYMENT_LABEL,
  };
}

function applyAyushmanAdmissionBilling({ sponsor, admissionCharge, roomChargePerDay, advance, paymentStatus, paymentMode }) {
  if (!isAyushmanSponsor(sponsor)) {
    return { admissionCharge, roomChargePerDay, advance, paymentStatus, paymentMode };
  }
  return {
    admissionCharge,
    roomChargePerDay,
    advance,
    paymentStatus: 'PAID',
    paymentMode: paymentMode || AYUSHMAN_PAYMENT_LABEL,
  };
}

async function getLatestPatientSponsor(db, patientId) {
  if (!patientId) return null;
  const visit = await db.receptionVisit.findFirst({
    where: { patientId },
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    select: { sponsor: true },
  });
  return visit?.sponsor || null;
}

async function loadAyushmanPatientIdSet(db, patientIds) {
  const set = new Set();
  const ids = [...new Set((patientIds || []).filter(Boolean))];
  if (!ids.length) return set;

  const visits = await db.receptionVisit.findMany({
    where: { patientId: { in: ids } },
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    select: { patientId: true, sponsor: true },
  });

  const seen = new Set();
  for (const v of visits) {
    if (seen.has(v.patientId)) continue;
    seen.add(v.patientId);
    if (isAyushmanSponsor(v.sponsor)) set.add(v.patientId);
  }
  return set;
}

function parseLineItemsAllowZero(raw) {
  const items = Array.isArray(raw) ? raw : [];
  const lines = [];
  for (const it of items) {
    const desc = String(it.description || it.name || '').trim();
    if (!desc) continue;
    const qtyRaw = Number(it.quantity);
    const qty = Number.isFinite(qtyRaw) && qtyRaw >= 1 ? Math.trunc(qtyRaw) : 1;
    const unit = Math.max(0, Math.round(Number(it.unitPrice ?? it.price) || 0));
    lines.push({
      description: desc,
      quantity: qty,
      unitPrice: unit,
      lineTotal: qty * unit,
    });
  }
  return lines;
}

function buildAyushmanBillLinesFromDescriptions(descriptions) {
  const names = (descriptions || []).map((d) => String(d || '').trim()).filter(Boolean);
  if (!names.length) {
    return [{ description: 'Medical services', quantity: 1, unitPrice: 0, lineTotal: 0 }];
  }
  return names.map((description) => ({
    description,
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0,
  }));
}

/** Full bill settlement under Ayushman — amounts stay on bill; patient due = 0. */
function createAyushmanBillTotals({ subtotalAmount = 0, discountAmount = 0, taxAmount = 0, totalAmount = 0 } = {}) {
  const total = Math.max(0, Math.round(Number(totalAmount) || 0));
  return {
    subtotalAmount: Math.max(0, Math.round(Number(subtotalAmount) || 0)),
    discountAmount: Math.max(0, Math.round(Number(discountAmount) || 0)),
    taxAmount: Math.max(0, Math.round(Number(taxAmount) || 0)),
    totalAmount: total,
    paidAmount: total,
    status: 'PAID',
    lastPaymentMode: AYUSHMAN_PAYMENT_LABEL,
  };
}

function rowBillTotal(row) {
  return Math.max(0, Number(row?.total ?? row?.totalAmount) || 0);
}

function applyAyushmanToBillRow(row) {
  if (!row) return row;
  const total = rowBillTotal(row);
  return {
    ...row,
    total,
    paid: total,
    pending: 0,
    paymentStatus: 'Paid',
    paymentMode: AYUSHMAN_PAYMENT_LABEL,
    paidByAyushman: true,
    isAyushman: true,
  };
}

function applyAyushmanToBillDetail(detail) {
  if (!detail) return detail;
  const total = rowBillTotal(detail);
  const paid = total;
  return {
    ...detail,
    ...applyAyushmanToBillRow({ ...detail, total }),
    subtotal: detail.subtotal ?? detail.subtotalAmount ?? 0,
    discount: detail.discount ?? detail.discountAmount ?? 0,
    tax: detail.tax ?? detail.taxAmount ?? 0,
    items: detail.items || [],
    payments: (detail.payments || []).map((p) => ({
      ...p,
      amount: p.amount > 0 ? p.amount : paid,
      mode: AYUSHMAN_PAYMENT_LABEL,
    })),
  };
}

function zeroSuggestedLines(lines) {
  return (lines || []).map((l) => ({
    ...l,
    unitPrice: 0,
    price: 0,
    lineTotal: 0,
  }));
}

function ayushmanPatientBillingSnapshot() {
  return { total: 0, paid: 0, pending: 0, lastPaymentDate: new Date(), paidByAyushman: true };
}

function zeroLabOrderLinesFromItems(items) {
  return (items || [])
    .map((it) => {
      const testName = String(it.testName || it.name || '').trim();
      if (!testName) return null;
      const qty = Math.max(1, it.quantity || 1);
      const price = Math.max(0, Math.round(Number(it.price ?? it.unitPrice) || 0));
      return {
        description: `Lab Test: ${testName}`,
        quantity: qty,
        unitPrice: price,
        lineTotal: price * qty,
        testName,
        price,
      };
    })
    .filter(Boolean);
}

module.exports = {
  AYUSHMAN_PAYMENT_LABEL,
  normalizeSponsor,
  isAyushmanSponsor,
  sponsorDisplayLabel,
  applyAyushmanVisitBilling,
  applyAyushmanAppointmentBilling,
  applyAyushmanAdmissionBilling,
  getLatestPatientSponsor,
  loadAyushmanPatientIdSet,
  parseLineItemsAllowZero,
  buildAyushmanBillLinesFromDescriptions,
  createAyushmanBillTotals,
  applyAyushmanToBillRow,
  applyAyushmanToBillDetail,
  zeroSuggestedLines,
  ayushmanPatientBillingSnapshot,
  zeroLabOrderLinesFromItems,
};
