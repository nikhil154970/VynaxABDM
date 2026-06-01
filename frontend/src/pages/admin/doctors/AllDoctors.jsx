import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import Pagination from '../../../components/Pagination';
import DoctorTable from '../../../components/DoctorTable';
import Toast from '../../../components/Toast';

export default function AllDoctors() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [toast, setToast] = useState({ type: 'success', message: '' });
  const pageSize = 10;

  const fetchDoctors = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/doctors', { params: { page, pageSize } });
      setDoctors(res.data.doctors || []);
      setPagination(res.data.pagination || { page, totalPages: 1 });
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load doctors');
      setDoctors([]);
      setPagination({ page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors(1);
  }, []);

  const toggleStatus = async (d) => {
    try {
      await api.patch(`/doctors/${d.id}/status`, { isActive: !d.isActive });
      setToast({ type: 'success', message: d.isActive ? 'Doctor disabled' : 'Doctor enabled' });
      await fetchDoctors(pagination.page || 1);
    } catch (e) {
      setToast({ type: 'error', message: e?.response?.data?.message || 'Failed to update status' });
    }
  };

  return (
    <div className="p-6 sm:p-8 bg-[#F5F7FA] min-h-full">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast((t) => ({ ...t, message: '' }))} />
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">All Doctors</h1>
            <p className="text-sm text-gray-500 mt-1">Manage doctors, status, and availability for bookings.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/doctors/add')}
            className="px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-[#E53935] text-white hover:bg-[#d6322f] transition shadow-sm"
          >
            Add Doctor
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 text-rose-700 text-sm rounded-2xl ring-1 ring-rose-100 px-4 py-3">
            {error}
          </div>
        )}

        <DoctorTable
          doctors={doctors}
          loading={loading}
          onEdit={(d) => navigate(`/dashboard/admin/doctors/${d.id}/edit`)}
          onAvailability={(d) => navigate(`/dashboard/admin/doctors/availability?doctorId=${encodeURIComponent(d.id)}`)}
          onToggleStatus={toggleStatus}
        />

        <div className="mt-4">
          <Pagination
            page={pagination.page || 1}
            totalPages={pagination.totalPages || 1}
            onPageChange={(p) => fetchDoctors(p)}
          />
        </div>
      </div>
    </div>
  );
}

