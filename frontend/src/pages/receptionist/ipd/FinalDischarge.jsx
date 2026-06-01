import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import './FinalDischarge.css';

function money(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN')}`;
}

function wardLine(ward) {
  if (!ward) return '—';
  const t = String(ward.type || '').toUpperCase();
  const cat = t === 'ICU' ? 'ICU' : t === 'PRIVATE' ? 'Private' : 'General';
  const name = String(ward.name || '').trim();
  return name ? `${name} (${cat})` : cat;
}

function billingFromClearances(clearances) {
  if (!clearances) return null;
  const cleared = Array.isArray(clearances.clearedBills) ? clearances.clearedBills : [];
  const blocking = Array.isArray(clearances.blockingBills) ? clearances.blockingBills : [];
  if (cleared.length === 0 && blocking.length === 0) return null;

  const lineItems = [];
  let n = 0;
  for (const bill of [...cleared, ...blocking]) {
    n += 1;
    const label =
      bill.billNumber != null && String(bill.billNumber).trim() !== ''
        ? String(bill.billNumber).trim()
        : `— (${n})`;
    lineItems.push({
      category: 'Bill',
      description: `Bill ${label}${bill.visitType ? ` · ${bill.visitType}` : ''}`,
      amount: Math.max(0, Number(bill.totalAmount) || 0),
    });
  }

  const totalBill = lineItems.reduce((s, x) => s + x.amount, 0);
  const pendingAmount = Math.max(0, Number(clearances.totalPatientBillingPending) || 0);
  const paidAmount = Math.max(0, totalBill - pendingAmount);

  return { lineItems, billing: { totalBill, paidAmount, pendingAmount }, billingSource: 'bills' };
}

function buildPatientFromAdmission(adm, clearances) {
  if (!adm) return null;
  if (String(adm.status || '').toUpperCase() !== 'DISCHARGE_REQUESTED') return null;

  const b = adm.billing || {};
  const admissionCharge = Math.max(0, Number(b.admissionCharge) || 0);
  const roomPerDay = Math.max(0, Number(b.roomChargePerDay) || 0);
  const advance = Math.max(0, Number(b.advance) || 0);
  const admDate = adm.admissionDate ? new Date(adm.admissionDate) : new Date();
  const days = Math.max(1, Math.ceil((Date.now() - admDate.getTime()) / 86400000));
  const roomTotal = roomPerDay * days;
  const estimateLineItems = [
    { category: 'Admission', description: 'Admission charges', amount: admissionCharge },
    { category: 'Bed & Room', description: `Stay estimate (${days} day(s)) × daily room rate`, amount: roomTotal },
  ];
  const estimateTotal = estimateLineItems.reduce((s, x) => s + x.amount, 0);
  const estimatePending = Math.max(0, estimateTotal - advance);

  const fromBills = billingFromClearances(clearances);
  const lineItems = fromBills?.lineItems ?? estimateLineItems;
  let billing =
    fromBills?.billing ?? { totalBill: estimateTotal, paidAmount: advance, pendingAmount: estimatePending };
  const billingSource = fromBills?.billingSource ?? 'estimate';

  if (clearances) {
    const p = Math.max(0, Number(clearances.totalPatientBillingPending) || 0);
    const total = Math.max(0, Number(billing.totalBill) || 0);
    billing = { totalBill: total, pendingAmount: p, paidAmount: Math.max(0, total - p) };
  }

  if (clearances && (clearances.billingClearance === true || clearances.allClear === true)) {
    const total = Math.max(0, Number(billing.totalBill) || 0);
    billing = { totalBill: total, pendingAmount: 0, paidAmount: total };
  }

  return {
    id: adm.id,
    name: adm.patient?.name || '',
    uhid: adm.patient?.uhid || '',
    ward: wardLine(adm.ward),
    bed: adm.bed?.code || '—',
    doctor: adm.doctor?.user?.name || '—',
    nurse: adm.nurse?.name || adm.nurse?.email || '—',
    lineItems,
    billing,
    billingSource,
    dischargeStatus: null,
    dischargeSummaryGenerated: false,
    bedFreed: false,
    dischargedAt: null,
  };
}

export default function FinalDischarge() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [clearances, setClearances] = useState(null);
  const [savedSummary, setSavedSummary] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dischargeWithDuesAck, setDischargeWithDuesAck] = useState(false);

  useEffect(() => {
    setDischargeWithDuesAck(false);
    let alive = true;
    (async () => {
      if (!id) {
        setPatient(null);
        setClearances(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError('');
      try {
        const [admRes, clrRes] = await Promise.all([
          api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}`),
          api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}/discharge-clearances`),
        ]);
        if (!alive) return;
        const adm = admRes?.data?.admission;
        const clr = clrRes?.data;
        const row = buildPatientFromAdmission(adm, clr);
        if (!row) {
          setPatient(null);
          setClearances(null);
          setLoadError('Patient not found or not in nurse-approved discharge status.');
        } else {
          setPatient(row);
          setClearances(clr || null);
        }
      } catch (e) {
        if (!alive) return;
        setPatient(null);
        setClearances(null);
        setLoadError(e?.response?.data?.message || e?.message || 'Could not load admission');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    try {
      const raw = sessionStorage.getItem(`dse:${encodeURIComponent(id)}`);
      if (!raw) { setSavedSummary(null); return; }
      const parsed = JSON.parse(raw);
      setSavedSummary(parsed?.summary || null);
    } catch {
      setSavedSummary(null);
    }
  }, [id]);

  const pending = patient ? Math.max(0, Number(patient.billing.pendingAmount) || 0) : 0;
  const financialGate = Boolean(clearances?.allClear);
  const duesPathAllowed = Boolean(clearances?.mayDischargeWithBillingDues);

  // ─── Finalize: sirf DischargeSummaryEditor pe navigate karo ───────────────
  const handleFinalizeDischarge = useCallback(() => {
    if (!patient || !id) return;
    navigate(
      `/dashboard/reception/ipd/discharge/summary/${encodeURIComponent(id)}`,
      {
        state: {
          patient: {
            id,
            name: patient.name,
            uhid: patient.uhid,
            ward: patient.ward,
            bed: patient.bed,
            doctor: patient.doctor,
          },
          fromFinalDischarge: true,
          dischargeWithDues: Boolean(!financialGate && duesPathAllowed && dischargeWithDuesAck),
        },
      }
    );
  }, [patient, financialGate, duesPathAllowed, dischargeWithDuesAck, id, navigate]);

  return (
    <div className="final-discharge-container">
      <div className="final-discharge-shell">
        <div className="final-discharge-top">
          <button type="button" className="final-discharge-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <button
            type="button"
            className="final-discharge-linkQuiet"
            onClick={() => navigate('/dashboard/reception/ipd/today-discharge')}
          >
            Today&apos;s discharge list
          </button>
        </div>

        {loading ? (
          <section className="final-discharge-card final-discharge-card--empty">
            <p className="final-discharge-emptyText">Loading…</p>
          </section>
        ) : null}

        {!loading && loadError && !patient ? (
          <section className="final-discharge-card final-discharge-card--empty">
            <p className="final-discharge-emptyText">{loadError}</p>
          </section>
        ) : null}

        {!loading && patient ? (
          <>
            <div className="final-discharge-layout">
              {/* ── Patient Details ── */}
              <section className="final-discharge-card final-discharge-card--patient">
                <div className="final-discharge-cardHeader">
                  <h2 className="final-discharge-cardTitle">Patient details</h2>
                </div>
                <dl className="final-discharge-grid final-discharge-grid--patient">
                  <div className="final-discharge-field">
                    <dt className="final-discharge-dt">Name</dt>
                    <dd className="final-discharge-dd">{patient.name}</dd>
                  </div>
                  <div className="final-discharge-field">
                    <dt className="final-discharge-dt">UHID</dt>
                    <dd className="final-discharge-dd final-discharge-mono">{patient.uhid}</dd>
                  </div>
                  <div className="final-discharge-field">
                    <dt className="final-discharge-dt">Ward / bed</dt>
                    <dd className="final-discharge-dd">
                      {patient.ward} <span className="final-discharge-sep">/</span> {patient.bed}
                    </dd>
                  </div>
                  <div className="final-discharge-field">
                    <dt className="final-discharge-dt">Doctor</dt>
                    <dd className="final-discharge-dd">{patient.doctor}</dd>
                  </div>
                  <div className="final-discharge-field">
                    <dt className="final-discharge-dt">Nurse</dt>
                    <dd className="final-discharge-dd">{patient.nurse}</dd>
                  </div>
                </dl>
              </section>

              {/* ── Billing Breakdown ── */}
              <section className="final-discharge-card final-discharge-card--billing">
                <div className="final-discharge-cardHeader">
                  <h2 className="final-discharge-cardTitle">Billing breakdown</h2>
                  <span className="final-discharge-cardTag">
                    {patient.billingSource === 'bills' ? 'Registered bills' : 'Admission estimate'}
                  </span>
                </div>

                {financialGate ? (
                  <div className="final-discharge-banner final-discharge-banner--ok" style={{ margin: '0 18px 14px' }}>
                    <span className="final-discharge-bannerTitle">Clearances OK — you can finalize.</span>
                  </div>
                ) : null}

                {clearances?.pharmacyDue?.pendingAmount > 0 ? (
                  <div className="final-discharge-banner final-discharge-banner--warn" style={{ margin: '0 18px 14px' }}>
                    <span className="final-discharge-bannerTitle">
                      Pharmacy Due: {money(clearances.pharmacyDue.pendingAmount)} — Patient has pending pharmacy dues.
                    </span>
                  </div>
                ) : null}

                {clearances && Math.max(0, Number(clearances.otherPatientBillingPending) || 0) > 0 ? (
                  <div className="final-discharge-banner final-discharge-banner--warn" style={{ margin: '0 18px 14px' }}>
                    <span className="final-discharge-bannerTitle">
                      Note: this patient still has {money(clearances.otherPatientBillingPending)} pending on other visits
                      {Array.isArray(clearances.otherPendingBills) && clearances.otherPendingBills.length > 0
                        ? ` (${clearances.otherPendingBills
                            .map((b) => [b.billNumber, b.visitType].filter(Boolean).join(' · ') || 'bill')
                            .join(', ')})`
                        : ''}
                      . The table below is for this IPD stay only.
                    </span>
                  </div>
                ) : null}

                {!financialGate && clearances && duesPathAllowed ? (
                  <div className="final-discharge-banner final-discharge-banner--warn" style={{ margin: '0 18px 14px' }}>
                    <span className="final-discharge-bannerTitle">
                      Billing pending {money(clearances.totalPatientBillingPending || 0)} — lab is clear. You may finalize with dues below.
                    </span>
                  </div>
                ) : null}

                {!financialGate && clearances && !duesPathAllowed ? (
                  <div className="final-discharge-banner final-discharge-banner--warn" style={{ margin: '0 18px 14px' }}>
                    <span className="final-discharge-bannerTitle">Clearances not met — complete lab billing and/or dues.</span>
                  </div>
                ) : null}

                <div className="final-discharge-tableWrap">
                  <table className="final-discharge-billTable">
                    <thead>
                      <tr>
                        <th scope="col" className="final-discharge-th final-discharge-th--num">#</th>
                        <th scope="col" className="final-discharge-th">Category</th>
                        <th scope="col" className="final-discharge-th">Particular</th>
                        <th scope="col" className="final-discharge-th final-discharge-th--amt">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patient.lineItems.map((row, idx) => (
                        <tr key={`${row.category}-${idx}`}>
                          <td className="final-discharge-td final-discharge-td--num">{idx + 1}</td>
                          <td className="final-discharge-td">{row.category}</td>
                          <td className="final-discharge-td">{row.description}</td>
                          <td className="final-discharge-td final-discharge-td--amt">{money(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="final-discharge-billingRows final-discharge-billingRows--summary">
                  <div className="final-discharge-billingRow">
                    <span className="final-discharge-billingLabel">Total bill</span>
                    <span className="final-discharge-billingValue">{money(patient.billing.totalBill)}</span>
                  </div>
                  <div className="final-discharge-billingRow">
                    <span className="final-discharge-billingLabel">Paid amount</span>
                    <span className="final-discharge-billingValue">{money(patient.billing.paidAmount)}</span>
                  </div>
                  <div className={pending > 0 ? 'final-discharge-billingRow final-discharge-billingRow--pending' : 'final-discharge-billingRow'}>
                    <span className="final-discharge-billingLabel">Pending amount</span>
                    <span className={pending > 0 ? 'final-discharge-billingValue final-discharge-billingValue--pending' : 'final-discharge-billingValue'}>
                      {money(patient.billing.pendingAmount)}
                    </span>
                  </div>
                </div>

                {!financialGate && pending > 0 && !duesPathAllowed ? (
                  <div className="final-discharge-banner final-discharge-banner--warn">
                    <span className="final-discharge-bannerTitle">Table below is estimate only — use billing for actual balances.</span>
                  </div>
                ) : null}
              </section>
            </div>

            {/* ── Discharge Summary ── */}
            {savedSummary ? (
              <section className="final-discharge-card final-discharge-card--summary">
                <div className="final-discharge-cardHeader">
                  <h2 className="final-discharge-cardTitle">Discharge summary</h2>
                </div>
                <div className="final-discharge-billingRows final-discharge-billingRows--summary">
                  <p className="final-discharge-muted" style={{ margin: 0 }}>
                    Editable discharge summary saved.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    <button
                      type="button"
                      className="final-discharge-btn final-discharge-btn--secondary"
                      onClick={() =>
                        navigate(`/dashboard/reception/ipd/discharge/summary/${encodeURIComponent(id)}`, {
                          state: {
                            editSummary: true,
                            dischargeWithDues: Boolean(!financialGate && duesPathAllowed && dischargeWithDuesAck),
                          },
                        })
                      }
                    >
                      Edit summary
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            {/* ── Discharge with dues ── */}
            {duesPathAllowed && !financialGate ? (
              <section className="final-discharge-card final-discharge-card--billing" style={{ marginTop: 12 }}>
                <div className="final-discharge-cardHeader">
                  <h2 className="final-discharge-cardTitle">Discharge with dues</h2>
                </div>
                <label className="final-discharge-duesOption" style={{ margin: '14px 18px 18px', display: 'flex', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={dischargeWithDuesAck}
                    onChange={(e) => setDischargeWithDuesAck(e.target.checked)}
                  />
                  <span>
                    I confirm discharge with outstanding balance of{' '}
                    <strong>{money(clearances?.totalPatientBillingPending || 0)}</strong> (per hospital policy).
                  </span>
                </label>
              </section>
            ) : null}

            {/* ── Final Action Button ── */}
            <div className="final-discharge-actions">
              <button
                type="button"
                className="final-discharge-btn"
                onClick={handleFinalizeDischarge}
              >
                Open discharge summary form
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
