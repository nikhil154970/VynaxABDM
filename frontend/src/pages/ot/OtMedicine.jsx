import { useEffect, useState, useMemo } from 'react';
import { MdSearch, MdAdd, MdCheck, MdClose, MdRefresh, MdInventory, MdLocalPharmacy } from 'react-icons/md';
import api from '../../utils/api';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

export default function OtMedicine() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [issues, setIssues] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');

  const [requestItems, setRequestItems] = useState([]);
  const [inventoryResults, setInventoryResults] = useState([]);
  const [invSearch, setInvSearch] = useState('');
  const [remarks, setRemarks] = useState('');

  const [useMode, setUseMode] = useState(null);
  const [useItems, setUseItems] = useState({});
  const [returnMode, setReturnMode] = useState(null);
  const [returnItems, setReturnItems] = useState({});

  useEffect(() => {
    api.get('/ot/surgery/workflow/in-progress')
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setSessions(items);
        if (items.length > 0 && !selectedSessionId) {
          setSelectedSessionId(items[0].id);
        }
      })
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    setLoadingIssues(true);
    api.get(`/ot/medicine/issues?surgerySessionId=${selectedSessionId}`)
      .then((res) => setIssues(Array.isArray(res.data?.issues) ? res.data.issues : []))
      .catch(() => setIssues([]))
      .finally(() => setLoadingIssues(false));
  }, [selectedSessionId]);

  const session = sessions.find((s) => s.id === selectedSessionId);
  const p = session?.surgerySchedule?.otRequest?.patient || {};

  const handleInventorySearch = async (q) => {
    setInvSearch(q);
    if (!q || q.length < 2) { setInventoryResults([]); return; }
    try {
      const res = await api.get(`/ot/medicine/inventory-search?q=${encodeURIComponent(q)}`);
      setInventoryResults(res.data?.batches || []);
    } catch { setInventoryResults([]); }
  };

  const addRequestItem = (batch) => {
    setRequestItems((prev) => {
      if (prev.find((i) => i.inventoryBatchId === batch.inventoryBatchId)) return prev;
      return [...prev, { ...batch, quantityRequested: 1 }];
    });
    setInventoryResults([]);
    setInvSearch('');
  };

  const removeRequestItem = (batchId) => {
    setRequestItems((prev) => prev.filter((i) => i.inventoryBatchId !== batchId));
  };

  const updateRequestQty = (batchId, qty) => {
    setRequestItems((prev) => prev.map((i) => i.inventoryBatchId === batchId ? { ...i, quantityRequested: Math.max(1, qty) } : i));
  };

  const submitRequest = async () => {
    if (!selectedSessionId || requestItems.length === 0) return;
    try {
      const payload = {
        surgerySessionId: selectedSessionId,
        otRequestId: session?.surgerySchedule?.otRequest?.id || '',
        patientId: p.id || '',
        remarks,
        items: requestItems.map((i) => ({
          medicineId: i.medicineId,
          inventoryBatchId: i.inventoryBatchId,
          medicineName: i.medicineName,
          genericName: i.genericName,
          batchNumber: i.batchNumber,
          expiryDate: i.expiryDate,
          unitPrice: i.unitPrice,
          quantityRequested: i.quantityRequested,
        })),
      };
      await api.post('/ot/medicine/issues/request', payload);
      setRequestItems([]);
      setRemarks('');
      setActiveTab('list');
      setIssues((prev) => [...prev]);
      const res = await api.get(`/ot/medicine/issues?surgerySessionId=${selectedSessionId}`);
      setIssues(Array.isArray(res.data?.issues) ? res.data.issues : []);
    } catch (err) {
      console.error('Request error:', err);
    }
  };

  const handleReceive = async (issueId) => {
    try {
      await api.post(`/ot/medicine/issues/${issueId}/receive`);
      const res = await api.get(`/ot/medicine/issues?surgerySessionId=${selectedSessionId}`);
      setIssues(Array.isArray(res.data?.issues) ? res.data.issues : []);
    } catch (err) {
      console.error('Receive error:', err);
    }
  };

  const handleUse = async (issueId) => {
    const items = Object.entries(useItems)
      .filter(([, qty]) => qty > 0)
      .map(([issueItemId, quantity]) => ({ issueItemId, quantity }));
    if (items.length === 0) return;
    try {
      await api.post(`/ot/medicine/issues/${issueId}/use`, { items });
      setUseMode(null);
      setUseItems({});
      const res = await api.get(`/ot/medicine/issues?surgerySessionId=${selectedSessionId}`);
      setIssues(Array.isArray(res.data?.issues) ? res.data.issues : []);
    } catch (err) {
      console.error('Use error:', err);
    }
  };

  const handleRequestReturn = async (issueId) => {
    const items = Object.entries(returnItems)
      .filter(([, qty]) => qty > 0)
      .map(([issueItemId, quantity]) => ({ issueItemId, quantity }));
    if (items.length === 0) return;
    try {
      await api.post(`/ot/medicine/issues/${issueId}/request-return`, { items });
      setReturnMode(null);
      setReturnItems({});
      const res = await api.get(`/ot/medicine/issues?surgerySessionId=${selectedSessionId}`);
      setIssues(Array.isArray(res.data?.issues) ? res.data.issues : []);
    } catch (err) {
      console.error('Return error:', err);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-slate-900">OT Medicine Tracking</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-slate-600">Surgery Session:</label>
        <select
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium"
        >
          <option value="">Select session...</option>
          {sessions.map((s) => {
            const sp = s.surgerySchedule?.otRequest?.patient || {};
            return (
              <option key={s.id} value={s.id}>
                {sp.name || 'Unknown'} — {sp.uhid || ''} ({formatDate(s.startTime)})
              </option>
            );
          })}
        </select>
        {session && (
          <span className="text-[10px] text-slate-500">
            Room: {session.surgerySchedule?.otRoom?.roomName || '—'}
            {' | '}Surgeon: {session.surgerySchedule?.surgeon?.user?.name || '—'}
          </span>
        )}
      </div>

      {selectedSessionId && (
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {['list', 'request'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'list' ? 'Medicine Log' : 'New Request'}
            </button>
          ))}
        </div>
      )}

      {!selectedSessionId && (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">Select a surgery session above</div>
      )}

      {selectedSessionId && activeTab === 'list' && (
        <div className="space-y-3">
          {loadingIssues && <div className="text-xs text-slate-500">Loading...</div>}
          {!loadingIssues && issues.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
              No medicine issues for this session
            </div>
          )}
          {issues.map((issue) => (
            <div key={issue.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{issue.issueNumber}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[issue.status] || 'bg-slate-100 text-slate-600'}`}>
                    {issue.status}
                  </span>
                </div>
                <div className="flex gap-1">
                  {issue.status === 'ISSUED' && (
                    <button onClick={() => handleReceive(issue.id)} className="flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100">
                      <MdCheck /> Receive
                    </button>
                  )}
                  {issue.status === 'IN_USE' && (
                    <>
                      <button onClick={() => { setUseMode(issue.id); setUseItems({}); }} className="flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100">
                        <MdAdd /> Log Use
                      </button>
                      <button onClick={() => { setReturnMode(issue.id); setReturnItems({}); }} className="flex items-center gap-1 rounded bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700 hover:bg-orange-100">
                        <MdRefresh /> Return
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 mb-2">
                <span>Requested: {issue.requestedByName || '—'} ({formatDateTime(issue.requestedAt)})</span>
                <span>Issued: {issue.issuedByName || '—'} ({formatDateTime(issue.issuedAt)})</span>
                <span>Received: {issue.receivedByOtName || '—'}</span>
              </div>

              <table className="w-full text-[10px]">
                <thead><tr className="text-left text-slate-400">
                  <th className="pb-1 pr-2">Medicine</th>
                  <th className="pb-1 pr-2">Batch</th>
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
                      <td className="py-1 pr-2 text-slate-400">{item.batchNumber}</td>
                      <td className="py-1 pr-2 text-right">{item.quantityRequested}</td>
                      <td className="py-1 pr-2 text-right">{item.quantityIssued}</td>
                      <td className="py-1 pr-2 text-right">{item.quantityUsed}</td>
                      <td className="py-1 pr-2 text-right">{item.quantityReturned}</td>
                      <td className="py-1 pr-2 text-right text-orange-600">{item.quantityReturnPending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {useMode === issue.id && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="mb-2 text-xs font-bold text-blue-800">Log Medicine Usage</p>
                  {issue.items.filter((i) => i.quantityIssued > i.quantityUsed + i.quantityReturnPending).map((item) => {
                    const available = item.quantityIssued - item.quantityUsed - item.quantityReturnPending;
                    return (
                      <div key={item.id} className="mb-1 flex items-center gap-2">
                        <span className="w-40 text-[10px] font-medium">{item.medicineName}</span>
                        <span className="text-[10px] text-slate-500">Avail: {available}</span>
                        <input
                          type="number" min={0} max={available}
                          value={useItems[item.id] || 0}
                          onChange={(e) => setUseItems((prev) => ({ ...prev, [item.id]: Math.max(0, Math.min(available, parseInt(e.target.value) || 0)) }))}
                          className="w-20 rounded border border-blue-300 px-2 py-1 text-xs"
                        />
                      </div>
                    );
                  })}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleUse(issue.id)} className="rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700">Submit Usage</button>
                    <button onClick={() => setUseMode(null)} className="rounded bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-300">Cancel</button>
                  </div>
                </div>
              )}

              {returnMode === issue.id && (
                <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="mb-2 text-xs font-bold text-orange-800">Submit Return to Pharmacy</p>
                  {issue.items.filter((i) => i.quantityIssued > i.quantityUsed + i.quantityReturnPending).map((item) => {
                    const available = item.quantityIssued - item.quantityUsed - item.quantityReturnPending;
                    return (
                      <div key={item.id} className="mb-1 flex items-center gap-2">
                        <span className="w-40 text-[10px] font-medium">{item.medicineName}</span>
                        <span className="text-[10px] text-slate-500">Avail: {available}</span>
                        <input
                          type="number" min={0} max={available}
                          value={returnItems[item.id] || 0}
                          onChange={(e) => setReturnItems((prev) => ({ ...prev, [item.id]: Math.max(0, Math.min(available, parseInt(e.target.value) || 0)) }))}
                          className="w-20 rounded border border-orange-300 px-2 py-1 text-xs"
                        />
                      </div>
                    );
                  })}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleRequestReturn(issue.id)} className="rounded bg-orange-600 px-3 py-1 text-xs font-bold text-white hover:bg-orange-700">Submit Return</button>
                    <button onClick={() => setReturnMode(null)} className="rounded bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-300">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedSessionId && activeTab === 'request' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-bold text-slate-700">
              <MdInventory className="inline mr-1" />Search Pharmacy Inventory
            </p>
            <div className="relative">
              <MdSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={invSearch}
                onChange={(e) => handleInventorySearch(e.target.value)}
                placeholder="Search medicine name, generic, or barcode..."
                className="w-full rounded-lg border border-slate-300 px-8 py-2 text-xs"
              />
            </div>
            {inventoryResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                {inventoryResults.map((batch) => (
                  <div key={batch.inventoryBatchId} className="flex items-center justify-between border-b border-slate-100 px-3 py-2 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-slate-800">{batch.medicineName}</p>
                      <p className="text-[10px] text-slate-400">{batch.genericName} | {batch.batchNumber} | Stock: {batch.remainingQty}</p>
                    </div>
                    <button onClick={() => addRequestItem(batch)} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700">
                      <MdAdd />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {requestItems.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-bold text-slate-700">Request Items</p>
              {requestItems.map((item) => (
                <div key={item.inventoryBatchId} className="mb-1 flex items-center gap-2 rounded bg-slate-50 px-2 py-1.5">
                  <MdLocalPharmacy className="text-slate-400" />
                  <span className="flex-1 text-xs font-medium">{item.medicineName}</span>
                  <span className="text-[10px] text-slate-400">{item.batchNumber}</span>
                  <input
                    type="number" min={1} max={item.remainingQty || 999}
                    value={item.quantityRequested}
                    onChange={(e) => updateRequestQty(item.inventoryBatchId, parseInt(e.target.value) || 1)}
                    className="w-16 rounded border border-slate-300 px-2 py-1 text-xs text-center"
                  />
                  <button onClick={() => removeRequestItem(item.inventoryBatchId)} className="text-red-500 hover:text-red-700"><MdClose /></button>
                </div>
              ))}
              <div className="mt-2">
                <input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Remarks (optional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={submitRequest} className="rounded bg-green-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-700">
                  Submit Request
                </button>
                <button onClick={() => setRequestItems([])} className="rounded bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-300">
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
