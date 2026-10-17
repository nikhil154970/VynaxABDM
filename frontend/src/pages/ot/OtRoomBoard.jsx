import { useEffect, useState, useRef, useMemo } from 'react';
import { MdRefresh, MdMeetingRoom, MdPerson, MdAccessTime, MdCheckCircle, MdCleaningServices, MdBuild, MdBlock, MdPlayArrow, MdAdd, MdEdit, MdDelete, MdClose, MdSearch } from 'react-icons/md';
import api from '../../utils/api';

const STATUS_CFG = {
  AVAILABLE: { label: 'Available', color: 'bg-green-100 text-green-800 border-green-300', icon: MdCheckCircle },
  OCCUPIED: { label: 'Occupied', color: 'bg-red-100 text-red-800 border-red-300', icon: MdPlayArrow },
  CLEANING: { label: 'Cleaning', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: MdCleaningServices },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: MdBuild },
  INACTIVE: { label: 'Inactive', color: 'bg-gray-100 text-gray-400 border-gray-200', icon: MdBlock },
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function OtRoomBoard() {
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);
  // Room form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ roomNumber: '', roomName: '', floor: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = () => {
    Promise.all([
      api.get('/ot/surgery/rooms', { silent: true }),
      api.get('/ot/surgery/rooms/stats', { silent: true }),
    ])
      .then(([roomsRes, statsRes]) => {
        setRooms(roomsRes.data.items);
        setStats(statsRes.data.stats);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => r.roomNumber?.toLowerCase().includes(q) || r.roomName?.toLowerCase().includes(q));
  }, [rooms, search]);

  function openCreate() {
    setEditing(null);
    setForm({ roomNumber: '', roomName: '', floor: '' });
    setFormError('');
    setShowForm(true);
  }

  function openEdit(room) {
    setEditing(room);
    setForm({ roomNumber: room.roomNumber, roomName: room.roomName, floor: room.floor || '' });
    setFormError('');
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.roomNumber.trim() || !form.roomName.trim()) { setFormError('Room number and name are required'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.put(`/ot/surgery/rooms/${editing.id}`, form);
      } else {
        await api.post('/ot/surgery/rooms', form);
      }
      setShowForm(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save room');
    } finally { setSaving(false); }
  }

  async function handleDelete(room) {
    if (!window.confirm(`Delete room "${room.roomName}" (${room.roomNumber})?`)) return;
    try {
      await api.delete(`/ot/surgery/rooms/${room.id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse bg-gray-200 h-24 rounded-xl" />
        <div className="animate-pulse bg-gray-200 h-64 rounded-xl" />
      </div>
    );
  }

  const total = stats?.total || rooms.length;
  const available = stats?.available || 0;
  const occupied = stats?.occupied || 0;
  const cleaning = stats?.cleaning || 0;
  const maintenance = stats?.maintenance || 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">OT Room Status Board</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time operation theatre room status</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openCreate()} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <MdAdd className="text-lg" /> Add Room
          </button>
          <button onClick={fetchData} className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
            <MdRefresh className="text-lg" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      <div className="grid grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{total}</p>
          <p className="text-xs text-gray-500">Total Rooms</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{available}</p>
          <p className="text-xs text-green-600">Available</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{occupied}</p>
          <p className="text-xs text-red-600">Occupied</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{cleaning}</p>
          <p className="text-xs text-yellow-600">Cleaning</p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">{maintenance}</p>
          <p className="text-xs text-gray-600">Maintenance</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-xs">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rooms..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Room Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowForm(false); setEditing(null); }}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Room' : 'Add Room'}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }}><MdClose className="text-xl text-gray-400 hover:text-gray-600" /></button>
            </div>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">{formError}</div>}
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="e.g. OT-101" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Name *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.roomName} onChange={(e) => setForm({ ...form, roomName: e.target.value })} placeholder="e.g. Main OT Suite" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="e.g. Ground Floor" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Room' : 'Add Room'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((room) => {
          const cfg = STATUS_CFG[room.status] || STATUS_CFG.INACTIVE;
          const Icon = cfg.icon;
          const occupiedSince = room.occupiedSince ? formatTime(room.occupiedSince) : null;
          const cleaningSince = room.status === 'CLEANING' && room.expectedAvailableAt ? formatTime(room.expectedAvailableAt) : null;

          return (
            <div key={room.id} className={`rounded-xl border-2 p-4 ${cfg.color} relative group`}>
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                <button className="p-1 rounded bg-white/80 hover:bg-white shadow-sm" title="Edit" onClick={() => openEdit(room)}><MdEdit className="text-sm" /></button>
                <button className="p-1 rounded bg-white/80 hover:bg-white shadow-sm text-red-600" title="Delete" onClick={() => handleDelete(room)}><MdDelete className="text-sm" /></button>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MdMeetingRoom className="text-xl" />
                  <div>
                    <p className="font-semibold text-base">{room.roomNumber || room.roomName}</p>
                    {room.roomName && room.roomName !== room.roomNumber && <p className="text-xs opacity-75">{room.roomName}</p>}
                    {room.floor && <p className="text-xs opacity-75">Floor {room.floor}</p>}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                  <Icon className="text-sm" /> {cfg.label}
                </span>
              </div>

              {room.status === 'OCCUPIED' && occupiedSince && (
                <div className="flex items-center gap-1.5 text-sm mt-2">
                  <MdAccessTime className="text-sm" />
                  <span>Since {occupiedSince}</span>
                </div>
              )}

              {room.status === 'CLEANING' && cleaningSince && (
                <div className="flex items-center gap-1.5 text-sm mt-2">
                  <MdAccessTime className="text-sm" />
                  <span>Expected ready by {cleaningSince}</span>
                </div>
              )}

              {room.currentPatient && (
                <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                  <div className="flex items-center gap-1.5 text-sm">
                    <MdPerson className="text-sm" />
                    <span className="font-medium">{room.currentPatient.name}</span>
                    <span className="opacity-75">({room.currentPatient.uhid})</span>
                  </div>
                </div>
              )}

              {room.currentSurgery && (
                <div className="text-xs opacity-75 mt-1">
                  {room.currentSurgery.requestNumber}
                  {room.currentSurgery.startedAt && ` — Started ${formatTime(room.currentSurgery.startedAt)}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <MdMeetingRoom className="text-5xl mx-auto mb-3" />
          <p>No OT rooms found</p>
        </div>
      )}
    </div>
  );
}
