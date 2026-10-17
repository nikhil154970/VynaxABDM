import { useCallback, useEffect, useState } from 'react';
import { MdRefresh } from 'react-icons/md';
import api, { getApiErrorMessage } from '../../../utils/api';
import Badge from '../../../components/Badge';
import { getHiuHealthInformationStatus, listHiuHealthRecords, requestHiuHealthInformation } from '../../../services/abdm/abhaService';
import AbdmHiuHealthRecordsModal from './AbdmHiuHealthRecordsModal';

const PURPOSE_OPTIONS = [
  { code: 'CAREMGT', label: 'Care Management' },
  { code: 'BTG', label: 'Break the Glass' },
  { code: 'PUBHLTH', label: 'Public Health' },
  { code: 'HPAYMT', label: 'Healthcare Payment' },
  { code: 'DSRCH', label: 'Disease Related Research' },
  { code: 'PATRQT', label: 'Patient Requested' },
];

const HI_TYPE_OPTIONS = [
  'OPConsultation',
  'Prescription',
  'DiagnosticReport',
  'DischargeSummary',
  'ImmunizationRecord',
  'HealthDocumentRecord',
  'WellnessRecord',
];

const INPUT_CLASS = 'mt-1 w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm';
const PRIMARY_BTN = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#00B4D8] active:bg-[#001B48] transition shadow-sm disabled:opacity-60';
const TABLE_BTN = 'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap disabled:opacity-60';

function isoInput(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function defaultFormDates() {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  const erase = new Date(to);
  erase.setDate(erase.getDate() + 90);
  return {
    from: isoInput(from),
    to: isoInput(to),
    dataEraseAt: isoInput(erase),
  };
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function statusBadge(status) {
  const sync = String(status || '').toUpperCase();
  if (sync === 'GRANTED') return { label: 'GRANTED', variant: 'green' };
  if (sync === 'DENIED' || sync === 'FAILED') return { label: sync, variant: 'rose' };
  if (sync === 'PENDING' || sync === 'REQUESTED') return { label: sync, variant: 'amber' };
  if (sync === 'EXPIRED') return { label: 'EXPIRED', variant: 'gray' };
  return { label: sync || '—', variant: 'gray' };
}

function MonoId({ value }) {
  const text = String(value || '').trim();
  if (!text) return <span className="text-slate-400">—</span>;
  return (
    <span className="block max-w-[10.5rem] truncate font-mono text-xs text-slate-700" title={text}>
      {text}
    </span>
  );
}

export default function AbdmConsentManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fetchingId, setFetchingId] = useState('');
  const [recordsByConsent, setRecordsByConsent] = useState({});
  const [viewer, setViewer] = useState({ open: false, consentId: '', loading: false, data: null, error: '' });
  const dates = defaultFormDates();
  const [patientQuery, setPatientQuery] = useState('');
  const [patientHits, setPatientHits] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [purposeCode, setPurposeCode] = useState('CAREMGT');
  const [hiTypes, setHiTypes] = useState(['OPConsultation', 'Prescription', 'DiagnosticReport', 'DischargeSummary']);
  const [dateFrom, setDateFrom] = useState(dates.from);
  const [dateTo, setDateTo] = useState(dates.to);
  const [dataEraseAt, setDataEraseAt] = useState(dates.dataEraseAt);
  const [initiating, setInitiating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/abdm/hiu/consents', { silent: true });
      const data = res?.data || {};
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      const granted = nextItems.filter((row) => String(row.status || '').toUpperCase() === 'GRANTED');
      const counts = {};
      await Promise.all(granted.map(async (row) => {
        const consentId = String(row.consentId || row.artefactId || '').trim();
        if (!consentId) return;
        try {
          const records = await listHiuHealthRecords(consentId);
          counts[consentId] = Number(records?.recordCount || 0);
        } catch {
          counts[consentId] = 0;
        }
      }));
      setRecordsByConsent(counts);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load HIU consent requests.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = patientQuery.trim();
    if (q.length < 2) {
      setPatientHits([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/abdm/hiu/consent-patients', { params: { q }, silent: true });
        const data = res?.data || {};
        setPatientHits(Array.isArray(data?.items) ? data.items : []);
      } catch {
        setPatientHits([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  const openRecords = async (consentId) => {
    setViewer({ open: true, consentId, loading: true, data: null, error: '' });
    try {
      const data = await listHiuHealthRecords(consentId);
      setViewer({ open: true, consentId, loading: false, data, error: '' });
    } catch (err) {
      setViewer({
        open: true,
        consentId,
        loading: false,
        data: null,
        error: err?.response?.data?.message || 'Unable to load health records.',
      });
    }
  };

  const toggleHiType = (type) => {
    setHiTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]));
  };

  const handleInitiateConsent = async (event) => {
    event.preventDefault();
    if (!selectedPatient?.id || initiating) return;
    setInitiating(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/abdm/hiu/consents/init', {
        patientId: selectedPatient.id,
        abhaAddress: selectedPatient.abhaAddress,
        purposeCode,
        hiTypes,
        dateRange: {
          from: new Date(dateFrom).toISOString(),
          to: new Date(dateTo).toISOString(),
        },
        dataEraseAt: new Date(dataEraseAt).toISOString(),
      }, { silent: true });
      const data = res?.data || {};
      const crid = data?.consentRequestId || '';
      setSuccess(`Consent request initiated (${data?.status || 'PENDING'}). ID: ${crid}`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to initiate consent request.');
    } finally {
      setInitiating(false);
    }
  };

  const handleFetchRecords = async (event, row) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const consentId = String(row?.consentId || row?.artefactId || row?.consentRequestId || '').trim();
    if (!consentId || fetchingId) return;
    setFetchingId(consentId);
    setError('');
    setSuccess('');
    try {
      await requestHiuHealthInformation(consentId);
      let failed = '';
      let ready = false;
      for (let i = 0; i < 10; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const statusRes = await getHiuHealthInformationStatus(consentId);
          const txn = statusRes?.transaction || {};
          const st = String(txn.status || '').toUpperCase();
          if (st === 'FAILED') {
            failed = [txn.errorCode, txn.errorMessage].filter(Boolean).join(' ').trim()
              || 'ABDM rejected the health-information request.';
            break;
          }
          if (st === 'ACKNOWLEDGED' || st === 'RECEIVED') {
            ready = true;
            break;
          }
        } catch {
          /* keep polling */
        }
      }
      if (failed) {
        setError(failed);
      } else if (ready) {
        setSuccess('Health information request accepted by ABDM. Use View Health Records when data arrives.');
        try {
          const records = await listHiuHealthRecords(consentId);
          setRecordsByConsent((prev) => ({ ...prev, [consentId]: Number(records?.recordCount || 0) }));
        } catch {
          /* keep previous count */
        }
      } else {
        setError('ABDM has not confirmed the health-information request yet.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to start health information request.'));
    } finally {
      setFetchingId('');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs md:text-sm text-gray-500">
            HIU consent request status from PHR grant / deny callbacks.
          </p>
          <button type="button" onClick={load} disabled={loading} className={`${PRIMARY_BTN} w-full sm:w-auto`}>
            <MdRefresh className="w-4 h-4" />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {success ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 break-words">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 break-words">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleInitiateConsent} className="relative z-20 overflow-visible rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-gray-800">Initiate Consent Request</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-sm font-semibold text-slate-600 relative">
              <span>VyanX patient</span>
              <input
                value={selectedPatient ? `${selectedPatient.name} (${selectedPatient.uhid || 'no UHID'})` : patientQuery}
                onChange={(e) => {
                  setSelectedPatient(null);
                  setPatientQuery(e.target.value);
                }}
                placeholder="Search name or UHID"
                className={INPUT_CLASS}
              />
              {!selectedPatient && patientHits.length ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {patientHits.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="block w-full truncate px-3 py-2 text-left text-sm font-medium hover:bg-slate-50"
                      title={`${row.name} · ${row.uhid || '—'}`}
                      onClick={() => {
                        setSelectedPatient(row);
                        setPatientQuery('');
                        setPatientHits([]);
                      }}
                    >
                      {row.name} · {row.uhid || '—'}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="text-sm font-semibold text-slate-600">
              Sandbox ABHA address
              <input
                readOnly
                value={selectedPatient?.abhaAddress || ''}
                placeholder="Select a verified patient"
                className={`${INPUT_CLASS} bg-slate-50`}
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Purpose
              <select
                value={purposeCode}
                onChange={(e) => setPurposeCode(e.target.value)}
                className={INPUT_CLASS}
              >
                {PURPOSE_OPTIONS.map((row) => (
                  <option key={row.code} value={row.code}>{row.label}</option>
                ))}
              </select>
            </label>
            <div className="text-sm font-semibold text-slate-600 md:col-span-2">
              Health-information types
              <div className="mt-2 flex flex-wrap gap-2">
                {HI_TYPE_OPTIONS.map((type) => {
                  const on = hiTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleHiType(type)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        on
                          ? 'border-[#0077B6] bg-[#0077B6] text-white'
                          : 'border-gray-200 bg-white text-slate-700'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:col-span-2">
              <label className="text-sm font-semibold text-slate-600 min-w-0">
                Information from
                <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="text-sm font-semibold text-slate-600 min-w-0">
                Information to
                <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="text-sm font-semibold text-slate-600 min-w-0">
                Consent expiry (dataEraseAt)
                <input type="datetime-local" value={dataEraseAt} onChange={(e) => setDataEraseAt(e.target.value)} className={INPUT_CLASS} />
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={!selectedPatient || initiating} className={`${PRIMARY_BTN} w-full sm:w-auto`}>
              {initiating ? 'Initiating…' : 'Initiate Consent Request'}
            </button>
          </div>
        </form>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-[#001B48] text-left text-xs font-semibold uppercase tracking-wide text-white">
                  <th className="px-5 py-3 whitespace-nowrap">Consent Request ID</th>
                  <th className="px-5 py-3 whitespace-nowrap">Patient</th>
                  <th className="px-5 py-3 whitespace-nowrap">Consent ID</th>
                  <th className="px-5 py-3 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3 whitespace-nowrap">Artefact ID</th>
                  <th className="px-5 py-3 whitespace-nowrap">Last Updated</th>
                  <th className="px-5 py-3 whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400 font-semibold">
                      Loading consent requests…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400 font-semibold">
                      {error ? 'Unable to load consent requests.' : 'No HIU consent requests yet.'}
                    </td>
                  </tr>
                ) : items.map((row) => {
                  const tone = statusBadge(row.status);
                  const granted = String(row.status || '').toUpperCase() === 'GRANTED';
                  const consentId = String(row.consentId || row.artefactId || '').trim();
                  const busy = Boolean(fetchingId) && fetchingId === consentId;
                  return (
                    <tr key={row.consentRequestId} className="hover:bg-[#D6E8EE] transition">
                      <td className="px-5 py-3"><MonoId value={row.consentRequestId} /></td>
                      <td className="px-5 py-3">
                        <span className="block max-w-[12rem] truncate" title={row.patientAbha || undefined}>
                          {row.patientAbha || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3"><MonoId value={row.consentId} /></td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Badge variant={tone.variant}>{tone.label}</Badge>
                      </td>
                      <td className="px-5 py-3"><MonoId value={row.artefactId} /></td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatWhen(row.updatedAt)}</td>
                      <td className="px-5 py-3">
                        {granted && consentId ? (
                          <div className="flex flex-col items-stretch sm:items-end gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(event) => handleFetchRecords(event, row)}
                              className={`${TABLE_BTN} bg-[#0077B6] text-white hover:bg-[#00B4D8]`}
                            >
                              {busy ? 'Fetching...' : 'Fetch Health Records'}
                            </button>
                            {Number(recordsByConsent[consentId] || 0) > 0 ? (
                              <button
                                type="button"
                                onClick={() => openRecords(consentId)}
                                className={`${TABLE_BTN} border border-[#0077B6] text-[#0077B6] bg-white`}
                              >
                                View Health Records
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="block text-right text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <AbdmHiuHealthRecordsModal
        open={viewer.open}
        loading={viewer.loading}
        data={viewer.data}
        error={viewer.error}
        onClose={() => setViewer({ open: false, consentId: '', loading: false, data: null, error: '' })}
      />
    </div>
  );
}
