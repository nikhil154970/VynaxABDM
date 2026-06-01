import { useEffect } from 'react';
import { MdCheckCircle, MdError } from 'react-icons/md';

export default function Toast({ type = 'success', message = '', onClose, durationMs = 2200 }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onClose]);

  if (!message) return null;

  const isErr = type === 'error';
  const Icon = isErr ? MdError : MdCheckCircle;
  const styles = isErr
    ? 'bg-rose-600 text-white'
    : 'bg-emerald-600 text-white';

  return (
    <div className="fixed top-5 right-5 z-[9999]">
      <div className={`shadow-lg rounded-2xl px-4 py-3 flex items-start gap-2 ${styles}`}>
        <Icon className="w-5 h-5 mt-0.5 shrink-0" />
        <div className="text-sm font-semibold leading-snug">{message}</div>
        <button
          type="button"
          className="ml-2 text-white/90 hover:text-white text-sm font-bold"
          onClick={() => onClose?.()}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}

