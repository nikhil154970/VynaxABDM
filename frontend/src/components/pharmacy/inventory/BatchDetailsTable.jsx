function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function ExpiryBadge({ tone, days }) {
  const map = {
    critical: 'bg-rose-100 text-rose-800 border-rose-200',
    warning: 'bg-orange-100 text-orange-800 border-orange-200',
    caution: 'bg-amber-100 text-amber-800 border-amber-200',
    normal: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${map[tone] || map.normal}`}>
      {days != null ? `${days} days` : '—'}
    </span>
  );
}

export default function BatchDetailsTable({ batches }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-slate-500">
            <th className="p-2 font-semibold">Batch</th>
            <th className="p-2 font-semibold">Expiry</th>
            <th className="p-2 font-semibold">Purchase</th>
            <th className="p-2 font-semibold">Selling</th>
            <th className="p-2 font-semibold">MRP</th>
            <th className="p-2 font-semibold">Qty</th>
            <th className="p-2 font-semibold">Supplier</th>
            <th className="p-2 font-semibold">GRN</th>
          </tr>
        </thead>
        <tbody>
          {!batches?.length ? (
            <tr>
              <td colSpan={8} className="p-4 text-center text-slate-500">
                No batches — complete a GRN to add stock.
              </td>
            </tr>
          ) : (
            batches.map((b) => (
              <tr key={b.id} className="border-b border-slate-50">
                <td className="p-2 font-semibold">{b.batchNumber}</td>
                <td className="p-2">
                  <div>{formatDate(b.expiryDate)}</div>
                  <ExpiryBadge tone={b.expiryTone} days={b.daysRemaining} />
                </td>
                <td className="p-2">{money(b.purchasePrice)}</td>
                <td className="p-2">{money(b.sellingPrice)}</td>
                <td className="p-2">{money(b.mrp)}</td>
                <td className="p-2 font-semibold">{b.availableQty}</td>
                <td className="p-2">{b.supplierName}</td>
                <td className="p-2 font-semibold text-blue-600">{b.grnNumber}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
