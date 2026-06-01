import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

function StatusPill({ status }) {
  const s = String(status || 'WAITING');
  const normalized = s.toUpperCase();
  const meta =
    normalized === 'COMPLETED'
      ? { bg: 'rgba(22,163,74,0.12)', fg: '#15803d', label: 'Completed' }
      : normalized === 'IN_PROGRESS'
        ? { bg: 'rgba(0,174,239,0.14)', fg: '#0369a1', label: 'In Progress' }
        : { bg: 'rgba(148,163,184,0.18)', fg: '#475569', label: 'Waiting' };

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold"
      style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

export default function TodayAppointments() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments/today');
      const data = res.data?.appointments || [];
      setRows(data);
      if (!activeId && data[0]?.id) setActiveId(data[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      try {
        await load();
      } catch {
        if (!alive) return;
        setRows([]);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = useMemo(() => 'Today Appointments', []);

  return (
    <div className="p-6 space-y-4" style={{ background: '#F5F7FA' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={load}
          className="px-3 py-2 rounded-xl text-xs font-extrabold text-white"
          style={{ background: '#E53935' }}
        >
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: '#F5F7FA' }}>
                <th className="px-5 py-3 font-extrabold text-gray-700">Time</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">Patient Name</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">OPD No</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">Status</th>
                <th className="px-5 py-3 font-extrabold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-6 text-gray-500">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-6 text-gray-500">No appointments.</td></tr>
              ) : (
                rows.map((r) => {
                  const isActive = activeId === r.id;
                  const isCompleted = String(r.status || '').toUpperCase() === 'COMPLETED';
                  return (
                    <tr
                      key={r.id}
                      className="border-t cursor-pointer"
                      style={{
                        borderColor: 'rgba(0,0,0,0.06)',
                        background: isActive ? 'rgba(0,174,239,0.10)' : '#FFFFFF',
                      }}
                      onClick={() => {
                        if (isCompleted) return;
                        setActiveId(r.id);
                        navigate(`/dashboard/doctor/opd/consultation?patientId=${encodeURIComponent(r.patient_id || '')}`);
                      }}
                    >
                      <td className="px-5 py-3 font-extrabold text-gray-900">{r.time || '—'}</td>
                      <td className="px-5 py-3 text-gray-900">{r.patient_name || '—'}</td>
                      <td className="px-5 py-3 text-gray-700">{r.opd_number || r.opdNumber || '—'}</td>
                      <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                      <td className="px-5 py-3">
                        {!isCompleted ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveId(r.id);
                              navigate(`/dashboard/doctor/opd/consultation?patientId=${encodeURIComponent(r.patient_id || '')}`);
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-extrabold text-white"
                            style={{ background: '#00AEEF' }}
                          >
                            Start Consultation
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

