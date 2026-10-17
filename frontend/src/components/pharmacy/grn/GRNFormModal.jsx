import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, Trash2, X } from 'lucide-react';
import { fetchMedicines } from '../../../services/pharmacy/medicineService';
import { fetchPurchaseOrdersForGrn } from '../../../services/pharmacy/grnService';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100';

function lineKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyLine(overrides = {}) {
  return {
    key: lineKey(),
    medicineId: '',
    medicineName: '',
    orderedQty: '0',
    receivedQty: '',
    freeQty: '0',
    batchNumber: '',
    expiryDate: '',
    purchasePrice: '',
    sellingPrice: '',
    mrp: '',
    gstPercentage: '12',
    ...overrides,
  };
}

function calcLine(receivedQty, purchasePrice, gstPercentage) {
  const qty = Math.max(0, Number(receivedQty) || 0);
  const price = Math.max(0, Number(purchasePrice) || 0);
  const gst = Math.max(0, Number(gstPercentage) || 0);
  const lineBase = qty * price;
  const lineGst = lineBase * (gst / 100);
  return { lineBase, lineGst, amount: lineBase + lineGst };
}

function calcTotals(lines) {
  let subTotal = 0;
  let gstAmount = 0;
  lines.forEach((l) => {
    const { lineBase, lineGst } = calcLine(l.receivedQty, l.purchasePrice, l.gstPercentage);
    subTotal += lineBase;
    gstAmount += lineGst;
  });
  return { subTotal, gstAmount, grandTotal: subTotal + gstAmount };
}

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function linesFromPo(po, medDefaults = {}) {
  return (po.items || []).map((item) => {
    const med = medDefaults[item.medicineId] || {};
    return emptyLine({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      orderedQty: String(item.orderedQty ?? 0),
      receivedQty: String(item.orderedQty ?? ''),
      purchasePrice: String(item.purchasePrice ?? med.defaultPurchasePrice ?? ''),
      sellingPrice: String(med.defaultSellingPrice ?? ''),
      mrp: String(med.defaultMRP ?? ''),
      gstPercentage: String(item.gstPercentage ?? med.gstPercentage ?? 12),
    });
  });
}

function linesFromGrn(grn) {
  return (grn.items || []).map((item) =>
    emptyLine({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      orderedQty: String(item.orderedQty ?? 0),
      receivedQty: String(item.receivedQty ?? ''),
      freeQty: String(item.freeQty ?? 0),
      batchNumber: item.batchNumber || '',
      expiryDate: toDateInput(item.expiryDate),
      purchasePrice: String(item.purchasePrice ?? ''),
      sellingPrice: String(item.sellingPrice ?? ''),
      mrp: String(item.mrp ?? ''),
      gstPercentage: String(item.gstPercentage ?? 12),
    })
  );
}

export default function GRNFormModal({ open, mode, grn, saving, onClose, onSubmit, onValidationError }) {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [poId, setPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [poOpen, setPoOpen] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const [poData, medData] = await Promise.all([
        fetchPurchaseOrdersForGrn(),
        fetchMedicines({ status: 'active' }),
      ]);
      setPurchaseOrders(poData.purchaseOrders || []);
      setMedicines(medData.medicines || []);
    } catch {
      setPurchaseOrders([]);
      setMedicines([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadCatalog();
    if (mode === 'edit' && grn) {
      setPoId(grn.purchaseOrderId || '');
      setInvoiceNumber(grn.invoiceNumber || '');
      setInvoiceDate(toDateInput(grn.invoiceDate));
      setReceivedDate(toDateInput(grn.receivedDate) || new Date().toISOString().slice(0, 10));
      setRemarks(grn.remarks || '');
      setLines(linesFromGrn(grn).length ? linesFromGrn(grn) : [emptyLine()]);
    } else {
      setPoId('');
      setInvoiceNumber('');
      setInvoiceDate('');
      setReceivedDate(new Date().toISOString().slice(0, 10));
      setRemarks('');
      setLines([emptyLine()]);
    }
    setErrors({});
    setFormError('');
    setPoOpen(false);
    setPoSearch('');
  }, [open, mode, grn, loadCatalog]);

  const medMap = useMemo(() => {
    const m = {};
    medicines.forEach((med) => {
      m[med.id] = med;
    });
    return m;
  }, [medicines]);

  const filteredPos = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return purchaseOrders;
    return purchaseOrders.filter(
      (p) =>
        p.poNumber?.toLowerCase().includes(q) ||
        p.supplierName?.toLowerCase().includes(q)
    );
  }, [purchaseOrders, poSearch]);

  const selectedPo = purchaseOrders.find((p) => p.id === poId);

  const totals = useMemo(() => calcTotals(lines), [lines]);

  const handlePoSelect = (id) => {
    const po = purchaseOrders.find((p) => p.id === id);
    setPoId(id);
    setPoOpen(false);
    setErrors((e) => ({ ...e, purchaseOrderId: undefined }));
    if (po) {
      setLines(linesFromPo(po, medMap).length ? linesFromPo(po, medMap) : [emptyLine()]);
    }
  };

  const setLine = (key, patch) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addBatchRow = (line) => {
    setLines((prev) => [
      ...prev,
      emptyLine({
        medicineId: line.medicineId,
        medicineName: line.medicineName,
        orderedQty: line.orderedQty,
        receivedQty: '',
        freeQty: '0',
        purchasePrice: line.purchasePrice,
        sellingPrice: line.sellingPrice,
        mrp: line.mrp,
        gstPercentage: line.gstPercentage,
      }),
    ]);
  };

  const removeLine = (key) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.key !== key);
      return next.length ? next : [emptyLine()];
    });
  };

  const validate = () => {
    const next = {};
    const messages = [];

    if (!poId) {
      next.purchaseOrderId = 'Select a purchase order';
      messages.push('Select a purchase order');
    }
    if (!receivedDate) {
      next.receivedDate = 'Received date is required';
      messages.push('Received date is required');
    }

    const medicineLines = lines.filter((l) => l.medicineId);
    if (!medicineLines.length) {
      next.items = 'Add at least one medicine line';
      messages.push('Add at least one medicine');
    }

    medicineLines.forEach((line) => {
      if (!normalizeString(line.batchNumber)) {
        next[`${line.key}-batch`] = 'Batch required';
        messages.push(`Batch number required for ${line.medicineName || 'medicine'}`);
      }
      if (!line.expiryDate) {
        next[`${line.key}-exp`] = 'Expiry required';
        messages.push(`Expiry date required for ${line.medicineName || 'medicine'}`);
      }
      const rq = Number(line.receivedQty);
      const fq = Number(line.freeQty) || 0;
      if ((!Number.isFinite(rq) || rq <= 0) && fq <= 0) {
        next[`${line.key}-qty`] = 'Enter received or free qty';
        messages.push(`Quantity required for ${line.medicineName || 'medicine'}`);
      }
      const pp = Number(line.purchasePrice);
      const sp = Number(line.sellingPrice);
      const mrpVal = Number(line.mrp);
      if (!Number.isFinite(pp) || pp < 0) {
        next[`${line.key}-pp`] = 'Required';
        messages.push(`Purchase price required for ${line.medicineName || 'medicine'}`);
      }
      if (!Number.isFinite(sp) || sp < 0) {
        next[`${line.key}-sp`] = 'Required';
      }
      if (!Number.isFinite(mrpVal) || mrpVal < 0) {
        next[`${line.key}-mrp`] = 'Required';
      }
    });

    const summary = messages.length
      ? messages.slice(0, 3).join(' · ') + (messages.length > 3 ? ' …' : '')
      : '';
    setErrors(next);
    setFormError(summary);
    return { ok: Object.keys(next).length === 0, summary };
  }

  function normalizeString(v) {
    if (v == null) return '';
    return String(v).trim();
  }

  const buildPayload = () => ({
    purchaseOrderId: poId,
    invoiceNumber,
    invoiceDate: invoiceDate || null,
    receivedDate,
    remarks,
    items: lines
      .filter((l) => l.medicineId && normalizeString(l.batchNumber))
      .map((l) => ({
        medicineId: l.medicineId,
        medicineName: l.medicineName,
        orderedQty: Number(l.orderedQty) || 0,
        receivedQty: Number(l.receivedQty) || 0,
        freeQty: Number(l.freeQty) || 0,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
        purchasePrice: Number(l.purchasePrice),
        sellingPrice: Number(l.sellingPrice),
        mrp: Number(l.mrp),
        gstPercentage: Number(l.gstPercentage),
      })),
  });

  const handleSubmit = (action) => {
    setPoOpen(false);
    const { ok, summary } = validate();
    if (!ok) {
      onValidationError?.(summary || 'Please complete all required GRN fields.');
      return;
    }
    setFormError('');
    onSubmit(buildPayload(), action, setErrors);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <div
        className="relative flex max-h-[96vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
              {mode === 'edit' ? 'Edit GRN' : 'Create GRN'}
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'edit' ? grn?.grnNumber : 'Goods Receipt Note'}
            </h2>
            <p className="text-xs text-slate-500">Actual prices & batches update inventory on complete.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Purchase Order <span className="text-red-500">*</span>
              </span>
              <div className="relative">
                <button
                  type="button"
                  disabled={mode === 'edit'}
                  onClick={() => setPoOpen((v) => !v)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm disabled:bg-slate-50 ${errors.purchaseOrderId ? 'border-red-300' : 'border-slate-200'}`}
                >
                  <span className={selectedPo ? 'text-slate-800' : 'text-slate-400'}>
                    {selectedPo ? `${selectedPo.poNumber} — ${selectedPo.supplierName}` : 'Select approved PO…'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
                {poOpen && mode !== 'edit' ? (
                  <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={poSearch}
                          onChange={(e) => setPoSearch(e.target.value)}
                          placeholder="Search PO…"
                          className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm"
                        />
                      </div>
                    </div>
                    <ul className="max-h-48 overflow-y-auto">
                      {filteredPos.length === 0 ? (
                        <li className="px-3 py-3 text-sm text-slate-500">No approved PO found</li>
                      ) : (
                        filteredPos.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2.5 text-left text-sm hover:bg-violet-50"
                              onClick={() => handlePoSelect(p.id)}
                            >
                              <p className="font-semibold text-slate-800">{p.poNumber}</p>
                              <p className="text-xs text-slate-500">{p.supplierName}</p>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                ) : null}
              </div>
              {errors.purchaseOrderId ? (
                <span className="mt-1 block text-[11px] text-red-600">{errors.purchaseOrderId}</span>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Invoice No.</span>
              <input className={inputClass} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Invoice Date</span>
              <input type="date" className={inputClass} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Received Date <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                className={inputClass}
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
              {errors.receivedDate ? (
                <span className="mt-1 block text-[11px] text-red-600">{errors.receivedDate}</span>
              ) : null}
            </label>
          </div>

          {formError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {formError}
            </div>
          ) : null}
          {errors.items ? <p className="text-xs font-medium text-red-600">{errors.items}</p> : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="pharmacy-grn-modal-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Ordered</th>
                  <th>Received</th>
                  <th>Free</th>
                  <th>Batch</th>
                  <th>Expiry</th>
                  <th>Purchase</th>
                  <th>Selling</th>
                  <th>MRP</th>
                  <th>GST</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const { amount } = calcLine(line.receivedQty, line.purchasePrice, line.gstPercentage);
                  return (
                    <tr key={line.key}>
                      <td>
                        <p className="font-semibold text-slate-800">{line.medicineName || '—'}</p>
                        {line.medicineId ? (
                          <button
                            type="button"
                            onClick={() => addBatchRow(line)}
                            className="mt-0.5 text-[10px] font-semibold text-violet-600 hover:underline"
                          >
                            + Add batch
                          </button>
                        ) : null}
                      </td>
                      <td className="w-14">
                        <input className={inputClass} value={line.orderedQty} readOnly />
                      </td>
                      <td className="w-14">
                        <input
                          className={`${inputClass} ${errors[`${line.key}-qty`] ? 'border-red-400' : ''}`}
                          type="number"
                          min="0"
                          value={line.receivedQty}
                          onChange={(e) => setLine(line.key, { receivedQty: e.target.value })}
                        />
                        {errors[`${line.key}-qty`] ? (
                          <span className="text-[10px] text-red-600">{errors[`${line.key}-qty`]}</span>
                        ) : null}
                      </td>
                      <td className="w-14">
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          value={line.freeQty}
                          onChange={(e) => setLine(line.key, { freeQty: e.target.value })}
                        />
                      </td>
                      <td className="w-24">
                        <input
                          className={`${inputClass} ${errors[`${line.key}-batch`] ? 'border-red-400' : ''}`}
                          value={line.batchNumber}
                          onChange={(e) => setLine(line.key, { batchNumber: e.target.value })}
                          placeholder="Batch *"
                        />
                        {errors[`${line.key}-batch`] ? (
                          <span className="text-[10px] text-red-600">{errors[`${line.key}-batch`]}</span>
                        ) : null}
                      </td>
                      <td className="w-28">
                        <input
                          type="date"
                          className={`${inputClass} ${errors[`${line.key}-exp`] ? 'border-red-400' : ''}`}
                          value={line.expiryDate}
                          onChange={(e) => setLine(line.key, { expiryDate: e.target.value })}
                        />
                        {errors[`${line.key}-exp`] ? (
                          <span className="text-[10px] text-red-600">{errors[`${line.key}-exp`]}</span>
                        ) : null}
                      </td>
                      <td className="w-20">
                        <input
                          className={`${inputClass} ${errors[`${line.key}-pp`] ? 'border-red-400' : ''}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.purchasePrice}
                          onChange={(e) => setLine(line.key, { purchasePrice: e.target.value })}
                        />
                      </td>
                      <td className="w-20">
                        <input
                          className={`${inputClass} ${errors[`${line.key}-sp`] ? 'border-red-400' : ''}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.sellingPrice}
                          onChange={(e) => setLine(line.key, { sellingPrice: e.target.value })}
                        />
                      </td>
                      <td className="w-20">
                        <input
                          className={`${inputClass} ${errors[`${line.key}-mrp`] ? 'border-red-400' : ''}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.mrp}
                          onChange={(e) => setLine(line.key, { mrp: e.target.value })}
                        />
                      </td>
                      <td className="w-16">
                        <select
                          className={inputClass}
                          value={line.gstPercentage}
                          onChange={(e) => setLine(line.key, { gstPercentage: e.target.value })}
                        >
                          {[0, 5, 12, 18, 28].map((g) => (
                            <option key={g} value={g}>
                              {g}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap text-xs font-semibold">{money(amount)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="rounded border border-rose-100 p-1 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Subtotal</p>
              <p className="text-lg font-bold">{money(totals.subTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">GST</p>
              <p className="text-lg font-bold">{money(totals.gstAmount)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Grand Total</p>
              <p className="text-2xl font-black text-violet-600">{money(totals.grandTotal)}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className={`${inputClass} mt-1 resize-none`}
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit('draft')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit('complete')}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Processing…' : 'Complete GRN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
