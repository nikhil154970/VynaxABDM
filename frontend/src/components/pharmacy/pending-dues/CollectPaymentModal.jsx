import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatMoney } from './PendingDuesTable';

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'MIXED', label: 'Mixed' },
];

export default function CollectPaymentModal({ open, bill, submitting, onClose, onSubmit }) {
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && bill) {
      setAmountReceived(String(bill.pendingAmount ?? ''));
      setPaymentMode('CASH');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [open, bill]);

  if (!open || !bill) return null;

  const pending = Number(bill.pendingAmount) || 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = Number(amountReceived);
    if (!amount || amount <= 0) return;
    if (amount > pending) return;
    onSubmit({
      billId: bill.billId || bill.id,
      amountReceived: amount,
      paymentMode,
      paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-extrabold text-slate-900">Collect Payment</p>
            <p className="text-xs text-slate-500 font-mono">{bill.billNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Bill Number</label>
            <input
              readOnly
              value={bill.billNumber}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Pending Amount</label>
            <input
              readOnly
              value={formatMoney(pending)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Amount Received</label>
            <input
              type="number"
              min="0.01"
              max={pending}
              step="0.01"
              required
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Payment Date</label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional payment notes…"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Processing…' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
