import { useCallback, useEffect, useState } from 'react';
import { Building2, Clock, Mail, MapPin, Phone, Save, Shield, User, UserCircle } from 'lucide-react';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { fetchPharmacyProfile, updatePharmacyProfile } from '../../services/pharmacy/profileService';

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

function getInitials(name) {
  return (
    String(name || 'U')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'U'
  );
}

function ReadOnlyField({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50/80 to-white p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <p className="text-sm font-semibold text-slate-900">{value || '—'}</p>
    </div>
  );
}

export default function PharmacyProfile() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ type: 'success', message: '' });

  const [form, setForm] = useState({ fullName: '', phone: '', email: '', address: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPharmacyProfile();
      const p = res?.profile;
      setProfile(p);
      setForm({
        fullName: p?.fullName || '',
        phone: p?.phone || '',
        email: p?.email || '',
        address: p?.address || '',
      });
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to load profile' });
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updatePharmacyProfile(form);
      const p = res?.profile;
      setProfile(p);
      setEditing(false);
      setToast({ type: 'success', message: res?.message || 'Profile updated' });
      if (p && setUser) {
        setUser((prev) => {
          const next = { ...prev, name: p.fullName, email: p.email };
          localStorage.setItem('user', JSON.stringify(next));
          return next;
        });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm({
      fullName: profile?.fullName || '',
      phone: profile?.phone || '',
      email: profile?.email || '',
      address: profile?.address || '',
    });
    setEditing(false);
  };

  const displayName = profile?.fullName || user?.name || '—';
  const initials = getInitials(displayName);

  return (
    <div className="min-h-full bg-[#fbfdff] px-3 py-3 pb-8">
      {toast.message ? (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: 'success', message: '' })} />
      ) : null}

 

      <div className="mx-auto w-full max-w-4xl space-y-4">
        {/* Header */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 sm:h-28" />
          <div className="px-4 pb-5 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
                <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-extrabold text-white shadow-lg sm:-mt-14 sm:h-28 sm:w-28 sm:text-4xl">
                  {initials}
                </div>

                <div className="text-center sm:pb-1 sm:text-left">
                  {loading ? (
                    <div className="mx-auto h-7 w-44 animate-pulse rounded bg-slate-100 sm:mx-0" />
                  ) : (
                    <>
                      <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">{displayName}</h2>
                      <p className="mt-1 text-sm font-medium text-slate-600">{profile?.roleLabel || '—'}</p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
                        <Building2 className="h-3 w-3" />
                        {profile?.department || 'Pharmacy'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
                {!loading ? (
                  editing ? (
                    <>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving…' : 'Save Details'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                      Edit Personal Info
                    </button>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Personal — wider */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-3">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <User className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Personal Information</h3>
                <p className="text-[11px] text-slate-500">You can edit these fields</p>
              </div>
              {editing ? (
                <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100">
                  Editing
                </span>
              ) : null}
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Full Name
                  </label>
                  {editing ? (
                    <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} className={inputCls} />
                  ) : (
                    <p className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm font-medium text-slate-800">
                      {profile?.fullName || '—'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <Phone className="h-3 w-3" /> Mobile
                  </label>
                  {editing ? (
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className={inputCls}
                      placeholder="10-digit mobile"
                    />
                  ) : (
                    <p className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm font-medium text-slate-800">
                      {profile?.phone || '—'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <Mail className="h-3 w-3" /> Email
                  </label>
                  {editing ? (
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className={inputCls}
                    />
                  ) : (
                    <p className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm font-medium text-slate-800 break-all">
                      {profile?.email || '—'}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <MapPin className="h-3 w-3" /> Address
                  </label>
                  {editing ? (
                    <textarea
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      rows={3}
                      className={inputCls}
                      placeholder="Street, city, state, pincode"
                    />
                  ) : (
                    <p className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm font-medium text-slate-800 whitespace-pre-wrap min-h-[72px]">
                      {profile?.address || '—'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Account — read only */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Shield className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Account Information</h3>
                <p className="text-[11px] text-slate-500">Read only</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <ReadOnlyField label="Username" value={profile?.username} icon={UserCircle} />
                <ReadOnlyField label="Role" value={profile?.roleLabel} icon={Shield} />
                <ReadOnlyField label="Department" value={profile?.department} icon={Building2} />
                <ReadOnlyField label="Last Login" value={profile?.lastLoginLabel} icon={Clock} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
