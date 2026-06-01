import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../utils/api';
import DoctorForm from '../../../components/DoctorForm';
import Toast from '../../../components/Toast';

export default function AddDoctor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const title = useMemo(() => (id ? 'Edit Doctor' : 'Add New Doctor'), [id]);
  const mode = id ? 'edit' : 'create';

  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ type: 'success', message: '' });

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/doctors/${id}`);
        if (!mounted) return;
        setInitial(res.data.doctor);
      } catch (e) {
        setToast({ type: 'error', message: e?.response?.data?.message || 'Failed to load doctor' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const submit = async (payload) => {
    setLoading(true);
    try {
      if (id) {
        await api.put(`/doctors/${id}`, payload);
        setToast({ type: 'success', message: 'Doctor updated successfully' });
      } else {
        await api.post('/doctors', payload);
        setToast({ type: 'success', message: 'Doctor created successfully' });
      }
      setTimeout(() => navigate('/dashboard/admin/doctors'), 650);
    } catch (e) {
      const data = e?.response?.data;
      const firstFieldError = Array.isArray(data?.errors) && data.errors.length
        ? `${data.errors[0].field}: ${data.errors[0].message}`
        : '';
      setToast({
        type: 'error',
        message: data?.message
          ? (firstFieldError ? `${data.message} (${firstFieldError})` : data.message)
          : 'Failed to save doctor',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 bg-[#F5F7FA] min-h-full">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast((t) => ({ ...t, message: '' }))} />
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">Create a doctor user account + professional profile.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/doctors')}
            className="px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 transition"
            disabled={loading}
          >
            Back to All Doctors
          </button>
        </div>

        <DoctorForm
          initialValue={initial}
          mode={mode}
          loading={loading}
          onCancel={() => navigate('/dashboard/admin/doctors')}
          onSubmit={submit}
        />
      </div>
    </div>
  );
}

