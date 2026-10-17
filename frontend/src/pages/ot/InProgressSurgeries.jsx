import { useEffect, useState, useMemo } from 'react';
import { MdPerson, MdSearch, MdTimer } from 'react-icons/md';
import api from '../../utils/api';
import './SurgeryScheduling.css';

function formatDuration(ms) {
  if (!ms || ms < 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export default function InProgressSurgeries() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchItems = () => {
    api.get('/ot/surgery/workflow/in-progress')
      .then((res) => {
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((err) => {
        console.error('InProgress fetch error:', err?.response?.data || err.message);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      (s.surgerySchedule?.otRequest?.patient?.name || '').toLowerCase().includes(q) ||
      (s.surgerySchedule?.otRequest?.patient?.uhid || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <div className="ss-container">
      <div className="ss-header" />
      {loading ? <div className="ss-loading">Loading...</div> : (
        <>
          <div className="ss-toolbar">
            <div className="ss-search-box">
              <MdSearch className="ss-search-icon" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient..." className="ss-search-input" />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Surgeries can only be completed by the assigned surgeon via Surgery Report.
            </p>
          </div>
          <div className="ss-table-wrapper">
            <table className="ss-table">
              <thead><tr>
                <th className="ss-th">Duration</th>
                <th className="ss-th">Patient</th>
                <th className="ss-th">UHID</th>
                <th className="ss-th">Room</th>
                <th className="ss-th">Surgeon</th>
                <th className="ss-th">Equipment</th>
                <th className="ss-th">Status</th>
              </tr></thead>
              <tbody>
                {filtered.map((s) => {
                  const elapsed = now - new Date(s.startTime).getTime();
                  const p = s.surgerySchedule?.otRequest?.patient || {};
                  const equip = s.equipmentAllocations || [];
                  return (
                    <tr key={s.id} className="ss-tr">
                      <td className="ss-td">
                        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: elapsed > 7200000 ? '#dc2626' : '#15803d' }}>
                          <MdTimer style={{ verticalAlign: 'middle', marginRight: 4 }} />{formatDuration(elapsed)}
                        </span>
                      </td>
                      <td className="ss-td">
                        <div className="ss-patient-cell">
                          <div className="ss-avatar"><MdPerson className="w-4 h-4" /></div>
                          <span className="ss-patient-name">{p.name || '—'}</span>
                        </div>
                      </td>
                      <td className="ss-td"><span className="ss-uhid">{p.uhid || '—'}</span></td>
                      <td className="ss-td">{s.surgerySchedule?.otRoom?.roomNumber || s.surgerySchedule?.otRoom?.roomName || '—'}</td>
                      <td className="ss-td">{s.surgerySchedule?.surgeon?.user?.name || '—'}</td>
                      <td className="ss-td" style={{ fontSize: 12 }}>
                        {equip.length > 0 ? equip.map((e) => e.equipment?.equipmentName).join(', ') : '—'}
                      </td>
                      <td className="ss-td">
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fffbeb', padding: '4px 8px', borderRadius: 6 }}>
                          Awaiting Surgeon Report
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="ss-empty">No in-progress surgeries</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
