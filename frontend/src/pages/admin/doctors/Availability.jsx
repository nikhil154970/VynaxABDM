import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../utils/api';
import AvailabilityScheduler from '../../../components/AvailabilityScheduler';
import Toast from '../../../components/Toast';

export default function Availability() {
  const [searchParams] = useSearchParams();
  const [toast, setToast] = useState({ type: 'success', message: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [slots, setSlots] = useState([]);

  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === doctorId), [doctors, doctorId]);

  const loadDoctors = async () => {
    setLoading(true);
    try {
      const res = await api.get('/doctors', { params: { page: 1, pageSize: 100 } });
      setDoctors(res.data.doctors || []);
    } catch (e) {
      setToast({ type: 'error', message: e?.response?.data?.message || 'Failed to load doctors' });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/doctors/${id}/availability`);
      setSlots(res.data.slots || []);
    } catch (e) {
      setToast({ type: 'error', message: e?.response?.data?.message || 'Failed to load availability' });
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  // Preselect doctor when coming from All Doctors action button.
  useEffect(() => {
    const qp = searchParams.get('doctorId');
    if (qp && !doctorId) setDoctorId(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (doctorId) loadAvailability(doctorId);
  }, [doctorId]);

  const save = async () => {
    if (!doctorId) {
      setToast({ type: 'error', message: 'Please select a doctor first' });
      return;
    }
    setSaving(true);
    try {
      await api.post(`/doctors/${doctorId}/availability`, { slots });
      setToast({ type: 'success', message: 'Availability saved' });
      await loadAvailability(doctorId);
    } catch (e) {
      setToast({ type: 'error', message: e?.response?.data?.message || 'Failed to save availability' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 bg-[#F5F7FA] min-h-full">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast((t) => ({ ...t, message: '' }))} />
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Doctor Availability</h1>
            <p className="text-sm text-gray-500 mt-1">Weekly schedule required for appointment booking.</p>
          </div>
          <button
            type="button"
            onClick={save}
            className="px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-[#E53935] text-white hover:bg-[#d6322f] transition shadow-sm disabled:opacity-60"
            disabled={saving || loading || !doctorId}
          >
            {saving ? 'Saving…' : 'Save Availability'}
          </button>
        </div>

        <div className="mb-4 bg-white rounded-3xl ring-1 ring-black/5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)] px-6 sm:px-8 py-5">
          <label className="block text-sm font-extrabold text-gray-800 mb-2">Select Doctor</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl ring-1 ring-gray-200 focus:ring-2 focus:ring-[#00AEEF] outline-none transition bg-white"
            disabled={loading}
          >
            <option value="">{loading ? 'Loading doctors…' : 'Choose a doctor'}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.specialization} {d.isActive ? '' : '(Inactive)'}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            {selectedDoctor ? `Editing schedule for ${selectedDoctor.name}` : 'Pick a doctor to view/edit weekly schedule.'}
          </p>
        </div>

        <AvailabilityScheduler
          doctorLabel={selectedDoctor ? `${selectedDoctor.name} · ${selectedDoctor.specialization}` : 'Select a doctor to begin'}
          slots={slots}
          loading={loading}
          onChange={setSlots}
        />
      </div>
    </div>
  );
}

