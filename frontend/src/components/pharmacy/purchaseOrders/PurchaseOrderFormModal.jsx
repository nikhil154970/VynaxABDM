import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, Trash2, X } from 'lucide-react';
import { fetchMedicines } from '../../../services/pharmacy/medicineService';
import { fetchSuppliers } from '../../../services/pharmacy/supplierService';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

const selectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-blue-400';

function emptyLine() {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    medicineId: '',
    medicineName: '',
    quantity: '1',
    purchasePrice: '',
    gstPercentage: '12',
  };
}

function calcLine(quantity, purchasePrice, gstPercentage) {
  const qty = Math.max(0, Number(quantity) || 0);
  const price = Math.max(0, Number(purchasePrice) || 0);
  const gst = Math.max(0, Number(gstPercentage) || 0);
  const lineBase = qty * price;
  const lineGst = lineBase * (gst / 100);
  return {
    lineBase,
    lineGst,
    amount: lineBase + lineGst,
  };
}

function calcTotals(lines) {
  let subTotal = 0;
  let gstAmount = 0;
  lines.forEach((line) => {
    const { lineBase, lineGst } = calcLine(line.quantity, line.purchasePrice, line.gstPercentage);
    subTotal += lineBase;
    gstAmount += lineGst;
  });
  return {
    subTotal,
    gstAmount,
    grandTotal: subTotal + gstAmount,
  };
}

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SearchableSelect({
  label,
  required,
  placeholder,
  options,
  value,
  displayValue,
  onChange,
  error,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.sub || '').toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 ${error ? 'border-red-300' : ''}`}
        >
          <span className={displayValue ? 'text-slate-800' : 'text-slate-400'}>
            {displayValue || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
        {open ? (
          <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm outline-none focus:border-blue-400"
                  autoFocus
                />
              </div>
            </div>
            <ul className="pharmacy-po-search-dropdown">
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-sm text-slate-500">No matches</li>
              ) : (
                filtered.map((opt) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-blue-50"
                      onClick={() => {
                        onChange(opt.value, opt.raw);
                        setOpen(false);
                      }}
                    >
                      <p className="font-semibold text-slate-800">{opt.label}</p>
                      {opt.sub ? <p className="text-xs text-slate-500">{opt.sub}</p> : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
      {error ? <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function toFormState(order) {
  if (!order) {
    return {
      supplierId: '',
      supplierName: '',
      remarks: '',
      lines: [emptyLine()],
    };
  }
  return {
    supplierId: order.supplierId || '',
    supplierName: order.supplierName || '',
    remarks: order.remarks || '',
    lines: (order.items || []).map((item) => ({
      key: `line-${item.medicineId}-${Math.random().toString(36).slice(2, 5)}`,
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      quantity: String(item.quantity),
      purchasePrice: String(item.purchasePrice),
      gstPercentage: String(item.gstPercentage),
    })),
  };
}

export default function PurchaseOrderFormModal({
  open,
  mode,
  order,
  saving,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => toFormState(null));
  const [errors, setErrors] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [medicinePick, setMedicinePick] = useState('');

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [supData, medData] = await Promise.all([
        fetchSuppliers({ status: 'active' }),
        fetchMedicines({ status: 'active' }),
      ]);
      setSuppliers(supData.suppliers || []);
      setMedicines(medData.medicines || []);
    } catch {
      setSuppliers([]);
      setMedicines([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(toFormState(order));
    setErrors({});
    setMedicinePick('');
    loadCatalog();
  }, [open, order, loadCatalog]);

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: s.supplierName,
        sub: [s.companyName, s.phone, s.gstNumber].filter(Boolean).join(' · '),
        raw: s,
      })),
    [suppliers]
  );

  const medicineOptions = useMemo(
    () =>
      medicines.map((m) => ({
        value: m.id,
        label: m.medicineName,
        sub: [m.genericName, m.strength, m.category].filter(Boolean).join(' · '),
        raw: m,
      })),
    [medicines]
  );

  const totals = useMemo(() => calcTotals(form.lines), [form.lines]);

  const linesWithAmount = useMemo(
    () =>
      form.lines.map((line) => ({
        ...line,
        ...calcLine(line.quantity, line.purchasePrice, line.gstPercentage),
      })),
    [form.lines]
  );

  if (!open) return null;

  const setLine = (key, patch) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  };

  const addMedicineFromPicker = () => {
    if (!medicinePick) return;
    const med = medicines.find((m) => m.id === medicinePick);
    if (!med) return;
    const exists = form.lines.some((l) => l.medicineId === med.id);
    if (exists) {
      setErrors((e) => ({ ...e, medicinePick: 'Medicine already added' }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          key: `line-${Date.now()}`,
          medicineId: med.id,
          medicineName: med.medicineName,
          quantity: '1',
          purchasePrice: String(med.defaultPurchasePrice ?? 0),
          gstPercentage: String(med.gstPercentage ?? 12),
        },
      ],
    }));
    setMedicinePick('');
    setErrors((e) => ({ ...e, medicinePick: undefined, items: undefined }));
  };

  const removeLine = (key) => {
    setForm((prev) => {
      const next = prev.lines.filter((l) => l.key !== key);
      return { ...prev, lines: next.length ? next : [emptyLine()] };
    });
  };

  const validate = () => {
    const next = {};
    if (!form.supplierId) next.supplierId = 'Select a supplier';
    const validLines = form.lines.filter((l) => l.medicineId);
    if (!validLines.length) next.items = 'Add at least one medicine';
    validLines.forEach((line, i) => {
      if (!Number(line.quantity) || Number(line.quantity) < 1) {
        next[`line-${line.key}-qty`] = 'Min 1';
      }
      if (line.purchasePrice === '' || Number(line.purchasePrice) < 0) {
        next[`line-${line.key}-price`] = 'Required';
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (submitAs) => {
    const items = form.lines
      .filter((l) => l.medicineId)
      .map((l) => ({
        medicineId: l.medicineId,
        medicineName: l.medicineName,
        quantity: Number(l.quantity),
        purchasePrice: Number(l.purchasePrice),
        gstPercentage: Number(l.gstPercentage),
      }));
    return {
      supplierId: form.supplierId,
      items,
      remarks: form.remarks,
      submitAs,
    };
  };

  const handleSubmit = (submitAs) => {
    if (!validate()) return;
    onSubmit(buildPayload(submitAs), setErrors);
  };

  const selectedSupplierLabel = form.supplierName || suppliers.find((s) => s.id === form.supplierId)?.supplierName;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              {mode === 'edit' ? 'Edit Purchase Order' : 'Create Purchase Order'}
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'edit' ? order?.poNumber || 'Update PO' : 'New procurement request'}
            </h2>
            <p className="text-xs text-slate-500">PO does not update inventory — stock is updated via GRN only.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Step 1 — Supplier</p>
            {catalogLoading ? (
              <div className="pharmacy-purchase-skeleton h-11 w-full" />
            ) : (
              <SearchableSelect
                label="Supplier"
                required
                placeholder="Search and select supplier…"
                options={supplierOptions}
                value={form.supplierId}
                displayValue={selectedSupplierLabel}
                onChange={(id, raw) => {
                  setForm((prev) => ({
                    ...prev,
                    supplierId: id,
                    supplierName: raw?.supplierName || '',
                  }));
                  setErrors((e) => ({ ...e, supplierId: undefined }));
                }}
                error={errors.supplierId}
              />
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Step 2 — Medicines</p>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <SearchableSelect
                  label="Add medicine"
                  placeholder="Search medicine…"
                  options={medicineOptions}
                  value={medicinePick}
                  displayValue={
                    medicinePick
                      ? medicines.find((m) => m.id === medicinePick)?.medicineName
                      : ''
                  }
                  onChange={(id) => {
                    setMedicinePick(id);
                    setErrors((e) => ({ ...e, medicinePick: undefined }));
                  }}
                  error={errors.medicinePick}
                  disabled={catalogLoading}
                />
              </div>
              <button
                type="button"
                onClick={addMedicineFromPicker}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
              >
                <Plus className="h-4 w-4" />
                Add to list
              </button>
            </div>
            {errors.items ? (
              <p className="mb-2 text-xs font-medium text-red-600">{errors.items}</p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="pharmacy-po-modal-items-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Qty</th>
                    <th>Purchase Price</th>
                    <th>GST %</th>
                    <th>Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {linesWithAmount.map((line) => (
                    <tr key={line.key}>
                      <td>
                        <p className="font-semibold text-slate-800">{line.medicineName || '—'}</p>
                        {!line.medicineId ? (
                          <p className="text-[11px] text-amber-600">Select via Add medicine</p>
                        ) : null}
                      </td>
                      <td className="w-20">
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                          className={selectClass}
                          disabled={!line.medicineId}
                        />
                        {errors[`line-${line.key}-qty`] ? (
                          <span className="text-[10px] text-red-600">{errors[`line-${line.key}-qty`]}</span>
                        ) : null}
                      </td>
                      <td className="w-28">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.purchasePrice}
                          onChange={(e) => setLine(line.key, { purchasePrice: e.target.value })}
                          className={selectClass}
                          disabled={!line.medicineId}
                        />
                        {errors[`line-${line.key}-price`] ? (
                          <span className="text-[10px] text-red-600">{errors[`line-${line.key}-price`]}</span>
                        ) : null}
                      </td>
                      <td className="w-24">
                        <select
                          value={line.gstPercentage}
                          onChange={(e) => setLine(line.key, { gstPercentage: e.target.value })}
                          className={selectClass}
                          disabled={!line.medicineId}
                        >
                          {[0, 5, 12, 18, 28].map((g) => (
                            <option key={g} value={g}>
                              {g}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap font-semibold text-slate-800">
                        {line.medicineId ? money(line.amount) : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          title="Remove"
                          onClick={() => removeLine(line.key)}
                          className="rounded-lg border border-rose-100 p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Subtotal</p>
              <p className="text-lg font-bold text-slate-900">{money(totals.subTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">GST</p>
              <p className="text-lg font-bold text-slate-900">{money(totals.gstAmount)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Grand Total</p>
              <p className="text-2xl font-black text-blue-600">{money(totals.grandTotal)}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600">Remarks</label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                rows={2}
                className={`${inputClass} mt-1 resize-none`}
                placeholder="Delivery instructions, payment notes…"
              />
            </div>
          </section>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            Cancel
          </button>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit('draft')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit('submit')}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Submit Purchase Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
