import { FileText } from 'lucide-react';
import { money } from '../../../lib/pharmacy/billingCalc';

export default function BillSummaryCard({ totals, statusLabel = 'Draft', children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <FileText className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-slate-900">Bill Summary</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{statusLabel}</span>
      </div>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <strong className="font-semibold text-slate-800">{money(totals.subtotal)}</strong>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Discount</span>
          <strong className="font-semibold text-emerald-600">- {money(totals.discount)}</strong>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>GST</span>
          <strong className="font-semibold text-slate-800">{money(totals.gstAmount)}</strong>
        </div>
        <div className="border-t border-dashed border-slate-200 pt-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Grand Total</span>
            <strong className="text-xl font-bold text-slate-950">{money(totals.grandTotal)}</strong>
          </div>
        </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
