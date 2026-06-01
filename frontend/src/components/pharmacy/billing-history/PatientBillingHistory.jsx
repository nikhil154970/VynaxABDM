import { formatMoney } from './BillingHistoryCards';
import { BillStatusBadge, formatDateTime } from './BillingHistoryTable';

export default function PatientBillingHistory({ bills = [], onSelectBill }) {
  if (!bills.length) {
    return <p className="text-xs text-slate-400">No previous pharmacy bills for this patient</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pb-2 pr-2">Bill No</th>
            <th className="pb-2 pr-2">Date</th>
            <th className="pb-2 pr-2">Amount</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((b) => (
            <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50/50">
              <td className="py-2 pr-2">
                <button
                  type="button"
                  onClick={() => onSelectBill?.(b)}
                  className="font-mono font-semibold text-blue-700 hover:underline"
                >
                  {b.billNumber}
                </button>
              </td>
              <td className="py-2 pr-2 text-slate-700">{formatDateTime(b.billDate)}</td>
              <td className="py-2 pr-2 font-semibold text-slate-900">{formatMoney(b.totalAmount)}</td>
              <td className="py-2">
                <BillStatusBadge status={b.status} label={b.statusLabel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
