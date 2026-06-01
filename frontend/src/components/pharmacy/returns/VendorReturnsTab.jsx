import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { fetchSuppliers } from '../../../services/pharmacy/supplierService';
import { createVendorReturn, fetchSupplierBatches } from '../../../services/pharmacy/returnsService';
import { formatMoney } from './ReturnsCards';

const REASONS = ['Damaged', 'Expired', 'Wrong Supply', 'Quality Issue', 'Other'];

export default function VendorReturnsTab({ onSuccess, onError }) {
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [returnQty, setReturnQty] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [returnType, setReturnType] = useState('VENDOR_RETURN');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchSuppliers({ status: 'active' })
      .then((data) => setSuppliers(data?.suppliers || []))
      .catch((err) => {
        onError?.(err.response?.data?.message || 'Failed to load suppliers');
        setSuppliers([]);
      });
  }, [open, onError]);

  useEffect(() => {
    if (!supplierId) {
      setBatches([]);
      return;
    }
    setLoadingBatches(true);
    fetchSupplierBatches(supplierId)
      .then((res) => setBatches(res?.batches || []))
      .catch(() => {
        onError?.('Failed to load batches');
        setBatches([]);
      })
      .finally(() => setLoadingBatches(false));
  }, [supplierId, onError]);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const submit = async () => {
    if (!supplierId || !selectedBatchId) {
      onError?.('Select supplier and batch');
      return;
    }
    const qty = parseInt(returnQty, 10) || 0;
    if (qty <= 0) {
      onError?.('Enter valid return quantity');
      return;
    }
    if (selectedBatch && qty > selectedBatch.availableQty) {
      onError?.('Return qty exceeds available stock');
      return;
    }

    setSubmitting(true);
    try {
      await createVendorReturn({
        supplierId,
        returnType,
        items: [{ inventoryBatchId: selectedBatchId, returnQty: qty, reason }],
      });
      onSuccess?.('Vendor return created — pending approval');
      setOpen(false);
      setSupplierId('');
      setSelectedBatchId('');
      setReturnQty('');
    } catch (err) {
      onError?.(err.response?.data?.message || 'Failed to create vendor return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3">
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
        >
          <Plus className="h-4 w-4" /> Create Vendor Return
        </button>
      </div>

      {open ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm max-w-2xl mx-auto">
          <div className="flex justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">New Vendor Return</p>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate-500">Close</button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Return Type</label>
              <select value={returnType} onChange={(e) => setReturnType(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="VENDOR_RETURN">Vendor Return</option>
                <option value="DAMAGED_RETURN">Damaged Return</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Supplier</label>
              <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setSelectedBatchId(''); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.supplierName || s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Inventory Batch</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                disabled={loadingBatches || !supplierId}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">{loadingBatches ? 'Loading…' : 'Select batch…'}</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.medicineName} — {b.batchNumber} (Avail: {b.availableQty})
                  </option>
                ))}
              </select>
            </div>
            {selectedBatch ? (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 grid grid-cols-2 gap-2">
                <span>Expiry: {selectedBatch.expiryDate ? new Date(selectedBatch.expiryDate).toLocaleDateString('en-IN') : '—'}</span>
                <span>Purchase: {formatMoney(selectedBatch.purchasePrice)}</span>
                <span>Available: {selectedBatch.availableQty}</span>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Return Qty</label>
                <input type="number" min={1} value={returnQty} onChange={(e) => setReturnQty(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  {REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="button" onClick={submit} disabled={submitting} className="w-full rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit Vendor Return'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500 py-8">Return stock to suppliers. Inventory is reduced after approval.</p>
      )}
    </div>
  );
}
