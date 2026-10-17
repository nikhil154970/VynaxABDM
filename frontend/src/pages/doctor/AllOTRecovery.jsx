import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import {
  MdLocalHospital,
  MdHealing,
  MdSwapHoriz,
  MdAccessTime,
  MdRefresh,
  MdSearch,
  MdVisibility,
} from 'react-icons/md';

const RECOVERY_BADGE = {
  UNDER_OBSERVATION: { bg: 'rgba(249,115,22,0.1)', color: '#EA580C', label: 'Under Observation' },
  STABLE: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A', label: 'Stable' },
  READY_FOR_TRANSFER: { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Ready for Transfer' },
  TRANSFERRED: { bg: 'rgba(59,130,246,0.1)', color: '#1D4ED8', label: 'Transferred' },
  DISCHARGED: { bg: 'rgba(107,114,128,0.1)', color: '#6B7280', label: 'Discharged' },
};

function StatusBadge({ label, style }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border"
      style={{
        background: style?.bg || 'rgba(107,114,128,0.1)',
        color: style?.color || '#4B5563',
        borderColor: style?.color ? `${style.color}15` : 'rgba(107,114,128,0.15)',
      }}
    >
      {label}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, tone }) {
  const tones = {
    navy: { bg: '#001B48', light: '#E8F1F5' },
    blue: { bg: '#0077B6', light: '#E0F2FE' },
    amber: { bg: '#B45309', light: '#FEF3C7' },
    teal: { bg: '#0F766E', light: '#CCFBF1' },
  };
  const t = tones[tone] || tones.blue;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: t.light }}>
          <Icon className="h-6 w-6" style={{ color: t.bg }} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-extrabold text-gray-900 leading-tight sm:text-2xl">{value}</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 truncate">{title}</p>
        </div>
      </div>
    </div>
  );
}

export default function AllOTRecovery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detailSession, setDetailSession] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/doctor/ot/recovery');
      setItems(res.data?.items || []);
      setError('');
    } catch (e) {
      setError('Failed to load recovery patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (sessionId) => {
    setDetailLoading(true);
    setDetailSession(null);
    try {
      const [detailRes, assessRes, timelineRes] = await Promise.all([
        api.get(`/doctor/ot/recovery/${sessionId}`),
        api.get(`/doctor/ot/recovery/${sessionId}/assessments`),
        api.get(`/doctor/ot/recovery/${sessionId}/timeline`),
      ]);
      setDetailSession({
        session: detailRes.data?.session,
        assessments: assessRes.data?.assessments || [],
        timeline: timelineRes.data?.timeline || [],
      });
    } catch (e) {
      setError('Failed to load recovery details');
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (filter !== 'all') {
      list = list.filter((i) => {
        if (filter === 'in-recovery') return i.currentLocation === 'Recovery Room';
        if (filter === 'transferred') return i.currentLocation !== 'Recovery Room';
        return i.recoveryStatus === filter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.patientName?.toLowerCase().includes(q) ||
        i.uhid?.toLowerCase().includes(q) ||
        i.admissionNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, filter, search]);

  const counts = useMemo(() => ({
    all: items.length,
    inRecovery: items.filter((i) => i.currentLocation === 'Recovery Room').length,
    transferred: items.filter((i) => i.currentLocation !== 'Recovery Room').length,
    critical: items.filter((i) => i.recoveryStatus === 'UNDER_OBSERVATION').length,
  }), [items]);

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdHealing className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">All OT Recovery</h1>
            
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0077B6] border border-blue-150 bg-blue-50/50 hover:bg-blue-50 active:scale-95 transition-all duration-200 shrink-0 self-start sm:self-auto"
          >
            <MdRefresh className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Recovery" value={counts.all} icon={MdHealing} tone="blue" />
          <StatCard title="In Recovery Room" value={counts.inRecovery} icon={MdLocalHospital} tone="navy" />
          <StatCard title="Transferred" value={counts.transferred} icon={MdSwapHoriz} tone="teal" />
          <StatCard title="Under Observation" value={counts.critical} icon={MdAccessTime} tone="amber" />
        </div>

        {/* Content Box */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 px-5 py-4 bg-gray-50/30">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: `All (${counts.all})` },
                { key: 'in-recovery', label: `In Recovery (${counts.inRecovery})` },
                { key: 'transferred', label: `Transferred (${counts.transferred})` },
                { key: 'UNDER_OBSERVATION', label: `Under Observation (${counts.critical})` },
              ].map((f) => (
                <button
                  key={f.key}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold border transition-all duration-200 ${
                    filter === f.key
                      ? 'bg-[#0077B6] text-white border-transparent shadow-sm'
                      : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <MdSearch className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                className="rounded-xl border border-gray-200 pl-9 pr-4 py-2 text-xs outline-none w-full sm:w-60 focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
                placeholder="Search patient, UHID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500 font-semibold text-sm">
                <div className="w-8 h-8 border-3 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
                Loading recovery logs...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-500 font-semibold text-sm">
                No recovery patient sessions found.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50/70">
                  <tr>
                    <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Patient</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">UHID</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Surgery</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Recovery Status</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Current Location</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Latest Assessment</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filtered.map((item) => (
                    <tr
                      key={item.sessionId}
                      className="hover:bg-gray-50/50 cursor-pointer transition-colors duration-150"
                      onClick={() => openDetail(item.sessionId)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{item.patientName}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-600 font-mono">{item.uhid}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800 max-w-[150px] truncate">{item.surgeryName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge
                          label={RECOVERY_BADGE[item.recoveryStatus]?.label || item.recoveryStatus}
                          style={RECOVERY_BADGE[item.recoveryStatus]}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-600">{item.currentLocation}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-600">
                        {item.latestAssessment ? (
                          <span>BP {item.latestAssessment.bpSystolic}/{item.latestAssessment.bpDiastolic} | Pulse {item.latestAssessment.pulse}</span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#0077B6] bg-[#0077B6]/10 hover:bg-[#0077B6]/20 transition-all active:scale-95 duration-200"
                          onClick={() => openDetail(item.sessionId)}
                        >
                          <MdVisibility className="w-3.5 h-3.5" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recovery Detail Modal */}
      {detailSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-transparent cursor-default"
            onClick={() => setDetailSession(null)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#0077B6] shrink-0">
                  <MdHealing className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-[#001B48] truncate">Recovery Details</h3>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5 truncate">
                    Patient: {detailSession.session?.surgerySchedule?.otRequest?.patient?.name || '—'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailSession(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 transition-all duration-200"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 bg-white">
              {detailLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500 font-semibold text-sm">
                  <div className="w-8 h-8 border-3 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
                  Loading recovery patient logs...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Block */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50/50 border border-gray-100 p-5 rounded-2xl text-xs">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Patient</p>
                      <p className="font-bold text-gray-900 text-sm">{detailSession.session?.surgerySchedule?.otRequest?.patient?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">UHID</p>
                      <p className="font-bold text-gray-900 font-mono text-sm">{detailSession.session?.surgerySchedule?.otRequest?.patient?.uhid || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Surgery</p>
                      <p className="font-bold text-gray-900 text-sm truncate">{detailSession.session?.surgerySchedule?.otRequest?.surgeryRecommendation || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Recovery Status</p>
                      <div className="mt-1">
                        <StatusBadge
                          label={RECOVERY_BADGE[detailSession.session?.recoveryRecord?.status]?.label || detailSession.session?.recoveryRecord?.status}
                          style={RECOVERY_BADGE[detailSession.session?.recoveryRecord?.status]}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
                      <p className="font-semibold text-gray-900 text-sm mt-0.5">{detailSession.session?.recoveryRecord?.transferredTo || 'Recovery Room'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Admitted</p>
                      <p className="font-semibold text-gray-900 text-sm mt-0.5">
                        {detailSession.session?.recoveryRecord?.admittedAt ? new Date(detailSession.session.recoveryRecord.admittedAt).toLocaleString('en-IN') : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Timeline section */}
                  <div>
                    <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3">Recovery Timeline</h4>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {detailSession.timeline.length === 0 ? (
                        <p className="text-xs font-semibold text-gray-500 italic py-2">No timeline events recorded.</p>
                      ) : (
                        detailSession.timeline.map((t) => (
                          <div key={t.id} className="flex gap-3 text-xs border-l-2 border-[#0077B6]/30 pl-4 relative">
                            <div className="absolute w-2 h-2 rounded-full bg-[#0077B6] -left-[5px] top-1.5"></div>
                            <span className="text-gray-400 font-medium w-36 shrink-0">
                              {new Date(t.createdAt).toLocaleString('en-IN')}
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-[#001B48]">{t.eventType}</span>
                              <span className="text-gray-500 font-medium">{t.eventDescription || ''}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Assessment History section */}
                  <div>
                    <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3">Post Assessment History</h4>
                    {detailSession.assessments.length === 0 ? (
                      <p className="text-xs font-semibold text-gray-500 italic py-2">No assessments recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-100 max-h-[250px] overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-100 text-xs">
                          <thead className="bg-gray-50/70 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">Time</th>
                              <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">BP (mmHg)</th>
                              <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">Pulse (bpm)</th>
                              <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">Temp (°F)</th>
                              <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">SpO2 (%)</th>
                              <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">Pain Score</th>
                              <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {detailSession.assessments.map((a) => (
                              <tr key={a.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-2.5 font-medium text-gray-500">{new Date(a.createdAt).toLocaleString('en-IN')}</td>
                                <td className="px-4 py-2.5 font-semibold text-gray-900">{a.bpSystolic}/{a.bpDiastolic}</td>
                                <td className="px-4 py-2.5 font-semibold text-gray-900">{a.pulse}</td>
                                <td className="px-4 py-2.5 font-semibold text-gray-900">{a.temperature || '—'}</td>
                                <td className="px-4 py-2.5 font-semibold text-gray-900">{a.spo2}</td>
                                <td className="px-4 py-2.5 font-bold text-[#001B48]">{a.painScore}/10</td>
                                <td className="px-4 py-2.5">
                                  <span className="font-semibold text-gray-700">{a.status || '-'}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
