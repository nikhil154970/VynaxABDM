import { Minus, Plus, Trash2 } from 'lucide-react';
import { calcLineAmount, fmtDate, money } from '../../../lib/pharmacy/billingCalc';

export default function BillItemsTable({ items, onUpdateItem, onRemoveItem, onChangeBatch }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-slate-500">
        Search inventory and add medicines. Only in-stock batches from GRN are shown.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs">
        <thead>
          <tr className="text-left text-xs font-semibold text-slate-500">
            {['Medicine', 'Batch', 'Available', 'Qty', 'MRP', 'Discount %', 'GST', 'Amount', ''].map((h) => (
              <th key={h || 'x'} className="border-b border-slate-100 bg-slate-50 px-2.5 py-2.5 first:rounded-l-xl last:rounded-r-xl">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const amount = calcLineAmount(
              item.quantity,
              item.sellingPrice,
              item.discountPercent,
              item.gstPercentage
            );
            return (
              <tr key={item.lineId}>
                <td className="border-b border-slate-100 px-2.5 py-2 font-semibold text-slate-800">
                  {item.medicineName}
                </td>
                <td className="border-b border-slate-100 px-2.5 py-2">
                  {item.batches?.length > 1 ? (
                    <select
                      value={item.inventoryBatchId}
                      onChange={(e) => onChangeBatch(item.lineId, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-1 py-1 text-xs"
                    >
                      {item.batches.map((b) => (
                        <option key={b.inventoryBatchId} value={b.inventoryBatchId}>
                          {b.batchNumber} (Exp {fmtDate(b.expiryDate)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-600">{item.batchNumber}</span>
                  )}
                </td>
                <td className="border-b border-slate-100 px-2.5 py-2 text-slate-600">{item.availableQty}</td>
                <td className="border-b border-slate-100 px-2.5 py-2">
                  <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => onUpdateItem(item.lineId, { quantity: Math.max(1, item.quantity - 1) })}
                      className="p-1 text-slate-500 hover:text-blue-600"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-7 text-center text-xs font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateItem(item.lineId, {
                          quantity: Math.min(item.availableQty, item.quantity + 1),
                        })
                      }
                      className="p-1 text-slate-500 hover:text-blue-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
                <td className="border-b border-slate-100 px-2.5 py-2 text-slate-700">{money(item.mrp)}</td>
                <td className="border-b border-slate-100 px-2.5 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.discountPercent}
                    onChange={(e) =>
                      onUpdateItem(item.lineId, { discountPercent: Number(e.target.value) || 0 })
                    }
                    className="w-14 rounded-lg border border-slate-200 px-1 py-1 text-center"
                  />
                </td>
                <td className="border-b border-slate-100 px-2.5 py-2 text-slate-600">{item.gstPercentage}%</td>
                <td className="border-b border-slate-100 px-2.5 py-2 font-semibold text-slate-900">{money(amount)}</td>
                <td className="border-b border-slate-100 px-2.5 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.lineId)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
