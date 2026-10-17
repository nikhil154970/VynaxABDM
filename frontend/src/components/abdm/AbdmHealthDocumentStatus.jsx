import { useEffect, useRef, useState } from 'react';
import {
  getHealthDocument,
  healthDocumentUserMessage,
  retryHealthDocument,
  shouldRetryHealthDocument,
  shouldStopHealthDocumentPoll,
} from '../../services/abdm/abhaService';

export default function AbdmHealthDocumentStatus({ sourceType = 'CONSULTATION', sourceId }) {
  const [document, setDocument] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef(null);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const applyDoc = (doc) => {
    if (!doc) return;
    setDocument(doc);
    if (shouldStopHealthDocumentPoll(doc)) stopPoll();
  };

  const load = async () => {
    if (!sourceId) return null;
    try {
      const data = await getHealthDocument({ sourceType, sourceId });
      const doc = data?.document || null;
      applyDoc(doc);
      return doc;
    } catch {
      return null;
    }
  };

  const startPoll = () => {
    stopPoll();
    if (!sourceId) return;
    pollRef.current = setInterval(() => {
      load();
    }, 2000);
  };

  useEffect(() => {
    if (!sourceId) return undefined;
    load().then((doc) => {
      if (doc && !shouldStopHealthDocumentPoll(doc)) startPoll();
      if (!doc) startPoll();
    });
    return stopPoll;
  }, [sourceType, sourceId]);

  const handleRetry = async () => {
    if (!document?.id || retrying) return;
    setRetrying(true);
    try {
      const data = await retryHealthDocument(document.id);
      applyDoc(data?.document || document);
      if (data?.pendingCallback || data?.document?.syncStatus === 'PENDING') startPoll();
    } catch (err) {
      const failed = err?.response?.data?.document;
      if (failed) applyDoc(failed);
    } finally {
      setRetrying(false);
    }
  };

  if (!sourceId) return null;
  if (!document) return null;

  const message = healthDocumentUserMessage(document);
  const synced = String(document.syncStatus || '').toUpperCase() === 'SYNCED';
  const showRetry = shouldRetryHealthDocument(document);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">ABDM health record</p>
      <p className={`mt-1 text-sm font-semibold ${synced ? 'text-green-700' : 'text-slate-700'}`}>
        {message || document.syncStatus}
      </p>
      {showRetry ? (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="mt-3 rounded-lg bg-[#0077B6] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {retrying ? 'Retrying…' : 'Retry ABDM Sync'}
        </button>
      ) : null}
    </div>
  );
}
