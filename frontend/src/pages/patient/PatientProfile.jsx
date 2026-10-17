import { useState, useEffect } from 'react';
import patientApi from '../../utils/patientApi';

export default function PatientProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    (async () => {
      try { const r = await patientApi.get('/patient/portal/profile'); const p = r.data.patient; setProfile(p); setForm({ name: p.name, mobile: p.mobile, address: p.address, bloodGroup: p.bloodGroup, allergies: p.allergies, emergencyName: p.emergencyName, emergencyPhone: p.emergencyPhone, emergencyRelation: p.emergencyRelation }); }
      catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true); setMessage('');
    try { await patientApi.put('/patient/portal/profile', form); setMessage('Profile updated successfully'); setEditMode(false); }
    catch (e) { setMessage(e.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    setPwMsg('');
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg('Passwords do not match'); return; }
    if (pwForm.newPassword.length < 6) { setPwMsg('Password must be at least 6 characters'); return; }
    try { await patientApi.put('/patient/portal/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }); setPwMsg('Password changed successfully'); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
    catch (e) { setPwMsg(e.response?.data?.message || 'Failed to change password'); }
  };

  if (loading) return <Skeleton />;

  const p = profile;
  const set = (f) => (e) => setForm((prev) => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Profile</h1>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-semibold ${message.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Personal Information</h2>
            <p className="text-xs text-gray-400">UHID: {p?.uhid} | {p?.registrationNumber}</p>
          </div>
          <button onClick={() => setEditMode(!editMode)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
            {editMode ? 'Cancel' : 'Edit'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProfileField label="Name" value={form.name} edit={editMode} onChange={set('name')} />
          <ProfileField label="Mobile" value={form.mobile} edit={editMode} onChange={set('mobile')} />
          <ProfileField label="Gender" value={p?.gender} edit={false} />
          <ProfileField label="Age" value={p?.age} edit={false} />
          <ProfileField label="Blood Group" value={form.bloodGroup} edit={editMode} onChange={set('bloodGroup')} />
          <ProfileField label="Allergies" value={form.allergies} edit={editMode} onChange={set('allergies')} />
          <div className="md:col-span-2">
            <ProfileField label="Address" value={form.address} edit={editMode} onChange={set('address')} textarea />
          </div>
        </div>

        {editMode && (
          <button onClick={handleSave} disabled={saving}
            className="mt-6 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Emergency Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ProfileField label="Name" value={form.emergencyName} edit={editMode} onChange={set('emergencyName')} />
          <ProfileField label="Phone" value={form.emergencyPhone} edit={editMode} onChange={set('emergencyPhone')} />
          <ProfileField label="Relation" value={form.emergencyRelation} edit={editMode} onChange={set('emergencyRelation')} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Change Password</h2>
        {pwMsg && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-semibold ${pwMsg.includes('successfully') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {pwMsg}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Current Password</label>
            <input type="password" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-300"
              value={pwForm.currentPassword} onChange={(e) => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">New Password</label>
            <input type="password" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-300"
              value={pwForm.newPassword} onChange={(e) => setPwForm(p => ({ ...p, newPassword: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Confirm Password</label>
            <input type="password" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-300"
              value={pwForm.confirmPassword} onChange={(e) => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))} />
          </div>
        </div>
        <button onClick={handleChangePassword}
          className="mt-4 px-6 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-900 transition">
          Change Password
        </button>
      </div>
    </div>
  );
}

function ProfileField({ label, value, edit, onChange, textarea }) {
  if (edit && onChange) {
    if (textarea) {
      return <div><p className="text-xs font-semibold text-gray-500 mb-1">{label}</p><textarea className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-300" rows={2} value={value || ''} onChange={onChange} /></div>;
    }
    return <div><p className="text-xs font-semibold text-gray-500 mb-1">{label}</p><input className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-300" value={value || ''} onChange={onChange} /></div>;
  }
  return <div><p className="text-xs font-semibold text-gray-500 mb-1">{label}</p><p className="text-sm font-bold text-gray-700">{value || '—'}</p></div>;
}

function Skeleton() {
  return <div className="max-w-4xl mx-auto space-y-6 animate-pulse"><div className="h-64 bg-gray-100 rounded-2xl" /><div className="h-32 bg-gray-100 rounded-2xl" /><div className="h-40 bg-gray-100 rounded-2xl" /></div>;
}
