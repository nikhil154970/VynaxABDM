import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const CATEGORIES = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Cream / Ointment',
  'Drops',
  'Inhaler',
  'Surgical',
  'Consumable',
  'Other',
];

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Powder', 'Other'];

const GST_OPTIONS = [0, 5, 12, 18, 28];

const EMPTY = {
  medicineName: '',
  genericName: '',
  brandName: '',
  category: '',
  dosageForm: '',
  strength: '',
  manufacturer: '',
  hsnCode: '',
  gstPercentage: '12',
  barcode: '',
  defaultMRP: '',
  defaultPurchasePrice: '',
  defaultSellingPrice: '',
  prescriptionRequired: false,
  expiryApplicable: true,
  description: '',
  status: 'active',
};

function toFormValues(medicine) {
  if (!medicine) return { ...EMPTY };
  return {
    medicineName: medicine.medicineName || '',
    genericName: medicine.genericName || '',
    brandName: medicine.brandName || '',
    category: medicine.category || '',
    dosageForm: medicine.dosageForm || '',
    strength: medicine.strength || '',
    manufacturer: medicine.manufacturer || '',
    hsnCode: medicine.hsnCode || '',
    gstPercentage: medicine.gstPercentage != null ? String(medicine.gstPercentage) : '12',
    barcode: medicine.barcode || '',
    defaultMRP: medicine.defaultMRP != null ? String(medicine.defaultMRP) : '',
    defaultPurchasePrice: medicine.defaultPurchasePrice != null ? String(medicine.defaultPurchasePrice) : '',
    defaultSellingPrice: medicine.defaultSellingPrice != null ? String(medicine.defaultSellingPrice) : '',
    prescriptionRequired: Boolean(medicine.prescriptionRequired),
    expiryApplicable: medicine.expiryApplicable !== false,
    description: medicine.description || '',
    status: medicine.status || 'active',
  };
}

function Field({ label, required, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="col-span-full mb-1 mt-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-violet-600">
      {children}
    </h3>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

export default function MedicineFormModal({ open, mode, medicine, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(toFormValues(medicine));
    setErrors({});
  }, [open, medicine]);

  if (!open) return null;

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(
      {
        ...form,
        gstPercentage: Number(form.gstPercentage),
        defaultMRP: form.defaultMRP === '' ? 0 : Number(form.defaultMRP),
        defaultPurchasePrice: form.defaultPurchasePrice === '' ? 0 : Number(form.defaultPurchasePrice),
        defaultSellingPrice: form.defaultSellingPrice === '' ? 0 : Number(form.defaultSellingPrice),
      },
      setErrors
    );
  };

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div className="absolute inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === 'edit' ? 'Edit Medicine' : 'Add Medicine'}
              </h2>
              <p className="text-xs text-slate-500">Medicine master only — no stock or batches</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SectionTitle>Basic Information</SectionTitle>
              <Field label="Medicine Name" required error={errors.medicineName}>
                <input className={inputClass} value={form.medicineName} onChange={(e) => set('medicineName', e.target.value)} />
              </Field>
              <Field label="Generic Name" error={errors.genericName}>
                <input className={inputClass} value={form.genericName} onChange={(e) => set('genericName', e.target.value)} />
              </Field>
              <Field label="Brand Name" error={errors.brandName}>
                <input className={inputClass} value={form.brandName} onChange={(e) => set('brandName', e.target.value)} />
              </Field>
              <Field label="Category" required error={errors.category}>
                <select className={inputClass} value={form.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Dosage Form" error={errors.dosageForm}>
                <select className={inputClass} value={form.dosageForm} onChange={(e) => set('dosageForm', e.target.value)}>
                  <option value="">Select form</option>
                  {DOSAGE_FORMS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="Strength" error={errors.strength}>
                <input className={inputClass} value={form.strength} onChange={(e) => set('strength', e.target.value)} placeholder="e.g. 500mg" />
              </Field>

              <SectionTitle>Company Details</SectionTitle>
              <Field label="Manufacturer" error={errors.manufacturer}>
                <input className={inputClass} value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} />
              </Field>
              <Field label="HSN Code" error={errors.hsnCode}>
                <input className={inputClass} value={form.hsnCode} onChange={(e) => set('hsnCode', e.target.value)} />
              </Field>
              <Field label="GST Percentage" required error={errors.gstPercentage}>
                <select className={inputClass} value={form.gstPercentage} onChange={(e) => set('gstPercentage', e.target.value)}>
                  {GST_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}%</option>
                  ))}
                </select>
              </Field>
              <Field label="Barcode" error={errors.barcode}>
                <input className={inputClass} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
              </Field>

              <SectionTitle>Pricing</SectionTitle>
              <Field label="Default MRP (₹)" error={errors.defaultMRP}>
                <input className={inputClass} value={form.defaultMRP} onChange={(e) => set('defaultMRP', e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Default Purchase Price (₹)" error={errors.defaultPurchasePrice}>
                <input className={inputClass} value={form.defaultPurchasePrice} onChange={(e) => set('defaultPurchasePrice', e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Default Selling Price (₹)" error={errors.defaultSellingPrice}>
                <input className={inputClass} value={form.defaultSellingPrice} onChange={(e) => set('defaultSellingPrice', e.target.value)} inputMode="decimal" />
              </Field>

              <SectionTitle>Extra Settings</SectionTitle>
              <div className="col-span-full flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.prescriptionRequired}
                    onChange={(e) => set('prescriptionRequired', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  Prescription Required
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.expiryApplicable}
                    onChange={(e) => set('expiryApplicable', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  Expiry Applicable
                </label>
              </div>
              {mode === 'edit' ? (
                <Field label="Status" error={errors.status}>
                  <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              ) : null}
              <div className="col-span-full">
                <Field label="Description" error={errors.description}>
                  <textarea className={`${inputClass} min-h-[72px] resize-y`} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </Field>
              </div>
            </div>
          </form>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Medicine'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
