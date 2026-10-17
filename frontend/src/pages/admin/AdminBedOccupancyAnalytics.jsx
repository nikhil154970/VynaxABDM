import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import {
  MdBed, MdPeople, MdEventAvailable, MdBuild, MdTrendingUp,
  MdTrendingDown, MdRefresh, MdFilterList, MdLocalHospital,
  MdSwapHoriz, MdTimeline, MdSchedule,
} from 'react-icons/md';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const DATE_PRESETS = [
  { label: 'Today', days: 1 },
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: 'Last Month', days: -30 },
  { label: 'This Year', days: 365 },
];

const STATUS_BAR_COLORS = {
  Available: '#22c55e',
  Occupied: '#3b82f6',
  Maintenance: '#f59e0b',
};

const WARD_TYPE_META = {
  General: { color: '#3b82f6' },
  ICU: { color: '#ec4899' },
  Private: { color: '#f59e0b' },
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

export default function AdminBedOccupancyAnalytics() {
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Loading occupancy analytics…');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [activePreset, setActivePreset] = useState(2);
  const [dateRange, setDateRange] = useState(() => getDateRange(DATE_PRESETS[2]));
  const [wardType, setWardType] = useState('');

  const load = useCallback(async (from, to, wType) => {
    setLoading(true);
    setLoadingMsg('Loading occupancy analytics…');
    setError('');
    try {
      const params = { from, to };
      if (wType) params.wardType = wType;
      const res = await api.get('/admin/beds/analytics', { params, silent: true });
      setData(res.data || null);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.message || 'Failed to load occupancy analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(dateRange.from, dateRange.to, wardType);
  }, [dateRange, wardType, load]);

  const handlePreset = (idx) => {
    setActivePreset(idx);
    setDateRange(getDateRange(DATE_PRESETS[idx]));
  };

  const summaryCards = useMemo(() => {
    const s = data?.summary || {};
    const change = s.changeVsPrevPeriod || {};
    const admUp = (change.admissions || 0) >= 0;
    const disUp = (change.discharges || 0) >= 0;
    const occUp = (change.occupancyPct || 0) >= 0;
    return [
      {
        label: 'Total Beds',
        value: loading ? '—' : fmtNum(s.totalBeds),
        sub: `${s.occupiedBeds ?? 0} occupied · ${s.availableBeds ?? 0} available`,
        Icon: MdBed,
        color: '#f0f9ff', border: '#bae6fd', text: '#0369a1',
      },
      {
        label: 'Occupancy Rate',
        value: loading ? '—' : `${s.occupancyPct ?? 0}%`,
        sub: `Avg ${s.avgOccupancyPctInPeriod ?? 0}% in period`,
        Icon: MdSchedule,
        color: '#f0fdf4', border: '#bbf7d0', text: '#15803d',
        trend: occUp ? MdTrendingUp : MdTrendingDown,
        trendColor: occUp ? '#15803d' : '#dc2626',
      },
      {
        label: 'Active Admissions',
        value: loading ? '—' : fmtNum(s.activeAdmissionsNow),
        sub: `${s.newAdmissionsInPeriod ?? 0} new · ${admUp ? '+' : ''}${change.admissions ?? 0}%`,
        Icon: MdPeople,
        color: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8',
        trend: admUp ? MdTrendingUp : MdTrendingDown,
        trendColor: admUp ? '#15803d' : '#dc2626',
      },
      {
        label: 'Discharges',
        value: loading ? '—' : fmtNum(s.dischargesInPeriod),
        sub: `${disUp ? '+' : ''}${change.discharges ?? 0}% vs prev`,
        Icon: MdEventAvailable,
        color: '#fefce8', border: '#fde68a', text: '#a16207',
        trend: disUp ? MdTrendingUp : MdTrendingDown,
        trendColor: disUp ? '#15803d' : '#dc2626',
      },
      {
        label: 'Transfers',
        value: loading ? '—' : fmtNum(s.transfersInPeriod),
        sub: `Avg stay ${s.avgLengthOfStayDays ?? 0} days`,
        Icon: MdSwapHoriz,
        color: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce',
      },
      {
        label: 'Maintenance',
        value: loading ? '—' : fmtNum(s.maintenanceBeds),
        sub: `${s.totalBeds ? Math.round((s.maintenanceBeds / s.totalBeds) * 100) : 0}% of total`,
        Icon: MdBuild,
        color: '#fffbeb', border: '#fde68a', text: '#92400e',
      },
      {
        label: 'Avg Length of Stay',
        value: loading ? '—' : `${s.avgLengthOfStayDays ?? 0} days`,
        sub: `${s.dischargesInPeriod ?? 0} discharged in period`,
        Icon: MdTimeline,
        color: '#f0fdf4', border: '#bbf7d0', text: '#15803d',
      },
    ];
  }, [data, loading]);

  const statusData = useMemo(() => {
    return Array.isArray(data?.statusBreakdown) ? data.statusBreakdown : [];
  }, [data]);

  const byWardType = useMemo(() => {
    return Array.isArray(data?.byWardType) ? data.byWardType : [];
  }, [data]);

  const byWard = useMemo(() => {
    return Array.isArray(data?.byWard) ? data.byWard : [];
  }, [data]);

  const occChartData = useMemo(() => {
    return Array.isArray(data?.occupancyByDay) ? data.occupancyByDay : [];
  }, [data]);

  const topWards = useMemo(() => {
    return Array.isArray(data?.topWardsByOccupancy) ? data.topWardsByOccupancy : [];
  }, [data]);

  const recentTransfers = useMemo(() => {
    return Array.isArray(data?.recentTransfers) ? data.recentTransfers : [];
  }, [data]);

  const longestOccupied = useMemo(() => {
    return Array.isArray(data?.longestOccupiedBeds) ? data.longestOccupiedBeds : [];
  }, [data]);

  const totalStatus = statusData.reduce((a, b) => a + b.count, 0);
  const maxWardBeds = Math.max(1, ...byWard.map((w) => w.totalBeds));
  const maxOccBeds = Math.max(1, ...occChartData.map((d) => d.totalBeds));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {entry.name === 'Occupancy %' ? `${entry.value}%` : entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Occupancy Analytics</h1>
          <p className="text-xs text-gray-400 mt-1">
            {dateRange.from} → {dateRange.to}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(dateRange.from, dateRange.to, wardType)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
        >
          <MdRefresh className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {loadingMsg}
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => load(dateRange.from, dateRange.to, wardType)} className="ml-3 text-xs font-semibold underline">Retry</button>
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
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Bed Status Breakdown</h2>
          {statusData.length > 0 ? (
            <div className="space-y-2.5">
              {statusData.map((s) => {
                const pct = totalStatus > 0 ? Math.round((s.count / totalStatus) * 100) : 0;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{s.status}</span>
                      <span className="font-semibold text-gray-900">{fmtNum(s.count)} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: STATUS_BAR_COLORS[s.status] || '#6b7280' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">No data</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">By Ward Type</h2>
          {byWardType.length > 0 ? (
            <div className="space-y-3">
              {byWardType.map((w) => {
                const meta = WARD_TYPE_META[w.wardType] || { color: '#6b7280' };
                return (
                  <div key={w.wardType}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                        {w.wardType}
                      </span>
                      <span className="font-semibold text-gray-900">{w.occupancyPct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${w.occupancyPct}%`, backgroundColor: meta.color }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {w.occupied} occupied · {w.available} available · {w.maintenance} maintenance · {w.totalBeds} total
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">No data</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-3 text-sm">
          Estimated Daily Occupancy
          <span className="text-[10px] text-gray-400 ml-2 font-normal">(approx. from admission records)</span>
        </h2>
        {occChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={occChartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
              <Bar yAxisId="left" dataKey="admissions" name="Admissions" fill="#93c5fd" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar yAxisId="left" dataKey="discharges" name="Discharges" fill="#86efac" radius={[3, 3, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">No data</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">All Wards</h2>
          </div>
          {byWard.length > 0 ? (
            <div className="p-4 space-y-2.5 max-h-[400px] overflow-y-auto">
              {byWard.map((w) => (
                <div key={w.wardId}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{w.wardName}</span>
                    <span className="font-semibold text-gray-900">{w.occupancyPct}% · {w.occupied}/{w.totalBeds}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.round((w.totalBeds / maxWardBeds) * 100)}%`,
                        backgroundColor: w.occupancyPct > 80 ? '#ef4444' : w.occupancyPct > 60 ? '#f59e0b' : '#22c55e',
                      }}
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
            <h2 className="font-semibold text-gray-800 text-sm">Top Wards by Occupancy</h2>
          </div>
          {topWards.length > 0 ? (
            <div className="p-4 space-y-2.5">
              {topWards.map((w, idx) => (
                <div key={w.wardName + idx}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">
                      <span className="text-gray-400 mr-1">{idx + 1}.</span>
                      {w.wardName} <span className="text-gray-400 font-normal">({w.wardType})</span>
                    </span>
                    <span className="font-semibold text-gray-900">{w.occupancyPct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${w.occupancyPct}%`,
                        backgroundColor: w.occupancyPct > 80 ? '#ef4444' : w.occupancyPct > 60 ? '#f59e0b' : '#22c55e',
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">{w.occupied} occupied of {w.totalBeds} beds</p>
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
            <h2 className="font-semibold text-gray-800 text-sm">Recent Transfers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">IPD</th>
                  <th className="px-5 py-3">From</th>
                  <th className="px-5 py-3">To</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
                ) : recentTransfers.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No transfers in this period.</td></tr>
                ) : recentTransfers.map((t, idx) => (
                  <tr key={t.uhid + idx} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-gray-800">{t.patientName}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{t.ipdNumber}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{t.fromBed}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{t.toBed}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 max-w-[120px] truncate" title={t.reason}>{t.reason}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {t.at ? new Date(t.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Longest Occupied Beds</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                  <th className="px-5 py-3">Bed</th>
                  <th className="px-5 py-3">Ward</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">UHID</th>
                  <th className="px-5 py-3">Days</th>
                  <th className="px-5 py-3">Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
                ) : longestOccupied.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No occupied beds.</td></tr>
                ) : longestOccupied.map((b, idx) => (
                  <tr key={b.uhid + idx} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-700">{b.bedCode}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{b.wardName}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{b.patientName}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{b.uhid}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                        b.daysOccupied > 14 ? 'bg-red-50 text-red-700 ring-red-200'
                        : b.daysOccupied > 7 ? 'bg-amber-50 text-amber-700 ring-amber-200'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      }`}>
                        {b.daysOccupied}d
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {b.admissionDate ? new Date(b.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
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
