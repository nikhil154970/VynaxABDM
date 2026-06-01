import { formatMoney } from './BillingHistoryCards';
import { formatDateTime } from './BillingHistoryTable';

export default function PaymentHistoryTable({ payments = [] }) {
  if (!payments.length) {
    return <p className="text-xs text-slate-400">No payment transactions recorded</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pb-2 pr-2">Date</th>
            <th className="pb-2 pr-2">Amount</th>
            <th className="pb-2 pr-2">Mode</th>
            <th className="pb-2 pr-2">Collected By</th>
            <th className="pb-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="py-2 pr-2 text-slate-700">{formatDateTime(p.createdAt)}</td>
              <td className="py-2 pr-2 font-semibold text-emerald-700">{formatMoney(p.amount)}</td>
              <td className="py-2 pr-2 text-slate-700">{p.paymentModeLabel || p.paymentMode}</td>
              <td className="py-2 pr-2 text-slate-700">{p.collectedBy || '—'}</td>
              <td className="py-2 text-slate-500">{p.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
