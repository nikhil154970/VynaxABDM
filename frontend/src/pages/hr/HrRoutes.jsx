import { Routes, Route } from 'react-router-dom';
import HrDashboard from './HrDashboard';
import HrEmployees from './HrEmployees';
import HrEmployeeDetail from './HrEmployeeDetail';
import HrDepartments from './HrDepartments';
import HrAllocationRequests from './HrAllocationRequests';
import HrPatientAllocation from './HrPatientAllocation';
import HrNurseAllocation from './HrNurseAllocation';
import HrShiftManagement from './HrShiftManagement';
import HrStaffAvailability from './HrStaffAvailability';
import DutyRosterBoard from './DutyRosterBoard';
import HrReports from './HrReports';
import HrNotifications from './HrNotifications';
import { MdBusiness } from 'react-icons/md';

const HrPlaceholder = ({ title }) => (
  <div className="w-full max-w-none bg-white min-h-screen">
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 pb-12">
      {/* Top bar header banner */}
      <div className="flex items-center gap-4 border-b border-gray-200 pb-5">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
          <MdBusiness className="w-6 h-6" />
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">{title}</h1>
          <p className="text-sm font-semibold text-gray-500">
            Workforce records and administrative operations
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <div className="flex items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm flex flex-col items-center text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm">
            <MdBusiness className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold text-[#001B48]">Under Development</h3>
            <p className="text-sm text-gray-500 font-semibold leading-relaxed">
              This administrative sub-module is under active construction and will be ready in the next deployment update.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function HrRoutes() {
  return (
    <Routes>
      <Route index element={<HrDashboard />} />
      <Route path="employees" element={<HrEmployees />} />
      <Route path="employees/departments" element={<HrDepartments />} />
      <Route path="employees/:id" element={<HrEmployeeDetail />} />
      <Route path="staff-allocation/requests" element={<HrAllocationRequests />} />
      <Route path="staff-allocation/patient" element={<HrPatientAllocation />} />
      <Route path="staff-allocation/nurse" element={<HrNurseAllocation />} />
      <Route path="shifts" element={<HrShiftManagement />} />
      <Route path="shifts/availability" element={<HrStaffAvailability />} />
      <Route path="duty-roster" element={<DutyRosterBoard />} />
      <Route path="reports" element={<HrReports />} />
      <Route path="notifications" element={<HrNotifications />} />
    </Routes>
  );
}
