import { useEffect, useState, useMemo } from 'react';
import { MdAdd, MdEdit, MdDelete, MdClose, MdCheck, MdSearch, MdMeetingRoom } from 'react-icons/md';
import api from '../../utils/api';
import './AdminOt.css';

export default function AdminOtRooms() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ roomNumber: '', roomName: '', floor: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/ot/rooms');
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRooms(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => r.roomNumber.toLowerCase().includes(q) || r.roomName.toLowerCase().includes(q));
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setForm({ roomNumber: '', roomName: '', floor: '' });
    setError('');
    setShowForm(true);
  }

  function openEdit(room) {
    setEditing(room);
    setForm({ roomNumber: room.roomNumber, roomName: room.roomName, floor: room.floor || '' });
    setError('');
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.roomNumber.trim() || !form.roomName.trim()) { setError('Room number and name are required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/admin/ot/rooms/${editing.id}`, form);
      } else {
        await api.post('/admin/ot/rooms', form);
      }
      setShowForm(false);
      setEditing(null);
      fetchRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save room');
    } finally { setSaving(false); }
  }

  async function handleDelete(room) {
    if (!window.confirm(`Delete room "${room.roomName}" (${room.roomNumber})?`)) return;
    try {
      await api.delete(`/admin/ot/rooms/${room.id}`);
      fetchRooms();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  }

  async function toggleActive(room) {
    try {
      await api.put(`/admin/ot/rooms/${room.id}`, { isActive: !room.isActive });
      fetchRooms();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    }
  }

  return (
    <div className="ot-admin-page">
      <div className="ot-admin-header">
        <div>
          <h1 className="ot-admin-title">OT Rooms</h1>
          <p className="ot-admin-subtitle">Manage operation theatre rooms</p>
        </div>
        <button className="ot-btn ot-btn-primary" onClick={openCreate}><MdAdd className="w-4 h-4" /> Add Room</button>
      </div>

      <div className="ot-toolbar">
        <div className="ot-search-box">
          <MdSearch className="ot-search-icon" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rooms..." className="ot-search-input" />
        </div>
        <span className="ot-count">{filtered.length} room{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {showForm && (
        <div className="ot-form-card">
          <div className="ot-form-header">
            <h3>{editing ? 'Edit Room' : 'Add Room'}</h3>
            <button className="ot-btn-ghost" onClick={() => { setShowForm(false); setEditing(null); }}><MdClose className="w-5 h-5" /></button>
          </div>
          {error && <div className="ot-error-sm">{error}</div>}
          <form onSubmit={handleSave} className="ot-form">
            <div className="ot-form-row">
              <div className="ot-fg">
                <label className="ot-label">Room Number *</label>
                <input className="ot-input" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="e.g. OT-101" required />
              </div>
              <div className="ot-fg">
                <label className="ot-label">Room Name *</label>
                <input className="ot-input" value={form.roomName} onChange={(e) => setForm({ ...form, roomName: e.target.value })} placeholder="e.g. Main OT Suite" required />
              </div>
              <div className="ot-fg">
                <label className="ot-label">Floor</label>
                <input className="ot-input" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="e.g. Ground Floor" />
              </div>
            </div>
            <div className="ot-form-actions">
              <button type="button" className="ot-btn ot-btn-cancel" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
              <button type="submit" className="ot-btn ot-btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Room' : 'Add Room'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="ot-loading">Loading...</div> : (
        <div className="ot-table-wrap">
          <table className="ot-table">
            <thead>
              <tr>
                <th className="ot-th">Room #</th>
                <th className="ot-th">Name</th>
                <th className="ot-th">Floor</th>
                <th className="ot-th">Status</th>
                <th className="ot-th">Schedules</th>
                <th className="ot-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={`ot-tr ${!r.isActive ? 'ot-tr-inactive' : ''}`}>
                  <td className="ot-td"><span className="ot-mono">{r.roomNumber}</span></td>
                  <td className="ot-td"><span className="ot-bold">{r.roomName}</span></td>
                  <td className="ot-td">{r.floor || '—'}</td>
                  <td className="ot-td">
                    <button className={`ot-toggle ${r.isActive ? 'active' : ''}`} onClick={() => toggleActive(r)}>
                      <div className="ot-toggle-dot" />
                      {r.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="ot-td"><span className="ot-count-badge">{r._count?.surgerySchedules || 0}</span></td>
                  <td className="ot-td ot-actions">
                    <button className="ot-icon-btn" title="Edit" onClick={() => openEdit(r)}><MdEdit className="w-4 h-4" /></button>
                    <button className="ot-icon-btn ot-icon-btn-danger" title="Delete" onClick={() => handleDelete(r)}><MdDelete className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="ot-empty">No rooms found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
