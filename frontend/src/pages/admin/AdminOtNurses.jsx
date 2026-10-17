import { useEffect, useState, useMemo } from 'react';
import { MdSearch, MdPerson, MdToggleOn, MdToggleOff } from 'react-icons/md';
import api from '../../utils/api';
import './AdminOt.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminOtNurses() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchNurses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/ot/nurses');
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNurses(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => n.name.toLowerCase().includes(q) || (n.employeeId || '').toLowerCase().includes(q));
  }, [items, search]);

  async function handleToggle(id) {
    try {
      await api.patch(`/admin/ot/nurses/${id}/toggle`);
      fetchNurses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle');
    }
  }

  return (
    <div className="ot-admin-page">
      <div className="ot-admin-header">
        <div>
          <h1 className="ot-admin-title">OT Nurses</h1>
          <p className="ot-admin-subtitle">Manage nurses available for OT scheduling</p>
        </div>
      </div>

      <div className="ot-toolbar">
        <div className="ot-search-box">
          <MdSearch className="ot-search-icon" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search nurses..." className="ot-search-input" />
        </div>
        <span className="ot-count">{filtered.length} nurse{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <div className="ot-loading">Loading...</div> : (
        <div className="ot-table-wrap">
          <table className="ot-table">
            <thead>
              <tr>
                <th className="ot-th">Name</th>
                <th className="ot-th">Employee ID</th>
                <th className="ot-th">Email</th>
                <th className="ot-th">Phone</th>
                <th className="ot-th">Joined</th>
                <th className="ot-th">Status</th>
                <th className="ot-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => (
                <tr key={n.id} className={`ot-tr ${!n.isActive ? 'ot-tr-inactive' : ''}`}>
                  <td className="ot-td">
                    <div className="ot-user-cell">
                      <div className="ot-avatar"><MdPerson className="w-4 h-4" /></div>
                      <span className="ot-bold">{n.name}</span>
                    </div>
                  </td>
                  <td className="ot-td"><span className="ot-mono">{n.employeeId || '—'}</span></td>
                  <td className="ot-td">{n.email || '—'}</td>
                  <td className="ot-td">{n.phone || '—'}</td>
                  <td className="ot-td">{formatDate(n.createdAt)}</td>
                  <td className="ot-td">
                    <span className={`ot-status-dot ${n.isActive ? 'active' : 'inactive'}`} />
                    {n.isActive ? 'Active' : 'Inactive'}
                  </td>
                  <td className="ot-td">
                    <button className="ot-icon-btn" title={n.isActive ? 'Deactivate' : 'Activate'} onClick={() => handleToggle(n.id)}>
                      {n.isActive ? <MdToggleOn className="w-5 h-5 text-green-600" /> : <MdToggleOff className="w-5 h-5 text-gray-400" />}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="ot-empty">No nurses found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
