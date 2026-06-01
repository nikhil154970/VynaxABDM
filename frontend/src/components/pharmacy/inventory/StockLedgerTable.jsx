function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StockLedgerTable({ ledger, showMedicine = false }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-slate-500">
            <th className="p-2 font-semibold">Date</th>
            {showMedicine ? <th className="p-2 font-semibold">Medicine</th> : null}
            <th className="p-2 font-semibold">Type</th>
            <th className="p-2 font-semibold">Reference</th>
            <th className="p-2 font-semibold">Batch</th>
            <th className="p-2 font-semibold">In</th>
            <th className="p-2 font-semibold">Out</th>
            <th className="p-2 font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          {!ledger?.length ? (
            <tr>
              <td colSpan={showMedicine ? 8 : 7} className="p-4 text-center text-slate-500">
                No transactions yet.
              </td>
            </tr>
          ) : (
            ledger.map((tx) => (
              <tr key={tx.id} className="border-b border-slate-50">
                <td className="p-2">{formatDate(tx.date)}</td>
                {showMedicine ? <td className="p-2 font-medium">{tx.medicineName}</td> : null}
                <td className="p-2">{tx.transactionType || tx.type}</td>
                <td className="p-2">{tx.reference}</td>
                <td className="p-2">{tx.batchNumber}</td>
                <td className="p-2 font-semibold text-emerald-600">{tx.qtyIn || '—'}</td>
                <td className="p-2 font-semibold text-rose-600">{tx.qtyOut || '—'}</td>
                <td className="p-2 font-semibold">{tx.balance}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
