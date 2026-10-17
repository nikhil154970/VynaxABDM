import { useEffect, useState, useMemo } from 'react';
import { MdPerson, MdSearch } from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import './SurgeryScheduling.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CompletedSurgeries() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/ot/surgery/scheduled', { params: { status: 'COMPLETED', limit: 50 } })
      .then((res) => setItems(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      (s.patient?.name || '').toLowerCase().includes(q) ||
      (s.uhid || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <div className="ss-container">
      <div className="ss-header">
   
      </div>
      {loading ? <div className="ss-loading">Loading...</div> : (
        <>
          <div className="ss-toolbar">
            <div className="ss-search-box" style={{ width: '200px' }}>
              <MdSearch className="ss-search-icon" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient..." className="ss-search-input" />
            </div>
          </div>
          <div className="ss-table-wrapper">
            <table className="ss-table">
              <thead><tr>{['Date', 'Time', 'Patient', 'UHID', 'Room', 'Surgeon', 'OT Nurse', 'Status'].map((h) => <th key={h} className="ss-th">{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="ss-tr">
                    <td className="ss-td ss-date-cell">{formatDate(s.surgeryDate)}</td>
                    <td className="ss-td"><span className="ss-time">{s.startTime}</span></td>
                    <td className="ss-td">
                      <div className="ss-patient-cell">
                        <div className="ss-avatar"><MdPerson className="w-4 h-4" /></div>
                        <span className="ss-patient-name">{s.patient?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="ss-td"><span className="ss-uhid">{s.uhid || '—'}</span></td>
                    <td className="ss-td">{s.otRoom?.roomNumber || s.otRoom?.roomName || '—'}</td>
                    <td className="ss-td">{s.surgeon?.user?.name || '—'}</td>
                    <td className="ss-td">{s.otNurse?.name || '—'}</td>
                    <td className="ss-td"><Badge variant="emerald">COMPLETED</Badge></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="ss-empty">No completed surgeries</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
