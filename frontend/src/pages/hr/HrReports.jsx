import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import {
  MdGroups, MdMedicalServices, MdLocalHospital, MdScience, MdConstruction, MdLocalPharmacy,
  MdPeople, MdAssignment, MdCheckCircle, MdWarning, MdRefresh, MdCalendarToday, MdBusiness,
  MdSchedule, MdNotificationImportant, MdPerson, MdTrendingUp, MdTrendingDown,
  MdFilterList, MdDownload, MdClose, MdAccessTime, MdErrorOutline,
} from 'react-icons/md';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts';

const DATE_PRESETS = [
  { label: 'This Month', days: 30 },
  { label: 'Last Month', days: -30 },
  { label: 'Last 3 Months', days: 90 },
  { label: 'Last 6 Months', days: 180 },
  { label: 'This Year', days: 365 },
];

const REPORT_TYPES = ['ALL', 'WORKFORCE', 'ALLOCATIONS', 'DUTY', 'SHIFTS'];

const CARD_COLORS = {
  blue: { bg: '#eff6ff', icon: '#2563eb', text: '#1e40af' },
  purple: { bg: '#faf5ff', icon: '#9333ea', text: '#6b21a8' },
  emerald: { bg: '#ecfdf5', icon: '#059669', text: '#047857' },
  rose: { bg: '#fff1f2', icon: '#e11d48', text: '#be123c' },
  orange: { bg: '#fff7ed', icon: '#ea580c', text: '#9a3412' },
  cyan: { bg: '#ecfeff', icon: '#0891b2', text: '#0e7490' },
  amber: { bg: '#fffbeb', icon: '#d97706', text: '#92400e' },
  indigo: { bg: '#eef2ff', icon: '#4f46e5', text: '#3730a3' },
  green: { bg: '#f0fdf4', icon: '#16a34a', text: '#166534' },
  red: { bg: '#fef2f2', icon: '#dc2626', text: '#991b1b' },
  teal: { bg: '#f0fdfa', icon: '#0d9488', text: '#115e59' },
};

const SOURCE_COLORS = { IPD: '#3b82f6', OT: '#8b5cf6', RECOVERY: '#059669' };
const PRIORITY_COLORS = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#6b7280' };
const DUTYTYPE_COLORS = { WARD: '#3b82f6', OT: '#8b5cf6', RECOVERY: '#059669', EMERGENCY: '#dc2626' };
const SHIFT_COLORS = { MORNING: '#f59e0b', EVENING: '#8b5cf6', NIGHT: '#4f46e5' };
const STATUS_COLORS = {
  PENDING: { bg: '#fefce8', text: '#a16207' },
  APPROVED: { bg: '#f0fdf4', text: '#15803d' },
  REJECTED: { bg: '#fef2f2', text: '#dc2626' },
  COMPLETED: { bg: '#eff6ff', text: '#1d4ed8' },
  TRANSFERRED: { bg: '#fdf4ff', text: '#9333ea' },
};

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return '0';
  return Number(n).toLocaleString('en-IN');
}

function getDateRange(preset) {
  const now = new Date();
  if (preset.days === -30) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - preset.days + 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function StatCard({ label, value, icon: Icon, color }) {
  const c = CARD_COLORS[color] || CARD_COLORS.blue;
  return (
    <div className="border border-gray-100 bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3.5 transition hover:shadow-md">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: c.bg, color: c.icon }}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-extrabold text-[#001B48] mt-0.5">{value ?? '—'}</p>
      </div>
    </div>
  );
}

export default function HrReports() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [reportType, setReportType] = useState('ALL');

  const [dateRange, setDateRange] = useState(() => getDateRange(DATE_PRESETS[0]));

  const load = useCallback(async (from, to, rt) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/hr/reports/analytics', {
        params: { from, to, reportType: rt },
        silent: true,
      });
      setData(res.data);
    } catch {
      setError('Failed to load HR reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(dateRange.from, dateRange.to, reportType);
  }, [load, dateRange, reportType]);

  const handlePreset = (idx) => {
    setSelectedPreset(idx);
    setShowCustom(false);
    setDateRange(getDateRange(DATE_PRESETS[idx]));
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      setShowCustom(true);
      setDateRange({ from: customFrom, to: customTo });
    }
  };

  const handleExport = () => {
    if (!data) return;
    const rows = [];
    rows.push('=== HR REPORTS & ANALYTICS ===');
    rows.push(`Period: ${data.meta?.from?.slice(0, 10)} → ${data.meta?.to?.slice(0, 10)}`);
    rows.push(`Type: ${data.meta?.reportType}`);
    rows.push('');

    const s = data.summary || {};
    rows.push('--- Workforce ---');
    Object.entries(s.workforce || {}).forEach(([k, v]) => rows.push(`${k},${v}`));
    rows.push('--- Allocations ---');
    Object.entries(s.allocations || {}).forEach(([k, v]) => rows.push(`${k},${v}`));
    rows.push('--- Duty ---');
    Object.entries(s.duty || {}).forEach(([k, v]) => rows.push(`${k},${v}`));
    rows.push('--- Shifts ---');
    Object.entries(s.shifts || {}).forEach(([k, v]) => rows.push(`${k},${v}`));
    rows.push('');

    const addSection = (title, arr, keys) => {
      if (!arr?.length) return;
      rows.push(`--- ${title} ---`);
      rows.push(keys.join(','));
      arr.forEach((r) => rows.push(keys.map((k) => r[k] ?? '').join(',')));
      rows.push('');
    };
    addSection('Workforce by Role', data.workforceByRole, ['role', 'count', 'active']);
    addSection('Workforce by Department', data.workforceByDepartment, ['department', 'total', 'available', 'assigned']);
    addSection('Allocations by Source', data.allocationsBySource, ['source', 'count', 'pending', 'approved']);
    addSection('Allocations by Priority', data.allocationsByPriority, ['priority', 'count']);
    addSection('Allocations by Status', data.allocationsByStatus, ['status', 'count']);
    addSection('Allocations by Day', data.allocationsByDay, ['date', 'label', 'created', 'resolved']);
    addSection('Duty by Type', data.dutyByType, ['dutyType', 'count']);
    addSection('Duty by Shift', data.dutyByShift, ['shift', 'count']);
    addSection('Duty by Day', data.dutyByDay, ['date', 'label', 'count']);
    addSection('Top Assigned Staff', data.topAssignedStaff, ['name', 'role', 'allocationCount', 'dutyCount']);
    addSection('Recent Rejections', data.recentRejections, ['requestNumber', 'patientName', 'reason', 'rejectedAt']);

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HR-Reports-${dateRange.from}_to_${dateRange.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = data?.summary || {};
  const wf = s.workforce || {};
  const al = s.allocations || {};
  const dr = s.duty || {};
  const sh = s.shifts || {};

  const summaryCards = data ? [
    { label: 'Total Workforce', value: fmtNum(wf.total), icon: MdGroups, color: 'blue' },
    { label: 'Active Staff', value: fmtNum(wf.active), icon: MdCheckCircle, color: 'green' },
    { label: 'Doctors', value: fmtNum(wf.doctors), icon: MdMedicalServices, color: 'purple' },
    { label: 'Nurses', value: fmtNum(wf.nurses), icon: MdLocalHospital, color: 'emerald' },
    { label: 'Allocation Requests', value: fmtNum(al.total), icon: MdAssignment, color: 'indigo' },
    { label: 'Pending', value: fmtNum(al.pending), icon: MdNotificationImportant, color: 'amber' },
    { label: 'Avg Approval', value: `${al.avgApprovalHours}h`, icon: MdAccessTime, color: 'teal' },
    { label: 'Duty Roster Entries', value: fmtNum(dr.totalDuties), icon: MdCalendarToday, color: 'blue' },
    { label: 'Shift Assignments', value: fmtNum(sh.totalAssignments), icon: MdSchedule, color: 'purple' },
  ] : [];

  return (
    <div className="w-full max-w-none bg-white min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-[#0077B6] rounded-2xl flex items-center justify-center shadow-sm shrink-0">
              <MdTrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#001B48]">Reports & Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">Historical workforce insights — allocations, duty roster & shifts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={!data}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-[#0077B6] bg-blue-50 border border-blue-150 hover:bg-blue-100/70 transition disabled:opacity-40"
            >
              <MdDownload className="w-4 h-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => load(dateRange.from, dateRange.to, reportType)}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0077B6] hover:bg-[#0077B6]/90 transition disabled:opacity-50 active:scale-95 shadow-sm"
            >
              <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="border border-gray-100 bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <MdFilterList className="w-5 h-5 text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Period:</span>
            {DATE_PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => handlePreset(i)}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition ${
                  selectedPreset === i && !showCustom
                    ? 'bg-[#0077B6] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(true)}
              className={`text-xs font-bold px-3.5 py-2 rounded-xl transition ${
                showCustom ? 'bg-[#0077B6] text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Custom Range
            </button>

            {showCustom && (
              <div className="flex items-center gap-2 ml-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-semibold" />
                <span className="text-xs text-gray-400 font-bold">to</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-semibold" />
                <button onClick={handleCustomApply} className="text-xs font-bold px-2.5 py-1.5 bg-[#0077B6] text-white rounded-xl hover:bg-[#0077B6]/90 transition">Apply</button>
                <button onClick={() => { setShowCustom(false); setSelectedPreset(0); setDateRange(getDateRange(DATE_PRESETS[0])); }} className="text-gray-400 hover:text-red-500 transition ml-1"><MdClose className="w-4.5 h-4.5" /></button>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Report:</span>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all font-semibold">
                {REPORT_TYPES.map((t) => <option key={t} value={t}>{t === 'ALL' ? 'All Reports' : t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm font-semibold flex items-center gap-2">
            <MdErrorOutline className="w-5 h-5 shrink-0" /> <span>{error}</span>
            <button onClick={() => load(dateRange.from, dateRange.to, reportType)} className="ml-auto text-xs font-bold text-red-700 hover:text-red-900 underline">Retry</button>
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-16"><p className="text-gray-400 text-sm font-semibold">Loading reports...</p></div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {summaryCards.map((c) => <StatCard key={c.label} {...c} />)}
            </div>

            {/* Workforce by Role + Department */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Workforce by Role" icon={MdGroups}>
                {data.workforceByRole?.length > 0 ? (
                  <div className="space-y-2.5">
                    {data.workforceByRole.map((r) => (
                      <div key={r.role} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <RoleBadge role={r.role} />
                          <span className="text-sm font-bold text-[#001B48]">{r.role.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold">
                          <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{r.active} active</span>
                          <span className="font-extrabold text-gray-900 w-8 text-right">{r.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState />}
              </Section>

              <Section title="Workforce by Department" icon={MdBusiness}>
                {data.workforceByDepartment?.length > 0 ? (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {data.workforceByDepartment.map((d) => (
                      <div key={d.department} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-sm font-bold text-[#001B48]">{d.department}</span>
                        <div className="flex items-center gap-4 text-xs font-semibold">
                          <span className="text-blue-650 bg-blue-50 px-2 py-0.5 rounded-full">{d.available} avail</span>
                          <span className="font-extrabold text-gray-900 w-8 text-right">{d.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState />}
              </Section>
            </div>

            {/* Allocations Section */}
            <Section title="Allocations Overview" icon={MdAssignment}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3.5">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">By Source</h4>
                  <div className="space-y-2.5">
                    {data.allocationsBySource?.length > 0 ? data.allocationsBySource.map((a) => (
                      <div key={a.source} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: SOURCE_COLORS[a.source] || '#6b7280' }} />
                          <span className="text-sm font-bold text-gray-700">{a.source}</span>
                        </div>
                        <div className="flex items-center gap-3.5 text-xs font-semibold">
                          <span className="text-amber-700">{a.pending} pending</span>
                          <span className="text-green-700">{a.approved} approved</span>
                          <span className="font-extrabold text-gray-905 w-8 text-right">{a.count}</span>
                        </div>
                      </div>
                    )) : <EmptyState />}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">By Priority</h4>
                    <div className="flex flex-wrap gap-2">
                      {data.allocationsByPriority?.length > 0 ? data.allocationsByPriority.map((p) => (
                        <div key={p.priority} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
                          <Badge variant={p.priority === 'CRITICAL' ? 'red' : p.priority === 'HIGH' ? 'amber' : 'blue'}>{p.priority}</Badge>
                          <span className="font-extrabold text-[#001B48] text-xs">{p.count}</span>
                        </div>
                      )) : <EmptyState />}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">By Status</h4>
                    <div className="flex flex-wrap gap-2">
                      {data.allocationsByStatus?.length > 0 ? data.allocationsByStatus.map((st) => {
                        const sc = STATUS_COLORS[st.status] || { bg: '#f3f4f6', text: '#6b7280' };
                        return (
                          <div key={st.status} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: sc.bg, color: sc.text }}>{st.status}</span>
                            <span className="font-extrabold text-[#001B48] text-xs">{st.count}</span>
                          </div>
                        );
                      }) : <EmptyState />}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Allocations by Day Chart */}
            {data.allocationsByDay?.length > 1 && (
              <Section title="Allocations by Day" icon={MdTrendingUp}>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.allocationsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                      <Bar dataKey="created" name="Created" fill="#0077B6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            {/* Duty Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Duty by Type" icon={MdAssignment}>
                {data.dutyByType?.length > 0 ? (
                  <div className="space-y-2.5">
                    {data.dutyByType.map((d) => (
                      <div key={d.dutyType} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: DUTYTYPE_COLORS[d.dutyType] || '#6b7280' }} />
                          <span className="text-sm font-bold text-gray-700">{d.dutyType}</span>
                        </div>
                        <span className="font-extrabold text-[#001B48]">{d.count}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState />}
              </Section>
              <Section title="Duty by Shift" icon={MdSchedule}>
                {data.dutyByShift?.length > 0 ? (
                  <div className="space-y-2.5">
                    {data.dutyByShift.map((s) => (
                      <div key={s.shift} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: SHIFT_COLORS[s.shift] || '#6b7280' }} />
                          <Badge variant={s.shift === 'MORNING' ? 'amber' : s.shift === 'EVENING' ? 'purple' : 'indigo'}>{s.shift}</Badge>
                        </div>
                        <span className="font-extrabold text-[#001B48]">{s.count}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState />}
              </Section>
            </div>

            {/* Duty by Day Chart */}
            {data.dutyByDay?.length > 1 && (
              <Section title="Duty Roster by Day" icon={MdCalendarToday}>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dutyByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                      <Bar dataKey="count" name="Duties" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            {/* Top Assigned Staff */}
            <Section title="Top Assigned Staff" icon={MdPerson}>
              {data.topAssignedStaff?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                      <tr>
                        <th className="text-left px-4 py-3">Name</th>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-center px-4 py-3">Allocations</th>
                        <th className="text-center px-4 py-3">Duties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.topAssignedStaff.map((t, i) => (
                        <tr key={t.employeeId || i} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-3.5 font-bold text-[#001B48]">{t.name}</td>
                          <td className="px-4 py-3.5"><RoleBadge role={t.role} /></td>
                          <td className="px-4 py-3.5 text-center font-extrabold text-[#0077B6]">{t.allocationCount}</td>
                          <td className="px-4 py-3.5 text-center text-gray-600 font-semibold">{t.dutyCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState />}
            </Section>

            {/* Recent Rejections */}
            {data.recentRejections?.length > 0 && (
              <Section title="Recent Allocation Rejections" icon={MdErrorOutline}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/70 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                      <tr>
                        <th className="text-left px-4 py-3">Request #</th>
                        <th className="text-left px-4 py-3">Patient</th>
                        <th className="text-left px-4 py-3">Reason</th>
                        <th className="text-right px-4 py-3">Rejected Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.recentRejections.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-3.5 font-mono text-xs font-bold text-[#0077B6]">{r.requestNumber}</td>
                          <td className="px-4 py-3.5 font-bold text-[#001B48]">{r.patientName}</td>
                          <td className="px-4 py-3.5 text-gray-500 font-semibold max-w-[200px] truncate">{r.reason}</td>
                          <td className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500">
                            {r.rejectedAt ? new Date(r.rejectedAt).toLocaleDateString('en-IN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`border border-gray-100 bg-white rounded-2xl shadow-sm p-5 ${className}`}>
      <h3 className="text-sm font-extrabold text-[#001B48] mb-4 flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-[#0077B6]" />}
        <span>{title}</span>
      </h3>
      {children}
    </div>
  );
}

function EmptyState() {
  return <p className="text-sm text-gray-400 py-4 text-center font-semibold">No data available</p>;
}

function RoleBadge({ role }) {
  if (!role) return <span className="text-xs text-gray-400">—</span>;
  const r = role.toLowerCase();
  let variant = 'gray';
  if (r.includes('doctor')) variant = 'purple';
  else if (r.includes('nurse')) variant = 'emerald';
  else if (r.includes('reception')) variant = 'amber';
  else if (r.includes('pharmacist')) variant = 'cyan';
  else if (r.includes('lab')) variant = 'rose';
  else if (r.includes('hr')) variant = 'indigo';
  else if (r.includes('ot')) variant = 'orange';
  return <Badge variant={variant}>{role.replace(/_/g, ' ')}</Badge>;
}
