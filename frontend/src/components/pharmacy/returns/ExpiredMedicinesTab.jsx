import { useCallback, useEffect, useState } from 'react';
import { createExpiredReturn, fetchExpiredBatches } from '../../../services/pharmacy/returnsService';
import { formatMoney } from './ReturnsCards';

export default function ExpiredMedicinesTab({ onSuccess, onError }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchExpiredBatches();
      setBatches(res?.batches || []);
    } catch (err) {
      onError?.(err.response?.data?.message || 'Failed to load expired batches');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const createReturn = async (batchId) => {
    setSubmittingId(batchId);
    try {
      await createExpiredReturn({ batchIds: [batchId] });
      onSuccess?.('Expired return created — pending approval');
      load();
    } catch (err) {
      onError?.(err.response?.data?.message || 'Failed to create expired return');
    } finally {
      setSubmittingId(null);
    }
  };

  const cellCls = 'px-2.5 py-2 text-xs text-slate-700';

  return (
    <div className="p-3">
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-xs">
          <thead>
            <tr className="bg-[#f8faff] text-left text-[11px] font-semibold uppercase text-slate-500">
              {['Medicine', 'Batch', 'Expiry', 'Available Qty', 'Purchase Value', 'Action'].map((h) => (
                <th key={h} className="px-2.5 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Loading expired batches…</td></tr>
            ) : batches.length ? (
              batches.map((b) => (
                <tr key={b.id} className="hover:bg-rose-50/20">
                  <td className={cellCls}>{b.medicineName}</td>
                  <td className={cellCls}>{b.batchNumber}</td>
                  <td className={cellCls}>{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td className={cellCls}>{b.availableQty}</td>
                  <td className={cellCls}>{formatMoney(b.purchaseValue)}</td>
                  <td className={cellCls}>
                    <button
                      type="button"
                      onClick={() => createReturn(b.id)}
                      disabled={submittingId === b.id}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {submittingId === b.id ? '…' : 'Create Return'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">No expired batches with stock</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {!loading &&
          batches.map((b) => (
            <div key={b.id} className="rounded-2xl border border-rose-100 bg-white p-3 shadow-sm">
              <p className="font-semibold text-sm">{b.medicineName}</p>
              <p className="text-xs text-slate-600 mt-1">Batch {b.batchNumber} · Qty {b.availableQty}</p>
              <p className="text-xs text-slate-500">Expiry: {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-IN') : '—'}</p>
              <button
                type="button"
                onClick={() => createReturn(b.id)}
                disabled={submittingId === b.id}
                className="mt-2 w-full rounded-lg bg-rose-600 py-2 text-xs font-bold text-white"
              >
                Create Return
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
