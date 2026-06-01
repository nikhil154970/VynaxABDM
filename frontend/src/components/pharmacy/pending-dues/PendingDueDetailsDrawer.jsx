import { DueStatusBadge, formatDateTime, formatMoney } from './PendingDuesTable';
import PaymentHistoryTable from './PaymentHistoryTable';

export default function PendingDueDetailsDrawer({ open, loading, data, readOnly, onClose, onCollectPayment }) {
  if (!open) return null;

  const bill = data?.bill;
  const patient = data?.patient;
  const summary = data?.summary;
  const outstandingBills = data?.outstandingBills || (bill ? [bill] : []);
  const paymentHistory = data?.paymentHistory || [];

  const patientName = patient?.name || bill?.patientName || '—';
  const patientUhid = patient?.uhid || bill?.patientUhid || '—';
  const patientMobile = patient?.mobile || bill?.patientMobile || '—';
  const patientType = bill?.patientTypeLabel || data?.patientType || '—';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl transition-transform">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900">Pending Due Details</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {patientName} · <span className="font-mono font-bold text-blue-700">{patientUhid}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-auto h-[calc(100%-68px)]">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : !data ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Not found</div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-600">Patient Information</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="font-semibold text-slate-900">{patientName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">UHID</p>
                    <p className="font-mono font-semibold text-blue-700">{patientUhid}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Mobile</p>
                    <p className="font-semibold text-slate-900">{patientMobile || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Patient Type</p>
                    <p className="font-semibold text-slate-900">{patientType}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-600">Billing Summary</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Total Bills</p>
                    <p className="font-semibold text-slate-900">{summary?.totalBills ?? outstandingBills.length}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total Amount</p>
                    <p className="font-semibold text-slate-900">{formatMoney(summary?.totalAmount ?? bill?.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total Paid</p>
                    <p className="font-semibold text-emerald-700">{formatMoney(summary?.paidAmount ?? bill?.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total Pending</p>
                    <p className="font-semibold text-rose-700">{formatMoney(summary?.pendingAmount ?? bill?.pendingAmount)}</p>
                  </div>
                </div>
              </div>

              {data.recentPayments?.length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-extrabold text-slate-600">Recent Payments</p>
                  <div className="mt-2">
                    <PaymentHistoryTable payments={data.recentPayments} compact />
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-600">Outstanding Bills</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 pr-2">Bill</th>
                        <th className="pb-2 pr-2">Total</th>
                        <th className="pb-2 pr-2">Pending</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstandingBills.map((b) => (
                        <tr key={b.id || b.billId} className="border-t border-slate-100">
                          <td className="py-2 pr-2 font-mono text-blue-700">{b.billNumber}</td>
                          <td className="py-2 pr-2">{formatMoney(b.totalAmount)}</td>
                          <td className="py-2 pr-2 font-semibold text-rose-700">{formatMoney(b.pendingAmount)}</td>
                          <td className="py-2">
                            <DueStatusBadge status={b.status} label={b.statusLabel} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {paymentHistory.length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-extrabold text-slate-600">Payment History</p>
                  <div className="mt-2">
                    <PaymentHistoryTable payments={paymentHistory} />
                  </div>
                </div>
              ) : null}

              {!readOnly && bill ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onCollectPayment(bill)}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700"
                  >
                    Collect Payment
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
