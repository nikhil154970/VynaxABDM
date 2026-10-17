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

  const deleteUser = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers(pagination.page);
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to delete user');
    }
  };

  const toggleUserStatus = async (user) => {
    const nextActive = user.isActive === false ? true : false;
    const actionWord = nextActive ? 'enable' : 'disable';
    if (!window.confirm(`Are you sure you want to ${actionWord} user "${user.name}"?`)) return;
    try {
      await api.patch(`/users/${user.id}/status`, { isActive: nextActive });
      fetchUsers(pagination.page);
    } catch (e) {
      alert(e?.response?.data?.message || `Failed to ${actionWord} user`);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">Manage staff accounts and role-based access.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/users/create')}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#00B4D8] active:bg-[#001B48] transition shadow-sm cursor-pointer"
          >
            Create User
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">All Users</p>
              <p className="text-xs text-gray-400 mt-0.5">Page {pagination.page} of {pagination.totalPages}</p>
            </div>
          </div>

          {error && (
            <div className="px-6 py-3 bg-rose-50 text-rose-800 text-sm border-b border-rose-100 font-semibold">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#001B48] text-left text-xs font-semibold uppercase tracking-wide text-white border-b border-[#001B48]">
                  <th className="px-5 py-3 whitespace-nowrap">Name</th>
                  <th className="px-5 py-3 whitespace-nowrap">Email</th>
                  <th className="px-5 py-3 whitespace-nowrap">Role</th>
                  <th className="px-5 py-3 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-5 py-8 text-gray-400 text-center font-semibold" colSpan={5}>
                      Loading users…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-gray-400 text-center font-semibold" colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id || u._id || u.email} className="hover:bg-[#D6E8EE] transition">
                      <td className="px-5 py-3 font-semibold text-gray-900 whitespace-nowrap">{u.name || '—'}</td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{u.email || '—'}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Badge variant={roleVariant(u.role)}>{u.role ? String(u.role).replaceAll('_', ' ') : '—'}</Badge>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Badge variant={u.isActive === false ? 'gray' : 'green'}>
                          {u.isActive === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => toggleUserStatus(u)}
                          className={`text-xs font-bold transition active:scale-95 duration-150 cursor-pointer ${
                            u.isActive === false ? 'text-green-600 hover:text-green-800' : 'text-amber-600 hover:text-amber-800'
                          }`}
                        >
                          {u.isActive === false ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteUser(u.id, u.name)}
                          className="text-xs font-bold text-red-600 hover:text-red-800 transition active:scale-95 duration-150 cursor-pointer"
                        >
                          Delete
                        </button>
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
              onPageChange={(p) => fetchUsers(p)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

