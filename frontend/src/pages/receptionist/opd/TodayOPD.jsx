import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdPerson,
  MdPlayArrow,
  MdCheckCircle,
  MdClose,
  MdBed,
  MdGroups,
  MdHourglassEmpty,
  MdDoneAll,
  MdLocalPharmacy,
  MdReceiptLong,
} from 'react-icons/md';
import { createPortal } from 'react-dom';
import '../patients/PatientList.css';
import api from '../../../utils/api';
import Toast from '../../../components/Toast';
import SendToPharmacyModal from '../../../components/receptionist/SendToPharmacyModal';

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const STATUS_META = {
  Waiting: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  'In Consultation': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  Completed: { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
};

const DISP_BADGE = {
  NORMAL: { bg: '#f1f5f9', text: '#334155', dot: '#94a3b8', label: 'Normal' },
  REFER_ADMIT: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444', label: 'Refer for Admit' },
};

function labLabelsFromConsultation(consultation) {
  const raw = consultation?.labTests;
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const x of arr) {
    if (x && typeof x === 'object') {
      const n = x.testName || x.name || x.labTest || x.label;
      if (n) out.push(String(n).trim());
    }
  }
  return out.filter(Boolean);
}

const opdApi = {
  async getToday(dateISO) {
    const res = await api.get('/receptionist/opd/today', { params: { date: dateISO || undefined } });
    return Array.isArray(res?.data?.items) ? res.data.items : [];
  },
};

export default function OPDManagement() {
  const navigate = useNavigate();
  const todayISO = toISODate(new Date());

  const [opdPatients, setOpdPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [toast, setToast] = useState({ type: 'success', message: '' });
  const [sendOpen, setSendOpen] = useState(false);
  const [pharmacyContext, setPharmacyContext] = useState(null);
  const [pharmacyPrefill, setPharmacyPrefill] = useState([]);

  const tokenNumber = (t) => {
    const n = Number(String(t || '').replace(/\D+/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const fetchOPDPatients = async () => {
    setLoading(true);
    try {
      const list = await opdApi.getToday(todayISO);
      setOpdPatients(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOPDPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: realtime/auto-reshuffle removed; backend is source of truth now.

  const stats = useMemo(() => {
    const total = opdPatients.length;
    const waiting = opdPatients.filter((p) => p.status === 'Waiting').length;
    const consulting = opdPatients.filter((p) => p.status === 'In Consultation').length;
    const completed = opdPatients.filter((p) => p.status === 'Completed').length;
    return { total, waiting, consulting, completed };
  }, [opdPatients]);

  const doctorWise = useMemo(() => {
    const map = new Map();
    for (const p of opdPatients) {
      const k = p.doctor || '—';
      const cur = map.get(k) || { waiting: 0, total: 0 };
      cur.total += 1;
      if (p.status === 'Waiting') cur.waiting += 1;
      map.set(k, cur);
    }
    return Array.from(map.entries()).map(([doctor, meta]) => ({ doctor, ...meta })).sort((a, b) => b.waiting - a.waiting);
  }, [opdPatients]);

  const handleAdmitPatient = (p) => {
    if (!p?.uhid) return;
    navigate('/dashboard/reception/ipd/admit', {
      state: {
        prefillPatient: {
          patientId: p.patientId || null,
          uhid: p.uhid,
          name: p.patientName,
          mobile: p.mobile || '',
          age: p.age ?? '',
          gender: p.gender || '',
        },
        prefillAdmission: {
          department: p.department || '',
          doctorId: p.doctorId || null,
        },
      },
    });
  };

  const handleViewDetails = async (p) => {
    // Open existing patient details screen (or keep modal later)
    setIsModalOpen(true);
    setSelected(p || null);
  };

  const openSendToPharmacy = (p) => {
    if (!p?.patientId) {
      setToast({ type: 'error', message: 'Patient not found' });
      return;
    }
    if (!p?.token) {
      setToast({ type: 'error', message: 'Token number missing for this visit' });
      return;
    }
    const rx = Array.isArray(p?.consultation?.prescription) ? p.consultation.prescription : [];
    setPharmacyPrefill(rx);
    setPharmacyContext({
      patientId: p.patientId,
      doctorId: p.doctorId || undefined,
      prescriptionId: p.consultation?.id || undefined,
      tokenNumber: String(p.token),
      patientName: p.patientName,
      uhid: p.uhid,
    });
    setSendOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ ...toast, message: '' })} />
      <div className="p-6 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total OPD Patients Today', value: stats.total, icon: MdGroups, bg: '#0f2d5e', light: '#dbeafe' },
            { label: 'Waiting Patients', value: stats.waiting, icon: MdHourglassEmpty, bg: '#854d0e', light: '#fef3c7' },
            { label: 'In Consultation', value: stats.consulting, icon: MdPlayArrow, bg: '#1d4ed8', light: '#dbeafe' },
            { label: 'Completed Patients', value: stats.completed, icon: MdDoneAll, bg: '#14532d', light: '#dcfce7' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.light }}>
                    <Icon className="w-5 h-5" style={{ color: s.bg }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-extrabold text-gray-900 leading-tight">{s.value}</p>
                    <p className="text-xs font-semibold text-gray-600 mt-0.5 truncate">{s.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Doctor-wise View (optional) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-extrabold text-gray-900">Doctor-wise Waiting</p>
            <p className="text-xs text-gray-400">{doctorWise.length} doctors</p>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
            {doctorWise.map((d) => (
              <div key={d.doctor} className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-extrabold text-gray-900 truncate">{d.doctor}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Waiting: <span className="font-extrabold text-gray-800">{d.waiting}</span> · Total:{' '}
                  <span className="font-extrabold text-gray-800">{d.total}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* OPD Table (full width) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-extrabold text-gray-900">OPD Patient List</p>
            <button
              type="button"
              onClick={fetchOPDPatients}
              className="px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
              disabled={loading}
              title="Refresh"
            >
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr style={{ background: '#f8faff', position: 'sticky', top: 0, zIndex: 1 }}>
                  {['Token', 'Patient', 'OPD No', 'Doctor', 'Time Slot', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Loading OPD…</td></tr>
                ) : opdPatients.map((p) => {
                  const s = STATUS_META[p.status] || STATUS_META.Waiting;
                  const isActive = p.status === 'In Consultation';
                  return (
                    <tr key={p.id} className={`transition ${isActive ? '' : 'hover:bg-blue-50/30'}`}>
                      <td className="px-3 py-2 align-top">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{p.token}</span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <MdPerson className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{p.patientName}</p>
                            <p className="text-xs text-gray-400 truncate">{todayISO}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md whitespace-nowrap"
                          title={p.uhid ? `UHID: ${p.uhid}` : ''}
                        >
                          {p.opdNumber || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-gray-600">{p.doctor}</td>
                      <td className="px-3 py-2 align-top text-xs text-gray-600">{p.timeSlot}</td>
                      <td className="px-3 py-2 align-top">
                        <span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700 whitespace-nowrap">
                          <span className="pl-dot" style={{ background: s.dot }} />
                          {p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(p)}
                            className="px-3 py-1.5 rounded-xl text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                            title="View details, advised lab tests & lab billing"
                          >
                            View
                          </button>
                          {(() => {
                            const disp = p.consultation?.disposition;
                            const canAdmit = !disp || disp === 'REFER_ADMIT';
                            if (!canAdmit) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => handleAdmitPatient(p)}
                                className="px-3 py-1.5 rounded-xl text-xs font-extrabold border border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100 transition"
                                title="Admit Patient (OPD → IPD)"
                              >
                                Admit
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

            {!loading && opdPatients.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <MdPerson className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No OPD patients found</p>
              </div>
            ) : null}
          </div>
      </div>

      {/* Patient Detail Modal */}
      {isModalOpen
        ? createPortal(
          <div className="pl-modalOverlay" role="dialog" aria-modal="true">
            <div className="pl-modal pl-modalAnimate">
              <div className="pl-modalHeader">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{selected?.patientName || 'Loading…'}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    OPD: <span className="font-mono font-bold text-blue-600">{selected?.opdNumber || '—'}</span> · Token:{' '}
                    <span className="font-mono font-bold text-blue-600">{selected?.token || '—'}</span> · UHID:{' '}
                    <span className="font-mono font-bold text-blue-600">{selected?.uhid || '—'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="pl-modalClose"
                  title="Close"
                >
                  <MdClose className="w-5 h-5" />
                </button>
              </div>

              <div className="pl-modalBody">
                <div className="pl-modalGrid">
                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Patient Basic Info</p>
                    <div className="pl-kv">
                      <div><p className="k">Patient Name</p><p className="v">{selected?.patientName || '—'}</p></div>
                      <div><p className="k">OPD No</p><p className="v font-mono">{selected?.opdNumber || '—'}</p></div>
                      <div><p className="k">Token</p><p className="v font-mono">{selected?.token || '—'}</p></div>
                      <div><p className="k">UHID</p><p className="v font-mono">{selected?.uhid || '—'}</p></div>
                      <div><p className="k">Visit Type</p><p className="v">{selected?.visitType || 'OPD'}</p></div>
                    </div>
                  </div>

                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Appointment Details</p>
                    <div className="pl-kv">
                      <div><p className="k">Doctor</p><p className="v">{selected?.doctor || '—'}</p></div>
                      <div><p className="k">Time Slot</p><p className="v">{selected?.timeSlot || '—'}</p></div>
                      <div><p className="k">Status</p><p className="v">{selected?.status || '—'}</p></div>
                      <div><p className="k">Date</p><p className="v">{todayISO}</p></div>
                    </div>
                  </div>

                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Doctor Notes</p>
                    <div className="pl-kv">
                      <div className="colspan2">
                        <p className="k">Doctor&apos;s decision</p>
                        {(() => {
                          const disp = selected?.consultation?.disposition || 'NORMAL';
                          const meta = DISP_BADGE[disp] || DISP_BADGE.NORMAL;
                          return (
                            <span
                              className="inline-flex items-center gap-2 text-xs font-extrabold whitespace-nowrap px-2 py-1 rounded-full"
                              style={{ background: meta.bg, color: meta.text }}
                            >
                              <span className="pl-dot" style={{ background: meta.dot }} />
                              {meta.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="colspan2">
                        <p className="k">Diagnosis</p>
                        <p className="v">{selected?.consultation?.diagnosis || '—'}</p>
                      </div>
                      <div className="colspan2">
                        <p className="k">Symptoms</p>
                        <p className="v">{selected?.consultation?.symptoms || '—'}</p>
                      </div>
                      <div className="colspan2">
                        <p className="k">Advised lab tests</p>
                        {labLabelsFromConsultation(selected?.consultation).length ? (
                          <ul className="flex flex-wrap gap-1.5 mt-1">
                            {labLabelsFromConsultation(selected?.consultation).map((name, i) => (
                              <li key={i} className="text-xs font-semibold bg-cyan-50 border border-cyan-100 rounded-lg px-2 py-0.5 text-gray-800">
                                {name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="v">—</p>
                        )}
                      </div>
                      <div className="colspan2">
                        <p className="k">Medicines</p>
                        {Array.isArray(selected?.consultation?.prescription) && selected.consultation.prescription.length ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  <th className="pb-2 pr-2">Medicine</th>
                                  <th className="pb-2 pr-2">Dosage</th>
                                  <th className="pb-2 pr-2">Duration</th>
                                  <th className="pb-2">Mode</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selected.consultation.prescription.map((m, i) => (
                                  <tr key={i} className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                    <td className="py-2 pr-2 font-semibold text-gray-900">{m?.medicine || m?.name || '—'}</td>
                                    <td className="py-2 pr-2 text-gray-700">{m?.dosage || '—'}</td>
                                    <td className="py-2 pr-2 text-gray-700">{m?.duration || '—'}</td>
                                    <td className="py-2 text-gray-700">{m?.mode || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="v">—</p>
                        )}
                      </div>
                      <div className="colspan2">
                        <p className="k">Follow-up date</p>
                        <p className="v">
                          {selected?.consultation?.followUpDate ? new Date(selected.consultation.followUpDate).toLocaleDateString('en-IN') : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Lab & billing</p>
                    <div className="pl-kv">
                      <div className="colspan2">
                        <p className="k">OPD lab billing</p>
                        <p className="v text-xs">Use <b>Lab billing</b> below to bill advised tests from this visit.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pl-modalActions">
                  <button
                    type="button"
                    className="pl-actionBtn"
                    style={{ background: '#00AEEF', color: '#fff', borderColor: 'transparent' }}
                    onClick={() => {
                      if (!selected?.uhid) return;
                      navigate(`/dashboard/reception/lab/advised?uhid=${encodeURIComponent(selected.uhid)}`);
                      setIsModalOpen(false);
                    }}
                    disabled={!selected?.uhid}
                  >
                    <MdReceiptLong className="w-4 h-4" /> Lab billing
                  </button>
                  <button
                    type="button"
                    className="pl-actionBtn"
                    onClick={() => openSendToPharmacy(selected)}
                    disabled={!selected?.patientId}
                    title="Send patient medicines to Pharmacy Billing queue"
                  >
                    <MdLocalPharmacy className="w-4 h-4" /> Send To Pharmacy
                  </button>
                  {(() => {
                    const disp = selected?.consultation?.disposition;
                    const canAdmit = !disp || disp === 'REFER_ADMIT';
                    if (!canAdmit) return null;
                    return (
                      <button
                        type="button"
                        className="pl-actionBtn"
                        onClick={() => handleAdmitPatient(selected)}
                      >
                        <MdBed className="w-4 h-4" /> Admit Patient
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}

      <SendToPharmacyModal
        open={sendOpen}
        onClose={() => {
          setSendOpen(false);
          setPharmacyContext(null);
          setPharmacyPrefill([]);
        }}
        context={pharmacyContext}
        prefillItems={pharmacyPrefill}
        onSuccess={() => setToast({ type: 'success', message: 'Sent to Pharmacy queue' })}
      />
    </div>
  );
}
