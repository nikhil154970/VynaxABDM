import { useEffect, useState } from 'react';
import {
  healthDocumentUserMessage,
  listPatientHealthRecords,
  retryHealthDocument,
} from '../../services/abdm/abhaService';

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function statusTone(status) {
  const sync = String(status || '').toUpperCase();
  if (sync === 'SYNCED') return { label: 'SYNCED', className: 'text-green-700 bg-green-50 border-green-200' };
  if (sync === 'FAILED') return { label: 'FAILED', className: 'text-red-700 bg-red-50 border-red-200' };
  if (sync === 'PENDING') return { label: 'PENDING', className: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: 'NOT SENT', className: 'text-slate-600 bg-slate-50 border-slate-200' };
}

export default function AbdmPatientRecordSync({ patientId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const data = await listPatientHealthRecords(patientId);
      setRecords(Array.isArray(data?.records) ? data.records : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load ABDM record sync status.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [patientId]);

  const handleRetry = async (record) => {
    if (!record?.id || retryingId) return;
    setRetryingId(record.id);
    try {
      await retryHealthDocument(record.id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Retry failed. A new ABDM Health Information Request is required for data share.');
    } finally {
      setRetryingId('');
    }
  };

  if (!patientId) return null;

  return (
    <div className="mt-4">
      <p className="pl-modalCardTitle" style={{ marginTop: 0 }}>ABDM Records / Sync</p>
      <p className="text-xs text-slate-500 mb-3">
        Retry only re-sends an existing FAILED health document. Data share waits for a new ABDM Health Information Request.
      </p>
      {loading ? <p className="text-sm text-slate-500">Loading records…</p> : null}
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      {!loading && records.length === 0 ? (
        <p className="text-sm text-slate-500">No OPD, IPD, Lab, or Discharge records found.</p>
      ) : null}
      <div className="space-y-2">
        {records.map((record) => {
          const tone = statusTone(record.syncStatus);
          const showRetry = Boolean(record.id) && String(record.syncStatus || '').toUpperCase() === 'FAILED';
          return (
            <div
              key={`${record.sourceType}:${record.sourceId}:${record.id || 'none'}`}
              className={`rounded-lg border px-3 py-2 ${tone.className}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {record.recordType || record.hiType || record.sourceType} · {tone.label}
                </p>
                {showRetry ? (
                  <button
                    type="button"
                    className="rounded-md bg-[#0077B6] px-2 py-1 text-xs font-bold text-white disabled:opacity-60"
                    disabled={Boolean(retryingId)}
                    onClick={() => handleRetry(record)}
                  >
                    {retryingId === record.id ? 'Retrying…' : 'Retry'}
                  </button>
                ) : null}
              </div>
              <p className="text-xs mt-1">Record date: {formatWhen(record.recordDate)}</p>
              <p className="text-xs">Last synced: {formatWhen(record.lastNotifiedAt)}</p>
              {record.retryCount != null ? <p className="text-xs">Retry count: {record.retryCount}</p> : null}
              <p className="text-xs mt-1">{healthDocumentUserMessage(record) || record.errorMessage || '—'}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
