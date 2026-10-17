import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPerson, MdSearch, MdClose, MdAccessTime, MdInfoOutline, MdSchedule, MdPlayArrow } from 'react-icons/md';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import './SurgeryScheduling.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m + ' ' + ampm;
}

export default function DelayedSurgeries() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ surgeryDate: '', startTime: '', reason: '', otRoomId: '' });
  const [rescheduleRooms, setRescheduleRooms] = useState([]);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleMsg, setRescheduleMsg] = useState('');
  const [startMsg, setStartMsg] = useState('');

  useEffect(() => {
    api.get('/ot/surgery/delayed')
      .then((res) => setItems(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      (s.otRequest?.patient?.name || '').toLowerCase().includes(q) ||
      (s.otRequest?.patient?.uhid || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const handleRowClick = (item) => setSelectedItem(item);
  const closeModal = () => {
    setSelectedItem(null);
    setRescheduleOpen(false);
    setRescheduleMsg('');
    setStartMsg('');
  };

  const handleStartSurgery = async () => {
    if (!selectedItem) return;
    setStartMsg('');
    try {
      await api.post('/ot/surgery/workflow/start', {
        scheduleId: selectedItem.id,
        equipmentAllocations: [],
        consumableUsages: [],
      });
      setStartMsg('Surgery started! Redirecting...');
      setTimeout(() => {
        closeModal();
        fetchItems();
        navigate('/dashboard/ot/surgery/in-progress');
      }, 1000);
    } catch (err) {
      setStartMsg(err?.response?.data?.message || 'Failed to start surgery');
    }
  };

  const fetchItems = () => {
    api.get('/ot/surgery/delayed')
      .then((res) => setItems(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setItems([]));
  };

  const handleOpenReschedule = () => {
    if (!selectedItem) return;
    const d = new Date(selectedItem.surgeryDate);
    setRescheduleForm({
      surgeryDate: d.toISOString().split('T')[0],
      startTime: selectedItem.startTime || '',
      reason: '',
      otRoomId: '',
    });
    api.get('/ot/surgery/rooms').then((res) => setRescheduleRooms(res.data?.items?.filter((r) => r.status === 'AVAILABLE') || [])).catch(() => setRescheduleRooms([]));
    setRescheduleOpen(true);
    setRescheduleMsg('');
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleForm.surgeryDate || !rescheduleForm.startTime) return;
    setRescheduleSubmitting(true);
    setRescheduleMsg('');
    try {
      await api.put('/ot/surgery/reschedule', {
        scheduleId: selectedItem.id,
        surgeryDate: rescheduleForm.surgeryDate,
        startTime: rescheduleForm.startTime,
        reason: rescheduleForm.reason || undefined,
        otRoomId: rescheduleForm.otRoomId || undefined,
      });
      setRescheduleMsg('Surgery rescheduled successfully.');
      fetchItems();
    } catch (err) {
      setRescheduleMsg(err?.response?.data?.message || 'Failed to reschedule surgery');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  return (
    <div className="ss-container">
      {loading ? <div className="ss-loading">Loading...</div> : (
        <>
          <div className="ss-toolbar">
            <div className="ss-search-box" style={{ width: '200px' }}>
              <MdSearch className="ss-search-icon" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient..." className="ss-search-input" />
            </div>
            {items.length > 0 && <span className="text-xs text-gray-400">{items.length} delayed</span>}
          </div>
          <div className="ss-table-wrapper">
            <table className="ss-table">
              <thead><tr>{['Date', 'Time', 'Patient', 'UHID', 'Room', 'Surgeon', 'Delay', 'Status'].map((h) => <th key={h} className="ss-th">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="ss-tr" style={{ cursor: 'pointer' }} onClick={() => handleRowClick(s)}>
                    <td className="ss-td ss-date-cell">{formatDate(s.surgeryDate)}</td>
                    <td className="ss-td"><span className="ss-time">{formatTime(s.startTime)}</span></td>
                    <td className="ss-td">
                      <div className="ss-patient-cell">
                        <div className="ss-avatar"><MdPerson className="w-4 h-4" /></div>
                        <span className="ss-patient-name">{s.otRequest?.patient?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="ss-td"><span className="ss-uhid">{s.otRequest?.patient?.uhid || '—'}</span></td>
                    <td className="ss-td">{s.otRoom?.roomNumber || s.otRoom?.roomName || '—'}</td>
                    <td className="ss-td">{s.surgeon?.user?.name || '—'}</td>
                    <td className="ss-td">
                      <span className="text-xs font-medium text-rose-600">
                        {s.delayMinutes >= 60
                          ? Math.floor(s.delayMinutes / 60) + 'h ' + (s.delayMinutes % 60) + 'm'
                          : s.delayMinutes + 'm'}
                      </span>
                    </td>
                    <td className="ss-td"><Badge variant="rose">DELAYED</Badge></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="ss-empty">No delayed surgeries</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Detail Modal ─── */}
      {selectedItem && createPortal(
        <div className="pl-modalOverlay" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="pl-modal pl-modalAnimate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="pl-modalHeader">
              <div className="min-w-0 flex items-center gap-3">
                <div className="pl-avatar"><MdPerson className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">{selectedItem.otRequest?.patient?.name || '—'}</p>
                  <div className="pl-headerMeta">
                    <span className="pl-chip">UHID <span className="pl-chipMono">{selectedItem.otRequest?.patient?.uhid || '—'}</span></span>
                  </div>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="pl-modalClose" title="Close"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="pl-modalBody">
              <div className="pl-modalCard" style={{ border: '1px solid #fecaca', background: '#fff5f5' }}>
                <p className="pl-modalCardTitle" style={{ color: '#b91c1c' }}>
                  <MdAccessTime style={{ verticalAlign: 'middle', marginRight: 4 }} /> Delay Information
                </p>
                <div className="pl-kv">
                  <div><p className="k">Scheduled Date</p><p className="v">{formatDate(selectedItem.surgeryDate)}</p></div>
                  <div><p className="k">Scheduled Time</p><p className="v">{formatTime(selectedItem.startTime)}</p></div>
                  <div><p className="k">Delayed By</p><p className="v" style={{ color: '#b91c1c', fontWeight: 600 }}>
                    {selectedItem.delayMinutes >= 60
                      ? Math.floor(selectedItem.delayMinutes / 60) + ' hours ' + (selectedItem.delayMinutes % 60) + ' minutes'
                      : selectedItem.delayMinutes + ' minutes'}
                  </p></div>
                  {selectedItem.rescheduleReason && (
                    <div><p className="k">Reschedule Reason</p><p className="v" style={{ color: '#92400e' }}>{selectedItem.rescheduleReason}</p></div>
                  )}
                </div>
              </div>

              <div className="pl-modalGrid">
                <div className="pl-modalCard">
                  <p className="pl-modalCardTitle"><MdInfoOutline style={{ verticalAlign: 'middle', marginRight: 4 }} /> Surgery Details</p>
                  <div className="pl-kv">
                    <div><p className="k">Room</p><p className="v">{selectedItem.otRoom?.roomNumber || selectedItem.otRoom?.roomName || '—'}</p></div>
                    <div><p className="k">Surgeon</p><p className="v">{selectedItem.surgeon?.user?.name || '—'}</p></div>
                    <div><p className="k">OT Nurse</p><p className="v">{selectedItem.otNurse?.name || '—'}</p></div>
                    <div><p className="k">Anaesthetist</p><p className="v">{selectedItem.anaesthetist?.user?.name || '—'}</p></div>
                  </div>
                </div>
              </div>

              {startMsg && (
                <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 8, background: startMsg.includes('Redirecting') ? '#f0fdf4' : '#fef2f2', color: startMsg.includes('Redirecting') ? '#15803d' : '#dc2626', border: '1px solid ' + (startMsg.includes('Redirecting') ? '#bbf7d0' : '#fecaca') }}>
                  {startMsg}
                </div>
              )}
              <div className="pl-modalActions" style={{ marginTop: 12 }}>
                <button type="button" className="pl-actionBtn pl-actionBtnPrimary" onClick={handleStartSurgery}
                  style={{ background: '#059669', borderColor: '#059669' }}>
                  <MdPlayArrow className="w-4 h-4" /> Start Surgery
                </button>
                <button type="button" className="pl-actionBtn pl-actionBtnPrimary" onClick={handleOpenReschedule}
                  style={{ background: '#f59e0b', borderColor: '#f59e0b' }}>
                  <MdSchedule className="w-4 h-4" /> Reschedule
                </button>
                <button type="button" className="pl-actionBtn" onClick={closeModal}>
                  <MdClose className="w-4 h-4" /> Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Reschedule Sidebar ─── */}
      {rescheduleOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', zIndex: 1060, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8faff' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdSchedule /> Reschedule Surgery
            </h3>
            <button type="button" onClick={() => setRescheduleOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><MdClose className="w-5 h-5" /></button>
          </div>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', fontSize: 13, background: '#f8fafc' }}>
            <strong>{selectedItem?.otRequest?.patient?.name || '—'}</strong>
            <span style={{ color: '#64748b', marginLeft: 8, fontFamily: 'monospace', fontSize: 12 }}>#{selectedItem?.otRequest?.patient?.uhid || '—'}</span>
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            {rescheduleMsg && (
              <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 12, background: rescheduleMsg.includes('success') ? '#f0fdf4' : '#fef2f2', color: rescheduleMsg.includes('success') ? '#15803d' : '#dc2626', border: '1px solid ' + (rescheduleMsg.includes('success') ? '#bbf7d0' : '#fecaca') }}>
                {rescheduleMsg}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>New Surgery Date *</label>
              <input type="date" value={rescheduleForm.surgeryDate} onChange={(e) => setRescheduleForm((f) => ({ ...f, surgeryDate: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>New Time *</label>
              <input type="time" value={rescheduleForm.startTime} onChange={(e) => setRescheduleForm((f) => ({ ...f, startTime: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>OT Room</label>
              <select value={rescheduleForm.otRoomId} onChange={(e) => setRescheduleForm((f) => ({ ...f, otRoomId: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}>
                <option value="">— Keep current room —</option>
                {rescheduleRooms.map((rm) => (
                  <option key={rm.id} value={rm.id}>{rm.roomNumber || rm.roomName}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Reason for Reschedule</label>
              <textarea value={rescheduleForm.reason} onChange={(e) => setRescheduleForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Enter reason for rescheduling..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, minHeight: 70, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <button type="button" onClick={handleRescheduleSubmit} disabled={rescheduleSubmitting || !rescheduleForm.surgeryDate || !rescheduleForm.startTime}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: rescheduleSubmitting ? 'not-allowed' : 'pointer', opacity: rescheduleSubmitting || !rescheduleForm.surgeryDate || !rescheduleForm.startTime ? 0.6 : 1 }}>
              {rescheduleSubmitting ? 'Rescheduling...' : 'Reschedule Surgery'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
