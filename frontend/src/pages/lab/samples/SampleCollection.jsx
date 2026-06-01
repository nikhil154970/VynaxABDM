import { useCallback, useEffect, useMemo, useState } from 'react';
import './SampleCollection.css';
import api from '../../../utils/api';

const SAMPLE_TYPES = ['Blood', 'Urine', 'Stool', 'Swab', 'Sputum'];

const UI_PENDING = 'Pending';
const UI_COLLECTED = 'Collected';
const UI_IN_PROGRESS = 'In progress';
const UI_COMPLETED = 'Completed';

const STATUS_META = {
  [UI_PENDING]: { badgeClass: 'sample-collection-badge sample-collection-badge--pending', rowClass: 'sample-collection-row--pending' },
  [UI_COLLECTED]: { badgeClass: 'sample-collection-badge sample-collection-badge--collected', rowClass: '' },
  [UI_IN_PROGRESS]: { badgeClass: 'sample-collection-badge sample-collection-badge--collected', rowClass: '' },
  [UI_COMPLETED]: { badgeClass: 'sample-collection-badge sample-collection-badge--collected', rowClass: '' },
};

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toInputLocalValue(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputLocalValue(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeText(v) {
  return String(v || '').trim().toLowerCase();
}

function guessSampleType(tests) {
  const blob = (tests || []).map((t) => `${t.category || ''} ${t.name || ''}`).join(' ').toLowerCase();
  if (blob.includes('urine')) return 'Urine';
  if (blob.includes('stool')) return 'Stool';
  if (blob.includes('swab') || blob.includes('sputum')) return 'Swab';
  return 'Blood';
}

function mapApiRowToUi(row) {
  const p = row.patient || {};
  const ws = row.workflowStatus || 'pending_sample';
  const label =
    ws === 'pending_sample'
      ? UI_PENDING
      : ws === 'collected'
        ? UI_COLLECTED
        : ws === 'in_progress'
          ? UI_IN_PROGRESS
          : ws === 'completed'
            ? UI_COMPLETED
            : UI_PENDING;
  const tests = Array.isArray(row.tests) ? row.tests : [];
  return {
    id: row.id,
    workflowStatus: ws,
    status: label,
    patientName: p.name || '',
    uhid: p.uhid || '',
    phone: p.mobile || '',
    doctorName: row.doctorName || '',
    tests: tests.map((t) => ({ name: t.name || '—' })),
    sampleType: guessSampleType(tests),
    date: row.createdAt,
    orderNumber: row.orderNumber,
    collectedAt: ws !== 'pending_sample' ? row.billedAt || row.createdAt : null,
  };
}

export default function SampleCollection() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOrder, setConfirmOrder] = useState(null);
  const [collectionTime, setCollectionTime] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/lab/requests');
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      const ui = items.map(mapApiRowToUi);
      setOrders(ui);
    } catch (e) {
      setOrders([]);
      setLoadError(e?.response?.data?.message || 'Failed to load lab requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.workflowStatus === 'pending_sample').length;
    const collected = orders.filter((o) => o.workflowStatus === 'collected').length;
    const inProg = orders.filter((o) => o.workflowStatus === 'in_progress').length;
    return { pending, collected, inProg };
  }, [orders]);

  useEffect(() => {
    const q = normalizeText(searchQuery);
    const bySearch = (o) => {
      if (!q) return true;
      return (
        normalizeText(o.patientName).includes(q) ||
        normalizeText(o.uhid).includes(q) ||
        normalizeText(o.phone).includes(q) ||
        normalizeText(o.orderNumber || '').includes(q)
      );
    };

    const byStatus = (o) => {
      if (!statusFilter || statusFilter === 'All') return true;
      return o.status === statusFilter;
    };

    const next = orders
      .filter((o) => bySearch(o) && byStatus(o))
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setFilteredOrders(next);
  }, [orders, searchQuery, statusFilter]);

  const handleSearch = (value) => setSearchQuery(value);
  const handleFilter = (value) => setStatusFilter(value);

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedOrder(null);
  };

  const openCollectConfirm = (order) => {
    if (!order || order.workflowStatus !== 'pending_sample') return;
    setConfirmOrder(order);
    setCollectionTime(toInputLocalValue(new Date().toISOString()));
    setConfirmOpen(true);
  };

  const closeCollectConfirm = () => {
    setConfirmOpen(false);
    setConfirmOrder(null);
    setCollectionTime('');
  };

  const handleCollectSample = async () => {
    if (!confirmOrder) return;
    setActionBusy(true);
    try {
      await api.put(`/lab/requests/${encodeURIComponent(confirmOrder.id)}/collect`);
      closeCollectConfirm();
      await loadOrders();
    } catch (e) {
      window.alert(e?.response?.data?.message || 'Could not collect sample');
    } finally {
      setActionBusy(false);
    }
  };

  const handleStartTest = async (order) => {
    if (!order?.id) return;
    setActionBusy(true);
    try {
      await api.put(`/lab/requests/${encodeURIComponent(order.id)}/start`);
      await loadOrders();
      closeDetails();
    } catch (e) {
      window.alert(e?.response?.data?.message || 'Could not start test');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="sample-collection-container">
      <div className="sample-collection-page">
        <div className="sample-collection-top">
          <div className="sample-collection-titleWrap">
            {loadError ? <p className="text-sm text-red-600 font-semibold px-2">{loadError}</p> : null}
          </div>
        </div>

        <div className="sample-collection-cards">
          <div className="sample-collection-card sample-collection-card--warn">
            <p className="sample-collection-cardValue">{stats.pending}</p>
            <p className="sample-collection-cardLabel">Pending sample</p>
          </div>
          <div className="sample-collection-card sample-collection-card--info">
            <p className="sample-collection-cardValue">{stats.collected}</p>
            <p className="sample-collection-cardLabel">Collected (await start)</p>
          </div>
          <div className="sample-collection-card">
            <p className="sample-collection-cardValue">{stats.inProg}</p>
            <p className="sample-collection-cardLabel">In progress</p>
          </div>
        </div>

        <div className="sample-collection-panel">
          <div className="sample-collection-panelHeader">
            <p className="sample-collection-panelTitle">Search & filters</p>
            <button
              type="button"
              className="sample-collection-btn sample-collection-btn--ghost"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
              }}
            >
              Reset
            </button>
          </div>

          <div className="sample-collection-controls">
            <div className="sample-collection-search">
              <label className="sample-collection-label" htmlFor="sampleCollectionSearch">Search</label>
              <input
                id="sampleCollectionSearch"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Patient name / UHID / Phone / Order"
                className="sample-collection-input"
              />
            </div>

            <div className="sample-collection-filter">
              <label className="sample-collection-label" htmlFor="sampleCollectionStatus">Status</label>
              <select
                id="sampleCollectionStatus"
                value={statusFilter}
                onChange={(e) => handleFilter(e.target.value)}
                className="sample-collection-select"
              >
                <option value="All">All</option>
                <option value={UI_PENDING}>{UI_PENDING}</option>
                <option value={UI_COLLECTED}>{UI_COLLECTED}</option>
                <option value={UI_IN_PROGRESS}>{UI_IN_PROGRESS}</option>
                <option value={UI_COMPLETED}>{UI_COMPLETED}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="sample-collection-tableWrap">
          <div className="sample-collection-tableHeader">
            <p className="sample-collection-tableTitle">Samples</p>
            <p className="sample-collection-tableHint">
              <button
                type="button"
                className="sample-collection-btn sample-collection-btn--ghost mr-2"
                onClick={() => loadOrders()}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
              Showing <span className="sample-collection-strong">{filteredOrders.length}</span> of{' '}
              <span className="sample-collection-strong">{orders.length}</span>
            </p>
          </div>

          <div className="sample-collection-tableScroll">
            <table className="sample-collection-table">
              <thead className="sample-collection-thead">
                <tr>
                  <th className="sample-collection-th">Patient Name</th>
                  <th className="sample-collection-th">Phone</th>
                  <th className="sample-collection-th">Sample Type</th>
                  <th className="sample-collection-th">Date</th>
                  <th className="sample-collection-th">Status</th>
                  <th className="sample-collection-th sample-collection-th--right">Actions</th>
                </tr>
              </thead>
              <tbody className="sample-collection-tbody">
                {loading && !orders.length ? (
                  <tr>
                    <td className="sample-collection-td" colSpan={6}>
                      <div className="sample-collection-empty">
                        <p className="sample-collection-emptyTitle">Loading…</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td className="sample-collection-td" colSpan={6}>
                      <div className="sample-collection-empty">
                        <p className="sample-collection-emptyTitle">No samples found</p>
                        <p className="sample-collection-emptySub">Try adjusting your search or filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const meta = STATUS_META[o.status] || STATUS_META[UI_PENDING];
                    const canCollect = o.workflowStatus === 'pending_sample';
                    const canStart = o.workflowStatus === 'collected';

                    return (
                      <tr key={o.id} className={`sample-collection-row ${meta.rowClass}`}>
                        <td className="sample-collection-td">
                          <div className="sample-collection-patientCell">
                            <div className="sample-collection-avatar" aria-hidden="true">
                              {String(o.patientName || '?').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="sample-collection-patientText">
                              <div className="sample-collection-patientName">{o.patientName}</div>
                              <div className="sample-collection-patientMeta">
                                <span className="sample-collection-patientMetaItem sample-collection-mono">{o.uhid}</span>
                                <span className="sample-collection-patientMetaDot">·</span>
                                <span className="sample-collection-patientMetaItem">{o.orderNumber || o.id}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="sample-collection-td">{o.phone}</td>
                        <td className="sample-collection-td">
                          <span className="sample-collection-chip">{SAMPLE_TYPES.includes(o.sampleType) ? o.sampleType : String(o.sampleType || '—')}</span>
                        </td>
                        <td className="sample-collection-td sample-collection-date">{formatDateTime(o.date)}</td>
                        <td className="sample-collection-td">
                          <span className={meta.badgeClass}>{o.status}</span>
                        </td>
                        <td className="sample-collection-td sample-collection-td--right">
                          <div className="sample-collection-actions">
                            <button
                              type="button"
                              className="sample-collection-btn sample-collection-btn--ghost"
                              onClick={() => handleViewDetails(o)}
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              className="sample-collection-btn sample-collection-btn--primary"
                              onClick={() => openCollectConfirm(o)}
                              disabled={!canCollect || actionBusy}
                              title={canCollect ? 'Collect sample' : 'Already collected or completed'}
                            >
                              Collect Sample
                            </button>
                            <button
                              type="button"
                              className="sample-collection-btn sample-collection-btn--ghost"
                              onClick={() => handleStartTest(o)}
                              disabled={!canStart || actionBusy}
                              title={canStart ? 'Start test (processing)' : 'Collect sample first'}
                            >
                              Start Test
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

      {detailsOpen && selectedOrder ? (
        <div className="sample-collection-modalOverlay" role="dialog" aria-modal="true" onMouseDown={closeDetails}>
          <div className="sample-collection-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sample-collection-modalHeader">
              <div className="sample-collection-modalTitleWrap">
                <p className="sample-collection-modalTitle">Order Details</p>
                <p className="sample-collection-modalSub">{selectedOrder.orderNumber || selectedOrder.id}</p>
              </div>
              <button type="button" className="sample-collection-iconBtn" onClick={closeDetails} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="sample-collection-modalBody">
              <div className="sample-collection-detailGrid">
                <div className="sample-collection-detailCard">
                  <p className="sample-collection-detailTitle">Patient</p>
                  <div className="sample-collection-kv">
                    <div>
                      <p className="sample-collection-k">Name</p>
                      <p className="sample-collection-v">{selectedOrder.patientName}</p>
                    </div>
                    <div>
                      <p className="sample-collection-k">UHID</p>
                      <p className="sample-collection-v sample-collection-mono">{selectedOrder.uhid}</p>
                    </div>
                    <div>
                      <p className="sample-collection-k">Phone</p>
                      <p className="sample-collection-v">{selectedOrder.phone}</p>
                    </div>
                    <div>
                      <p className="sample-collection-k">Sample Type</p>
                      <p className="sample-collection-v">{selectedOrder.sampleType}</p>
                    </div>
                    {selectedOrder.collectedAt ? (
                      <div>
                        <p className="sample-collection-k">Last update</p>
                        <p className="sample-collection-v">{formatDateTime(selectedOrder.collectedAt)}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="sample-collection-detailCard">
                  <p className="sample-collection-detailTitle">Tests to perform</p>
                  <div className="sample-collection-tests sample-collection-tests--modal">
                    {selectedOrder.tests.length === 0 ? (
                      <p className="sample-collection-detailEmpty">No tests listed for this order.</p>
                    ) : (
                      selectedOrder.tests.map((test, idx) => (
                        <span key={`${test.name}-${idx}`} className="sample-collection-testChip">
                          {test.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="sample-collection-modalActions">
                <button type="button" className="sample-collection-btn sample-collection-btn--ghost" onClick={closeDetails}>
                  Close
                </button>
                {selectedOrder.workflowStatus === 'pending_sample' ? (
                  <button
                    type="button"
                    className="sample-collection-btn sample-collection-btn--primary"
                    onClick={() => {
                      closeDetails();
                      openCollectConfirm(selectedOrder);
                    }}
                  >
                    Collect Sample
                  </button>
                ) : null}
                {selectedOrder.workflowStatus === 'collected' ? (
                  <button
                    type="button"
                    className="sample-collection-btn sample-collection-btn--primary"
                    disabled={actionBusy}
                    onClick={() => handleStartTest(selectedOrder)}
                  >
                    Start Test
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmOpen && confirmOrder ? (
        <div className="sample-collection-modalOverlay" role="dialog" aria-modal="true" onMouseDown={closeCollectConfirm}>
          <div className="sample-collection-modal sample-collection-modal--narrow" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sample-collection-modalHeader">
              <div className="sample-collection-modalTitleWrap">
                <p className="sample-collection-modalTitle">Confirm Collection</p>
                <p className="sample-collection-modalSub">{confirmOrder.patientName} · {confirmOrder.uhid}</p>
              </div>
              <button type="button" className="sample-collection-iconBtn" onClick={closeCollectConfirm} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="sample-collection-modalBody">
              <div className="sample-collection-confirmCard">
                <p className="sample-collection-confirmTitle">Collection time (record)</p>
                <input
                  type="datetime-local"
                  value={collectionTime}
                  onChange={(e) => setCollectionTime(e.target.value)}
                  className="sample-collection-input"
                />
                <p className="sample-collection-confirmHint">Time is for your records; server marks sample as collected.</p>
              </div>

              <div className="sample-collection-modalActions">
                <button type="button" className="sample-collection-btn sample-collection-btn--ghost" onClick={closeCollectConfirm}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="sample-collection-btn sample-collection-btn--primary"
                  onClick={handleCollectSample}
                  disabled={actionBusy}
                >
                  {actionBusy ? '…' : 'Confirm & Collect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
