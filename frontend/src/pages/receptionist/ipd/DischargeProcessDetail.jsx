import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../../utils/api';
import './TodayDischarge.css';

function formatApprovalTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function wardLine(ward) {
  if (!ward) return '—';
  const t = String(ward.type || '').toUpperCase();
  const cat = t === 'ICU' ? 'ICU' : t === 'PRIVATE' ? 'Private' : 'General';
  const name = String(ward.name || '').trim();
  return name ? `${name} (${cat})` : cat;
}

function moneyInr(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN')}`;
}

export default function DischargeProcessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchedPatient, setFetchedPatient] = useState(null);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearances, setClearances] = useState(null);
  const [clearError, setClearError] = useState('');

  const fromState = location.state?.patient;
  const clearanceMessage = location.state?.clearanceMessage;
  const clearanceBlocked = Boolean(location.state?.clearanceBlocked);

  useEffect(() => {
    if (fromState && String(fromState.id) === String(id)) {
      setFetchedPatient(null);
      setFetchError('');
      return;
    }
    let alive = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      setFetchError('');
      try {
        const res = await api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}`);
        const adm = res?.data?.admission;
        if (!alive || !adm) {
          if (alive) setFetchedPatient(null);
          return;
        }
        if (String(adm.status || '').toUpperCase() !== 'DISCHARGE_REQUESTED') {
          if (alive) {
            setFetchedPatient(null);
            setFetchError('This admission is not in nurse-approved discharge status.');
          }
          return;
        }
        const nurseName = adm.nurse?.name || adm.nurse?.email || '—';
        if (alive) {
          setFetchedPatient({
            id: adm.id,
            name: adm.patient?.name || '',
            uhid: adm.patient?.uhid || '',
            ward: wardLine(adm.ward),
            bed: adm.bed?.code || '—',
            dischargeApproved: true,
            approvedBy: nurseName,
            approvalTime: adm.dischargeRequestedAt || null,
            doctor: adm.doctor?.user?.name || '',
          });
        }
      } catch (e) {
        if (alive) {
          setFetchedPatient(null);
          setFetchError(e?.response?.data?.message || e?.message || 'Could not load admission');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, fromState]);

  const patient = useMemo(() => {
    if (fromState && String(fromState.id) === String(id)) return fromState;
    return fetchedPatient;
  }, [id, fromState, fetchedPatient]);

  useEffect(() => {
    if (!id || !patient) return;
    let alive = true;
    (async () => {
      setClearLoading(true);
      setClearError('');
      setClearances(null);
      try {
        const res = await api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}/discharge-clearances`);
        if (!alive) return;
        setClearances(res?.data || null);
      } catch (e) {
        if (!alive) return;
        setClearances(null);
        setClearError(e?.response?.data?.message || e?.message || 'Could not verify clearances');
      } finally {
        if (alive) setClearLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, patient]);

  const refreshClearances = async () => {
    if (!id || !patient) return;
    setClearLoading(true);
    setClearError('');
    try {
      const res = await api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}/discharge-clearances`);
      setClearances(res?.data || null);
    } catch (e) {
      setClearances(null);
      setClearError(e?.response?.data?.message || e?.message || 'Could not verify clearances');
    } finally {
      setClearLoading(false);
    }
  };

  const allReady = Boolean(clearances?.allClear) && !clearLoading && !clearError;
  const mayDuesPath = Boolean(clearances?.mayDischargeWithBillingDues) && !clearLoading && !clearError;
  /** Same rule as document-generation step: nursing + lab clear; billing may have dues. */
  const canOpenDocuments = (allReady || mayDuesPath) && !clearLoading && !clearError;
  const blockingBills = Array.isArray(clearances?.blockingBills) ? clearances.blockingBills : [];
  const blockingLab = Array.isArray(clearances?.blockingLabOrders) ? clearances.blockingLabOrders : [];

  return (
    <div className="today-discharge-container today-discharge-container--detail">
      <div className="today-discharge-shell today-discharge-detail-shell">
        <button type="button" className="today-discharge-back" onClick={() => navigate(-1)}>
          ← Back to list
        </button>

        {loading ? (
          <div className="today-discharge-card">
            <div className="today-discharge-empty">Loading…</div>
          </div>
        ) : null}

        {!loading && fetchError && !patient ? (
          <div className="today-discharge-card">
            <div className="today-discharge-empty today-discharge-empty--detail" role="alert">
              {fetchError}
            </div>
            <button
              type="button"
              className="today-discharge-btn today-discharge-btn--secondary"
              onClick={() => navigate('/dashboard/reception/ipd/today-discharge')}
            >
              Return to today&apos;s discharge
            </button>
          </div>
        ) : null}

        {!loading && !patient && !fetchError ? (
          <div className="today-discharge-card">
            <div className="today-discharge-empty today-discharge-empty--detail">Patient not found or not approved for discharge.</div>
            <button
              type="button"
              className="today-discharge-btn today-discharge-btn--secondary"
              onClick={() => navigate('/dashboard/reception/ipd/today-discharge')}
            >
              Return to today&apos;s discharge
            </button>
          </div>
        ) : null}

        {!loading && patient ? (
          <section className="today-discharge-card today-discharge-detail-card">
            <div className="today-discharge-cardHeader">
              <p className="today-discharge-stepHint">Step 1 of 3 · Clearances</p>
              <h1 className="today-discharge-detail-title">Discharge · {patient.name}</h1>
              <p className="today-discharge-cardSub">
                <span className="today-discharge-mono">{patient.uhid}</span>
                <span className="today-discharge-sep"> · </span>
                {patient.ward} / {patient.bed}
              </p>
            </div>
            <dl className="today-discharge-detailGrid">
              <div>
                <dt className="today-discharge-dt">Treating doctor</dt>
                <dd className="today-discharge-dd">{patient.doctor || '—'}</dd>
              </div>
              <div>
                <dt className="today-discharge-dt">Nurse approval</dt>
                <dd className="today-discharge-dd">{patient.approvedBy || '—'}</dd>
              </div>
              <div>
                <dt className="today-discharge-dt">Approval time</dt>
                <dd className="today-discharge-dd">{formatApprovalTime(patient.approvalTime)}</dd>
              </div>
            </dl>

            {clearanceMessage ? (
              <div className="today-discharge-bannerAlert" role="status">
                {clearanceMessage}
              </div>
            ) : null}

            {clearanceBlocked && !clearanceMessage ? (
              <div className="today-discharge-bannerAlert" role="status">
                Clear dues, then refresh.
              </div>
            ) : null}

            <div className="today-discharge-cardHeader today-discharge-cardHeader--row" style={{ marginTop: 14, borderTop: '1px solid rgba(15,23,42,0.06)' }}>
              <div>
                <h2 className="today-discharge-cardTitle" style={{ margin: 0 }}>
                  Clearances
                </h2>
              </div>
              <button type="button" className="today-discharge-btn today-discharge-btn--ghost" onClick={refreshClearances} disabled={clearLoading}>
                {clearLoading ? 'Checking…' : 'Refresh'}
              </button>
            </div>

            {clearError ? (
              <div className="today-discharge-empty today-discharge-empty--error" style={{ margin: '12px 18px' }} role="alert">
                {clearError}
              </div>
            ) : null}

            <div className="today-discharge-clearanceGrid">
              <div className={`today-discharge-clearCard ${clearances?.nursingClearance ? 'today-discharge-clearCard--ok' : 'today-discharge-clearCard--bad'}`}>
                <p className="today-discharge-clearTitle">1 · Nursing clearance</p>
                <div className="today-discharge-clearStatus">
                  <span className={`today-discharge-clearDot ${clearances?.nursingClearance ? 'today-discharge-clearDot--ok' : 'today-discharge-clearDot--bad'}`} />
                  {clearLoading ? 'Verifying…' : clearances?.nursingClearance ? 'Cleared' : 'Pending'}
                </div>
                {clearances?.nursingClearance ? (
                  <p className="today-discharge-clearDetail">Nurse discharge on file.</p>
                ) : null}
              </div>

              <div className={`today-discharge-clearCard ${clearances?.billingClearance ? 'today-discharge-clearCard--ok' : 'today-discharge-clearCard--bad'}`}>
                <p className="today-discharge-clearTitle">2 · Billing clearance</p>
                <div className="today-discharge-clearStatus">
                  <span className={`today-discharge-clearDot ${clearances?.billingClearance ? 'today-discharge-clearDot--ok' : 'today-discharge-clearDot--bad'}`} />
                  {clearLoading ? 'Verifying…' : clearances?.billingClearance ? 'All bills settled' : 'Dues on file'}
                </div>
                {clearances && !clearances.billingClearance ? (
                  <p className="today-discharge-clearDetail">Outstanding: {moneyInr(clearances.billingPendingTotal || 0)}</p>
                ) : null}
              </div>

              <div className={`today-discharge-clearCard ${clearances?.labClearance ? 'today-discharge-clearCard--ok' : 'today-discharge-clearCard--bad'}`}>
                <p className="today-discharge-clearTitle">3 · Lab billing clearance</p>
                <div className="today-discharge-clearStatus">
                  <span className={`today-discharge-clearDot ${clearances?.labClearance ? 'today-discharge-clearDot--ok' : 'today-discharge-clearDot--bad'}`} />
                  {clearLoading ? 'Verifying…' : clearances?.labClearance ? 'No pending lab billing' : 'Lab orders need billing'}
                </div>
                {clearances && !clearances.labClearance ? <p className="today-discharge-clearDetail">Complete lab billing first.</p> : null}
              </div>

              <div
                className={`today-discharge-clearCard ${
                  clearances?.pharmacyDue?.pendingAmount > 0 ? 'today-discharge-clearCard--bad' : 'today-discharge-clearCard--ok'
                }`}
              >
                <p className="today-discharge-clearTitle">4 · Pharmacy dues</p>
                <div className="today-discharge-clearStatus">
                  <span
                    className={`today-discharge-clearDot ${
                      clearances?.pharmacyDue?.pendingAmount > 0 ? 'today-discharge-clearDot--bad' : 'today-discharge-clearDot--ok'
                    }`}
                  />
                  {clearLoading
                    ? 'Verifying…'
                    : clearances?.pharmacyDue?.pendingAmount > 0
                      ? 'Pending pharmacy dues'
                      : 'No pharmacy dues'}
                </div>
                {clearances?.pharmacyDue?.pendingAmount > 0 ? (
                  <>
                    <p className="today-discharge-clearDetail">
                      Pharmacy Due: {moneyInr(clearances.pharmacyDue.pendingAmount)}
                    </p>
                    <p className="today-discharge-clearDetail" style={{ color: '#b45309', fontWeight: 600 }}>
                      Patient has pending pharmacy dues.
                    </p>
                  </>
                ) : null}
              </div>
            </div>

            {!clearLoading && clearances?.pharmacyDue?.pendingAmount > 0 && clearances.pharmacyDue.bills?.length > 0 ? (
              <div className="today-discharge-blockList">
                <h3>Pharmacy bills — pending payment</h3>
                <ul>
                  {clearances.pharmacyDue.bills.map((b) => (
                    <li key={b.id}>
                      Bill {b.billNumber}: pending {moneyInr(b.pendingAmount)} (paid {moneyInr(b.paidAmount)} / total{' '}
                      {moneyInr(b.grandTotal ?? b.totalAmount)})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!clearLoading && blockingBills.length > 0 ? (
              <div className="today-discharge-blockList">
                <h3>Unpaid or partially paid bills</h3>
                <ul>
                  {blockingBills.map((b) => (
                    <li key={b.id}>
                      {String(b.visitType || '').toUpperCase() === 'IPD' ? 'IPD' : 'OPD'} bill {b.billNumber || b.id}: pending{' '}
                      {moneyInr(b.pending)} (paid {moneyInr(b.paidAmount)} / total {moneyInr(b.totalAmount)})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!clearLoading && blockingLab.length > 0 ? (
              <div className="today-discharge-blockList">
                <h3>Lab orders — pending billing</h3>
                <ul>
                  {blockingLab.map((lo) => (
                    <li key={lo.id}>
                      Order {lo.orderNumber || lo.id}: {lo.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="today-discharge-detailActions" style={{ justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`today-discharge-btn ${canOpenDocuments ? '' : 'today-discharge-btn--muted'}`}
                disabled={!canOpenDocuments}
                title={
                  canOpenDocuments ? '' : 'Nursing / lab billing clearances still pending — fix and tap Refresh.'
                }
                onClick={() =>
                  navigate(`/dashboard/reception/ipd/discharge/documents/${encodeURIComponent(patient.id)}`, {
                    state: { patient },
                  })
                }
              >
                Continue to document generation
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
