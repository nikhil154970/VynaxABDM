import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  FolderOpen,
  Layers,
  Pencil,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import MedicineFormModal from '../../components/pharmacy/medicines/MedicineFormModal';
import MedicineDetailsDrawer from '../../components/pharmacy/medicines/MedicineDetailsDrawer';
import {
  createMedicine,
  deactivateMedicine,
  fetchMedicines,
  updateMedicine,
} from '../../services/pharmacy/medicineService';
import './PharmacyMedicines.css';

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
        <div key={i} className="pharmacy-medicines-skeleton h-11 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <Pill className="h-8 w-8" />
      </span>
      <h3 className="text-lg font-bold text-slate-900">No medicines yet</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Add medicine master records here. Stock, batches, and expiry are managed in GRN and Inventory.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Add Medicine
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

function exportMedicinesCsv(rows) {
  const headers = ['Medicine Name', 'Generic', 'Category', 'Manufacturer', 'GST %', 'Barcode', 'Status'];
  const lines = rows.map((m) =>
    [m.medicineName, m.genericName, m.category, m.manufacturer, m.gstPercentage, m.barcode, m.status]
      .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy-medicines-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }) {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${
        active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function PharmacyMedicines() {
  const [medicines, setMedicines] = useState([]);
  const [stats, setStats] = useState({
    totalMedicines: 0,
    activeMedicines: 0,
    prescriptionMedicines: 0,
    categoriesCount: 0,
    categories: [],
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [toast, setToast] = useState({ type: 'success', message: '' });
  const [modal, setModal] = useState({ open: false, mode: 'add', medicine: null });
  const [saving, setSaving] = useState(false);
  const [drawerMedicine, setDrawerMedicine] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  const loadMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      const data = await fetchMedicines(params);
      setMedicines(data.medicines || []);
      setStats(data.stats || {});
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to load medicines',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, categoryFilter]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const categoryOptions = useMemo(() => {
    const fromApi = stats.categories || [];
    const fromRows = medicines.map((m) => m.category).filter(Boolean);
    return Array.from(new Set([...fromApi, ...fromRows])).sort();
  }, [stats.categories, medicines]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Medicines',
        value: String(stats.totalMedicines ?? 0),
        sub: 'Product master records',
        icon: Pill,
        tone: 'from-blue-50 to-cyan-50 text-blue-600 border-blue-100',
      },
      {
        label: 'Active Medicines',
        value: String(stats.activeMedicines ?? 0),
        sub: 'Available for billing',
        icon: Layers,
        tone: 'from-emerald-50 to-green-50 text-emerald-600 border-emerald-100',
      },
      {
        label: 'Prescription Medicines',
        value: String(stats.prescriptionMedicines ?? 0),
        sub: 'Rx required',
        icon: ShieldCheck,
        tone: 'from-violet-50 to-purple-50 text-violet-600 border-violet-100',
      },
      {
        label: 'Categories',
        value: String(stats.categoriesCount ?? 0),
        sub: 'Distinct categories',
        icon: FolderOpen,
        tone: 'from-amber-50 to-orange-50 text-orange-600 border-orange-100',
      },
    ],
    [stats]
  );

  const handleSave = async (form, setFieldErrors) => {
    setSaving(true);
    try {
      if (modal.mode === 'edit' && modal.medicine?.id) {
        await updateMedicine(modal.medicine.id, form);
        setToast({ type: 'success', message: 'Medicine updated successfully' });
      } else {
        await createMedicine(form);
        setToast({ type: 'success', message: 'Medicine added successfully' });
      }
      setModal({ open: false, mode: 'add', medicine: null });
      loadMedicines();
    } catch (e) {
      const apiErrors = e?.response?.data?.errors;
      if (mapApiErrors(apiErrors, setFieldErrors)) return;
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to save medicine',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate?.id) return;
    try {
      await deactivateMedicine(confirmDeactivate.id);
      setToast({ type: 'success', message: 'Medicine deactivated' });
      setConfirmDeactivate(null);
      if (drawerMedicine?.id === confirmDeactivate.id) setDrawerMedicine(null);
      loadMedicines();
    } catch (e) {
      setToast({
        type: 'error',
        message: e?.response?.data?.message || 'Failed to deactivate medicine',
      });
    }
  };

  return (
    <div className="pharmacy-medicines-page px-3 py-3 sm:px-4 lg:px-5">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast((t) => ({ ...t, message: '' }))} />

      <div className="mb-3">
        <p className="text-xs font-semibold text-violet-600 md:hidden">Medicines Management</p>
      
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </div>

      <div className="pharmacy-medicines-sticky-actions mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by medicine, generic name, barcode..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
            onClick={() => exportMedicinesCsv(medicines)}
            disabled={!medicines.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setModal({ open: true, mode: 'add', medicine: null })}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Medicine
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <TableSkeleton />
        ) : medicines.length === 0 ? (
          <EmptyState onAdd={() => setModal({ open: true, mode: 'add', medicine: null })} />
        ) : (
          <>
            <div className="pharmacy-medicines-desktop-table pharmacy-medicines-table-wrap">
              <table className="pharmacy-medicines-table">
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Generic Name</th>
                    <th>Category</th>
                    <th>Manufacturer</th>
                    <th>GST</th>
                    <th>Barcode</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((m) => (
                    <tr key={m.id}>
                      <td>{m.medicineName}</td>
                      <td>{m.genericName || '—'}</td>
                      <td>{m.category}</td>
                      <td>{m.manufacturer || '—'}</td>
                      <td>{m.gstPercentage}%</td>
                      <td>{m.barcode || '—'}</td>
                      <td><StatusBadge status={m.status} /></td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            title="View"
                            onClick={() => setDrawerMedicine(m)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => setModal({ open: true, mode: 'edit', medicine: m })}
                            className="rounded-lg border border-blue-100 p-1.5 text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {m.status === 'active' ? (
                            <button
                              type="button"
                              title="Deactivate"
                              onClick={() => setConfirmDeactivate(m)}
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

            <div className="pharmacy-medicines-mobile-list">
              {medicines.map((m) => (
                <article key={m.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-blue-600">{m.medicineName}</p>
                      <p className="text-sm text-slate-600">{m.genericName || '—'}</p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-500">Category</span><p className="font-semibold">{m.category}</p></div>
                    <div><span className="text-slate-500">GST</span><p className="font-semibold">{m.gstPercentage}%</p></div>
                    <div><span className="text-slate-500">Manufacturer</span><p className="font-semibold truncate">{m.manufacturer || '—'}</p></div>
                    <div><span className="text-slate-500">Barcode</span><p className="font-semibold">{m.barcode || '—'}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setDrawerMedicine(m)} className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold">View</button>
                    <button type="button" onClick={() => setModal({ open: true, mode: 'edit', medicine: m })} className="flex-1 rounded-xl border border-blue-200 py-2 text-xs font-semibold text-blue-600">Edit</button>
                    {m.status === 'active' ? (
                      <button type="button" onClick={() => setConfirmDeactivate(m)} className="flex-1 rounded-xl border border-rose-200 py-2 text-xs font-semibold text-rose-600">Deactivate</button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <MedicineFormModal
        open={modal.open}
        mode={modal.mode}
        medicine={modal.medicine}
        saving={saving}
        onClose={() => setModal({ open: false, mode: 'add', medicine: null })}
        onSubmit={handleSave}
      />

      <MedicineDetailsDrawer
        open={Boolean(drawerMedicine)}
        medicine={drawerMedicine}
        onClose={() => setDrawerMedicine(null)}
      />

      <ConfirmModal
        open={Boolean(confirmDeactivate)}
        title="Deactivate medicine?"
        message={`${confirmDeactivate?.medicineName || 'This medicine'} will be marked inactive. Master data is preserved for history.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        confirmVariant="danger"
        onCancel={() => setConfirmDeactivate(null)}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}
