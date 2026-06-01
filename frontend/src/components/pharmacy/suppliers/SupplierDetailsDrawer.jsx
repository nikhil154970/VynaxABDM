import { Building2, CreditCard, FileText, History, X } from 'lucide-react';

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN')}`;
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800 break-words">{value || '—'}</p>
    </div>
  );
}

function DummyHistory({ title, icon: Icon, items }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className="ml-auto rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Preview</span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate">{item.label}</p>
              <p className="text-xs text-slate-500">{item.date}</p>
            </div>
            <span className="shrink-0 font-semibold text-slate-700">{item.amount}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SupplierDetailsDrawer({ open, supplier, onClose }) {
  if (!open || !supplier) return null;

  const purchaseHistory = [
    { id: 1, label: 'PO-2026-0142 — Antibiotics batch', date: '18 May 2026', amount: money(45200) },
    { id: 2, label: 'PO-2026-0138 — General stock', date: '10 May 2026', amount: money(28350) },
    { id: 3, label: 'PO-2026-0121 — Surgical supplies', date: '28 Apr 2026', amount: money(12600) },
  ];

  const paymentHistory = [
    { id: 1, label: 'NEFT — Invoice INV-8821', date: '16 May 2026', amount: money(30000) },
    { id: 2, label: 'Cheque — Invoice INV-8790', date: '02 May 2026', amount: money(18500) },
  ];

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-[#fbfdff] shadow-2xl animate-in slide-in-from-right">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Supplier Details</p>
            <h2 className="truncate text-xl font-bold text-slate-900">{supplier.supplierName}</h2>
            <p className="truncate text-sm text-slate-500">{supplier.companyName || 'No company name'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close drawer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Building2 className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Basic Info</h3>
              <span
                className={`ml-auto rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  supplier.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {supplier.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoRow label="Contact Person" value={supplier.contactPerson} />
              <InfoRow label="Phone" value={supplier.phone} />
              <InfoRow label="Email" value={supplier.email} />
              <InfoRow label="GST" value={supplier.gstNumber} />
              <InfoRow label="Drug License" value={supplier.drugLicenseNumber} />
              <InfoRow label="PAN" value={supplier.panNumber} />
              <InfoRow label="Address" value={[supplier.address, supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(', ')} />
              <InfoRow label="Payment Terms" value={supplier.paymentTerms} />
              <InfoRow label="Credit Limit" value={money(supplier.creditLimit)} />
              <InfoRow label="Bank" value={`${supplier.bankName || '—'} · ${supplier.ifscCode || '—'}`} />
            </div>
            {supplier.notes ? (
              <p className="mt-3 rounded-xl bg-amber-50/80 px-3 py-2 text-xs text-amber-900 border border-amber-100">{supplier.notes}</p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900">Outstanding Dues</h3>
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-700">{money(supplier.outstandingAmount)}</p>
            <p className="text-xs text-slate-600">Total purchases: {money(supplier.totalPurchases)}</p>
          </section>

          <DummyHistory title="Purchase History" icon={History} items={purchaseHistory} />
          <DummyHistory title="Payment History" icon={FileText} items={paymentHistory} />
        </div>
      </aside>
    </div>
  );
}
