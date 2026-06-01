import { Routes, Route } from 'react-router-dom';
import LabOrdersV2 from './orders/LabOrdersV2';
import SampleCollection from './samples/SampleCollection';
import ResultEntryAuto from './results/ResultEntryAuto';
import GenerateReport from './reports/GenerateReport';
import LabNotifications from './notifications/LabNotifications';

const ComingSoon = ({ page }) => (
  <div className="p-8 flex items-center justify-center h-full">
    <div className="text-center">
      <p className="text-4xl mb-3">🚧</p>
      <h2 className="text-xl font-bold text-gray-700">{page}</h2>
      <p className="text-gray-400 text-sm mt-1">This module is coming soon</p>
    </div>
  </div>
);

export default function LabRoutes() {
  return (
    <Routes>
      <Route index element={<LabOrdersV2 />} />
      <Route path="orders" element={<LabOrdersV2 />} />
      <Route path="samples" element={<SampleCollection />} />
      <Route path="results" element={<ResultEntryAuto />} />
      <Route path="reports" element={<GenerateReport />} />
      <Route path="reports/generate" element={<GenerateReport />} />
      <Route path="notifications" element={<LabNotifications />} />
      <Route path="profile" element={<ComingSoon page="My Profile" />} />
      <Route path="*" element={<ComingSoon page="Lab Module" />} />
    </Routes>
  );
}

