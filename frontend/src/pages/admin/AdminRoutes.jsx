import { Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import AllUsers from './users/AllUsers';
import CreateUser from './users/CreateUser';
import ActivityLogs from './activity/ActivityLogs';
import AllDoctors from './doctors/AllDoctors';
import AddDoctor from './doctors/AddDoctor';
import Availability from './doctors/Availability';
import LiveBedTracker from '../receptionist/beds/AllocateBed';
import ManageBeds from './beds/ManageBeds';
import LabTests from './lab/LabTests';
import AllPatients from './patients/AllPatients';
import PatientHistory from './patients/PatientHistory';
import PatientAnalytics from './patients/PatientAnalytics';
import AllAppointments from './appointments/AllAppointments';
import AdminRevenueSnapshot from './AdminRevenueSnapshot';
import AdminOpdAnalytics from './AdminOpdAnalytics';
import AdminActiveAdmissions from './AdminActiveAdmissions';
import AdminIpdAnalytics from './AdminIpdAnalytics';
import AdminBedOccupancyAnalytics from './AdminBedOccupancyAnalytics';
import AdminAllBills from './AdminAllBills';
import AdminRevenueAnalytics from './AdminRevenueAnalytics';
import CriticalAlerts from './alerts/CriticalAlerts';
import SystemNotifications from './alerts/SystemNotifications';
import AbdmConsentManagement from './abdm/AbdmConsentManagement';

const ComingSoon = ({ page }) => (
  <div className="p-8 flex items-center justify-center h-full">
    <div className="text-center">
      <p className="text-4xl mb-3">🚧</p>
      <h2 className="text-xl font-bold text-gray-700">{page}</h2>
      <p className="text-gray-400 text-sm mt-1">This module is coming soon</p>
    </div>
  </div>
);

export default function AdminRoutes() {
  return (
    <Routes>
      {/* Dashboard */}
      <Route index element={<AdminDashboard />} />
      <Route path="revenue-snapshot" element={<AdminRevenueSnapshot />} />

      {/* User & Access Control */}
      <Route path="users" element={<AllUsers />} />
      <Route path="users/create" element={<CreateUser />} />
      <Route path="logs" element={<ActivityLogs />} />

      {/* Doctor Management */}
      <Route path="doctors" element={<AllDoctors />} />
      <Route path="doctors/add" element={<AddDoctor />} />
      <Route path="doctors/:id/edit" element={<AddDoctor />} />
      <Route path="doctors/availability" element={<Availability />} />

      {/* Patient Intelligence */}
      <Route path="patients" element={<AllPatients />} />
      <Route path="patients/history" element={<PatientHistory />} />
      <Route path="patients/analytics" element={<PatientAnalytics />} />

      {/* Appointment & OPD Control */}
      <Route path="appointments" element={<AllAppointments />} />
      <Route path="appointments/book" element={<ComingSoon page="Book Appointment" />} />
      <Route path="opd" element={<ComingSoon page="OPD Records" />} />
      <Route path="opd/queue" element={<ComingSoon page="Queue / Token Status" />} />
      <Route path="opd/analytics" element={<AdminOpdAnalytics />} />

      {/* IPD & Admission Control */}
      <Route path="ipd" element={<AdminActiveAdmissions />} />
      <Route path="ipd/admit" element={<ComingSoon page="Admit Patient" />} />
      <Route path="ipd/analytics" element={<AdminIpdAnalytics />} />

      {/* Bed & Resource Management */}
      <Route path="beds" element={<LiveBedTracker />} />
      <Route path="beds/manage" element={<ManageBeds />} />

      <Route path="lab/tests" element={<LabTests />} />
      {/* removed: allocate/deallocate */}
      <Route path="beds/analytics" element={<AdminBedOccupancyAnalytics />} />

      {/* Financial Management */}
      <Route path="finance/bills" element={<AdminAllBills />} />
      <Route path="finance/analytics" element={<AdminRevenueAnalytics />} />

      {/* Reports & Analytics */}
      <Route path="reports/revenue" element={<ComingSoon page="Revenue Reports" />} />
      <Route path="reports/patients" element={<ComingSoon page="Patient Reports" />} />
      <Route path="reports/doctors" element={<ComingSoon page="Doctor Reports" />} />
      <Route path="reports/beds" element={<ComingSoon page="Bed Utilization" />} />
      <Route path="reports/daily" element={<ComingSoon page="Daily Reports" />} />
      <Route path="reports/monthly" element={<ComingSoon page="Monthly Reports" />} />

      {/* Alerts & Notifications */}
      <Route path="alerts/pending" element={<ComingSoon page="Pending Actions" />} />
      <Route path="alerts/critical" element={<CriticalAlerts />} />
      <Route path="alerts/system" element={<SystemNotifications />} />
      <Route path="abdm/consents" element={<AbdmConsentManagement />} />

      {/* fallback */}
      <Route path="*" element={<ComingSoon page="Admin Module" />} />
    </Routes>
  );
}

