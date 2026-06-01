import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LabOrders.css';
import api from '../../../utils/api';

const STATUS_META = {
  pending_billing: { badgeClass: 'lab-orders-badge lab-orders-badge--pending', rowClass: 'lab-orders-row--pending', label: 'Pending billing' },
  pending_sample: { badgeClass: 'lab-orders-badge lab-orders-badge--pending', rowClass: 'lab-orders-row--pending', label: 'Pending sample' },
  collected: { badgeClass: 'lab-orders-badge lab-orders-badge--sample', rowClass: '', label: 'Collected' },
  in_progress: { badgeClass: 'lab-orders-badge lab-orders-badge--sample', rowClass: '', label: 'In progress' },
  completed: { badgeClass: 'lab-orders-badge lab-orders-badge--completed', rowClass: '', label: 'Completed' },
  cancelled: { badgeClass: 'lab-orders-badge lab-orders-badge--pending', rowClass: '', label: 'Cancelled' },
};

function normalizeText(v) {
  return String(v || '').trim().toLowerCase();
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function mapApiRowToOrder(row) {
  const p = row.patient || {};
  const ws = normalizeText(row.workflowStatus || 'pending_sample').replace(/\s+/g, '_');
  const workflowKey =
    ws === 'pending_billing' ? 'pending_billing'
      : ws === 'pending_sample' ? 'pending_sample'
        : ws === 'collected' ? 'collected'
          : ws === 'in_progress' ? 'in_progress'
            : ws === 'completed' ? 'completed'
              : ws === 'cancelled' ? 'cancelled'
                : 'pending_sample';
  const tests = Array.isArray(row.tests) ? row.tests : [];
  const rs = String(row.reportStatus || '').toUpperCase();
  const reportDone =
    String(row.status || '').toUpperCase() === 'COMPLETED' || rs === 'COMPLETED' || rs === 'VERIFIED';

  return {
    id: row.id,
    orderNumber: row.orderNumber || '',
    workflowStatus: workflowKey,
    patientName: p.name || '',
    patientId: p.id,
    uhid: p.uhid || '',
    phone: p.mobile || '',
    age: p.age,
    gender: p.gender,
    doctorName: row.doctorName || '',
    tests: tests.map((t) => ({ name: t.name || '—', unit: t.unit, range: t.referenceRange })),
    date: row.createdAt,
    reportStatus: row.reportStatus,
    reportGeneratedAt: reportDone ? (row.updatedAt || row.createdAt) : null,
    rawStatus: row.status,
  };
}

export default function LabOrdersV2() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/lab/orders', { params: { status: 'DASHBOARD' } });
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setOrders(items.map(mapApiRowToOrder));
    } catch (e) {
      setOrders([]);
      setError(e?.response?.data?.message || 'Failed to load lab orders from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredOrders = useMemo(() => {
    const q = normalizeText(searchQuery);
    return orders.filter((o) => {
      const bySearch =
        !q
        || normalizeText(o.patientName).includes(q)
        || normalizeText(o.uhid).includes(q)
        || normalizeText(o.phone).includes(q)
        || normalizeText(o.orderNumber).includes(q)
        || normalizeText(o.id).includes(q);
      const byStatus = statusFilter === 'All' || o.workflowStatus === statusFilter;
      return bySearch && byStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const pendingBilling = orders.filter((o) => o.workflowStatus === 'pending_billing').length;
    const pendingSample = orders.filter((o) => o.workflowStatus === 'pending_sample').length;
    const sampleCollected = orders.filter((o) => o.workflowStatus === 'collected').length;
    const inProgress = orders.filter((o) => o.workflowStatus === 'in_progress').length;
    const completed = orders.filter((o) => o.workflowStatus === 'completed').length;
    const pendingTests = pendingBilling + pendingSample + inProgress;
    const reportsGenerated = orders.filter((o) => o.reportGeneratedAt).length;
    return { total, pendingTests, sampleCollected, completed, reportsGenerated, inProgress, pendingBilling, pendingSample };
  }, [orders]);

  return (
    <div className="lab-orders-container">
      <div className="lab-orders-page">
        <div className="lab-orders-cards">
          <div className="lab-orders-card">
            <p className="lab-orders-cardValue">{loading ? '…' : stats.total}</p>
            <p className="lab-orders-cardLabel">Total Orders</p>
          </div>
          <div className="lab-orders-card lab-orders-card--warn">
            <p className="lab-orders-cardValue">{loading ? '…' : stats.pendingTests}</p>
            <p className="lab-orders-cardLabel">Pending / In progress</p>
          </div>
          <div className="lab-orders-card lab-orders-card--info">
            <p className="lab-orders-cardValue">{loading ? '…' : stats.sampleCollected}</p>
            <p className="lab-orders-cardLabel">Sample Collected</p>
          </div>
          <div className="lab-orders-card lab-orders-card--ok">
            <p className="lab-orders-cardValue">{loading ? '…' : stats.completed}</p>
            <p className="lab-orders-cardLabel">Completed Tests</p>
          </div>
          <div className="lab-orders-card lab-orders-card--ok">
            <p className="lab-orders-cardValue">{loading ? '…' : stats.reportsGenerated}</p>
            <p className="lab-orders-cardLabel">Reports Generated</p>
          </div>
        </div>

        {error ? (
          <div className="lab-orders-panel" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <p style={{ margin: 0, color: '#991b1b', fontSize: 13 }}>{error}</p>
              <button type="button" className="lab-orders-btn lab-orders-btn--ghost" onClick={() => load()}>Retry</button>
            </div>
          </div>
        ) : null}

        <div className="lab-orders-panel">
          <div className="lab-orders-panelHeader">
            <p className="lab-orders-panelTitle">Search & filters</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="lab-orders-btn lab-orders-btn--ghost" onClick={() => load()} disabled={loading}>
                Refresh
              </button>
              <button
                type="button"
                className="lab-orders-btn lab-orders-btn--ghost"
                onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
              >
                Reset
              </button>
            </div>
          </div>
          <div className="lab-orders-controls">
            <div className="lab-orders-search">
              <label className="lab-orders-label" htmlFor="labOrdersSearch">Search</label>
              <input
                id="labOrdersSearch"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Patient name / UHID / Phone / Order #"
                className="lab-orders-input"
              />
            </div>
            <div className="lab-orders-filter">
              <label className="lab-orders-label" htmlFor="labOrdersStatus">Status</label>
              <select
                id="labOrdersStatus"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="lab-orders-select"
              >
                <option value="All">All</option>
                <option value="pending_billing">Pending billing</option>
                <option value="pending_sample">Pending sample</option>
                <option value="collected">Collected</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="lab-orders-tableWrap">
          <div className="lab-orders-tableHeader">
            <p className="lab-orders-tableTitle">Orders</p>
            <p className="lab-orders-tableHint">
              Showing
              {' '}
              <span className="lab-orders-strong">{filteredOrders.length}</span>
              {' '}
              of
              {' '}
              <span className="lab-orders-strong">{orders.length}</span>
            </p>
          </div>
          <div className="lab-orders-tableScroll">
            <table className="lab-orders-table">
              <thead className="lab-orders-thead">
                <tr>
                  <th className="lab-orders-th">Patient Name</th>
                  <th className="lab-orders-th">Phone</th>
                  <th className="lab-orders-th">Doctor Name</th>
                  <th className="lab-orders-th">Date</th>
                  <th className="lab-orders-th">Status</th>
                  <th className="lab-orders-th">Report</th>
                  <th className="lab-orders-th lab-orders-th--right">Actions</th>
                </tr>
              </thead>
              <tbody className="lab-orders-tbody">
                {loading ? (
                  <tr>
                    <td className="lab-orders-td" colSpan={7}>
                      <div className="lab-orders-empty">
                        <p className="lab-orders-emptyTitle">Loading orders…</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td className="lab-orders-td" colSpan={7}>
                      <div className="lab-orders-empty">
                        <p className="lab-orders-emptyTitle">No orders found</p>
                        <p className="lab-orders-emptySub">Try adjusting your search or filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const meta = STATUS_META[o.workflowStatus] || STATUS_META.pending_sample;
                    const reportGenerated = Boolean(o.reportGeneratedAt);
                    return (
                      <tr key={o.id} className={`lab-orders-row ${meta.rowClass}`}>
                        <td className="lab-orders-td">
                          <div className="lab-orders-patientCell">
                            <div className="lab-orders-avatar" aria-hidden="true">
                              {String(o.patientName || '?').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="lab-orders-patientText">
                              <div className="lab-orders-patientName">{o.patientName}</div>
                              <div className="lab-orders-patientMeta">
                                <span className="lab-orders-patientMetaItem lab-orders-mono">{o.uhid}</span>
                                <span className="lab-orders-patientMetaDot">·</span>
                                <span className="lab-orders-patientMetaItem lab-orders-mono">{o.orderNumber || o.id}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="lab-orders-td">{o.phone}</td>
                        <td className="lab-orders-td">{o.doctorName || '—'}</td>
                        <td className="lab-orders-td lab-orders-date">{formatDateTime(o.date)}</td>
                        <td className="lab-orders-td">
                          <span className={meta.badgeClass}>{meta.label}</span>
                        </td>
                        <td className="lab-orders-td">
                          <span className={`lab-orders-subBadge ${reportGenerated ? 'lab-orders-subBadge--ok' : 'lab-orders-subBadge--muted'}`}>
                            {reportGenerated ? 'Generated' : 'Not Generated'}
                          </span>
                        </td>
                        <td className="lab-orders-td lab-orders-td--right">
                          <div className="lab-orders-actions">
                            <button type="button" className="lab-orders-btn lab-orders-btn--ghost" onClick={() => setSelectedOrder(o)}>
                              View Details
                            </button>
                            {o.workflowStatus === 'completed' ? (
                              <button
                                type="button"
                                className="lab-orders-btn lab-orders-btn--ghost"
                                onClick={() => navigate('/dashboard/lab/reports', { state: { focusOrderId: o.id } })}
                              >
                                Report
                              </button>
                            ) : null}
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

      {selectedOrder ? (
        <div className="lab-orders-modalOverlay" role="dialog" aria-modal="true" onMouseDown={() => setSelectedOrder(null)}>
          <div className="lab-orders-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="lab-orders-modalHeader">
              <div className="lab-orders-modalTitleWrap">
                <p className="lab-orders-modalTitle">Order Details</p>
                <p className="lab-orders-modalSub">{selectedOrder.orderNumber || selectedOrder.id}</p>
              </div>
              <button type="button" className="lab-orders-iconBtn" onClick={() => setSelectedOrder(null)} aria-label="Close">✕</button>
            </div>
            <div className="lab-orders-modalBody">
              <div className="lab-orders-detailGrid">
                <div className="lab-orders-detailCard">
                  <p className="lab-orders-detailTitle">Patient</p>
                  <div className="lab-orders-kv">
                    <div>
                      <p className="lab-orders-k">Name</p>
                      <p className="lab-orders-v">{selectedOrder.patientName}</p>
                    </div>
                    <div>
                      <p className="lab-orders-k">UHID</p>
                      <p className="lab-orders-v lab-orders-mono">{selectedOrder.uhid}</p>
                    </div>
                    <div>
                      <p className="lab-orders-k">Phone</p>
                      <p className="lab-orders-v">{selectedOrder.phone}</p>
                    </div>
                    <div>
                      <p className="lab-orders-k">Doctor</p>
                      <p className="lab-orders-v">{selectedOrder.doctorName || '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="lab-orders-detailCard">
                  <p className="lab-orders-detailTitle">Order</p>
                  <div className="lab-orders-kv">
                    <div>
                      <p className="lab-orders-k">Date</p>
                      <p className="lab-orders-v">{formatDateTime(selectedOrder.date)}</p>
                    </div>
                    <div>
                      <p className="lab-orders-k">Status</p>
                      <p className="lab-orders-v">
                        <span className={(STATUS_META[selectedOrder.workflowStatus] || STATUS_META.pending_sample).badgeClass}>
                          {(STATUS_META[selectedOrder.workflowStatus] || STATUS_META.pending_sample).label}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="lab-orders-k">Report status</p>
                      <p className="lab-orders-v">{selectedOrder.reportStatus || '—'}</p>
                    </div>
                    <div>
                      <p className="lab-orders-k">Report generated</p>
                      <p className="lab-orders-v">{selectedOrder.reportGeneratedAt ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
                <div className="lab-orders-detailCard lab-orders-detailCard--wide">
                  <p className="lab-orders-detailTitle">Tests</p>
                  <div className="lab-orders-tests lab-orders-tests--modal">
                    {(selectedOrder.tests || []).map((t) => (
                      <span key={t.name} className="lab-orders-testChip">{t.name}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="lab-orders-modalActions">
                <button type="button" className="lab-orders-btn lab-orders-btn--ghost" onClick={() => setSelectedOrder(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
