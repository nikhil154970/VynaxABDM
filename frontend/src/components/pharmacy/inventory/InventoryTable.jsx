import { Eye } from 'lucide-react';

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

export function StatusBadge({ status }) {
  const map = {
    'In Stock': 'border-emerald-100 bg-emerald-50 text-emerald-700',
    'Low Stock': 'border-orange-100 bg-orange-50 text-orange-700',
    'Out of Stock': 'border-rose-100 bg-rose-50 text-rose-700',
  };
  return (
    <span className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${map[status] || map['In Stock']}`}>
      {status}
    </span>
  );
}

export default function InventoryTable({ rows, onView }) {
  if (!rows.length) return null;

  return (
    <>
      <div className="pharmacy-inventory-desktop-table pharmacy-inventory-table-wrap">
        <table className="pharmacy-inventory-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Generic</th>
              <th>Category</th>
              <th>Total Stock</th>
              <th>Available</th>
              <th>Batches</th>
              <th>Nearest Expiry</th>
              <th>Value</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.medicineId} className="hover:bg-slate-50/80 transition">
                <td>{row.medicineName}</td>
                <td>{row.genericName || '—'}</td>
                <td>{row.category || '—'}</td>
                <td>{row.totalStock}</td>
                <td className="font-semibold">{row.availableStock}</td>
                <td>{row.batchCount}</td>
                <td>
                  {formatDate(row.nearestExpiry)}
                  {row.daysToExpiry != null && row.availableStock > 0 ? (
                    <span className="ml-1 text-[10px] text-slate-400">({row.daysToExpiry}d)</span>
                  ) : null}
                </td>
                <td>{money(row.inventoryValue)}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => onView(row)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pharmacy-inventory-mobile-list">
        {rows.map((row) => (
          <article
            key={row.medicineId}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-blue-600">{row.medicineName}</p>
                <p className="text-xs text-slate-500">{row.genericName || '—'}</p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">Available</dt>
                <dd className="font-bold">{row.availableStock}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Value</dt>
                <dd className="font-bold">{money(row.inventoryValue)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Batches</dt>
                <dd>{row.batchCount}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Expiry</dt>
                <dd>{formatDate(row.nearestExpiry)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => onView(row)}
              className="mt-3 w-full rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white"
            >
              View details
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
