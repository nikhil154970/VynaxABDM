import { Pencil, Printer } from 'lucide-react';
import { money } from '../../../lib/pharmacy/billingCalc';

function StatusBadge({ status }) {
  const styles = {
    Paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-100',
    'Pending Payment': 'bg-orange-50 text-orange-700 border-orange-100',
    Draft: 'bg-slate-100 text-slate-600 border-slate-200',
    Cancelled: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.Draft}`}
    >
      {status}
    </span>
  );
}

export default function RecentBillsTable({ bills, loading, onPrint, onResume, onDelete, editingBillId }) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!bills?.length) {
    return <p className="px-4 py-8 text-center text-sm text-slate-500">No bills yet. Create your first pharmacy bill above.</p>;
  }

  return (
    <div className="overflow-x-auto p-3">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-xs">
        <thead>
          <tr className="text-left text-xs font-semibold text-slate-500">
            {['Bill No', 'Patient', 'Type', 'Amount', 'Status', 'Time', 'Action'].map((h) => (
              <th key={h} className="border-b border-slate-100 bg-slate-50 px-2.5 py-2.5 first:rounded-l-xl last:rounded-r-xl">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => (
            <tr key={bill.id}>
              <td className="border-b border-slate-100 px-2.5 py-2.5 font-semibold text-blue-600">{bill.billNumber}</td>
              <td className="border-b border-slate-100 px-2.5 py-2.5 text-slate-700">{bill.patientName}</td>
              <td className="border-b border-slate-100 px-2.5 py-2.5 text-slate-600">{bill.billingTypeLabel}</td>
              <td className="border-b border-slate-100 px-2.5 py-2.5 font-semibold text-slate-900">
                {money(bill.grandTotal)}
              </td>
              <td className="border-b border-slate-100 px-2.5 py-2.5">
                <StatusBadge status={bill.statusLabel} />
              </td>
              <td className="border-b border-slate-100 px-2.5 py-2.5 text-slate-600">
                {new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="border-b border-slate-100 px-2.5 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {bill.status === 'DRAFT' && onResume ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onResume(bill.id)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                          editingBillId === bill.id
                            ? 'border-violet-300 bg-violet-50 text-violet-700'
                            : 'border-violet-200 text-violet-700 hover:bg-violet-50'
                        }`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {editingBillId === bill.id ? 'Editing' : 'Resume'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete && onDelete(bill.id, bill.billNumber)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                  {bill.status !== 'DRAFT' ? (
                    <button
                      type="button"
                      onClick={() => onPrint(bill.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
