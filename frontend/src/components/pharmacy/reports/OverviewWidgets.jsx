import { AlertTriangle, CalendarClock, Package, Pill, Truck } from 'lucide-react';
import { formatMoney } from './reportUi';

const LOW_STOCK_MAX = 20;

function WidgetShell({ icon: Icon, title, accent, count, children, loading }) {
  return (
    <div className="flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-700 shadow-sm ring-1 ring-slate-100">
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <p className="truncate text-sm font-bold text-slate-900">{title}</p>
          </div>
          {count != null && !loading ? (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {count}
            </span>
          ) : null}
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-2">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-1.5 pt-0.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-2 w-full animate-pulse rounded bg-slate-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyWidget({ message, icon: Icon = Package }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-xs font-medium text-slate-500">{message}</p>
    </div>
  );
}

function RankBadge({ rank }) {
  const tones =
    rank === 1
      ? 'bg-amber-100 text-amber-800 ring-amber-200'
      : rank === 2
        ? 'bg-slate-200 text-slate-700 ring-slate-300'
        : rank === 3
          ? 'bg-orange-100 text-orange-800 ring-orange-200'
          : 'bg-blue-50 text-blue-700 ring-blue-100';
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold ring-1 ${tones}`}>
      {rank}
    </span>
  );
}

function ProgressBar({ pct, tone = 'bg-blue-500' }) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function TopSellingWidget({ items, loading }) {
  const max = Math.max(...(items || []).map((m) => Number(m.amount) || 0), 1);
  return (
    <WidgetShell icon={Pill} title="Top Selling Medicines" accent="from-blue-500 to-indigo-600" count={items?.length} loading={loading}>
      {loading ? (
        <WidgetSkeleton />
      ) : items?.length ? (
        <ul className="space-y-2.5">
          {items.map((m, i) => (
            <li key={m.medicineName + i} className="rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-2">
              <div className="flex items-start gap-2">
                <RankBadge rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold leading-snug text-slate-800 line-clamp-2">{m.medicineName}</p>
                    <span className="shrink-0 text-xs font-bold text-blue-700">{formatMoney(m.amount)}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">{m.quantity} units sold</p>
                  <ProgressBar pct={(Number(m.amount) / max) * 100} tone="bg-gradient-to-r from-blue-500 to-indigo-500" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyWidget message="No sales in selected period" icon={Pill} />
      )}
    </WidgetShell>
  );
}

export function TopSuppliersWidget({ items, loading }) {
  const max = Math.max(...(items || []).map((s) => Number(s.purchaseValue) || 0), 1);
  return (
    <WidgetShell icon={Truck} title="Top Suppliers" accent="from-amber-500 to-orange-600" count={items?.length} loading={loading}>
      {loading ? (
        <WidgetSkeleton />
      ) : items?.length ? (
        <ul className="space-y-2.5">
          {items.map((s, i) => (
            <li key={s.supplierName + i} className="rounded-xl border border-amber-100/80 bg-amber-50/40 px-2.5 py-2">
              <div className="flex items-start gap-2">
                <RankBadge rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">{s.supplierName}</p>
                    <span className="shrink-0 text-xs font-bold text-amber-800">{formatMoney(s.purchaseValue)}</span>
                  </div>
                  {s.grnCount != null ? (
                    <p className="mt-0.5 text-[10px] text-slate-500">{s.grnCount} GRN{s.grnCount !== 1 ? 's' : ''}</p>
                  ) : null}
                  <ProgressBar pct={(Number(s.purchaseValue) / max) * 100} tone="bg-gradient-to-r from-amber-500 to-orange-500" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyWidget message="No supplier purchases in period" icon={Truck} />
      )}
    </WidgetShell>
  );
}

function stockTone(qty) {
  if (qty <= 0) return { label: 'Out of Stock', cls: 'bg-rose-100 text-rose-800 border-rose-200', bar: 'bg-rose-500' };
  if (qty < LOW_STOCK_MAX / 2) return { label: 'Critical', cls: 'bg-rose-50 text-rose-700 border-rose-100', bar: 'bg-rose-400' };
  return { label: 'Low Stock', cls: 'bg-amber-50 text-amber-800 border-amber-200', bar: 'bg-amber-500' };
}

export function LowStockWidget({ items, loading }) {
  return (
    <WidgetShell icon={Package} title="Low Stock Alerts" accent="from-rose-500 to-red-600" count={items?.length} loading={loading}>
      {loading ? (
        <WidgetSkeleton />
      ) : items?.length ? (
        <ul className="space-y-2.5">
          {items.map((m, i) => {
            const qty = Number(m.availableQty) || 0;
            const tone = stockTone(qty);
            const pct = qty <= 0 ? 0 : Math.min(100, (qty / LOW_STOCK_MAX) * 100);
            return (
              <li key={m.medicineName + i} className="rounded-xl border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{m.medicineName}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.cls}`}>{tone.label}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{qty} units left</span>
                  <span>Min {LOW_STOCK_MAX}</span>
                </div>
                <ProgressBar pct={pct} tone={tone.bar} />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyWidget message="All medicines adequately stocked" icon={Package} />
      )}
    </WidgetShell>
  );
}

function expiryTone(days) {
  if (days == null) return { label: '—', cls: 'bg-slate-100 text-slate-600' };
  if (days < 0) return { label: 'Expired', cls: 'bg-rose-100 text-rose-800' };
  if (days <= 30) return { label: `${days}d left`, cls: 'bg-rose-100 text-rose-800' };
  if (days <= 60) return { label: `${days}d left`, cls: 'bg-amber-100 text-amber-800' };
  return { label: `${days}d left`, cls: 'bg-emerald-100 text-emerald-800' };
}

export function ExpiryWidget({ items, loading }) {
  return (
    <WidgetShell icon={CalendarClock} title="Expiry Alerts" accent="from-violet-500 to-purple-600" count={items?.length} loading={loading}>
      {loading ? (
        <WidgetSkeleton />
      ) : items?.length ? (
        <ul className="space-y-2.5">
          {items.map((e, i) => {
            const tone = expiryTone(e.daysRemaining);
            return (
              <li key={(e.medicineName || '') + i} className="rounded-xl border border-violet-100/80 bg-violet-50/30 px-2.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">{e.medicineName}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Batch {e.batchNumber || '—'}
                      {e.availableQty != null ? ` · ${e.availableQty} units` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.cls}`}>{tone.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyWidget message="No expiry alerts" icon={AlertTriangle} />
      )}
    </WidgetShell>
  );
}
