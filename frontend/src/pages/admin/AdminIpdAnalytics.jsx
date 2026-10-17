import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import {
  MdPeople, MdEventAvailable, MdMedicalServices, MdCurrencyRupee,
  MdTrendingUp, MdTrendingDown, MdRefresh, MdFilterList,
  MdLocalHospital, MdCheckCircle, MdPendingActions,
  MdSchedule, MdTimeline, MdPerson, MdBed,
} from 'react-icons/md';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { DEPARTMENTS } from '../../constants/departments';

const DATE_PRESETS = [
  { label: 'Today', days: 1 },
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: 'Last Month', days: -30 },
  { label: 'This Year', days: 365 },
];

const STATUS_COLORS = {
  'Admitted': { bg: '#eff6ff', bar: '#3b82f6' },
  'Under Treatment': { bg: '#fefce8', bar: '#f59e0b' },
  'Ready for Discharge': { bg: '#f0fdf4', bar: '#22c55e' },
  'Discharge Requested': { bg: '#fdf2f8', bar: '#ec4899' },
};

const WARD_TYPE_COLORS = {
  'General': { bg: '#eff6ff', bar: '#3b82f6' },
  'ICU': { bg: '#fdf2f8', bar: '#ec4899' },
  'Private': { bg: '#fefce8', bar: '#f59e0b' },
  'Unassigned': { bg: '#f3f4f6', bar: '#6b7280' },
};

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

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

export default function AdminIpdAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [activePreset, setActivePreset] = useState(2);
  const [dateRange, setDateRange] = useState(() => getDateRange(DATE_PRESETS[2]));
  const [department, setDepartment] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [wardType, setWardType] = useState('');
  const [doctors, setDoctors] = useState([]);

  const load = useCallback(async (from, to, dept, docId, wType) => {
    setLoading(true);
    setError('');
    try {
      const params = { from, to };
      if (dept) params.department = dept;
      if (docId) params.doctorId = docId;
      if (wType) params.wardType = wType;
      const res = await api.get('/admin/ipd/analytics', { params, silent: true });
      setData(res.data || null);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.message || 'Failed to load IPD analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(dateRange.from, dateRange.to, department, doctorId, wardType);
  }, [dateRange, department, doctorId, wardType, load]);

  useEffect(() => {
    api.get('/doctors/lookup', { silent: true }).then((res) => {
      const rows = Array.isArray(res?.data?.items) ? res.data.items : [];
      setDoctors(rows);
    }).catch(() => setDoctors([]));
  }, []);

  const handlePreset = (idx) => {
    setActivePreset(idx);
    setDateRange(getDateRange(DATE_PRESETS[idx]));
  };

  const summaryCards = useMemo(() => {
    const s = data?.summary || {};
    const change = s.changeVsPrevPeriod || {};
    const admtUp = (change.admissions || 0) >= 0;
    const dischUp = (change.discharges || 0) >= 0;
    const revUp = (change.revenue || 0) >= 0;
    return [
      {
        label: 'Active Admissions Now',
        value: loading ? '—' : fmtNum(s.activeAdmissionsNow),
        sub: `${s.icuPatientsNow ?? 0} in ICU`,
        Icon: MdLocalHospital,
        color: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8',
      },
      {
        label: 'New Admissions',
        value: loading ? '—' : fmtNum(s.newAdmissionsInPeriod),
        sub: `${admtUp ? '+' : ''}${change.admissions ?? 0}% vs prev`,
        Icon: MdPerson,
        color: '#f0fdf4', border: '#bbf7d0', text: '#15803d',
        trend: admtUp ? MdTrendingUp : MdTrendingDown,
        trendColor: admtUp ? '#15803d' : '#dc2626',
      },
      {
        label: 'Discharges',
        value: loading ? '—' : fmtNum(s.dischargesInPeriod),
        sub: `${dischUp ? '+' : ''}${change.discharges ?? 0}% vs prev`,
        Icon: MdEventAvailable,
        color: '#fefce8', border: '#fde68a', text: '#a16207',
        trend: dischUp ? MdTrendingUp : MdTrendingDown,
        trendColor: dischUp ? '#15803d' : '#dc2626',
      },
      {
        label: 'Avg Stay Duration',
        value: loading ? '—' : `${s.avgLengthOfStayDays ?? 0} days`,
        sub: `${s.dischargeRequestedNow ?? 0} discharge requests`,
        Icon: MdTimeline,
        color: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce',
      },
      {
        label: 'Bed Occupancy',
        value: loading ? '—' : `${s.bedOccupancyPct ?? 0}%`,
        sub: `${s.bedsOccupied ?? 0} / ${s.bedsTotal ?? 0} beds`,
        Icon: MdBed,
        color: '#f0f9ff', border: '#bae6fd', text: '#0369a1',
      },
      {
        label: 'IPD Revenue Billed',
        value: loading ? '—' : fmt(s.ipdRevenueBilled),
        sub: `${revUp ? '+' : ''}${change.revenue ?? 0}% vs prev`,
        Icon: MdCurrencyRupee,
        color: '#f0fdf4', border: '#bbf7d0', text: '#15803d',
        trend: revUp ? MdTrendingUp : MdTrendingDown,
        trendColor: revUp ? '#15803d' : '#dc2626',
      },
      {
        label: 'Collected',
        value: loading ? '—' : fmt(s.ipdRevenueCollected),
        sub: `Pending: ${fmt(s.ipdRevenuePending)}`,
        Icon: MdCurrencyRupee,
        color: '#fffbeb', border: '#fde68a', text: '#92400e',
      },
    ];
  }, [data, loading]);

  const statusData = useMemo(() => {
    return Array.isArray(data?.statusBreakdown) ? data.statusBreakdown : [];
  }, [data]);

  const admissionChartData = useMemo(() => {
    return (Array.isArray(data?.admissionsByDay) ? data.admissionsByDay : []).map((d) => ({
      ...d,
      discharges: d.discharges || 0,
      admissions: d.admissions || 0,
    }));
  }, [data]);

  const revenueChartData = useMemo(() => {
    return (Array.isArray(data?.revenueByDay) ? data.revenueByDay : []).map((d) => ({
      ...d, collected: d.collected || 0, billed: d.billed || 0,
    }));
  }, [data]);

  const byDepartment = useMemo(() => {
    return Array.isArray(data?.byDepartment) ? data.byDepartment : [];
  }, [data]);

  const byWardType = useMemo(() => {
    return Array.isArray(data?.byWardType) ? data.byWardType : [];
  }, [data]);

  const topDoctors = useMemo(() => {
    return Array.isArray(data?.topDoctors) ? data.topDoctors : [];
  }, [data]);

  const recentAdmissions = useMemo(() => {
    return Array.isArray(data?.recentAdmissions) ? data.recentAdmissions : [];
  }, [data]);

  const recentDischarges = useMemo(() => {
    return Array.isArray(data?.recentDischarges) ? data.recentDischarges : [];
  }, [data]);

  const maxDeptAdmissions = Math.max(1, ...byDepartment.map((d) => d.admissions));
  const maxWardActive = Math.max(1, ...byWardType.map((w) => w.activeNow));
  const maxDoctorAdmissions = Math.max(1, ...topDoctors.map((d) => d.admissions));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {entry.name === 'Billed' || entry.name === 'Collected' ? fmt(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">IPD Analytics</h1>
          <p className="text-xs text-gray-400 mt-1">
            {dateRange.from} → {dateRange.to}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(dateRange.from, dateRange.to, department, doctorId, wardType)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
        >
          <MdRefresh className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => load(dateRange.from, dateRange.to, department, doctorId, wardType)} className="ml-3 text-xs font-semibold underline">Retry</button>
        </div>
      ) : null}

      {loading && !data && !error ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Loading IPD analytics…
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            onClick={() => handlePreset(i)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
              activePreset === i
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <MdFilterList className="w-4 h-4 text-gray-400" />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <MdPerson className="w-4 h-4 text-gray-400" />
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
          >
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name} — {d.specialization || ''}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <MdBed className="w-4 h-4 text-gray-400" />
          <select
            value={wardType}
            onChange={(e) => setWardType(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
          >
            <option value="">All Ward Types</option>
            <option value="GENERAL">General</option>
            <option value="ICU">ICU</option>
            <option value="PRIVATE">Private</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((s) => {
          const TrendIcon = s.trend;
          return (
            <div
              key={s.label}
              className="bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition"
              style={{ borderColor: s.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl" style={{ color: '#0077B6' }}>
                  <s.Icon className="w-6 h-6" />
                </span>
                {TrendIcon && (
                  <TrendIcon className="w-4 h-4" style={{ color: s.trendColor }} />
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Active Admissions by Status</h2>
          {statusData.length > 0 ? (
            <div className="space-y-2.5">
              {statusData.map((s) => {
                const total = statusData.reduce((a, b) => a + b.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                const colors = STATUS_COLORS[s.status] || { bar: '#6b7280' };
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{s.status}</span>
                      <span className="font-semibold text-gray-900">{fmtNum(s.count)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: colors.bar }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{pct}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">No data</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Ward Type Distribution</h2>
          {byWardType.length > 0 ? (
            <div className="space-y-2.5">
              {byWardType.map((w) => {
                const total = byWardType.reduce((a, b) => a + b.activeNow, 0);
                const pct = total > 0 ? Math.round((w.activeNow / total) * 100) : 0;
                const colors = WARD_TYPE_COLORS[w.wardType] || { bar: '#6b7280' };
                return (
                  <div key={w.wardType}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{w.wardType}</span>
                      <span className="font-semibold text-gray-900">
                        {fmtNum(w.activeNow)} active · {fmtNum(w.admissions)} new
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: colors.bar }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{pct}% of active</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">No data</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Admissions / Discharges by Day</h2>
          {admissionChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={admissionChartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Bar dataKey="admissions" name="Admissions" fill="#3b82f6" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="discharges" name="Discharges" fill="#22c55e" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">IPD Revenue by Day</h2>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Bar dataKey="billed" name="Billed" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Admissions by Department</h2>
          </div>
          {byDepartment.length > 0 ? (
            <div className="p-4 space-y-2.5">
              {byDepartment.slice(0, 8).map((d) => (
                <div key={d.department}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{d.department}</span>
                    <span className="font-semibold text-gray-900">
                      {fmtNum(d.admissions)} admits · {fmtNum(d.activeNow)} active
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.round((d.admissions / maxDeptAdmissions) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">{fmt(d.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">No data</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Top Doctors</h2>
          </div>
          {topDoctors.length > 0 ? (
            <div className="p-4 space-y-2.5">
              {topDoctors.slice(0, 8).map((d) => (
                <div key={d.doctorId}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-medium text-gray-700">{d.name}</span>
                    <span className="font-semibold text-gray-900">{fmtNum(d.admissions)} admits</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-1">{d.discharges} discharges · {fmt(d.revenue)}</p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.round((d.admissions / maxDoctorAdmissions) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">No data</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Recent Admissions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">IPD No.</th>
                  <th className="px-5 py-3">UHID</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Ward</th>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
                ) : recentAdmissions.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No admissions in this period.</td></tr>
                ) : recentAdmissions.map((a, idx) => (
                  <tr key={`adm-${a.uhid}-${idx}`} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-gray-800">{a.patientName}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{a.ipdNumber}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{a.uhid}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{a.department}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{a.ward}</td>
                    <td className="px-5 py-3 text-xs text-gray-700">{a.doctorName}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1"
                        style={{
                          backgroundColor: (STATUS_COLORS[a.status] || {}).bg || '#f9fafb',
                          color: '#374151',
                          ringColor: '#e5e7eb',
                        }}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {a.at ? new Date(a.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Recent Discharges</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">IPD No.</th>
                  <th className="px-5 py-3">UHID</th>
                  <th className="px-5 py-3">Stay (days)</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
                ) : recentDischarges.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No discharges in this period.</td></tr>
                ) : recentDischarges.map((d, idx) => (
                  <tr key={`dis-${d.uhid}-${idx}`} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-gray-800">{d.patientName}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{d.ipdNumber}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{d.uhid}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{d.lengthOfStayDays}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                        d.dischargeStatus === 'Discharged with Dues'
                          ? 'bg-red-50 text-red-700 ring-red-200'
                          : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      }`}>
                        {d.dischargeStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {d.at ? new Date(d.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
