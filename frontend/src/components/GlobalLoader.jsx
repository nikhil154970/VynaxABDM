import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getLoadingState,
  isGlobalLoading,
  resetGlobalLoading,
  subscribeLoading,
  stopNavigationLoading,
} from '../utils/loadingBus';

const MAX_LOADING_MS = 8000;

export default function GlobalLoader({ scope = 'fullscreen' }) {
  const location = useLocation();
  const [loading, setLoading] = useState(() => isGlobalLoading(getLoadingState()));
  const [visible, setVisible] = useState(false);
  const forceHideRef = useRef(false);
  const maxTimerRef = useRef(null);

  useEffect(() => {
    return subscribeLoading((s) => {
      const isLoading = isGlobalLoading(s);
      if (!isLoading) forceHideRef.current = false;
      setLoading(isLoading);
    });
  }, []);

  // Auto-force-hide if loading stays true beyond MAX_LOADING_MS
  useEffect(() => {
    if (!loading) {
      setVisible(false);
      clearTimeout(maxTimerRef.current);
      return;
    }
    if (forceHideRef.current) return;
    const d = setTimeout(() => setVisible(true), 150);
    maxTimerRef.current = setTimeout(() => {
      forceHideRef.current = true;
      resetGlobalLoading();
      setLoading(false);
    }, MAX_LOADING_MS);
    return () => {
      clearTimeout(d);
      clearTimeout(maxTimerRef.current);
    };
  }, [loading]);

  // When route changes, stop the "navigation" loader immediately.
  useEffect(() => {
    stopNavigationLoading();
  }, [location.pathname]);

  if ((!loading && !visible) || forceHideRef.current) return null;

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

