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
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PatientDetail() {
  const { id } = useParams();
  const admissionId = id;

  const [admission, setAdmission] = useState(null);
  const [vitalsLatest, setVitalsLatest] = useState(null);
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

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
      <div className="p-6" style={{ background: '#F5F7FA' }}>
        <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!admission) {
    return (
      <div className="p-6" style={{ background: '#F5F7FA' }}>
        <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
          <p className="text-sm text-gray-500">Admission not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4" style={{ background: '#F5F7FA' }}>
      <PatientSummaryCard patient={admission} />

      <div className="rounded-2xl border p-3" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="min-h-[200px]">
        {activeTab === 'overview' && (
          <div className="rounded-2xl border p-5 space-y-3" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
            <div>
              <p className="text-xs font-extrabold text-gray-700">Diagnosis summary</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">—</p>
            </div>
            <div>
              <p className="text-xs font-extrabold text-gray-700">Current condition</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">—</p>
            </div>
            <div>
              <p className="text-xs font-extrabold text-gray-700">Admission notes</p>
              <p className="text-sm font-semibold text-gray-900 mt-1 whitespace-pre-wrap">{admission.basic_history || '—'}</p>
            </div>

            <div className="pt-2">
              <p className="text-xs font-extrabold text-gray-700">Latest vitals</p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-gray-500">BP</p>
                  <p className="text-sm font-extrabold text-gray-900">{vitalsLatest?.bp || '—'}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-gray-500">Temp</p>
                  <p className="text-sm font-extrabold text-gray-900">
                    {vitalsLatest?.temp != null && Number.isFinite(Number(vitalsLatest.temp)) ? `${vitalsLatest.temp}°F` : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-gray-500">Pulse</p>
                  <p className="text-sm font-extrabold text-gray-900">{vitalsLatest?.pulse != null ? String(vitalsLatest.pulse) : '—'}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-gray-500">SpO₂ / O₂</p>
                  <p className="text-sm font-extrabold text-gray-900">
                    {vitalsLatest?.oxygenTherapy || (vitalsLatest?.spo2 != null ? `${vitalsLatest.spo2}%` : '—')}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-xs font-extrabold text-gray-700">Vitals history</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-2 pr-2">Time</th>
                      <th className="pb-2 pr-2">BP</th>
                      <th className="pb-2 pr-2">Temp</th>
                      <th className="pb-2 pr-2">Pulse</th>
                      <th className="pb-2 pr-2">SpO₂</th>
                      <th className="pb-2">O₂ / Therapy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(vitalsHistory) && vitalsHistory.length ? (
                      vitalsHistory.map((r) => (
                        <tr key={r.id || r.createdAt} className="border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                          <td className="py-2 pr-2 font-semibold text-gray-900">{fmtDateTime(r.createdAt)}</td>
                          <td className="py-2 pr-2 text-gray-700">{r.bp || '—'}</td>
                          <td className="py-2 pr-2 text-gray-700">
                            {r.temp != null && Number.isFinite(Number(r.temp)) ? `${r.temp}°F` : '—'}
                          </td>
                          <td className="py-2 pr-2 text-gray-700">{r.pulse != null ? String(r.pulse) : '—'}</td>
                          <td className="py-2 pr-2 text-gray-700">{r.spo2 != null ? `${r.spo2}%` : '—'}</td>
                          <td className="py-2 text-gray-700">{r.oxygenTherapy || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-3 text-gray-500">—</td>
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
          <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
            <p className="text-sm text-gray-500">Patient id not linked on this admission.</p>
          </div>
        ))}

        {activeTab === 'notes' && <NotesSection admissionId={admissionId} />}

        {activeTab === 'treatment' && <TreatmentSection admissionId={admissionId} />}

        {activeTab === 'history' && (
          <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
            <p className="text-sm text-gray-500">Timeline will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

