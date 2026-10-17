import { useState, useEffect, useCallback, useMemo } from 'react';
import patientApi from '../../utils/patientApi';

function normalizeMedicines(medicines) {
  if (!medicines) return [];
  if (Array.isArray(medicines)) return medicines;
  if (typeof medicines === 'string') {
    try { return JSON.parse(medicines); }
    catch { return [{ name: medicines }]; }
  }
  return [];
}

export default function PatientPrescriptions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPrescriptions = useCallback(async () => {
    try {
      setError(false);
      const r = await patientApi.get('/patient/portal/prescriptions');
      setData(r.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); fetchPrescriptions(); }, [fetchPrescriptions]);

  const prescriptions = useMemo(() => {
    const list = data?.prescriptions || [];
    if (!debouncedSearch) return list;
    const q = debouncedSearch.toLowerCase();
    return list.filter((p) => {
      const doctorMatch = p.doctor?.toLowerCase().includes(q);
      const diagnosisMatch = p.diagnosis?.toLowerCase().includes(q);
      const medMatch = normalizeMedicines(p.medicines).some((m) =>
        (m.name || m.medicine || '').toLowerCase().includes(q)
      );
      return doctorMatch || diagnosisMatch || medMatch;
    });
  }, [data, debouncedSearch]);

  const stats = useMemo(() => {
    const list = data?.prescriptions || [];
    const now = new Date();
    const thisMonth = list.filter((p) => {
      const d = new Date(p.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalMeds = list.reduce((sum, p) => sum + normalizeMedicines(p.medicines).length, 0);
    return { total: list.length, thisMonth: thisMonth.length, totalMedicines: totalMeds };
  }, [data]);

  const latest = prescriptions.length > 0 ? prescriptions[0] : null;

  if (loading && !data) return <Skeleton />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-800">Prescriptions</h1>
        <p className="text-sm text-gray-400 mt-0.5">View medicines prescribed by your doctors during consultations</p>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <StatCard label="Total Prescriptions" value={stats.total} color="blue" />
        <StatCard label="This Month" value={stats.thisMonth} color="green" />
        <StatCard label="Total Medicines" value={stats.totalMedicines} color="purple" />
      </div>

      <div className="relative">
        <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by doctor, diagnosis or medicine..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition"
        />
      </div>

      {error ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-500 font-medium">Something went wrong</p>
          <p className="text-xs text-gray-400 mt-1">Could not load prescriptions</p>
          <button onClick={fetchPrescriptions} className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm">Retry</button>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400 font-medium">No prescriptions found</p>
          <p className="text-xs text-gray-300 mt-1">Prescriptions appear here after your OPD consultation</p>
        </div>
      ) : (
        <div className="space-y-4">
          {latest && (
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden hover:shadow-md transition">
              <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">Latest Prescription</span>
                <span className="text-xs text-gray-400">{latest.date?.slice(0, 10)}</span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                    {latest.doctor?.charAt(0) || 'D'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">Dr. {latest.doctor || 'Doctor'}</p>
                    <p className="text-xs text-gray-400">{latest.specialization || ''}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-700">{latest.diagnosis || ''}</p>
                {latest.symptoms && <p className="text-xs text-gray-400 mt-1">{latest.symptoms}</p>}
                {normalizeMedicines(latest.medicines).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-50">
                    <p className="text-[11px] text-gray-400 font-medium mb-2">Medicines ({normalizeMedicines(latest.medicines).length})</p>
                    <div className="space-y-1.5">
                      {normalizeMedicines(latest.medicines).slice(0, 3).map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                          <span className="font-medium text-gray-700">{m.name || m.medicine || m}</span>
                          {m.dosage && <span className="text-gray-400">{m.dosage}</span>}
                          {m.frequency && <span className="text-gray-400">{m.frequency}</span>}
                        </div>
                      ))}
                      {normalizeMedicines(latest.medicines).length > 3 && (
                        <p className="text-xs text-gray-400 pl-3.5">+{normalizeMedicines(latest.medicines).length - 3} more medicines</p>
                      )}
                    </div>
                  </div>
                )}
                {latest.followUpDate && (
                  <div className="mt-3">
                    <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                      Follow-up: {new Date(latest.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">All Prescriptions ({prescriptions.length})</p>

          {prescriptions.map((p, i) => {
            const meds = normalizeMedicines(p.medicines);
            return (
              <PrescriptionCard key={p.id} prescription={p} meds={meds} index={i} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PrescriptionCard({ prescription: p, meds, index }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = meds.length > 4;
  const displayMeds = expanded ? meds : meds.slice(0, 4);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
      <div className="px-5 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm shrink-0">
            {p.doctor?.charAt(0) || 'D'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">Dr. {p.doctor || 'Doctor'}</p>
            <p className="text-xs text-gray-400 truncate">{p.specialization || ''} — {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm font-bold text-gray-800">{p.diagnosis || ''}</p>
        {p.symptoms && <p className="text-xs text-gray-400 mt-1">{p.symptoms}</p>}

        {p.symptoms && <div className="border-t border-gray-50 mt-3 pt-3" />}

        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-gray-400 font-medium">Medicines ({meds.length})</p>
        </div>
        <div className="space-y-1.5 mt-2">
          {displayMeds.map((m, j) => (
            <div key={j} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 mt-1.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-700">{m.name || m.medicine || m}</span>
                  <span className="text-xs text-gray-400">{m.dosage || ''}</span>
                  <span className="text-xs text-gray-400">{m.frequency || ''}</span>
                  <span className="text-xs text-gray-400">{m.duration || ''}</span>
                </div>
                {m.instructions && <p className="text-xs text-gray-500 mt-0.5">{m.instructions}</p>}
              </div>
            </div>
          ))}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            {expanded ? 'Show less' : `Show all ${meds.length} medicines`}
          </button>
        )}

        {p.followUpDate && (
          <div className="mt-4 pt-3 border-t border-gray-50">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Follow-up: {new Date(p.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    purple: 'text-violet-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className={`text-2xl md:text-3xl font-extrabold ${colors[color] || 'text-blue-600'}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-1 font-medium">{label}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-gray-200 rounded-lg" />
      <div className="h-4 w-72 bg-gray-100 rounded-lg" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="h-12 bg-gray-100 rounded-xl" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="h-64 bg-gray-100 rounded-2xl" />
    </div>
  );
}
