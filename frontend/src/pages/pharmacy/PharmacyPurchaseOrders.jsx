import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  IndianRupee,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Clock,
} from 'lucide-react';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import PurchaseOrderFormModal from '../../components/pharmacy/purchaseOrders/PurchaseOrderFormModal';
import PurchaseOrderDetailsDrawer from '../../components/pharmacy/purchaseOrders/PurchaseOrderDetailsDrawer';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  fetchPurchaseOrderById,
  fetchPurchaseOrders,
  updatePurchaseOrder,
} from '../../services/pharmacy/purchaseOrderService';
import { printPurchaseOrder } from '../../utils/printPurchaseOrder';
import './PharmacyPurchaseOrders.css';

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
        <div key={i} className="pharmacy-purchase-skeleton h-11 w-full" />
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Draft: 'border-slate-200 bg-slate-100 text-slate-600',
    Pending: 'border-orange-100 bg-orange-50 text-orange-700',
    Approved: 'border-blue-100 bg-blue-50 text-blue-700',
    Delivered: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    'Partially Delivered': 'border-amber-100 bg-amber-50 text-amber-800',
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
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <ShoppingCart className="h-8 w-8" />
      </span>
      <h3 className="text-lg font-bold text-slate-900">No purchase orders yet</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Create a PO to send medicine requirements to suppliers. Stock updates happen only through GRN.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Create Purchase Order
      </button>
    </div>
  );
}

function exportPurchaseOrdersCsv(rows) {
  const headers = ['PO Number', 'Supplier', 'Items', 'Total', 'Status', 'Created'];
  const lines = rows.map((o) =>
    [
      o.poNumber,
      o.supplierName,
      o.items?.length || 0,
      o.grandTotal,
      o.status,
      o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : '',
    ]
      .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PharmacyPurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalPurchaseOrders: 0,
    pendingOrders: 0,
    approvedOrders: 0,
    totalPurchaseValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [toast, setToast] = useState({ type: 'success', message: '' });
  const [modal, setModal] = useState({ open: false, mode: 'add', order: null });
  const [saving, setSaving] = useState(false);
  const [drawerOrder, setDrawerOrder] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [printLoading, setPrintLoading] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const data = await fetchPurchaseOrders(params);
      setOrders(data.purchaseOrders || []);
      setStats(data.stats || {});
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to load purchase orders',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Purchase Orders',
        value: String(stats.totalPurchaseOrders ?? 0),
        sub: 'All procurement requests',
        icon: ClipboardList,
        tone: 'from-blue-50 to-cyan-50 text-blue-600 border-blue-100',
      },
      {
        label: 'Pending Orders',
        value: String(stats.pendingOrders ?? 0),
        sub: 'Awaiting approval',
        icon: Clock,
        tone: 'from-orange-50 to-amber-50 text-orange-600 border-orange-100',
      },
      {
        label: 'Approved Orders',
        value: String(stats.approvedOrders ?? 0),
        sub: 'Sent to supplier',
        icon: CheckCircle2,
        tone: 'from-indigo-50 to-violet-50 text-indigo-600 border-indigo-100',
      },
      {
        label: 'Total Purchase Value',
        value: money(stats.totalPurchaseValue),
        sub: 'Excluding cancelled',
        icon: IndianRupee,
        tone: 'from-emerald-50 to-green-50 text-emerald-600 border-emerald-100',
      },
    ],
    [stats]
  );

  const openView = async (order) => {
    try {
      const data = await fetchPurchaseOrderById(order.id);
      setDrawerOrder(data.purchaseOrder || order);
    } catch {
      setDrawerOrder(order);
    }
  };

  const openEdit = async (order) => {
    try {
      const data = await fetchPurchaseOrderById(order.id);
      setModal({ open: true, mode: 'edit', order: data.purchaseOrder || order });
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to load purchase order',
      });
    }
  };

  const handleSave = async (payload, setFieldErrors) => {
    setSaving(true);
    try {
      if (modal.mode === 'edit' && modal.order?.id) {
        await updatePurchaseOrder(modal.order.id, payload);
        setToast({ type: 'success', message: 'Purchase order updated' });
      } else {
        await createPurchaseOrder(payload);
        setToast({
          type: 'success',
          message: payload.submitAs === 'submit' ? 'Purchase order submitted' : 'Draft saved',
        });
      }
      setModal({ open: false, mode: 'add', order: null });
      loadOrders();
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
        message: e?.response?.data?.message || 'Failed to save purchase order',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (order) => {
    setActionLoading(order.id);
    try {
      await approvePurchaseOrder(order.id);
      setToast({ type: 'success', message: `${order.poNumber} approved` });
      if (drawerOrder?.id === order.id) {
        const data = await fetchPurchaseOrderById(order.id);
        setDrawerOrder(data.purchaseOrder);
      }
      loadOrders();
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to approve purchase order',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrint = async (order) => {
    if (!order?.id) return;
    setPrintLoading(order.id);
    try {
      await printPurchaseOrder(order.id);
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to open print preview',
      });
    } finally {
      setPrintLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel?.id) return;
    try {
      await cancelPurchaseOrder(confirmCancel.id);
      setToast({ type: 'success', message: `${confirmCancel.poNumber} cancelled` });
      setConfirmCancel(null);
      if (drawerOrder?.id === confirmCancel.id) setDrawerOrder(null);
      loadOrders();
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to cancel purchase order',
      });
    }
  };

  const canEdit = (o) => ['Draft', 'Pending'].includes(o.status);
  const canApprove = (o) => o.status === 'Pending';
  const canCancel = (o) => !['Cancelled', 'Delivered'].includes(o.status);
  const canPrint = (o) => o.status !== 'Cancelled';

  return (
    <div className="pharmacy-purchase-page px-3 py-3 sm:px-4 lg:px-5">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast((t) => ({ ...t, message: '' }))} />

      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 md:hidden">Purchase Orders</h2>
          <p className="text-xs text-slate-500 md:hidden">
            Manage pharmacy medicine procurement and supplier orders
          </p>
      
        </div>
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
            placeholder="Search PO number or supplier…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400"
            aria-label="Filter by status"
          >
            <option value="all">All status</option>
            <option value="Draft">Draft</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
            aria-label="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
            aria-label="To date"
          />
          <button
            type="button"
            onClick={() => exportPurchaseOrdersCsv(orders)}
            disabled={!orders.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setModal({ open: true, mode: 'add', order: null })}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Purchase Order
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <TableSkeleton />
        ) : orders.length === 0 ? (
          <EmptyState onAdd={() => setModal({ open: true, mode: 'add', order: null })} />
        ) : (
          <>
            <div className="pharmacy-purchase-desktop-table pharmacy-purchase-table-wrap">
              <table className="pharmacy-purchase-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Created Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.poNumber}</td>
                      <td>{o.supplierName}</td>
                      <td>{o.items?.length || 0}</td>
                      <td className="font-semibold">{money(o.grandTotal)}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>{formatDate(o.createdAt)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            title="View"
                            onClick={() => openView(o)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canPrint(o) ? (
                            <button
                              type="button"
                              title="Print PO"
                              disabled={printLoading === o.id}
                              onClick={() => handlePrint(o)}
                              className="rounded-lg border border-indigo-100 p-1.5 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {canEdit(o) ? (
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => openEdit(o)}
                              className="rounded-lg border border-blue-100 p-1.5 text-blue-600 hover:bg-blue-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {canApprove(o) ? (
                            <button
                              type="button"
                              title="Approve"
                              disabled={actionLoading === o.id}
                              onClick={() => handleApprove(o)}
                              className="rounded-lg border border-emerald-100 p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {canCancel(o) ? (
                            <button
                              type="button"
                              title="Cancel"
                              onClick={() => setConfirmCancel(o)}
                              className="rounded-lg border border-rose-100 p-1.5 text-rose-600 hover:bg-rose-50"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pharmacy-purchase-mobile-list">
              {orders.map((o) => (
                <article key={o.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-blue-600">{o.poNumber}</p>
                      <p className="text-sm text-slate-600">{o.supplierName}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Items</span>
                      <p className="font-semibold">{o.items?.length || 0}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Total</span>
                      <p className="font-semibold">{money(o.grandTotal)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Created</span>
                      <p className="font-semibold">{formatDate(o.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openView(o)}
                      className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold"
                    >
                      View
                    </button>
                    {canPrint(o) ? (
                      <button
                        type="button"
                        disabled={printLoading === o.id}
                        onClick={() => handlePrint(o)}
                        className="flex-1 rounded-xl border border-indigo-200 py-2 text-xs font-semibold text-indigo-600"
                      >
                        Print
                      </button>
                    ) : null}
                    {canEdit(o) ? (
                      <button
                        type="button"
                        onClick={() => openEdit(o)}
                        className="flex-1 rounded-xl border border-blue-200 py-2 text-xs font-semibold text-blue-600"
                      >
                        Edit
                      </button>
                    ) : null}
                    {canApprove(o) ? (
                      <button
                        type="button"
                        disabled={actionLoading === o.id}
                        onClick={() => handleApprove(o)}
                        className="flex-1 rounded-xl border border-emerald-200 py-2 text-xs font-semibold text-emerald-600"
                      >
                        Approve
                      </button>
                    ) : null}
                    {canCancel(o) ? (
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(o)}
                        className="flex-1 rounded-xl border border-rose-200 py-2 text-xs font-semibold text-rose-600"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <PurchaseOrderFormModal
        open={modal.open}
        mode={modal.mode}
        order={modal.order}
        saving={saving}
        onClose={() => setModal({ open: false, mode: 'add', order: null })}
        onSubmit={handleSave}
      />

      <PurchaseOrderDetailsDrawer
        open={Boolean(drawerOrder)}
        order={drawerOrder}
        onClose={() => setDrawerOrder(null)}
        onPrint={drawerOrder ? () => handlePrint(drawerOrder) : undefined}
        printLoading={drawerOrder && printLoading === drawerOrder.id}
      />

      <ConfirmModal
        open={Boolean(confirmCancel)}
        title="Cancel purchase order?"
        message={`${confirmCancel?.poNumber || 'This PO'} will be marked cancelled. Inventory is not affected.`}
        confirmText="Cancel PO"
        cancelText="Keep"
        confirmVariant="danger"
        onCancel={() => setConfirmCancel(null)}
        onConfirm={handleCancel}
      />
    </div>
  );
}
