import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MdAdd,
  MdBed,
  MdClose,
  MdEdit,
  MdDelete,
  MdLocalHospital,
  MdRefresh,
  MdSave,
  MdSettings,
} from 'react-icons/md';
import api from '../../../utils/api';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] transition duration-200 hover:border-gray-300';
const selectCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] transition duration-200 hover:border-gray-300 cursor-pointer';

const STATUS_META = {
  AVAILABLE: { label: 'Available', dot: '#16A34A', chipBg: 'rgba(22, 163, 74, 0.1)', chipText: '#16A34A' },
  OCCUPIED: { label: 'Occupied', dot: '#DC2626', chipBg: 'rgba(220, 38, 38, 0.1)', chipText: '#DC2626' },
  MAINTENANCE: { label: 'Cleaning', dot: '#F59E0B', chipBg: 'rgba(245, 158, 11, 0.1)', chipText: '#F59E0B' },
};

function wardLabel(type) {
  const t = String(type || '').toUpperCase();
  if (t === 'ICU') return 'ICU';
  if (t === 'PRIVATE') return 'Private';
  return 'General';
}

// Matches the client’s final structure (same as Live Tracker).
const FLOORS = [
  {
    key: 'ground',
    title: 'GROUND FLOOR',
    rooms: [
      { id: '1', beds: ['ICU1', 'ICU2', 'ICU3', 'ICU4', 'ICU5', 'ICU6'] },
      { id: '2', beds: ['G/W 4', 'G/W 5'] },
      { id: '3', beds: ['G/W 6', 'G/W 7'] },
      { id: '4', beds: ['G/W 3', 'G/W 2', 'G/W 1'] },
    ],
  },
  {
    key: 'first',
    title: 'FIRST FLOOR',
    rooms: [
      { id: '1', beds: ['NICU 1', 'NICU 2', 'HDU'] },
      { id: '2', beds: ['PVT 1', 'PVT 2'] },
      { id: '3', beds: ['PVT 3', 'PVT 4'] },
    ],
  },
  {
    key: 'second',
    title: 'SECOND FLOOR',
    rooms: [
      { id: '1', beds: ['ICU 7', 'ICU 8', 'ICU 9', 'ICU 10', 'ICU 11', 'ICU 12'] },
      { id: '2', beds: ['ICU 13', 'ICU 14', 'ICU 15', 'ICU 16'] },
      { id: '3', beds: ['PVT 5', 'PVT 6'] },
      { id: '4', beds: ['PVT 7', 'PVT 8'] },
      { id: '5', beds: ['PVT 9', 'PVT 10'] },
    ],
  },
];

function chip(status) {
  const m = STATUS_META[String(status || '').toUpperCase()] || STATUS_META.AVAILABLE;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: m.chipBg, color: m.chipText, border: '1px solid rgba(15,23,42,0.06)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function Modal({ open, title, onClose, children, maxWidth = 640 }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden ring-1 ring-black/5 animate-fadeIn"
        style={{ maxWidth }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 px-6 py-5 text-white bg-[#001B48] border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-white truncate">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all duration-200 cursor-pointer"
              aria-label="Close"
            >
              <MdClose className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 bg-[#f8fafc]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ManageBeds() {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedBed, setSelectedBed] = useState(null);
  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [savingBed, setSavingBed] = useState(false);
  const [deletingBed, setDeletingBed] = useState(false);

  const [addBedOpen, setAddBedOpen] = useState(false);
  const [creatingBed, setCreatingBed] = useState(false);
  const [newBed, setNewBed] = useState({ wardId: '', code: '' });

  const [wardModalOpen, setWardModalOpen] = useState(false);
  const [editingWard, setEditingWard] = useState(null);
  const [savingWard, setSavingWard] = useState(false);

  const bedsByCode = useMemo(() => {
    const map = new Map();
    for (const b of beds) map.set(String(b.code || '').trim(), b);
    return map;
  }, [beds]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [wRes, bRes] = await Promise.all([
        api.get('/admin/beds/wards', { params: { includeInactive: true } }),
        api.get('/admin/beds', { params: { includeInactiveWards: true } }),
      ]);
      setWards(Array.isArray(wRes?.data?.items) ? wRes.data.items : []);
      setBeds(Array.isArray(bRes?.data?.items) ? bRes.data.items : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const wardOptions = useMemo(() => {
    return wards
      .slice()
      .sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.name).localeCompare(String(b.name)))
      .map((w) => ({
        id: w.id,
        label: `${w.name} (${wardLabel(w.type)})${w.isActive ? '' : ' • inactive'}`,
        isActive: Boolean(w.isActive),
      }));
  }, [wards]);

  const unknownBeds = useMemo(() => {
    // Beds present in DB but not in the client floor map.
    const known = new Set(FLOORS.flatMap((f) => f.rooms.flatMap((r) => r.beds)));
    return beds.filter((b) => !known.has(String(b.code || '').trim()));
  }, [beds]);

  const openBedEditor = (bedCode) => {
    const hit = bedsByCode.get(String(bedCode || '').trim());
    if (!hit) return;
    setSelectedBed({
      ...hit,
      code: hit.code,
      wardId: hit.wardId,
      status: hit.status,
    });
    setBedModalOpen(true);
  };

  const saveBed = async () => {
    if (!selectedBed?.id) return;
    setSavingBed(true);
    try {
      await api.patch(`/admin/beds/${encodeURIComponent(selectedBed.id)}`, {
        code: selectedBed.code,
        wardId: selectedBed.wardId,
        status: selectedBed.status,
      });
      setBedModalOpen(false);
      setSelectedBed(null);
      await refresh();
    } finally {
      setSavingBed(false);
    }
  };

  const deleteBed = async () => {
    if (!selectedBed?.id) return;
    if (!window.confirm(`Delete bed "${selectedBed.code}"? This cannot be undone.`)) return;
    setDeletingBed(true);
    try {
      await api.delete(`/admin/beds/${encodeURIComponent(selectedBed.id)}`);
      setBedModalOpen(false);
      setSelectedBed(null);
      await refresh();
    } finally {
      setDeletingBed(false);
    }
  };

  const createBed = async () => {
    if (!newBed.wardId || !newBed.code.trim()) return;
    setCreatingBed(true);
    try {
      await api.post('/admin/beds', { wardId: newBed.wardId, code: newBed.code.trim() });
      setAddBedOpen(false);
      setNewBed({ wardId: '', code: '' });
      await refresh();
    } finally {
      setCreatingBed(false);
    }
  };

  const openWardEditor = (ward) => {
    setEditingWard({ ...ward });
    setWardModalOpen(true);
  };

  const saveWard = async () => {
    if (!editingWard?.id) return;
    setSavingWard(true);
    try {
      await api.patch(`/admin/beds/wards/${encodeURIComponent(editingWard.id)}`, {
        name: editingWard.name,
        type: editingWard.type,
        isActive: Boolean(editingWard.isActive),
      });
      setWardModalOpen(false);
      setEditingWard(null);
      await refresh();
    } finally {
      setSavingWard(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
            <MdSettings className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Bed Master</h1>
            <p className="text-xs md:text-sm text-gray-500">
              Manage wards, bed codes, and statuses. Changes reflect live on the Bed Tracker.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[#0077B6]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#0077B6] hover:border-[#0077B6] hover:bg-sky-50 active:bg-sky-100 transition duration-200 cursor-pointer shadow-sm disabled:opacity-60"
            onClick={() => refresh()}
            disabled={loading}
          >
            <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0077B6] hover:bg-[#005f92] active:bg-[#001B48] px-4 py-2.5 text-sm font-semibold text-white transition duration-200 cursor-pointer shadow-sm"
            onClick={() => setAddBedOpen(true)}
          >
            <MdAdd className="w-4 h-4" />
            Add Bed
          </button>
        </div>
      </div>

      {/* Floor layout */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <MdLocalHospital className="w-5 h-5 text-[#0077B6]" /> Client Structure View
          </p>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            {chip('AVAILABLE')}
            {chip('MAINTENANCE')}
            {chip('OCCUPIED')}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {FLOORS.map((f) => (
            <div key={f.key} className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{f.title}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {f.rooms.map((r) => (
                  <div key={`${f.key}-${r.id}`} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="text-[11px] font-bold text-gray-500 mb-2 flex items-center gap-2">
                      <MdBed className="w-4 h-4 text-[#0077B6]" /> ROOM {r.id}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.beds.map((code) => {
                        const b = bedsByCode.get(code);
                        const st = String(b?.status || 'AVAILABLE').toUpperCase();
                        const m = STATUS_META[st] || STATUS_META.AVAILABLE;
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => openBedEditor(code)}
                            className="px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 hover:shadow-md cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                            style={{
                              borderColor: m.dot,
                              color: m.chipText,
                              background: '#fff',
                              minWidth: 84,
                            }}
                            title="Click to edit"
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {unknownBeds.length ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-900">Beds not mapped to client sheet</p>
              <p className="text-xs text-amber-800 mt-1">
                These exist in DB but are not part of the current floor/room map. You can rename or move them.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unknownBeds.slice(0, 50).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBed({ ...b });
                      setBedModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs font-semibold text-amber-900 cursor-pointer hover:bg-amber-50 transition duration-150"
                  >
                    {b.code}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Wards table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold text-gray-900">Wards</p>
          <span className="text-xs text-gray-500">{wards.length} ward(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50/70 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                {['Ward', 'Type', 'Active', 'Beds', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {wards.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/80 transition duration-150">
                  <td className="px-4 py-3.5 font-semibold text-gray-900">{w.name}</td>
                  <td className="px-4 py-3.5 text-xs font-semibold text-gray-700">{wardLabel(w.type)}</td>
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        w.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/40'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/40'
                      }`}
                    >
                      {w.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-semibold text-gray-700">{w.bedCount}</td>
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#0077B6]/20 bg-blue-50 text-[#0077B6] hover:border-[#0077B6]/40 hover:bg-sky-50 active:bg-sky-100 transition duration-200 cursor-pointer"
                      onClick={() => openWardEditor(w)}
                    >
                      <MdEdit className="w-4 h-4" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!wards.length && !loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                    No wards found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bed editor */}
      <Modal
        open={bedModalOpen}
        title={selectedBed ? `Edit bed: ${selectedBed.code}` : 'Edit bed'}
        onClose={() => {
          setBedModalOpen(false);
          setSelectedBed(null);
        }}
        maxWidth={640}
      >
        {selectedBed ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Bed code</label>
                <input
                  className={inputCls}
                  value={selectedBed.code || ''}
                  onChange={(e) => setSelectedBed((p) => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. ICU1 / G/W 4 / PVT 1"
                />
                <p className="text-[11px] text-gray-600 mt-1">Must be globally unique.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Ward</label>
                <select
                  className={selectCls}
                  value={selectedBed.wardId || ''}
                  onChange={(e) => setSelectedBed((p) => ({ ...p, wardId: e.target.value }))}
                >
                  <option value="">Select ward</option>
                  {wardOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Status</label>
                <select
                  className={selectCls}
                  value={String(selectedBed.status || 'AVAILABLE').toUpperCase()}
                  onChange={(e) => setSelectedBed((p) => ({ ...p, status: e.target.value }))}
                  disabled={String(selectedBed.status || '').toUpperCase() === 'OCCUPIED'}
                >
                  {['AVAILABLE', 'MAINTENANCE', 'OCCUPIED'].map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s]?.label || s}
                    </option>
                  ))}
                </select>
                {String(selectedBed.status || '').toUpperCase() === 'OCCUPIED' ? (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Occupied bed status is managed via IPD discharge/transfer workflows.
                  </p>
                ) : null}
              </div>
              <div className="flex items-end">
                <div className="w-full">
                  <label className="block text-xs font-semibold text-gray-800 mb-1.5">Preview</label>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                    {chip(selectedBed.status)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition duration-200 cursor-pointer disabled:opacity-50"
                onClick={deleteBed}
                disabled={deletingBed || String(selectedBed.status || '').toUpperCase() === 'OCCUPIED'}
                title={String(selectedBed.status || '').toUpperCase() === 'OCCUPIED' ? 'Cannot delete occupied bed' : 'Delete bed'}
              >
                <MdDelete className="w-4.5 h-4.5" /> {deletingBed ? 'Deleting…' : 'Delete'}
              </button>
              <div className="flex-1" />
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition duration-200 cursor-pointer"
                onClick={() => setBedModalOpen(false)}
              >
                <MdClose className="w-4.5 h-4.5" /> Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#005f92] active:bg-[#001B48] transition duration-200 cursor-pointer shadow-sm"
                onClick={saveBed}
                disabled={savingBed}
              >
                <MdSave className="w-4.5 h-4.5" /> {savingBed ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Add bed */}
      <Modal
        open={addBedOpen}
        title="Add new bed"
        onClose={() => setAddBedOpen(false)}
        maxWidth={560}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1.5">Ward</label>
              <select className={selectCls} value={newBed.wardId} onChange={(e) => setNewBed((p) => ({ ...p, wardId: e.target.value }))}>
                <option value="">Select ward</option>
                {wardOptions.map((w) => (
                  <option key={w.id} value={w.id} disabled={!w.isActive}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1.5">Bed code</label>
              <input
                className={inputCls}
                value={newBed.code}
                onChange={(e) => setNewBed((p) => ({ ...p, code: e.target.value }))}
                placeholder="e.g. PVT 11"
              />
            </div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            Tip: If you want this bed to appear in the Live Tracker map, use the same naming convention as the client sheet.
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition duration-200 cursor-pointer"
              onClick={() => setAddBedOpen(false)}
            >
              <MdClose className="w-4.5 h-4.5" /> Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#005f92] active:bg-[#001B48] transition duration-200 cursor-pointer shadow-sm disabled:opacity-50"
              onClick={createBed}
              disabled={creatingBed || !newBed.wardId || !newBed.code.trim()}
            >
              <MdAdd className="w-4.5 h-4.5" /> {creatingBed ? 'Creating…' : 'Create bed'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Ward editor */}
      <Modal
        open={wardModalOpen}
        title={editingWard ? `Edit ward: ${editingWard.name}` : 'Edit ward'}
        onClose={() => {
          setWardModalOpen(false);
          setEditingWard(null);
        }}
        maxWidth={560}
      >
        {editingWard ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Name</label>
                <input
                  className={inputCls}
                  value={editingWard.name || ''}
                  onChange={(e) => setEditingWard((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Type</label>
                <select
                  className={selectCls}
                  value={String(editingWard.type || 'GENERAL').toUpperCase()}
                  onChange={(e) => setEditingWard((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="GENERAL">General</option>
                  <option value="ICU">ICU</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Active</label>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingWard.isActive)}
                    onChange={(e) => setEditingWard((p) => ({ ...p, isActive: e.target.checked }))}
                    className="cursor-pointer"
                  />
                  Ward is active
                </label>
                <p className="text-[11px] text-gray-600 mt-1">
                  Inactive wards are hidden for receptionist workflows (beds list will be filtered there).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition duration-200 cursor-pointer"
                onClick={() => setWardModalOpen(false)}
              >
                <MdClose className="w-4.5 h-4.5" /> Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#005f92] active:bg-[#001B48] transition duration-200 cursor-pointer shadow-sm disabled:opacity-50"
                onClick={saveWard}
                disabled={savingWard || !editingWard.name?.trim()}
              >
                <MdSave className="w-4.5 h-4.5" /> {savingWard ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}



