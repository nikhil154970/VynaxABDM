import { useEffect, useState } from 'react';
import api from '../../utils/api';
import {
  MdPerson,
  MdEmail,
  MdPhone,
  MdWorkspacePremium,
  MdWc,
  MdStar,
  MdCheckCircle,
} from 'react-icons/md';

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get('/doctors/me');
        if (!alive) return;
        setMe(res.data?.doctor || null);
      } catch {
        if (!alive) return;
        setMe(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Helper to extract doctor initials
  const initials = me?.name
    ? me.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'DR';

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex items-center gap-4 border-b border-gray-200 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
            <MdPerson className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Doctor Profile</h1>
            <p className="text-sm font-semibold text-gray-500">
              Manage your credentials, system details, and practice information
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-12 shadow-sm flex flex-col items-center justify-center gap-3 text-gray-500 font-semibold text-sm">
            <div className="w-8 h-8 border-3 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
            Loading profile information...
          </div>
        ) : !me ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500 font-semibold text-sm shadow-sm">
            Profile details could not be found. Please check your system logs.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Avatar Column */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col items-center text-center space-y-5">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#001B48] to-[#0077B6] flex items-center justify-center text-white text-3xl font-extrabold shadow-md">
                  {initials}
                </div>
                <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-white">
                  <MdCheckCircle className="w-4 h-4" />
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-[#001B48]">{me.name}</h3>
                <p className="text-xs font-bold text-[#0077B6] uppercase tracking-wider bg-blue-50/70 border border-blue-100 px-3 py-1 rounded-full inline-block">
                  {me.specialization || 'Consultant'}
                </p>
              </div>

              <div className="w-full border-t border-gray-100 pt-4 flex justify-around text-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Experience</p>
                  <p className="text-base font-extrabold text-[#001B48] mt-1">
                    {me.experienceYears != null ? `${me.experienceYears} Years` : '—'}
                  </p>
                </div>
                <div className="border-l border-gray-150 h-10"></div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Qualification</p>
                  <p className="text-base font-extrabold text-[#001B48] mt-1">{me.qualification || '—'}</p>
                </div>
              </div>
            </div>

            {/* Right: Detailed Fields Column */}
            <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-extrabold text-[#001B48] uppercase tracking-wider border-b border-gray-100 pb-3 mb-5">
                Account & Credentials Info
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Physician Name', value: me.name, icon: MdPerson },
                  { label: 'Email Address', value: me.email, icon: MdEmail },
                  { label: 'Designation Role', value: 'Primary Doctor', icon: MdStar },
                  { label: 'Specialization Field', value: me.specialization, icon: MdWorkspacePremium },
                  { label: 'Academic Qualification', value: me.qualification, icon: MdWorkspacePremium },
                  { label: 'Phone Number', value: me.phone, icon: MdPhone },
                  { label: 'Gender Category', value: me.gender, icon: MdWc },
                  { label: 'Clinical Experience', value: me.experienceYears != null ? `${me.experienceYears} Years of Practice` : '—', icon: MdStar },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-gray-100 p-4 hover:bg-gray-50/50 hover:border-gray-200 transition-all duration-150 flex items-start gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center text-[#0077B6] shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {item.value || '—'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
