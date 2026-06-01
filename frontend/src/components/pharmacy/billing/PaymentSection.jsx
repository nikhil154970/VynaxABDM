import { useEffect, useState } from 'react';
import { WalletCards, X } from 'lucide-react';
import { money } from '../../../lib/pharmacy/billingCalc';

const MODES = [
  { id: 'CASH', label: 'Cash' },
  { id: 'UPI', label: 'UPI' },
  { id: 'CARD', label: 'Card' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { id: 'MIXED', label: 'Mixed' },
];

export default function PaymentSection({ open, grandTotal, onClose, onConfirm, loading }) {
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');

  useEffect(() => {
    if (open) {
      setPaymentMode('CASH');
      setPaidAmount(String(grandTotal ?? ''));
    }
  }, [open, grandTotal]);

  if (!open) return null;

  const pending = Math.max(0, Number(grandTotal) - (Number(paidAmount) || 0));

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <WalletCards className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Payment</h3>
              <p className="text-xs text-slate-500">Grand total {money(grandTotal)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Payment mode</span>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMode(m.id)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  paymentMode === m.id
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Amount received</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          />
          <p className="mt-1 text-[11px] text-slate-500">Pending after pay: {money(pending)}</p>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirm({ paymentMode, paidAmount: Number(paidAmount) || 0 })}
            className="rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Processing...' : 'Confirm & Bill'}
          </button>
        </div>
      </div>
    </div>
  );
}
