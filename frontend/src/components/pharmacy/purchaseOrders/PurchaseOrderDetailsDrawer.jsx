import { Building2, ClipboardList, Package, Printer, X } from 'lucide-react';

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  const map = {
    Draft: 'border-slate-200 bg-slate-100 text-slate-600',
    Pending: 'border-orange-100 bg-orange-50 text-orange-700',
    Approved: 'border-blue-100 bg-blue-50 text-blue-700',
    Delivered: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    Cancelled: 'border-rose-100 bg-rose-50 text-rose-700',
  };
  return (
    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${map[status] || map.Draft}`}>
      {status}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800 break-words">{value || '—'}</p>
    </div>
  );
}

export default function PurchaseOrderDetailsDrawer({ open, order, onClose, onPrint, printLoading }) {
  if (!open || !order) return null;

  const supplier = order.supplier || {};

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-[#fbfdff] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Purchase Order</p>
            <h2 className="truncate text-xl font-bold text-slate-900">{order.poNumber}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} />
              <span className="text-xs text-slate-500">{formatDate(order.createdAt)}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Building2 className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Supplier</h3>
            </div>
            <p className="text-base font-bold text-blue-600">{order.supplierName}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoRow label="Company" value={supplier.companyName} />
              <InfoRow label="Contact" value={supplier.contactPerson} />
              <InfoRow label="Phone" value={supplier.phone} />
              <InfoRow label="GST" value={supplier.gstNumber} />
              <InfoRow label="Email" value={supplier.email} />
              <InfoRow
                label="Address"
                value={[supplier.address, supplier.city, supplier.state].filter(Boolean).join(', ')}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <ClipboardList className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Order Info</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <InfoRow label="Created By" value={order.createdBy || 'Pharmacist'} />
              <InfoRow label="Items" value={String(order.items?.length || 0)} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Package className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Medicines</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="pb-2 pr-2 font-semibold">Medicine</th>
                    <th className="pb-2 pr-2 font-semibold">Qty</th>
                    <th className="pb-2 pr-2 font-semibold">Rate</th>
                    <th className="pb-2 pr-2 font-semibold">GST</th>
                    <th className="pb-2 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item) => (
                    <tr key={`${item.medicineId}-${item.medicineName}`} className="border-b border-slate-50">
                      <td className="py-2 pr-2 font-semibold text-slate-800">{item.medicineName}</td>
                      <td className="py-2 pr-2">{item.quantity}</td>
                      <td className="py-2 pr-2">{money(item.purchasePrice)}</td>
                      <td className="py-2 pr-2">{item.gstPercentage}%</td>
                      <td className="py-2 font-semibold">{money(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold">{money(order.subTotal)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-600">GST</span>
              <span className="font-semibold">{money(order.gstAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-blue-100 pt-2">
              <span className="font-bold text-slate-800">Grand Total</span>
              <span className="text-xl font-black text-blue-700">{money(order.grandTotal)}</span>
            </div>
          </section>

          {order.remarks ? (
            <section className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
              <p className="text-xs font-semibold text-amber-800">Remarks</p>
              <p className="mt-1 text-sm text-amber-900">{order.remarks}</p>
            </section>
          ) : null}

          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            This PO is a procurement request only. Inventory and batches are updated when goods are received through GRN.
          </p>
        </div>

        {onPrint && order?.status !== 'Cancelled' ? (
          <div className="border-t border-slate-200 bg-white p-4">
            <button
              type="button"
              disabled={printLoading}
              onClick={onPrint}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {printLoading ? 'Loading…' : 'Print Purchase Order'}
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
