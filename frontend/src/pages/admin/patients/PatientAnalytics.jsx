import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MdCalendarToday,
  MdGroup,
  MdInsights,
  MdLocalHospital,
  MdRefresh,
  MdTrendingUp,
} from 'react-icons/md';
import api from '../../../utils/api';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso, deltaDays) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return toISODate(d);
}

function compact(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-IN');
}

function pct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `${x.toFixed(1)}%`;
}

function maxCount(list, key = 'count') {
  let m = 0;
  for (const it of list || []) m = Math.max(m, Number(it?.[key] || 0));
  return m;
}

function ChartCard({ title, right, children }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-gray-900">{title}</p>
        {right ? <div className="text-xs font-extrabold text-gray-700 tabular-nums">{right}</div> : <span />}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const COLORS = {
  primary: '#2D2A6E',
  teal: '#0f766e',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
};

function DefaultTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl bg-white shadow-lg ring-1 ring-gray-200 px-3 py-2">
      <p className="text-xs font-extrabold text-gray-900">{label}</p>
      <div className="mt-1 space-y-0.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6">
            <span className="text-[11px] font-bold text-gray-600">{p.name || p.dataKey}</span>
            <span className="text-[11px] font-extrabold text-gray-900 tabular-nums">{compact(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-500">{title}</p>
          <p className="text-xl font-extrabold text-gray-900 mt-1 tabular-nums leading-none">{value}</p>
          {sub ? <p className="text-[11px] text-gray-500 mt-1 leading-snug">{sub}</p> : null}
        </div>
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(45,42,110,0.10)' }}>
          <Icon className="w-[18px] h-[18px]" style={{ color: '#2D2A6E' }} />
        </div>
      </div>
    </div>
  );
}

export default function PatientAnalytics() {
  const today = toISODate(new Date());
  const [from, setFrom] = useState(addDaysISO(today, -30));
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/patients/analytics', { params: { from, to } });
      setData(res?.data || null);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.message || 'Failed to load patient analytics.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const overview = data?.overview || {};
  const demographics = data?.demographics || {};
  const mix = data?.mix || {};
  const clinical = data?.clinical || {};
  const series = data?.series || {};

  const genderItems = useMemo(() => {
    const rows = Array.isArray(demographics.byGender) ? demographics.byGender : [];
    const mapGender = (g) => {
      const s = String(g || '').toUpperCase();
      if (s === 'MALE') return 'Male';
      if (s === 'FEMALE') return 'Female';
      if (s === 'OTHER') return 'Other';
      return 'Unknown';
    };
    return rows.map((x) => ({ name: mapGender(x.gender), value: Number(x.count || 0) }));
  }, [demographics.byGender]);

  const ageData = useMemo(() => {
    const rows = Array.isArray(demographics.byAgeBucket) ? demographics.byAgeBucket : [];
    return rows.map((r) => ({ bucket: r.bucket, patients: Number(r.count || 0) }));
  }, [demographics.byAgeBucket]);

  const deptData = useMemo(() => {
    const rows = Array.isArray(mix.byDepartment) ? mix.byDepartment : [];
    return rows.slice(0, 8).map((r) => ({ department: r.department || '—', visits: Number(r.visits || 0) }));
  }, [mix.byDepartment]);

  const doctorData = useMemo(() => {
    const rows = Array.isArray(mix.byDoctor) ? mix.byDoctor : [];
    return rows.slice(0, 8).map((r) => ({
      name: r.doctorName ? `${r.doctorName}${r.specialization ? ` (${r.specialization})` : ''}` : '—',
      visits: Number(r.visits || 0),
    }));
  }, [mix.byDoctor]);

  const diagnosesData = useMemo(() => {
    const rows = Array.isArray(clinical.topDiagnoses) ? clinical.topDiagnoses : [];
    return rows.slice(0, 8).map((r) => ({ diagnosis: r.label || '—', count: Number(r.count || 0) }));
  }, [clinical.topDiagnoses]);

  const labData = useMemo(() => {
    const rows = Array.isArray(clinical.topLabTests) ? clinical.topLabTests : [];
    return rows.slice(0, 8).map((r) => ({ test: r.testName || '—', count: Number(r.count || 0) }));
  }, [clinical.topLabTests]);

  const regSeries = useMemo(() => {
    const rows = Array.isArray(series.registrationsByDay) ? series.registrationsByDay : [];
    return rows.slice(-30).map((r) => ({ day: String(r.day || '').slice(5), registrations: Number(r.count || 0) }));
  }, [series.registrationsByDay]);

  const opdSeries = useMemo(() => {
    const rows = Array.isArray(series.opdVisitsByDay) ? series.opdVisitsByDay : [];
    return rows.slice(-30).map((r) => ({ day: String(r.day || '').slice(5), visits: Number(r.count || 0) }));
  }, [series.opdVisitsByDay]);

  return (
    <div className="p-6 sm:p-8 bg-[#F5F7FA] min-h-full">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#2D2A6E]/80">Admin · Patient Intelligence</p>
            <h1 className="text-2xl font-extrabold text-gray-900 mt-1">Patient analytics</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
              />
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50 transition disabled:opacity-60"
            >
              <MdRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl bg-rose-50 text-rose-800 text-sm ring-1 ring-rose-100 px-4 py-3">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard title="Total patients" value={compact(overview.totalPatients)} sub="All-time registrations" icon={MdGroup} />
          <StatCard title="New registrations" value={compact(overview.newPatients)} sub={`${from} → ${to}`} icon={MdTrendingUp} />
          <StatCard title="Active patients" value={compact(overview.activePatients)} sub="Any visit/appointment/bill in range" icon={MdInsights} />
          <StatCard title="OPD → IPD rate" value={pct(overview.conversionRatePct)} sub={`${compact(overview.ipdAdmissions)} admissions`} icon={MdLocalHospital} />
          <StatCard title="First-time" value={compact(overview.firstTimePatients)} sub="In range" icon={MdCalendarToday} />
          <StatCard title="Returning" value={compact(overview.returningPatients)} sub="In range" icon={MdCalendarToday} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <ChartCard title="Registrations trend" right={regSeries.length ? compact(regSeries[regSeries.length - 1].registrations) : '—'}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={regSeries} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<DefaultTooltip />} />
                  <Area type="monotone" dataKey="registrations" name="Registrations" stroke={COLORS.primary} strokeWidth={2} fill="url(#regFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="OPD visits trend" right={opdSeries.length ? compact(opdSeries[opdSeries.length - 1].visits) : '—'}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={opdSeries} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="opdFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<DefaultTooltip />} />
                  <Area type="monotone" dataKey="visits" name="Visits" stroke={COLORS.teal} strokeWidth={2} fill="url(#opdFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Gender split">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<DefaultTooltip />} />
                  <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                  <Pie data={genderItems} dataKey="value" nameKey="name" innerRadius={46} outerRadius={72} paddingAngle={3}>
                    {(genderItems || []).map((entry, idx) => (
                      <Cell key={`cell-${entry.name}`} fill={[COLORS.primary, COLORS.teal, COLORS.amber, '#94a3b8'][idx % 4]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Age distribution">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<DefaultTooltip />} />
                  <Bar dataKey="patients" name="Patients" fill={COLORS.violet} radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Top departments (OPD visits)">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="department" width={120} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<DefaultTooltip />} />
                  <Bar dataKey="visits" name="Visits" fill={COLORS.primary} radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Top doctors (OPD visits)">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={doctorData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<DefaultTooltip />} />
                  <Bar dataKey="visits" name="Visits" fill={COLORS.teal} radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Lab utilization">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={labData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <XAxis dataKey="test" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={0} angle={-10} textAnchor="end" height={44} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<DefaultTooltip />} />
                  <Bar dataKey="count" name="Orders" fill={COLORS.sky} radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Common diagnoses">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diagnosesData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="diagnosis" width={160} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<DefaultTooltip />} />
                  <Bar dataKey="count" name="Count" fill={COLORS.rose} radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {loading && !data ? (
          <div className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm p-8 text-center text-gray-500">
            Loading analytics…
          </div>
        ) : null}
      </div>
    </div>
  );
}

