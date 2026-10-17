import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  MdPerson, MdEmail, MdPhone, MdBadge,
  MdEdit, MdSave, MdLock, MdCheckCircle
} from 'react-icons/md';

const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

export default function Profile() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || 'Default Receptionist',
    email: user?.email || 'receptionist@vyanx.local',
    phone: '9876543210',
    empId: 'EMP-REC-001',
    dept: 'Reception',
    shift: 'Morning (8 AM – 4 PM)',
    joinDate: '01 Jan 2024',
  });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwDone, setPwDone] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setPw = k => e => setPwForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-xs text-gray-500 mt-0.5">View and manage your account details</p>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-5">
        {saved && (
          <div className="flex items-center gap-2 p-4 bg-green-50 rounded-xl border border-green-200 text-green-700 text-sm font-medium">
            <MdCheckCircle className="w-5 h-5" /> Profile updated successfully!
          </div>
        )}

        {/* Avatar + Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: '#0077B6' }}>
              <MdPerson className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{form.name}</h2>
              <p className="text-sm text-gray-500">{form.dept} · {form.empId}</p>
              <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                <MdBadge className="w-3.5 h-3.5" /> Receptionist
              </span>
            </div>
            <button onClick={() => setEditing(!editing)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              <MdEdit className="w-4 h-4" /> {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', key: 'name', icon: MdPerson },
              { label: 'Email Address', key: 'email', icon: MdEmail },
              { label: 'Phone Number', key: 'phone', icon: MdPhone },
              { label: 'Employee ID', key: 'empId', icon: MdBadge, readonly: true },
              { label: 'Department', key: 'dept', icon: MdBadge, readonly: true },
              { label: 'Shift', key: 'shift', icon: MdBadge, readonly: true },
            ].map(({ label, key, icon: Icon, readonly }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </label>
                {editing && !readonly ? (
                  <input value={form[key]} onChange={set(key)} className={inputCls} />
                ) : (
                  <p className="text-sm font-medium text-gray-800 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    {form[key]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {editing && (
            <button onClick={handleSave}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white shadow hover:shadow-md transition hover:-translate-y-0.5"
              style={{ background: '#0077B6' }}>
              <MdSave className="w-4 h-4" /> Save Changes
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-3 text-sm">Activity Summary</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Patients Registered', value: '148', color: '#1d4ed8' },
              { label: 'Appointments Booked', value: '312', color: '#065f46' },
              { label: 'Bills Generated', value: '97', color: '#92400e' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Joined: {form.joinDate}</p>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <MdLock className="w-5 h-5 text-blue-600" /> Change Password
          </h3>
          {pwDone && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-green-700 text-sm font-medium border border-green-200">
              <MdCheckCircle className="w-4 h-4" /> Password updated!
            </div>
          )}
          <div className="space-y-3">
            {[
              { label: 'Current Password', key: 'current' },
              { label: 'New Password', key: 'newPw' },
              { label: 'Confirm New Password', key: 'confirm' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
                <input type="password" value={pwForm[key]} onChange={setPw(key)} placeholder="••••••••" className={inputCls} />
              </div>
            ))}
          </div>
          <button
            disabled={!pwForm.current || !pwForm.newPw || pwForm.newPw !== pwForm.confirm}
            onClick={() => { setPwDone(true); setPwForm({ current: '', newPw: '', confirm: '' }); setTimeout(() => setPwDone(false), 3000); }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition"
            style={{ background: '#0077B6' }}>
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}

