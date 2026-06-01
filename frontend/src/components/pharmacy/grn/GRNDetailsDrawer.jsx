import { Building2, ClipboardCheck, Package, X } from 'lucide-react';

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }) {
  const map = {
    Draft: 'border-slate-200 bg-slate-100 text-slate-600',
    Completed: 'border-emerald-100 bg-emerald-50 text-emerald-700',
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
      <p className="mt-0.5 text-sm font-semibold text-slate-800 break-words">{value ?? '—'}</p>
    </div>
  );
}

export default function GRNDetailsDrawer({ open, grn, onClose, onPrint, printLoading }) {
  if (!open || !grn) return null;

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-[#fbfdff] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">GRN Details</p>
            <h2 className="truncate text-xl font-bold text-slate-900">{grn.grnNumber}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={grn.status} />
              {grn.receiptStatus ? (
                <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  {grn.receiptStatus} Receipt
                </span>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">GRN Info</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <InfoRow label="PO Number" value={grn.poNumber} />
              <InfoRow label="Received Date" value={formatDate(grn.receivedDate)} />
              <InfoRow label="Invoice No." value={grn.invoiceNumber} />
              <InfoRow label="Invoice Date" value={formatDate(grn.invoiceDate)} />
              <InfoRow label="Created By" value={grn.createdBy || 'Pharmacist'} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Supplier</h3>
            </div>
            <p className="font-bold text-blue-600">{grn.supplierName}</p>
            {grn.supplier ? (
              <div className="mt-2 grid grid-cols-1 gap-2">
                <InfoRow label="Phone" value={grn.supplier.phone} />
                <InfoRow label="GST" value={grn.supplier.gstNumber} />
                <InfoRow label="Address" value={grn.supplier.address} />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Medicines & Batches</h3>
            </div>
            <div className="space-y-2">
              {(grn.items || []).map((item) => (
                <div key={`${item.medicineId}-${item.batchNumber}`} className="rounded-xl border border-slate-100 p-3 text-xs">
                  <p className="font-bold text-slate-800">{item.medicineName}</p>
                  <p className="mt-1 text-slate-600">
                    Batch: <span className="font-semibold">{item.batchNumber}</span> · Exp:{' '}
                    {formatDate(item.expiryDate)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <span>Ordered: {item.orderedQty}</span>
                    <span>Received: {item.receivedQty}</span>
                    <span>Free: {item.freeQty || 0}</span>
                    <span>Stock: {item.stockQty ?? (item.receivedQty || 0) + (item.freeQty || 0)}</span>
                    <span>Purchase: {money(item.purchasePrice)}</span>
                    <span>Selling: {money(item.sellingPrice)}</span>
                    <span>MRP: {money(item.mrp)}</span>
                    <span className="font-semibold">Amount: {money(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">{money(grn.subTotal)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span>GST</span>
              <span className="font-semibold">{money(grn.gstAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-violet-100 pt-2">
              <span className="font-bold">Grand Total</span>
              <span className="text-lg font-black text-violet-700">{money(grn.grandTotal)}</span>
            </div>
          </section>

          {grn.remarks ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {grn.remarks}
            </p>
          ) : null}
        </div>

        {onPrint && grn.status !== 'Cancelled' ? (
          <div className="border-t border-slate-200 bg-white p-4">
            <button
              type="button"
              disabled={printLoading}
              onClick={onPrint}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {printLoading ? 'Loading…' : 'Print GRN'}
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
