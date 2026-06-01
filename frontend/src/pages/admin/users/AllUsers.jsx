import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import Badge from '../../../components/Badge';
import Pagination from '../../../components/Pagination';

const roleVariant = (role) => {
  if (!role) return 'gray';
  if (role === 'SUPER_ADMIN') return 'blue';
  if (role === 'DOCTOR') return 'purple';
  if (role === 'NURSE') return 'emerald';
  if (role === 'RECEPTIONIST') return 'amber';
  return 'gray';
};

export default function AllUsers() {
  const navigate = useNavigate();
  const title = useMemo(() => 'Users', []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const pageSize = 10;

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/users', { params: { page, pageSize } });
      setUsers(res.data.users || res.data || []);
      setPagination(res.data.pagination || { page, totalPages: 1 });
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load users');
      setUsers([]);
      setPagination({ page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, []);

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">Manage staff accounts and role-based access.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/users/create')}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
          >
            Create User
          </button>
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">All Users</p>
            <p className="text-xs text-gray-400">Page {pagination.page} of {pagination.totalPages}</p>
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
                  <th className="text-left font-semibold px-5 py-3">Name</th>
                  <th className="text-left font-semibold px-5 py-3">Email</th>
                  <th className="text-left font-semibold px-5 py-3">Role</th>
                  <th className="text-left font-semibold px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="px-5 py-8 text-gray-400" colSpan={4}>Loading users…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td className="px-5 py-8 text-gray-400" colSpan={4}>No users found.</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id || u._id || u.email} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3 font-semibold text-gray-900">{u.name || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{u.email || '—'}</td>
                      <td className="px-5 py-3">
                        <Badge variant={roleVariant(u.role)}>{u.role ? String(u.role).replaceAll('_', ' ') : '—'}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={u.active === false ? 'gray' : 'green'}>
                          {u.active === false ? 'Inactive' : 'Active'}
                        </Badge>
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
              onPageChange={(p) => fetchUsers(p)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

