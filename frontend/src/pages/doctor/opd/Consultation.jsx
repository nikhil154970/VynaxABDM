import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../utils/api';
import ConsultationForm from '../../../components/ConsultationForm';
import PatientLabReportsPanel from '../../../components/PatientLabReportsPanel';
import AbdmHealthDocumentStatus from '../../../components/abdm/AbdmHealthDocumentStatus';
import AbdmPatientRecordSync from '../../../components/abdm/AbdmPatientRecordSync';
import { MdLocalHospital } from 'react-icons/md';

export default function Consultation() {
  const [params] = useSearchParams();
  const appointmentId = params.get('appointmentId') || '';

  const [appointments, setAppointments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [abdmSourceId, setAbdmSourceId] = useState('');

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
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex items-center gap-4 border-b border-gray-200 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
            <MdLocalHospital className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Patient Consultation</h1>
         
          </div>
        </div>

        {/* Patient Info Card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Patient details</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Patient Name</p>
              <p className="mt-1 text-sm font-extrabold text-gray-900 truncate">{patient?.name || '—'}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Age (Years)</p>
              <p className="mt-1 text-sm font-extrabold text-gray-900">
                {typeof patient?.age === 'number' ? String(patient.age) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">OPD No</p>
              <p className="mt-1 text-sm font-extrabold text-[#0077B6] font-mono">{patient?.opdNumber || '—'}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Basic history</p>
            <p className="mt-1 text-sm font-semibold text-gray-800 whitespace-pre-wrap leading-relaxed">{patient?.basicHistory || 'No history recorded.'}</p>
          </div>
        </div>

        {/* Patient Lab Reports Panel */}
        {patient?.patientId ? (
          <PatientLabReportsPanel patientId={patient.patientId} title="Completed lab reports (read-only)" />
        ) : null}

        {/* Consultation Form Wrapper */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          {msg ? (
            <div
              className="mb-4 rounded-xl px-4 py-3 text-sm font-semibold border"
              style={{
                background: msg === 'Completed' ? 'rgba(22,163,74,0.1)' : 'rgba(0,119,182,0.1)',
                color: msg === 'Completed' ? '#16A34A' : '#0077B6',
                borderColor: msg === 'Completed' ? 'rgba(22,163,74,0.15)' : 'rgba(0,119,182,0.15)',
              }}
            >
              {msg}
            </div>
          ) : null}

          {abdmSourceId ? <AbdmHealthDocumentStatus sourceId={abdmSourceId} /> : null}
          {patient?.patientId ? <AbdmPatientRecordSync patientId={patient.patientId} /> : null}

          <ConsultationForm
            disabled={!selected || saving}
            onComplete={async (payload) => {
              if (!selected) return;
              setSaving(true);
              setMsg('');
              try {
                const created = await api.post('/consultations', {
                  appointment_id: selected.id,
                  patient_id: selected.patient_id,
                  selected_tests: Array.isArray(payload.selected_tests) ? payload.selected_tests : [],
                  symptoms: payload.symptoms,
                  diagnosis: payload.diagnosis,
                  prescription: payload.prescription,
                  disposition: payload.disposition,
                  suggestedWardType: payload.suggestedWardType || undefined,
                  referredDepartment: payload.referredDepartment || undefined,
                  referredDoctorId: payload.referredDoctorId || undefined,
                  follow_up_date: payload.follow_up_date || undefined,
                });
                await api.patch(`/appointments/${selected.id}/status`, { status: 'COMPLETED' });
                setAbdmSourceId(created?.data?.consultation?.id || '');
                setMsg('Completed');
                return { ok: true };
              } catch (e) {
                const m = e.response?.data?.message || 'Failed to submit consultation logs';
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
  );
}
