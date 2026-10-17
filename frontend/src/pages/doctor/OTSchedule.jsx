import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import SurgeryReportModal from './SurgeryReportModal';
import {
  MdLocalHospital,
  MdCalendarToday,
  MdAccessTime,
  MdCheckCircle,
  MdRefresh,
  MdSearch,
  MdVisibility,
} from 'react-icons/md';

const STATUS_BADGE = {
  SCHEDULED: { bg: 'rgba(59,130,246,0.1)', color: '#2563EB' },
  IN_PROGRESS: { bg: 'rgba(249,115,22,0.1)', color: '#EA580C' },
  COMPLETED: { bg: 'rgba(22,163,74,0.1)', color: '#16A34A' },
  DELAYED: { bg: 'rgba(239,68,68,0.1)', color: '#DC2626' },
  CANCELLED: { bg: 'rgba(107,114,128,0.1)', color: '#4B5563' },
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

export default function OTSchedule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailSchedule, setDetailSchedule] = useState(null);
  const [reportScheduleId, setReportScheduleId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/doctor/ot/schedule');
      setItems(res.data?.items || []);
      setError('');
    } catch (e) {
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (filter !== 'all') list = list.filter((i) => i.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.otRequest?.patient?.name?.toLowerCase().includes(q) ||
        i.otRequest?.patient?.uhid?.toLowerCase().includes(q) ||
        i.otRequest?.admission?.ipdNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, filter, search]);

  const counts = useMemo(() => ({
    all: items.length,
    SCHEDULED: items.filter((i) => i.status === 'SCHEDULED').length,
    IN_PROGRESS: items.filter((i) => i.status === 'IN_PROGRESS').length,
    COMPLETED: items.filter((i) => i.status === 'COMPLETED').length,
  }), [items]);

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdLocalHospital className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">OT Schedule</h1>
         
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
          <StatCard title="Total Surgeries" value={counts.all} icon={MdLocalHospital} tone="blue" />
          <StatCard title="Scheduled" value={counts.SCHEDULED} icon={MdCalendarToday} tone="navy" />
          <StatCard title="In Progress" value={counts.IN_PROGRESS} icon={MdAccessTime} tone="amber" />
          <StatCard title="Completed" value={counts.COMPLETED} icon={MdCheckCircle} tone="teal" />
        </div>

        {/* Content Box */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 px-5 py-4 bg-gray-50/30">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: `All (${counts.all})` },
                { key: 'SCHEDULED', label: `Scheduled (${counts.SCHEDULED})` },
                { key: 'IN_PROGRESS', label: `In Progress (${counts.IN_PROGRESS})` },
                { key: 'COMPLETED', label: `Completed (${counts.COMPLETED})` },
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
                placeholder="Search patient name, UHID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500 font-semibold text-sm">
                <div className="w-8 h-8 border-3 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
                Loading surgeries...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-500 font-semibold text-sm">
                No surgeries scheduled.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50/70">
                  <tr>
                    <th className="px-3.5 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Patient</th>
                    <th className="px-3.5 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">UHID</th>
                    <th className="px-3.5 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Admission No</th>
                    <th className="px-3.5 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Surgery</th>
                    <th className="px-3.5 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">OT Room</th>
                    <th className="px-3.5 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Date</th>
                    <th className="px-3.5 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Time</th>
                    <th className="px-3.5 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Status</th>
                    <th className="px-3.5 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50/50 cursor-pointer transition-colors duration-150"
                      onClick={() => setDetailSchedule(s)}
                    >
                      <td className="px-3.5 py-3 whitespace-nowrap font-bold text-gray-900">
                        {s.otRequest?.patient?.name || '-'}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap font-semibold text-gray-600 font-mono text-xs">
                        {s.otRequest?.patient?.uhid || '-'}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap font-semibold text-gray-600 font-mono text-xs">
                        {s.otRequest?.admission?.ipdNumber || '-'}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap font-medium text-gray-800 max-w-[120px] truncate">
                        {s.otRequest?.surgeryRecommendation || '-'}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap font-semibold text-gray-600">
                        {s.otRoom?.roomName || '-'}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap font-medium text-[#001B48]">
                        {s.surgeryDate ? new Date(s.surgeryDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap font-medium text-gray-600">
                        {s.startTime || '-'}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <StatusBadge label={s.status} style={STATUS_BADGE[s.status]} />
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        {s.status === 'SCHEDULED' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            Awaiting OT Start
                          </span>
                        )}
                        {s.status === 'IN_PROGRESS' && s.surgerySession?.status === 'IN_PROGRESS' && (
                          <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] transition-all shadow-sm active:scale-95 duration-200"
                            onClick={() => setReportScheduleId(s.id)}
                          >
                            Submit Surgery Report
                          </button>
                        )}
                        {(s.status === 'COMPLETED' || s.surgerySession?.status === 'RECOVERY') && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                            In Recovery
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detailSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-transparent cursor-default"
            onClick={() => setDetailSchedule(null)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#0077B6] shrink-0">
                  <MdLocalHospital className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-[#001B48] truncate">Surgery Details</h3>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5 truncate">
                    Patient: {detailSchedule.otRequest?.patient?.name || '—'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailSchedule(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 transition-all duration-200"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-1 bg-white">
              <DetailRow label="Patient" value={detailSchedule.otRequest?.patient?.name} />
              <DetailRow label="UHID" value={detailSchedule.otRequest?.patient?.uhid} />
              <DetailRow label="Admission No" value={detailSchedule.otRequest?.admission?.ipdNumber} />
              <DetailRow label="Surgery Name" value={detailSchedule.otRequest?.surgeryRecommendation} />
              <DetailRow label="Diagnosis" value={detailSchedule.otRequest?.diagnosis} />
              <DetailRow label="Priority" value={detailSchedule.otRequest?.priority} />
              <DetailRow label="OT Room" value={detailSchedule.otRoom?.roomName} />
              <DetailRow label="Scheduled Date" value={detailSchedule.surgeryDate ? new Date(detailSchedule.surgeryDate).toLocaleDateString('en-IN') : '-'} />
              <DetailRow label="Scheduled Time" value={detailSchedule.startTime} />
              <DetailRow label="Assigned Nurse" value={detailSchedule.otNurse?.name || '-'} />
              <DetailRow label="Anaesthetist" value={detailSchedule.anaesthetist?.user?.name || '-'} />
              <div className="flex items-center justify-between py-3 border-b border-gray-100 text-sm">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[11px]">Status</span>
                <StatusBadge label={detailSchedule.status} style={STATUS_BADGE[detailSchedule.status]} />
              </div>
            </div>
          </div>
        </div>
      )}

      {reportScheduleId && (
        <SurgeryReportModal
          scheduleId={reportScheduleId}
          onClose={() => setReportScheduleId(null)}
          onComplete={() => { setReportScheduleId(null); load(); }}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 text-sm">
      <span className="font-bold text-gray-400 uppercase tracking-wider text-[11px]">{label}</span>
      <span className="font-bold text-gray-900 text-right max-w-[65%] truncate">{value || '—'}</span>
    </div>
  );
}
