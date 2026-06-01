import { useState } from 'react';
import api from '../../../utils/api';
import PatientInfoCard from '../../../components/PatientInfoCard';
import HistoryTable from '../../../components/HistoryTable';
import PatientLabReportsPanel from '../../../components/PatientLabReportsPanel';

const isUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());

export default function FullHistory() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    const value = String(query || '').trim();
    if (!value) return;
    setLoading(true);
    setError('');
    setPatient(null);
    setRecords([]);
    try {
      if (isUUID(value)) {
        const res = await api.get(`/patients/${value}/full-history`);
        setPatient(res.data?.patient || null);
        setRecords(res.data?.records || []);
      } else {
        // Resolve by UHID first (minimal UX, no extra endpoints)
        const byUhid = await api.get(`/patients/${encodeURIComponent(value)}/history`);
        const pid = byUhid.data?.patient?.id;
        if (!pid) throw new Error('Not found');
        const res = await api.get(`/patients/${pid}/full-history`);
        setPatient(res.data?.patient || null);
        setRecords(res.data?.records || []);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4" style={{ background: '#F5F7FA' }}>
      <h2 className="text-lg font-extrabold text-gray-900">Full Medical History</h2>

      <div className="rounded-2xl border p-4" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter UHID or Patient ID"
            className="flex-1 min-w-[240px] px-4 py-2.5 rounded-xl border bg-white text-sm"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') load();
            }}
          />
          <button
            type="button"
            onClick={load}
            disabled={loading || !String(query).trim()}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white disabled:opacity-60"
            style={{ background: '#E53935' }}
          >
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-6 py-4" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
          <p className="text-sm font-semibold text-gray-700">{error}</p>
        </div>
      ) : null}

      <PatientInfoCard patient={patient} />

      {patient?.id ? (
        <PatientLabReportsPanel patientId={patient.id} title="Lab reports (completed, read-only)" />
      ) : null}

      <HistoryTable
        rows={records}
        onRowClick={(row) => {
          // Phase 1: optional click hook reserved (detail drawer/modal can be added later)
          void row;
        }}
      />
    </div>
  );
}

