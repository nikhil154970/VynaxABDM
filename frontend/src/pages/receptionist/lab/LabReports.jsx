import { useCallback, useEffect, useState } from 'react';
import { MdDownload, MdPrint, MdRefresh } from 'react-icons/md';
import api from '../../../utils/api';
import {
  downloadFormalLabReportHtml,
  labReportApiToFormalReport,
  openFormalLabReportWindow,
} from '../../../utils/formalLabReportPrint';

export default function LabReports() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/lab/orders', { params: { status: 'COMPLETED' } });
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setRows(items);
    } catch (e) {
      setRows([]);
      setError(e?.response?.data?.message || 'Failed to load lab reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((o) => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return true;
    const p = o.patient || {};
    const blob = `${o.orderNumber} ${p.name} ${p.uhid} ${p.mobile}`.toLowerCase();
    return blob.includes(q);
  });

  const printFormal = async (requestId) => {
    try {
      const res = await api.get(`/lab/reports/${encodeURIComponent(requestId)}`);
      const formal = labReportApiToFormalReport(res?.data);
      openFormalLabReportWindow([formal], { autoPrint: true });
    } catch (e) {
      window.alert(e?.response?.data?.message || 'Could not load report for printing.');
    }
  };

  const downloadFormal = async (requestId, orderNumber) => {
    try {
      const res = await api.get(`/lab/reports/${encodeURIComponent(requestId)}`);
      const formal = labReportApiToFormalReport(res?.data);
      downloadFormalLabReportHtml([formal], orderNumber || requestId);
    } catch (e) {
      window.alert(e?.response?.data?.message || 'Could not download report.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA]">
      <div className="w-full px-4 sm:px-6 py-4 sm:py-5 max-w-5xl mx-auto space-y-4">
        <div className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div>
            <h1 className="text-lg font-extrabold text-gray-900">Lab reports</h1>
            <p className="text-xs text-gray-500 mt-1">Completed lab orders — print or download from browser print dialog</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-extrabold border bg-white"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          >
            <MdRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-red-50 text-red-800 border border-red-100">{error}</div>
        ) : null}

        <div className="rounded-xl border p-3 bg-white" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, UHID, order…"
            className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200"
          />
        </div>

        <div className="rounded-2xl border overflow-hidden bg-white" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-extrabold uppercase text-gray-500 border-b bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Tests</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-52">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      No completed lab reports
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => {
                    const p = o.patient || {};
                    const names = (o.tests || []).map((t) => t.name).filter(Boolean);
                    return (
                      <tr key={o.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {p.name || '—'}
                          <div className="text-[11px] font-mono text-gray-500">{p.uhid || ''}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{names.length ? names.join(', ') : '—'}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-emerald-700">{o.workflowStatus || o.status}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => printFormal(o.id)}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold border border-gray-200 hover:bg-gray-50"
                            >
                              <MdPrint className="text-base" /> Print
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadFormal(o.id, o.orderNumber)}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold border border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                            >
                              <MdDownload className="text-base" /> Download
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
