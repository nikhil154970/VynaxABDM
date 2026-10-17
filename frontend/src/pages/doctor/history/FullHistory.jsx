import { useState } from 'react';
import api from '../../../utils/api';
import PatientInfoCard from '../../../components/PatientInfoCard';
import HistoryTable from '../../../components/HistoryTable';
import PatientLabReportsPanel from '../../../components/PatientLabReportsPanel';
import { MdHistory, MdSearch } from 'react-icons/md';

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
      setError(e.response?.data?.message || 'Patient records not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex items-center gap-4 border-b border-gray-200 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
            <MdHistory className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Full Medical History</h1>
          
          </div>
        </div>

        {/* Search Card Panel */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px] relative">
              <MdSearch className="absolute left-3.5 top-3 w-5 h-5 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter UHID or Patient ID..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') load();
                }}
              />
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading || !String(query).trim()}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] disabled:opacity-50 disabled:hover:bg-[#0077B6] shadow-sm hover:shadow active:scale-95 transition-all duration-200 shrink-0"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </div>
              ) : (
                'Load Records'
              )}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-155 bg-red-50/50 px-5 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {/* Patient Details Card */}
        {patient && <PatientInfoCard patient={patient} />}

        {/* Patient Lab Panel */}
        {patient?.id ? (
          <PatientLabReportsPanel patientId={patient.id} title="Lab reports (completed, read-only)" />
        ) : null}

        {/* History Records Table */}
        {records.length > 0 ? (
          <HistoryTable
            rows={records}
            onRowClick={(row) => {
              void row;
            }}
          />
        ) : patient ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-gray-500 font-semibold text-sm shadow-sm">
            No history clinical records found for this patient.
          </div>
        ) : null}
      </div>
    </div>
  );
}
