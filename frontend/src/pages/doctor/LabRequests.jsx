import { useLocation } from 'react-router-dom';

const ComingSoon = ({ page }) => (
  <div className="p-8 flex items-center justify-center h-full">
    <div className="text-center">
      <p className="text-4xl mb-3">🚧</p>
      <h2 className="text-xl font-bold text-gray-700">{page}</h2>
      <p className="text-gray-400 text-sm mt-1">This module is coming soon</p>
    </div>
  </div>
);

export default function LabRequests() {
  const location = useLocation();
  const path = location.pathname || '';
  const page =
    path.endsWith('/request') ? 'Create Request'
      : path.endsWith('/reports') ? 'View Reports'
        : 'Lab Requests';

  return <ComingSoon page={page} />;
}

