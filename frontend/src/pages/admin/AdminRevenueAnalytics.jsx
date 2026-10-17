import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import {
  MdCurrencyRupee, MdReceipt, MdPendingActions, MdTrendingUp, MdTrendingDown,
  MdFilterList, MdRefresh, MdCalendarToday, MdCheckCircle,
  MdLocalHospital, MdLocalPharmacy, MdScience, MdMedicalServices,
  MdPayment, MdAccountBalance, MdDownload,
} from 'react-icons/md';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts';

const DATE_PRESETS = [
  { label: 'Today', days: 1 },
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: 'Last Month', days: -30 },
  { label: 'This Year', days: 365 },
];

const CATEGORIES = [
  { key: 'ALL', label: 'All', Icon: MdFilterList },
  { key: 'OPD', label: 'OPD', Icon: MdLocalHospital },
  { key: 'IPD', label: 'IPD', Icon: MdCheckCircle },
  { key: 'LAB', label: 'Lab', Icon: MdScience },
  { key: 'OT', label: 'OT', Icon: MdMedicalServices },
  { key: 'PHARMACY', label: 'Pharmacy', Icon: MdLocalPharmacy },
];

const CATEGORY_COLORS = {
  OPD: '#3b82f6', IPD: '#f59e0b', Lab: '#8b5cf6', OT: '#ef4444', Pharmacy: '#10b981',
};

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#06b6d4', '#ec4899', '#14b8a6'];

const AGING_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444'];

const MODE_ICONS = { Cash: MdAccountBalance, UPI: MdPayment, Card: MdCurrencyRupee };

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

export default function AdminRevenueAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [activePreset, setActivePreset] = useState(2);
  const [dateRange, setDateRange] = useState(() => getDateRange(DATE_PRESETS[2]));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [category, setCategory] = useState('ALL');

  const load = useCallback(async (from, to, cat) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/finance/analytics', { params: { from, to, category: cat }, silent: true });
      setData(res.data || null);
    } catch (e) {
      setData(null);
      setError(e?.response?.data?.message || 'Failed to load revenue analytics');
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

  const handleDownloadReport = () => {
    if (!data) return;
    const rows = [];
    rows.push('=== REVENUE ANALYTICS REPORT ===');
    rows.push(`Period: ${data.meta?.from || ''} → ${data.meta?.to || ''}`);
    rows.push(`Category: ${data.meta?.category || 'ALL'}`);
    rows.push('');

    const s = data.summary || {};
    rows.push('--- Summary ---');
    rows.push(`Total Billed,${s.totalBilled}`);
    rows.push(`Total Collected,${s.totalCollected}`);
    rows.push(`Total Pending,${s.totalPending}`);
    rows.push(`Collection Rate,${s.collectionRate}%`);
    rows.push(`Avg Bill Value,${s.avgBillValue}`);
    rows.push(`Transactions,${s.transactionCount}`);
    rows.push(`Billed Change,${s.billedChange}%`);
    rows.push(`Collected Change,${s.collectedChange}%`);
    rows.push(`Pending Change,${s.pendingChange}%`);
    rows.push('');

    const cats = Array.isArray(data.categoryMix) ? data.categoryMix : [];
    if (cats.length) {
      rows.push('--- Category Mix ---');
      rows.push('Category,Billed,Collected,Pending,Share %,Avg Bill,Bill Count');
      cats.forEach((c) => rows.push(`${c.category},${c.billed},${c.collected},${c.pending},${c.sharePct},${c.avgBill},${c.billCount}`));
      rows.push('');
    }

    const modes = Array.isArray(data.paymentModeBreakdown) ? data.paymentModeBreakdown : [];
    if (modes.length) {
      rows.push('--- Payment Mode Breakdown ---');
      rows.push('Mode,Amount,Count,Share %');
      modes.forEach((m) => rows.push(`${m.mode},${m.amount},${m.count},${m.sharePct}`));
      rows.push('');
    }

    const monthly = Array.isArray(data.monthlyTrend) ? data.monthlyTrend : [];
    if (monthly.length) {
      rows.push('--- Monthly Trend ---');
      rows.push('Month,Billed,Collected');
      monthly.forEach((m) => rows.push(`${m.label},${m.billed},${m.collected}`));
      rows.push('');
    }

    const aging = Array.isArray(data.pendingAging) ? data.pendingAging : [];
    if (aging.length) {
      rows.push('--- Pending Aging ---');
      rows.push('Bucket,Amount,Count');
      aging.forEach((a) => rows.push(`${a.bucket},${a.amount},${a.count}`));
      rows.push('');
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-analytics-${data.meta?.from?.slice(0, 10) || 'report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = data?.summary || {};
  const isUpCollected = (s.collectedChange || 0) >= 0;
  const isUpBilled = (s.billedChange || 0) >= 0;

  const summaryCards = [
    {
      label: 'Total Collected', value: loading ? '—' : fmt(s.totalCollected),
      sub: `${isUpCollected ? '+' : ''}${s.collectedChange ?? 0}% vs prev`,
      Icon: MdCurrencyRupee, color: '#f0fdf4', border: '#bbf7d0', text: '#15803d',
      trend: isUpCollected ? MdTrendingUp : MdTrendingDown, trendColor: isUpCollected ? '#15803d' : '#dc2626',
    },
    {
      label: 'Total Billed', value: loading ? '—' : fmt(s.totalBilled),
      sub: `${isUpBilled ? '+' : ''}${s.billedChange ?? 0}% vs prev`,
      Icon: MdReceipt, color: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8',
      trend: isUpBilled ? MdTrendingUp : MdTrendingDown, trendColor: isUpBilled ? '#1d4ed8' : '#dc2626',
    },
    {
      label: 'Pending Amount', value: loading ? '—' : fmt(s.totalPending),
      sub: `${s.pendingChange ?? 0}% vs prev`,
      Icon: MdPendingActions, color: '#fff7ed', border: '#fed7aa', text: '#c2410c',
    },
    {
      label: 'Collection Rate', value: loading ? '—' : `${s.collectionRate ?? 0}%`,
      sub: `Avg bill: ${fmt(s.avgBillValue)}`,
      Icon: MdCheckCircle, color: '#f0fdf4', border: '#bbf7d0', text: '#15803d',
    },
    {
      label: 'Avg Bill Value', value: loading ? '—' : fmt(s.avgBillValue),
      sub: `${s.transactionCount ?? 0} transactions`,
      Icon: MdCurrencyRupee, color: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce',
    },
  ];

  const categoryMix = useMemo(() => {
    const rows = Array.isArray(data?.categoryMix) ? data.categoryMix : [];
    const maxBilled = Math.max(1, ...rows.map((c) => c.billed));
    return rows.map((c) => ({
      ...c,
      pctBilled: Math.round((c.billed / maxBilled) * 100),
      pctCollected: c.billed > 0 ? Math.round((c.collected / c.billed) * 100) : 0,
    }));
  }, [data]);

  const paymentModes = useMemo(() => {
    return Array.isArray(data?.paymentModeBreakdown) ? data.paymentModeBreakdown : [];
  }, [data]);

  const monthlyTrend = useMemo(() => {
    return Array.isArray(data?.monthlyTrend) ? data.monthlyTrend : [];
  }, [data]);

  const dailySeries = useMemo(() => {
    const series = Array.isArray(data?.dailySeries) ? data.dailySeries : [];
    return series.map((d) => ({ ...d, collected: d.collected || 0, billed: d.billed || 0 }));
  }, [data]);

  const pendingAging = useMemo(() => {
    return Array.isArray(data?.pendingAging) ? data.pendingAging : [];
  }, [data]);

  const maxAgingAmount = Math.max(1, ...pendingAging.map((a) => a.amount));

  const maxMonthlyBilled = Math.max(1, ...monthlyTrend.map((m) => m.billed));

  const maxModeAmount = Math.max(1, ...paymentModes.map((m) => m.amount));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {entry.name === 'Billed' || entry.name === 'Collected' || entry.name === 'Amount' ? fmt(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Revenue Analytics</h1>
          <p className="text-xs text-gray-400 mt-1">
            {showCustom ? `${customFrom} → ${customTo}` : `${DATE_PRESETS[activePreset].label} — ${dateRange.from} → ${dateRange.to}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={!data}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition disabled:opacity-40"
          >
            <MdDownload className="w-3.5 h-3.5" /> Download
          </button>
          <button
            type="button"
            onClick={() => load(dateRange.from, dateRange.to, category)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
          >
            <MdRefresh className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">Loading revenue analytics…</div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => load(dateRange.from, dateRange.to, category)} className="ml-3 text-xs font-semibold underline">Retry</button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            onClick={() => handlePreset(i)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
              activePreset === i && !showCustom
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition flex items-center gap-1 ${
            showCustom ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
          }`}
        >
          <MdCalendarToday className="w-3 h-3" /> Custom
        </button>
        {showCustom && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
            <span className="text-xs text-gray-400">→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
            <button type="button" onClick={handleCustomApply} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">Apply</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 mr-1">Category:</span>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition flex items-center gap-1 ${
              category === c.key
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            <c.Icon className="w-3.5 h-3.5" /> {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {summaryCards.map((s) => {
          const TrendIcon = s.trend;
          return (
            <div key={s.label} className="bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition" style={{ borderColor: s.border }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl" style={{ color: '#0077B6' }}><s.Icon className="w-6 h-6" /></span>
                {TrendIcon && <TrendIcon className="w-4 h-4" style={{ color: s.trendColor }} />}
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Revenue by Category</h2>
          </div>
          {categoryMix.length > 0 ? (
            <div className="p-4 space-y-3">
              {categoryMix.map((c) => {
                const color = CATEGORY_COLORS[c.category] || '#6b7280';
                return (
                  <div key={c.categoryKey}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{c.category}</span>
                      <span className="font-semibold text-gray-900">{fmt(c.billed)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${c.pctBilled}%`, backgroundColor: color }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      <span>{fmt(c.collected)} collected · {c.sharePct}% share</span>
                      <span>Avg {fmt(c.avgBill)} · {c.billCount} bills</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No data</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Payment Mode Breakdown</h2>
          </div>
          {paymentModes.length > 0 ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-center py-2">
                <PieChart width={180} height={150}>
                  <Pie data={paymentModes} cx={90} cy={70} innerRadius={40} outerRadius={65} dataKey="amount" nameKey="mode" paddingAngle={2}>
                    {paymentModes.map((entry, idx) => (
                      <Cell key={entry.mode} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => fmt(val)} />
                </PieChart>
              </div>
              <div className="space-y-2">
                {paymentModes.map((m, idx) => {
                  const ModeIcon = MODE_ICONS[m.mode] || MdPayment;
                  return (
                    <div key={m.mode}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          <ModeIcon className="w-3.5 h-3.5 text-gray-400" /> {m.mode}
                        </span>
                        <span className="font-semibold text-gray-900">{fmt(m.amount)} · {m.count} txns</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.round((m.amount / maxModeAmount) * 100)}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No data</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm">Monthly Revenue Trend
            <span className="text-[10px] text-gray-400 ml-2 font-normal">(last 6 months)</span>
          </h2>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
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
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4 text-sm">Daily Revenue
            <span className="text-[10px] text-gray-400 ml-2 font-normal">(selected period)</span>
          </h2>
          {dailySeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailySeries} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
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
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Pending Aging
            <span className="text-[10px] text-gray-400 ml-2 font-normal">(all outstanding bills)</span>
          </h2>
        </div>
        {pendingAging.length > 0 ? (
          <div className="p-5 space-y-3">
            {pendingAging.map((a, idx) => (
              <div key={a.bucket}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AGING_COLORS[idx] }} />
                    {a.bucket}
                  </span>
                  <span className="font-semibold text-gray-900">{fmt(a.amount)} · {a.count} bills</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full transition-all" style={{ width: `${Math.round((a.amount / maxAgingAmount) * 100)}%`, backgroundColor: AGING_COLORS[idx] }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">No pending bills</p>
        )}
      </div>
    </div>
  );
}
