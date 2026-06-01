import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  Truck,
  UserX,
  Users,
  Wallet,
  ShoppingBag,
} from 'lucide-react';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import SupplierFormModal from '../../components/pharmacy/suppliers/SupplierFormModal';
import SupplierDetailsDrawer from '../../components/pharmacy/suppliers/SupplierDetailsDrawer';
import {
  createSupplier,
  deactivateSupplier,
  fetchSuppliers,
  updateSupplier,
} from '../../services/pharmacy/supplierService';
import './PharmacySuppliers.css';

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN')}`;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function SummaryCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
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
        <div key={i} className="pharmacy-suppliers-skeleton h-11 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Truck className="h-8 w-8" />
      </span>
      <h3 className="text-lg font-bold text-slate-900">No suppliers yet</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Add your first supplier to start the purchase workflow: Suppliers → PO → GRN → Inventory.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Add Supplier
      </button>
    </div>
  );
}

function mapApiErrors(errList, setFieldErrors) {
  const next = {};
  (errList || []).forEach((e) => {
    if (e.field) next[e.field] = e.message;
  });
  setFieldErrors(next);
  return Object.keys(next).length > 0;
}

function exportSuppliersCsv(rows) {
  const headers = [
    'Supplier Name',
    'Company',
    'Contact',
    'Phone',
    'GST',
    'Drug License',
    'Outstanding',
    'Status',
  ];
  const lines = rows.map((s) =>
    [
      s.supplierName,
      s.companyName,
      s.contactPerson,
      s.phone,
      s.gstNumber,
      s.drugLicenseNumber,
      s.outstandingAmount,
      s.status,
    ]
      .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-suppliers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PharmacySuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState({
    totalSuppliers: 0,
    activeSuppliers: 0,
    pendingPayments: 0,
    totalPurchases: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState({ type: 'success', message: '' });
  const [modal, setModal] = useState({ open: false, mode: 'add', supplier: null });
  const [saving, setSaving] = useState(false);
  const [drawerSupplier, setDrawerSupplier] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await fetchSuppliers(params);
      setSuppliers(data.suppliers || []);
      setStats(data.stats || {});
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to load suppliers',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Suppliers',
        value: String(stats.totalSuppliers ?? 0),
        sub: 'Registered vendors',
        icon: Users,
        tone: 'from-blue-50 to-cyan-50 text-blue-600 border-blue-100',
      },
      {
        label: 'Active Suppliers',
        value: String(stats.activeSuppliers ?? 0),
        sub: 'Available for PO',
        icon: Truck,
        tone: 'from-emerald-50 to-green-50 text-emerald-600 border-emerald-100',
      },
      {
        label: 'Pending Payments',
        value: money(stats.pendingPayments),
        sub: 'Outstanding dues',
        icon: Wallet,
        tone: 'from-amber-50 to-orange-50 text-orange-600 border-orange-100',
      },
      {
        label: 'Total Purchases',
        value: money(stats.totalPurchases),
        sub: 'Lifetime purchase value',
        icon: ShoppingBag,
        tone: 'from-violet-50 to-indigo-50 text-violet-600 border-violet-100',
      },
    ],
    [stats]
  );

  const handleSave = async (form, setFieldErrors) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        creditLimit: form.creditLimit === '' ? 0 : Number(form.creditLimit),
      };
      if (modal.mode === 'edit' && modal.supplier?.id) {
        await updateSupplier(modal.supplier.id, payload);
        setToast({ type: 'success', message: 'Supplier updated successfully' });
      } else {
        await createSupplier(payload);
        setToast({ type: 'success', message: 'Supplier added successfully' });
      }
      setModal({ open: false, mode: 'add', supplier: null });
      loadSuppliers();
    } catch (e) {
      const apiErrors = e?.response?.data?.errors;
      if (mapApiErrors(apiErrors, setFieldErrors)) return;
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to save supplier',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate?.id) return;
    try {
      await deactivateSupplier(confirmDeactivate.id);
      setToast({ type: 'success', message: 'Supplier deactivated' });
      setConfirmDeactivate(null);
      if (drawerSupplier?.id === confirmDeactivate.id) setDrawerSupplier(null);
      loadSuppliers();
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to deactivate supplier',
      });
    }
  };

  return (
    <div className="pharmacy-suppliers-page px-3 py-3 sm:px-4 lg:px-5">
      <Toast
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, message: '' }))}
      />

      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-600 md:hidden">Suppliers Management</p>
          <p className="text-xs text-slate-500 hidden sm:block">{todayLabel()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, GST, or phone…"
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
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            type="button"
            onClick={() => exportSuppliersCsv(suppliers)}
            disabled={!suppliers.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setModal({ open: true, mode: 'add', supplier: null })}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <TableSkeleton />
        ) : suppliers.length === 0 ? (
          <EmptyState onAdd={() => setModal({ open: true, mode: 'add', supplier: null })} />
        ) : (
          <>
            <div className="pharmacy-suppliers-desktop-table pharmacy-suppliers-table-wrap">
              <table className="pharmacy-suppliers-table">
                <thead>
                  <tr>
                    <th>Supplier Name</th>
                    <th>Company</th>
                    <th>Contact Person</th>
                    <th>Phone</th>
                    <th>GST No</th>
                    <th>Drug License</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.supplierName}</td>
                      <td>{s.companyName || '—'}</td>
                      <td>{s.contactPerson || '—'}</td>
                      <td>{s.phone}</td>
                      <td>{s.gstNumber}</td>
                      <td>{s.drugLicenseNumber || '—'}</td>
                      <td className="font-semibold text-rose-600">{money(s.outstandingAmount)}</td>
                      <td>
                        <span
                          className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${
                            s.status === 'active'
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {s.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            title="View"
                            onClick={() => setDrawerSupplier(s)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => setModal({ open: true, mode: 'edit', supplier: s })}
                            className="rounded-lg border border-blue-100 p-1.5 text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {s.status === 'active' ? (
                            <button
                              type="button"
                              title="Deactivate"
                              onClick={() => setConfirmDeactivate(s)}
                              className="rounded-lg border border-rose-100 p-1.5 text-rose-600 hover:bg-rose-50"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pharmacy-suppliers-mobile-list">
              {suppliers.map((s) => (
                <article key={s.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-blue-600">{s.supplierName}</p>
                      <p className="text-sm text-slate-600">{s.companyName || '—'}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-500">Contact</span><p className="font-semibold">{s.contactPerson || '—'}</p></div>
                    <div><span className="text-slate-500">Phone</span><p className="font-semibold">{s.phone}</p></div>
                    <div><span className="text-slate-500">GST</span><p className="font-semibold">{s.gstNumber}</p></div>
                    <div><span className="text-slate-500">Outstanding</span><p className="font-semibold text-rose-600">{money(s.outstandingAmount)}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setDrawerSupplier(s)} className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold">View</button>
                    <button type="button" onClick={() => setModal({ open: true, mode: 'edit', supplier: s })} className="flex-1 rounded-xl border border-blue-200 py-2 text-xs font-semibold text-blue-600">Edit</button>
                    {s.status === 'active' ? (
                      <button type="button" onClick={() => setConfirmDeactivate(s)} className="flex-1 rounded-xl border border-rose-200 py-2 text-xs font-semibold text-rose-600">Deactivate</button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <SupplierFormModal
        open={modal.open}
        mode={modal.mode}
        supplier={modal.supplier}
        saving={saving}
        onClose={() => setModal({ open: false, mode: 'add', supplier: null })}
        onSubmit={handleSave}
      />

      <SupplierDetailsDrawer
        open={Boolean(drawerSupplier)}
        supplier={drawerSupplier}
        onClose={() => setDrawerSupplier(null)}
      />

      <ConfirmModal
        open={Boolean(confirmDeactivate)}
        title="Deactivate supplier?"
        message={`${confirmDeactivate?.supplierName || 'This supplier'} will be marked inactive. Purchase history is preserved.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        confirmVariant="danger"
        onCancel={() => setConfirmDeactivate(null)}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}
