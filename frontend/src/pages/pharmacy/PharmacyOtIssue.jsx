import { useEffect, useState, useMemo } from 'react';
import { MdRefresh, MdCheck, MdClose, MdHistory, MdPendingActions } from 'react-icons/md';
import api from '../../utils/api';

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN');
}

const STATUS_BADGE = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  ISSUED: 'bg-blue-100 text-blue-800',
  IN_USE: 'bg-indigo-100 text-indigo-800',
  RETURN_PENDING: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function PharmacyOtIssue() {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [issueQuantities, setIssueQuantities] = useState({});

  const fetchPending = () => {
    api.get('/pharmacy/ot-issue/pending')
      .then((res) => setPending(Array.isArray(res.data?.issues) ? res.data.issues : []))
      .catch(() => setPending([]));
  };

  const fetchHistory = () => {
    api.get('/pharmacy/ot-issue/history')
      .then((res) => setHistory(Array.isArray(res.data?.issues) ? res.data.issues : []))
      .catch(() => setHistory([]));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPending(), fetchHistory()]).finally(() => setLoading(false));
  }, []);

  const handleIssueItems = async (issueId) => {
    const items = Object.entries(issueQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([issueItemId, quantityIssued]) => ({ issueItemId, quantityIssued }));
    if (items.length === 0) return;
    try {
      await api.post(`/pharmacy/ot-issue/${issueId}/issue`, { items });
      setSelectedIssue(null);
      setIssueQuantities({});
      fetchPending();
      fetchHistory();
    } catch (err) {
      console.error('Issue error:', err.response?.data || err.message);
    }
  };

  const handleConfirmReturn = async (issueId) => {
    try {
      await api.post(`/pharmacy/ot-issue/${issueId}/confirm-return`);
      fetchPending();
      fetchHistory();
    } catch (err) {
      console.error('Confirm return error:', err.response?.data || err.message);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-extrabold text-slate-900">OT Medicine Issues</h1>

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {['pending', 'history'].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedIssue(null); }}
            className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t === 'pending' ? <MdPendingActions /> : <MdHistory />}
            {t === 'pending' ? `Pending (${pending.length})` : 'History'}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <div className="space-y-3">
          {pending.length === 0 && !loading && (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              No pending OT medicine requests
            </div>
          )}
          {pending.map((issue) => (
            <div key={issue.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{issue.issueNumber}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[issue.status]}`}>{issue.status}</span>
                  <span className="text-[10px] text-slate-500">{issue.patient?.name} ({issue.patient?.uhid})</span>
                </div>
                <button
                  onClick={() => {
                    if (selectedIssue === issue.id) {
                      setSelectedIssue(null);
                      setIssueQuantities({});
                    } else {
                      setSelectedIssue(issue.id);
                      const initialQty = {};
                      for (const it of issue.items) {
                        initialQty[it.id] = it.quantityRequested;
                      }
                      setIssueQuantities(initialQty);
                    }
                  }}
                  className="rounded bg-blue-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-blue-700"
                >
                  {selectedIssue === issue.id ? 'Cancel' : 'Issue Items'}
                </button>
              </div>

              <table className="w-full text-[10px]">
                <thead><tr className="text-left text-slate-400">
                  <th className="pb-1 pr-2">Medicine</th>
                  <th className="pb-1 pr-2">Batch</th>
                  <th className="pb-1 pr-2 text-right">Requested</th>
                  {selectedIssue === issue.id && <th className="pb-1 pr-2 text-right">Issue Qty</th>}
                </tr></thead>
                <tbody>
                  {issue.items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 text-slate-700">
                      <td className="py-1 pr-2 font-medium">{item.medicineName}</td>
                      <td className="py-1 pr-2 text-slate-400">{item.batchNumber}</td>
                      <td className="py-1 pr-2 text-right">{item.quantityRequested}</td>
                      {selectedIssue === issue.id && (
                        <td className="py-1 pr-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={item.quantityRequested}
                            value={issueQuantities[item.id] || 0}
                            onChange={(e) => setIssueQuantities((prev) => ({ ...prev, [item.id]: Math.max(0, Math.min(item.quantityRequested, parseInt(e.target.value) || 0)) }))}
                            className="w-16 rounded border border-blue-300 px-2 py-1 text-xs text-center"
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedIssue === issue.id && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => handleIssueItems(issue.id)}
                    className="flex items-center gap-1 rounded bg-green-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                  >
                    <MdCheck /> Confirm Issue
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 && !loading && (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              No OT issue history
            </div>
          )}
          {history.map((issue) => (
            <div key={issue.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{issue.issueNumber}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[issue.status]}`}>{issue.status}</span>
                  <span className="text-[10px] text-slate-500">{issue.patient?.name} ({issue.patient?.uhid})</span>
                </div>
                {issue.status === 'RETURN_PENDING' && (
                  <button
                    onClick={() => handleConfirmReturn(issue.id)}
                    className="flex items-center gap-1 rounded bg-orange-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-orange-700"
                  >
                    <MdCheck /> Confirm Return
                  </button>
                )}
              </div>

              <table className="w-full text-[10px]">
                <thead><tr className="text-left text-slate-400">
                  <th className="pb-1 pr-2">Medicine</th>
                  <th className="pb-1 pr-2 text-right">Req</th>
                  <th className="pb-1 pr-2 text-right">Issued</th>
                  <th className="pb-1 pr-2 text-right">Used</th>
                  <th className="pb-1 pr-2 text-right">Returned</th>
                  <th className="pb-1 pr-2 text-right">Rtn Pending</th>
                </tr></thead>
                <tbody>
                  {issue.items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 text-slate-700">
                      <td className="py-1 pr-2 font-medium">{item.medicineName}</td>
                      <td className="py-1 pr-2 text-right">{item.quantityRequested}</td>
                      <td className="py-1 pr-2 text-right">{item.quantityIssued}</td>
                      <td className="py-1 pr-2 text-right">{item.quantityUsed}</td>
                      <td className="py-1 pr-2 text-right">{item.quantityReturned}</td>
                      <td className="py-1 pr-2 text-right text-orange-600">{item.quantityReturnPending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
