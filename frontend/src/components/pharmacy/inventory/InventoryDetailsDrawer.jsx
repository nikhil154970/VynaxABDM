import { useState } from 'react';
import { Package, X } from 'lucide-react';
import BatchDetailsTable from './BatchDetailsTable';
import StockLedgerTable from './StockLedgerTable';

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
    'In Stock': 'border-emerald-100 bg-emerald-50 text-emerald-700',
    'Low Stock': 'border-orange-100 bg-orange-50 text-orange-700',
    'Out of Stock': 'border-rose-100 bg-rose-50 text-rose-700',
  };
  return (
    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${map[status] || map['In Stock']}`}>
      {status}
    </span>
  );
}

function ExpiryBadge({ tone, days }) {
  const map = {
    critical: 'bg-rose-100 text-rose-800 border-rose-200',
    warning: 'bg-orange-100 text-orange-800 border-orange-200',
    caution: 'bg-amber-100 text-amber-800 border-amber-200',
    normal: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${map[tone] || map.normal}`}>
      {days != null ? `${days} days` : '—'}
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

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'batches', label: 'Batches' },
  { id: 'ledger', label: 'Stock Ledger' },
  { id: 'expiry', label: 'Expiry Details' },
];

export default function InventoryDetailsDrawer({ open, data, loading, onClose }) {
  const [tab, setTab] = useState('overview');

  if (!open) return null;

  const overview = data?.overview;
  const batches = data?.batches || [];
  const ledger = data?.ledger || [];
  const expiryDetails = data?.expiryDetails || [];

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-[#fbfdff] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Inventory</p>
            <h2 className="truncate text-xl font-bold text-slate-900">
              {loading ? 'Loading…' : overview?.medicineName || 'Medicine'}
            </h2>
            {overview ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={overview.status} />
                <span className="text-xs text-slate-500">{overview.genericName || '—'}</span>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  tab === t.id ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="pharmacy-inventory-skeleton h-12 w-full" />
              ))}
            </div>
          ) : !overview ? (
            <p className="text-sm text-slate-500">No inventory data.</p>
          ) : tab === 'overview' ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-violet-600" />
                  <h3 className="text-sm font-bold text-slate-900">Overview</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <InfoRow label="Medicine" value={overview.medicineName} />
                  <InfoRow label="Generic" value={overview.genericName} />
                  <InfoRow label="Category" value={overview.category} />
                  <InfoRow label="Total Stock" value={String(overview.totalStock)} />
                  <InfoRow label="Available Stock" value={String(overview.availableStock)} />
                  <InfoRow label="Inventory Value" value={money(overview.inventoryValue)} />
                  <InfoRow label="Last GRN" value={formatDate(overview.lastGrnAt)} />
                  <InfoRow label="Last Updated" value={formatDate(overview.lastUpdated)} />
                </div>
              </section>
              <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Stock is managed via GRN only. Batches are issued FEFO (nearest expiry first) for future billing.
              </p>
            </div>
          ) : tab === 'batches' ? (
            <BatchDetailsTable batches={batches} />
          ) : tab === 'ledger' ? (
            <StockLedgerTable ledger={ledger} />
          ) : (
            <div className="space-y-2">
              {expiryDetails.length === 0 ? (
                <p className="text-sm text-slate-500">No active stock with expiry.</p>
              ) : (
                expiryDetails.map((row) => (
                  <div
                    key={row.batchNumber}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{row.batchNumber}</p>
                      <p className="text-xs text-slate-500">Expires {formatDate(row.expiryDate)}</p>
                    </div>
                    <div className="text-right">
                      <ExpiryBadge tone={row.tone} days={row.daysRemaining} />
                      <p className="mt-1 text-sm font-bold">{row.stock} units</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
