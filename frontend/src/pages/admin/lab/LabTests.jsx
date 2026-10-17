import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdAdd, MdClose, MdDelete, MdEdit } from 'react-icons/md';
import api from '../../../utils/api';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] transition';

function StatusChip({ active }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
        active
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
          : 'bg-slate-50 text-slate-700 ring-slate-200'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function Modal({ open, title, onClose, children, maxWidth = 480 }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
        style={{ maxWidth }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header
          className="shrink-0 px-5 sm:px-6 py-4 text-white"
          style={{ background: 'linear-gradient(135deg, #001B48 0%, #0077B6 100%)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-white truncate">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
              aria-label="Close"
            >
              <MdClose className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 bg-[#f8fafc]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function LabTests() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    price: '',
    isActive: true,
  });

  const apiErrorMessage = (e, fallback) => {
    const data = e?.response?.data;
    if (data?.message) return data.message;
    if (Array.isArray(data?.errors) && data.errors[0]?.message) return data.errors[0].message;
    if (e?.message) return e.message;
    return fallback;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const testsRes = await api.get('/lab/tests', { params: { admin: 1 } });
      setTests(Array.isArray(testsRes.data?.tests) ? testsRes.data.tests : []);
    } catch (e) {
      setTests([]);
      setMsg(apiErrorMessage(e, 'Could not load tests'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', price: '', isActive: true });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      price: row.price != null ? String(row.price) : '',
      isActive: Boolean(row.isActive),
    });
    setModalOpen(true);
  };

  const save = async () => {
    const name = String(form.name || '').trim();
    const price = parseFloat(String(form.price));
    if (!name) { setMsg('Name is required'); return; }
    if (!Number.isFinite(price) || price < 0) { setMsg('Valid price is required'); return; }
    setSaving(true);
    setMsg('');
    try {
      if (editingId == null) {
        await api.post('/lab/tests', { name, price, isActive: form.isActive });
      } else {
        await api.put(`/lab/tests/${editingId}`, { name, price, isActive: form.isActive });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const name = row?.name || 'this test';
    if (!window.confirm(`Delete "${name}" permanently?`)) return;
    setDeletingId(row.id);
    setMsg('');
    try {
      await api.delete(`/lab/tests/${row.id}`);
      await load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Lab Test Catalog</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Manage test names and pricing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#00B4D8] active:bg-[#001B48] transition cursor-pointer shadow-sm"
            >
              <MdAdd className="w-5 h-5" />
              Add Test
            </button>
          </div>
        </div>

        {msg ? (
          <div className="rounded-2xl bg-rose-50 text-rose-800 text-sm border border-rose-100 px-4 py-3 font-semibold">
            {msg}
          </div>
        ) : null}

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-gray-500 tabular-nums">
              {loading ? '' : `${tests.length} test${tests.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#001B48] text-left text-xs font-semibold uppercase tracking-wide text-white border-b border-[#001B48]">
                  <th className="px-4 py-3 whitespace-nowrap">Test Name</th>
                  <th className="px-4 py-3 whitespace-nowrap">Price</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 font-semibold">
                      Loading…
                    </td>
                  </tr>
                ) : tests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 font-semibold">
                      No tests found
                    </td>
                  </tr>
                ) : (
                  tests.map((t) => (
                    <tr key={t.id} className="hover:bg-[#D6E8EE] transition">
                      <td className="px-4 py-3 font-semibold text-gray-900">{t.name}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800">₹{Number(t.price).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <StatusChip active={t.isActive} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border border-[#0077B6] text-[#0077B6] hover:bg-[#90E0EF]/15 active:bg-[#001B48]/5 transition cursor-pointer"
                          >
                            <MdEdit className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(t)}
                            disabled={deletingId != null}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                          >
                            <MdDelete className="w-3.5 h-3.5" />
                            {deletingId === t.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editingId == null ? 'Add Test' : 'Edit Test'}
        onClose={() => !saving && setModalOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Test Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Complete Blood Count (CBC)"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Price (₹)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className={inputCls}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-[#0077B6] focus:ring-[#0077B6]/25 cursor-pointer"
              />
              Test is active for billing
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => !saving && setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#00B4D8] active:bg-[#001B48] transition cursor-pointer shadow-sm disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Test'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}