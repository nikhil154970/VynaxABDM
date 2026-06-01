import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdFilterList, MdRefresh, MdSearch } from 'react-icons/md';
import '../patients/PatientList.css';
import api from '../../../utils/api';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

function formatDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleLabel(role) {
  const r = String(role || '').toUpperCase();
  if (!r) return '—';
  return r.replace(/_/g, ' ');
}

export default function TransferHistory() {
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);

  const [q, setQ] = useState('');
  const [fromWardId, setFromWardId] = useState('');
  const [toWardId, setToWardId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const wardOptions = useMemo(() => wards.map((w) => ({ id: w.id, name: w.name })), [wards]);

  const loadWards = useCallback(async () => {
    setLoadingWards(true);
    try {
      const res = await api.get('/receptionist/ipd/wards');
      const rows = Array.isArray(res?.data?.items) ? res.data.items : [];
      setWards(rows.map((w) => ({ id: w.id, name: w.name, type: w.type })));
    } catch {
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  }, []);

  const loadHistory = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/receptionist/ipd/transfers/history', {
          params: {
            q: q || undefined,
            fromWardId: fromWardId || undefined,
            toWardId: toWardId || undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            page: nextPage,
            limit,
          },
        });
        setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
        setTotal(Number(res?.data?.total) || 0);
        setTotalPages(Number(res?.data?.totalPages) || 1);
        setPage(Number(res?.data?.page) || nextPage);
      } catch (e) {
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        setError(e?.response?.data?.message || 'Failed to load transfer history.');
      } finally {
        setLoading(false);
      }
    },
    [q, fromWardId, toWardId, fromDate, toDate, page, limit],
  );

  useEffect(() => {
    loadWards();
  }, [loadWards]);

  useEffect(() => {
    loadHistory(1);
    // Manual refresh mode: do not auto-refetch on every keystroke; user clicks Search/Refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-gray-500">
            <MdFilterList className="w-4 h-4" />
            Search & filters
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4 relative">
              <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search: Name / UHID / IPD / Bed / Ward / Reason"
                className={`${inputCls} pl-9`}
              />
            </div>

            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              <select
                className="pl-select w-full"
                value={fromWardId}
                onChange={(e) => setFromWardId(e.target.value)}
                disabled={loadingWards}
              >
                <option value="">{loadingWards ? 'Loading wards…' : 'From ward (all)'}</option>
                {wardOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <select
                className="pl-select w-full"
                value={toWardId}
                onChange={(e) => setToWardId(e.target.value)}
                disabled={loadingWards}
              >
                <option value="">{loadingWards ? 'Loading wards…' : 'To ward (all)'}</option>
                {wardOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={inputCls}
                title="From date"
              />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} title="To date" />
            </div>

            <div className="lg:col-span-3 flex flex-wrap gap-2 lg:justify-end">
              <select
                className="pl-select"
                value={String(limit)}
                onChange={(e) => {
                  const v = Math.max(5, Math.min(200, Number(e.target.value) || 20));
                  setLimit(v);
                  setPage(1);
                }}
                style={{ minWidth: 140 }}
                title="Rows per page"
              >
                {[10, 20, 30, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => loadHistory(1)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-sm hover:shadow-md transition"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}
                disabled={loading}
              >
                <MdSearch className="w-4 h-4" />
                Search
              </button>
              <button
                type="button"
                onClick={() => loadHistory(page)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-60"
                disabled={loading}
                title="Refresh"
              >
                <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>
              <b className="text-gray-700">{total.toLocaleString('en-IN')}</b> transfer(s)
            </span>
            <span className="text-gray-400">
              Page <b className="text-gray-700">{page}</b> / {totalPages}
            </span>
          </div>

          {error ? <div className="pl-miniError">{error}</div> : null}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead>
                <tr className="sticky top-0 z-[1] shadow-sm" style={{ background: '#f8faff' }}>
                  {['When', 'Patient', 'UHID / IPD', 'From', 'To', 'Reason', 'By', 'Clinical'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-gray-400">
                      Loading transfer history…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-gray-500">
                      No transfer records found.
                    </td>
                  </tr>
                ) : (
                  items.map((t) => (
                    <tr key={t.id} className="hover:bg-blue-50/30 transition">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDateTime(t.createdAt)}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{t.patient?.name || '—'}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{t.patient?.mobile || '—'}</p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-bold text-blue-700">{t.patient?.uhid || '—'}</p>
                        <p className="font-mono text-[11px] text-gray-500">{t.ipdNumber || t.admissionId}</p>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        <span className="font-semibold">{t.from?.wardName || '—'}</span>
                        <span className="text-gray-400"> · </span>
                        <span className="font-mono font-semibold">{t.from?.bedCode || '—'}</span>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        <span className="font-semibold text-emerald-800">{t.to?.wardName || '—'}</span>
                        <span className="text-gray-400"> · </span>
                        <span className="font-mono font-semibold">{t.to?.bedCode || '—'}</span>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700 min-w-[220px]">
                        {t.reason ? (
                          <span className="inline-flex rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1 font-semibold text-gray-700">
                            {t.reason}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700">
                        {t.createdBy ? (
                          <>
                            <p className="font-semibold text-gray-900">{t.createdBy.name || t.createdBy.email}</p>
                            <p className="text-[11px] text-gray-500 uppercase font-extrabold tracking-wide">{roleLabel(t.createdBy.role)}</p>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700">
                        <p className="font-semibold">{t.doctorName || '—'}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {t.department || '—'} · {t.admissionStatus || '—'}
                        </p>
                        {t.nurseName ? <p className="text-[11px] text-gray-400">Nurse: {t.nurseName}</p> : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-gray-500">
              Showing <b className="text-gray-700">{items.length}</b> of <b className="text-gray-700">{total.toLocaleString('en-IN')}</b>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                disabled={!canPrev || loading}
                onClick={() => loadHistory(page - 1)}
              >
                Prev
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                disabled={!canNext || loading}
                onClick={() => loadHistory(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

