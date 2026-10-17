import { useLocation, useNavigate } from 'react-router-dom';
import { MdBiotech, MdArrowBack } from 'react-icons/md';

export default function LabRequests() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname || '';
  const pageName =
    path.endsWith('/request') ? 'Create Lab Request'
      : path.endsWith('/reports') ? 'View Lab Reports'
        : 'Lab Requests';

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        {/* Top bar header banner */}
        <div className="flex items-center gap-4 border-b border-gray-200 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
            <MdBiotech className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">{pageName}</h1>
            <p className="text-sm font-semibold text-gray-500">
              Lab diagnostic requests and clinical observation logs
            </p>
          </div>
        </div>

        {/* Premium Coming Soon Card */}
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm flex flex-col items-center text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm">
              <MdBiotech className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-[#001B48]">Under Development</h3>
              <p className="text-sm text-gray-500 font-semibold leading-relaxed">
                We are actively integrating diagnostic equipment telemetry and laboratory systems. This screen will be available soon.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard/doctor')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] shadow-sm hover:shadow active:scale-95 transition-all duration-200"
              >
                <MdArrowBack className="w-4 h-4" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
