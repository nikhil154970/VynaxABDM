import { useState } from 'react';
import { formatMoney } from './BillingHistoryCards';
import { BillStatusBadge, formatDateTime } from './BillingHistoryTable';
import PaymentHistoryTable from './PaymentHistoryTable';
import PatientBillingHistory from './PatientBillingHistory';
import { openPharmacyInvoice } from './InvoicePrint';

const TABS = [
  { id: 'details', label: 'Bill Details' },
  { id: 'payments', label: 'Payment History' },
  { id: 'patient', label: 'Patient History' },
];

export default function BillDetailsDrawer({
  open,
  loading,
  data,
  canCancel,
  onClose,
  onCancelBill,
  onRefreshBill,
}) {
  const [tab, setTab] = useState('details');

  if (!open) return null;

  const bill = data?.bill;
  const patient = data?.patient;
  const items = data?.items || [];
  const paymentHistory = data?.paymentHistory || [];
  const patientBillingHistory = data?.patientBillingHistory || [];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 top-0 h-full w-full max-w-[620px] bg-white shadow-2xl transition-transform">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900">Bill Details</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {bill?.billNumber ? (
                  <span className="font-mono font-bold text-blue-700">{bill.billNumber}</span>
                ) : (
                  '—'
                )}
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

          <div className="mt-3 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                  tab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-auto h-[calc(100%-108px)]">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : !data ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Not found</div>
          ) : tab === 'details' ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-600">Patient Information</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Patient Name</p>
                    <p className="font-semibold text-slate-900">{patient?.name || bill?.patientName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">UHID</p>
                    <p className="font-mono font-semibold text-blue-700">{patient?.uhid || bill?.patientUhid || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Mobile</p>
                    <p className="font-semibold text-slate-900">{patient?.mobile || bill?.patientMobile || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Patient Type</p>
                    <p className="font-semibold text-slate-900">{bill?.patientTypeLabel || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Doctor Name</p>
                    <p className="font-semibold text-slate-900">{bill?.doctorName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Department</p>
                    <p className="font-semibold text-slate-900">{bill?.department || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-600">Bill Information</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Bill Number</p>
                    <p className="font-mono font-semibold text-blue-700">{bill?.billNumber}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Bill Date</p>
                    <p className="font-semibold text-slate-900">{formatDateTime(bill?.billDate)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Created By</p>
                    <p className="font-semibold text-slate-900">{bill?.createdByName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Payment Mode</p>
                    <p className="font-semibold text-slate-900">{bill?.paymentModeLabel || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <BillStatusBadge status={bill?.status} label={bill?.statusLabel} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-600">Medicines</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 pr-2">Medicine</th>
                        <th className="pb-2 pr-2">Batch</th>
                        <th className="pb-2 pr-2">Qty</th>
                        <th className="pb-2 pr-2">MRP</th>
                        <th className="pb-2 pr-2">Disc</th>
                        <th className="pb-2 pr-2">GST</th>
                        <th className="pb-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.id} className="border-t border-slate-100">
                          <td className="py-2 pr-2 font-semibold text-slate-900">{m.medicineName}</td>
                          <td className="py-2 pr-2 font-mono text-slate-600">{m.batchNumber}</td>
                          <td className="py-2 pr-2">{m.quantity}</td>
                          <td className="py-2 pr-2">{formatMoney(m.mrp)}</td>
                          <td className="py-2 pr-2">{m.discountPercent}%</td>
                          <td className="py-2 pr-2">{m.gstPercentage}%</td>
                          <td className="py-2 font-semibold">{formatMoney(m.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-600">Payment Summary</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatMoney(bill?.subTotal)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>- {formatMoney(bill?.discount)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">GST</span><span>{formatMoney(bill?.gstAmount)}</span></div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 font-bold"><span>Grand Total</span><span>{formatMoney(bill?.totalAmount)}</span></div>
                  <div className="flex justify-between text-emerald-700"><span>Paid Amount</span><span>{formatMoney(bill?.paidAmount)}</span></div>
                  <div className="flex justify-between text-rose-700"><span>Pending Amount</span><span>{formatMoney(bill?.pendingAmount)}</span></div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openPharmacyInvoice(data?.printData, { autoPrint: true })}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
                >
                  Print Invoice
                </button>
                <button
                  type="button"
                  onClick={() => openPharmacyInvoice(data?.printData, { autoPrint: false, downloadPdf: true })}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Download PDF
                </button>
                {canCancel && bill?.status !== 'CANCELLED' ? (
                  <button
                    type="button"
                    onClick={() => onCancelBill(bill)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                  >
                    Cancel Bill
                  </button>
                ) : null}
              </div>
            </>
          ) : tab === 'payments' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-extrabold text-slate-600">Payment History</p>
              <div className="mt-2">
                <PaymentHistoryTable payments={paymentHistory} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-extrabold text-slate-600">Patient Billing History</p>
              <div className="mt-2">
                <PatientBillingHistory
                  bills={patientBillingHistory}
                  onSelectBill={(b) => onRefreshBill?.(b.id)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
