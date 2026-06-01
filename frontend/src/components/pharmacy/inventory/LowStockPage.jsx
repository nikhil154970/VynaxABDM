import { StatusBadge } from './InventoryTable';

export default function LowStockPage({ rows, loading }) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="pharmacy-inventory-skeleton h-11 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="px-6 py-12 text-center text-sm text-slate-500">
        All medicines are above minimum stock level.
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="pharmacy-inventory-table w-full min-w-[640px]">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Current Qty</th>
              <th>Minimum Level</th>
              <th>Required Qty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.medicineId}>
                <td>
                  <div className="font-semibold text-blue-600">{row.medicineName}</div>
                  <div className="text-[11px] text-slate-500">{row.genericName}</div>
                </td>
                <td className="font-bold">{row.availableStock}</td>
                <td>{row.minimumLevel}</td>
                <td className="font-semibold text-orange-600">{row.requiredQty}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 md:hidden">
        {rows.map((row) => (
          <div key={row.medicineId} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4">
            <p className="font-bold text-slate-900">{row.medicineName}</p>
            <p className="text-xs text-slate-500">Min: {row.minimumLevel} · Need: {row.requiredQty}</p>
            <p className="mt-2 text-lg font-bold text-orange-700">{row.availableStock} units</p>
            <StatusBadge status={row.status} />
          </div>
        ))}
      </div>
    </>
  );
}
