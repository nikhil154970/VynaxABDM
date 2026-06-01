import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdDownload, MdPrint } from 'react-icons/md';
import api from '../utils/api';
import {
  downloadFormalLabReportHtml,
  labReportApiToFormalReport,
  openFormalLabReportWindow,
} from '../utils/formalLabReportPrint';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fetchFormalReport(requestId) {
  const res = await api.get(`/lab/reports/${encodeURIComponent(requestId)}`);
  const data = res?.data;
  if (!data) throw new Error('Empty report');
  return labReportApiToFormalReport(data);
}

export default function PatientLabReportsPanel({
  patientId,
  consultationId = null,
  title = 'Lab reports',
  /** When nested inside another card (e.g. nurse IPD), drop outer chrome and optional title. */
  embedded = false,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const pid = String(patientId || '').trim();
  const valid = UUID_RE.test(pid);

  const load = useCallback(async () => {
    if (!valid) {
      setItems([]);
      setErr('');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await api.get(`/patients/${encodeURIComponent(pid)}/lab-reports`);
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setItems([]);
      setErr(e?.response?.data?.message || 'Could not load lab reports.');
    } finally {
      setLoading(false);
    }
  }, [pid, valid]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleItems = useMemo(() => {
    if (!consultationId) return items;
    const cid = String(consultationId).trim();
    return items.filter((row) => String(row.consultationId || '') === cid);
  }, [items, consultationId]);

  if (!pid) return null;

  return (
    <div
      className={
        embedded
          ? 'w-full'
          : 'w-full rounded-2xl border p-4 sm:p-5'
      }
      style={embedded ? undefined : { background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
    >
      <div
        className={`flex items-center gap-2 flex-wrap mb-3 ${embedded ? 'justify-end' : 'justify-between'}`}
      >
        {!embedded ? (
          <p className="text-xs font-extrabold uppercase tracking-wide text-gray-600">{title}</p>
        ) : null}
        <button
          type="button"
          onClick={load}
          disabled={loading || !valid}
          className="text-xs font-extrabold text-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {!valid ? (
        <p className="text-sm text-gray-500">Patient id is not available for lab lookup.</p>
      ) : null}
      {err ? (
        <p className="text-sm font-semibold text-red-700 mb-2">{err}</p>
      ) : null}
      {valid && !loading && items.length === 0 && !err ? (
        <p className="text-sm text-gray-500">No completed lab reports for this patient.</p>
      ) : null}
      {valid && !loading && items.length > 0 && consultationId && visibleItems.length === 0 && !err ? (
        <p className="text-sm text-gray-500">No finalized lab report for this visit yet (tests may still be pending at the lab).</p>
      ) : null}
      {valid && visibleItems.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] font-extrabold uppercase text-gray-500 bg-slate-50/80 border-b">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Tests</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 w-44">Report</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((row) => (
                <tr key={row.requestId} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{row.orderNumber}</td>
                  <td className="px-3 py-2 text-xs text-gray-800">
                    {(row.tests || []).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs font-semibold text-emerald-700">{row.workflowStatus || row.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const formal = await fetchFormalReport(row.requestId);
                            openFormalLabReportWindow([formal], { autoPrint: true });
                          } catch (e) {
                            window.alert(e?.response?.data?.message || e?.message || 'Could not open report.');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-extrabold border border-gray-200 hover:bg-gray-50 text-gray-800"
                      >
                        <MdPrint className="text-base" /> Print
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const formal = await fetchFormalReport(row.requestId);
                            downloadFormalLabReportHtml([formal], row.orderNumber || row.requestId);
                          } catch (e) {
                            window.alert(e?.response?.data?.message || e?.message || 'Could not download report.');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-extrabold border border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                      >
                        <MdDownload className="text-base" /> Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
