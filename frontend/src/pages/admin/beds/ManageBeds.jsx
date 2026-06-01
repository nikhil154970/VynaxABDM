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
import '../../receptionist/patients/PatientList.css';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const selectCls = 'pl-select w-full';

const STATUS_META = {
  AVAILABLE: { label: 'Available', dot: '#22c55e', chipBg: '#dcfce7', chipText: '#14532d' },
  OCCUPIED: { label: 'Occupied', dot: '#ef4444', chipBg: '#fee2e2', chipText: '#991b1b' },
  MAINTENANCE: { label: 'Cleaning', dot: '#f59e0b', chipBg: '#fef9c3', chipText: '#854d0e' },
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
      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-extrabold"
      style={{ background: m.chipBg, color: m.chipText, border: '1px solid rgba(15,23,42,0.06)' }}
    >
      <span className="pl-dot" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function Modal({ open, title, onClose, children, maxWidth = 760 }) {
  if (!open) return null;
  return createPortal(
    <div
      className="pl-modalOverlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pl-modal pl-modalAnimate" style={{ maxWidth }}>
        <div className="pl-modalHeader">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="pl-modalClose" title="Close">
            <MdClose className="w-5 h-5" />
          </button>
        </div>
        <div className="pl-modalBody">{children}</div>
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
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
                  style={{ background: '#eef2ff', color: '#3730a3' }}
                >
                  <MdSettings className="w-5 h-5" />
                </span>
                Bed Master — Add / Edit Beds
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Manage wards + bed codes + statuses. Live Tracker & Bed Status will reflect changes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-700 hover:bg-gray-50 transition"
                onClick={() => refresh()}
                disabled={loading}
              >
                <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:shadow-md transition"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #0d6ebd)' }}
                onClick={() => setAddBedOpen(true)}
              >
                <MdAdd className="w-4 h-4" />
                Add Bed
              </button>
            </div>
          </div>
        </div>

        {/* Floor layout */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <MdLocalHospital className="w-5 h-5 text-blue-700" /> Client Structure View
            </p>
            <div className="flex items-center gap-2 text-xs font-extrabold text-gray-500">
              {chip('AVAILABLE')}
              {chip('MAINTENANCE')}
              {chip('OCCUPIED')}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {FLOORS.map((f) => (
              <div key={f.key} className="rounded-2xl border border-gray-100 bg-gradient-to-r from-slate-50/80 to-white p-4">
                <p className="text-xs font-extrabold text-gray-700 tracking-wider">{f.title}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {f.rooms.map((r) => (
                    <div key={`${f.key}-${r.id}`} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                      <div className="text-[11px] font-extrabold text-gray-500 mb-2 flex items-center gap-2">
                        <MdBed className="w-4 h-4" /> ROOM {r.id}
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
                              className="px-3 py-2 rounded-xl border text-xs font-extrabold transition hover:shadow-sm"
                              style={{
                                borderColor: m.dot,
                                color: m.chipText,
                                background: '#fff',
                                minWidth: 78,
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
                <p className="text-xs font-extrabold text-amber-900">Beds not mapped to client sheet</p>
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
                      className="px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs font-extrabold text-amber-900"
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
            <p className="text-sm font-extrabold text-gray-900">Wards</p>
            <span className="text-xs text-gray-500">{wards.length} ward(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr style={{ background: '#f8faff' }}>
                  {['Ward', 'Type', 'Active', 'Beds', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {wards.map((w) => (
                  <tr key={w.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-3 py-3 font-extrabold text-gray-900">{w.name}</td>
                    <td className="px-3 py-3 text-xs font-bold text-gray-700">{wardLabel(w.type)}</td>
                    <td className="px-3 py-3 text-xs font-bold text-gray-700">{w.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-3 text-xs font-bold text-gray-700">{w.bedCount}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                        onClick={() => openWardEditor(w)}
                      >
                        <MdEdit className="w-4 h-4" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {!wards.length && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-400">
                      No wards found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
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
                <label className="block text-xs font-extrabold text-gray-600 mb-1.5">Bed code</label>
                <input
                  className={inputCls}
                  value={selectedBed.code || ''}
                  onChange={(e) => setSelectedBed((p) => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. ICU1 / G/W 4 / PVT 1"
                />
                <p className="text-[11px] text-gray-400 mt-1">Must be globally unique.</p>
              </div>
              <div>
                <label className="block text-xs font-extrabold text-gray-600 mb-1.5">Ward</label>
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
                <label className="block text-xs font-extrabold text-gray-600 mb-1.5">Status</label>
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
                  <label className="block text-xs font-extrabold text-gray-600 mb-1.5">Preview</label>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm">
                    {chip(selectedBed.status)}
                  </div>
                </div>
              </div>
            </div>

            <div className="pl-modalActions justify-end">
              <button
                type="button"
                className="pl-actionBtn"
                onClick={deleteBed}
                disabled={deletingBed || String(selectedBed.status || '').toUpperCase() === 'OCCUPIED'}
                title={String(selectedBed.status || '').toUpperCase() === 'OCCUPIED' ? 'Cannot delete occupied bed' : 'Delete bed'}
                style={{ color: '#b91c1c' }}
              >
                <MdDelete className="w-4 h-4" /> {deletingBed ? 'Deleting…' : 'Delete'}
              </button>
              <button type="button" className="pl-actionBtn" onClick={() => setBedModalOpen(false)}>
                <MdClose className="w-4 h-4" /> Cancel
              </button>
              <button type="button" className="pl-actionBtn" onClick={saveBed} disabled={savingBed}>
                <MdSave className="w-4 h-4" /> {savingBed ? 'Saving…' : 'Save'}
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
              <label className="block text-xs font-extrabold text-gray-600 mb-1.5">Ward</label>
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
              <label className="block text-xs font-extrabold text-gray-600 mb-1.5">Bed code</label>
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
          <div className="pl-modalActions justify-end">
            <button type="button" className="pl-actionBtn" onClick={() => setAddBedOpen(false)}>
              <MdClose className="w-4 h-4" /> Cancel
            </button>
            <button type="button" className="pl-actionBtn" onClick={createBed} disabled={creatingBed || !newBed.wardId || !newBed.code.trim()}>
              <MdAdd className="w-4 h-4" /> {creatingBed ? 'Creating…' : 'Create bed'}
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
                <label className="block text-xs font-extrabold text-gray-600 mb-1.5">Name</label>
                <input
                  className={inputCls}
                  value={editingWard.name || ''}
                  onChange={(e) => setEditingWard((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-gray-600 mb-1.5">Type</label>
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
                <label className="block text-xs font-extrabold text-gray-600 mb-1.5">Active</label>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={Boolean(editingWard.isActive)}
                    onChange={(e) => setEditingWard((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Ward is active
                </label>
                <p className="text-[11px] text-gray-400 mt-1">
                  Inactive wards are hidden for receptionist workflows (beds list will be filtered there).
                </p>
              </div>
            </div>

            <div className="pl-modalActions justify-end">
              <button type="button" className="pl-actionBtn" onClick={() => setWardModalOpen(false)}>
                <MdClose className="w-4 h-4" /> Cancel
              </button>
              <button type="button" className="pl-actionBtn" onClick={saveWard} disabled={savingWard || !editingWard.name?.trim()}>
                <MdSave className="w-4 h-4" /> {savingWard ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

