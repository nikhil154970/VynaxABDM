import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { MdPlayArrow, MdRefresh } from 'react-icons/md';

function StatusPill({ status }) {
  const s = String(status || 'WAITING');
  const normalized = s.toUpperCase();
  const meta =
    normalized === 'COMPLETED'
      ? { bg: 'rgba(22,163,74,0.1)', fg: '#16A34A', label: 'Completed' }
      : normalized === 'IN_PROGRESS'
        ? { bg: 'rgba(0,119,182,0.1)', fg: '#0077B6', label: 'In Progress' }
        : { bg: 'rgba(71,85,105,0.1)', fg: '#475569', label: 'Waiting' };

  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold"
      style={{ background: meta.bg, color: meta.fg, borderColor: `${meta.fg}25` }}>
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

  return (
    <div className="min-h-screen w-full max-w-none bg-gradient-to-b from-slate-50/60 to-white">
      <div className="space-y-5 px-4 py-6 pb-12 sm:px-6 lg:px-8 xl:px-10">
        {/* Page title is shown in the shared application header. */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-95"
          >
            <MdRefresh className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Content Table Container */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-200">Time</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-200">Patient Name</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-200">OPD No</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-200">Status</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-200">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500 font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
                        Loading appointments...
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500 font-semibold">
                      No appointments scheduled for today.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const isActive = activeId === r.id;
                    const isCompleted = String(r.status || '').toUpperCase() === 'COMPLETED';
                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors duration-150 cursor-pointer ${
                          isActive ? 'bg-sky-50/80' : 'hover:bg-slate-50/80'
                        }`}
                        onClick={() => {
                          if (isCompleted) return;
                          setActiveId(r.id);
                          navigate(`/dashboard/doctor/opd/consultation?appointmentId=${encodeURIComponent(r.id)}`);
                        }}
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-extrabold text-slate-900">
                          {r.time || '—'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-bold text-slate-900">
                          {r.patient_name || '—'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-500">
                          {r.opd_number || r.opdNumber || '—'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          {!isCompleted ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveId(r.id);
                                navigate(`/dashboard/doctor/opd/consultation?appointmentId=${encodeURIComponent(r.id)}`);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077B6] px-3 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:bg-[#005B8C] hover:shadow active:scale-95"
                            >
                              <MdPlayArrow className="h-3.5 w-3.5" /> Start Consultation
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
    </div>
  );
}

