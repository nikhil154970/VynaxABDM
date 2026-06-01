import { useEffect, useState } from 'react';
import { Barcode, Plus, Search } from 'lucide-react';
import { searchInventory } from '../../../services/pharmacy/billingService';

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function MedicineSearch({ onAddLine, disabled }) {
  const [query, setQuery] = useState('');
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedQ = useDebounced(query);

  useEffect(() => {
    if (!debouncedQ || debouncedQ.length < 2) {
      setResults([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    searchInventory(barcodeMode ? { barcode: debouncedQ } : { q: debouncedQ })
      .then((data) => {
        if (active) setResults(data.medicines || []);
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQ, barcodeMode]);

  const handlePick = (med, batch) => {
    const b = batch || med.defaultBatch || med.batches?.[0];
    if (!b) return;
    onAddLine({
      medicineId: med.medicineId,
      inventoryBatchId: b.inventoryBatchId,
      medicineName: med.medicineName,
      genericName: med.genericName,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      availableQty: b.availableQty,
      quantity: 1,
      mrp: b.mrp,
      sellingPrice: b.sellingPrice,
      discountPercent: 0,
      gstPercentage: b.gstPercentage,
      batches: med.batches,
    });
    setQuery('');
    setResults([]);
  };

  return (
    <div className="relative">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            disabled={disabled}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={barcodeMode ? 'Scan or enter barcode' : 'Medicine, generic, batch...'}
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setBarcodeMode((v) => !v)}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
            barcodeMode
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Barcode className="h-4 w-4" />
          Barcode
        </button>
      </div>

      {(loading || results.length > 0) && query.length >= 2 && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-4 text-center text-xs text-slate-500">Searching inventory...</p>
          ) : (
            results.map((med) => (
              <div key={med.medicineId} className="border-b border-slate-50 last:border-0">
                <div className="px-3 py-2 text-xs font-semibold text-slate-800">
                  {med.medicineName}
                  {med.genericName ? <span className="font-normal text-slate-500"> ({med.genericName})</span> : null}
                  <span className="ml-2 text-emerald-600">Stock: {med.totalAvailable}</span>
                </div>
                {(med.batches || []).map((b) => (
                  <button
                    key={b.inventoryBatchId}
                    type="button"
                    onClick={() => handlePick(med, b)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] hover:bg-violet-50"
                  >
                    <span>
                      Batch {b.batchNumber}
                      {b.isFefo ? <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">FEFO</span> : null}
                    </span>
                    <span className="flex items-center gap-2 text-slate-600">
                      <span>Exp {new Date(b.expiryDate).toLocaleDateString('en-IN')}</span>
                      <span className="font-semibold">Qty {b.availableQty}</span>
                      <Plus className="h-3.5 w-3.5 text-blue-600" />
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
