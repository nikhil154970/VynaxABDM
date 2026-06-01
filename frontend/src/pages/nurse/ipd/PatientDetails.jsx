import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdEditNote, MdMonitorHeart, MdReceiptLong, MdScience } from 'react-icons/md';
import {
  NurseAdmissionPanel,
  NurseAssessmentPanel,
  NurseDoctorOrdersPanel,
  NurseTasksPanel,
  NurseICUMonitoringPanel,
} from './NurseClinicalSections';
import PatientLabReportsPanel from '../../../components/PatientLabReportsPanel';
import api from '../../../utils/api';
import { admissionIdFromRow, isAdmissionUuid } from '../../../utils/admissionId';
import './PatientDetails.css';

const NURSE_HEADER_UHID_KEY = 'hims_nurse_ipd_header_uhid';

function syncNurseHeaderUhid(uhid) {
  if (typeof window === 'undefined') return;
  if (uhid) {
    try {
      sessionStorage.setItem(NURSE_HEADER_UHID_KEY, uhid);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('hims-nurse-header-uhid', { detail: { uhid } }));
  } else {
    try {
      sessionStorage.removeItem(NURSE_HEADER_UHID_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('hims-nurse-header-uhid', { detail: { uhid: '' } }));
  }
}

function recordKey(id) {
  return `nursePatient:${id}`;
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function formatClinicalDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtVitalsCell(v) {
  if (v == null || v === '') return '—';
  return String(v);
}

export default function PatientDetails() {
  const params = useParams();
  const navigate = useNavigate();
  const hasId = params?.id != null && String(params.id).trim() !== '';
  const admissionIdParam = hasId ? String(params.id).trim() : '';

  const [patient, setPatient] = useState(null);
  const [admissionId, setAdmissionId] = useState('');
  const [vitals, setVitals] = useState(null);
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [medications, setMedications] = useState([]);
  const [notes, setNotes] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [assignedForSearch, setAssignedForSearch] = useState([]);
  const [nurseCare, setNurseCare] = useState(null);
  const [treatmentPlan, setTreatmentPlan] = useState(null);
  const nurseCareRef = useRef(null);
  nurseCareRef.current = nurseCare;

  const [editMode, setEditMode] = useState(true);
  const [draft, setDraft] = useState({
    status: 'Stable',
    diagnosis: '',
    vitals: { bp: '', temperature: '', pulse: '', oxygen: '' },
    medications: [],
  });
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState(null); // { to, state }
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [vitalsEditOpen, setVitalsEditOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('admission');
  const [doctorUpdatesLoading, setDoctorUpdatesLoading] = useState(false);
  const [doctorUpdatesError, setDoctorUpdatesError] = useState('');
  const [doctorUpdatesData, setDoctorUpdatesData] = useState(null);
  /** Mobile-only: 'daily' | 'treatment' | null — full doctor updates in modal */
  const [doctorUpdatesModal, setDoctorUpdatesModal] = useState(null);

  // Search (when no patient id is provided)
  const [searchQuery, setSearchQuery] = useState('');

  const persistRecord = (next) => {
    if (!next?.patient?.id) return;
    localStorage.setItem(recordKey(next.patient.id), JSON.stringify({ ...next, updatedAt: new Date().toISOString() }));
  };

  const fetchPatientDetails = async () => {
    if (!hasId || !isAdmissionUuid(admissionIdParam)) {
      setPatient(null);
      setAdmissionId('');
      setVitals(null);
      setMedications([]);
      setNotes([]);
      setLoadError('');
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    setLoadError('');
    try {
      const [res, vitalsRes] = await Promise.all([
        api.get(`/nurse/patient/${admissionIdParam}`),
        api.get(`/nurse/vitals/${admissionIdParam}`).catch(() => ({ data: null })),
      ]);
      const data = res.data || {};
      const aid = data.admission?.id || admissionIdParam;
      const pat = data.patient || {};
      const adm = data.admission || {};
      const v = data.vitals || {};
      const vitPayload = vitalsRes?.data && typeof vitalsRes.data === 'object' ? vitalsRes.data : null;
      const latestV = vitPayload?.latest && typeof vitPayload.latest === 'object' ? vitPayload.latest : null;
      const historyV = Array.isArray(vitPayload?.history) ? vitPayload.history : [];

      const admDate = adm.admissionDate ? new Date(adm.admissionDate) : null;
      const admStr =
        admDate && !Number.isNaN(admDate.getTime()) ? admDate.toISOString().slice(0, 10) : '—';

      const diagRaw = adm.diagnosis != null ? String(adm.diagnosis).trim() : '';
      const nextPatient = {
        id: pat.id,
        admissionId: aid,
        name: pat.name || '',
        uhid: pat.uhid || '',
        age: pat.age ?? 0,
        gender: pat.gender || '',
        ward: data.ward || '',
        bed: data.bed || '',
        doctor: data.doctor || '',
        admissionDate: admStr,
        admissionAtIso: adm.admissionDate != null ? adm.admissionDate : null,
        status: String(adm.clinicalCondition || '').toLowerCase().includes('critical') ? 'Critical' : 'Stable',
        diagnosis: diagRaw || '—',
      };

      const nc = data.nurseCare && typeof data.nurseCare === 'object' ? data.nurseCare : {};
      const mergedCare = {
        assessment: nc.assessment && typeof nc.assessment === 'object' ? nc.assessment : {},
        nurseTasks: Array.isArray(nc.nurseTasks) ? nc.nurseTasks : null,
        icuMonitoring: nc.icuMonitoring && typeof nc.icuMonitoring === 'object' ? nc.icuMonitoring : null,
      };
      setNurseCare(mergedCare);
      nurseCareRef.current = mergedCare;
      setTreatmentPlan(data.treatmentPlan && typeof data.treatmentPlan === 'object' ? data.treatmentPlan : null);

      const nextVitals = {
        bp: String(latestV?.bp ?? v.bp ?? '').trim(),
        temperature: String(
          latestV?.temp != null && Number.isFinite(Number(latestV.temp)) ? `${latestV.temp}°F` : v.temperature || '',
        ).trim(),
        pulse: String(latestV?.pulse ?? v.pulse ?? '').trim(),
        oxygen: String(
          latestV?.oxygenTherapy ||
            (latestV?.spo2 != null && Number.isFinite(Number(latestV.spo2)) ? `${latestV.spo2}%` : v.oxygen || ''),
        ).trim(),
      };

      const apiNotes = Array.isArray(data.notes) ? data.notes : [];

      const defaultMeds = [];
      const stored = safeParse(localStorage.getItem(recordKey(pat.id)) || '', null);
      const nextMeds = Array.isArray(stored?.medications) ? stored.medications.map((m) => ({ ...m, route: m.route || 'Oral' })) : defaultMeds;

      setAdmissionId(aid);
      setPatient(nextPatient);
      setVitals(nextVitals);
      setVitalsHistory(historyV);
      setMedications(nextMeds);
      setNotes(apiNotes);
      setDraft({
        status: nextPatient.status || 'Stable',
        diagnosis: nextPatient.diagnosis === '—' ? '' : nextPatient.diagnosis,
        vitals: nextVitals,
        medications: nextMeds,
      });
      setSavedSnapshot({
        status: nextPatient.status || 'Stable',
        diagnosis: nextPatient.diagnosis === '—' ? '' : nextPatient.diagnosis,
        vitals: nextVitals,
        medications: nextMeds,
      });
      setEditMode(true);
      setSaveMsg('');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Could not load patient';
      setLoadError(msg);
      setPatient(null);
      setAdmissionId('');
      setVitals(null);
      setVitalsHistory([]);
      setMedications([]);
      setNotes([]);
      setNurseCare(null);
      setTreatmentPlan(null);
      nurseCareRef.current = null;
    } finally {
      setDetailLoading(false);
    }
  };

  const persistNurseCarePatch = useCallback(async (patch) => {
    const aid = admissionIdParam;
    if (!aid || !isAdmissionUuid(aid)) return;
    const base = nurseCareRef.current || { assessment: {}, nurseTasks: null, icuMonitoring: null };
    const merged = {
      assessment: { ...(base.assessment || {}), ...(patch.assessment || {}) },
      nurseTasks: patch.nurseTasks !== undefined ? patch.nurseTasks : base.nurseTasks,
      icuMonitoring: patch.icuMonitoring !== undefined ? patch.icuMonitoring : base.icuMonitoring,
    };
    nurseCareRef.current = merged;
    setNurseCare(merged);
    await api.put('/nurse/clinical-data', { admissionId: aid, nurseCare: merged });
  }, [admissionIdParam]);

  useEffect(() => {
    if (!hasId) {
      setPatient(null);
      setAdmissionId('');
      setVitals(null);
      setMedications([]);
      setNotes([]);
      setNurseCare(null);
      setTreatmentPlan(null);
      nurseCareRef.current = null;
      setSaveMsg('');
      setSaving(false);
      setLoadError('');
      setDetailLoading(false);
      return;
    }
    fetchPatientDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasId, admissionIdParam]);

  useEffect(() => {
    if (hasId) return;
    syncNurseHeaderUhid('');
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/nurse/ipd/assigned');
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (alive) setAssignedForSearch(items);
      } catch {
        if (alive) setAssignedForSearch([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [hasId]);

  useEffect(() => {
    if (!hasId || !isAdmissionUuid(admissionIdParam) || !patient?.uhid) return;
    syncNurseHeaderUhid(patient.uhid);
    return () => {
      syncNurseHeaderUhid('');
    };
  }, [hasId, admissionIdParam, patient?.uhid]);

  useEffect(() => {
    if (activePanel !== 'doctor_updates') setDoctorUpdatesModal(null);
  }, [activePanel]);

  useEffect(() => {
    if (doctorUpdatesModal == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setDoctorUpdatesModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [doctorUpdatesModal]);

  const statusMeta = useMemo(() => {
    const s = patient?.status;
    if (s === 'Critical') return { label: 'Critical', badgeClass: 'patient-details-badge patient-details-badge-critical' };
    return { label: s || 'Stable', badgeClass: 'patient-details-badge patient-details-badge-stable' };
  }, [patient?.status]);

  const handleCancel = () => {
    setDraft({
      status: patient.status || 'Stable',
      diagnosis: patient.diagnosis || '',
      vitals,
      medications,
    });
    setEditMode(false);
    window.setTimeout(() => setEditMode(true), 0);
  };

  const handleSave = async (options = {}) => {
    const { redirectToAssigned = true } = options || {};
    if (!admissionId) {
      setSaveMsg('Missing admission');
      return;
    }
    setSaving(true);
    setSaveMsg('');

    const nextVitals = {
      bp: String(draft.vitals.bp || '').trim(),
      temperature: String(draft.vitals.temperature || '').trim(),
      pulse: String(draft.vitals.pulse || '').trim(),
      oxygen: String(draft.vitals.oxygen || '').trim(),
    };

    const nextMeds = (Array.isArray(draft.medications) ? draft.medications : [])
      .map((m) => ({
        name: String(m.name || '').trim(),
        time: String(m.time || '').trim(),
        route: String(m.route || 'Oral').trim() || 'Oral',
        status: m.status === 'Given' ? 'Given' : 'Pending',
      }))
      .filter((m) => m.name || m.time);

    const nextPatient = {
      ...patient,
      status: draft.status === 'Critical' ? 'Critical' : 'Stable',
      diagnosis: String(draft.diagnosis || '').trim() || '—',
    };

    try {
      await api.put('/nurse/condition', {
        admissionId,
        condition: nextPatient.status === 'Critical' ? 'critical' : 'stable',
        diagnosis: String(draft.diagnosis || '').trim(),
      });
      if (nextVitals.bp) {
        await api.post('/nurse/vitals', {
          admissionId,
          bp: nextVitals.bp,
          temp: nextVitals.temperature || undefined,
          pulse: nextVitals.pulse || undefined,
          oxygen: nextVitals.oxygen || undefined,
        });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Save failed';
      setSaveMsg(msg);
      setSaving(false);
      window.setTimeout(() => setSaveMsg(''), 4000);
      return;
    }

    // Refresh vitals history (append-based tracking)
    try {
      const vr = await api.get(`/nurse/vitals/${admissionId}`);
      const payload = vr?.data && typeof vr.data === 'object' ? vr.data : null;
      const history = Array.isArray(payload?.history) ? payload.history : [];
      const latest = payload?.latest && typeof payload.latest === 'object' ? payload.latest : null;
      setVitalsHistory(history);
      if (latest) {
        setVitals({
          bp: String(latest.bp || '').trim(),
          temperature: latest.temp != null && Number.isFinite(Number(latest.temp)) ? `${latest.temp}°F` : '',
          pulse: latest.pulse != null ? String(latest.pulse) : '',
          oxygen:
            String(latest.oxygenTherapy || '').trim() ||
            (latest.spo2 != null && Number.isFinite(Number(latest.spo2)) ? `${latest.spo2}%` : ''),
        });
      }
    } catch {
      // ignore refresh failure
    }

    persistRecord({
      patient: nextPatient,
      vitals: nextVitals,
      medications: nextMeds,
      notes,
    });

    setPatient(nextPatient);
    setVitals(nextVitals);
    setMedications(nextMeds);
    setDraft((d) => ({ ...d, vitals: nextVitals, medications: nextMeds }));
    setSavedSnapshot({
      status: nextPatient.status,
      diagnosis: nextPatient.diagnosis === '—' ? '' : nextPatient.diagnosis,
      vitals: nextVitals,
      medications: nextMeds,
    });
    setSaving(false);
    setSaveMsg('Saved');
    window.setTimeout(() => setSaveMsg(''), 1800);

    if (redirectToAssigned) {
      navigate('/dashboard/nurse/ipd');
    }
  };

  const normalizeForCompare = (snap) => {
    const vit = snap?.vitals || {};
    const meds = Array.isArray(snap?.medications) ? snap.medications : [];
    return {
      status: snap?.status === 'Critical' ? 'Critical' : 'Stable',
      diagnosis: String(snap?.diagnosis || '').trim(),
      vitals: {
        bp: String(vit.bp || '').trim(),
        temperature: String(vit.temperature || '').trim(),
        pulse: String(vit.pulse || '').trim(),
        oxygen: String(vit.oxygen || '').trim(),
      },
      medications: meds
        .map((m) => ({
          name: String(m.name || '').trim(),
          time: String(m.time || '').trim(),
          route: String(m.route || 'Oral').trim() || 'Oral',
          status: m.status === 'Given' ? 'Given' : 'Pending',
        }))
        .filter((m) => m.name || m.time),
    };
  };

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    const a = normalizeForCompare(savedSnapshot);
    const b = normalizeForCompare(draft);
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [draft, savedSnapshot]);

  const isIcuWard = useMemo(() => String(patient?.ward || '').toUpperCase().includes('ICU'), [patient?.ward]);

  const panelOrder = useMemo(() => {
    const order = ['admission', 'assessment', 'doctor', 'tasks'];
    if (isIcuWard) order.push('icu');
    order.push('medications', 'doctor_updates', 'lab_reports');
    return order;
  }, [isIcuWard]);

  const activePanelIndex = useMemo(() => {
    const i = panelOrder.indexOf(activePanel);
    return i >= 0 ? i : 0;
  }, [panelOrder, activePanel]);

  useEffect(() => {
    if (activePanel === 'icu' && !isIcuWard) setActivePanel('admission');
  }, [activePanel, isIcuWard]);

  useEffect(() => {
    if (!panelOrder.includes(activePanel)) setActivePanel('admission');
  }, [panelOrder, activePanel]);

  useEffect(() => {
    setActivePanel('admission');
    setVitalsEditOpen(false);
  }, [admissionIdParam]);

  useEffect(() => {
    setDoctorUpdatesData(null);
    setDoctorUpdatesError('');
    setDoctorUpdatesLoading(false);
  }, [admissionIdParam]);

  const loadDoctorUpdates = useCallback(async () => {
    if (!admissionId || !isAdmissionUuid(admissionId)) return;
    setDoctorUpdatesLoading(true);
    setDoctorUpdatesError('');
    try {
      const res = await api.get(`/nurse/patient/${admissionId}/doctor-updates`);
      const payload = res.data && typeof res.data === 'object' ? res.data : null;
      setDoctorUpdatesData(
        payload ?? {
          treatingDoctorName: '',
          dailyNotes: [],
          treatmentPlan: null,
        }
      );
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Could not load doctor updates';
      setDoctorUpdatesError(msg);
      setDoctorUpdatesData(null);
    } finally {
      setDoctorUpdatesLoading(false);
    }
  }, [admissionId]);

  useEffect(() => {
    if (activePanel !== 'doctor_updates') return;
    loadDoctorUpdates();
  }, [activePanel, admissionId, loadDoctorUpdates]);

  const goPanelPrev = () => {
    const i = panelOrder.indexOf(activePanel);
    if (i <= 0) return;
    setActivePanel(panelOrder[i - 1]);
  };

  const goPanelNext = () => {
    const i = panelOrder.indexOf(activePanel);
    if (i < 0) {
      setActivePanel(panelOrder[0] ?? 'admission');
      return;
    }
    if (i >= panelOrder.length - 1) return;
    setActivePanel(panelOrder[i + 1]);
  };

  const addNotesNavState = useMemo(() => {
    if (!patient) return null;
    return {
      admissionId,
      patientId: patient.id,
      uhid: patient.uhid,
      name: patient.name,
      ward: patient.ward,
      bed: patient.bed,
    };
  }, [patient, admissionId]);

  const handleClickAddNotes = () => {
    if (!patient || !addNotesNavState || saving) return;
    if (isDirty) {
      setPendingNav({ to: '/dashboard/nurse/notes/add', state: addNotesNavState });
      setConfirmSaveOpen(true);
      return;
    }
    navigate('/dashboard/nurse/notes/add', { state: addNotesNavState });
  };

  if (!hasId) {
    const q = String(searchQuery || '').trim().toLowerCase();
    const results = !q
      ? assignedForSearch
      : assignedForSearch.filter(
          (p) =>
            String(p.name || '')
              .toLowerCase()
              .includes(q) || String(p.uhid || '').toLowerCase().includes(q),
        );

    return (
      <div className="patient-details-container">
        <section className="patient-details-card">
          <div className="patient-details-cardBody">
            <div className="patient-details-searchRow">
              <div className="patient-details-field patient-details-field-wide patient-details-fieldNoBorder">
                <input
                  id="patient-details-search"
                  className="patient-details-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or UHID"
                />
              </div>
            </div>

            <div className="patient-details-searchList">
              {results.length === 0 ? (
                <div className="patient-details-empty">
                  <p className="patient-details-empty-title">No patients found</p>
                  <p className="patient-details-empty-sub">Try a different name/UHID, or confirm you are assigned on IPD.</p>
                </div>
              ) : (
                results.map((p) => {
                  const aid = admissionIdFromRow(p);
                  return (
                    <button
                      key={aid || p.uhid}
                      type="button"
                      className="patient-details-searchItem"
                      onClick={() => aid && navigate(`/dashboard/nurse/ipd/details/${aid}`)}
                      disabled={!aid}
                    >
                      <div className="patient-details-searchItemLeft">
                        <div className="patient-details-searchName">{p.name}</div>
                        <div className="patient-details-searchSub">
                          <span className="patient-details-mono">{p.uhid}</span> · {p.ward} ·{' '}
                          <span className="patient-details-mono">{p.bed}</span>
                        </div>
                      </div>
                      <div className="patient-details-searchOpen">Open</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (hasId && !isAdmissionUuid(admissionIdParam)) {
    return (
      <div className="patient-details-container">
        <section className="patient-details-card">
          <div className="patient-details-cardBody patient-details-empty">
            <p className="patient-details-empty-title">Invalid patient link</p>
            <p className="patient-details-empty-sub">Open the patient again from Assigned Patients or Update record search.</p>
            <button type="button" className="patient-details-btn patient-details-btn-primary" onClick={() => navigate('/dashboard/nurse/ipd/details')}>
              Back to search
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (detailLoading || (!loadError && (!patient || !vitals))) {
    return (
      <div className="patient-details-container">
        <div className="patient-details-skeleton-card" />
        <div className="patient-details-skeleton-grid">
          <div className="patient-details-skeleton-card" />
          <div className="patient-details-skeleton-card" />
          <div className="patient-details-skeleton-card" />
        </div>
      </div>
    );
  }

  if (loadError || !patient || !vitals) {
    return (
      <div className="patient-details-container">
        <section className="patient-details-card">
          <div className="patient-details-cardBody patient-details-empty">
            <p className="patient-details-empty-title">{loadError || 'Unable to load patient'}</p>
            <button type="button" className="patient-details-btn patient-details-btn-primary" onClick={() => navigate('/dashboard/nurse/ipd')}>
              Back to assigned list
            </button>
          </div>
        </section>
      </div>
    );
  }

  const marEditor = (
    <div className="patient-details-med-edit">
      <div className="patient-details-med-edit-head patient-details-med-edit-head--5">
        <span>Medicine</span>
        <span>Time</span>
        <span>Route</span>
        <span>Status</span>
        <span className="patient-details-med-edit-actions-col">Action</span>
      </div>
      {draft.medications.map((m, idx) => (
        <div key={`m-${idx}`} className="patient-details-med-edit-row patient-details-med-edit-row--5">
          <input
            className="patient-details-input"
            value={m.name}
            onChange={(e) =>
              setDraft((d) => {
                const next = [...d.medications];
                next[idx] = { ...next[idx], name: e.target.value };
                return { ...d, medications: next };
              })
            }
            placeholder="Medicine name"
          />
          <input
            className="patient-details-input patient-details-mono"
            value={m.time}
            onChange={(e) =>
              setDraft((d) => {
                const next = [...d.medications];
                next[idx] = { ...next[idx], time: e.target.value };
                return { ...d, medications: next };
              })
            }
            placeholder="e.g. 09:00 AM"
          />
          <select
            className="patient-details-input"
            value={m.route || 'Oral'}
            onChange={(e) =>
              setDraft((d) => {
                const next = [...d.medications];
                next[idx] = { ...next[idx], route: e.target.value };
                return { ...d, medications: next };
              })
            }
          >
            <option value="Oral">Oral</option>
            <option value="IV">IV</option>
            <option value="IM">IM</option>
            <option value="SC">SC</option>
            <option value="Inhalation">Inhalation</option>
          </select>
          <select
            className={[
              'patient-details-input',
              m.status === 'Given' ? 'patient-details-btn-success' : 'patient-details-btn-warning',
            ].join(' ')}
            value={m.status}
            onChange={(e) =>
              setDraft((d) => {
                const next = [...d.medications];
                next[idx] = { ...next[idx], status: e.target.value };
                return { ...d, medications: next };
              })
            }
          >
            <option value="Given">Given</option>
            <option value="Pending">Pending</option>
          </select>
          <button
            type="button"
            className="patient-details-btn patient-details-btn-ghost patient-details-btn-danger"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                medications: d.medications.filter((_, i) => i !== idx),
              }))
            }
          >
            Remove
          </button>
        </div>
      ))}
      <div className="patient-details-med-edit-footer">
        <button
          type="button"
          className="patient-details-btn patient-details-btn-info"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              medications: [...d.medications, { name: '', time: '', status: 'Pending', route: 'Oral' }],
            }))
          }
        >
          + Add Medicine
        </button>
      </div>
    </div>
  );

  const renderActiveSection = () => {
    switch (activePanel) {
      case 'admission':
        return (
          <NurseAdmissionPanel
            ward={patient.ward}
            doctorName={patient.doctor}
            admissionAtIso={patient.admissionAtIso}
            admissionDate={patient.admissionDate}
          />
        );
      case 'assessment':
        return (
          <NurseAssessmentPanel
            patientId={patient.id}
            admissionId={admissionId}
            assessmentSeed={nurseCare?.assessment}
            onPersistPatch={persistNurseCarePatch}
          />
        );
      case 'doctor':
        return <NurseDoctorOrdersPanel patientId={patient.id} treatmentPlan={treatmentPlan} />;
      case 'tasks':
        return (
          <NurseTasksPanel
            patientId={patient.id}
            admissionId={admissionId}
            tasksSeed={nurseCare?.nurseTasks}
            onPersistPatch={persistNurseCarePatch}
          />
        );
      case 'icu':
        return (
          <NurseICUMonitoringPanel
            patientId={patient.id}
            ward={patient.ward}
            admissionId={admissionId}
            icuSeed={nurseCare?.icuMonitoring}
            onPersistPatch={persistNurseCarePatch}
          />
        );
      case 'medications':
        return (
          <section className="patient-details-card patient-details-card--activeBlock">
            <header className="patient-details-cardHeader">
              <div className="patient-details-cardTitle">
                <span className="patient-details-cardIcon patient-details-cardIconAlt2">
                  <MdReceiptLong className="patient-details-cardIconSvg" />
                </span>
                <div className="patient-details-cardTitleText">
                  <h2 className="patient-details-cardH2">Medications (MAR)</h2>
                  <p className="patient-details-cardP">Schedule, route (oral / IV / injection), and given status</p>
                </div>
              </div>
            </header>
            <div className="patient-details-cardBody">{marEditor}</div>
          </section>
        );
      case 'doctor_updates': {
        const daily = Array.isArray(doctorUpdatesData?.dailyNotes) ? doctorUpdatesData.dailyNotes : [];
        const tp = doctorUpdatesData?.treatmentPlan && typeof doctorUpdatesData.treatmentPlan === 'object' ? doctorUpdatesData.treatmentPlan : null;
        const medRows = tp?.medicines
          ? tp.medicines
              .map((m, i) => {
                const med = m && typeof m === 'object' ? m : {};
                const name = String(med.medicine || med.name || '').trim();
                const dosage = String(med.dosage || '').trim();
                const duration = String(med.duration || '').trim();
                const mode = String(med.mode || '').trim();
                if (!name && !dosage && !duration && !mode) return null;
                return { key: `tp-med-${i}`, name, dosage, duration, mode };
              })
              .filter(Boolean)
          : [];

        const renderDailyNotesTable = (rowKeyPrefix) => (
          <table className="patient-details-du-table">
            <thead>
              <tr>
                <th>Date &amp; time</th>
                <th>Doctor</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={3} className="patient-details-du-table-empty">
                    No daily notes from the doctor yet.
                  </td>
                </tr>
              ) : (
                daily.map((n) => (
                  <tr key={`${rowKeyPrefix}${n.id}`}>
                    <td className="patient-details-du-table-nowrap">{formatClinicalDateTime(n.createdAt)}</td>
                    <td>{n.doctorName || '—'}</td>
                    <td className="patient-details-du-table-note">{n.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        );

        const renderTreatmentPlanBody = (rowKeyPrefix) =>
          !tp ? (
            <p className="patient-details-muted">No treatment plan on file yet.</p>
          ) : (
            <>
              <div className="patient-details-du-tp-meta">
                <span>
                  <span className="patient-details-du-label">Last updated</span>
                  {formatClinicalDateTime(tp.updatedAt)}
                </span>
                {tp.doctorName ? (
                  <span>
                    <span className="patient-details-du-label">Doctor</span>
                    {tp.doctorName}
                  </span>
                ) : null}
              </div>
              {tp.description ? (
                <p className="patient-details-du-para">
                  <strong>Plan:</strong> {tp.description}
                </p>
              ) : null}
              {tp.instructions ? (
                <p className="patient-details-du-para">
                  <strong>Instructions:</strong> {tp.instructions}
                </p>
              ) : null}
              {medRows.length > 0 ? (
                <div className="patient-details-du-table-wrap patient-details-du-table-wrap--tight">
                  <p className="patient-details-du-inline-label">Medicines</p>
                  <table className="patient-details-du-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Dosage</th>
                        <th>Duration</th>
                        <th>Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medRows.map((row) => (
                        <tr key={`${rowKeyPrefix}${row.key}`}>
                          <td>{row.name || '—'}</td>
                          <td>{row.dosage || '—'}</td>
                          <td>{row.duration || '—'}</td>
                          <td>{row.mode || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          );

        return (
          <Fragment>
            <section className="patient-details-card patient-details-card--activeBlock">
              <header className="patient-details-cardHeader patient-details-cardHeader--split">
                <div className="patient-details-cardTitle">
                  <span className="patient-details-cardIcon patient-details-cardIconAlt">
                    <MdEditNote className="patient-details-cardIconSvg" />
                  </span>
                  <div className="patient-details-cardTitleText">
                    <h2 className="patient-details-cardH2">Doctor updates</h2>
                    <p className="patient-details-cardP">Daily notes and treatment plan from the treating doctor (read-only)</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="patient-details-btn patient-details-btn-secondary patient-details-btn-compact"
                  onClick={() => loadDoctorUpdates()}
                  disabled={doctorUpdatesLoading || !admissionId}
                >
                  {doctorUpdatesLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </header>
              <div className="patient-details-cardBody patient-details-cardBody--du">
                {doctorUpdatesError ? <p className="patient-details-error-text">{doctorUpdatesError}</p> : null}
                {doctorUpdatesData === null && !doctorUpdatesError ? (
                  <p className="patient-details-muted">Loading…</p>
                ) : null}
                {doctorUpdatesData != null ? (
                  <>
                    <div className="patient-details-du-section">
                      <h3 className="patient-details-du-section-title patient-details-du-desktop-only">Daily notes</h3>
                      <div className="patient-details-du-mobile-bar">
                        <div className="patient-details-du-mobile-bar-text">
                          <p className="patient-details-du-mobile-bar-title">Daily notes</p>
                          <p className="patient-details-muted patient-details-du-mobile-bar-sub">
                            {daily.length === 0 ? 'No entries yet' : `${daily.length} note(s)`}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="patient-details-btn patient-details-btn-primary patient-details-btn-compact"
                          onClick={() => setDoctorUpdatesModal('daily')}
                        >
                          View
                        </button>
                      </div>
                      <div className="patient-details-du-desktop-only">
                        <div className="patient-details-du-table-wrap">{renderDailyNotesTable('du-inline-')}</div>
                      </div>
                    </div>
                    <div className="patient-details-du-section patient-details-du-section--bordered">
                      <h3 className="patient-details-du-section-title patient-details-du-desktop-only">Treatment plan</h3>
                      <div className="patient-details-du-mobile-bar">
                        <div className="patient-details-du-mobile-bar-text">
                          <p className="patient-details-du-mobile-bar-title">Treatment plan</p>
                          <p className="patient-details-muted patient-details-du-mobile-bar-sub">
                            {tp ? 'Plan on file — tap to read' : 'No plan on file'}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="patient-details-btn patient-details-btn-primary patient-details-btn-compact"
                          onClick={() => setDoctorUpdatesModal('treatment')}
                        >
                          View
                        </button>
                      </div>
                      <div className="patient-details-du-desktop-only">{renderTreatmentPlanBody('du-inline-')}</div>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            {doctorUpdatesModal === 'daily' && doctorUpdatesData != null ? (
              <div
                className="patient-details-modal-overlay patient-details-du-modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="patient-details-du-modal-daily-title"
                onClick={() => setDoctorUpdatesModal(null)}
              >
                <div className="patient-details-modal patient-details-du-view-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="patient-details-modal-header">
                    <p id="patient-details-du-modal-daily-title" className="patient-details-modal-title">
                      Daily notes
                    </p>
                    <button type="button" className="patient-details-btn patient-details-btn-ghost" onClick={() => setDoctorUpdatesModal(null)}>
                      Close
                    </button>
                  </div>
                  <div className="patient-details-modal-body patient-details-du-modal-body-scroll">
                    <div className="patient-details-du-table-wrap">{renderDailyNotesTable('du-modal-')}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {doctorUpdatesModal === 'treatment' && doctorUpdatesData != null ? (
              <div
                className="patient-details-modal-overlay patient-details-du-modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="patient-details-du-modal-tp-title"
                onClick={() => setDoctorUpdatesModal(null)}
              >
                <div className="patient-details-modal patient-details-du-view-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="patient-details-modal-header">
                    <p id="patient-details-du-modal-tp-title" className="patient-details-modal-title">
                      Treatment plan
                    </p>
                    <button type="button" className="patient-details-btn patient-details-btn-ghost" onClick={() => setDoctorUpdatesModal(null)}>
                      Close
                    </button>
                  </div>
                  <div className="patient-details-modal-body patient-details-du-modal-body-scroll">
                    {renderTreatmentPlanBody('du-modal-')}
                  </div>
                </div>
              </div>
            ) : null}
          </Fragment>
        );
      }
      case 'lab_reports':
        return (
          <section className="patient-details-card patient-details-card--activeBlock">
            <header className="patient-details-cardHeader">
              <div className="patient-details-cardTitle">
                <span className="patient-details-cardIcon patient-details-cardIconAlt">
                  <MdScience className="patient-details-cardIconSvg" />
                </span>
                <div className="patient-details-cardTitleText">
                  <h2 className="patient-details-cardH2">Lab reports</h2>
                  <p className="patient-details-cardP">Completed reports from the lab — print or download PDF</p>
                </div>
              </div>
            </header>
            <div className="patient-details-cardBody patient-details-cardBody--lab-embed">
              <PatientLabReportsPanel patientId={patient.id} embedded />
            </div>
          </section>
        );
      default:
        return (
          <NurseAdmissionPanel
            ward={patient.ward}
            doctorName={patient.doctor}
            admissionAtIso={patient.admissionAtIso}
            admissionDate={patient.admissionDate}
          />
        );
    }
  };

  return (
    <div className="patient-details-container">
      <div className="patient-details-workspace patient-details-workspace--stack-full">
        <section className="patient-details-card patient-details-card-top">
          <div className="patient-details-cardBody patient-details-cardBody--compact">
                <div className="patient-details-top-row patient-details-top-row--split">
                  <div className="patient-details-top-left">
                    <h3 className="patient-details-title">{patient.name}</h3>
                    <p className="patient-details-subtitle">
                      <span className="patient-details-mono">{patient.uhid}</span> · {patient.age}y · {patient.gender}
                    </p>
                  </div>
                  <span className={statusMeta.badgeClass}>{statusMeta.label}</span>
                </div>

                <div className="patient-details-info-grid patient-details-info-grid--compact">
                  <div className="patient-details-info-item">
                    <p className="patient-details-info-label">Ward</p>
                    <p className="patient-details-info-value">{patient.ward}</p>
                  </div>
                  <div className="patient-details-info-item">
                    <p className="patient-details-info-label">Bed</p>
                    <p className="patient-details-info-value patient-details-mono">{patient.bed}</p>
                  </div>
                  <div className="patient-details-info-item">
                    <p className="patient-details-info-label">Doctor</p>
                    <p className="patient-details-info-value">{patient.doctor}</p>
                  </div>
                  <div className="patient-details-info-item">
                    <p className="patient-details-info-label">Admission</p>
                    <p className="patient-details-info-value patient-details-mono">{patient.admissionDate}</p>
                  </div>
                </div>

                <div className="patient-details-vitals-inline">
                  <div className="patient-details-vitals-inline-head">
                    <div className="patient-details-cardTitle patient-details-cardTitle--inline">
                      <span className="patient-details-cardIcon patient-details-cardIconAlt patient-details-cardIcon--sm">
                        <MdMonitorHeart className="patient-details-cardIconSvg" />
                      </span>
                      <h2 className="patient-details-cardH2 patient-details-cardH2--inline">Vitals</h2>
                    </div>
                    {!vitalsEditOpen ? (
                      <button
                        type="button"
                        className="patient-details-btn patient-details-btn-secondary patient-details-btn-compact"
                        onClick={() => setVitalsEditOpen(true)}
                      >
                        Update
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="patient-details-btn patient-details-btn-secondary patient-details-btn-compact"
                        onClick={() => setVitalsEditOpen(false)}
                      >
                        Done
                      </button>
                    )}
                  </div>
                  {!vitalsEditOpen ? (
                    <div className="patient-details-vitals-grid patient-details-vitals-grid--left">
                      <div className="patient-details-vitals-item">
                        <p className="patient-details-vitals-label">BP</p>
                        <p className="patient-details-vitals-value patient-details-mono">{draft.vitals.bp || '—'}</p>
                      </div>
                      <div className="patient-details-vitals-item">
                        <p className="patient-details-vitals-label">Temp</p>
                        <p className="patient-details-vitals-value patient-details-mono">{draft.vitals.temperature || '—'}</p>
                      </div>
                      <div className="patient-details-vitals-item">
                        <p className="patient-details-vitals-label">Pulse</p>
                        <p className="patient-details-vitals-value patient-details-mono">{draft.vitals.pulse || '—'}</p>
                      </div>
                      <div className="patient-details-vitals-item">
                        <p className="patient-details-vitals-label">SpO₂ / O₂</p>
                        <p className="patient-details-vitals-value patient-details-mono">{draft.vitals.oxygen || '—'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="patient-details-vitals-form patient-details-vitals-form--left">
                      <div className="patient-details-field">
                        <label className="patient-details-field-label" htmlFor="patient-details-bp">
                          BP
                        </label>
                        <input
                          id="patient-details-bp"
                          className="patient-details-input patient-details-mono"
                          value={draft.vitals.bp}
                          onChange={(e) => setDraft((d) => ({ ...d, vitals: { ...d.vitals, bp: e.target.value } }))}
                          placeholder="e.g. 120/80"
                        />
                      </div>
                      <div className="patient-details-field">
                        <label className="patient-details-field-label" htmlFor="patient-details-temp">
                          Temperature
                        </label>
                        <input
                          id="patient-details-temp"
                          className="patient-details-input patient-details-mono"
                          value={draft.vitals.temperature}
                          onChange={(e) => setDraft((d) => ({ ...d, vitals: { ...d.vitals, temperature: e.target.value } }))}
                          placeholder="e.g. 98.6°F"
                        />
                      </div>
                      <div className="patient-details-field">
                        <label className="patient-details-field-label" htmlFor="patient-details-pulse">
                          Pulse
                        </label>
                        <input
                          id="patient-details-pulse"
                          className="patient-details-input patient-details-mono"
                          value={draft.vitals.pulse}
                          onChange={(e) => setDraft((d) => ({ ...d, vitals: { ...d.vitals, pulse: e.target.value } }))}
                          placeholder="e.g. 78"
                        />
                      </div>
                      <div className="patient-details-field">
                        <label className="patient-details-field-label" htmlFor="patient-details-oxygen">
                          SpO₂ / O₂ therapy
                        </label>
                        <input
                          id="patient-details-oxygen"
                          className="patient-details-input patient-details-mono"
                          value={draft.vitals.oxygen}
                          onChange={(e) => setDraft((d) => ({ ...d, vitals: { ...d.vitals, oxygen: e.target.value } }))}
                          placeholder="e.g. 98%"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="patient-details-vitals-inline" style={{ marginTop: 10 }}>
                  <div className="patient-details-vitals-inline-head">
                    <div className="patient-details-cardTitle patient-details-cardTitle--inline">
                      <span className="patient-details-cardIcon patient-details-cardIconAlt patient-details-cardIcon--sm">
                        <MdMonitorHeart className="patient-details-cardIconSvg" />
                      </span>
                      <h2 className="patient-details-cardH2 patient-details-cardH2--inline">Vitals history</h2>
                    </div>
                  </div>
                  <div className="patient-details-du-table-wrap patient-details-du-table-wrap--tight" style={{ marginTop: 8 }}>
                    <table className="patient-details-du-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>BP</th>
                          <th>Temp</th>
                          <th>Pulse</th>
                          <th>SpO₂</th>
                          <th>O₂ / Therapy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(vitalsHistory) && vitalsHistory.length ? (
                          vitalsHistory.map((r) => (
                            <tr key={r.id || r.createdAt}>
                              <td className="patient-details-du-table-nowrap">{formatClinicalDateTime(r.createdAt)}</td>
                              <td className="patient-details-du-table-nowrap">{fmtVitalsCell(r.bp)}</td>
                              <td className="patient-details-du-table-nowrap">
                                {r.temp != null && Number.isFinite(Number(r.temp)) ? `${r.temp}°F` : '—'}
                              </td>
                              <td className="patient-details-du-table-nowrap">{fmtVitalsCell(r.pulse)}</td>
                              <td className="patient-details-du-table-nowrap">{r.spo2 != null ? `${r.spo2}%` : '—'}</td>
                              <td>{String(r.oxygenTherapy || '').trim() || '—'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="patient-details-du-table-empty">
                              No vitals history yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="patient-details-status-section">
                  <p className="patient-details-section-title">Patient status</p>
                  <div className="patient-details-status-form">
                    <div className="patient-details-field">
                      <label className="patient-details-field-label" htmlFor="patient-details-status">
                        Status
                      </label>
                      <select
                        id="patient-details-status"
                        className="patient-details-input"
                        value={draft.status}
                        onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                      >
                        <option value="Stable">Stable</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                    <div className="patient-details-field patient-details-field-wide">
                      <label className="patient-details-field-label" htmlFor="patient-details-diagnosis">
                        Diagnosis
                      </label>
                      <input
                        id="patient-details-diagnosis"
                        className="patient-details-input"
                        value={draft.diagnosis}
                        onChange={(e) => setDraft((d) => ({ ...d, diagnosis: e.target.value }))}
                        placeholder="Short diagnosis…"
                      />
                    </div>
                  </div>
                </div>

                <p className="patient-details-section-title patient-details-section-title--spaced">Sections</p>
                <div className="patient-details-panel-grid patient-details-panel-grid--full">
                  <button
                    type="button"
                    className={`patient-details-panel-pill${activePanel === 'admission' ? ' patient-details-panel-pill--active' : ''}`}
                    onClick={() => setActivePanel('admission')}
                  >
                    Admission (IPD / ICU)
                  </button>
                  <button
                    type="button"
                    className={`patient-details-panel-pill${activePanel === 'assessment' ? ' patient-details-panel-pill--active' : ''}`}
                    onClick={() => setActivePanel('assessment')}
                  >
                    Nursing assessment
                  </button>
                  <button
                    type="button"
                    className={`patient-details-panel-pill${activePanel === 'doctor' ? ' patient-details-panel-pill--active' : ''}`}
                    onClick={() => setActivePanel('doctor')}
                  >
                    Doctor orders
                  </button>
                  <button
                    type="button"
                    className={`patient-details-panel-pill${activePanel === 'tasks' ? ' patient-details-panel-pill--active' : ''}`}
                    onClick={() => setActivePanel('tasks')}
                  >
                    My tasks
                  </button>
                  {isIcuWard ? (
                    <button
                      type="button"
                      className={`patient-details-panel-pill${activePanel === 'icu' ? ' patient-details-panel-pill--active' : ''}`}
                      onClick={() => setActivePanel('icu')}
                    >
                      ICU monitoring
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`patient-details-panel-pill${activePanel === 'medications' ? ' patient-details-panel-pill--active' : ''}`}
                    onClick={() => setActivePanel('medications')}
                  >
                    Medicines (MAR)
                  </button>
                  <button
                    type="button"
                    className={`patient-details-panel-pill${activePanel === 'doctor_updates' ? ' patient-details-panel-pill--active' : ''}`}
                    onClick={() => setActivePanel('doctor_updates')}
                  >
                    Doctor Update
                  </button>
                  <button
                    type="button"
                    className={`patient-details-panel-pill${activePanel === 'lab_reports' ? ' patient-details-panel-pill--active' : ''}`}
                    onClick={() => setActivePanel('lab_reports')}
                  >
                    Lab reports
                  </button>
                </div>

                <div className="patient-details-panel-nav-row">
                  <button
                    type="button"
                    className="patient-details-btn patient-details-btn-secondary"
                    onClick={goPanelPrev}
                    disabled={activePanelIndex <= 0}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="patient-details-btn patient-details-btn-primary"
                    onClick={goPanelNext}
                    disabled={activePanelIndex >= panelOrder.length - 1}
                  >
                    Next
                  </button>
                </div>

                <div className="patient-details-active-wrap" role="region" aria-label="Selected clinical section">
                  <div className="patient-details-active-inner">{renderActiveSection()}</div>
                </div>
              </div>
        </section>

        <div className="patient-details-save-strip">
          <div className="patient-details-save-strip-inner">
            <div className="patient-details-card-actions-left">
              {isDirty ? <span className="patient-details-dirty">Unsaved changes</span> : null}
              {saveMsg ? <span className="patient-details-save-msg">{saveMsg}</span> : null}
            </div>
            <div className="patient-details-save-strip-actions">
              <button type="button" className="patient-details-btn patient-details-btn-info" onClick={handleClickAddNotes} disabled={saving}>
                Add notes
              </button>
              <button type="button" className="patient-details-btn patient-details-btn-secondary" onClick={handleCancel} disabled={saving}>
                Reset
              </button>
              <button
                type="button"
                className="patient-details-btn patient-details-btn-primary"
                onClick={() => handleSave({ redirectToAssigned: true })}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save updates'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmSaveOpen ? (
        <div className="patient-details-modal-overlay" role="dialog" aria-modal="true" onClick={() => setConfirmSaveOpen(false)}>
          <div className="patient-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="patient-details-modal-header">
              <p className="patient-details-modal-title">Save changes?</p>
              <button
                type="button"
                className="patient-details-btn patient-details-btn-ghost"
                onClick={() => {
                  setConfirmSaveOpen(false);
                  setPendingNav(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="patient-details-modal-body">
              <div className="patient-details-confirm-text">
                You have unsaved updates. Please save first to continue to Add Notes.
              </div>
              <div className="patient-details-modal-actions">
                <button
                  type="button"
                  className="patient-details-btn patient-details-btn-secondary"
                  onClick={() => {
                    setConfirmSaveOpen(false);
                    setPendingNav(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="patient-details-btn patient-details-btn-primary"
                  onClick={async () => {
                    await handleSave({ redirectToAssigned: false });
                    setConfirmSaveOpen(false);
                    const next = pendingNav;
                    setPendingNav(null);
                    if (next?.to) navigate(next.to, { state: next.state });
                  }}
                  disabled={saving}
                >
                  Save & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

