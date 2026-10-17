import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdLocalHospital, MdArrowBack } from 'react-icons/md';
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
    <div className="p-6 space-y-6">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast((t) => ({ ...t, message: '' }))} />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdLocalHospital className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">{title}</h1>
              <p className="text-xs md:text-sm text-gray-500">Create a doctor user account + professional profile.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/doctors')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#0077B6]/20 bg-white text-[#0077B6] hover:border-[#0077B6] hover:bg-sky-50 active:bg-sky-100 transition duration-200 cursor-pointer shadow-sm disabled:opacity-60 shrink-0"
            disabled={loading}
          >
            <MdArrowBack className="w-4 h-4" />
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

