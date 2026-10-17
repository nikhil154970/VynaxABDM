import { useEffect, useState } from 'react';
import api from '../../../utils/api';
import Badge from '../../../components/Badge';
import Pagination from '../../../components/Pagination';
import {
  MdHistory,
  MdPerson,
  MdLogin,
  MdPersonAdd,
  MdSync,
  MdInfo,
  MdSchedule
} from 'react-icons/md';

const fmt = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const actionVariant = (a) => {
  if (a === 'LOGIN') return 'blue';
  if (a === 'CREATE_USER') return 'green';
  if (a === 'UPDATE_STATUS') return 'amber';
  return 'gray';
};

const getActionIcon = (action) => {
  if (action === 'LOGIN') return <MdLogin className="w-4 h-4 text-[#0077B6]" />;
  if (action === 'CREATE_USER') return <MdPersonAdd className="w-4 h-4 text-emerald-600" />;
  if (action === 'UPDATE_STATUS') return <MdSync className="w-4 h-4 text-amber-600" />;
  return <MdInfo className="w-4 h-4 text-gray-500" />;
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
    <div className="p-6 space-y-6">
      {/* Header with audit icon */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
          <MdHistory className="w-6 h-6 text-[#0077B6]" />
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Activity Logs</h1>
          <p className="text-xs md:text-sm text-gray-500">
            Audit trail for authentication and user management actions.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Logs</p>
          <p className="text-xs text-gray-400">
            Page {pagination.page} of {pagination.totalPages}
          </p>
        </div>

        {error && (
          <div className="px-6 py-3 bg-rose-50 text-rose-700 text-sm border-b border-rose-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wide">
              <tr>
                <th className="text-left font-semibold px-6 py-3.5">User</th>
                <th className="text-left font-semibold px-6 py-3.5">Role</th>
                <th className="text-left font-semibold px-6 py-3.5">Action</th>
                <th className="text-left font-semibold px-6 py-3.5">Module</th>
                <th className="text-left font-semibold px-6 py-3.5">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td className="px-6 py-10 text-center text-gray-400" colSpan={5}>
                    Loading logs…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-gray-400" colSpan={5}>
                    No activity yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-[#0077B6] shrink-0 font-bold text-xs">
                          {l.user?.name ? l.user.name[0].toUpperCase() : <MdPerson className="w-4 h-4" />}
                        </div>
                        <span className="truncate max-w-[160px]">{l.user?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {l.user?.role ? String(l.user.role).replaceAll('_', ' ') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getActionIcon(l.action)}
                        <Badge variant={actionVariant(l.action)}>{l.action}</Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="gray">{l.module}</Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MdSchedule className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{fmt(l.createdAt)}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
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

