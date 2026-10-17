import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { MdReceiptLong, MdScience, MdCheckCircle, MdWarningAmber, MdRefresh, MdArrowForward } from 'react-icons/md';
import api from '../../../utils/api';
import PatientBillingLedger from '../../../components/PatientBillingLedger';
import PatientLabReportsPanel from '../../../components/PatientLabReportsPanel';
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

const inr = (n) => `₹${Math.max(0, Number(n) || 0).toLocaleString('en-IN')}`;

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
  const [ledgerReloadToken, setLedgerReloadToken] = useState(0);

  const fromState = location.state?.patient;

  // Always resolve the admission (need patientId for the ledger + lab reports, and to
  // confirm the admission is still in nurse-approved status).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      setFetchError('');
      try {
        const res = await api.get(`/receptionist/ipd/admissions/${encodeURIComponent(id)}`);
        const adm = res?.data?.admission;
        if (!alive) return;
        if (!adm) {
          setFetchedPatient(null);
          return;
        }
        if (String(adm.status || '').toUpperCase() !== 'DISCHARGE_REQUESTED') {
          setFetchedPatient(null);
          setFetchError('This admission is not in nurse-approved discharge status.');
          return;
        }
        setFetchedPatient({
          id: adm.id,
          patientId: adm.patient?.id || adm.patientId || fromState?.patientId || '',
          name: adm.patient?.name || fromState?.name || '',
          uhid: adm.patient?.uhid || fromState?.uhid || '',
          ward: wardLine(adm.ward),
          bed: adm.bed?.code || '—',
          approvedBy: adm.nurse?.name || adm.nurse?.email || fromState?.approvedBy || '—',
          approvalTime: adm.dischargeRequestedAt || fromState?.approvalTime || null,
          doctor: adm.doctor?.user?.name || fromState?.doctor || '',
        });
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

  const patient = fetchedPatient;
  const patientId = fetchedPatient?.patientId || fromState?.patientId || '';

  const loadClearances = useCallback(async () => {
    if (!id) return;
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
  }, [id]);

  useEffect(() => {
    if (patient) loadClearances();
  }, [patient, loadClearances]);

  const allReady = Boolean(clearances?.allClear) && !clearLoading && !clearError;
  const mayDuesPath = Boolean(clearances?.mayDischargeWithBillingDues) && !clearLoading && !clearError;
  const canOpenDocuments = (allReady || mayDuesPath) && !clearLoading && !clearError;
  const totalOutstanding = clearances?.billingSummary?.totalOutstanding ?? clearances?.billingPendingTotal ?? 0;

  const openDischargeForm = useCallback(() => {
    // Skip the intermediate document + final-discharge screens — open the
    // discharge summary form directly. Billing tracking + lab reports are
    // already shown on this page.
    navigate(`/dashboard/reception/ipd/discharge/summary/${encodeURIComponent(id)}`, {
      state: {
        patient,
        fromProcess: true,
        dischargeWithDues: Boolean(mayDuesPath && !allReady),
      },
    });
  }, [navigate, id, patient, mayDuesPath, allReady]);

  // When payment is collected inline in the ledger, re-verify clearances automatically.
  const handleAfterPayment = useCallback(() => {
    setLedgerReloadToken((t) => t + 1);
    loadClearances();
  }, [loadClearances]);

  const verdict = useMemo(() => {
    if (clearLoading) return { tone: 'checking', text: 'Verifying clearances…' };
    if (clearError) return { tone: 'bad', text: clearError };
    if (allReady) return { tone: 'ok', text: 'All dues cleared & lab billing settled — ready for discharge.' };
    if (mayDuesPath) return { tone: 'warn', text: 'Nursing & lab cleared. Billing dues remain — you may proceed and collect at discharge.' };
    return { tone: 'bad', text: `Pending dues / unbilled lab found${totalOutstanding ? ` · outstanding ${inr(totalOutstanding)}` : ''}. Collect below, then refresh.` };
  }, [clearLoading, clearError, allReady, mayDuesPath, totalOutstanding]);

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
          </div>
        ) : null}

        {!loading && patient ? (
          <div className="flex flex-col gap-4">
            {/* Patient header */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-lg font-extrabold text-gray-900">Discharge · {patient.name}</h1>
                  <p className="mt-0.5 text-xs text-gray-500">
                    <span className="font-mono font-bold text-blue-600">{patient.uhid}</span> · {patient.ward} / {patient.bed}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Doctor: {patient.doctor || '—'} · Nurse approval: {patient.approvedBy || '—'} · {formatApprovalTime(patient.approvalTime)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadClearances}
                  disabled={clearLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-extrabold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  <MdRefresh className={`h-4 w-4 ${clearLoading ? 'animate-spin' : ''}`} />
                  Re-check
                </button>
              </div>

              {/* Verdict + discharge CTA */}
              <div
                className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                  verdict.tone === 'ok'
                    ? 'border-emerald-200 bg-emerald-50'
                    : verdict.tone === 'warn'
                      ? 'border-amber-200 bg-amber-50'
                      : verdict.tone === 'bad'
                        ? 'border-rose-200 bg-rose-50'
                        : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {verdict.tone === 'ok' ? (
                    <MdCheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <MdWarningAmber className={`h-5 w-5 shrink-0 ${verdict.tone === 'bad' ? 'text-rose-600' : 'text-amber-600'}`} />
                  )}
                  <p
                    className={`text-sm font-bold ${
                      verdict.tone === 'ok'
                        ? 'text-emerald-800'
                        : verdict.tone === 'warn'
                          ? 'text-amber-800'
                          : verdict.tone === 'bad'
                            ? 'text-rose-800'
                            : 'text-slate-700'
                    }`}
                  >
                    {verdict.text}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canOpenDocuments}
                  onClick={openDischargeForm}
                  title={canOpenDocuments ? 'Open the discharge form' : 'Clear pending dues / lab billing first, then Re-check.'}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-extrabold text-white shadow transition ${
                    canOpenDocuments ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-gray-300'
                  }`}
                >
                  Open discharge summary form <MdArrowForward className="h-4 w-4" />
                </button>
              </div>
            </section>

            {/* Billing & payment tracking */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <MdReceiptLong className="h-4 w-4 text-slate-600" />
                <h2 className="text-sm font-extrabold text-gray-800">Payment tracking — kaha kya paid, kya pending</h2>
              </div>
              {patientId ? (
                <PatientBillingLedger patientId={patientId} reloadToken={ledgerReloadToken} onAfterPayment={handleAfterPayment} />
              ) : (
                <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
                  Billing history unavailable — patient id missing.
                </p>
              )}
            </div>

            {/* Lab reports */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <MdScience className="h-4 w-4 text-slate-600" />
                <h2 className="text-sm font-extrabold text-gray-800">Lab reports</h2>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-2">
                {patientId ? (
                  <PatientLabReportsPanel patientId={patientId} embedded />
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">Lab reports unavailable — patient id missing.</p>
                )}
              </div>
            </div>

            {/* Bottom discharge CTA (repeat for convenience after scrolling) */}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canOpenDocuments}
                onClick={openDischargeForm}
                className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-extrabold text-white shadow transition ${
                  canOpenDocuments ? 'bg-emerald-600 hover:bg-emerald-700' : 'cursor-not-allowed bg-gray-300'
                }`}
              >
                Open discharge summary form <MdArrowForward className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
