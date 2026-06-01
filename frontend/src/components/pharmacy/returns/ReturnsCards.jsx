import { AlertTriangle, PackageX, RotateCcw, Truck, Users } from 'lucide-react';

export function formatMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function Card({ icon: Icon, label, value, tone, loading }) {
  return (
    <div className={`group rounded-2xl border bg-gradient-to-br p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          {loading ? (
            <div className="mt-1.5 h-6 w-14 animate-pulse rounded bg-white/60" />
          ) : (
            <p className="mt-0.5 text-xl font-bold text-slate-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReturnsCards({ summary, loading }) {
  const s = summary || {};
  const cards = [
    { label: 'Total Returns', value: String(s.totalReturns ?? '—'), icon: RotateCcw, tone: 'from-violet-50 to-indigo-50 text-violet-700 border-violet-100' },
    { label: 'Customer Returns', value: String(s.customerReturns ?? '—'), icon: Users, tone: 'from-blue-50 to-cyan-50 text-blue-700 border-blue-100' },
    { label: 'Vendor Returns', value: String(s.vendorReturns ?? '—'), icon: Truck, tone: 'from-amber-50 to-orange-50 text-amber-700 border-amber-100' },
    { label: 'Expired Returns', value: String(s.expiredReturns ?? '—'), icon: AlertTriangle, tone: 'from-rose-50 to-red-50 text-rose-700 border-rose-100' },
    { label: 'Return Value', value: formatMoney(s.returnValue), icon: PackageX, tone: 'from-emerald-50 to-lime-50 text-emerald-700 border-emerald-100' },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label} icon={c.icon} label={c.label} value={c.value} tone={c.tone} loading={loading} />
      ))}
    </div>
  );
}

export const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-blue-50 text-blue-800 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-800 border-rose-200',
};

export function ReturnStatusBadge({ status, label }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}>
      {label || status}
    </span>
  );
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN');
}
