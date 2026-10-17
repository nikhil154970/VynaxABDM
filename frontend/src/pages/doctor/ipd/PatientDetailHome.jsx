import { MdPeople } from 'react-icons/md';

export default function PatientDetailHome() {
  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
        <div className="rounded-2xl border border-gray-100 bg-white p-12 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm">
            <MdPeople className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-[#001B48]">No Patient Selected</h3>
            <p className="text-sm text-gray-500 font-semibold max-w-xs leading-relaxed">
              Please choose a patient from the "My Patients" IPD roster to view vitals, notes, and treatment plans.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
