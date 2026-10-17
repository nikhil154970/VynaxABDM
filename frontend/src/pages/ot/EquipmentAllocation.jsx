import { useEffect, useState, useMemo } from 'react';
import { MdSearch, MdAdd, MdEdit, MdDelete, MdHistory, MdClose, MdMedicalServices } from 'react-icons/md';
import api from '../../utils/api';
import './SurgeryScheduling.css';

const categories = [
  'Surgical Instruments', 'Monitoring Devices', 'Anesthesia Equipment',
  'Sterilization Equipment', 'Diagnostic Devices', 'General Equipment',
];

export default function EquipmentAllocation() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // Add/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    equipmentName: '', category: '', totalQuantity: '', availableQuantity: '',
    serialNumber: '', maintenanceDate: '', remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Allocate
  const [allocateItem, setAllocateItem] = useState(null);
  const [allocateQty, setAllocateQty] = useState(1);
  const [allocating, setAllocating] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    const params = { search };
    if (categoryFilter) params.category = categoryFilter;
    api.get('/ot/surgery/equipment', { params })
      .then((res) => setItems(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [categoryFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => e.equipmentName.toLowerCase().includes(q) || (e.serialNumber || '').toLowerCase().includes(q));
  }, [items, search]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ equipmentName: '', category: '', totalQuantity: '', availableQuantity: '', serialNumber: '', maintenanceDate: '', remarks: '' });
    setMsg('');
    setModalOpen(true);
  };

  const openEdit = (item, e) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      equipmentName: item.equipmentName,
      category: item.category,
      totalQuantity: String(item.totalQuantity),
      availableQuantity: String(item.availableQuantity),
      serialNumber: item.serialNumber || '',
      maintenanceDate: item.maintenanceDate ? item.maintenanceDate.split('T')[0] : '',
      remarks: item.remarks || '',
    });
    setMsg('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipmentName || !form.category) { setMsg('Name and category are required.'); return; }
    setSaving(true);
    setMsg('');
    try {
      if (editItem) {
        await api.put('/ot/surgery/equipment/' + editItem.id, form);
        setMsg('Equipment updated successfully.');
      } else {
        await api.post('/ot/surgery/equipment', form);
        setMsg('Equipment added successfully.');
      }
      fetchItems();
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Deactivate this equipment?')) return;
    try {
      await api.delete('/ot/surgery/equipment/' + id);
      fetchItems();
    } catch {
      alert('Failed to delete');
    }
  };

  const openHistory = async (item, e) => {
    e.stopPropagation();
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get('/ot/surgery/equipment/' + item.id + '/history');
      setHistoryData(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="ss-container">
      <div className="ss-header">
        <div>
          <h1 className="ss-title">Equipment Allocation</h1>
          <p className="ss-subtitle">Manage OT equipment inventory and allocation</p>
        </div>
        <button type="button" onClick={openAdd}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MdAdd /> Add Equipment
        </button>
      </div>

      <div className="ss-toolbar">
        <div className="ss-search-box">
          <MdSearch className="ss-search-icon" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment..." className="ss-search-input" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? <div className="ss-loading">Loading...</div> : (
        <div className="ss-table-wrapper">
          <table className="ss-table">
            <thead><tr>
              <th className="ss-th">Equipment</th>
              <th className="ss-th">Category</th>
              <th className="ss-th">Total</th>
              <th className="ss-th">Available</th>
              <th className="ss-th">Serial #</th>
              <th className="ss-th">Maint. Date</th>
              <th className="ss-th">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="ss-tr">
                  <td className="ss-td"><span className="ss-patient-name"><MdMedicalServices style={{ verticalAlign: 'middle', marginRight: 6, color: '#2563eb' }} />{e.equipmentName}</span></td>
                  <td className="ss-td"><Badge variant="blue">{e.category}</Badge></td>
                  <td className="ss-td">{e.totalQuantity}</td>
                  <td className="ss-td">
                    <span style={{ color: e.availableQuantity > 0 ? '#15803d' : '#dc2626', fontWeight: 600 }}>{e.availableQuantity}</span>
                  </td>
                  <td className="ss-td" style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.serialNumber || '—'}</td>
                  <td className="ss-td">{e.maintenanceDate ? new Date(e.maintenanceDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="ss-td">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={(ev) => openEdit(e, ev)} title="Edit"
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#2563eb', fontSize: 14, display: 'flex', alignItems: 'center' }}>
                        <MdEdit />
                      </button>
                      <button type="button" onClick={(ev) => handleDelete(e.id, ev)} title="Deactivate"
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#dc2626', fontSize: 14, display: 'flex', alignItems: 'center' }}>
                        <MdDelete />
                      </button>
                      <button type="button" onClick={(ev) => openHistory(e, ev)} title="History"
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#7c3aed', fontSize: 14, display: 'flex', alignItems: 'center' }}>
                        <MdHistory />
                      </button>
                      {e.availableQuantity > 0 && (
                        <button type="button" onClick={() => { setAllocateItem(e); setAllocateQty(1); }} title="Allocate to OT"
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#15803d', fontSize: 14, display: 'flex', alignItems: 'center' }}>
                          <MdMedicalServices />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="ss-empty">No equipment found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="pl-modalOverlay" onClick={() => setModalOpen(false)}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                {editItem ? <><MdEdit /> Edit Equipment</> : <><MdAdd /> Add Equipment</>}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              {msg && (
                <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 10,
                  background: msg.includes('success') ? '#f0fdf4' : '#fef2f2',
                  color: msg.includes('success') ? '#15803d' : '#dc2626',
                  border: '1px solid ' + (msg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                  {msg}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Equipment Name *</label>
                  <input value={form.equipmentName} onChange={(e) => setForm((f) => ({ ...f, equipmentName: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Category *</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', boxSizing: 'border-box' }}>
                    <option value="">Select</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Total Quantity *</label>
                  <input type="number" min="0" value={form.totalQuantity} onChange={(e) => setForm((f) => ({ ...f, totalQuantity: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Available Quantity</label>
                  <input type="number" min="0" value={form.availableQuantity} onChange={(e) => setForm((f) => ({ ...f, availableQuantity: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Serial Number</label>
                  <input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Maintenance Date</label>
                  <input type="date" value={form.maintenanceDate} onChange={(e) => setForm((f) => ({ ...f, maintenanceDate: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Remarks</label>
                  <textarea value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} rows={2}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)}
                  style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : editItem ? 'Update' : 'Add Equipment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyOpen && (
        <div className="pl-modalOverlay" onClick={() => setHistoryOpen(false)}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdHistory /> Allocation History
              </h3>
              <button type="button" onClick={() => setHistoryOpen(false)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              {historyLoading ? <div className="ss-loading">Loading...</div> : (
                historyData.length === 0 ? (
                  <div className="ss-empty">No allocation history</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {historyData.map((a) => (
                      <div key={a.id} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <strong>{a.surgerySession?.surgerySchedule?.otRequest?.patient?.name || 'Unknown Patient'}</strong>
                          <Badge variant={a.returnedAt ? 'green' : 'amber'}>{a.returnedAt ? 'Returned' : 'Allocated'}</Badge>
                        </div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>
                          Qty: {a.quantityAllocated} | Allocated: {new Date(a.allocatedAt).toLocaleString('en-IN')}
                          {a.returnedAt ? ' | Returned: ' + new Date(a.returnedAt).toLocaleString('en-IN') : ''}
                        </div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>
                          Room: {a.surgerySession?.surgerySchedule?.otRoom?.roomName || '—'} | Date: {a.surgerySession?.surgerySchedule?.surgeryDate ? new Date(a.surgerySession.surgerySchedule.surgeryDate).toLocaleDateString('en-IN') : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Allocate Modal */}
      {allocateItem && (
        <div className="pl-modalOverlay" onClick={() => setAllocateItem(null)}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="pl-modalHeader">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdMedicalServices /> Allocate Equipment
              </h3>
              <button type="button" onClick={() => setAllocateItem(null)} className="pl-modalClose"><MdClose /></button>
            </div>
            <div className="pl-modalBody">
              <div style={{ marginBottom: 12, fontSize: 13, color: '#374151' }}>
                <strong>{allocateItem.equipmentName}</strong>
                <span style={{ color: '#64748b', marginLeft: 8 }}>Available: {allocateItem.availableQuantity}</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Quantity to Allocate</label>
                <input type="number" min="1" max={allocateItem.availableQuantity} value={allocateQty}
                  onChange={(e) => setAllocateQty(Math.min(allocateItem.availableQuantity, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAllocateItem(null)}
                  style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button type="button" disabled={allocating || allocateQty < 1}
                  onClick={async () => {
                    setAllocating(true);
                    try {
                      await api.post('/ot/surgery/equipment/' + allocateItem.id + '/allocate', { quantity: allocateQty });
                      setAllocateItem(null);
                      fetchItems();
                    } catch (err) {
                      alert(err?.response?.data?.message || 'Failed to allocate');
                    } finally {
                      setAllocating(false);
                    }
                  }}
                  style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: allocating || allocateQty < 1 ? 0.5 : 1 }}>
                  {allocating ? 'Allocating...' : 'Allocate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ variant, children }) {
  const map = { blue: '#dbeafe', green: '#dcfce7', amber: '#fef3c7', gray: '#f1f5f9' };
  const tc = { blue: '#1d4ed8', green: '#15803d', amber: '#92400e', gray: '#475569' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: map[variant] || '#f1f5f9', color: tc[variant] || '#475569' }}>
      {children}
    </span>
  );
}
