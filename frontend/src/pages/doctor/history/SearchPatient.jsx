import { useEffect, useState } from 'react';
import api from '../../../utils/api';
import PatientInfoCard from '../../../components/PatientInfoCard';
import HistoryTable from '../../../components/HistoryTable';
import { MdHistory, MdSearch } from 'react-icons/md';

export default function SearchPatient() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  const loadByQuery = async () => {
    const value = String(query || '').trim();
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
      setError(e.response?.data?.message || 'Patient history not found');
    } finally {
      setLoading(false);
    }
  };

  const loadById = async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    setPatient(null);
    setRecords([]);
    setSuggestions([]);
    try {
      const res = await api.get(`/patients/${encodeURIComponent(id)}/full-history`);
      setPatient(res.data?.patient || null);
      setRecords(res.data?.records || []);
      setQuery(res.data?.patient?.name || query);
    } catch (e) {
      setError(e.response?.data?.message || 'Patient records not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const value = String(query || '').trim();
    if (value.length < 2) {
      setSuggestions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setSuggestionLoading(true);
      try {
        const res = await api.get('/patients/search', { params: { q: value } });
        setSuggestions(Array.isArray(res?.data?.items) ? res.data.items : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex items-center gap-4 border-b border-gray-200 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
            <MdHistory className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Patient History</h1>

          </div>
        </div>

        {/* Search Panel Card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px] relative">
                <MdSearch className="absolute left-3.5 top-3 w-5 h-5 text-gray-400" />
                <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter patient name or UHID..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadByQuery();
                }}
              />
              {String(query || '').trim().length >= 2 && suggestions.length > 0 ? (
                <div className="absolute z-20 left-0 right-0 mt-2 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                  <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span>Suggestions</span>
                    <span>{suggestionLoading ? 'Searching…' : `${suggestions.length} found`}</span>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => loadById(item.id)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50/60 border-b border-slate-50 last:border-0 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                            <p className="text-xs text-slate-500 truncate">
                              UHID: {item.uhid || '—'}
                              {item.registrationNumber ? ` · Reg: ${item.registrationNumber}` : ''}
                              {item.mobile ? ` · Mob: ${item.mobile}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] font-bold text-[#0077B6] bg-[#0077B6]/10 px-2 py-1 rounded-full">
                            Select
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={loadByQuery}
              disabled={loading || !String(query).trim()}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] disabled:opacity-50 disabled:hover:bg-[#0077B6] shadow-sm hover:shadow active:scale-95 transition-all duration-200 shrink-0"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </div>
              ) : (
                'Search Patient'
              )}
            </button>
          </div>
        </div>

        {String(query || '').trim().length >= 2 && !loading && !patient && suggestions.length === 0 && !suggestionLoading ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-5 py-3 text-sm font-semibold text-amber-800">
            No direct suggestion found. Try the exact UHID, or pick from the list if it appears.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-155 bg-red-50/50 px-5 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {/* Patient Details Card */}
        {patient && <PatientInfoCard patient={patient} />}

        {/* History Records Table */}
        {records.length > 0 ? (
          <HistoryTable rows={records} />
        ) : patient ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-gray-500 font-semibold text-sm shadow-sm">
            No clinical history logs found for this patient.
          </div>
        ) : null}
      </div>
    </div>
  );
}
