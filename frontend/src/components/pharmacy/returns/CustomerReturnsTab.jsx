import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { createCustomerReturn, searchReturnBills } from '../../../services/pharmacy/returnsService';
import { formatMoney } from './ReturnsCards';

const REFUND_TYPES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'STORE_CREDIT', label: 'Store Credit' },
  { value: 'NO_REFUND', label: 'No Refund' },
];

const REASONS = ['Wrong Medicine', 'Patient Refused', 'Excess Quantity', 'Billing Error', 'Other'];

export default function CustomerReturnsTab({ onSuccess, onError }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [billQuery, setBillQuery] = useState('');
  const [bills, setBills] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [lines, setLines] = useState({});
  const [refundType, setRefundType] = useState('CASH');
  const [defaultReason, setDefaultReason] = useState(REASONS[0]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep(1);
    setBillQuery('');
    setBills([]);
    setSelectedBill(null);
    setLines({});
    setRefundType('CASH');
    setDefaultReason(REASONS[0]);
  };

  const searchBills = useCallback(async () => {
    const q = billQuery.trim();
    if (q.length < 2) {
      onError?.('Enter at least 2 characters to search');
      return;
    }
    setSearching(true);
    try {
      const res = await searchReturnBills(q);
      setBills(res?.bills || []);
      if (!(res?.bills || []).length) onError?.('No bills found');
    } catch (err) {
      onError?.(err.response?.data?.message || 'Bill search failed');
      setBills([]);
    } finally {
      setSearching(false);
    }
  }, [billQuery, onError]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (billQuery.trim().length >= 2 && step === 1) searchBills();
    }, 400);
    return () => clearTimeout(t);
  }, [billQuery, open, step, searchBills]);

  const selectBill = (bill) => {
    setSelectedBill(bill);
    const init = {};
    (bill.items || []).forEach((item) => {
      if (item.maxReturnQty > 0) {
        init[item.id] = { returnQty: '', reason: defaultReason };
      }
    });
    setLines(init);
    setStep(2);
  };

  const submit = async () => {
    if (!selectedBill) return;
    const items = Object.entries(lines)
      .map(([billItemId, v]) => ({
        billItemId,
        returnQty: parseInt(v.returnQty, 10) || 0,
        reason: v.reason || defaultReason,
      }))
      .filter((i) => i.returnQty > 0);

    if (!items.length) {
      onError?.('Enter return quantity for at least one medicine');
      return;
    }

    setSubmitting(true);
    try {
      await createCustomerReturn({
        billId: selectedBill.id,
        refundType,
        items,
      });
      onSuccess?.('Customer return completed — inventory updated');
      setOpen(false);
      reset();
    } catch (err) {
      onError?.(err.response?.data?.message || 'Failed to create return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3">
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md"
        >
          <Plus className="h-4 w-4" /> Create Customer Return
        </button>
      </div>

      {open ? (
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <p className="text-sm font-bold text-slate-900">New Customer Return — Step {step} of 2</p>
            <button type="button" onClick={() => { setOpen(false); reset(); }} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
              Cancel
            </button>
          </div>

          {step === 1 ? (
            <>
              <label className="text-xs font-semibold text-slate-600">Search Bill (number / patient / UHID)</label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={billQuery}
                    onChange={(e) => setBillQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
                    placeholder="Bill number or patient name…"
                  />
                </div>
                <button type="button" onClick={searchBills} disabled={searching} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {searching ? '…' : 'Search'}
                </button>
              </div>
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {bills.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => selectBill(b)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/30 transition"
                  >
                    <span className="font-mono text-sm font-bold text-blue-700">{b.billNumber}</span>
                    <p className="text-xs text-slate-600 mt-0.5">{b.patientName} · {b.patientUhid} · {formatMoney(b.grandTotal)}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-600 mb-3">
                Bill <span className="font-mono font-bold text-blue-700">{selectedBill?.billNumber}</span> — {selectedBill?.patientName}
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="bg-[#f8faff] text-left text-[11px] font-semibold uppercase text-slate-500">
                      <th className="px-2 py-2">Medicine</th>
                      <th className="px-2 py-2">Batch</th>
                      <th className="px-2 py-2">Sold</th>
                      <th className="px-2 py-2">Max Return</th>
                      <th className="px-2 py-2">Return Qty</th>
                      <th className="px-2 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedBill?.items || []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-2 py-2 font-medium">{item.medicineName}</td>
                        <td className="px-2 py-2">{item.batchNumber}</td>
                        <td className="px-2 py-2">{item.quantitySold}</td>
                        <td className="px-2 py-2">{item.maxReturnQty}</td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            max={item.maxReturnQty}
                            disabled={item.maxReturnQty <= 0}
                            value={lines[item.id]?.returnQty ?? ''}
                            onChange={(e) =>
                              setLines((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], returnQty: e.target.value, reason: prev[item.id]?.reason || defaultReason },
                              }))
                            }
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={lines[item.id]?.reason || defaultReason}
                            onChange={(e) =>
                              setLines((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], reason: e.target.value, returnQty: prev[item.id]?.returnQty ?? '' },
                              }))
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          >
                            {REASONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Refund Type</label>
                  <select value={refundType} onChange={(e) => setRefundType(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    {REFUND_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Default Reason</label>
                  <select value={defaultReason} onChange={(e) => setDefaultReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    {REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold">
                  Back
                </button>
                <button type="button" onClick={submit} disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {submitting ? 'Submitting…' : 'Submit Return'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500 py-8">Create a customer return from billing history. Stock is restored automatically on submit.</p>
      )}
    </div>
  );
}
