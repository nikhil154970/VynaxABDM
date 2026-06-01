import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getLoadingState,
  isGlobalLoading,
  subscribeLoading,
  stopNavigationLoading,
} from '../utils/loadingBus';

export default function GlobalLoader({ scope = 'fullscreen' }) {
  const location = useLocation();
  const [loading, setLoading] = useState(() => isGlobalLoading(getLoadingState()));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return subscribeLoading((s) => setLoading(isGlobalLoading(s)));
  }, []);

  // Avoid flashing on fast navigations/requests.
  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, [loading]);

  // When route changes, stop the "navigation" loader immediately.
  useEffect(() => {
    stopNavigationLoading();
    const t = setTimeout(() => stopNavigationLoading(), 1200); // fallback if something gets stuck
    return () => clearTimeout(t);
  }, [location.pathname]);

  if (!loading || !visible) return null;

  const overlayPosition = scope === 'container' ? 'absolute' : 'fixed';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={{
        position: overlayPosition,
        inset: 0,
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(10, 20, 40, 0.20)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="nhSpinner"
        aria-hidden="true"
        style={{
          width: 54,
          height: 54,
          borderRadius: '9999px',
          border: '5px solid rgba(255,255,255,0.25)',
          borderTopColor: '#00AEEF',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          animation: 'nhSpin 0.9s linear infinite',
        }}
      />

      <style>{`
        @keyframes nhSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

