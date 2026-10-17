import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../utils/api';
import PatientSummaryCard from '../../../components/PatientSummaryCard';
import Tabs from '../../../components/Tabs';
import NotesSection from '../../../components/NotesSection';
import TreatmentSection from '../../../components/TreatmentSection';
import PatientLabReportsPanel from '../../../components/PatientLabReportsPanel';

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function PatientDetail() {
  const { id } = useParams();
  const admissionId = id;

  const [admission, setAdmission] = useState(null);
  const [vitalsLatest, setVitalsLatest] = useState(null);
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [historyTimeline, setHistoryTimeline] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [res, vitalsRes] = await Promise.all([
          api.get(`/admissions/${admissionId}`),
          api.get(`/nurse/vitals/${admissionId}`).catch(() => ({ data: null })),
        ]);
        if (!alive) return;
        setAdmission(res.data?.admission || null);
        const payload = vitalsRes?.data && typeof vitalsRes.data === 'object' ? vitalsRes.data : null;
        setVitalsLatest(payload?.latest && typeof payload.latest === 'object' ? payload.latest : null);
        setVitalsHistory(Array.isArray(payload?.history) ? payload.history : []);
      } catch {
        if (!alive) return;
        setAdmission(null);
        setVitalsLatest(null);
        setVitalsHistory([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [admissionId]);

  useEffect(() => {
    if (activeTab !== 'history' || !admissionId) return;
    let alive = true;
    setHistoryLoading(true);
    setHistoryError('');
    (async () => {
      try {
        const res = await api.get(`/admissions/${admissionId}/history`);
        if (!alive) return;
        setHistoryTimeline(Array.isArray(res.data?.timeline) ? res.data.timeline : []);
      } catch (err) {
        if (!alive) return;
        setHistoryError(err?.response?.data?.message || 'Could not load patient history');
      } finally {
        if (alive) setHistoryLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activeTab, admissionId]);

  const tabs = useMemo(
    () => [
      { key: 'overview', label: 'Overview' },
      { key: 'lab', label: 'Lab reports' },
      { key: 'notes', label: 'Daily Notes' },
      { key: 'treatment', label: 'Treatment Plan' },
      { key: 'history', label: 'History' },
    ],
    []
  );

  const patientUuid = admission?.patient_id || admission?.patientId || null;

  if (loading) {
    return (
      <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
        <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
          <div className="rounded-2xl border border-gray-100 bg-white p-12 shadow-sm flex flex-col items-center justify-center gap-3 text-gray-500 font-semibold text-sm">
            <div className="w-8 h-8 border-3 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
            Loading patient file...
          </div>
        </div>
      </div>
    );
  }

  if (!admission) {
    return (
      <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
        <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500 font-semibold text-sm shadow-sm">
            Admission details not found. Please review the patient IPD index.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Patient Summary Header Card */}
        <PatientSummaryCard patient={admission} />

        {/* Tab Controls Bar */}
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        </div>

        {/* Dynamic Tab Contents */}
        <div className="min-h-[200px]">
          {activeTab === 'overview' && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
              {/* Diagnosis and Condition blocks */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/30">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Diagnosis Summary</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1.5">{admission.diagnosis || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/30">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Condition</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1.5">{admission.clinical_condition || admission.clinicalCondition || '—'}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/30">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Admission Notes</p>
                  <p className="text-sm font-semibold text-gray-800 mt-1.5 whitespace-pre-wrap leading-relaxed">
                    {admission.basic_history || '—'}
                  </p>
                </div>
              </div>

              {/* Latest Vitals metrics */}
              <div className="pt-2">
                <p className="text-xs font-extrabold text-[#001B48] uppercase tracking-wider mb-3">Latest Vitals</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 shadow-sm hover:shadow transition-all duration-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Blood Pressure</p>
                    <p className="text-base font-extrabold text-[#001B48] mt-1">{vitalsLatest?.bp || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 shadow-sm hover:shadow transition-all duration-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Temperature</p>
                    <p className="text-base font-extrabold text-[#001B48] mt-1">
                      {vitalsLatest?.temp != null && Number.isFinite(Number(vitalsLatest.temp)) ? `${vitalsLatest.temp}°F` : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 shadow-sm hover:shadow transition-all duration-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pulse Rate</p>
                    <p className="text-base font-extrabold text-[#001B48] mt-1">
                      {vitalsLatest?.pulse != null ? `${vitalsLatest.pulse} bpm` : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 shadow-sm hover:shadow transition-all duration-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Oxygen level SpO₂</p>
                    <p className="text-base font-extrabold text-[#001B48] mt-1">
                      {vitalsLatest?.oxygenTherapy || (vitalsLatest?.spo2 != null ? `${vitalsLatest.spo2}%` : '—')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Vitals History table */}
              <div className="pt-2">
                <p className="text-xs font-extrabold text-[#001B48] uppercase tracking-wider mb-3">Vitals log history</p>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="min-w-full divide-y divide-gray-100 text-xs">
                    <thead className="bg-gray-50/70">
                      <tr>
                        <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">Time</th>
                        <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">BP (mmHg)</th>
                        <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">Temp (°F)</th>
                        <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">Pulse (bpm)</th>
                        <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">SpO₂ (%)</th>
                        <th className="px-4 py-2.5 font-bold text-gray-500 text-xs uppercase tracking-wider text-left bg-gray-50">O₂ Therapy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {Array.isArray(vitalsHistory) && vitalsHistory.length ? (
                        vitalsHistory.map((r) => (
                          <tr key={r.id || r.createdAt} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 font-medium text-gray-500">{fmtDateTime(r.createdAt)}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-900">{r.bp || '—'}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-900">
                              {r.temp != null && Number.isFinite(Number(r.temp)) ? `${r.temp}°F` : '—'}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-gray-900">{r.pulse != null ? String(r.pulse) : '—'}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-900">{r.spo2 != null ? `${r.spo2}%` : '—'}</td>
                            <td className="px-4 py-2.5 text-gray-700 font-medium">{r.oxygenTherapy || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-gray-500 font-semibold bg-white">
                            No vitals recorded for this patient.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lab' && (patientUuid ? (
            <PatientLabReportsPanel patientId={patientUuid} title="Completed lab reports (read-only)" />
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-gray-500 font-semibold text-sm shadow-sm">
              Patient ID is not linked to this admission records.
            </div>
          ))}

          {activeTab === 'notes' && <NotesSection admissionId={admissionId} />}

          {activeTab === 'treatment' && <TreatmentSection admissionId={admissionId} />}

          {activeTab === 'history' && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
              <h2 className="text-base font-extrabold text-[#001B48]">Patient Admission History</h2>
              {historyLoading ? (
                <p className="text-sm text-gray-500 font-semibold">Loading history...</p>
              ) : historyError ? (
                <p className="text-sm text-red-500 font-semibold">{historyError}</p>
              ) : historyTimeline.length === 0 ? (
                <p className="text-sm text-gray-500 font-semibold">No history entries logged for this admission yet.</p>
              ) : (
                <div className="relative border-l-2 border-slate-100 ml-3 space-y-8 pl-6">
                  {historyTimeline.map((item) => (
                    <div key={item.id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-4 ring-slate-50">
                        <span className={`h-2 w-2 rounded-full ${
                          item.type === 'TREATMENT_PLAN' ? 'bg-amber-500' :
                          item.type === 'DOCTOR_NOTE' ? 'bg-[#0077B6]' :
                          item.type === 'VITALS' ? 'bg-indigo-500' : 'bg-emerald-500'
                        }`} />
                      </span>

                      {/* Content block */}
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {fmtDateTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-500">
                          By <span className="text-[#0077B6]">{item.authorName}</span>
                        </p>

                        {/* Note/Description text */}
                        {item.description && (
                          <div className="mt-2 text-sm font-extrabold text-[#001B48] bg-slate-50 border border-slate-200/50 rounded-xl p-3.5 leading-relaxed whitespace-pre-wrap shadow-xs">
                            {item.description}
                          </div>
                        )}

                        {/* Instructions & Medicines for treatment plan */}
                        {item.type === 'TREATMENT_PLAN' && (
                          <div className="mt-2 space-y-2 pl-2">
                            {item.instructions && (
                              <p className="text-xs font-medium text-gray-600">
                                <span className="font-bold text-gray-800">Instructions:</span> {item.instructions}
                              </p>
                            )}
                            {Array.isArray(item.medicines) && item.medicines.length > 0 && (
                              <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                                <table className="min-w-full divide-y divide-gray-100 text-[11px]">
                                  <thead className="bg-gray-50/50">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Medicine</th>
                                      <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Dosage</th>
                                      <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                                      <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Mode</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {item.medicines.map((m, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-2 font-bold text-gray-800">{m.medicine || m.name || '—'}</td>
                                        <td className="px-3 py-2 text-gray-700 font-semibold">{m.dosage || '—'}</td>
                                        <td className="px-3 py-2 text-gray-700 font-semibold">{m.duration || '—'}</td>
                                        <td className="px-3 py-2 text-gray-700 font-semibold">{m.mode || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
