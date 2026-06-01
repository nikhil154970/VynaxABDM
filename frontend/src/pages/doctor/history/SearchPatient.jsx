import { useState } from 'react';
import api from '../../../utils/api';
import PatientInfoCard from '../../../components/PatientInfoCard';
import HistoryTable from '../../../components/HistoryTable';

export default function SearchPatient() {
  const [uhid, setUhid] = useState('');
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');

  const search = async () => {
    const value = String(uhid || '').trim();
    if (!value) return;
    setLoading(true);
    setError('');
    setPatient(null);
    setRecords([]);
    try {
      const res = await api.get(`/patients/${encodeURIComponent(value)}/history`);
      setPatient(res.data?.patient || null);
      setRecords(res.data?.records || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4" style={{ background: '#F5F7FA' }}>
      <h2 className="text-lg font-extrabold text-gray-900">Patient History</h2>

      <div className="rounded-2xl border p-4" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={uhid}
            onChange={(e) => setUhid(e.target.value)}
            placeholder="Enter UHID"
            className="flex-1 min-w-[240px] px-4 py-2.5 rounded-xl border bg-white text-sm"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search();
            }}
          />
          <button
            type="button"
            onClick={search}
            disabled={loading || !String(uhid).trim()}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white disabled:opacity-60"
            style={{ background: '#E53935' }}
          >
            {loading ? 'Searching…' : 'Search Patient'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-6 py-4" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
          <p className="text-sm font-semibold text-gray-700">{error}</p>
        </div>
      ) : null}

      <PatientInfoCard patient={patient} />

      <HistoryTable rows={records} />
    </div>
  );
}

