import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdAdd, MdCategory, MdClose, MdDelete, MdEdit } from 'react-icons/md';
import api from '../../../utils/api';
import { LAB_TEST_CATEGORIES } from '../../../constants/labTestCategories';

const inputCls =
  'w-full h-10 px-3 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';
const borderStyle = { borderColor: 'rgba(0,0,0,0.12)' };

function StatusChip({ active }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-extrabold"
      style={{
        background: active ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.2)',
        color: active ? '#14532d' : '#475569',
      }}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function LabTests() {
  const [tests, setTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [catSaving, setCatSaving] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catEditName, setCatEditName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'Hematology',
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

  const loadCategories = useCallback(async () => {
    try {
      const res = await api.get('/lab/categories');
      const list = Array.isArray(res.data?.categories) ? res.data.categories : [];
      setCategories(list);
      return list;
    } catch (e) {
      setMsg(apiErrorMessage(e, 'Could not load categories'));
      const fallback = LAB_TEST_CATEGORIES.map((name) => ({ name, testCount: 0 }));
      setCategories(fallback);
      return fallback;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const testsRes = await api.get('/lab/tests', { params: { admin: 1 } });
      setTests(Array.isArray(testsRes.data?.tests) ? testsRes.data.tests : []);
      const names = Array.isArray(testsRes.data?.categories) ? testsRes.data.categories : [];
      if (names.length) {
        setCategories(names.map((name) => ({ name, testCount: 0 })));
        setForm((f) => ({
          ...f,
          category: names.includes(f.category) ? f.category : names[0] || 'Hematology',
        }));
      }
    } catch (e) {
      setTests([]);
      setMsg(apiErrorMessage(e, 'Could not load tests'));
    }
    try {
      const cats = await loadCategories();
      if (cats?.length) {
        setForm((f) => ({
          ...f,
          category: cats.some((c) => c.name === f.category) ? f.category : cats[0]?.name || f.category,
        }));
      }
    } catch {
      /* loadCategories sets its own message */
    } finally {
      setLoading(false);
    }
  }, [loadCategories]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryNames = categories.length
    ? categories.map((c) => c.name)
    : LAB_TEST_CATEGORIES;

  const normalizedCategoryFilter = String(categoryFilter || '').trim().toLowerCase();
  const filteredTests = normalizedCategoryFilter
    ? tests.filter((t) => String(t?.category || '').trim().toLowerCase() === normalizedCategoryFilter)
    : tests;

  const openAdd = () => {
    setEditingId(null);
    setForm({
      name: '',
      category: categoryNames[0] || 'Hematology',
      price: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      category: row.category || categoryNames[0] || 'Other',
      price: row.price != null ? String(row.price) : '',
      isActive: Boolean(row.isActive),
    });
    setModalOpen(true);
  };

  const save = async () => {
    const name = String(form.name || '').trim();
    const price = parseFloat(String(form.price));
    if (!name) {
      setMsg('Name is required');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setMsg('Valid price is required');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      if (editingId == null) {
        await api.post('/lab/tests', {
          name,
          category: form.category,
          price,
          isActive: form.isActive,
        });
      } else {
        await api.put(`/lab/tests/${editingId}`, {
          name,
          category: form.category,
          price,
          isActive: form.isActive,
        });
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

  const startEditCategory = (row) => {
    setEditingCat(row.name);
    setCatEditName(row.name);
  };

  const saveCategoryRename = async () => {
    const to = String(catEditName || '').trim();
    if (!editingCat || !to) return;
    if (to === editingCat) {
      setEditingCat(null);
      return;
    }
    setCatSaving(true);
    setMsg('');
    try {
      const res = await api.put('/lab/categories/rename', { from: editingCat, to });
      const list = Array.isArray(res.data?.categories) ? res.data.categories : [];
      if (list.length) setCategories(list);
      setEditingCat(null);
      await load();
    } catch (e) {
      setMsg(apiErrorMessage(e, 'Could not rename category'));
    } finally {
      setCatSaving(false);
    }
  };

  const addCategory = async () => {
    const name = String(newCatName || '').trim();
    if (!name) return;
    setCatSaving(true);
    setMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post('/lab/categories', { name });
      const list = Array.isArray(res.data?.categories) ? res.data.categories : [];
      if (list.length) setCategories(list);
      else await loadCategories();
      setNewCatName('');
      setSuccessMsg(res.data?.message || `Category "${name}" added`);
    } catch (e) {
      setMsg(apiErrorMessage(e, 'Could not add category'));
    } finally {
      setCatSaving(false);
    }
  };

  const removeCategory = async (row) => {
    if (row.testCount > 0) {
      setMsg('Pehle is category ke tests delete ya move karein');
      return;
    }
    if (!window.confirm(`Remove category "${row.name}" from list?`)) return;
    setCatSaving(true);
    setMsg('');
    try {
      const res = await api.delete('/lab/categories', { data: { name: row.name } });
      const list = Array.isArray(res.data?.categories) ? res.data.categories : [];
      if (list.length) setCategories(list);
      else await loadCategories();
    } catch (e) {
      setMsg(apiErrorMessage(e, 'Could not remove category'));
    } finally {
      setCatSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA]">
      <div className="w-full px-4 sm:px-6 py-4 sm:py-5 max-w-5xl mx-auto space-y-4">
        <div
          className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div>
            <h1 className="text-lg font-extrabold text-gray-900">Lab Test Catalog</h1>
            <p className="text-xs text-gray-500 mt-1">Tests aur categories dono yahan manage karein</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCatModalOpen(true);
                setEditingCat(null);
                setMsg('');
                setSuccessMsg('');
                loadCategories();
              }}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-extrabold border bg-white"
              style={borderStyle}
            >
              <MdCategory className="text-lg" />
              Manage categories
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-extrabold text-white shadow-sm"
              style={{ background: '#00AEEF' }}
            >
              <MdAdd className="text-xl" />
              Add Test
            </button>
          </div>
        </div>

        {msg ? (
          <div
            className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#991b1b' }}
          >
            {msg}
          </div>
        ) : null}
        {successMsg ? (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
            {successMsg}
          </div>
        ) : null}

        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="max-w-sm">
              <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-gray-600">Category filter</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={inputCls}
                style={borderStyle}
              >
                <option value="">All categories</option>
                {categoryNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs font-semibold text-gray-500 tabular-nums">
              Showing <span className="text-gray-900">{filteredTests.length}</span> / {tests.length}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500 border-b bg-slate-50/80"
                  style={{ borderColor: 'rgba(0,0,0,0.06)' }}
                >
                  <th className="px-4 py-3">Test Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-40">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-semibold">
                      Loading…
                    </td>
                  </tr>
                ) : filteredTests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-semibold">
                      No tests found
                    </td>
                  </tr>
                ) : (
                  filteredTests.map((t) => (
                    <tr key={t.id} className="border-t border-gray-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{t.name}</td>
                      <td className="px-4 py-3 text-gray-700">{t.category}</td>
                      <td className="px-4 py-3 font-mono text-gray-800">{Number(t.price).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <StatusChip active={t.isActive} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold border bg-white"
                            style={borderStyle}
                          >
                            <MdEdit />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(t)}
                            disabled={deletingId != null}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-extrabold border bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                            style={{ borderColor: 'rgba(239,68,68,0.35)' }}
                          >
                            <MdDelete />
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

      {catModalOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
                onClick={() => !catSaving && setCatModalOpen(false)}
              />
              <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Manage categories</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Rename se us category ke saare tests update ho jayenge</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => !catSaving && setCatModalOpen(false)}
                    className="p-2 rounded-xl border bg-white"
                    style={borderStyle}
                  >
                    <MdClose className="text-lg" />
                  </button>
                </div>
                <div className="p-4 border-b border-gray-100 flex gap-2">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="New category name"
                    className={`flex-1 ${inputCls}`}
                    style={borderStyle}
                  />
                  <button
                    type="button"
                    onClick={addCategory}
                    disabled={catSaving || !newCatName.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-extrabold text-white disabled:opacity-50 shrink-0"
                    style={{ background: '#00AEEF' }}
                  >
                    Add
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-extrabold uppercase text-gray-500 bg-slate-50 border-b">
                        <th className="px-4 py-2">Category</th>
                        <th className="px-4 py-2">Tests</th>
                        <th className="px-4 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((c) => (
                        <tr key={c.name} className="border-t border-gray-100">
                          <td className="px-4 py-2.5">
                            {editingCat === c.name ? (
                              <input
                                value={catEditName}
                                onChange={(e) => setCatEditName(e.target.value)}
                                className={`${inputCls} h-9`}
                                style={borderStyle}
                                autoFocus
                              />
                            ) : (
                              <span className="font-semibold text-gray-900">{c.name}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 tabular-nums">{c.testCount ?? 0}</td>
                          <td className="px-4 py-2.5 text-right">
                            {editingCat === c.name ? (
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingCat(null)}
                                  className="px-2 py-1 text-xs font-bold border rounded-lg bg-white"
                                  style={borderStyle}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={saveCategoryRename}
                                  disabled={catSaving}
                                  className="px-2 py-1 text-xs font-bold text-white rounded-lg disabled:opacity-50"
                                  style={{ background: '#00AEEF' }}
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEditCategory(c)}
                                  className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-extrabold border rounded-lg bg-white"
                                  style={borderStyle}
                                >
                                  <MdEdit /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeCategory(c)}
                                  disabled={catSaving || (c.testCount ?? 0) > 0}
                                  title={(c.testCount ?? 0) > 0 ? 'Pehle tests hataein' : 'Remove'}
                                  className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-extrabold border rounded-lg bg-white text-red-700 disabled:opacity-40"
                                  style={{ borderColor: 'rgba(239,68,68,0.35)' }}
                                >
                                  <MdDelete />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {modalOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
                onClick={() => !saving && setModalOpen(false)}
              />
              <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-gray-900">{editingId == null ? 'Add test' : 'Edit test'}</p>
                  <button
                    type="button"
                    onClick={() => !saving && setModalOpen(false)}
                    className="p-2 rounded-xl border bg-white"
                    style={borderStyle}
                  >
                    <MdClose className="text-lg" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">Test Name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className={`mt-1 ${inputCls}`}
                      style={borderStyle}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className={`mt-1 ${inputCls}`}
                      style={borderStyle}
                    >
                      {categoryNames.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">Price</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      className={`mt-1 ${inputCls}`}
                      style={borderStyle}
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-[#00AEEF]"
                    />
                    <span className="text-sm font-semibold text-gray-800">Active</span>
                  </label>
                </div>
                <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !saving && setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-extrabold border bg-white"
                    style={borderStyle}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl text-sm font-extrabold text-white disabled:opacity-60"
                    style={{ background: '#00AEEF' }}
                  >
                    {saving ? 'Saving…' : 'Save Test'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
