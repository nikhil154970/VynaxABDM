import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const EMPTY = {
  supplierName: '',
  companyName: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstNumber: '',
  drugLicenseNumber: '',
  panNumber: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  creditLimit: '',
  paymentTerms: '',
  notes: '',
};

function toFormValues(supplier) {
  if (!supplier) return { ...EMPTY };
  return {
    supplierName: supplier.supplierName || '',
    companyName: supplier.companyName || '',
    contactPerson: supplier.contactPerson || '',
    phone: supplier.phone || '',
    email: supplier.email || '',
    address: supplier.address || '',
    city: supplier.city || '',
    state: supplier.state || '',
    pincode: supplier.pincode || '',
    gstNumber: supplier.gstNumber || '',
    drugLicenseNumber: supplier.drugLicenseNumber || '',
    panNumber: supplier.panNumber || '',
    bankName: supplier.bankName || '',
    accountNumber: supplier.accountNumber || '',
    ifscCode: supplier.ifscCode || '',
    creditLimit: supplier.creditLimit != null ? String(supplier.creditLimit) : '',
    paymentTerms: supplier.paymentTerms || '',
    notes: supplier.notes || '',
  };
}

function Field({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

export default function SupplierFormModal({ open, mode, supplier, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(toFormValues(supplier));
    setErrors({});
  }, [open, supplier]);

  if (!open) return null;

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form, setErrors);
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
                {mode === 'edit' ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
              <p className="text-xs text-slate-500">Purchase workflow — supplier master data</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Supplier Name" required error={errors.supplierName}>
                <input className={inputClass} value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} />
              </Field>
              <Field label="Company Name" error={errors.companyName}>
                <input className={inputClass} value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
              </Field>
              <Field label="Contact Person" error={errors.contactPerson}>
                <input className={inputClass} value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
              </Field>
              <Field label="Phone Number" required error={errors.phone}>
                <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" maxLength={14} />
              </Field>
              <Field label="Email" error={errors.email}>
                <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="GST Number" required error={errors.gstNumber}>
                <input className={inputClass} value={form.gstNumber} onChange={(e) => set('gstNumber', e.target.value.toUpperCase())} maxLength={15} />
              </Field>
              <Field label="Drug License Number" error={errors.drugLicenseNumber}>
                <input className={inputClass} value={form.drugLicenseNumber} onChange={(e) => set('drugLicenseNumber', e.target.value)} />
              </Field>
              <Field label="PAN Number" error={errors.panNumber}>
                <input className={inputClass} value={form.panNumber} onChange={(e) => set('panNumber', e.target.value.toUpperCase())} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address" error={errors.address}>
                  <textarea className={`${inputClass} min-h-[72px] resize-y`} value={form.address} onChange={(e) => set('address', e.target.value)} />
                </Field>
              </div>
              <Field label="City" error={errors.city}>
                <input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
              <Field label="State" error={errors.state}>
                <input className={inputClass} value={form.state} onChange={(e) => set('state', e.target.value)} />
              </Field>
              <Field label="Pincode" error={errors.pincode}>
                <input className={inputClass} value={form.pincode} onChange={(e) => set('pincode', e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Credit Limit (₹)" error={errors.creditLimit}>
                <input className={inputClass} value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Bank Name" error={errors.bankName}>
                <input className={inputClass} value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
              </Field>
              <Field label="Account Number" error={errors.accountNumber}>
                <input className={inputClass} value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} />
              </Field>
              <Field label="IFSC Code" error={errors.ifscCode}>
                <input className={inputClass} value={form.ifscCode} onChange={(e) => set('ifscCode', e.target.value.toUpperCase())} />
              </Field>
              <Field label="Payment Terms" error={errors.paymentTerms}>
                <input className={inputClass} value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} placeholder="e.g. Net 30 days" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes" error={errors.notes}>
                  <textarea className={`${inputClass} min-h-[72px] resize-y`} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                </Field>
              </div>
            </div>
          </form>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Supplier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
