import { formatDateTime, formatMoney, ReturnStatusBadge } from './ReturnsCards';

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 space-y-1 text-xs text-slate-700">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <p>
      <span className="text-slate-500">{label}: </span>
      <span className="font-semibold text-slate-900">{value ?? '—'}</span>
    </p>
  );
}

export default function ReturnDetailsDrawer({ open, loading, data, onClose, onApprove, onCancel, onPrint }) {
  if (!open) return null;
  const ret = data?.return || data;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 top-0 h-full w-full max-w-[620px] bg-white shadow-2xl">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-slate-900">Return Details</p>
              <p className="mt-0.5 font-mono text-xs font-bold text-blue-700">{ret?.returnNumber || '—'}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50">
              Close
            </button>
          </div>
          {ret?.status ? (
            <div className="mt-2">
              <ReturnStatusBadge status={ret.status} label={ret.statusLabel} />
            </div>
          ) : null}
        </div>

        <div className="p-4 space-y-3 overflow-auto h-[calc(100%-140px)]">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : ret ? (
            <>
              <Section title="Return Information">
                <Row label="Return Type" value={ret.returnTypeLabel} />
                <Row label="Reference" value={ret.referenceNumber} />
                <Row label="Total Amount" value={formatMoney(ret.totalAmount)} />
                <Row label="Remarks" value={ret.remarks || '—'} />
              </Section>

              {ret.returnType === 'CUSTOMER_RETURN' ? (
                <Section title="Patient Details">
                  <Row label="Patient" value={ret.patientName} />
                </Section>
              ) : (
                <Section title="Supplier Details">
                  <Row label="Supplier" value={ret.supplierName} />
                </Section>
              )}

              {ret.refundType ? (
                <Section title="Refund Details">
                  <Row label="Refund Type" value={ret.refundTypeLabel} />
                </Section>
              ) : null}

              <Section title="Medicine Details">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1">Medicine</th>
                        <th className="py-1">Batch</th>
                        <th className="py-1">Qty</th>
                        <th className="py-1">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(ret.items || []).map((item) => (
                        <tr key={item.id}>
                          <td className="py-1.5 font-medium">{item.medicineName}</td>
                          <td className="py-1.5">{item.batchNumber}</td>
                          <td className="py-1.5">{item.quantity}</td>
                          <td className="py-1.5">{formatMoney(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title="Approval Details">
                <Row label="Created By" value={ret.createdByName} />
                <Row label="Created At" value={formatDateTime(ret.createdAt)} />
                <Row label="Approved By" value={ret.approvedByName} />
                <Row label="Approved At" value={formatDateTime(ret.approvedAt)} />
              </Section>

              <Section title="Inventory Impact">
                <p className="text-slate-600">
                  {ret.returnType === 'CUSTOMER_RETURN'
                    ? 'Stock will increase on approval (customer return).'
                    : ret.returnType === 'EXPIRED_RETURN'
                      ? 'Batch quantity will be set to zero on approval.'
                      : 'Stock will decrease on approval (vendor/expired/damaged return).'}
                </p>
              </Section>
            </>
          ) : (
            <p className="text-sm text-slate-500">Return not found</p>
          )}
        </div>

        {ret && !loading ? (
          <div className="border-t border-slate-100 p-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onPrint(ret)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold hover:bg-slate-50">
              Print Slip
            </button>
            {ret.status === 'PENDING' ? (
              <>
                <button type="button" onClick={() => onApprove(ret)} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
                  Approve Return
                </button>
                <button type="button" onClick={() => onCancel(ret)} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">
                  Cancel
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
