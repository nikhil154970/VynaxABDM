import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './GenerateReport.css';
import api from '../../../utils/api';
import {
  REPORT_LOGO_DATA_URI,
  buildPrintPagesForReport,
  downloadFormalLabReportHtml,
  formatDateOnly,
  formatTimeOnly,
  openFormalLabReportWindow,
} from '../../../utils/formalLabReportPrint';

function mapListItemToReport(o) {
  const p = o.patient || {};
  return {
    id: o.id,
    orderNumber: o.orderNumber || '',
    patientId: p.id,
    patientName: p.name,
    uhid: p.uhid,
    phone: p.mobile,
    age: p.age,
    gender: p.gender,
    doctorName: o.doctorName,
    date: o.createdAt,
    reportGeneratedAt: o.updatedAt || o.createdAt,
    status: o.status,
    reportStatus: o.reportStatus,
    results: [],
  };
}

function mergeApiReportDetail(data) {
  const p = data.patient || {};
  return {
    id: data.requestId,
    orderNumber: data.orderNumber || '',
    patientId: p.id,
    patientName: p.name,
    uhid: p.uhid,
    phone: p.mobile,
    age: p.age,
    gender: p.gender,
    doctorName: data.doctorName,
    date: data.createdAt,
    reportGeneratedAt: data.updatedAt || data.createdAt,
    overallRemarks: data.notes || null,
    diagnosis: null,
    billNumber: data.billNumber || null,
    orderTests: (data.tests || []).map((t) => ({
      name: t.name,
      testName: t.name,
      category: t.category || null,
    })),
    results: (data.results || [])
      .filter((r) => String(r?.value ?? '').trim())
      .filter((r, i, arr) => arr.findIndex((x) => x.testName === r.testName && x.value === r.value) === i)
      .map((r) => ({
        name: r.testName,
        value: r.value,
        unit: r.unit,
        range: r.referenceRange,
        category: r.category || null,
        remarks: r.remarks,
        fileUrl: r.fileUrl,
      })),
    status: 'COMPLETED',
    reportStatus: data.reportStatus,
  };
}

function normalizeText(v) {
  return String(v || '').trim().toLowerCase();
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function patientKey(o) {
  const pid = String(o?.patientId || '').trim();
  const uhid = String(o?.uhid || '').trim();
  const phone = String(o?.phone || '').trim();
  if (pid) return `pid:${pid}`;
  if (uhid) return `uhid:${uhid}`;
  if (phone) return `phone:${phone}`;
  return `name:${String(o?.patientName || '').trim().toLowerCase()}`;
}

export default function GenerateReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusOrderId = location.state?.focusOrderId;
  const [orders, setOrders] = useState([]);
  const [listError, setListError] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [detailById, setDetailById] = useState({});
  const [detailLoading, setDetailLoading] = useState(false);
  const detailByIdRef = useRef({});
  detailByIdRef.current = detailById;

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [activeReportId, setActiveReportId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setListError('');
      try {
        const res = await api.get('/lab/orders', { params: { status: 'COMPLETED' } });
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (!cancelled) setOrders(items.map(mapListItemToReport));
      } catch (e) {
        if (!cancelled) {
          setOrders([]);
          setListError(e?.response?.data?.message || 'Failed to load completed lab orders.');
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!focusOrderId || listLoading || !orders.length) return;
    const match = orders.find((o) => String(o.id) === String(focusOrderId));
    if (match) setSelected(match);
  }, [focusOrderId, orders, listLoading]);

  const reports = useMemo(
    () => orders
      .filter((o) => {
        const q = normalizeText(search);
        if (!q) return true;
        return (
          normalizeText(o.patientName).includes(q)
          || normalizeText(o.id).includes(q)
          || normalizeText(o.phone).includes(q)
          || normalizeText(o.uhid).includes(q)
        );
      })
      .sort((a, b) => new Date(b.reportGeneratedAt || b.date).getTime() - new Date(a.reportGeneratedAt || a.date).getTime()),
    [orders, search],
  );

  const patientRows = useMemo(() => {
    const map = new Map();
    reports.forEach((r) => {
      const key = patientKey(r);
      const existing = map.get(key);
      const time = new Date(r.reportGeneratedAt || r.date).getTime();
      if (!existing) {
        map.set(key, { key, latest: r, latestTime: time });
        return;
      }
      if (time > existing.latestTime) {
        existing.latest = r;
        existing.latestTime = time;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.latestTime - a.latestTime);
  }, [reports]);

  const patientReports = useMemo(() => {
    if (!selected) return [];
    // Match strictly by the same patient identity used for list grouping
    // (patient-id → UHID → phone → name). This avoids merging different people
    // who happen to share a mobile number, which showed a false "previous test".
    const selectedKey = patientKey(selected);
    const matches = reports.filter((r) => patientKey(r) === selectedKey);
    const base = matches.length ? matches : [selected];
    const unique = base.filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i);
    return unique.map((r) => ({ ...r, ...(detailById[r.id] || {}) }));
  }, [reports, selected, detailById]);

  useEffect(() => {
    if (!selected) return;
    const selectedKey = patientKey(selected);
    const candidates = reports.filter(
      (r) => patientKey(r) === selectedKey || String(r.id) === String(selected.id),
    );
    const ids = (candidates.length ? candidates : [selected]).map((r) => r.id).filter(Boolean);
    const missing = ids;

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        await Promise.all(
          missing.map(async (id) => {
            try {
              const res = await api.get(`/lab/reports/${encodeURIComponent(id)}`);
              if (cancelled || !res?.data) return;
              const merged = mergeApiReportDetail(res.data);
              setDetailById((prev) => ({ ...prev, [id]: merged }));
            } catch (e) {
              window.alert(e?.response?.data?.message || `Could not load report ${id}`);
            }
          }),
        );
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, reports]);

  useEffect(() => {
    if (!selected) { setActiveReportId(''); return; }
    setActiveReportId(String(selected.id || ''));
  }, [selected]);

  const activeReport = useMemo(() => {
    if (!selected) return null;
    const id = String(activeReportId || selected.id || '');
    return patientReports.find((r) => String(r.id) === id) || selected;
  }, [activeReportId, patientReports, selected]);

  /** Reports that actually have printable results (newest first). */
  const printableReports = useMemo(
    () => patientReports.filter((r) => buildPrintPagesForReport(r).length),
    [patientReports],
  );

  const getSelectionSummary = (report) => {
    const categoryRaw = report?.selectedCategoryFilter;
    const categoryList = Array.isArray(categoryRaw)
      ? categoryRaw.filter(Boolean)
      : (categoryRaw && categoryRaw !== 'All' && categoryRaw !== 'All Categories' ? [String(categoryRaw)] : []);
    const categoryText = categoryList.length ? categoryList.join(', ') : 'Complete Test';
    const relatedRaw = report?.selectedFormFilter;
    const relatedList = Array.isArray(relatedRaw)
      ? relatedRaw.filter(Boolean)
      : (relatedRaw && relatedRaw !== 'all' ? [String(relatedRaw)] : []);
    const relatedText = relatedList.length ? relatedList.join(', ') : 'Complete Test';
    if (categoryText === 'Complete Test' && relatedText === 'Complete Test') return 'Complete Test';
    if (categoryText !== 'Complete Test' && relatedText === 'Complete Test') return categoryText;
    if (categoryText === 'Complete Test' && relatedText !== 'Complete Test') return relatedText;
    return `${categoryText} / ${relatedText}`;
  };

  const handleDownload = (report) => {
    if (!report || !(report.results || []).length) {
      window.alert('Load or select a report with results first.');
      return;
    }
    downloadFormalLabReportHtml([report], report.orderNumber || report.id || 'lab-report');
  };

  const handleShare = async (report) => {
    const text = `Lab report ready for ${report.patientName} (${report.uhid})`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Lab Report', text }); return; } catch (error) { /* fallback */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      window.alert('Report summary copied. You can share it now.');
    } catch (error) {
      window.alert(`Share (dummy): ${text}`);
    }
  };

  const handlePrintMany = (printReports) => {
    const list = Array.isArray(printReports) ? printReports.filter(Boolean) : [];
    if (list.length === 0) return;
    const sorted = list.slice().sort((a, b) => new Date(a.reportGeneratedAt || a.date).getTime() - new Date(b.reportGeneratedAt || b.date).getTime());
    openFormalLabReportWindow(sorted, { autoPrint: true });
  };

  const handlePrint = (report) => handlePrintMany([report]);

  return (
    <div className="lab-reports-container">
      <div className="lab-reports-page">
        <div className="lab-reports-panel">
          <input
            id="labReportSearch"
            className="lab-reports-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient id, phone, name"
          />
        </div>

        {listError ? (
          <div className="lab-reports-panel" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <p className="lab-reports-label" style={{ color: '#991b1b' }}>{listError}</p>
          </div>
        ) : null}

        <div className="lab-reports-tableWrap">
          <table className="lab-reports-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Phone</th>
                <th>Report Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr><td colSpan={5} className="lab-reports-empty">Loading completed orders…</td></tr>
              ) : patientRows.length === 0 ? (
                <tr><td colSpan={5} className="lab-reports-empty">No reports found.</td></tr>
              ) : patientRows.map(({ key, latest: item }) => (
                <tr key={key} onClick={() => setSelected(item)} className="lab-reports-row">
                  <td>{item.patientName} ({item.uhid || item.patientId || item.id})</td>
                  <td>{item.phone || '—'}</td>
                  <td>{formatDateTime(item.reportGeneratedAt || item.date)}</td>
                  <td>{item.reportStatus || 'Completed'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/dashboard/lab/results', { state: { cloneOrderId: item.id } });
                      }}
                      style={{
                        border: '1px solid #dbe4ee',
                        background: '#fff',
                        borderRadius: 10,
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: 'pointer',
                        color: '#1a3a6b',
                      }}
                    >
                      New Test
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      {selected && activeReport ? (
        <div className="lab-reports-modalOverlay" onMouseDown={() => setSelected(null)}>
          <div className="lab-reports-modal" onMouseDown={(e) => e.stopPropagation()}>

            {/* ══ NAITIK HOSPITAL HEADER ══ */}
            <div className="lab-reports-reportHeader">
              {/* Left: navy, logo + name + address */}
              <div className="lab-reports-reportHeader-left">
                <div className="lab-reports-reportHeader-logo">
                  <img src={REPORT_LOGO_DATA_URI} alt="Logo" />
                </div>
                <div className="lab-reports-reportHeader-hospitalInfo">
                  <div className="lab-reports-reportHeader-hospitalName">Naitik Hospital and Surgical Center</div>
                  <div className="lab-reports-reportHeader-hospitalSub">
                    Anand Vihar Colony, Hydel Road, BLW, Varanasi.<br />
                    Mob.: 7541031287
                  </div>
                </div>
              </div>
              {/* Right: yellow, reg no top-right, dr name, degree */}
              <div className="lab-reports-reportHeader-right">
                <div className="lab-reports-reportHeader-regNo">Reg. No. AL - 2676</div>
                <div className="lab-reports-reportHeader-drName">Dr. Ankit Kumar Singh</div>
                <div className="lab-reports-reportHeader-drDeg">M.B.B.S.</div>
              </div>
            </div>

            {/* ── Close Bar ── */}
            <div className="lab-reports-modalTopBar">
              <h3>{activeReport.patientName} &nbsp;·&nbsp; {activeReport.uhid || activeReport.id}</h3>
              <button type="button" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* ── Body ── */}
            <div className="lab-reports-modalBody">
              {detailLoading && !(activeReport?.results || []).length ? (
                <p className="lab-reports-label" style={{ marginBottom: 10 }}>Loading result values…</p>
              ) : null}

              {/* Patient meta table */}
              <table className="lab-reports-metaTable">
                <tbody>
                  <tr>
                    <td className="meta-label">Patient Name</td>
                    <td className="meta-value">:{activeReport.patientName || '—'}</td>
                    <td className="meta-label">Reported Date</td>
                    <td className="meta-value">: {formatDateOnly(activeReport.reportGeneratedAt || activeReport.date)}</td>
                  </tr>
                  <tr>
                    <td className="meta-label">UHID</td>
                    <td className="meta-value">:{activeReport.uhid || '—'}</td>
                    <td className="meta-label">Reported Time</td>
                    <td className="meta-value">: {formatTimeOnly(activeReport.reportGeneratedAt || activeReport.date)}</td>
                  </tr>
                  <tr>
                    <td className="meta-label">Age (Y-M-D)</td>
                    <td className="meta-value">:{activeReport.age || '—'} Yrs.</td>
                    <td className="meta-label">Given Date</td>
                    <td className="meta-value">: {formatDateOnly(activeReport.sampleCollectionTime || activeReport.date)}</td>
                  </tr>
                  <tr>
                    <td className="meta-label">Sex -</td>
                    <td className="meta-value">:{activeReport.gender || '—'}</td>
                    <td className="meta-label">Given Time</td>
                    <td className="meta-value">: {formatTimeOnly(activeReport.sampleCollectionTime || activeReport.date)}</td>
                  </tr>
                  <tr>
                    <td className="meta-label">Ref by Dr</td>
                    <td className="meta-value">:{activeReport.doctorName || 'NAITIK HOSPITAL'}</td>
                    <td className="meta-label">Report No.</td>
                    <td className="meta-value">: {activeReport.orderNumber || activeReport.id || '—'}</td>
                  </tr>
                  <tr>
                    <td className="meta-label">Sample Type</td>
                    <td className="meta-value">:{activeReport.sampleType || 'BLOOD'}</td>
                    <td className="meta-label">&nbsp;</td>
                    <td className="meta-value">&nbsp;</td>
                  </tr>
                </tbody>
              </table>

              {/* Report — all orders for this patient. New/Previous labels only when
                  the same UHID has more than one test; a single test shows directly. */}
              {printableReports.map((r, ri) => {
                  const pages = buildPrintPagesForReport(r);
                  const isNewest = ri === 0;
                  const hasHistory = printableReports.length > 1;
                  return (
                    <div key={r.id} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <div className="lab-reports-subSection">
                          {hasHistory ? (
                            <>
                              {isNewest ? <span style={{ color: '#059669', fontWeight: 900 }}>● NEW TEST</span> : <span style={{ color: '#64748b' }}>● PREVIOUS TEST</span>}
                              {' '}
                            </>
                          ) : null}
                          {getSelectionSummary(r)}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#475569', fontFamily: 'Arial, sans-serif' }}>
                          {r.orderNumber || r.id} · {formatDateTime(r.reportGeneratedAt || r.date)}
                        </div>
                      </div>

                      {pages.map((page, pi) => (
                        <div key={`${r.id}-p-${pi}`} style={{ marginTop: pi ? 14 : 8 }}>
                          <div className="lab-reports-sectionHeading">{page.sectionTitle}</div>
                          {page.blocks.map((block, bi) => (
                            <div key={`${r.id}-p-${pi}-b-${bi}`} style={{ marginTop: bi ? 8 : 0 }}>
                              {block.subHeading ? (
                                <div className="lab-reports-plainSubHeading">{block.subHeading}</div>
                              ) : null}
                              <div className="lab-reports-plainResults">
                                <div className="lab-reports-plainResultsHeader">
                                  <span className="prh-investigation">INVESTIGATION</span>
                                  <span className="prh-result">RESULT</span>
                                  <span className="prh-unit">UNIT</span>
                                  <span className="prh-range">NORMAL RANGE</span>
                                </div>
                                {(block.rows || []).map((row, idx) => (
                                  <div key={`${r.id}-${pi}-${bi}-${row.name}-${idx}`} className="lab-reports-plainRow">
                                    <span className="prr-investigation">{row.name || '—'}</span>
                                    <span className="prr-result">{row.value || '—'}</span>
                                    <span className="prr-unit">{row.unit || '—'}</span>
                                    <span className="prr-range">{row.range || '—'}</span>
                                  </div>
                                ))}
                              </div>
                              {/* Intro blurb below results — small justified text */}
                            </div>
                          ))}
                        </div>
                      ))}

                      {(r.overallRemarks || r.diagnosis) && (
                        <div className="lab-reports-remarks">
                          {r.overallRemarks && <><b>Remarks:</b> {r.overallRemarks}<br /></>}
                          {r.diagnosis && <><b>Diagnosis:</b> {r.diagnosis}</>}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* ── Actions ── */}
            <div className="lab-reports-actions">
              <button type="button" onClick={() => handleDownload(activeReport)}>⬇ Download</button>
              <button type="button" onClick={() => handleShare(activeReport)}>↗ Share</button>
              <button type="button" onClick={() => handlePrint(printableReports[0] || activeReport)}>🖨 Print Selected</button>
              {printableReports.length > 1 ? (
                <button type="button" onClick={() => handlePrintMany(printableReports)}>🖨 Print All</button>
              ) : null}
              <button type="button" onClick={() => navigate('/dashboard/lab/results', { state: { editOrderId: activeReport.id } })}>
                Edit
              </button>
              <button type="button" onClick={() => navigate('/dashboard/lab/results', { state: { cloneOrderId: activeReport.id } })}>
                New Test
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
