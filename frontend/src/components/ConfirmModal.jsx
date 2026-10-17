import { useEffect } from 'react';

export default function ConfirmModal({
  open,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'danger', // 'danger' | 'primary'
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const confirmBg = confirmVariant === 'primary' ? '#00AEEF' : '#E53935';
  const accent = confirmVariant === 'primary' ? '#00AEEF' : '#2D2A6E';
  const iconBg = confirmVariant === 'danger' ? 'rgba(229,57,53,0.12)' : 'rgba(0,174,239,0.14)';
  const iconFg = confirmVariant === 'danger' ? '#E53935' : '#00AEEF';

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onCancel?.()}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
          style={{ background: '#FFFFFF', borderColor: '#e0e7ff' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="h-1.5" style={{ background: accent }} />

          <div className="px-6 pt-6 pb-5">
            <div className="flex items-start gap-4">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border"
                style={{ background: iconBg, color: iconFg, borderColor: '#e0e7ff' }}
                aria-hidden="true"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V6h2v6z" />
                </svg>
              </div>

              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600 mt-1">{message}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#e0e7ff' }}>
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="px-4 py-2.5 rounded-xl text-sm font-extrabold border bg-white hover:bg-gray-50 transition"
              style={{ borderColor: '#d5d7eb', color: '#374151' }}
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => onConfirm?.()}
              className="px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-sm hover:shadow-md transition"
              style={{ background: confirmBg }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

