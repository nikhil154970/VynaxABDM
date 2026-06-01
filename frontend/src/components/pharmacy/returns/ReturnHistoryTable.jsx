import { formatDateTime, formatMoney, ReturnStatusBadge } from './ReturnsCards';

const cellCls = 'px-2.5 py-1.5 align-middle text-xs text-slate-700 whitespace-nowrap';

export default function ReturnHistoryTable({ items, loading, onView, onApprove, onCancel, onPrint }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[1000px] text-xs">
          <thead>
            <tr style={{ background: '#f8faff' }}>
              {['Return Number', 'Return Type', 'Reference', 'Patient/Supplier', 'Medicines', 'Total Value', 'Status', 'Created', 'Actions'].map((h) => (
                <th key={h} className="px-2.5 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : items.length ? (
              items.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/20">
                  <td className={cellCls}><span className="font-mono text-blue-700">{r.returnNumber}</span></td>
                  <td className={cellCls}>{r.returnTypeLabel}</td>
                  <td className={cellCls}>{r.referenceNumber}</td>
                  <td className={cellCls}>{r.returnType === 'CUSTOMER_RETURN' ? r.patientName : r.supplierName}</td>
                  <td className={cellCls}>{r.medicineCount}</td>
                  <td className={cellCls}>{formatMoney(r.totalAmount)}</td>
                  <td className={cellCls}><ReturnStatusBadge status={r.status} label={r.statusLabel} /></td>
                  <td className={cellCls}>{formatDateTime(r.createdAt)}</td>
                  <td className={cellCls}>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => onView(r)} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50">View</button>
                      {r.status === 'PENDING' ? (
                        <button type="button" onClick={() => onApprove(r)} className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700">Approve</button>
                      ) : null}
                      {r.status === 'PENDING' ? (
                        <button type="button" onClick={() => onCancel(r)} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">Cancel</button>
                      ) : null}
                      <button type="button" onClick={() => onPrint(r)} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50">Print</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-400">No returns found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="md:hidden p-3 space-y-2">
        {!loading && items.map((r) => (
          <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex justify-between gap-2">
              <span className="font-mono text-sm font-bold text-blue-700">{r.returnNumber}</span>
              <ReturnStatusBadge status={r.status} label={r.statusLabel} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{r.returnTypeLabel} · {formatMoney(r.totalAmount)}</p>
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={() => onView(r)} className="rounded-lg border px-2 py-1 text-[11px] font-semibold">View</button>
              {r.status === 'PENDING' ? (
                <button type="button" onClick={() => onApprove(r)} className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white">Approve</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
