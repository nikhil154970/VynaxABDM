import { useState } from 'react';
import { FileText, IndianRupee, Package, Receipt, X } from 'lucide-react';

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN')}`;
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{value ?? '—'}</p>
    </div>
  );
}

function DummyList({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">{item.label}</p>
            <p className="text-xs text-slate-500">{item.meta}</p>
          </div>
          <span className="shrink-0 font-semibold text-slate-700">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

const TABS = [
  { id: 'basic', label: 'Basic Info', icon: Package },
  { id: 'pricing', label: 'Pricing', icon: IndianRupee },
  { id: 'purchase', label: 'Purchase Usage', icon: FileText },
  { id: 'billing', label: 'Billing Usage', icon: Receipt },
];

export default function MedicineDetailsDrawer({ open, medicine, onClose }) {
  const [tab, setTab] = useState('basic');

  if (!open || !medicine) return null;

  const purchaseUsage = [
    { id: 1, label: 'PO-2026-0188', meta: 'MediCare Distributors · 12 May 2026', value: '120 units' },
    { id: 2, label: 'PO-2026-0162', meta: 'HealthPlus Pharma · 28 Apr 2026', value: '80 units' },
  ];

  const billingUsage = [
    { id: 1, label: 'PH-BILL-1042', meta: 'Ravi Kumar · Hospital', value: money(850) },
    { id: 2, label: 'PH-BILL-1038', meta: 'Walk-in', value: money(320) },
    { id: 3, label: 'PH-BILL-1031', meta: 'Sita Devi · Hospital', value: money(1250) },
  ];

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-[#fbfdff] shadow-2xl">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Medicine Details</p>
              <h2 className="truncate text-xl font-bold text-slate-900">{medicine.medicineName}</h2>
              <p className="truncate text-sm text-slate-500">{medicine.genericName || medicine.brandName || '—'}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  tab === id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'basic' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Basic Information</h3>
                <span
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    medicine.status === 'active'
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}
                >
                  {medicine.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <InfoRow label="Generic Name" value={medicine.genericName} />
                <InfoRow label="Brand" value={medicine.brandName} />
                <InfoRow label="Category" value={medicine.category} />
                <InfoRow label="Dosage Form" value={medicine.dosageForm} />
                <InfoRow label="Strength" value={medicine.strength} />
                <InfoRow label="Manufacturer" value={medicine.manufacturer} />
                <InfoRow label="HSN" value={medicine.hsnCode} />
                <InfoRow label="GST" value={`${medicine.gstPercentage}%`} />
                <InfoRow label="Barcode" value={medicine.barcode} />
                <InfoRow label="Prescription" value={medicine.prescriptionRequired ? 'Required' : 'Not required'} />
                <InfoRow label="Expiry tracking" value={medicine.expiryApplicable ? 'Yes' : 'No'} />
              </div>
              {medicine.description ? (
                <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">{medicine.description}</p>
              ) : null}
            </section>
          )}

          {tab === 'pricing' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Default Pricing</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-center">
                  <p className="text-[11px] font-medium text-slate-500">MRP</p>
                  <p className="mt-1 text-lg font-bold text-blue-700">{money(medicine.defaultMRP)}</p>
                </div>
                <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-center">
                  <p className="text-[11px] font-medium text-slate-500">Purchase</p>
                  <p className="mt-1 text-lg font-bold text-violet-700">{money(medicine.defaultPurchasePrice)}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
                  <p className="text-[11px] font-medium text-slate-500">Selling</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">{money(medicine.defaultSellingPrice)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Stock batches and expiry-based pricing will be managed in GRN and Inventory modules.
              </p>
            </section>
          )}

          {tab === 'purchase' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Purchase Usage</h3>
                <span className="ml-auto rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Preview</span>
              </div>
              <DummyList items={purchaseUsage} />
            </section>
          )}

          {tab === 'billing' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Billing Usage</h3>
                <span className="ml-auto rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Preview</span>
              </div>
              <DummyList items={billingUsage} />
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
