import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  IndianRupee,
  Pencil,
  Plus,
  Printer,
  Search,
  PackageCheck,
} from 'lucide-react';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import GRNFormModal from '../../components/pharmacy/grn/GRNFormModal';
import GRNDetailsDrawer from '../../components/pharmacy/grn/GRNDetailsDrawer';
import {
  completeGrn,
  createGrn,
  fetchGrnById,
  fetchGrns,
  updateGrn,
} from '../../services/pharmacy/grnService';
import { printGRN } from '../../utils/printGRN';
import './PharmacyGRN.css';

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function SummaryCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="mt-0.5 text-xl font-bold leading-none text-slate-900">{value}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="pharmacy-grn-skeleton h-11 w-full" />
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Draft: 'border-slate-200 bg-slate-100 text-slate-600',
    Completed: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    Cancelled: 'border-rose-100 bg-rose-50 text-rose-700',
  };
  return (
    <span className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${map[status] || map.Draft}`}>
      {status}
    </span>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <PackageCheck className="h-8 w-8" />
      </span>
      <h3 className="text-lg font-bold text-slate-900">No GRN records yet</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Receive supplier medicines here to create batches and update pharmacy inventory.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Create GRN
      </button>
    </div>
  );
}

function exportGrnCsv(rows) {
  const headers = ['GRN', 'PO', 'Supplier', 'Invoice', 'Items', 'Total', 'Status', 'Received'];
  const lines = rows.map((g) =>
    [
      g.grnNumber,
      g.poNumber,
      g.supplierName,
      g.invoiceNumber,
      g.items?.length || 0,
      g.grandTotal,
      g.status,
      g.receivedDate ? new Date(g.receivedDate).toISOString().slice(0, 10) : '',
    ]
      .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-grn-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PharmacyGRN() {
  const [grns, setGrns] = useState([]);
  const [stats, setStats] = useState({
    totalGrn: 0,
    pendingGrn: 0,
    completedGrn: 0,
    inventoryAddedValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [toast, setToast] = useState({ type: 'success', message: '' });
  const [modal, setModal] = useState({ open: false, mode: 'add', grn: null });
  const [saving, setSaving] = useState(false);
  const [drawerGrn, setDrawerGrn] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [printLoading, setPrintLoading] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  const loadGrns = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const data = await fetchGrns(params);
      setGrns(data.grns || []);
      setStats(data.stats || {});
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to load GRN list',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadGrns();
  }, [loadGrns]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total GRN',
        value: String(stats.totalGrn ?? 0),
        sub: 'All receipt notes',
        icon: ClipboardCheck,
        tone: 'from-blue-50 to-cyan-50 text-blue-600 border-blue-100',
      },
      {
        label: 'Pending GRN',
        value: String(stats.pendingGrn ?? 0),
        sub: 'Draft — not completed',
        icon: PackageCheck,
        tone: 'from-orange-50 to-amber-50 text-orange-600 border-orange-100',
      },
      {
        label: 'Completed GRN',
        value: String(stats.completedGrn ?? 0),
        sub: 'Stock updated',
        icon: CheckCircle2,
        tone: 'from-emerald-50 to-green-50 text-emerald-600 border-emerald-100',
      },
      {
        label: 'Inventory Added Value',
        value: money(stats.inventoryAddedValue),
        sub: 'From completed GRN',
        icon: IndianRupee,
        tone: 'from-violet-50 to-indigo-50 text-violet-600 border-violet-100',
      },
    ],
    [stats]
  );

  const openView = async (grn) => {
    try {
      const data = await fetchGrnById(grn.id);
      setDrawerGrn(data.grn || grn);
    } catch {
      setDrawerGrn(grn);
    }
  };

  const openEdit = async (grn) => {
    try {
      const data = await fetchGrnById(grn.id);
      setModal({ open: true, mode: 'edit', grn: data.grn || grn });
    } catch (e) {
      setToast({ type: 'error', message: e?.response?.data?.message || 'Failed to load GRN' });
    }
  };

  const handleSave = async (payload, action, setFieldErrors) => {
    setSaving(true);
    try {
      let grnId = modal.grn?.id;
      if (modal.mode === 'edit' && grnId) {
        await updateGrn(grnId, payload);
      } else {
        const created = await createGrn(payload);
        grnId = created.grn?.id;
      }

      if (action === 'complete' && grnId) {
        await completeGrn(grnId);
        setToast({ type: 'success', message: 'GRN completed — inventory updated' });
      } else {
        setToast({ type: 'success', message: 'GRN draft saved' });
      }

      setModal({ open: false, mode: 'add', grn: null });
      loadGrns();
    } catch (e) {
      const apiErrors = e?.response?.data?.errors;
      if (apiErrors?.length && setFieldErrors) {
        const next = {};
        apiErrors.forEach((err) => {
          if (err.field) next[err.field] = err.message;
        });
        setFieldErrors(next);
        return;
      }
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to save GRN',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!confirmComplete?.id) return;
    setActionLoading(confirmComplete.id);
    try {
      await completeGrn(confirmComplete.id);
      setToast({ type: 'success', message: `${confirmComplete.grnNumber} completed` });
      setConfirmComplete(null);
      if (drawerGrn?.id === confirmComplete.id) setDrawerGrn(null);
      loadGrns();
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to complete GRN',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrint = async (grn) => {
    if (!grn?.id) return;
    setPrintLoading(grn.id);
    try {
      await printGRN(grn.id);
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to open print',
      });
    } finally {
      setPrintLoading(null);
    }
  };

  const canEdit = (g) => g.status === 'Draft';
  const canComplete = (g) => g.status === 'Draft';
  const canPrint = (g) => g.status !== 'Cancelled';

  return (
    <div className="pharmacy-grn-page px-3 py-3 sm:px-4 lg:px-5">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast((t) => ({ ...t, message: '' }))} />

      <div className="mb-3">
        <p className="text-xs text-slate-500 hidden sm:block">{todayLabel()}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search GRN, PO, supplier, invoice…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium"
          >
            <option value="all">All status</option>
            <option value="Draft">Draft</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          <button
            type="button"
            disabled={!grns.length}
            onClick={() => exportGrnCsv(grns)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setModal({ open: true, mode: 'add', grn: null })}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create GRN
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <TableSkeleton />
        ) : grns.length === 0 ? (
          <EmptyState onAdd={() => setModal({ open: true, mode: 'add', grn: null })} />
        ) : (
          <>
            <div className="pharmacy-grn-desktop-table pharmacy-grn-table-wrap">
              <table className="pharmacy-grn-table">
                <thead>
                  <tr>
                    <th>GRN Number</th>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Invoice Number</th>
                    <th>Total Items</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th>Received Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grns.map((g) => (
                    <tr key={g.id}>
                      <td>{g.grnNumber}</td>
                      <td>{g.poNumber}</td>
                      <td>{g.supplierName}</td>
                      <td>{g.invoiceNumber || '—'}</td>
                      <td>{g.items?.length || 0}</td>
                      <td className="font-semibold">{money(g.grandTotal)}</td>
                      <td>
                        <StatusBadge status={g.status} />
                      </td>
                      <td>{formatDate(g.receivedDate)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" title="View" onClick={() => openView(g)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canPrint(g) ? (
                            <button
                              type="button"
                              title="Print"
                              disabled={printLoading === g.id}
                              onClick={() => handlePrint(g)}
                              className="rounded-lg border border-indigo-100 p-1.5 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {canEdit(g) ? (
                            <button type="button" title="Edit" onClick={() => openEdit(g)} className="rounded-lg border border-blue-100 p-1.5 text-blue-600 hover:bg-blue-50">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {canComplete(g) ? (
                            <button
                              type="button"
                              title="Complete"
                              disabled={actionLoading === g.id}
                              onClick={() => setConfirmComplete(g)}
                              className="rounded-lg border border-emerald-100 p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pharmacy-grn-mobile-list">
              {grns.map((g) => (
                <article key={g.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-bold text-violet-600">{g.grnNumber}</p>
                      <p className="text-sm text-slate-600">{g.supplierName}</p>
                      <p className="text-xs text-slate-500">PO: {g.poNumber}</p>
                    </div>
                    <StatusBadge status={g.status} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Total</span>
                      <p className="font-semibold">{money(g.grandTotal)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Received</span>
                      <p className="font-semibold">{formatDate(g.receivedDate)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => openView(g)} className="flex-1 rounded-xl border py-2 text-xs font-semibold">
                      View
                    </button>
                    {canPrint(g) ? (
                      <button type="button" onClick={() => handlePrint(g)} className="flex-1 rounded-xl border border-indigo-200 py-2 text-xs font-semibold text-indigo-600">
                        Print
                      </button>
                    ) : null}
                    {canComplete(g) ? (
                      <button type="button" onClick={() => setConfirmComplete(g)} className="flex-1 rounded-xl border border-emerald-200 py-2 text-xs font-semibold text-emerald-600">
                        Complete
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <GRNFormModal
        open={modal.open}
        mode={modal.mode}
        grn={modal.grn}
        saving={saving}
        onClose={() => setModal({ open: false, mode: 'add', grn: null })}
        onSubmit={handleSave}
        onValidationError={(message) => setToast({ type: 'error', message })}
      />

      <GRNDetailsDrawer
        open={Boolean(drawerGrn)}
        grn={drawerGrn}
        onClose={() => setDrawerGrn(null)}
        onPrint={drawerGrn ? () => handlePrint(drawerGrn) : undefined}
        printLoading={drawerGrn && printLoading === drawerGrn.id}
      />

      <ConfirmModal
        open={Boolean(confirmComplete)}
        title="Complete GRN?"
        message={`${confirmComplete?.grnNumber || 'GRN'} will update inventory batches and stock. This cannot be undone.`}
        confirmText="Complete GRN"
        cancelText="Cancel"
        confirmVariant="primary"
        onCancel={() => setConfirmComplete(null)}
        onConfirm={handleComplete}
      />
    </div>
  );
}
