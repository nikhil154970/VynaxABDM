import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import PatientTable from '../../../components/PatientTable';

export default function MyPatients() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get('/admissions/doctor');
        if (!alive) return;
        const list = res.data?.admissions || [];
        setRows(list);
        if (!activeId && list[0]?.id) setActiveId(list[0].id);
      } catch {
        if (!alive) return;
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-4" style={{ background: '#F5F7FA' }}>
      <h2 className="text-lg font-extrabold text-gray-900">My Patients</h2>

      <PatientTable
        variant="ipd"
        rows={rows}
        loading={loading}
        activeId={activeId}
        onSelect={(r) => {
          setActiveId(r.id);
          navigate(`/dashboard/doctor/ipd/detail/${r.id}`);
        }}
      />
    </div>
  );
}

