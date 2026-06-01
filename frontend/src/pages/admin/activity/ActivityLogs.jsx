import { useEffect, useState } from 'react';
import api from '../../../utils/api';
import Badge from '../../../components/Badge';
import Pagination from '../../../components/Pagination';

const fmt = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString();
};

const actionVariant = (a) => {
  if (a === 'LOGIN') return 'blue';
  if (a === 'CREATE_USER') return 'green';
  if (a === 'UPDATE_STATUS') return 'amber';
  return 'gray';
};

export default function ActivityLogs() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const pageSize = 10;

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/logs', { params: { page, pageSize } });
      setLogs(res.data.logs || []);
      setPagination(res.data.pagination || { page, totalPages: 1 });
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Audit trail for authentication and user management actions.
        </p>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Logs</p>
          <p className="text-xs text-gray-400">
            Page {pagination.page} of {pagination.totalPages}
          </p>
        </div>

        {error && (
          <div className="px-5 py-3 bg-rose-50 text-rose-700 text-sm border-b border-rose-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-5 py-3">User</th>
                <th className="text-left font-semibold px-5 py-3">Role</th>
                <th className="text-left font-semibold px-5 py-3">Action</th>
                <th className="text-left font-semibold px-5 py-3">Module</th>
                <th className="text-left font-semibold px-5 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-5 py-8 text-gray-400" colSpan={5}>
                    Loading logs…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-gray-400" colSpan={5}>
                    No activity yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-semibold text-gray-900">
                      {l.user?.name || '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {l.user?.role ? String(l.user.role).replaceAll('_', ' ') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={actionVariant(l.action)}>{l.action}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="gray">{l.module}</Badge>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{fmt(l.createdAt)}</td>
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
            onPageChange={(p) => fetchLogs(p)}
          />
        </div>
      </div>
    </div>
  );
}

