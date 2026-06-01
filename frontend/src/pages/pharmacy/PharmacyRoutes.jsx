import { Navigate, Route, Routes } from 'react-router-dom';
import BillingPage from './BillingPage';
import PharmacyDashboard from './PharmacyDashboard';
import PharmacyDispensing from './PharmacyDispensing';
import PharmacySuppliers from './PharmacySuppliers';
import PharmacyMedicines from './PharmacyMedicines';
import PharmacyPurchaseOrders from './PharmacyPurchaseOrders';
import PharmacyGRN from './PharmacyGRN';
import PharmacyInventory from './PharmacyInventory';
import PharmacyBillingQueue from './billing/PharmacyBillingQueue';
import PharmacyBillingPendingDues from './billing/PharmacyBillingPendingDues';
import PharmacyBillingHistory from './billing/PharmacyBillingHistory';
import ReturnsPage from './returns/ReturnsPage';
import ReportsPage from './reports/ReportsPage';
import PharmacyProfile from './PharmacyProfile';

function PharmacyPlaceholder({ title }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="rounded-lg border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
        <p className="text-lg font-extrabold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">This pharmacy page is linked and ready for module work.</p>
      </div>
    </div>
  );
}

export default function PharmacyRoutes() {
  return (
    <Routes>
      <Route index element={<PharmacyDashboard />} />
      <Route path="billing" element={<BillingPage />} />
      <Route path="billing/queue" element={<PharmacyBillingQueue />} />
      <Route path="billing/pending-dues" element={<PharmacyBillingPendingDues />} />
      <Route path="billing/history" element={<PharmacyBillingHistory />} />
      <Route path="dispense" element={<PharmacyDispensing />} />
      <Route path="inventory" element={<PharmacyInventory />} />
      <Route path="medicines" element={<PharmacyMedicines />} />
      <Route path="purchase" element={<PharmacyPurchaseOrders />} />
      <Route path="grn" element={<PharmacyGRN />} />
      <Route path="suppliers" element={<PharmacySuppliers />} />
      <Route path="returns" element={<ReturnsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="profile" element={<PharmacyProfile />} />
      <Route path="*" element={<Navigate to="/dashboard/pharmacy" replace />} />
    </Routes>
  );
}
