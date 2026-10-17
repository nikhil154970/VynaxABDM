import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import PatientTable from '../../../components/PatientTable';
import { MdPeople, MdRefresh } from 'react-icons/md';

export default function AssignedPatients() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState('');

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments/doctor');
      const appts = res.data?.appointments || [];
      setRows(appts);
      setActiveId((prev) => prev || appts[0]?.id || '');
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Keep list fresh when returning from Consultation page.
  useEffect(() => {
    const onFocus = () => fetchAppointments();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchAppointments]);

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdPeople className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Assigned Patients (OPD)</h1>
          
            </div>
          </div>
          <button
            type="button"
            onClick={fetchAppointments}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0077B6] border border-blue-150 bg-blue-50/50 hover:bg-blue-50 active:scale-95 transition-all duration-200 shrink-0 self-start sm:self-auto"
          >
            <MdRefresh className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Patient Table component */}
        <PatientTable
          rows={rows}
          loading={loading}
          activeId={activeId}
          variant="opd"
          onSelect={(r) => {
            setActiveId(r.id);
            navigate(`/dashboard/doctor/opd/consultation?appointmentId=${encodeURIComponent(r.id)}`);
          }}
        />
      </div>
    </div>
  );
}
