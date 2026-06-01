import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#f59e0b', '#10b981', '#ef4444'];

export function formatMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

export function ReportCards({ items, loading }) {
  const count = Math.max(1, items?.length || 1);
  const gridCols =
    count >= 5
      ? 'sm:grid-cols-2 lg:grid-cols-5'
      : count === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : count === 3
          ? 'sm:grid-cols-2 lg:grid-cols-3'
          : 'sm:grid-cols-2';

  return (
    <div className={`grid w-full grid-cols-1 gap-3 ${gridCols}`}>
      {items.map((c) => (
        <div
          key={c.label}
          className={`flex min-h-[88px] flex-col justify-center rounded-2xl border bg-gradient-to-br px-4 py-3.5 shadow-sm transition hover:shadow-md ${c.tone || 'from-violet-50 to-indigo-50 border-violet-100'}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{c.label}</p>
          {loading ? (
            <div className="mt-2.5 h-8 w-24 animate-pulse rounded-lg bg-white/60" />
          ) : (
            <p className="mt-1.5 text-2xl font-extrabold leading-tight text-slate-900 sm:text-[1.65rem]">{c.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReportTable({ columns, rows, loading, emptyMessage = 'No data' }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-xs">
          <thead>
            <tr className="bg-[#f8faff]">
              {columns.map((col) => (
                <th key={col.key} className="px-2.5 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows?.length ? (
              rows.map((row, i) => (
                <tr key={row.id || i} className="hover:bg-blue-50/20">
                  {columns.map((col) => (
                    <td key={col.key} className="px-2.5 py-2 text-slate-700 whitespace-nowrap">
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2 p-1">
        {!loading &&
          rows?.map((row, i) => (
            <div key={row.id || i} className="rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
              {columns.slice(0, 4).map((col) => (
                <p key={col.key} className="mt-0.5">
                  <span className="text-slate-500">{col.label}: </span>
                  <span className="font-semibold">{col.render ? col.render(row) : row[col.key] ?? '—'}</span>
                </p>
              ))}
            </div>
          ))}
      </div>
    </>
  );
}

export function LineChartCard({ title, data, dataKey = 'amount', xKey = 'label', loading, height = 220 }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold text-slate-800 mb-2">{title}</p>
      {loading ? (
        <div className="h-[220px] animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data?.length ? data : [{ [xKey]: '-', [dataKey]: 0 }]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatMoney(v)} />
            <Line type="monotone" dataKey={dataKey} stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function BarChartCard({ title, data, xKey = 'label', dataKey = 'amount', loading, height = 220 }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold text-slate-800 mb-2">{title}</p>
      {loading ? (
        <div className="h-[220px] animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data?.length ? data : [{ [xKey]: '-', [dataKey]: 0 }]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => (typeof v === 'number' && v > 100 ? formatMoney(v) : v)} />
            <Bar dataKey={dataKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function DualLineChartCard({ title, data, loading }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold text-slate-800 mb-2">{title}</p>
      {loading ? (
        <div className="h-[220px] animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data?.length ? data : [{ label: '-', revenue: 0, purchase: 0 }]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatMoney(v)} />
            <Legend />
            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="purchase" name="Purchase" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function PieChartCard({ title, data, nameKey = 'label', valueKey = 'count', loading }) {
  const chartData = data?.length ? data : [{ [nameKey]: 'No data', [valueKey]: 1 }];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold text-slate-800 mb-2">{title}</p>
      {loading ? (
        <div className="h-[220px] animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={chartData} dataKey={valueKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={70} label>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
