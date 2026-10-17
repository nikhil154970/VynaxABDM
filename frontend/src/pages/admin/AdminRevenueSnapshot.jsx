import { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../../utils/api';
import {
  MdCurrencyRupee, MdReceipt, MdPendingActions, MdTrendingUp, MdTrendingDown,
  MdFilterList, MdRefresh, MdCalendarToday, MdArrowForward, MdCheckCircle,
  MdLocalHospital, MdLocalPharmacy, MdScience, MdMedicalServices,
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

const CATEGORIES = [
  { key: 'ALL',      label: 'All',      Icon: MdFilterList },
  { key: 'OPD',      label: 'OPD',      Icon: MdLocalHospital },
  { key: 'IPD',      label: 'IPD',      Icon: MdCheckCircle },
  { key: 'LAB',      label: 'Lab',      Icon: MdScience },
  { key: 'OT',       label: 'OT',       Icon: MdMedicalServices },
  { key: 'PHARMACY', label: 'Pharmacy', Icon: MdLocalPharmacy },
];

const CATEGORY_COLORS = {
  OPD:      '#3b82f6',
  IPD:      '#f59e0b',
  Lab:      '#8b5cf6',
  OT:       '#ef4444',
  Pharmacy: '#10b981',
};

const CATEGORY_BADGE = {
  OPD:      'bg-blue-50 text-blue-700 ring-blue-100',
  IPD:      'bg-amber-50 text-amber-700 ring-amber-100',
  LAB:      'bg-violet-50 text-violet-700 ring-violet-100',
  OT:       'bg-red-50 text-red-700 ring-red-100',
  PHARMACY: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
};

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function getDateRange(preset) {
  const now = new Date();
  if (preset.days === -30) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - preset.days + 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function AdminRevenueSnapshot() {
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [data, setData]             = useState(null);
  const [activePreset, setActivePreset] = useState(2);
  const [dateRange, setDateRange]   = useState(() => getDateRange(DATE_PRESETS[2]));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [category, setCategory]     = useState('ALL');

  const load = useCallback(async (from, to, cat) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/dashboard/revenue-snapshot', { params: { from, to, category: cat } });
      setData(res.data || null);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.message || 'Failed to load revenue snapshot');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showCustom && customFrom && customTo) {
      load(customFrom, customTo, category);
    } else if (!showCustom) {
      load(dateRange.from, dateRange.to, category);
    }
  }, [dateRange, category, showCustom, customFrom, customTo, load]);

  const handlePreset = (idx) => {
    setActivePreset(idx);
    setShowCustom(false);
    setDateRange(getDateRange(DATE_PRESETS[idx]));
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      setShowCustom(true);
      load(customFrom, customTo, category);
    }
  };

  const summaryCards = useMemo(() => {
    const s = data?.summary || {};
    const isUpCollected = (s.collectedChange || 0) >= 0;
    const isUpBilled    = (s.billedChange    || 0) >= 0;
    return [
      { label: 'Total Collected', value: loading ? '—' : fmt(s.totalCollected), sub: `${isUpCollected ? '+' : ''}${s.collectedChange ?? 0}% vs prev`, Icon: MdCurrencyRupee, accent: '#10b981', bg: '#f0fdf4', trend: isUpCollected ? MdTrendingUp : MdTrendingDown, trendColor: isUpCollected ? '#10b981' : '#dc2626' },
      { label: 'Total Billed',    value: loading ? '—' : fmt(s.totalBilled),    sub: `${isUpBilled ? '+' : ''}${s.billedChange ?? 0}% vs prev`,    Icon: MdReceipt,       accent: '#3b82f6', bg: '#eff6ff', trend: isUpBilled    ? MdTrendingUp : MdTrendingDown, trendColor: isUpBilled    ? '#3b82f6' : '#dc2626' },
      { label: 'Pending Amount',  value: loading ? '—' : fmt(s.totalPending),   sub: `${s.pendingCount ?? 0} bills with pending balance`,           Icon: MdPendingActions,accent: '#f97316', bg: '#fff7ed' },
      { label: 'Transactions',    value: loading ? '—' : `${s.collectedCount ?? 0}`, sub: `out of ${s.billedCount ?? 0} bills`,                     Icon: MdArrowForward,  accent: '#8b5cf6', bg: '#fdf4ff' },
    ];
  }, [data, loading]);

  const categories = useMemo(() => {
    const breakdown = Array.isArray(data?.categoryBreakdown) ? data.categoryBreakdown : [];
    const maxBilled = Math.max(1, ...breakdown.map((c) => c.billed));
    return breakdown.map((c) => ({
      ...c,
      pctBilled:    Math.round((c.billed / maxBilled) * 100),
      pctCollected: c.billed > 0 ? Math.round((c.collected / c.billed) * 100) : 0,
    }));
  }, [data]);

  const chartData = useMemo(() => {
    const series = Array.isArray(data?.dailySeries) ? data.dailySeries : [];
    return series.map((d) => ({ ...d, collected: d.collected || 0, billed: d.billed || 0 }));
  }, [data]);

  const recentTx = useMemo(() => Array.isArray(data?.recentTransactions) ? data.recentTransactions : [], [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {fmt(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-gray-50/50 min-h-screen">


      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => load(dateRange.from, dateRange.to, category)} className="text-xs font-semibold underline ml-3">Retry</button>
        </div>
      ) : null}

      {/* ── Controls ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Date presets + Refresh */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePreset(i)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all duration-200 ${
                activePreset === i && !showCustom
                  ? 'bg-[#0077B6] text-white border-[#0077B6] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#0077B6]/50 hover:text-[#0077B6]'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all duration-200 flex items-center gap-1 ${
              showCustom
                ? 'bg-[#0077B6] text-white border-[#0077B6]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#0077B6]/50 hover:text-[#0077B6]'
            }`}
          >
            <MdCalendarToday className="w-3 h-3" /> Custom
          </button>
          {showCustom && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none" />
              <span className="text-xs text-gray-400">→</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none" />
              <button type="button" onClick={handleCustomApply}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#0077B6] text-white hover:bg-[#005f92] transition cursor-pointer">
                Apply
              </button>
            </div>
          )}
          </div>
          {/* Refresh — right side of presets row */}
          <button
            type="button"
            onClick={() => load(dateRange.from, dateRange.to, category)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0077B6] bg-blue-50 border border-[#0077B6]/20 hover:border-[#0077B6] hover:bg-sky-100 transition-all duration-200 disabled:opacity-60 cursor-pointer shrink-0"
          >
            <MdRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Category:</span>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all duration-200 flex items-center gap-1.5 ${
                category === c.key
                  ? 'bg-[#001B48] text-white border-[#001B48] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800'
              }`}
            >
              <c.Icon className="w-3.5 h-3.5" />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((s) => {
          const TrendIcon = s.trend;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                    <s.Icon className="w-5 h-5" style={{ color: s.accent }} />
                  </div>
                  {TrendIcon && <TrendIcon className="w-4 h-4 mt-0.5" style={{ color: s.trendColor }} />}
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>{s.value}</p>
                  <p className="text-[11px] font-semibold text-gray-700 mt-0.5">{s.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
                </div>
                <div className="h-0.5 w-full rounded-full" style={{ background: s.bg }}>
                  <div className="h-0.5 rounded-full w-1/2" style={{ background: s.accent }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Category Breakdown Table ────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Revenue by Category</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">Billed vs collected breakdown per service type</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#001B48] text-left text-[10px] font-semibold uppercase tracking-wider text-white/70 border-b border-[#0077B6]/20">
                <th className="px-5 py-3 whitespace-nowrap">Category</th>
                <th className="px-5 py-3 whitespace-nowrap">Billed</th>
                <th className="px-5 py-3 whitespace-nowrap">Collected</th>
                <th className="px-5 py-3 whitespace-nowrap">Pending</th>
                <th className="px-5 py-3 whitespace-nowrap">Collection %</th>
                <th className="px-5 py-3 whitespace-nowrap">Count</th>
                <th className="px-5 py-3 whitespace-nowrap">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-gray-400">Loading…</td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-gray-400">No revenue data for this period.</td></tr>
              ) : categories.map((c) => {
                const barColor = CATEGORY_COLORS[c.category] || '#6b7280';
                return (
                  <tr key={c.category} className="hover:bg-gray-50/70 transition duration-150">
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold text-gray-800">{c.category}</span>
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-900">{fmt(c.billed)}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-emerald-600">{fmt(c.collected)}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-orange-500">{fmt(c.pending)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${c.pctCollected}%`, backgroundColor: barColor }} />
                        </div>
                        <span className="text-[10px] text-gray-500 font-semibold">{c.pctCollected}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600">{c.count}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] font-bold ${(c.pctChange ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {(c.pctChange ?? 0) >= 0 ? '+' : ''}{c.pctChange ?? 0}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Daily Revenue Chart ─────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-gray-900">Daily Revenue Trend</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">Billed vs Collected per day in selected period</p>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="billed"    name="Billed"    fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-60 flex items-center justify-center text-gray-400 text-xs">No data for this period.</div>
        )}
      </div>

      {/* ── Recent Transactions ─────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Recent Transactions</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">Latest billing activity in selected period</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#001B48] text-left text-[10px] font-semibold uppercase tracking-wider text-white/70 border-b border-[#0077B6]/20">
                <th className="px-5 py-3 whitespace-nowrap">Bill No.</th>
                <th className="px-5 py-3 whitespace-nowrap">Patient</th>
                <th className="px-5 py-3 whitespace-nowrap">UHID</th>
                <th className="px-5 py-3 whitespace-nowrap">Category</th>
                <th className="px-5 py-3 whitespace-nowrap">Amount</th>
                <th className="px-5 py-3 whitespace-nowrap">Mode</th>
                <th className="px-5 py-3 whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-gray-400">Loading…</td></tr>
              ) : recentTx.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-gray-400">No transactions in this period.</td></tr>
              ) : recentTx.map((tx) => {
                const catKey  = tx.category || tx.visitType;
                const badge   = CATEGORY_BADGE[catKey] || 'bg-gray-50 text-gray-700 ring-gray-100';
                const catLabel = catKey === 'PHARMACY' ? 'Pharmacy' : catKey;
                return (
                  <tr key={tx.id} className="hover:bg-gray-50/70 transition duration-150">
                    <td className="px-5 py-3 font-mono text-[11px] text-[#0077B6] font-semibold whitespace-nowrap">{tx.billNumber}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-800">{tx.patientName}</td>
                    <td className="px-5 py-3 text-[10px] text-gray-500 font-mono whitespace-nowrap">{tx.uhid}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${badge}`}>
                        {catLabel}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-bold text-emerald-600">{fmt(tx.amount)}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{tx.mode}</td>
                    <td className="px-5 py-3 text-[11px] text-gray-400 whitespace-nowrap">
                      {tx.date ? new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
