import {
  AlertTriangle,
  Building2,
  IndianRupee,
  Stethoscope,
  Users,
} from 'lucide-react';

function formatMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function SummaryCard({ icon: Icon, label, value, tone, iconColor, loading }) {
  return (
    <div
      className={`group rounded-2xl border bg-gradient-to-br p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" style={{ color: iconColor }} strokeWidth={2.2} />
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

export default function PendingDuesCards({ summary, loading }) {
  const s = summary || {};
  const cards = [
    {
      label: 'Total Pending Dues',
      value: String(s.totalPendingAccounts ?? '—'),
      icon: Users,
      tone: 'from-blue-50/50 to-sky-50/20 text-[#0077B6] border-blue-100',
      iconColor: '#0077B6',
    },
    {
      label: 'Total Outstanding Amount',
      value: formatMoney(s.totalOutstandingAmount),
      icon: IndianRupee,
      tone: 'from-[#001B48]/5 to-slate-50 text-[#001B48] border-[#001B48]/10',
      iconColor: '#001B48',
    },
    {
      label: 'IPD Pending Dues',
      value: String(s.ipdPending ?? '—'),
      icon: Building2,
      tone: 'from-blue-50/50 to-sky-50/20 text-[#0077B6] border-blue-100',
      iconColor: '#0077B6',
    },
    {
      label: 'OPD Pending Dues',
      value: String(s.opdPending ?? '—'),
      icon: Stethoscope,
      tone: 'from-[#001B48]/5 to-slate-50 text-[#001B48] border-[#001B48]/10',
      iconColor: '#001B48',
    },
    {
      label: 'Overdue Accounts',
      value: String(s.overdueAccounts ?? '—'),
      icon: AlertTriangle,
      tone: 'from-blue-50/50 to-sky-50/20 text-[#0077B6] border-blue-100',
      iconColor: '#0077B6',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <SummaryCard
          key={c.label}
          icon={c.icon}
          label={c.label}
          value={c.value}
          tone={c.tone}
          iconColor={c.iconColor}
          loading={loading}
        />
      ))}
    </div>
  );
}

export { formatMoney };
