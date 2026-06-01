import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, RefreshCw, Search } from 'lucide-react';
import Toast from '../../../components/Toast';
import ConfirmModal from '../../../components/ConfirmModal';
import ReturnsCards from '../../../components/pharmacy/returns/ReturnsCards';
import ReturnHistoryTable from '../../../components/pharmacy/returns/ReturnHistoryTable';
import ReturnDetailsDrawer from '../../../components/pharmacy/returns/ReturnDetailsDrawer';
import CustomerReturnsTab from '../../../components/pharmacy/returns/CustomerReturnsTab';
import VendorReturnsTab from '../../../components/pharmacy/returns/VendorReturnsTab';
import ExpiredMedicinesTab from '../../../components/pharmacy/returns/ExpiredMedicinesTab';
import {
  approveReturn,
  cancelReturn,
  fetchReturnById,
  fetchReturns,
  fetchReturnsSummary,
} from '../../../services/pharmacy/returnsService';
import { exportReturnsCsv, exportReturnsExcel, printReturnSlip } from '../../../utils/exportReturns';

const TABS = [
  { id: 'customer', label: 'Customer Returns' },
  { id: 'vendor', label: 'Vendor Returns' },
  { id: 'expired', label: 'Expired Medicines' },
  { id: 'history', label: 'Return History' },
];

const TYPE_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'CUSTOMER_RETURN', label: 'Customer Return' },
  { value: 'VENDOR_RETURN', label: 'Vendor Return' },
  { value: 'EXPIRED_RETURN', label: 'Expired Return' },
  { value: 'DAMAGED_RETURN', label: 'Damaged Return' },
];

export default function ReturnsPage() {
  const [toast, setToast] = useState({ type: 'success', message: '' });
  const [activeTab, setActiveTab] = useState('customer');

  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [returnType, setReturnType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [exportOpen, setExportOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerData, setDrawerData] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const listTab = activeTab === 'history' ? 'history' : activeTab;

  const filterParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      returnType: returnType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      tab: listTab,
    }),
    [debouncedQ, returnType, dateFrom, dateTo, listTab]
  );

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetchReturnsSummary();
      setSummary(res?.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    if (activeTab !== 'history') return;
    setLoading(true);
    try {
      const res = await fetchReturns({ ...filterParams, page, limit });
      setItems(Array.isArray(res?.items) ? res.items : []);
      setTotal(Number(res?.total) || 0);
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to fetch returns' });
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterParams, page, activeTab]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeTab === 'history') setPage(1);
  }, [activeTab]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const refreshAll = () => {
    loadSummary();
    if (activeTab === 'history') loadList();
  };

  const showToast = (type, message) => setToast({ type, message });

  const openDetails = async (row) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerData(null);
    try {
      const res = await fetchReturnById(row.id);
      setDrawerData(res);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to load return');
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleApprove = async (row) => {
    setActionLoading(true);
    try {
      await approveReturn(row.id);
      showToast('success', 'Return approved — inventory updated');
      setApproveTarget(null);
      setDrawerOpen(false);
      refreshAll();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Approve failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (row) => {
    setActionLoading(true);
    try {
      await cancelReturn(row.id);
      showToast('success', 'Return cancelled');
      setCancelTarget(null);
      setDrawerOpen(false);
      refreshAll();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Cancel failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = async (row) => {
    try {
      let ret = row.items ? row : null;
      if (!ret?.items?.length) {
        const res = await fetchReturnById(row.id);
        ret = res?.return;
      }
      printReturnSlip(ret);
    } catch {
      showToast('error', 'Print failed');
    }
  };

  const exportAll = async (kind) => {
    setExportOpen(false);
    try {
      const res = await fetchReturns({ ...filterParams, page: 1, limit: 5000, tab: 'history' });
      const rows = res?.items || [];
      if (!rows.length) {
        showToast('error', 'No data to export');
        return;
      }
      if (kind === 'csv') exportReturnsCsv(rows);
      else exportReturnsExcel(rows);
      showToast('success', 'Export started');
    } catch {
      showToast('error', 'Export failed');
    }
  };

  return (
    <div className="min-h-full bg-[#fbfdff] px-3 py-3">
      {toast.message ? <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: 'success', message: '' })} /> : null}


      <ReturnsCards summary={summary} loading={loadingSummary} />

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-3 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Return #, bill #, patient, supplier, medicine…"
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={returnType} onChange={(e) => setReturnType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">
                {TYPE_FILTERS.map((f) => (
                  <option key={f.value || 'all'} value={f.value}>{f.label}</option>
                ))}
              </select>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-2 text-xs" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-2 text-xs" />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" /> Export <ChevronDown className="h-3 w-3" />
                </button>
                {exportOpen ? (
                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button type="button" onClick={() => exportAll('csv')} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">CSV</button>
                    <button type="button" onClick={() => exportAll('excel')} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">Excel</button>
                  </div>
                ) : null}
              </div>
              <button type="button" onClick={refreshAll} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === t.id ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'customer' ? (
          <CustomerReturnsTab onSuccess={(m) => { showToast('success', m); loadSummary(); }} onError={(m) => showToast('error', m)} />
        ) : null}
        {activeTab === 'vendor' ? (
          <VendorReturnsTab onSuccess={(m) => { showToast('success', m); loadSummary(); }} onError={(m) => showToast('error', m)} />
        ) : null}
        {activeTab === 'expired' ? (
          <ExpiredMedicinesTab onSuccess={(m) => { showToast('success', m); loadSummary(); }} onError={(m) => showToast('error', m)} />
        ) : null}
        {activeTab === 'history' ? (
          <>
            <ReturnHistoryTable
              items={items}
              loading={loading}
              onView={openDetails}
              onApprove={(r) => setApproveTarget(r)}
              onCancel={(r) => setCancelTarget(r)}
              onPrint={handlePrint}
            />
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-500">Page {page} of {totalPages} ({total} returns)</p>
                <div className="flex gap-1">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1 text-xs font-semibold disabled:opacity-40">Prev</button>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1 text-xs font-semibold disabled:opacity-40">Next</button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <ReturnDetailsDrawer
        open={drawerOpen}
        loading={drawerLoading}
        data={drawerData}
        onClose={() => setDrawerOpen(false)}
        onApprove={(r) => setApproveTarget(r)}
        onCancel={(r) => setCancelTarget(r)}
        onPrint={handlePrint}
      />

      <ConfirmModal
        open={!!approveTarget}
        title="Approve Return"
        message={approveTarget ? `Approve ${approveTarget.returnNumber}? Inventory will be updated.` : ''}
        confirmText={actionLoading ? 'Approving…' : 'Approve'}
        confirmVariant="primary"
        onConfirm={() => approveTarget && handleApprove(approveTarget)}
        onCancel={() => setApproveTarget(null)}
      />

      <ConfirmModal
        open={!!cancelTarget}
        title="Cancel Return"
        message={cancelTarget ? `Cancel ${cancelTarget.returnNumber}? This cannot be undone.` : ''}
        confirmText={actionLoading ? 'Cancelling…' : 'Cancel Return'}
        confirmVariant="danger"
        onConfirm={() => cancelTarget && handleCancel(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
