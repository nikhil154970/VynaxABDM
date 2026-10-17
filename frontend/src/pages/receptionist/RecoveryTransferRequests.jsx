import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdBed, MdCheckCircle, MdLocalHospital, MdRefresh } from 'react-icons/md';
import api from '../../utils/api';

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '').trim());
}

async function fetchWards() {
  const res = await api.get('/receptionist/ipd/wards');
  return Array.isArray(res?.data?.items) ? res.data.items : [];
}

async function fetchBeds(wardId) {
  if (!wardId || !isUuid(wardId)) return [];
  const res = await api.get('/receptionist/ipd/beds', { params: { status: 'AVAILABLE', wardId } });
  return Array.isArray(res?.data?.items) ? res.data.items : [];
}

export default function RecoveryTransferRequests() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [wards, setWards] = useState([]);
  const [wardId, setWardId] = useState('');
  const [beds, setBeds] = useState([]);
  const [bedId, setBedId] = useState('');
  const [bedsLoading, setBedsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingRes, wardsRes] = await Promise.all([
        api.get('/receptionist/recovery-transfers/pending'),
        fetchWards(),
      ]);
      setItems(Array.isArray(pendingRes.data?.items) ? pendingRes.data.items : []);
      setWards(wardsRes);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load transfer requests');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!wardId) {
      setBeds([]);
      setBedId('');
      return;
    }
    setBedsLoading(true);
    fetchBeds(wardId)
      .then((list) => setBeds(list))
      .catch(() => setBeds([]))
      .finally(() => setBedsLoading(false));
  }, [wardId]);

  const selectedWard = useMemo(() => wards.find((w) => w.id === wardId), [wards, wardId]);

  const openItem = (item) => {
    setSelected(item);
    setSuccess('');
    setWardId('');
    setBedId('');
    setBeds([]);
    if (item.preferredWardType && wards.length) {
      const match = wards.find((w) => String(w.type).toUpperCase() === String(item.preferredWardType).toUpperCase());
      if (match) setWardId(match.id);
    }
  };

  const handleComplete = async () => {
    if (!selected?.recoveryRecordId || !wardId || !bedId) return;
    setSubmitting(true);
    setSuccess('');
    setError('');
    try {
      const res = await api.post(`/receptionist/recovery-transfers/${selected.recoveryRecordId}/complete`, {
        wardId,
        bedId,
      });
      setSuccess(res.data?.message || 'Transfer completed. HR nurse allocation request created.');
      setSelected(null);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to complete transfer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
            <MdLocalHospital className="text-blue-600" /> Recovery Transfer Requests
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Patients ready for ward transfer from Recovery Room. Assign ward, room and bed, then complete transfer.
          </p>
        </div>
        <button type="button" onClick={load}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: '#001B48' }}>
          <MdRefresh /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm text-gray-700">
            Pending Requests ({items.length})
          </div>
          {loading ? (
            <p className="p-5 text-sm text-gray-400">Loading...</p>
          ) : items.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No pending recovery transfer requests.</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
              {items.map((item) => (
                <button
                  key={item.recoveryRecordId}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50/50 transition ${selected?.recoveryRecordId === item.recoveryRecordId ? 'bg-blue-50' : ''}`}
                >
                  <p className="font-bold text-gray-800">{item.patient?.name || '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    UHID {item.patient?.uhid || '—'} · IPD {item.admission?.ipdNumber || '—'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{item.surgeryName || '—'} · Dr. {item.surgeon || '—'}</p>
                  {item.preferredWardType && (
                    <p className="text-xs text-amber-700 mt-1 font-semibold">Preferred: {item.preferredWardType}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          {!selected ? (
            <p className="text-sm text-gray-500">Select a pending request to assign ward and bed.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-gray-800">{selected.patient?.name}</h2>
                <p className="text-xs text-gray-500">UHID {selected.patient?.uhid} · Requested {selected.transferRequestedAt ? new Date(selected.transferRequestedAt).toLocaleString('en-IN') : '—'}</p>
              </div>

              {selected.latestAssessment && (
                <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                  <p className="font-bold text-gray-700 mb-1">Latest Assessment</p>
                  <p>Status: {selected.latestAssessment.status || selected.status}</p>
                  {selected.latestAssessment.recoveryNotes && <p className="mt-1">{selected.latestAssessment.recoveryNotes}</p>}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Ward</label>
                <select value={wardId} onChange={(e) => { setWardId(e.target.value); setBedId(''); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white">
                  <option value="">Select ward</option>
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Bed / Room</label>
                <select value={bedId} onChange={(e) => setBedId(e.target.value)} disabled={!wardId || bedsLoading}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white disabled:opacity-60">
                  <option value="">{bedsLoading ? 'Loading beds...' : 'Select available bed'}</option>
                  {beds.map((b) => (
                    <option key={b.id} value={b.id}>Bed {b.code} — {b.wardName}</option>
                  ))}
                </select>
                {wardId && !bedsLoading && beds.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">No available beds in {selectedWard?.name || 'this ward'}.</p>
                )}
              </div>

              <button type="button" onClick={handleComplete} disabled={submitting || !wardId || !bedId}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-50"
                style={{ background: '#15803d' }}>
                <MdCheckCircle />
                {submitting ? 'Completing...' : 'Complete Transfer & Notify HR'}
              </button>
              <p className="text-xs text-gray-500 flex items-start gap-1">
                <MdBed className="mt-0.5 shrink-0" />
                After transfer, an IPD nurse allocation request is automatically sent to HR.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
