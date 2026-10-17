import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdSearch } from 'react-icons/md';
import api from '../../../utils/api';
import { printDischargeByType, dischargeTypeLabel } from '../../../utils/dischargePrint';
import './DischargeHistory.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DischargeHistory() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/receptionist/ipd/discharges/history', {
        params: {
          q: query.trim() || undefined,
          fromDate: dateFrom || undefined,
          toDate: dateTo || undefined,
          doctorId: doctorId || undefined,
          page: 1,
          limit: 200,
        },
      });
      setRecords(Array.isArray(res.data?.items) ? res.data.items : []);
      setDoctorOptions(Array.isArray(res.data?.doctorOptions) ? res.data.doctorOptions : []);
      setTotal(Number(res.data?.total) || 0);
    } catch (e) {
      setRecords([]);
      setDoctorOptions([]);
      setTotal(0);
      setError(e?.response?.data?.message || e?.message || 'Could not load discharge history');
    } finally {
      setLoading(false);
    }
  }, [query, dateFrom, dateTo, doctorId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchHistory();
    }, 320);
    return () => clearTimeout(t);
  }, [fetchHistory]);

  const sorted = useMemo(
    () => [...records].sort((a, b) => new Date(b.dischargedAt).getTime() - new Date(a.dischargedAt).getTime()),
    [records],
  );

  const hasActiveFilters = Boolean(dateFrom || dateTo || doctorId || query.trim());

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDoctorId('');
    setQuery('');
  };

  const printRecordSummary = (r) => {
    if (!r?.dischargeSummary) {
      window.alert('Is patient ke liye saved discharge summary nahi mili.');
      return;
    }
    const b = r.billingSummary || { total: 0, paid: 0, pending: 0 };
    printDischargeByType({
      summary: r.dischargeSummary,
      billing: { total: b.total, paid: b.paid, pending: b.pending },
    });
  };

  const openEditSummary = (r) => {
    navigate(`/dashboard/reception/ipd/discharge/summary/${encodeURIComponent(r.id)}`, {
      state: {
        editSummary: true,
        dischargeSummary: r.dischargeSummary || null,
        historyMeta: {
          ward: r.ward,
          bed: r.bed,
          doctor: r.doctor,
          billingSummary: r.billingSummary || null,
        },
      },
    });
  };

  return (
    <div className="discharge-history-container">
      <div className="discharge-history-shell">
        <div className="discharge-history-bar">
          <div className="discharge-history-filterGroup">
            <span className="discharge-history-filterLabel">Search Patient</span>
            <div className="discharge-history-searchWrap-inner">
              <MdSearch className="discharge-history-searchIcon" />
              <input
                id="discharge-history-search"
                type="search"
                className="discharge-history-search"
                placeholder="Search name, UHID, IPD no…"
                aria-label="Search discharge records"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="discharge-history-filterGroup">
            <span className="discharge-history-filterLabel">From date</span>
            <input
              type="date"
              className="discharge-history-dateInput"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Discharge from date"
            />
          </div>
          <div className="discharge-history-filterGroup">
            <span className="discharge-history-filterLabel">To date</span>
            <input
              type="date"
              className="discharge-history-dateInput"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Discharge to date"
            />
          </div>
          <div className="discharge-history-filterGroup">
            <span className="discharge-history-filterLabel">Doctor</span>
            <select
              className="discharge-history-select"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              aria-label="Filter by doctor"
            >
              <option value="">All doctors</option>
              {doctorOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters ? (
            <button type="button" className="discharge-history-clearBtn" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        <section className="discharge-history-card">
          <div className="discharge-history-cardHeader">
            <h2 className="discharge-history-cardTitle">Discharged patients</h2>
            <p className="discharge-history-cardSub">
              {loading
                ? 'Loading…'
                : error
                  ? error
                  : `Discharges with date set (newest first). Rows: ${sorted.length} of ${total}. Status reflects unpaid IPD bills for this admission.`}
            </p>
          </div>

          {error && !loading ? (
            <div className="discharge-history-empty" style={{ color: '#b45309' }}>
              {error}
            </div>
          ) : null}

          {!loading && !error && sorted.length === 0 ? (
            <div className="discharge-history-empty">
              {total === 0 ? 'No discharged admissions found.' : 'No records match your filters or search.'}
            </div>
          ) : null}

          {!loading && sorted.length > 0 ? (
            <div className="discharge-history-tableWrap">
                <table className="discharge-history-table">
                  <thead>
                    <tr>
                      <th scope="col">Patient</th>
                      <th scope="col">UHID</th>
                      <th scope="col">Ward / bed</th>
                      <th scope="col">Doctor</th>
                      <th scope="col">Nurse (approval)</th>
                      <th scope="col">Discharged on</th>
                      <th scope="col">Discharge type</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => (
                      <tr key={r.id}>
                        <td className="discharge-history-tdStrong">{r.name}</td>
                        <td>
                          <span className="discharge-history-mono">{r.uhid}</span>
                        </td>
                        <td>
                          {r.ward} <span className="discharge-history-sep">/</span> {r.bed}
                        </td>
                        <td>{r.doctor}</td>
                        <td>{r.nurseApprovedBy}</td>
                        <td className="discharge-history-tdNowrap">{formatDate(r.dischargedAt)}</td>
                        <td>
                          <span className="discharge-history-badge discharge-history-badge--type">
                            {dischargeTypeLabel(r.dischargeType || r.dischargeSummary?.dischargeType)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              r.dischargeStatus === 'Discharged with Dues'
                                ? 'discharge-history-badge discharge-history-badge--dues'
                                : 'discharge-history-badge discharge-history-badge--ok'
                            }
                          >
                            {r.dischargeStatus}
                          </span>
                        </td>
                        <td className="discharge-history-actions">
                          <button
                            type="button"
                            className="discharge-history-actionBtn"
                            onClick={() => printRecordSummary(r)}
                            disabled={!r.hasDischargeSummary}
                            title={r.hasDischargeSummary ? 'Print discharge summary' : 'No saved summary'}
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            className="discharge-history-actionBtn discharge-history-actionBtn--secondary"
                            onClick={() => openEditSummary(r)}
                            disabled={!r.hasDischargeSummary}
                          >
                            Edit summary
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
