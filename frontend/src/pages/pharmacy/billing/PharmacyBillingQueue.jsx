import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardList,
  RefreshCw,
  Search,
  Stethoscope,
} from 'lucide-react';
import Toast from '../../../components/Toast';
import api from '../../../utils/api';

const STATUS_STYLES = {
  WAITING: 'bg-amber-50 text-amber-800 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-800 border-blue-200',
  BILLED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

function StatusBadge({ status }) {
  const label = status === 'WAITING' ? 'Waiting' : status === 'IN_PROGRESS' ? 'In Progress' : 'Billed';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.WAITING}`}
    >
      {label}
    </span>
  );
}

const cellCls = 'px-2.5 py-1.5 align-middle text-xs text-slate-700 whitespace-nowrap';

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <div className={`group rounded-2xl border bg-gradient-to-br p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="mt-0.5 text-xl font-bold leading-none text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Drawer({ open, item, loading, onClose, onCreateBill }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-2xl transition-transform">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900">Prescription</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {item?.patient?.name ? (
                  <>
                    {item.patient.name} · <span className="font-mono font-bold text-blue-700">{item.patient.uhid}</span>
                  </>
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
        </div>

        <div className="p-4 space-y-3 overflow-auto h-[calc(100%-68px)]">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading…</div>
          ) : !item ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Not found</div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-600">Patient information</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="font-semibold text-slate-900">{item.patient.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Mobile</p>
                    <p className="font-semibold text-slate-900">{item.patient.mobile || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Age / Gender</p>
                    <p className="font-semibold text-slate-900">
                      {item.patient.age ?? '—'} / {item.patient.gender || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Token</p>
                    <p className="font-mono font-bold text-blue-700">{item.tokenNumber}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold text-slate-600">Doctor information</p>
                <p className="mt-2 text-sm font-extrabold text-slate-900">{item.doctor?.name || '—'}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.doctor?.department || '—'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold text-slate-600">Prescription medicines</p>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 pr-2">Medicine</th>
                        <th className="pb-2 pr-2">Dosage</th>
                        <th className="pb-2 pr-2">Frequency</th>
                        <th className="pb-2 pr-2">Duration</th>
                        <th className="pb-2 pr-2">Qty</th>
                        <th className="pb-2">Availability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.items || []).map((m) => {
                        const inv = m.inventory || {};
                        const invLabel =
                          inv.status === 'AVAILABLE'
                            ? 'Available'
                            : inv.status === 'LOW_STOCK'
                              ? 'Low Stock'
                              : inv.status === 'OUT_OF_STOCK'
                                ? 'Out Of Stock'
                                : '—';
                        const invTone =
                          inv.status === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : inv.status === 'LOW_STOCK'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : inv.status === 'OUT_OF_STOCK'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200';

                        return (
                          <tr key={m.id} className="border-t border-slate-100">
                            <td className="py-2 pr-2 font-semibold text-slate-900">{m.medicineName}</td>
                            <td className="py-2 pr-2 text-slate-700">{m.dosage || '—'}</td>
                            <td className="py-2 pr-2 text-slate-700">{m.frequency || '—'}</td>
                            <td className="py-2 pr-2 text-slate-700">{m.duration || '—'}</td>
                            <td className="py-2 pr-2 text-slate-700">{m.quantity}</td>
                            <td className="py-2">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${invTone}`}>
                                {invLabel}{inv.availableQty !== undefined ? ` · ${inv.availableQty}` : ''}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {!item.items?.length ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            No medicines
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onCreateBill(item)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-blue-700"
                    disabled={item.status === 'BILLED'}
                    title="Create bill from this prescription"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Create Bill
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PharmacyBillingQueue() {
  const navigate = useNavigate();
  const [toast, setToast] = useState({ type: 'success', message: '' });

  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('WAITING');
  const [date, setDate] = useState('');

  const [page, setPage] = useState(1);
  const limit = 20;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get('/pharmacy/queue/summary', { params: { date: date || undefined } });
      setSummary(res.data?.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [date]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/pharmacy/queue', {
        params: {
          q: q.trim() || undefined,
          status: status || undefined,
          date: date || undefined,
          page,
          limit,
        },
      });
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setToast({ type: 'error', message: 'Failed to load pharmacy queue' });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, status, date, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const cards = useMemo(() => {
    const s = summary || {};
    return [
      {
        label: 'Waiting Patients',
        value: String(s.waiting ?? '—'),
        icon: ClipboardList,
        tone: 'from-amber-50 to-orange-50 text-amber-700 border-amber-100',
      },
      {
        label: 'In Progress',
        value: String(s.inProgress ?? '—'),
        icon: Stethoscope,
        tone: 'from-blue-50 to-cyan-50 text-blue-700 border-blue-100',
      },
      {
        label: 'Billed Today',
        value: String(s.billedToday ?? '—'),
        icon: ArrowRight,
        tone: 'from-emerald-50 to-lime-50 text-emerald-700 border-emerald-100',
      },
      {
        label: 'Pending Queue',
        value: String(s.pendingQueue ?? '—'),
        icon: Search,
        tone: 'from-violet-50 to-indigo-50 text-violet-700 border-violet-100',
      },
    ];
  }, [summary]);

  const openDrawer = async (id) => {
    setDrawerOpen(true);
    setDrawerId(id);
    setDrawerLoading(true);
    setDrawerItem(null);
    try {
      const res = await api.get(`/pharmacy/queue/${encodeURIComponent(id)}`);
      setDrawerItem(res.data?.item || null);
    } catch {
      setDrawerItem(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCreateBill = (queueItem) => {
    // Navigate to existing New Billing page; it will read location.state for prefill.
    navigate('/dashboard/pharmacy/billing', {
      state: {
        pharmacyQueue: {
          id: queueItem.id,
          tokenNumber: queueItem.tokenNumber,
        },
        prefillPatient: queueItem.patient,
        prefillDoctor: queueItem.doctor,
        prefillPrescription: queueItem.items,
      },
    });
  };

  return (
    <div className="min-h-full bg-[#fbfdff] px-3 py-3 text-slate-800 sm:px-4 lg:px-5">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ ...toast, message: '' })} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <SummaryCard key={c.label} icon={c.icon} label={c.label} value={loadingSummary ? '—' : c.value} tone={c.tone} />
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search UHID / name / mobile / token…"
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-[320px]"
              />
            </div>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">All</option>
              <option value="WAITING">Waiting</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BILLED">Billed</option>
            </select>

            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              title="Sent date"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              loadSummary();
              loadList();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-3 py-2.5">
          <h2 className="text-sm font-semibold text-slate-900">Prescription Queue</h2>
          <p className="text-xs text-slate-500">Patients sent by Receptionist for Pharmacy billing.</p>
        </div>

        {/* Desktop/Tablet table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr style={{ background: '#f8faff' }}>
                {[
                  'Token Number',
                  'UHID',
                  'Patient Name',
                  'Doctor Name',
                  'Sent By',
                  'Sent Time',
                  'Prescription Count',
                  'Status',
                  'Actions',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                    Loading queue…
                  </td>
                </tr>
              ) : items.length ? (
                items.map((r) => (
                  <tr key={r.id} className="hover:bg-blue-50/20 transition">
                    <td className={cellCls}>
                      <span className="font-mono text-blue-700">{r.tokenNumber}</span>
                    </td>
                    <td className={`${cellCls} font-mono`}>{r.patient?.uhid || '—'}</td>
                    <td className={`${cellCls} max-w-[140px] truncate`} title={r.patient?.name}>
                      {r.patient?.name || '—'}
                    </td>
                    <td className={`${cellCls} max-w-[120px] truncate`} title={r.doctor?.name}>
                      {r.doctor?.name || '—'}
                    </td>
                    <td className={`${cellCls} max-w-[100px] truncate`}>{r.sentByReceptionist?.name || '—'}</td>
                    <td className={cellCls}>
                      {r.sentAt ? new Date(r.sentAt).toLocaleString('en-IN') : '—'}
                    </td>
                    <td className={cellCls}>{r.prescriptionCount ?? 0}</td>
                    <td className={cellCls}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className={cellCls}>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDrawer(r.id)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreateBill(r)}
                          className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          disabled={r.status === 'BILLED'}
                        >
                          Create Bill
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-slate-400">
                    No patients in queue
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-3 space-y-2">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading queue…</div>
          ) : items.length ? (
            items.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 truncate">{r.patient?.name || '—'}</p>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      UHID: <span className="font-mono font-bold">{r.patient?.uhid || '—'}</span> · Token:{' '}
                      <span className="font-mono font-bold text-blue-700">{r.tokenNumber}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">{r.doctor?.name || '—'}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => openDrawer(r.id)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateBill(r)}
                    className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={r.status === 'BILLED'}
                  >
                    Create Bill
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
              No patients in queue
            </div>
          )}
        </div>

        {/* Pagination (simple) */}
        <div className="border-t border-slate-100 p-3 flex items-center justify-between text-xs text-slate-500">
          <span>Page {page}</span>
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
              disabled={loading || items.length < limit}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        item={drawerItem}
        loading={drawerLoading}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerId(null);
          setDrawerItem(null);
        }}
        onCreateBill={handleCreateBill}
      />
    </div>
  );
}
