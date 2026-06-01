import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, RefreshCw, Search } from 'lucide-react';
import Toast from '../../../components/Toast';
import ConfirmModal from '../../../components/ConfirmModal';
import BillingHistoryCards from '../../../components/pharmacy/billing-history/BillingHistoryCards';
import BillingHistoryTable from '../../../components/pharmacy/billing-history/BillingHistoryTable';
import BillDetailsDrawer from '../../../components/pharmacy/billing-history/BillDetailsDrawer';
import { openPharmacyInvoice } from '../../../components/pharmacy/billing-history/InvoicePrint';
import {
  cancelBillingHistoryBill,
  fetchBillHistoryDetails,
  fetchBillingHistory,
  fetchBillingHistorySummary,
} from '../../../services/pharmacy/billingHistoryService';
import {
  exportBillingHistoryCsv,
  exportBillingHistoryExcel,
  exportBillingHistoryPdf,
} from '../../../utils/exportBillingHistory';

export default function BillingHistoryPage() {
  const [toast, setToast] = useState({ type: 'success', message: '' });

  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [patientType, setPatientType] = useState('');
  const [status, setStatus] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [exportOpen, setExportOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerData, setDrawerData] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const canCancel = true;

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const filterParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      patientType: patientType || undefined,
      status: status || undefined,
      paymentMode: paymentMode || undefined,
      datePreset: datePreset || undefined,
      dateFrom: datePreset === 'custom' ? dateFrom || undefined : undefined,
      dateTo: datePreset === 'custom' ? dateTo || undefined : undefined,
    }),
    [debouncedQ, patientType, status, paymentMode, datePreset, dateFrom, dateTo]
  );

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetchBillingHistorySummary(filterParams);
      setSummary(res?.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [filterParams]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchBillingHistory({ ...filterParams, page, limit });
      setItems(Array.isArray(res?.items) ? res.items : []);
      setTotal(Number(res?.total) || 0);
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to fetch billing history' });
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterParams, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const refreshAll = () => {
    loadSummary();
    loadList();
  };

  const openBillDetails = async (row, tabHint) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerData(null);
    try {
      const res = await fetchBillHistoryDetails(row.id);
      setDrawerData(res);
      if (tabHint === 'payments') {
        // drawer manages its own tab state; user can switch
      }
    } catch {
      setDrawerData(null);
      setToast({ type: 'error', message: 'Failed to load bill details' });
    } finally {
      setDrawerLoading(false);
    }
  };

  const handlePrint = async (row) => {
    try {
      const res = await fetchBillHistoryDetails(row.id);
      openPharmacyInvoice(res?.printData, { autoPrint: true });
    } catch {
      setToast({ type: 'error', message: 'Failed to load bill for print' });
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelBillingHistoryBill(cancelTarget.id);
      setToast({ type: 'success', message: 'Bill cancelled — inventory restored' });
      setCancelTarget(null);
      setDrawerOpen(false);
      refreshAll();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to cancel bill' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-full bg-[#fbfdff] px-3 py-3 text-slate-800 sm:px-4 lg:px-5">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ ...toast, message: '' })} />

      <BillingHistoryCards summary={summary} loading={loadingSummary} />

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search bill / UHID / name / mobile…"
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-[280px]"
              />
            </div>

            <select
              value={patientType}
              onChange={(e) => {
                setPatientType(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">All Types</option>
              <option value="IPD">IPD</option>
              <option value="OPD">OPD</option>
              <option value="WALK_IN">Walk-In</option>
            </select>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">All Status</option>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={paymentMode}
              onChange={(e) => {
                setPaymentMode(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">All Modes</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="MIXED">Mixed</option>
            </select>

            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>

            {datePreset === 'custom' ? (
              <>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                />
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {exportOpen ? (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} aria-hidden />
                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button type="button" onClick={() => { exportBillingHistoryCsv(items); setExportOpen(false); }} className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">CSV</button>
                    <button type="button" onClick={() => { exportBillingHistoryExcel(items); setExportOpen(false); }} className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">Excel</button>
                    <button type="button" onClick={() => { exportBillingHistoryPdf(items); setExportOpen(false); }} className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">PDF</button>
                  </div>
                </>
              ) : null}
            </div>

            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-3 py-2.5">
          <h2 className="text-sm font-semibold text-slate-900">Billing History</h2>
          <p className="text-xs text-slate-500">Complete pharmacy billing records — paid, pending, partial and cancelled.</p>
        </div>

        <BillingHistoryTable
          items={items}
          loading={loading}
          onViewBill={(r) => openBillDetails(r)}
          onPrintBill={handlePrint}
        />

        <div className="border-t border-slate-100 p-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {page} of {totalPages} · {total} record{total === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={page <= 1 || loading}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={loading || page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <BillDetailsDrawer
        open={drawerOpen}
        loading={drawerLoading}
        data={drawerData}
        canCancel={canCancel}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerData(null);
        }}
        onCancelBill={(bill) => setCancelTarget(bill)}
        onRefreshBill={async (billId) => {
          setDrawerLoading(true);
          try {
            const res = await fetchBillHistoryDetails(billId);
            setDrawerData(res);
          } finally {
            setDrawerLoading(false);
          }
        }}
      />

      <ConfirmModal
        open={Boolean(cancelTarget)}
        title="Cancel Bill?"
        message={
          cancelTarget
            ? `Cancel bill ${cancelTarget.billNumber}? Stock will be restored automatically. Payment history will remain on record.`
            : ''
        }
        confirmText={cancelling ? 'Cancelling…' : 'Cancel Bill'}
        confirmVariant="danger"
        onConfirm={handleCancelConfirm}
        onCancel={() => !cancelling && setCancelTarget(null)}
      />
    </div>
  );
}
