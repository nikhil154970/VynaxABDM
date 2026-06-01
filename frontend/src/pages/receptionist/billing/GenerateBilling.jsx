import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MdAdd,
  MdClose,
  MdDelete,
  MdCheckCircle,
  MdPrint,
  MdSearch,
  MdPerson,
  MdPayments,
  MdReceiptLong,
  MdRefresh,
  MdNotes,
  MdSummarize,
} from 'react-icons/md';
import api from '../../../utils/api';
import { printBillingSlip } from '../../../utils/printBillingSlip';
import { printPaymentAsBillingSlip } from '../../../utils/printPaymentAsBillingSlip';
import '../patients/PatientList.css';
import { isAyushmanSponsor, AYUSHMAN_BILLING_NOTICE, AYUSHMAN_PAYMENT_LABEL } from '../../../utils/ayushmanBilling';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const selectCls = 'pl-select w-full';

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function emptyLineItems() {
  return [{ id: newId(), name: '', quantity: 1, price: 0 }];
}

function mapSuggestedLine(row) {
  return {
    id: newId(),
    name: row.description,
    quantity: row.quantity,
    price: row.unitPrice,
  };
}

/** Build charge rows from `/receptionist/billing/context` (no hard-coded IPD/OPD dummy rows). */
function linesFromBillingContext(ctx, visitType) {
  if (!ctx) return emptyLineItems();
  if (visitType === 'IPD') {
    const rows = ctx.admission?.suggestedLineItems;
    if (Array.isArray(rows) && rows.length) return rows.map(mapSuggestedLine);
    return emptyLineItems();
  }
  const ap = ctx.appointment;
  const apFee = ap?.fee ?? 0;
  if (ap && apFee > 0) {
    return [
      {
        id: newId(),
        name: `Consultation (${ap.department || 'OPD'})`,
        quantity: 1,
        price: apFee,
      },
    ];
  }
  const v = ctx.latestOpdVisit;
  const reg = v?.registrationFee ?? 0;
  if (reg > 0) {
    const dept = v.department || 'OPD';
    return [{ id: newId(), name: `Registration / visit fee (${dept})`, quantity: 1, price: reg }];
  }
  return emptyLineItems();
}

function fmtPaymentAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function looksPaidAppointmentStatus(st) {
  const s = String(st || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return s === 'PAID';
}

function deriveOpdPrepaid(ctx) {
  if (!ctx) return { opdPaidAtBooking: false, appointmentPrepaidMode: null };
  if (ctx.isAyushman) return { opdPaidAtBooking: true, appointmentPrepaidMode: AYUSHMAN_PAYMENT_LABEL };
  const ap = ctx.appointment;
  const hasApptFee = (ap?.fee ?? 0) > 0;
  const apPrepaid =
    hasApptFee && (ap.isPaidAtBooking === true || looksPaidAppointmentStatus(ap.paymentStatus));
  if (apPrepaid) {
    return { opdPaidAtBooking: true, appointmentPrepaidMode: ap.paymentMode || 'Cash' };
  }
  const v = ctx.latestOpdVisit;
  const reg = v?.registrationFee ?? 0;
  const visitPaid =
    reg > 0 && (v.isPaidAtBooking === true || looksPaidAppointmentStatus(v.paymentStatus));
  /** Registration path only when consultation line comes from visit fee, not appointment fee. */
  if (visitPaid && !hasApptFee) {
    return { opdPaidAtBooking: true, appointmentPrepaidMode: v.paymentMode || 'Cash' };
  }
  return { opdPaidAtBooking: false, appointmentPrepaidMode: null };
}

function Section({ icon: Icon, title, subtitle, headerRight, children }) {
  return (
    <div className="w-full overflow-visible rounded-xl border border-gray-200/90 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight text-gray-900">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
          </div>
        </div>
        {headerRight}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

const lineTotal = (q, p) => Math.round(Number(q || 0) * Number(p || 0) * 100) / 100;

/** Net total for summary (same rules as `totals` useMemo). */
function computeTotalFromLineItems(itemsList, discountStr, taxPercentStr) {
  const subtotal = itemsList.reduce((s, it) => s + lineTotal(it.quantity, it.price), 0);
  const disc = Math.max(0, Number(discountStr) || 0);
  const afterDisc = Math.max(0, subtotal - disc);
  const tx = Math.max(0, Number(taxPercentStr) || 0);
  const taxAmt = Math.round(afterDisc * (tx / 100) * 100) / 100;
  return Math.round((afterDisc + taxAmt) * 100) / 100;
}

export default function GenerateBilling() {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [billingType, setBillingType] = useState('OPD');
  const [items, setItems] = useState(() => emptyLineItems());
  /** Last `/receptionist/billing/context` payload — used when switching OPD/IPD without re-fetching. */
  const [billingContext, setBillingContext] = useState(null);

  const [discount, setDiscount] = useState('0');
  const [taxPercent, setTaxPercent] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');

  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState('Pending');

  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const [successOpen, setSuccessOpen] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyBills, setHistoryBills] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [patientPayments, setPatientPayments] = useState([]);
  const [patientPaymentsLoading, setPatientPaymentsLoading] = useState(false);
  const [patientPaymentsErr, setPatientPaymentsErr] = useState('');
  const [editingBillId, setEditingBillId] = useState(null);

  // Note: Bill editing is triggered by loading a bill into the form (disabled in UI per requirements).

  const fetchPatientSuggestions = useCallback(async (q) => {
    setLoadingSearch(true);
    try {
      const res = await api.get('/receptionist/patients/search', { params: { q } });
      const list = (res.data?.items || [])
        .map((v) => ({
          patientId: v.patientId,
          uhid: v.uhid,
          name: v.name,
          mobile: v.phone,
          visitType: v.visitType === 'IPD' ? 'IPD' : 'OPD',
          doctorName: v.doctor || '—',
          sponsor: v.sponsor || '',
          isAyushman: v.isAyushman === true || isAyushmanSponsor(v.sponsor),
        }))
        .filter((r) => r.patientId);
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => fetchPatientSuggestions(q), 220);
    return () => clearTimeout(t);
  }, [searchQuery, fetchPatientSuggestions]);

  useEffect(() => {
    const uhid = location?.state?.uhid;
    if (!uhid) return;
    (async () => {
      try {
        const res = await api.get(`/receptionist/patients/${encodeURIComponent(uhid)}/details`);
        const d = res.data;
        const vt = d.visitType === 'IPD' ? 'IPD' : 'OPD';
        setBillingType(vt);
        setSearchQuery(`${d.name} · ${d.uhid}`);
        const ctxRes = await api.get('/receptionist/billing/context', { params: { patientId: d.id } });
        const ctx = ctxRes.data;
        setBillingContext(ctx);
        const prepaid = deriveOpdPrepaid(ctx);
        setSelectedPatient({
          patientId: d.id,
          uhid: d.uhid,
          name: d.name,
          mobile: d.phone,
          visitType: vt,
          doctorName: d.doctor || '—',
          appointmentId: ctx.appointment?.id || null,
          admissionId: ctx.admission?.id || null,
          wardName: ctx.admission?.wardName || '',
          bedCode: ctx.admission?.bedCode || '',
          admissionDate: ctx.admission?.admissionDate
            ? new Date(ctx.admission.admissionDate).toLocaleDateString('en-CA')
            : '',
          ipdId: ctx.admission?.ipdNumber || '',
          // Prepaid follows appointment/visit data even when patient card shows IPD — user may bill OPD separately.
          opdPaidAtBooking: prepaid.opdPaidAtBooking || Boolean(ctx.isAyushman),
          appointmentPrepaidMode: ctx.isAyushman ? AYUSHMAN_PAYMENT_LABEL : prepaid.appointmentPrepaidMode,
          sponsor: ctx.sponsor || d.sponsor || '',
          isAyushman: Boolean(ctx.isAyushman),
        });
        const lineItems0 = linesFromBillingContext(ctx, vt);
        setItems(lineItems0);
        if (ctx.isAyushman) {
          setPaymentStatus('Paid');
          setPaymentMode(AYUSHMAN_PAYMENT_LABEL);
          const total0 = computeTotalFromLineItems(lineItems0, '0', '0');
          setPaidAmount(String(total0));
        } else if (vt === 'IPD') {
          setDiscount(String(ctx.admission?.suggestedDiscount ?? 0));
          setPaidAmount('0');
          setPaymentStatus('Pending');
        } else {
          setDiscount('0');
          if (!prepaid.opdPaidAtBooking) {
            const total = computeTotalFromLineItems(lineItems0, '0', '0');
            if (total > 0) {
              setPaidAmount(String(total));
              setPaymentStatus('Paid');
            } else {
              setPaidAmount('0');
              setPaymentStatus('Pending');
            }
          } else {
            setPaidAmount('0');
            setPaymentStatus('Pending');
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [location?.state?.uhid]);

  const refreshPatientHistory = useCallback(async () => {
    const pid = selectedPatient?.patientId;
    const uhid = selectedPatient?.uhid;
    if (!pid) {
      setHistoryBills([]);
      setHistoryError('');
      setPatientPayments([]);
      setPatientPaymentsErr('');
      return;
    }
    setHistoryLoading(true);
    setPatientPaymentsLoading(true);
    setHistoryError('');
    setPatientPaymentsErr('');
    try {
      const [billsRes, payRes] = await Promise.all([
        uhid ? api.get('/receptionist/billing', { params: { q: uhid } }) : Promise.resolve({ data: { items: [] } }),
        api.get('/receptionist/billing/patient-payments', { params: { patientId: pid } }),
      ]);
      setHistoryBills(Array.isArray(billsRes.data?.items) ? billsRes.data.items : []);
      setPatientPayments(Array.isArray(payRes.data?.items) ? payRes.data.items : []);
    } catch {
      setHistoryError('Could not load bills');
      setPatientPaymentsErr('Could not load payments');
      setHistoryBills([]);
      setPatientPayments([]);
    } finally {
      setHistoryLoading(false);
      setPatientPaymentsLoading(false);
    }
  }, [selectedPatient?.patientId, selectedPatient?.uhid]);

  useEffect(() => {
    if (!selectedPatient?.patientId) {
      setHistoryBills([]);
      setHistoryError('');
      setPatientPayments([]);
      setPatientPaymentsErr('');
      return;
    }
    void refreshPatientHistory();
  }, [selectedPatient?.patientId, refreshPatientHistory]);

  /** Ayushman: bill with real charges; settlement = PAID BY AYUSHMAN. */
  useEffect(() => {
    if (!selectedPatient?.isAyushman) return;
    setPaymentStatus('Paid');
    setPaymentMode(AYUSHMAN_PAYMENT_LABEL);
  }, [selectedPatient?.isAyushman, selectedPatient?.patientId]);

  useEffect(() => {
    if (!selectedPatient?.isAyushman) return;
    const subtotal = items.reduce((s, it) => s + lineTotal(it.quantity, it.price), 0);
    const disc = Math.max(0, Number(discount) || 0);
    const afterDisc = Math.max(0, subtotal - disc);
    const tx = Math.max(0, Number(taxPercent) || 0);
    const taxAmt = Math.round(afterDisc * (tx / 100) * 100) / 100;
    const total = Math.round((afterDisc + taxAmt) * 100) / 100;
    setPaidAmount(String(total));
  }, [selectedPatient?.isAyushman, items, discount, taxPercent]);

  /** OPD: if fee was paid at appointment / registration, keep paid = total and pending = 0. */
  useEffect(() => {
    if (selectedPatient?.isAyushman) return;
    if (!selectedPatient?.opdPaidAtBooking || billingType !== 'OPD') return;
    const subtotal = items.reduce((s, it) => s + lineTotal(it.quantity, it.price), 0);
    const disc = Math.max(0, Number(discount) || 0);
    const afterDisc = Math.max(0, subtotal - disc);
    const tx = Math.max(0, Number(taxPercent) || 0);
    const taxAmt = Math.round(afterDisc * (tx / 100) * 100) / 100;
    const total = Math.round((afterDisc + taxAmt) * 100) / 100;
    setPaidAmount(String(total));
    setPaymentStatus('Paid');
    const m = selectedPatient.appointmentPrepaidMode;
    setPaymentMode(m && String(m).trim() ? m : 'Cash');
  }, [
    selectedPatient?.opdPaidAtBooking,
    selectedPatient?.appointmentPrepaidMode,
    billingType,
    items,
    discount,
    taxPercent,
  ]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + lineTotal(it.quantity, it.price), 0);
    const disc = Math.max(0, Number(discount) || 0);
    const afterDisc = Math.max(0, subtotal - disc);
    const tx = Math.max(0, Number(taxPercent) || 0);
    const taxAmt = Math.round(afterDisc * (tx / 100) * 100) / 100;
    const total = Math.round((afterDisc + taxAmt) * 100) / 100;
    const paid = selectedPatient?.isAyushman
      ? total
      : Math.max(0, Number(paidAmount) || 0);
    const pending = selectedPatient?.isAyushman
      ? 0
      : Math.max(0, Math.round((total - paid) * 100) / 100);
    return { subtotal, discount: disc, afterDisc, taxAmt, total, paid, pending, taxPercent: tx };
  }, [items, discount, taxPercent, paidAmount, selectedPatient?.isAyushman]);

  const priorOutstanding = useMemo(() => {
    if (billingType !== 'IPD') return 0;
    const out = billingContext?.admission?.priorIpdBills?.outstandingTotal;
    return Math.max(0, Number(out) || 0);
  }, [billingType, billingContext]);

  /** Same slip header/body as Generate bill print when UHID matches the selected patient card. */
  const slipEnrichFromPatient = useMemo(() => {
    if (!selectedPatient) return {};
    return {
      doctorName: selectedPatient.doctorName,
      wardName: selectedPatient.wardName,
      bedCode: selectedPatient.bedCode,
      ipdNumber: selectedPatient.ipdId,
    };
  }, [selectedPatient]);

  const addBillingItem = () => {
    setItems((prev) => [...prev, { id: newId(), name: '', quantity: 1, price: 0 }]);
  };

  const removeBillingItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const refreshIpdContext = useCallback(async () => {
    const pid = selectedPatient?.patientId;
    if (!pid) return;
    try {
      const ctxRes = await api.get('/receptionist/billing/context', { params: { patientId: pid } });
      const ctx = ctxRes.data;
      setBillingContext(ctx);
      if (billingType === 'IPD') {
        setItems(linesFromBillingContext(ctx, 'IPD'));
        setDiscount(String(ctx.admission?.suggestedDiscount ?? 0));
      }
    } catch {
      /* ignore */
    }
  }, [selectedPatient?.patientId, billingType]);

  const handleSelectPatient = async (p) => {
    setSearchQuery(`${p.name} · ${p.uhid}`);
    setDropdownOpen(false);
    setErrors({});
    setEditingBillId(null);
    const vt = p.visitType === 'IPD' ? 'IPD' : 'OPD';
    setBillingType(vt);
    try {
      const ctxRes = await api.get('/receptionist/billing/context', { params: { patientId: p.patientId } });
      const ctx = ctxRes.data;
      setBillingContext(ctx);
      const prepaid = deriveOpdPrepaid(ctx);
      const lineItems = linesFromBillingContext(ctx, vt);
      setSelectedPatient({
        ...p,
        appointmentId: ctx.appointment?.id || null,
        admissionId: ctx.admission?.id || null,
        wardName: ctx.admission?.wardName || '',
        bedCode: ctx.admission?.bedCode || '',
        admissionDate: ctx.admission?.admissionDate
          ? new Date(ctx.admission.admissionDate).toLocaleDateString('en-CA')
          : '',
        ipdId: ctx.admission?.ipdNumber || '',
        opdPaidAtBooking: prepaid.opdPaidAtBooking || Boolean(ctx.isAyushman),
        appointmentPrepaidMode: ctx.isAyushman ? AYUSHMAN_PAYMENT_LABEL : prepaid.appointmentPrepaidMode,
        sponsor: ctx.sponsor || p.sponsor || '',
        isAyushman: Boolean(ctx.isAyushman),
      });
      setEditingBillId(null);
      setItems(lineItems);
      if (ctx.isAyushman) {
        setPaymentStatus('Paid');
        setPaymentMode(AYUSHMAN_PAYMENT_LABEL);
        const total = computeTotalFromLineItems(lineItems, '0', taxPercent);
        setPaidAmount(String(total));
      } else if (vt === 'IPD') {
        setDiscount(String(ctx.admission?.suggestedDiscount ?? 0));
        setPaidAmount('0');
        setPaymentStatus('Pending');
      } else {
        setDiscount('0');
        if (!prepaid.opdPaidAtBooking) {
          const total = computeTotalFromLineItems(lineItems, '0', taxPercent);
          if (total > 0) {
            setPaidAmount(String(total));
            setPaymentStatus('Paid');
          } else {
            setPaidAmount('0');
            setPaymentStatus('Pending');
          }
        } else {
          setPaidAmount('0');
          setPaymentStatus('Pending');
        }
      }
    } catch {
      setBillingContext(null);
      setSelectedPatient({ ...p, appointmentId: null, admissionId: null, opdPaidAtBooking: false, appointmentPrepaidMode: null });
      setItems(emptyLineItems());
      setDiscount('0');
      setPaidAmount('0');
      setPaymentStatus('Pending');
    }
  };

  const resetAll = () => {
    setSelectedPatient(null);
    setSearchQuery('');
    setSuggestions([]);
    setDropdownOpen(false);
    setBillingType('OPD');
    setBillingContext(null);
    setItems(emptyLineItems());
    setDiscount('0');
    setTaxPercent('0');
    setPaidAmount('0');
    setPaymentMode('Cash');
    setPaymentStatus('Pending');
    setNotes('');
    setErrors({});
    setSuccess(null);
    setEditingBillId(null);
  };

  const buildPayload = () => ({
    patientId: selectedPatient?.patientId,
    visitType: billingType,
    appointmentId: selectedPatient?.appointmentId || undefined,
    admissionId: selectedPatient?.admissionId || undefined,
    discountAmount: Math.round(totals.discount),
    taxAmount: Math.round(totals.taxAmt),
    notes: notes || undefined,
    items: items.map((it) => ({
      name: it.name,
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
      unitPrice: Math.round(Number(it.price) || 0),
    })),
    initialPaid: Math.min(Math.round(totals.total), Math.max(0, Math.round(totals.paid))),
    initialPaymentMode: paymentMode,
  });

  const validate = () => {
    const e = {};
    if (!selectedPatient) e.patient = 'Select a patient';
    if (!items.length) e.items = 'Add at least one line item';
    items.forEach((it, i) => {
      if (!String(it.name || '').trim()) e[`item${i}`] = 'Item name required';
    });
    const paymentOnlyIpd =
      billingType === 'IPD' &&
      totals.total <= 0 &&
      priorOutstanding > 0 &&
      Math.max(0, Number(paidAmount) || 0) > 0;

    if (!paymentOnlyIpd) {
      if (items.some((it) => lineTotal(it.quantity, it.price) <= 0 && String(it.name || '').trim()))
        e.amounts = 'Enter quantity & price for all named items';
      if (totals.total <= 0) e.total = 'Total must be greater than zero';
    }

    return e;
  };

  const handleGenerateBill = async () => {
    setErrors({});
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSubmitting(true);
    try {
      const paymentOnlyIpd =
        billingType === 'IPD' &&
        totals.total <= 0 &&
        priorOutstanding > 0 &&
        Math.max(0, Number(paidAmount) || 0) > 0 &&
        !editingBillId;

      if (paymentOnlyIpd) {
        const bills = billingContext?.admission?.priorIpdBills?.bills || [];
        const pendingBills = bills.filter((b) => Math.max(0, Number(b?.pending) || 0) > 0);
        let remaining = Math.max(0, Math.round(Number(paidAmount) || 0));
        for (const b of pendingBills) {
          if (remaining <= 0) break;
          const canPay = Math.min(remaining, Math.max(0, Math.round(Number(b.pending) || 0)));
          if (canPay <= 0) continue;
          await api.post(`/receptionist/billing/${encodeURIComponent(b.id)}/payments`, {
            amount: canPay,
            mode: paymentMode,
            note: notes || null,
          });
          remaining -= canPay;
        }

        if (remaining > 0) {
          throw new Error('Payment amount exceeds pending outstanding.');
        }

        setSuccess({ kind: 'payment', billId: null, payload: { paidAmount, paymentMode, billingType } });
        setSuccessOpen(true);
        await refreshPatientHistory();
        if (selectedPatient?.patientId) {
          const ctxRes = await api.get('/receptionist/billing/context', { params: { patientId: selectedPatient.patientId } });
          setBillingContext(ctxRes.data);
        }
        return;
      }

      const payload = buildPayload();
      if (editingBillId) {
        const res = await api.put(`/receptionist/billing/${encodeURIComponent(editingBillId)}`, payload);
        const billId = res.data?.bill?.billNumber || null;
        setSuccess({ kind: 'bill', billId, payload });
      } else {
        const res = await api.post('/receptionist/billing', payload);
        setSuccess({ kind: 'bill', billId: res.data?.bill?.billNumber, payload });
      }
      setSuccessOpen(true);
      void refreshPatientHistory();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Could not create bill';
      setErrors({ submit: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!selectedPatient) return;
    const data = {
      visitType: billingType,
      billNumber: success?.billId || null,
      patientName: selectedPatient.name,
      uhid: selectedPatient.uhid,
      mobile: selectedPatient.mobile,
      doctorName: selectedPatient.doctorName,
      wardName: selectedPatient.wardName,
      bedCode: selectedPatient.bedCode,
      ipdNumber: selectedPatient.ipdId,
      createdAt: new Date().toISOString(),
      items: items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        total: lineTotal(it.quantity, it.price),
      })),
      totals,
      paymentMode,
      paymentStatus,
      notes,
    };
    printBillingSlip({ billId: success?.billId, data });
  };

  return (
    <div className="w-full bg-gray-50 pb-24">
      <form
        className="w-full max-w-none space-y-5 px-4 py-6 sm:px-6 lg:px-8 xl:px-10"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-8">
            <Section
              icon={MdPerson}
              title="Patient"
              headerRight={errors.patient ? <span className="text-xs font-extrabold text-red-600">{errors.patient}</span> : null}
            >
              <div className="relative z-30 w-full">
                <MdSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Name / UHID / Mobile (min 2 characters)"
                  className={`${inputCls} pl-9`}
                  disabled={Boolean(selectedPatient)}
                />
                {dropdownOpen && !selectedPatient && searchQuery.trim().length >= 2 ? (
                  <div className="absolute left-0 right-0 z-[100] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-gray-200/80 bg-white shadow-xl ring-1 ring-black/5">
                    <div className="flex justify-between border-b border-gray-100 bg-slate-50 px-4 py-2 text-[11px] font-bold text-gray-600">
                      <span>{loadingSearch ? 'Searching…' : `${suggestions.length} match(es)`}</span>
                      <button type="button" className="text-blue-700" onClick={() => setDropdownOpen(false)}>
                        Close
                      </button>
                    </div>
                    {loadingSearch ? (
                      <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
                    ) : suggestions.length ? (
                      suggestions.map((p) => (
                        <button
                          key={p.patientId}
                          type="button"
                          onClick={() => handleSelectPatient(p)}
                          className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition hover:bg-blue-50/70"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                            <MdPerson className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-extrabold text-gray-900">{p.name}</p>
                            <p className="truncate font-mono text-xs font-bold text-blue-600">{p.uhid}</p>
                            <p className="text-xs text-gray-500">{p.visitType} · {p.doctorName}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="py-8 text-center text-sm text-gray-500">No patients found</div>
                    )}
                  </div>
                ) : null}
              </div>

              {selectedPatient?.isAyushman ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                  {AYUSHMAN_BILLING_NOTICE}
                </p>
              ) : null}

              {selectedPatient ? (
                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Name</p>
                        <p className="font-extrabold text-gray-900">{selectedPatient.name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">UHID</p>
                        <p className="font-mono font-bold text-blue-700">{selectedPatient.uhid}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Visit / Doctor</p>
                        <p className="text-sm font-semibold text-gray-800">
                          <span className="rounded-md bg-white/80 px-2 py-0.5 font-extrabold text-blue-800 ring-1 ring-blue-100">
                            {selectedPatient.visitType}
                          </span>{' '}
                          · {selectedPatient.doctorName}
                        </p>
                      </div>
                      {selectedPatient.visitType === 'IPD' ? (
                        <>
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Ward / Bed</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {selectedPatient.wardName} · <span className="font-mono">{selectedPatient.bedCode}</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Admission</p>
                            <p className="text-sm text-gray-700">{selectedPatient.admissionDate || '—'}</p>
                          </div>
                          {selectedPatient.ipdId ? (
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">IPD</p>
                              <p className="font-mono text-sm font-bold text-gray-800">{selectedPatient.ipdId}</p>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={resetAll}
                      className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-extrabold text-blue-800 shadow-sm transition hover:bg-blue-50"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : null}
            </Section>

            {selectedPatient ? (
              <>
                {billingType === 'IPD' && billingContext?.admission ? (
                  <Section
                    icon={MdSummarize}
                    title="IPD · this admission"
                    headerRight={
                      <button
                        type="button"
                        onClick={refreshIpdContext}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        <MdRefresh className="h-4 w-4" /> Refresh
                      </button>
                    }
                  >
                    <div className="flex flex-col gap-4">
                      {billingContext.admission.ipdStaySummary ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Stay & tariff</p>
                          <dl className="mt-2 space-y-1.5 text-sm">
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-600">Billable days (today)</dt>
                              <dd className="font-extrabold text-slate-900">{billingContext.admission.ipdStaySummary.currentBillDays}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-600">Room days already invoiced</dt>
                              <dd className="font-extrabold text-slate-900">
                                {billingContext.admission.ipdStaySummary.billedRoomDays}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-600">Admission on bill</dt>
                              <dd className="font-extrabold text-slate-900">
                                {billingContext.admission.ipdStaySummary.billedAdmission ? 'Yes' : 'No'}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-600">Admission charge</dt>
                              <dd className="font-mono font-bold">
                                ₹{Number(billingContext.admission.ipdStaySummary.admissionCharge || 0).toLocaleString('en-IN')}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-600">Room / day</dt>
                              <dd className="font-mono font-bold">
                                ₹{Number(billingContext.admission.ipdStaySummary.roomChargePerDay || 0).toLocaleString('en-IN')}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3 border-t border-slate-200/80 pt-2">
                              <dt className="text-slate-700">Package at today (excl. discount)</dt>
                              <dd className="font-mono text-base font-extrabold text-blue-800">
                                ₹{Number(billingContext.admission.ipdStaySummary.expectedPackageSubtotal || 0).toLocaleString('en-IN')}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      ) : null}

                      {billingContext.admission.priorIpdBills ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">Admission bills</p>
                              <p className="mt-1 text-lg font-extrabold text-emerald-950">
                                Outstanding{' '}
                                <span className="font-mono">
                                  ₹{Number(billingContext.admission.priorIpdBills.outstandingTotal || 0).toLocaleString('en-IN')}
                                </span>
                              </p>
                              <p className="text-xs text-emerald-900/90">
                                Billed ₹{Number(billingContext.admission.priorIpdBills.totalBilled || 0).toLocaleString('en-IN')} · Paid ₹
                                {Number(billingContext.admission.priorIpdBills.totalPaid || 0).toLocaleString('en-IN')} ·{' '}
                                {billingContext.admission.priorIpdBills.count} bill(s)
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 max-h-48 overflow-auto rounded-lg border border-emerald-100 bg-white/90">
                            <table className="w-full text-left text-xs">
                              <thead className="sticky top-0 bg-emerald-50/95 text-emerald-900">
                                <tr>
                                  <th className="px-3 py-2">Bill</th>
                                  <th className="px-3 py-2 text-right">Total</th>
                                  <th className="px-3 py-2 text-right">Paid</th>
                                  <th className="px-3 py-2 text-right">Pending</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-50">
                                {(billingContext.admission.priorIpdBills.bills || []).map((b) => (
                                  <tr key={b.id}>
                                    <td className="px-3 py-2 font-mono font-bold text-emerald-950">{b.billNumber}</td>
                                    <td className="px-3 py-2 text-right font-semibold">
                                      ₹{Number(b.totalAmount || 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-3 py-2 text-right">₹{Number(b.paidAmount || 0).toLocaleString('en-IN')}</td>
                                    <td className="px-3 py-2 text-right font-extrabold text-amber-900">
                                      ₹{Number(b.pending || 0).toLocaleString('en-IN')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {Array.isArray(billingContext.admission.priorIpdBills.paymentHistory) &&
                          billingContext.admission.priorIpdBills.paymentHistory.length ? (
                            <div className="mt-4">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Payments</p>
                              <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-100 bg-white">
                                <table className="w-full text-left text-xs">
                                  <thead className="sticky top-0 bg-slate-50 text-slate-600">
                                    <tr>
                                      <th className="px-3 py-2">When</th>
                                      <th className="px-3 py-2">Bill</th>
                                      <th className="px-3 py-2">Mode</th>
                                      <th className="px-3 py-2 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {billingContext.admission.priorIpdBills.paymentHistory.map((p) => (
                                      <tr key={p.id}>
                                        <td className="px-3 py-2 text-slate-600">{fmtPaymentAt(p.at)}</td>
                                        <td className="px-3 py-2 font-mono text-slate-800">{p.billNumber}</td>
                                        <td className="px-3 py-2">{p.mode}</td>
                                        <td className="px-3 py-2 text-right font-extrabold text-slate-900">
                                          ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-slate-500">No payments yet.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </Section>
                ) : null}

                <Section icon={MdReceiptLong} title="Billing type">
                  <div className="flex flex-wrap gap-2">
                    {['OPD', 'IPD'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setBillingType(t);
                          setItems(linesFromBillingContext(billingContext, t));
                          setErrors({});
                          if (t === 'IPD') {
                            setDiscount(String(billingContext?.admission?.suggestedDiscount ?? 0));
                            setPaidAmount('0');
                            setPaymentStatus('Pending');
                            setSelectedPatient((prev) =>
                              prev ? { ...prev, opdPaidAtBooking: false, appointmentPrepaidMode: null } : prev,
                            );
                          } else {
                            setDiscount('0');
                            const prepaid = deriveOpdPrepaid(billingContext);
                            setSelectedPatient((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    opdPaidAtBooking: prepaid.opdPaidAtBooking,
                                    appointmentPrepaidMode: prepaid.appointmentPrepaidMode,
                                  }
                                : prev,
                            );
                            if (!prepaid.opdPaidAtBooking) {
                              const nextLines = linesFromBillingContext(billingContext, 'OPD');
                              const total = computeTotalFromLineItems(nextLines, '0', taxPercent);
                              if (total > 0) {
                                setPaidAmount(String(total));
                                setPaymentStatus('Paid');
                              } else {
                                setPaidAmount('0');
                                setPaymentStatus('Pending');
                              }
                            } else {
                              setPaidAmount('0');
                              setPaymentStatus('Pending');
                            }
                          }
                        }}
                        className={`rounded-xl border-2 px-4 py-2.5 text-sm font-extrabold transition ${
                          billingType === t
                            ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {t === 'OPD' ? 'OPD billing' : 'IPD billing'}
                      </button>
                    ))}
                  </div>
                </Section>

                <Section
                  icon={MdPayments}
                  title="Line items"
                  headerRight={
                    <button
                      type="button"
                      onClick={addBillingItem}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MdAdd className="h-4 w-4" /> Add row
                    </button>
                  }
                >
                  {errors.items || errors.amounts ? (
                    <p className="mb-3 text-xs font-bold text-red-600">{errors.items || errors.amounts}</p>
                  ) : null}
                  {billingType === 'IPD' && billingContext?.admission?.priorIpdBills && !billingContext.admission.priorIpdBills.allFullySettled ? (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                      Admission bills outstanding: ₹
                      {Number(billingContext.admission.priorIpdBills.outstandingTotal || 0).toLocaleString('en-IN')}
                    </div>
                  ) : null}
                  <div className="w-full overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-[#f8faff] text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          <th className="px-3 py-3 lg:px-4">Item name</th>
                          <th className="w-24 px-2 py-3">Qty</th>
                          <th className="w-28 px-2 py-3">Price (₹)</th>
                          <th className="w-28 px-2 py-3 text-right">Total</th>
                          <th className="w-14 px-2 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items.map((row, idx) => (
                          <tr key={row.id} className="transition hover:bg-slate-50/60">
                            <td className="px-3 py-2 align-top lg:px-4">
                              <input
                                value={row.name}
                                onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                className={inputCls}
                                placeholder="e.g. Consultation"
                                readOnly={false}
                                disabled={false}
                              />
                              {errors[`item${idx}`] ? (
                                <p className="mt-1 text-[10px] font-bold text-red-600">{errors[`item${idx}`]}</p>
                              ) : null}
                            </td>
                            <td className="px-2 py-2 align-top">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={row.quantity}
                                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                className={`${inputCls} text-center`}
                                readOnly={false}
                                disabled={false}
                              />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={row.price}
                                onChange={(e) => updateItem(idx, 'price', e.target.value)}
                                className={`${inputCls} text-center`}
                                readOnly={false}
                                disabled={false}
                              />
                            </td>
                            <td className="px-2 py-2 align-top text-right font-extrabold text-gray-900">
                              ₹{lineTotal(row.quantity, row.price).toLocaleString('en-IN')}
                            </td>
                            <td className="px-2 py-2 align-top">
                              <button
                                type="button"
                                onClick={() => removeBillingItem(idx)}
                                disabled={items.length <= 1}
                                className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-30"
                                title="Remove row"
                              >
                                <MdDelete className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>

                <Section icon={MdNotes} title="Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className={inputCls}
                    placeholder="Optional remarks…"
                  />
                </Section>
              </>
            ) : null}
          </div>

          {selectedPatient ? (
            <div className="space-y-5 xl:col-span-4">
              <div className="lg:sticky lg:top-4 lg:z-20 space-y-5">
                <Section icon={MdSummarize} title="Summary">
                  {selectedPatient?.opdPaidAtBooking && billingType === 'OPD' ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                      Already paid at booking — pending ₹0. Generate bill for records only.
                    </div>
                  ) : null}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-extrabold text-gray-900">₹{totals.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-extrabold text-gray-500">Discount (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-extrabold text-gray-500">Tax (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={taxPercent}
                        onChange={(e) => setTaxPercent(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    {totals.taxAmt > 0 ? (
                      <div className="flex justify-between text-emerald-800">
                        <span>Tax amount</span>
                        <span className="font-bold">₹{totals.taxAmt.toLocaleString('en-IN')}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-extrabold">
                      <span>Total</span>
                      <span className="text-blue-700">₹{totals.total.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-extrabold text-gray-500">Paid amount (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className={inputCls}
                        readOnly={Boolean(selectedPatient?.opdPaidAtBooking && billingType === 'OPD')}
                        disabled={Boolean(
                          selectedPatient?.isAyushman ||
                            (selectedPatient?.opdPaidAtBooking && billingType === 'OPD'),
                        )}
                      />
                      {selectedPatient?.isAyushman ? (
                        <p className="mt-1 text-xs font-bold text-emerald-800">{AYUSHMAN_PAYMENT_LABEL}</p>
                      ) : null}
                      {errors.paid ? <p className="mt-1 text-xs font-bold text-red-600">{errors.paid}</p> : null}
                    </div>
                    <div className="flex justify-between rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
                      <span className="font-extrabold text-amber-900">
                        {selectedPatient?.isAyushman
                          ? 'Patient due'
                          : billingType === 'IPD' && priorOutstanding > 0
                            ? 'Outstanding'
                            : 'Pending'}
                      </span>
                      <span className="font-mono text-lg font-extrabold text-amber-900">
                        {selectedPatient?.isAyushman
                          ? '₹0'
                          : `₹${(billingType === 'IPD' && priorOutstanding > 0 ? priorOutstanding : totals.pending).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    {errors.total ? <p className="text-xs font-bold text-red-600">{errors.total}</p> : null}
                  </div>
                </Section>

                <Section icon={MdPayments} title="Payment">
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[11px] font-extrabold text-gray-500">Payment mode</p>
                      {selectedPatient?.isAyushman ? (
                        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-900">
                          {AYUSHMAN_PAYMENT_LABEL}
                        </p>
                      ) : (
                      <div className="flex flex-wrap gap-2">
                        {['Cash', 'UPI', 'Card'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            disabled={Boolean(selectedPatient?.opdPaidAtBooking && billingType === 'OPD')}
                            onClick={() => setPaymentMode(m)}
                            className={`rounded-xl border-2 px-3 py-2 text-xs font-extrabold transition ${
                              paymentMode === m
                                ? 'border-blue-600 bg-blue-50 text-blue-800'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-extrabold text-gray-500">Payment status</label>
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className={selectCls}
                        disabled={Boolean(
                          selectedPatient?.isAyushman ||
                            (selectedPatient?.opdPaidAtBooking && billingType === 'OPD'),
                        )}
                      >
                        {['Paid', 'Partial', 'Pending'].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </Section>

                {errors.submit ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{errors.submit}</p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:flex-col">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleGenerateBill}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white shadow-md transition disabled:opacity-60 min-[480px]:flex-none min-[480px]:px-4"
                    style={{ background: 'linear-gradient(135deg, #065f46, #059669)' }}
                  >
                    <MdReceiptLong className="h-4 w-4" />
                    {editingBillId ? 'Update bill' : 'Generate bill'}
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-extrabold text-gray-600 transition hover:bg-gray-50 min-[480px]:flex-none min-[480px]:px-4"
                  >
                    <MdRefresh className="h-4 w-4" />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {selectedPatient ? (
          <div className="space-y-5">
            <Section
              icon={MdPayments}
              title="Payment history"
              subtitle="Each row is one amount received; print or save as PDF from the browser."
              headerRight={
                <div className="flex items-center gap-2">
                  {patientPaymentsLoading ? <span className="text-xs font-extrabold text-gray-500">Loading…</span> : null}
                  <button
                    type="button"
                    title="Refresh payments and bills"
                    onClick={() => void refreshPatientHistory()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
                  >
                    <MdRefresh className="h-4 w-4" />
                  </button>
                </div>
              }
            >
              {patientPaymentsErr ? <p className="mb-2 text-xs font-bold text-red-600">{patientPaymentsErr}</p> : null}
              {patientPayments.length ? (
                <div className="max-h-[min(420px,55vh)] overflow-auto rounded-xl border border-gray-100">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Date / time</th>
                        <th className="px-3 py-2 text-left">Bill</th>
                        <th className="px-3 py-2 text-left">Visit</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-left">Mode</th>
                        <th className="px-3 py-2 text-left">Note</th>
                        <th className="px-3 py-2 text-right">Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {patientPayments.map((row) => (
                        <tr key={row.id} className="hover:bg-blue-50/40 transition">
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">{fmtPaymentAt(row.paidAt)}</td>
                          <td className="px-3 py-2">
                            <p className="font-mono font-bold text-blue-700">{row.billNumber || row.billId}</p>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                row.visitType === 'IPD' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {row.visitType}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-extrabold">₹{Number(row.amount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2">{row.mode || '—'}</td>
                          <td className="max-w-[180px] truncate px-3 py-2 text-gray-600" title={row.note || ''}>
                            {row.note || '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                void (async () => {
                                  try {
                                    const enrich = selectedPatient?.uhid === row.uhid ? slipEnrichFromPatient : {};
                                    await printPaymentAsBillingSlip(row, enrich);
                                  } catch (err) {
                                    window.alert(err?.response?.data?.message || err?.message || 'Could not open slip');
                                  }
                                })();
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-800 transition hover:bg-blue-100"
                            >
                              <MdPrint className="h-3.5 w-3.5" />
                              Slip
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : patientPaymentsLoading ? (
                <p className="text-xs text-gray-500">Loading…</p>
              ) : (
                <p className="text-xs text-gray-500">No payments recorded yet for this patient.</p>
              )}
            </Section>

            <Section
              icon={MdReceiptLong}
              title="Bills"
              subtitle="Bill-level totals (all visits for this UHID)."
              headerRight={historyLoading ? <span className="text-xs font-extrabold text-gray-500">Loading…</span> : null}
            >
              {historyError ? <p className="mb-2 text-xs font-bold text-red-600">{historyError}</p> : null}
              {historyBills.length ? (
                <div className="max-h-[min(320px,45vh)] overflow-auto rounded-xl border border-gray-100">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Bill</th>
                        <th className="px-3 py-2 text-left">Visit</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right">Pending</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {historyBills.map((b) => (
                        <tr key={b.id} className="hover:bg-blue-50/40 transition">
                          <td className="px-3 py-2">
                            <p className="font-mono font-bold text-blue-700">{b.billNumber || b.id}</p>
                            <p className="text-[10px] text-gray-400">{b.date}</p>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                b.visitType === 'IPD' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {b.visitType}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-extrabold">₹{Number(b.total || 0).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right">₹{Number(b.paid || 0).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right font-extrabold text-amber-800">
                            ₹{Number(b.pending || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2">{b.paymentStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : historyLoading ? (
                <p className="text-xs text-gray-500">Loading…</p>
              ) : (
                <p className="text-xs text-gray-500">No bills found for this patient.</p>
              )}
            </Section>
          </div>
        ) : null}
      </form>

      {successOpen && success && selectedPatient
        ? createPortal(
            <div className="pl-modalOverlay" role="dialog" aria-modal="true">
              <div className="pl-modal pl-modalAnimate max-w-[640px]">
                <div className="pl-modalHeader">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {success.kind === 'payment' ? 'Payment recorded' : 'Bill generated'}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {selectedPatient.name} · {selectedPatient.uhid} · {billingType}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pl-modalClose"
                    onClick={() => setSuccessOpen(false)}
                    title="Close"
                  >
                    <MdClose className="h-5 w-5" />
                  </button>
                </div>

                <div className="pl-modalBody space-y-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-emerald-200">
                        <MdCheckCircle className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Success</p>
                        <p className="mt-0.5 font-extrabold text-gray-900">
                          {success.billId ? `Bill: ${success.billId}` : 'Bill created'}
                          {success.receiptId ? ` · Receipt: ${success.receiptId}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-emerald-900/80">
                          Total ₹{totals.total.toLocaleString('en-IN')} · Paid ₹{totals.paid.toLocaleString('en-IN')} · Pending ₹{totals.pending.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="pl-actionBtn pl-actionBtnPrimary" onClick={handlePrint}>
                      <MdPrint className="h-4 w-4" /> Print
                    </button>
                    <button
                      type="button"
                      className="pl-actionBtn"
                      onClick={() => {
                        setSuccessOpen(false);
                        navigate('/dashboard/reception/billing');
                      }}
                    >
                      All bills
                    </button>
                    <button
                      type="button"
                      className="pl-actionBtn"
                      onClick={() => {
                        setSuccessOpen(false);
                        setSuccess(null);
                        resetAll();
                      }}
                    >
                      New bill
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
