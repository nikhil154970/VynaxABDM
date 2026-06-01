import { Ban, CheckCircle2, Clock, FileText, IndianRupee } from 'lucide-react';

export function formatMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function SummaryCard({ icon: Icon, label, value, tone, loading }) {
  return (
    <div
      className={`group rounded-2xl border bg-gradient-to-br p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          {loading ? (
            <div className="mt-1.5 h-6 w-16 animate-pulse rounded-lg bg-white/60" />
          ) : (
            <p className="mt-0.5 text-xl font-bold leading-none text-slate-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingHistoryCards({ summary, loading }) {
  const s = summary || {};
  const cards = [
    {
      label: 'Total Bills',
      value: String(s.totalBills ?? '—'),
      icon: FileText,
      tone: 'from-violet-50 to-indigo-50 text-violet-700 border-violet-100',
    },
    {
      label: 'Total Revenue',
      value: formatMoney(s.totalRevenue),
      icon: IndianRupee,
      tone: 'from-emerald-50 to-lime-50 text-emerald-700 border-emerald-100',
    },
    {
      label: 'Paid Bills',
      value: String(s.paidBills ?? '—'),
      icon: CheckCircle2,
      tone: 'from-blue-50 to-cyan-50 text-blue-700 border-blue-100',
    },
    {
      label: 'Pending Bills',
      value: String(s.pendingBills ?? '—'),
      icon: Clock,
      tone: 'from-amber-50 to-orange-50 text-amber-700 border-amber-100',
    },
    {
      label: 'Cancelled Bills',
      value: String(s.cancelledBills ?? '—'),
      icon: Ban,
      tone: 'from-rose-50 to-red-50 text-rose-700 border-rose-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <SummaryCard key={c.label} icon={c.icon} label={c.label} value={c.value} tone={c.tone} loading={loading} />
      ))}
    </div>
  );
}
