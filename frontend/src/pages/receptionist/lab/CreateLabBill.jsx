import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdAdd, MdClose, MdPerson, MdSave, MdScience, MdSearch } from 'react-icons/md';
import api from '../../../utils/api';
import { LAB_TEST_CATEGORIES } from '../../../constants/labTestCategories';
import { printLabBillSlip } from '../../../utils/printLabBillSlip';
import {
  isAyushmanSponsor,
  ayushmanFormDefaults,
  AYUSHMAN_BILLING_NOTICE,
  AYUSHMAN_PAYMENT_LABEL,
} from '../../../utils/ayushmanBilling';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const selectCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

function money(n) {
  return `₹${Math.max(0, Number(n || 0)).toLocaleString('en-IN')}`;
}

function newTestRow(category = '') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: category || '',
    testId: null,
    name: '',
    amount: '',
    query: '',
    sugOpen: false,
    sugIndex: 0,
  };
}

function testsForCategory(catalogTests, category) {
  if (!category) return [];
  return catalogTests.filter((t) => t.category === category);
}

function filterTestsForRow(tests, query, excludeIds) {
  const q = String(query || '').trim().toLowerCase();
  const pool = tests.filter((t) => !excludeIds.has(t.id));
  if (!q) return pool.slice(0, 12);
  return pool.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 12);
}

function rowCategory(row, activeCategory) {
  return row.category || activeCategory || '';
}

export default function CreateLabBill() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [catalog, setCatalog] = useState({ categories: LAB_TEST_CATEGORIES, tests: [] });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [testRows, setTestRows] = useState([newTestRow()]);
  const blurTimers = useRef({});

  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categoriesWithTests = useMemo(() => {
    const counts = new Map();
    catalog.tests.forEach((t) => {
      if (t.category) counts.set(t.category, (counts.get(t.category) || 0) + 1);
    });
    const ordered = catalog.categories.length ? catalog.categories : LAB_TEST_CATEGORIES;
    return ordered.filter((c) => counts.get(c) > 0);
  }, [catalog.categories, catalog.tests]);

  const filledTests = useMemo(
    () =>
      testRows
        .filter((r) => r.testId)
        .map((r) => ({
          testId: r.testId,
          name: r.name.trim(),
          amount: r.amount === '' || r.amount == null ? null : Number(r.amount),
        })),
    [testRows],
  );

  const computedTotal = useMemo(() => {
    return filledTests.reduce((s, t) => {
      if (t.amount == null || !Number.isFinite(t.amount)) return s;
      return s + Math.max(0, t.amount);
    }, 0);
  }, [filledTests]);

  useEffect(() => {
    if (selectedPatient?.isAyushman) {
      setPaidAmount('');
      return;
    }
    if (computedTotal > 0) setPaidAmount(String(computedTotal));
    else setPaidAmount('');
  }, [computedTotal, selectedPatient?.isAyushman]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await api.get('/lab/tests', { params: { forBilling: 1 } });
      const tests = Array.isArray(res.data?.tests) ? res.data.tests : [];
      const categories = Array.isArray(res.data?.categories) ? res.data.categories : LAB_TEST_CATEGORIES;
      setCatalog({ categories, tests });
    } catch {
      setCatalog({ categories: LAB_TEST_CATEGORIES, tests: [] });
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/doctors/lookup');
        const list = Array.isArray(res.data?.doctors) ? res.data.doctors : Array.isArray(res.data) ? res.data : [];
        setDoctors(list);
      } catch {
        setDoctors([]);
      }
    })();
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/receptionist/patients/search', { params: { q } });
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (!cancelled) setSuggestions(items.slice(0, 8));
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery]);

  const selectPatient = async (p) => {
    setError('');
    let row = {
      patientId: p.patientId || null,
      uhid: p.uhid,
      name: p.name,
      mobile: p.mobile || p.phone,
      sponsor: p.sponsor || '',
      isAyushman: isAyushmanSponsor(p.sponsor),
    };
    if (row.uhid) {
      try {
        const res = await api.get(`/receptionist/patients/${encodeURIComponent(row.uhid)}/details`);
        const d = res.data || {};
        row = {
          ...row,
          patientId: d.id || row.patientId,
          sponsor: d.sponsor || row.sponsor,
          isAyushman: d.isAyushman === true || isAyushmanSponsor(d.sponsor),
        };
      } catch {
        /* keep search row */
      }
    }
    setSelectedPatient(row);
    setSearchQuery(`${row.name || ''} · ${row.uhid || ''}`.trim());
    setSearchOpen(false);
    if (row.isAyushman) {
      const d = ayushmanFormDefaults();
      setPaymentMode(d.paymentMode);
      setPaidAmount('');
    } else {
      setPaymentMode('Cash');
      setPaidAmount('');
    }
  };

  /** Top category picker — does NOT clear existing billed lines; sets default for empty rows + new rows */
  const onActiveCategoryChange = (cat) => {
    setActiveCategory(cat);
    setError('');
    setTestRows((prev) => {
      const mapped = prev.map((r) => {
        if (r.testId) return r;
        return { ...r, category: cat };
      });
      const last = mapped[mapped.length - 1];
      if (last?.testId) return [...mapped, newTestRow(cat)];
      return mapped;
    });
  };

  const onRowCategoryChange = (rowId, cat) => {
    setActiveCategory(cat);
    setTestRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              category: cat,
              testId: null,
              name: '',
              query: '',
              amount: '',
              sugOpen: false,
              sugIndex: 0,
            }
          : r,
      ),
    );
  };

  const usedTestIds = useCallback(
    (exceptRowId) => {
      const ids = new Set();
      testRows.forEach((r) => {
        if (r.id !== exceptRowId && r.testId) ids.add(r.testId);
      });
      return ids;
    },
    [testRows],
  );

  const pickTest = (rowId, test) => {
    const cat = test.category || activeCategory;
    setTestRows((prev) => {
      const updated = prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              category: cat,
              testId: test.id,
              name: test.name,
              query: test.name,
              amount: String(test.price ?? 0),
              sugOpen: false,
              sugIndex: 0,
            }
          : r,
      );
      const idx = updated.findIndex((r) => r.id === rowId);
      const isLast = idx === updated.length - 1;
      if (isLast && test.id) return [...updated, newTestRow(cat || activeCategory)];
      return updated;
    });
    if (cat) setActiveCategory(cat);
    setError('');
  };

  const onTestQueryChange = (rowId, value) => {
    setTestRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              query: value,
              name: value,
              testId: null,
              amount: '',
              sugOpen: true,
              sugIndex: 0,
            }
          : r,
      ),
    );
  };

  const onTestKeyDown = (rowId, e) => {
    const row = testRows.find((r) => r.id === rowId);
    if (!row) return;
    const cat = rowCategory(row, activeCategory);
    if (!cat) return;
    const exclude = usedTestIds(rowId);
    const sug = filterTestsForRow(testsForCategory(catalog.tests, cat), row.query, exclude);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!sug.length) return;
      setTestRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, sugOpen: true, sugIndex: Math.min((r.sugIndex || 0) + 1, sug.length - 1) }
            : r,
        ),
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTestRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, sugOpen: true, sugIndex: Math.max(0, (r.sugIndex || 0) - 1) } : r)),
      );
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!sug.length) return;
      const pick = sug[row.sugIndex || 0] || sug[0];
      pickTest(rowId, pick);
      return;
    }
    if (e.key === 'Escape') {
      setTestRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, sugOpen: false } : r)));
    }
  };

  const scheduleBlurClose = (rowId) => {
    if (blurTimers.current[rowId]) clearTimeout(blurTimers.current[rowId]);
    blurTimers.current[rowId] = setTimeout(() => {
      setTestRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, sugOpen: false } : r)));
    }, 160);
  };

  const addTestRow = () => setTestRows((prev) => [...prev, newTestRow(activeCategory)]);

  const removeTestRow = (id) => {
    setTestRows((prev) => (prev.length <= 1 ? [newTestRow()] : prev.filter((r) => r.id !== id)));
  };

  const resetForm = (keepPatient = true) => {
    setActiveCategory('');
    setTestRows([newTestRow()]);
    setNotes('');
    setError('');
    if (!keepPatient) {
      setSelectedPatient(null);
      setSearchQuery('');
    }
    if (!selectedPatient?.isAyushman || !keepPatient) {
      setPaidAmount('');
      setPaymentMode('Cash');
    } else {
      setPaidAmount('');
      setPaymentMode(AYUSHMAN_PAYMENT_LABEL);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedPatient?.uhid) {
      setError('Pehle patient select karein');
      return;
    }
    if (!filledTests.length) {
      setError('Kam se kam ek test list se select karein');
      return;
    }
    const missingAmount = filledTests.some((t) => t.amount == null || !Number.isFinite(t.amount) || t.amount < 0);
    if (missingAmount) {
      setError('Har selected test ka price load hona chahiye (admin catalog)');
      return;
    }
    if (computedTotal <= 0 && !selectedPatient.isAyushman) {
      setError('Total amount 0 se zyada honi chahiye');
      return;
    }

    setSubmitting(true);
    try {
      const testsPayload = filledTests.map((t) => ({
        testId: t.testId,
        name: t.name,
        price: Math.trunc(t.amount),
      }));

      const paidResolved = selectedPatient.isAyushman
        ? computedTotal
        : paidAmount === '' || paidAmount == null
          ? computedTotal
          : Math.min(Math.max(0, Math.trunc(Number(paidAmount))), computedTotal);

      const payload = {
        uhid: selectedPatient.uhid,
        ...(selectedPatient.patientId ? { patientId: selectedPatient.patientId } : {}),
        doctorId: doctorId || undefined,
        tests: testsPayload,
        notes: notes.trim() || undefined,
        paymentMode: selectedPatient.isAyushman ? AYUSHMAN_PAYMENT_LABEL : paymentMode,
        paidAmount: paidResolved,
      };

      const res = await api.post('/lab/receptionist/bills', payload);
      const data = res.data || {};
      const bill = data.bill;
      const order = data.order;
      const tests = data.tests || testsPayload;

      const billTotal = bill?.totalAmount ?? computedTotal;
      const billPaid =
        bill?.paidAmount != null && bill?.paidAmount !== ''
          ? Math.min(billTotal, Math.max(0, Math.round(Number(bill.paidAmount))))
          : paidResolved;

      const isAyushmanBill = data.isAyushman ?? selectedPatient.isAyushman;

      try {
        printLabBillSlip({
          patientName: selectedPatient.name,
          patientUhid: selectedPatient.uhid,
          sponsor: data.sponsor || selectedPatient.sponsor || (isAyushmanBill ? 'AYUSHMAN' : ''),
          isAyushman: isAyushmanBill,
          doctorName: data.doctorName || doctors.find((d) => d.id === doctorId)?.name || '',
          tests,
          totalAmount: billTotal,
          grossTotalAmount: billTotal,
          mode: 'issued',
          billNumber: bill?.billNumber,
          orderNumber: order?.orderNumber,
          paidAmount: billPaid,
          paymentStatus: isAyushmanBill ? 'PAID' : bill?.status,
        });
      } catch {
        /* bill saved — print optional */
      }

      navigate('/dashboard/reception/lab/bills', {
        state: {
          flash: `Lab bill ${bill?.billNumber || ''} created for ${selectedPatient.name}`,
        },
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not create lab bill');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA]">
      <div className="w-full px-4 sm:px-6 py-4 sm:py-5 max-w-4xl mx-auto space-y-4">
        <div className="rounded-2xl border p-4 sm:p-5 bg-white" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <MdScience className="text-cyan-600" /> Create lab bill
          </h1>
          <p className="text-xs text-gray-500 mt-1">Multiple categories — purane tests rahenge, nayi category sirf agli line ke liye</p>
        </div>

        {error ? (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-red-50 text-red-800 border border-red-100">{error}</div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border p-4 bg-white space-y-3" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <p className="text-sm font-extrabold text-gray-900">1 · Patient</p>
            <div className="relative">
              <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                className={`${inputCls} pl-10`}
                placeholder="Search name, UHID, mobile…"
              />
              {searchOpen && searchQuery.trim().length >= 2 ? (
                <div
                  className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-56 overflow-auto"
                  style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                >
                  {searching ? (
                    <p className="px-4 py-3 text-xs text-gray-500">Searching…</p>
                  ) : suggestions.length ? (
                    suggestions.map((p) => (
                      <button
                        key={p.uhid}
                        type="button"
                        onClick={() => selectPatient(p)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-50 last:border-0 flex gap-3 items-center"
                      >
                        <MdPerson className="text-blue-600 shrink-0" />
                        <span>
                          <span className="block text-sm font-bold text-gray-900">{p.name}</span>
                          <span className="block text-xs font-mono text-gray-500">{p.uhid}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-3 text-xs text-gray-500">No patients found</p>
                  )}
                </div>
              ) : null}
            </div>
            {selectedPatient ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-sm">
                <p className="font-extrabold text-gray-900">{selectedPatient.name}</p>
                <p className="text-xs font-mono text-blue-700">{selectedPatient.uhid}</p>
                {selectedPatient.isAyushman ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-800 rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-1">
                    {AYUSHMAN_BILLING_NOTICE}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border p-4 bg-white space-y-3" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-extrabold text-gray-900">2 · Lab tests</p>
              <button
                type="button"
                onClick={addTestRow}
                disabled={catalogLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold border bg-white hover:bg-slate-50 disabled:opacity-50"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              >
                <MdAdd /> Add row
              </button>
            </div>

            <label className="block text-xs font-semibold text-gray-600">
              Category for next test (purani lines safe rahengi)
              <select
                value={activeCategory}
                onChange={(e) => onActiveCategoryChange(e.target.value)}
                className={`${selectCls} mt-1`}
                disabled={catalogLoading}
              >
                <option value="">{catalogLoading ? 'Loading catalog…' : 'Select category e.g. Hematology'}</option>
                {(categoriesWithTests.length ? categoriesWithTests : catalog.categories).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {catalogLoading ? (
              <p className="text-xs text-gray-500">Catalog load ho raha hai…</p>
            ) : (
              <>
                <div className="hidden sm:grid grid-cols-[minmax(100px,130px)_1fr_100px_40px] gap-2 px-1 text-[10px] font-extrabold uppercase text-gray-500">
                  <span>Category</span>
                  <span>Test name</span>
                  <span className="text-right">Amount (₹)</span>
                  <span />
                </div>
                <ul className="space-y-2">
                  {testRows.map((row, idx) => {
                    const cat = rowCategory(row, activeCategory);
                    const catTests = testsForCategory(catalog.tests, cat);
                    const exclude = usedTestIds(row.id);
                    const rowSuggestions = filterTestsForRow(catTests, row.query, exclude);
                    const showSug = row.sugOpen && rowSuggestions.length > 0 && !row.testId && cat;

                    return (
                      <li
                        key={row.id}
                        className="grid grid-cols-1 sm:grid-cols-[minmax(100px,130px)_1fr_100px_40px] gap-2 items-start rounded-xl sm:rounded-none border sm:border-0 border-gray-100 p-2 sm:p-0"
                      >
                        <span className="text-xs font-bold text-gray-400 sm:hidden">{idx + 1}.</span>
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 sm:hidden">Category</span>
                          <select
                            value={cat}
                            onChange={(e) => onRowCategoryChange(row.id, e.target.value)}
                            disabled={Boolean(row.testId)}
                            className={`${selectCls} text-xs mt-0.5 sm:mt-0 ${row.testId ? 'bg-gray-100' : ''}`}
                          >
                            <option value="">Select…</option>
                            {(categoriesWithTests.length ? categoriesWithTests : catalog.categories).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="relative">
                          <span className="text-[10px] font-bold text-gray-500 sm:hidden">Test</span>
                          <input
                            value={row.testId ? row.name : row.query}
                            onChange={(e) => onTestQueryChange(row.id, e.target.value)}
                            onFocus={() => {
                              if (blurTimers.current[row.id]) clearTimeout(blurTimers.current[row.id]);
                              if (!row.testId && cat) setActiveCategory(cat);
                              setTestRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, category: cat || r.category, sugOpen: true, sugIndex: 0 } : r,
                                ),
                              );
                            }}
                            onBlur={() => scheduleBlurClose(row.id)}
                            onKeyDown={(e) => onTestKeyDown(row.id, e)}
                            className={`${inputCls} mt-0.5 sm:mt-0`}
                            placeholder={cat ? 'Type test e.g. CB' : 'Pehle category select karein'}
                            autoComplete="off"
                            disabled={!cat && !row.testId}
                          />
                          {!cat && !row.testId ? (
                            <p className="text-[10px] text-amber-700 mt-1">Category select karein</p>
                          ) : cat && !row.testId && catTests.length === 0 ? (
                            <p className="text-[10px] text-amber-700 mt-1">Is category me test nahi</p>
                          ) : null}
                          {showSug ? (
                            <div
                              className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-48 overflow-auto"
                              style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                            >
                              {rowSuggestions.map((t, si) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => pickTest(row.id, t)}
                                  className={`w-full px-3 py-2.5 text-left border-b border-gray-50 last:border-0 ${
                                    si === (row.sugIndex || 0) ? 'bg-blue-50' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="block text-sm font-bold text-gray-900">{t.name}</span>
                                  <span className="block text-xs text-gray-500 tabular-nums">{money(t.price)}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 sm:hidden">Amount</span>
                          <input
                            value={row.amount}
                            readOnly={Boolean(row.testId)}
                            onChange={(e) => {
                              if (row.testId) return;
                              setTestRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r)),
                              );
                            }}
                            className={`${inputCls} text-right mt-0.5 sm:mt-0 ${row.testId ? 'bg-gray-100 text-gray-700' : ''}`}
                            inputMode="decimal"
                            placeholder="₹"
                            tabIndex={row.testId ? -1 : 0}
                          />
                        </div>
                        {testRows.length > 1 || row.testId ? (
                          <button
                            type="button"
                            onClick={() => removeTestRow(row.id)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 justify-self-center"
                            aria-label="Remove"
                          >
                            <MdClose />
                          </button>
                        ) : (
                          <span className="w-10" />
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-gray-100">
                  <span className="text-sm font-extrabold text-gray-700">
                    Total
                    {filledTests.length > 0 ? (
                      <span className="block text-[10px] font-semibold text-gray-500 mt-0.5">
                        {[...new Set(testRows.filter((r) => r.testId).map((r) => r.category).filter(Boolean))].join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-lg font-extrabold text-gray-900 tabular-nums">{money(computedTotal)}</span>
                </div>
              </>
            )}
          </div>

          {!selectedPatient?.isAyushman ? (
            <div className="rounded-2xl border p-4 bg-white space-y-3" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-extrabold text-gray-900">3 · Payment</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-gray-600">
                  Payment mode
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={`${selectCls} mt-1`}>
                    {['Cash', 'UPI', 'Card'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Paid now (₹)
                  <input
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className={`${inputCls} mt-1`}
                    inputMode="decimal"
                    placeholder="Poora total = Paid"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-gray-600">
                Consulting doctor (optional)
                <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={`${selectCls} mt-1`}>
                  <option value="">Auto</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Notes
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} mt-1`} placeholder="Optional" />
              </label>
            </div>
          ) : selectedPatient ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
              <p className="font-extrabold">{AYUSHMAN_PAYMENT_LABEL}</p>
              <p className="text-xs mt-1">Test amounts normal; bill slip par {AYUSHMAN_PAYMENT_LABEL} — patient se due nahi.</p>
              <label className="block text-xs font-semibold text-gray-600 mt-3">
                Notes (optional)
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} mt-1`} />
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 justify-end">
            <Link
              to="/dashboard/reception/lab/bills"
              className="px-4 py-2.5 rounded-xl text-sm font-extrabold border bg-white text-gray-700"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            >
              All lab billing
            </Link>
            <button
              type="button"
              onClick={() => resetForm(true)}
              className="px-4 py-2.5 rounded-xl text-sm font-extrabold border bg-white"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            >
              Clear tests
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedPatient || filledTests.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold text-white disabled:opacity-50"
              style={{ background: '#00AEEF' }}
            >
              <MdSave /> {submitting ? 'Saving…' : 'Generate lab bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
