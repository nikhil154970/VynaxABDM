import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRoutes from './pages/admin/AdminRoutes';
import ReceptionRoutes from './pages/receptionist/ReceptionRoutes';
import DoctorRoutes from './pages/doctor/DoctorRoutes';
import NurseRoutes from './pages/nurse/NurseRoutes';
import LabRoutes from './pages/lab/LabRoutes';
import PharmacyRoutes from './pages/pharmacy/PharmacyRoutes';

const ComingSoon = ({ page }) => (
  <div className="p-8 flex items-center justify-center h-full">
    <div className="text-center">
      <p className="text-4xl mb-3">🚧</p>
      <h2 className="text-xl font-bold text-gray-700">{page}</h2>
      <p className="text-gray-400 text-sm mt-1">This module is coming soon</p>
    </div>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Admin */}
        <Route path="/dashboard/admin/*" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <Layout><AdminRoutes /></Layout>
          </ProtectedRoute>
        } />

        {/* Receptionist */}
        <Route path="/dashboard/reception/*" element={
          <ProtectedRoute allowedRoles={['receptionist', 'super_admin']}>
            <Layout><ReceptionRoutes /></Layout>
          </ProtectedRoute>
        } />

        {/* Doctor */}
        <Route path="/dashboard/doctor/*" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <Layout><DoctorRoutes /></Layout>
          </ProtectedRoute>
        } />
        {/* Nurse */}
        <Route path="/dashboard/nurse/*" element={
          <ProtectedRoute allowedRoles={['nurse', 'super_admin']}>
            <Layout><NurseRoutes /></Layout>
          </ProtectedRoute>
        } />

         {/* Other role dashboards — coming soon */}
                <Route path="/dashboard/lab/*" element={
                  <ProtectedRoute allowedRoles={['lab_technician', 'super_admin']}>
                    <Layout><LabRoutes /></Layout>
                  </ProtectedRoute>
                } />
        <Route path="/dashboard/pharmacy/*" element={
          <ProtectedRoute allowedRoles={['pharmacist', 'super_admin']}>
            <Layout><PharmacyRoutes /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/hr" element={
          <ProtectedRoute allowedRoles={['hr_manager', 'super_admin']}>
            <Layout><ComingSoon page="HR Dashboard" /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/finance" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <Layout><ComingSoon page="Finance Dashboard" /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/unauthorized" element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <p className="text-5xl mb-4">🚫</p>
              <h2 className="text-2xl font-bold text-gray-700">Access Denied</h2>
              <p className="text-gray-400 mt-2">You don't have permission to view this page.</p>
            </div>
          </div>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
