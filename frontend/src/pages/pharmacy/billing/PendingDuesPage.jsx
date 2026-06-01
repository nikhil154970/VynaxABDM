import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, RefreshCw, Search } from 'lucide-react';
import Toast from '../../../components/Toast';
import PendingDuesCards from '../../../components/pharmacy/pending-dues/PendingDuesCards';
import PendingDuesTable from '../../../components/pharmacy/pending-dues/PendingDuesTable';
import PendingDueDetailsDrawer from '../../../components/pharmacy/pending-dues/PendingDueDetailsDrawer';
import CollectPaymentModal from '../../../components/pharmacy/pending-dues/CollectPaymentModal';
import {
  collectPendingDuePayment,
  fetchBillPendingDueDetails,
  fetchPatientPendingDues,
  fetchPendingDues,
  fetchPendingDuesSummary,
} from '../../../services/pharmacy/pendingDuesService';
import {
  exportPendingDuesCsv,
  exportPendingDuesExcel,
  printPendingDueStatement,
} from '../../../utils/printPendingDueStatement';

export default function PendingDuesPage() {
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [exportOpen, setExportOpen] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerData, setDrawerData] = useState(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetchPendingDuesSummary();
      setSummary(res?.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPendingDues({
        q: debouncedQ || undefined,
        patientType: patientType || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
      });
      setItems(Array.isArray(res?.items) ? res.items : []);
      setTotal(Number(res?.total) || 0);
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to load pending dues' });
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, patientType, status, dateFrom, dateTo, page]);

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

  const openDrawerForRow = async (row) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerData(null);
    try {
      if (row.patientId) {
        const res = await fetchPatientPendingDues(row.patientId);
        setDrawerData({ ...res, bill: row });
      } else {
        const res = await fetchBillPendingDueDetails(row.billId || row.id);
        setDrawerData({ ...res, summary: {
          totalBills: 1,
          totalAmount: res.bill?.totalAmount,
          paidAmount: res.bill?.paidAmount,
          pendingAmount: res.bill?.pendingAmount,
        }});
      }
    } catch {
      setDrawerData(null);
      setToast({ type: 'error', message: 'Failed to load due details' });
    } finally {
      setDrawerLoading(false);
    }
  };

  const openPayment = (bill) => {
    setPaymentBill(bill);
    setPaymentOpen(true);
  };

  const handleCollectPayment = async (payload) => {
    setPaymentSubmitting(true);
    try {
      await collectPendingDuePayment(payload);
      setToast({ type: 'success', message: 'Payment collected successfully' });
      setPaymentOpen(false);
      setPaymentBill(null);
      if (drawerOpen) setDrawerOpen(false);
      refreshAll();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to collect payment' });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    exportPendingDuesCsv(items);
    setExportOpen(false);
  };

  const handleExportExcel = () => {
    exportPendingDuesExcel(items);
    setExportOpen(false);
  };

  return (
    <div className="min-h-full bg-[#fbfdff] px-3 py-3 text-slate-800 sm:px-4 lg:px-5">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ ...toast, message: '' })} />

      <PendingDuesCards summary={summary} loading={loadingSummary} />

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search UHID / name / mobile / bill…"
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-[300px]"
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
              <option value="PENDING">Pending</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              title="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              title="To date"
            />
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
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Export Excel
                    </button>
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
          <h2 className="text-sm font-semibold text-slate-900">Pending Dues</h2>
          <p className="text-xs text-slate-500">Outstanding pharmacy bills — partial payments and unpaid amounts.</p>
        </div>

        <PendingDuesTable
          items={items}
          loading={loading}
          readOnly={false}
          onViewDetails={openDrawerForRow}
          onCollectPayment={openPayment}
          onPrintStatement={printPendingDueStatement}
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

      <PendingDueDetailsDrawer
        open={drawerOpen}
        loading={drawerLoading}
        data={drawerData}
        readOnly={false}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerData(null);
        }}
        onCollectPayment={(bill) => {
          setDrawerOpen(false);
          openPayment(bill);
        }}
      />

      <CollectPaymentModal
        open={paymentOpen}
        bill={paymentBill}
        submitting={paymentSubmitting}
        onClose={() => {
          setPaymentOpen(false);
          setPaymentBill(null);
        }}
        onSubmit={handleCollectPayment}
      />
    </div>
  );
}
