import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../utils/api';
import ConsultationForm from '../../../components/ConsultationForm';
import PatientLabReportsPanel from '../../../components/PatientLabReportsPanel';

function InfoRow({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-extrabold text-gray-600">{k}</span>
      <span className="text-sm font-extrabold text-gray-900 truncate">{v || '—'}</span>
    </div>
  );
}

export default function Consultation() {
  const [params] = useSearchParams();
  const appointmentId = params.get('appointmentId') || '';

  const [appointments, setAppointments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/appointments/doctor');
        if (!alive) return;
        const list = res.data?.appointments || [];
        setAppointments(list);
        const hit = appointmentId ? list.find((x) => x.id === appointmentId) : list[0];
        setSelected(hit || null);
      } catch {
        if (!alive) return;
        setAppointments([]);
        setSelected(null);
      }
    })();
    return () => { alive = false; };
  }, [appointmentId]);

  const patient = useMemo(() => {
    if (!selected) return null;
    return {
      name: selected.patient_name,
      age: selected.patient_age,
      opdNumber: selected.opd_number || selected.opdNumber,
      basicHistory: selected.basic_history,
      patientId: selected.patient_id,
    };
  }, [selected]);

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA]">
      <div className="w-full px-4 sm:px-6 py-4 sm:py-5">
        <div className="w-full max-w-6xl mx-auto space-y-3">
          {/* Patient Info (full width) */}
          <div
            className="w-full rounded-2xl border p-4 sm:p-5"
            style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <p className="text-xs font-extrabold uppercase tracking-wide text-gray-600 mb-3">Patient details</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Name</p>
                <p className="mt-1 text-sm font-extrabold text-gray-900 truncate">{patient?.name || '—'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Age</p>
                <p className="mt-1 text-sm font-extrabold text-gray-900">
                  {typeof patient?.age === 'number' ? String(patient.age) : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">OPD No</p>
                <p className="mt-1 text-sm font-extrabold text-gray-900 font-mono">{patient?.opdNumber || '—'}</p>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-gray-100 bg-slate-50/60 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400">Basic history</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 whitespace-pre-wrap">{patient?.basicHistory || '—'}</p>
            </div>
          </div>

          {patient?.patientId ? (
            <PatientLabReportsPanel patientId={patient.patientId} title="Completed lab reports (read-only)" />
          ) : null}

          {/* Form (full width) */}
          <div
            className="w-full rounded-2xl border p-4 sm:p-5"
            style={{ background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
          >
            {msg ? (
              <div
                className="mb-4 rounded-xl px-4 py-3 text-sm font-semibold"
                style={{ background: 'rgba(0,174,239,0.10)', color: '#0b5b73' }}
              >
                {msg}
              </div>
            ) : null}

            <ConsultationForm
              disabled={!selected || saving}
              onComplete={async (payload) => {
                if (!selected) return;
                setSaving(true);
                setMsg('');
                try {
                  await api.post('/consultations', {
                    appointment_id: selected.id,
                    patient_id: selected.patient_id,
                    selected_tests: Array.isArray(payload.selected_tests) ? payload.selected_tests : [],
                    symptoms: payload.symptoms,
                    diagnosis: payload.diagnosis,
                    prescription: payload.prescription,
                    disposition: payload.disposition,
                    suggestedWardType: payload.suggestedWardType || undefined,
                    follow_up_date: payload.follow_up_date || undefined,
                  });
                  await api.patch(`/appointments/${selected.id}/status`, { status: 'COMPLETED' });
                  setMsg('Completed');
                  return { ok: true };
                } catch (e) {
                  const m = e.response?.data?.message || 'Failed';
                  setMsg(m);
                  return { ok: false, message: m };
                } finally {
                  setSaving(false);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

