import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MdCalendarToday, MdSave } from 'react-icons/md';
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
    <div className="p-6 space-y-6">
      <Toast type={toast.type} message={toast.message} onClose={() => setToast((t) => ({ ...t, message: '' }))} />
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdCalendarToday className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Doctor Availability</h1>
              <p className="text-xs md:text-sm text-gray-500">Weekly schedule required for appointment booking.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0077B6] text-white hover:bg-[#005f92] active:bg-[#001B48] transition duration-200 cursor-pointer shadow-sm disabled:opacity-60 shrink-0"
            disabled={saving || loading || !doctorId}
          >
            <MdSave className="w-4.5 h-4.5" />
            {saving ? 'Saving…' : 'Save Availability'}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Select Doctor</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] transition duration-200 hover:border-gray-300 cursor-pointer"
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

