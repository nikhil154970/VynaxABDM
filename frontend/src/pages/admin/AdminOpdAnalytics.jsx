import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import {
  MdPeople, MdEventAvailable, MdMedicalServices, MdCurrencyRupee,
  MdTrendingUp, MdTrendingDown, MdRefresh, MdFilterList,
  MdLocalHospital, MdScience, MdCheckCircle, MdPendingActions,
  MdSchedule, MdTimeline, MdSearch, MdPerson,
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

const STATUS_BADGE = {
  WAITING: 'bg-amber-50 text-amber-800 ring-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-800 ring-blue-200',
  IN_CONSULTATION: 'bg-blue-50 text-blue-800 ring-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ADMITTED: 'bg-purple-50 text-purple-800 ring-purple-200',
};

const STATUS_LABEL = {
  WAITING: 'Waiting',
  IN_PROGRESS: 'In consultation',
  IN_CONSULTATION: 'In consultation',
  COMPLETED: 'Completed',
  ADMITTED: 'Admitted',
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

export default function AdminOpdAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [activePreset, setActivePreset] = useState(2);
  const [dateRange, setDateRange] = useState(() => getDateRange(DATE_PRESETS[2]));
  const [department, setDepartment] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);

  const load = useCallback(async (from, to, dept, docId) => {
    setLoading(true);
    setError('');
    try {
      const params = { from, to };
      if (dept) params.department = dept;
      if (docId) params.doctorId = docId;
      const res = await api.get('/admin/opd/analytics', { params });
      setData(res.data || null);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.message || 'Failed to load OPD analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(dateRange.from, dateRange.to, department, doctorId);
  }, [dateRange, department, doctorId, load]);

  useEffect(() => {
    api.get('/doctors/lookup').then((res) => {
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
    const vUp = (change.visits || 0) >= 0;
    const rUp = (change.revenue || 0) >= 0;
    return [
      {
        label: 'OPD Visits',
        value: loading ? '—' : fmtNum(s.totalOpdVisits),
        sub: `${vUp ? '+' : ''}${change.visits ?? 0}% vs prev`,
        Icon: MdPeople,
        color: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8',
        trend: vUp ? MdTrendingUp : MdTrendingDown,
        trendColor: vUp ? '#15803d' : '#dc2626',
      },
      {
        label: 'Completed Consultations',
        value: loading ? '—' : fmtNum(s.completedConsultations),
        sub: `${s.uniquePatients ?? 0} unique patients`,
        Icon: MdCheckCircle,
        color: '#f0fdf4', border: '#bbf7d0', text: '#15803d',
      },
      {
        label: 'Waiting Now',
        value: loading ? '—' : fmtNum(s.waitingNow),
        sub: `${s.inConsultationNow ?? 0} in consultation`,
        Icon: MdSchedule,
        color: '#fefce8', border: '#fde68a', text: '#a16207',
      },
      {
        label: 'Referred for Admit',
        value: loading ? '—' : fmtNum(s.referredForAdmit),
        sub: `${s.opdToIpdConversionPct ?? 0}% conversion`,
        Icon: MdLocalHospital,
        color: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce',
      },
      {
        label: 'OPD Revenue Billed',
        value: loading ? '—' : fmt(s.opdRevenueBilled),
        sub: `${rUp ? '+' : ''}${change.revenue ?? 0}% vs prev`,
        Icon: MdCurrencyRupee,
        color: '#f0fdf4', border: '#bbf7d0', text: '#15803d',
        trend: rUp ? MdTrendingUp : MdTrendingDown,
        trendColor: rUp ? '#15803d' : '#dc2626',
      },
      {
        label: 'Collected',
        value: loading ? '—' : fmt(s.opdRevenueCollected),
        sub: `Pending: ${fmt(s.opdRevenuePending)}`,
        Icon: MdCurrencyRupee,
        color: '#fffbeb', border: '#fde68a', text: '#92400e',
      },
      {
        label: 'Avg Consultations / Day',
        value: loading ? '—' : fmtNum(s.avgConsultationsPerDay),
        sub: `${s.appointmentsCount ?? 0} appts, ${s.receptionVisitsCount ?? 0} walk-ins`,
        Icon: MdTimeline,
        color: '#f0f9ff', border: '#bae6fd', text: '#0369a1',
      },
    ];
  }, [data, loading]);

  const statusData = useMemo(() => {
    const sb = data?.statusBreakdown || {};
    const appts = Array.isArray(sb.appointments) ? sb.appointments : [];
    const visits = Array.isArray(sb.receptionVisits) ? sb.receptionVisits : [];
    return { appointments: appts, receptionVisits: visits };
  }, [data]);

  const visitChartData = useMemo(() => {
    const series = Array.isArray(data?.visitsByDay) ? data.visitsByDay : [];
    return series;
  }, [data]);

  const revenueChartData = useMemo(() => {
    const series = Array.isArray(data?.revenueByDay) ? data.revenueByDay : [];
    return series.map((d) => ({ ...d, collected: d.collected || 0, billed: d.billed || 0 }));
  }, [data]);

  const topDepartments = useMemo(() => {
    return Array.isArray(data?.topDepartments) ? data.topDepartments : [];
  }, [data]);

  const topDoctors = useMemo(() => {
    return Array.isArray(data?.topDoctors) ? data.topDoctors : [];
  }, [data]);

  const topDiagnoses = useMemo(() => {
    return Array.isArray(data?.topDiagnoses) ? data.topDiagnoses : [];
  }, [data]);

  const topLabTests = useMemo(() => {
    return Array.isArray(data?.topAdvisedLabTests) ? data.topAdvisedLabTests : [];
  }, [data]);

  const recentActivity = useMemo(() => {
    return Array.isArray(data?.recentOpdActivity) ? data.recentOpdActivity : [];
  }, [data]);

  const maxDeptAppts = Math.max(1, ...topDepartments.map((d) => d.appointments));
  const maxDoctorAppts = Math.max(1, ...topDoctors.map((d) => d.appointments));
  const maxDiagnosisCount = Math.max(1, ...topDiagnoses.map((d) => d.count));
  const maxLabCount = Math.max(1, ...topLabTests.map((t) => t.count));

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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">OPD Analytics</h1>
          <p className="text-xs text-gray-400 mt-1">
            {dateRange.from} → {dateRange.to}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(dateRange.from, dateRange.to, department, doctorId)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
        >
          <MdRefresh className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => load(dateRange.from, dateRange.to, department, doctorId)} className="ml-3 text-xs font-semibold underline">Retry</button>
        </div>
      ) : null}

      {/* Date Presets */}
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

      {/* Department / Doctor Filters */}
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
      </div>

      {/* Summary Cards */}
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

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Appointments by Status</h2>
          {statusData.appointments.length > 0 ? (
            <div className="space-y-2.5">
              {statusData.appointments.map((s) => {
                const total = statusData.appointments.reduce((a, b) => a + b.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{s.label}</span>
                      <span className="font-semibold text-gray-900">{fmtNum(s.count)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: s.status === 'WAITING' ? '#f59e0b' : s.status === 'IN_PROGRESS' ? '#3b82f6' : '#22c55e',
                        }}
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
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Reception Visits by Status</h2>
          {statusData.receptionVisits.length > 0 ? (
            <div className="space-y-2.5">
              {statusData.receptionVisits.map((s) => {
                const total = statusData.receptionVisits.reduce((a, b) => a + b.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{STATUS_LABEL[s.status] || s.status}</span>
                      <span className="font-semibold text-gray-900">{fmtNum(s.count)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: s.status === 'WAITING' ? '#f59e0b' : s.status === 'IN_CONSULTATION' ? '#3b82f6' : '#22c55e',
                        }}
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
      </div>

      {/* Visit & Revenue Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">OPD Visits by Day</h2>
          {visitChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={visitChartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Bar dataKey="appointments" name="Appointments" fill="#3b82f6" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="receptionVisits" name="Walk-in" fill="#f59e0b" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">OPD Revenue by Day</h2>
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

      {/* Top Departments & Doctors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Top Departments</h2>
          </div>
          {topDepartments.length > 0 ? (
            <div className="p-4 space-y-2.5">
              {topDepartments.slice(0, 8).map((d) => (
                <div key={d.department}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{d.department}</span>
                    <span className="font-semibold text-gray-900">{fmtNum(d.appointments)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.round((d.appointments / maxDeptAppts) * 100)}%` }}
                    />
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
                    <span className="font-semibold text-gray-900">{fmtNum(d.appointments)} visits</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-1">{d.department} · {d.completed} completed</p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.round((d.appointments / maxDoctorAppts) * 100)}%` }}
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

      {/* Top Diagnoses & Lab Tests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
              <MdMedicalServices className="w-4 h-4 text-gray-500" /> Top Diagnoses
            </h2>
          </div>
          {topDiagnoses.length > 0 ? (
            <div className="p-4 space-y-2.5">
              {topDiagnoses.map((d) => (
                <div key={d.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 truncate max-w-[200px]">{d.label}</span>
                    <span className="font-semibold text-gray-900">{fmtNum(d.count)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-rose-400 transition-all"
                      style={{ width: `${Math.round((d.count / maxDiagnosisCount) * 100)}%` }}
                    />
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
            <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
              <MdScience className="w-4 h-4 text-gray-500" /> Top Advised Lab Tests
            </h2>
          </div>
          {topLabTests.length > 0 ? (
            <div className="p-4 space-y-2.5">
              {topLabTests.map((t) => (
                <div key={t.testName}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{t.testName}</span>
                    <span className="font-semibold text-gray-900">{fmtNum(t.count)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-cyan-500 transition-all"
                      style={{ width: `${Math.round((t.count / maxLabCount) * 100)}%` }}
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

      {/* Recent OPD Activity */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Recent OPD Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">UHID</th>
                <th className="px-5 py-3">Doctor</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Token</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : recentActivity.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No OPD activity in this period.</td></tr>
              ) : recentActivity.map((act, idx) => (
                <tr key={`${act.source}-${act.uhid}-${idx}`} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 font-medium text-gray-800">{act.patientName}</td>
                  <td className="px-5 py-3 text-xs text-gray-500 font-mono">{act.uhid}</td>
                  <td className="px-5 py-3 text-gray-700">{act.doctorName}</td>
                  <td className="px-5 py-3 text-xs text-gray-600">{act.department}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_BADGE[act.status] || 'bg-gray-50 text-gray-700 ring-gray-200'}`}>
                      {STATUS_LABEL[act.status] || act.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 font-mono">{act.token || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      act.source === 'APPOINTMENT' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {act.source}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {act.at ? new Date(act.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
