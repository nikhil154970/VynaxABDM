import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MdBed, MdClose, MdFilterList, MdPerson, MdRefresh, MdSearch, MdWarning } from 'react-icons/md';
import '../patients/PatientList.css';
import './BedStatus.css';
import api from '../../../utils/api';

const WARDS = ['ICU', 'General', 'Private'];
const WARD_TYPES = ['All', ...WARDS];
const STATUS_FILTERS = ['All', 'available', 'occupied', 'reserved'];

const STATUS_META = {
  available: { label: 'Available', dot: '#22c55e', badgeBg: '#dcfce7', badgeText: '#14532d', cardBg: '#ffffff' },
  occupied: { label: 'Occupied', dot: '#ef4444', badgeBg: '#fee2e2', badgeText: '#991b1b', cardBg: '#ffffff' },
  reserved: { label: 'Reserved', dot: '#eab308', badgeBg: '#fef9c3', badgeText: '#854d0e', cardBg: '#ffffff' },
  cleaning: { label: 'Cleaning', dot: '#eab308', badgeBg: '#fef9c3', badgeText: '#854d0e', cardBg: '#ffffff' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysBetween(fromISO, toDate = new Date()) {
  if (!fromISO) return 0;
  const d1 = new Date(fromISO);
  if (Number.isNaN(d1.getTime())) return 0;
  const ms = toDate.getTime() - d1.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export default function BedStatus() {
  const navigate = useNavigate();

  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [wardType, setWardType] = useState('All');
  const [status, setStatus] = useState('All');

  const [selectedBed, setSelectedBed] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [stats, setStats] = useState({
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    reservedOrCleaningBeds: 0,
    icuAvailableBeds: 0,
    occPctByWard: { ICU: 0, General: 0, Private: 0 },
  });

  const handleSearch = (value) => setSearch(value);
  const handleFilter = (key, value) => {
    if (key === 'wardType') setWardType(value);
    if (key === 'status') setStatus(value);
  };

  const handleSelectBed = (bed) => {
    setSelectedBed(bed);
    setIsModalOpen(true);
  };

  const calculateOccupancy = (list) => {
    const wardTotals = new Map(WARDS.map((w) => [w, { total: 0, occupied: 0 }]));

    for (const b of list) {
      if (!wardTotals.has(b.ward)) continue;
      const meta = wardTotals.get(b.ward);
      meta.total += 1;
      if (b.status === 'occupied') meta.occupied += 1;
    }

    const pct = {};
    for (const [w, m] of wardTotals.entries()) {
      pct[w] = m.total ? Math.round((m.occupied / m.total) * 100) : 0;
    }
    return pct;
  };

  const fetchBeds = async () => {
    setLoading(true);
    try {
      const [bedsRes, activeRes] = await Promise.all([
        api.get('/receptionist/ipd/beds'),
        api.get('/receptionist/ipd/active', { params: { q: '' } }),
      ]);

      const bedItems = Array.isArray(bedsRes?.data?.items) ? bedsRes.data.items : [];
      const activePatients = Array.isArray(activeRes?.data?.patients) ? activeRes.data.patients : [];

      const byBedCode = new Map();
      for (const p of activePatients) {
        const code = String(p?.bed || '').trim();
        if (!code) continue;
        byBedCode.set(code, {
          admissionId: p.id,
          name: p.name,
          uhid: p.uhid,
          doctor: p.doctor,
          admissionDate: p.admissionDate,
        });
      }

      const mapped = bedItems.map((b) => {
        const wardType = String(b.wardType || '').toUpperCase();
        const wardLabel = wardType === 'ICU' ? 'ICU' : wardType === 'PRIVATE' ? 'Private' : 'General';
        const st = String(b.status || '').toUpperCase();
        const status = st === 'OCCUPIED' ? 'occupied' : st === 'MAINTENANCE' ? 'cleaning' : 'available';
        const patient = byBedCode.get(String(b.code || '').trim()) || null;
        return {
          id: b.id,
          number: b.code,
          ward: wardLabel,
          status,
          patient,
          wardId: b.wardId,
          wardName: b.wardName,
        };
      });

      setBeds(mapped);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter((b) => b.status === 'occupied').length;
    const availableBeds = beds.filter((b) => b.status === 'available').length;
    const reservedOrCleaningBeds = beds.filter((b) => b.status === 'reserved' || b.status === 'cleaning').length;
    const icuAvailableBeds = beds.filter((b) => b.ward === 'ICU' && b.status === 'available').length;
    const occPctByWard = calculateOccupancy(beds);

    setStats({ totalBeds, occupiedBeds, availableBeds, reservedOrCleaningBeds, icuAvailableBeds, occPctByWard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beds]);

  const filteredBeds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beds.filter((b) => {
      const matchSearch =
        !q ||
        String(b.number || '').toLowerCase().includes(q) ||
        String(b.patient?.name || '').toLowerCase().includes(q);

      const matchWard = wardType === 'All' || b.ward === wardType;
      const matchStatus =
        status === 'All'
          ? true
          : status === 'reserved'
            ? b.status === 'reserved' || b.status === 'cleaning'
            : b.status === status;

      return matchSearch && matchWard && matchStatus;
    });
  }, [beds, search, wardType, status]);

  const grouped = useMemo(() => {
    const map = new Map(WARDS.map((w) => [w, []]));
    for (const b of filteredBeds) {
      if (!map.has(b.ward)) map.set(b.ward, []);
      map.get(b.ward).push(b);
    }
    for (const [w, list] of map.entries()) {
      list.sort((a, b) => String(a.number || '').localeCompare(String(b.number || '')));
      map.set(w, list);
    }
    return map;
  }, [filteredBeds]);

  const icuIsFull = beds.some((b) => b.ward === 'ICU') && beds.every((b) => (b.ward !== 'ICU' ? true : b.status !== 'available'));
  const wardsLowAvailability = useMemo(() => {
    return WARDS.filter((w) => {
      const inWard = beds.filter((b) => b.ward === w);
      if (!inWard.length) return false;
      const avail = inWard.filter((b) => b.status === 'available').length;
      return avail <= 1;
    });
  }, [beds]);

  const cleaningCount = beds.filter((b) => b.status === 'cleaning').length;

  return (
    <div className="bs-page">
      <div className="bs-wrap">
        <div className="bs-section">
          {/* KPI summary */}
          <div className="bs-grid">
            {[
              { label: 'Total Beds', value: stats.totalBeds, icon: MdBed },
              { label: 'Occupied Beds', value: stats.occupiedBeds, icon: MdPerson },
              { label: 'Available Beds', value: stats.availableBeds, icon: MdBed },
              { label: 'Reserved / Cleaning', value: stats.reservedOrCleaningBeds, icon: MdFilterList },
              { label: 'ICU Beds Available', value: stats.icuAvailableBeds, icon: MdBed },
            ].map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="bs-kpi">
                  <div className="bs-kpiTop">
                    <div className="bs-kpiIcon">
                      <Icon />
                    </div>
                    <div>
                      <div className="bs-kpiValue">{k.value}</div>
                      <div className="bs-kpiLabel">{k.label}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Highlights */}
          {!!(icuIsFull || wardsLowAvailability.length || cleaningCount) && (
            <div className="bs-highlights">
              {icuIsFull ? (
                <div className="bs-pill bs-pillDanger">
                  <MdWarning /> ICU is full (no available beds)
                </div>
              ) : null}
              {wardsLowAvailability.map((w) => (
                <div key={w} className="bs-pill bs-pillWarn">
                  <MdWarning /> Low availability in {w}
                </div>
              ))}
              {cleaningCount ? (
                <div className="bs-pill">
                  <MdFilterList /> {cleaningCount} bed(s) under cleaning
                </div>
              ) : null}
            </div>
          )}

          {/* Search + Filters */}
          <div className="bs-filterBar">
            <div className="bs-search">
              <span className="bs-searchIcon">
                <MdSearch />
              </span>
              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by Bed Number / Patient Name..."
              />
            </div>
            <div className="bs-filterRight">
              <div className="bs-filters">
                <select value={wardType} onChange={(e) => handleFilter('wardType', e.target.value)} className="pl-select">
                  {WARD_TYPES.map((w) => (
                    <option key={w} value={w}>
                      {w === 'All' ? 'All wards' : w}
                    </option>
                  ))}
                </select>
                <select value={status} onChange={(e) => handleFilter('status', e.target.value)} className="pl-select">
                  {STATUS_FILTERS.map((s) => (
                    <option key={s} value={s}>
                      {s === 'All' ? 'All status' : s === 'reserved' ? 'Reserved / Cleaning' : s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bs-actionsRow">
                <button type="button" className="bs-btn" onClick={fetchBeds} disabled={loading} title="Refresh">
                  <MdRefresh /> Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Records table */}
        <div className="bs-section" style={{ marginTop: 14 }}>
          <div className="bs-sectionHeader">
            <div>
              <div className="bs-title">Bed Records</div>
              <div className="bs-subtitle">Click “View” to open details.</div>
            </div>
            <div className="bs-actionsRow bs-muted">
              <span className="bs-badge bs-badgeAvailable">
                <span className="bs-dot" /> Available
              </span>
              <span className="bs-badge bs-badgeOccupied">
                <span className="bs-dot" /> Occupied
              </span>
              <span className="bs-badge bs-badgeReserved">
                <span className="bs-dot" /> Reserved / Cleaning
              </span>
            </div>
          </div>

          {loading ? (
            <div className="bs-empty">Loading beds…</div>
          ) : filteredBeds.length === 0 ? (
            <div className="bs-empty">No beds found for selected filters</div>
          ) : (
            <div className="bs-tableWrap">
              <table className="bs-table">
                <thead>
                  <tr>
                    <th>Bed</th>
                    <th>Ward</th>
                    <th>Status</th>
                    <th>Patient</th>
                    <th>UHID</th>
                    <th>Doctor</th>
                    <th>Admission</th>
                    <th>Days</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBeds
                    .slice()
                    .sort((a, b) => String(a.ward).localeCompare(String(b.ward)) || String(a.number).localeCompare(String(b.number)))
                    .map((b) => {
                      const effectiveStatus = b.status === 'cleaning' ? 'reserved' : b.status;
                      const dotClass =
                        effectiveStatus === 'available'
                          ? 'bs-statusDot bs-statusDot--available'
                          : effectiveStatus === 'occupied'
                            ? 'bs-statusDot bs-statusDot--occupied'
                            : 'bs-statusDot bs-statusDot--reserved';
                      const statusTitle =
                        effectiveStatus === 'available'
                          ? 'Available'
                          : effectiveStatus === 'occupied'
                            ? 'Occupied'
                            : b.status === 'cleaning'
                              ? 'Cleaning'
                              : 'Reserved';

                      return (
                        <tr key={b.id} className="bs-row">
                          <td className="bs-mono">{b.number}</td>
                          <td>{b.ward}</td>
                          <td>
                            <span className="bs-status" title={statusTitle} aria-label={statusTitle}>
                              <span className={dotClass} aria-hidden="true" />
                              <span className="bs-statusText">{statusTitle}</span>
                            </span>
                          </td>
                          <td>{b.patient?.name || '—'}</td>
                          <td className="bs-mono">{b.patient?.uhid || '—'}</td>
                          <td>{b.patient?.doctor || '—'}</td>
                          <td>{b.patient?.admissionDate ? formatDate(b.patient.admissionDate) : '—'}</td>
                          <td>{b.status === 'occupied' ? `${daysBetween(b.patient?.admissionDate)} day(s)` : '—'}</td>
                          <td>
                            <div className="bs-rowActions">
                              <button type="button" className="bs-btn" onClick={() => handleSelectBed(b)}>
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {isModalOpen && selectedBed
        ? createPortal(
          <div
            className="pl-modalOverlay"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            <div className="pl-modal pl-modalAnimate">
              <div className="pl-modalHeader">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    Bed {selectedBed.number} · {selectedBed.ward}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    Status:{' '}
                    <span className="font-extrabold" style={{ color: (STATUS_META[selectedBed.status] || STATUS_META.available).badgeText }}>
                      {(STATUS_META[selectedBed.status] || STATUS_META.available).label}
                    </span>
                  </p>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="pl-modalClose" title="Close">
                  <MdClose className="w-5 h-5" />
                </button>
              </div>

              <div className="pl-modalBody">
                <div className="pl-modalGrid">
                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Bed Details</p>
                    <div className="pl-kv">
                      <div>
                        <p className="k">Ward</p>
                        <p className="v">{selectedBed.ward}</p>
                      </div>
                      <div>
                        <p className="k">Bed Number</p>
                        <p className="v font-mono">{selectedBed.number}</p>
                      </div>
                      <div>
                        <p className="k">Status</p>
                        <p className="v">{(STATUS_META[selectedBed.status] || STATUS_META.available).label}</p>
                      </div>
                      <div>
                        <p className="k">Patient</p>
                        <p className="v">{selectedBed.patient?.name || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Occupancy</p>
                    {selectedBed.status === 'occupied' ? (
                      <div className="pl-kv">
                        <div>
                          <p className="k">Patient Name</p>
                          <p className="v">{selectedBed.patient?.name || '—'}</p>
                        </div>
                        <div>
                          <p className="k">UHID</p>
                          <p className="v font-mono">{selectedBed.patient?.uhid || '—'}</p>
                        </div>
                        <div>
                          <p className="k">Doctor</p>
                          <p className="v">{selectedBed.patient?.doctor || '—'}</p>
                        </div>
                        <div>
                          <p className="k">Admission Date</p>
                          <p className="v">{formatDate(selectedBed.patient?.admissionDate)}</p>
                        </div>
                        <div className="colspan2">
                          <p className="k">Days Stayed</p>
                          <p className="v">{daysBetween(selectedBed.patient?.admissionDate)} day(s)</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-sm font-extrabold text-gray-900">Available for allocation</p>
                        <p className="text-xs text-gray-500 mt-1">You can allocate this bed to a patient.</p>
                      </div>
                    )}
                  </div>

                  <div className="pl-modalCard">
                    <p className="pl-modalCardTitle">Quick Actions (UI only)</p>
                    <div className="pl-modalActions">
                      <button
                        type="button"
                        className="pl-actionBtn"
                        disabled={selectedBed.status !== 'occupied' || !selectedBed.patient?.admissionId}
                        onClick={() => navigate('/dashboard/reception/ipd')}
                      >
                        <MdPerson className="w-4 h-4" /> Manage in IPD
                      </button>
                      <button
                        type="button"
                        className="pl-actionBtn"
                        disabled={selectedBed.status === 'occupied'}
                        onClick={async () => {
                          const next = selectedBed.status === 'cleaning' ? 'AVAILABLE' : 'MAINTENANCE';
                          await api.patch(`/receptionist/ipd/beds/${encodeURIComponent(selectedBed.id)}/status`, { status: next });
                          setIsModalOpen(false);
                          await fetchBeds();
                        }}
                      >
                        <MdClose className="w-4 h-4" /> {selectedBed.status === 'cleaning' ? 'Mark Available' : 'Mark Cleaning'}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-3">
                      Transfers/discharge are managed from IPD module. Bed cleaning status is synced with backend.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}