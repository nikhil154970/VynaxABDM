import { Routes, Route, Navigate } from 'react-router-dom';
import { PatientAuthProvider } from '../../context/PatientAuthContext';
import PatientLogin from './PatientLogin';
import PatientRegister from './PatientRegister';
import PatientPortalLayout from './PatientPortalLayout';
import PatientDashboard from './PatientDashboard';
import PatientAppointments from './PatientAppointments';
import PatientMedicalTimeline from './PatientMedicalTimeline';
import PatientAdmissions from './PatientAdmissions';
import PatientPrescriptions from './PatientPrescriptions';
import PatientLabReports from './PatientLabReports';
import PatientOtSurgery from './PatientOtSurgery';
import PatientRecoveryStatus from './PatientRecoveryStatus';
import PatientVitalsHistory from './PatientVitalsHistory';
import PatientBillsPayments from './PatientBillsPayments';
import PatientDocuments from './PatientDocuments';
import PatientNotifications from './PatientNotifications';
import PatientProfile from './PatientProfile';
import PatientProtectedRoute from './PatientProtectedRoute';

export default function PatientRoutes() {
  return (
    <PatientAuthProvider>
      <Routes>
        <Route path="login" element={<PatientLogin />} />
        <Route path="register" element={<PatientRegister />} />
        <Route path="portal" element={<PatientPortalLayout />}>
          <Route index element={<Navigate to="/patient/portal/dashboard" replace />} />
          <Route path="dashboard" element={<PatientProtectedRoute><PatientDashboard /></PatientProtectedRoute>} />
          <Route path="appointments" element={<PatientProtectedRoute><PatientAppointments /></PatientProtectedRoute>} />
          <Route path="timeline" element={<PatientProtectedRoute><PatientMedicalTimeline /></PatientProtectedRoute>} />
          <Route path="admissions" element={<PatientProtectedRoute><PatientAdmissions /></PatientProtectedRoute>} />
          <Route path="prescriptions" element={<PatientProtectedRoute><PatientPrescriptions /></PatientProtectedRoute>} />
          <Route path="lab-reports" element={<PatientProtectedRoute><PatientLabReports /></PatientProtectedRoute>} />
          <Route path="ot-surgery" element={<PatientProtectedRoute><PatientOtSurgery /></PatientProtectedRoute>} />
          <Route path="recovery" element={<PatientProtectedRoute><PatientRecoveryStatus /></PatientProtectedRoute>} />
          <Route path="vitals" element={<PatientProtectedRoute><PatientVitalsHistory /></PatientProtectedRoute>} />
          <Route path="bills" element={<PatientProtectedRoute><PatientBillsPayments /></PatientProtectedRoute>} />
          <Route path="documents" element={<PatientProtectedRoute><PatientDocuments /></PatientProtectedRoute>} />
          <Route path="notifications" element={<PatientProtectedRoute><PatientNotifications /></PatientProtectedRoute>} />
          <Route path="profile" element={<PatientProtectedRoute><PatientProfile /></PatientProtectedRoute>} />
          <Route path="*" element={<Navigate to="/patient/portal/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/patient/login" replace />} />
      </Routes>
    </PatientAuthProvider>
  );
}
