import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPeople, MdWarning, MdCheckCircle, MdNotes, MdLocalHospital, MdSchedule } from 'react-icons/md';
import api from '../../utils/api';
import { admissionIdFromRow } from '../../utils/admissionId';
import './NurseOverview.css';

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
  );
}

function toTimeLabel(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function NurseOverview() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [duty, setDuty] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pa, no, dy] = await Promise.all([
          api.get('/nurse/ipd/assigned'),
          api.get('/nurse/recent-notes'),
          api.get('/nurse/my-duty').catch(() => ({ data: { duty: null } })),
        ]);
        if (!alive) return;
        setPatients(Array.isArray(pa.data?.items) ? pa.data.items : []);
        setRecentNotes(Array.isArray(no.data?.items) ? no.data.items : []);
        setDuty(dy.data?.duty || null);
        setLoadError('');
      } catch (e) {
        if (!alive) return;
        setPatients([]);
        setRecentNotes([]);
        setLoadError(e?.response?.data?.message || 'Could not load dashboard data');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Dashboard should reflect ALL patients assigned to the logged-in nurse (any ward).
  const assignedPatients = useMemo(() => patients, [patients]);
  const criticalPatients = useMemo(
    () => assignedPatients.filter((p) => String(p.status || '').trim().toLowerCase() === 'critical'),
    [assignedPatients],
  );

  const summary = useMemo(() => {
    const total = assignedPatients.length;
    const critical = criticalPatients.length;
    const stable = assignedPatients.filter((p) => String(p.status || '').trim().toLowerCase() === 'stable').length;

    const today = new Date(startOfTodayISO());
    const notesToday = recentNotes.filter((n) => n.createdAt && isSameDay(n.createdAt, today)).length;
    return { total, critical, stable, notesToday };
  }, [assignedPatients, criticalPatients, recentNotes]);

  const todaysPatients = useMemo(() => assignedPatients.slice(0, 6), [assignedPatients]);

  const notesPreview = useMemo(() => recentNotes.slice(0, 5), [recentNotes]);

  return (
    <div className="nurse-overview-container">
      <div className="nurse-overview-shell">
        <div className="nurse-overview-top" />

        {loadError ? <div className="nurse-overview-empty">{loadError}</div> : null}

        {/* Today's Duty Banner */}
        {duty && (
          <div className="nurse-overview-duty-banner" style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 16,
            padding: '16px 20px',
            marginBottom: 20,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <MdLocalHospital size={28} />
              <div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Today's Duty</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{duty.wardName}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdSchedule size={20} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {duty.shift === 'MORNING' ? 'Morning Shift' : duty.shift === 'EVENING' ? 'Evening Shift' : 'Night Shift'}
              </span>
            </div>
          </div>
        )}

        <div className="nurse-overview-summary">
          <div className="nurse-overview-card nurse-overview-card-kpi">
            <div className="nurse-overview-kpiRow">
              <div className="nurse-overview-kpiIcon nurse-overview-kpiIcon-blue">
                <MdPeople className="nurse-overview-kpiIconSvg" />
              </div>
              <div className="nurse-overview-kpiMeta">
                <div className="nurse-overview-kpiValue">{summary.total}</div>
                <div className="nurse-overview-kpiLabel">Total Assigned Patients</div>
              </div>
            </div>
          </div>
          <div className="nurse-overview-card nurse-overview-card-kpi nurse-overview-card-critical">
            <div className="nurse-overview-kpiRow">
              <div className="nurse-overview-kpiIcon nurse-overview-kpiIcon-red">
                <MdWarning className="nurse-overview-kpiIconSvg" />
              </div>
              <div className="nurse-overview-kpiMeta">
                <div className="nurse-overview-kpiValue">{summary.critical}</div>
                <div className="nurse-overview-kpiLabel">Critical Patients</div>
              </div>
            </div>
          </div>
          <div className="nurse-overview-card nurse-overview-card-kpi nurse-overview-card-stable">
            <div className="nurse-overview-kpiRow">
              <div className="nurse-overview-kpiIcon nurse-overview-kpiIcon-green">
                <MdCheckCircle className="nurse-overview-kpiIconSvg" />
              </div>
              <div className="nurse-overview-kpiMeta">
                <div className="nurse-overview-kpiValue">{summary.stable}</div>
                <div className="nurse-overview-kpiLabel">Stable Patients</div>
              </div>
            </div>
          </div>
          <div className="nurse-overview-card nurse-overview-card-kpi">
            <div className="nurse-overview-kpiRow">
              <div className="nurse-overview-kpiIcon nurse-overview-kpiIcon-purple">
                <MdNotes className="nurse-overview-kpiIconSvg" />
              </div>
              <div className="nurse-overview-kpiMeta">
                <div className="nurse-overview-kpiValue">{summary.notesToday}</div>
                <div className="nurse-overview-kpiLabel">Notes Added Today</div>
              </div>
            </div>
          </div>
        </div>

        <div className="nurse-overview-grid">
          <section className="nurse-overview-card nurse-overview-section">
            <div className="nurse-overview-sectionHeader nurse-overview-sectionHeader-critical">
              <div>
                <div className="nurse-overview-sectionTitle">Critical Patients</div>
                <div className="nurse-overview-sectionSub">Requires close monitoring</div>
              </div>
              <span className="nurse-overview-pill nurse-overview-pill-critical">{criticalPatients.length}</span>
            </div>

            {criticalPatients.length === 0 ? (
              <div className="nurse-overview-empty">No critical patients</div>
            ) : (
              <div className="nurse-overview-list">
                {criticalPatients.map((p) => (
                  <button
                    key={admissionIdFromRow(p)}
                    type="button"
                    className="nurse-overview-row nurse-overview-row-critical"
                    onClick={() => navigate(`/dashboard/nurse/ipd/details/${admissionIdFromRow(p)}`)}
                  >
                    <div className="nurse-overview-rowLeft">
                      <div className="nurse-overview-rowName">{p.name}</div>
                      <div className="nurse-overview-rowSub">
                        Bed <span className="nurse-overview-mono">{p.bed}</span>
                      </div>
                    </div>
                    <span className="nurse-overview-badge nurse-overview-badge-critical">Critical</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="nurse-overview-card nurse-overview-section">
            <div className="nurse-overview-sectionHeader">
              <div>
                <div className="nurse-overview-sectionTitle">Today&apos;s Patients</div>
                <div className="nurse-overview-sectionSub">Quick access (top {Math.min(6, assignedPatients.length)})</div>
              </div>
            </div>

            {todaysPatients.length === 0 ? (
              <div className="nurse-overview-empty">No assigned patients</div>
            ) : (
              <div className="nurse-overview-list">
                {todaysPatients.map((p) => (
                  <button
                    key={admissionIdFromRow(p)}
                    type="button"
                    className="nurse-overview-row"
                    onClick={() => navigate(`/dashboard/nurse/ipd/details/${admissionIdFromRow(p)}`)}
                  >
                    <div className="nurse-overview-rowLeft">
                      <div className="nurse-overview-rowName">{p.name}</div>
                      <div className="nurse-overview-rowSub">
                        Bed <span className="nurse-overview-mono">{p.bed}</span>
                      </div>
                    </div>
                    <span
                      className={[
                        'nurse-overview-badge',
                        String(p.status || '').toLowerCase().includes('critical')
                          ? 'nurse-overview-badge-critical'
                          : 'nurse-overview-badge-stable',
                      ].join(' ')}
                    >
                      {p.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="nurse-overview-card nurse-overview-section nurse-overview-section-wide">
            <div className="nurse-overview-sectionHeader">
              <div>
                <div className="nurse-overview-sectionTitle">Recent Notes</div>
                <div className="nurse-overview-sectionSub">Last updates from nursing notes</div>
              </div>
              <div className="nurse-overview-sectionHeaderRight">
                <button type="button" className="nurse-overview-btn nurse-overview-btn-secondary" onClick={() => navigate('/dashboard/nurse/notes')}>
                  Open
                </button>
                <button type="button" className="nurse-overview-btn nurse-overview-btn-secondary" onClick={() => navigate('/dashboard/nurse/ipd')}>
                  Assigned Patients
                </button>
              </div>
            </div>

            {notesPreview.length === 0 ? (
              <div className="nurse-overview-empty">No recent notes</div>
            ) : (
              <div className="nurse-overview-notes">
                {notesPreview.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="nurse-overview-note"
                    style={{ textAlign: 'left', border: 'none', background: 'transparent', width: '100%', cursor: 'pointer' }}
                    onClick={() => {
                      if (n.admissionId) navigate(`/dashboard/nurse/ipd/details/${n.admissionId}`);
                    }}
                  >
                    <div className="nurse-overview-noteTop">
                      <div className="nurse-overview-noteName">{n.patientName || 'Patient'}</div>
                      <div className="nurse-overview-noteTime">{toTimeLabel(n.createdAt)}</div>
                    </div>
                    <div className="nurse-overview-noteText">{n.text || '—'}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
