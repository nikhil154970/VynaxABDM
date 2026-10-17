import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdLocalHospital, MdAdd } from 'react-icons/md';
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
    <div className="p-6 space-y-6">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast((t) => ({ ...t, message: '' }))} />
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdLocalHospital className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">All Doctors</h1>
              <p className="text-xs md:text-sm text-gray-500">
                Manage doctors list, status, and availability for hospital bookings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/doctors/add')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#005f92] active:bg-[#001B48] transition duration-200 cursor-pointer shadow-sm shrink-0"
          >
            <MdAdd className="w-5 h-5" />
            Add Doctor
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-800 text-sm rounded-2xl border border-rose-100 px-4 py-3 font-semibold">
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

