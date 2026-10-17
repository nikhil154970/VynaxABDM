
const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  PARTIALLY_PAID: 'bg-blue-50 text-blue-800 border-blue-200',
  OVERDUE: 'bg-rose-50 text-rose-800 border-rose-200',
  CLEARED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export function DueStatusBadge({ status, label }) {
  const display = label || status;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}
    >
      {display}
    </span>
  );
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN');
}

export function formatMoney(n) {
  const x = Math.max(0, Number(n) || 0);
  return `₹${x.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const cellCls = 'px-2.5 py-1.5 align-middle text-xs text-slate-700 whitespace-nowrap';

export default function PendingDuesTable({
  items,
  loading,
  readOnly,
  onViewDetails,
  onCollectPayment,
  onPrintStatement,
}) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[1050px] text-xs">
          <thead>
            <tr style={{ background: '#f8faff' }}>
              {[
                'Patient Name',
                'UHID',
                'Patient Type',
                'Bill Number',
                'Total Amount',
                'Paid Amount',
                'Pending Amount',
                'Last Payment Date',
                'Status',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
                  className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} className={cellCls}>
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length ? (
              items.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/20 transition">
                  <td className={`${cellCls} max-w-[140px] truncate font-semibold text-slate-900`} title={r.patientName}>
                    {r.patientName}
                  </td>
                  <td className={`${cellCls} font-mono`}>{r.patientUhid || '—'}</td>
                  <td className={cellCls}>{r.patientTypeLabel}</td>
                  <td className={cellCls}>
                    <span className="font-mono text-blue-700">{r.billNumber}</span>
                  </td>
                  <td className={cellCls}>{formatMoney(r.totalAmount)}</td>
                  <td className={cellCls}>{formatMoney(r.paidAmount)}</td>
                  <td className={`${cellCls} font-semibold text-rose-700`}>{formatMoney(r.pendingAmount)}</td>
                  <td className={cellCls}>{formatDateTime(r.lastPaymentDate)}</td>
                  <td className={cellCls}>
                    <DueStatusBadge status={r.status} label={r.statusLabel} />
                  </td>
                  <td className={cellCls}>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onViewDetails(r)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View Details
                      </button>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={() => onCollectPayment(r)}
                          className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                        >
                          Collect Payment
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onPrintStatement(r)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-slate-400">
                  No pending pharmacy dues
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden p-3 space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          ))
        ) : items.length ? (
          items.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 truncate">{r.patientName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    UHID: <span className="font-mono font-bold">{r.patientUhid || '—'}</span> · {r.patientTypeLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Bill: <span className="font-mono font-bold text-blue-700">{r.billNumber}</span>
                  </p>
                  <p className="mt-1 text-xs font-semibold text-rose-700">Pending: {formatMoney(r.pendingAmount)}</p>
                </div>
                <DueStatusBadge status={r.status} label={r.statusLabel} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onViewDetails(r)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  View
                </button>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => onCollectPayment(r)}
                    className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                  >
                    Collect
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onPrintStatement(r)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Print
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            No pending pharmacy dues
          </div>
        )}
      </div>
    </>
  );
}
