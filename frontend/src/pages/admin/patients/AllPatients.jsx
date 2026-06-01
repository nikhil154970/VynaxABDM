import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import Badge from '../../../components/Badge';
import Pagination from '../../../components/Pagination';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function AllPatients() {
  const navigate = useNavigate();
  const title = useMemo(() => 'All Patients', []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [qInput, setQInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const fetchPatients = useCallback(async (p, search) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/patients', {
        params: { page: p, pageSize, ...(search ? { q: search } : {}) },
      });
      setPatients(res.data.patients || []);
      setPagination({
        page: res.data.pagination?.page || p,
        totalPages: res.data.pagination?.totalPages || 1,
        total: res.data.pagination?.total ?? 0,
      });
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load patients');
      setPatients([]);
      setPagination({ page: 1, totalPages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchPatients(page, debouncedQ);
  }, [page, debouncedQ, fetchPatients]);

  const goHistory = (patientId) => {
    navigate(`/dashboard/admin/patients/history?patientId=${encodeURIComponent(patientId)}`);
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Search and review every registered patient across OPD, IPD, billing, and lab.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <label htmlFor="patient-search" className="sr-only">
              Search patients
            </label>
            <input
              id="patient-search"
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Name, UHID, mobile, reg. no."
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">Patient directory</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {pagination.total != null ? `${pagination.total} patient(s)` : ''}
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </p>
          </div>

          {error && (
            <div className="px-5 py-3 bg-rose-50 text-rose-700 text-sm border-b border-rose-100">{error}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">UHID / Reg</th>
                  <th className="text-left font-semibold px-5 py-3">Name</th>
                  <th className="text-left font-semibold px-5 py-3">Mobile</th>
                  <th className="text-left font-semibold px-5 py-3">Age / Gender</th>
                  <th className="text-left font-semibold px-5 py-3">Last visit</th>
                  <th className="text-left font-semibold px-5 py-3">Activity</th>
                  <th className="text-right font-semibold px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-5 py-8 text-gray-400" colSpan={7}>
                      Loading patients…
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-gray-400" colSpan={7}>
                      No patients match your search.
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs text-gray-800">{p.uhid || '—'}</div>
                        {p.registrationNumber && (
                          <div className="text-[11px] text-gray-400 mt-0.5">{p.registrationNumber}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-900">{p.name || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{p.mobile || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {[p.age != null ? `${p.age} yrs` : null, p.gender].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">
                        {p.lastVisit ? (
                          <>
                            <div>{formatDate(p.lastVisit.visitDate)}</div>
                            <Badge variant="gray" className="mt-1">
                              {p.lastVisit.visitType} · {p.lastVisit.status}
                            </Badge>
                          </>
                        ) : (
                          <span className="text-gray-400">No visits yet</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="blue">V {p.counts?.visits ?? 0}</Badge>
                          <Badge variant="purple">A {p.counts?.appointments ?? 0}</Badge>
                          <Badge variant="amber">I {p.counts?.admissions ?? 0}</Badge>
                          <Badge variant="green">B {p.counts?.bills ?? 0}</Badge>
                          <Badge variant="gray">L {p.counts?.labOrders ?? 0}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => goHistory(p.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Full history
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 pb-4">
            <Pagination
              page={pagination.page || 1}
              totalPages={pagination.totalPages || 1}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
