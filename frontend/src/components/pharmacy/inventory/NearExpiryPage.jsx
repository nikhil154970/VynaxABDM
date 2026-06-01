function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function ExpiryTone({ tone, days }) {
  const map = {
    critical: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-orange-200 bg-orange-50 text-orange-800',
    caution: 'border-amber-200 bg-amber-50 text-amber-900',
    normal: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return (
    <span className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${map[tone] || map.normal}`}>
      {days != null ? `${days} days` : '—'}
    </span>
  );
}

export default function NearExpiryPage({ rows, loading }) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="pharmacy-inventory-skeleton h-11 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="px-6 py-12 text-center text-sm text-slate-500">
        No batches nearing expiry in the configured window.
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="pharmacy-inventory-table w-full min-w-[720px]">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Batch</th>
              <th>Expiry Date</th>
              <th>Days Remaining</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.medicineId}-${row.batchNumber}`}>
                <td>
                  <div className="font-semibold text-blue-600">{row.medicineName}</div>
                  <div className="text-[11px] text-slate-500">{row.genericName}</div>
                </td>
                <td className="font-semibold">{row.batchNumber}</td>
                <td>{formatDate(row.expiryDate)}</td>
                <td>
                  <ExpiryTone tone={row.tone} days={row.daysRemaining} />
                </td>
                <td className="font-bold">{row.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 md:hidden">
        {rows.map((row) => (
          <div key={`${row.medicineId}-${row.batchNumber}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-bold">{row.medicineName}</p>
            <p className="text-xs text-slate-500">Batch {row.batchNumber}</p>
            <div className="mt-2 flex items-center justify-between">
              <ExpiryTone tone={row.tone} days={row.daysRemaining} />
              <span className="font-bold">{row.stock} units</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Expires {formatDate(row.expiryDate)}</p>
          </div>
        ))}
      </div>
    </>
  );
}
