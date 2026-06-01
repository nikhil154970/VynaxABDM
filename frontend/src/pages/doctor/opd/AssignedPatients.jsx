import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import PatientTable from '../../../components/PatientTable';

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
    <div className="p-6 space-y-4" style={{ background: '#F5F7FA' }}>
      <h2 className="text-lg font-extrabold text-gray-900">Assigned Patients</h2>

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
  );
}

