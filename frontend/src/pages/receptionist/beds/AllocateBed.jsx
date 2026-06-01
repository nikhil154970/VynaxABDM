import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import "./AllocatedBed.css";
import api from "../../../utils/api";

/* ══════════════════════════════════════════════════════════════════════════════
   Floor-wise rooms layout (based on provided hospital sheet)
══════════════════════════════════════════════════════════════════════════════ */

const FLOORS = [
  {
    key: "ground",
    title: "GROUND FLOOR",
    rooms: [
      { id: "1", groupClass: "hbt-room-icu", beds: ["ICU1", "ICU2", "ICU3", "ICU4", "ICU5", "ICU6"] },
      { id: "2", groupClass: "hbt-room-gw", beds: ["G/W 4", "G/W 5", ] },
      { id: "3", groupClass: "hbt-room-gw", beds: ["G/W 6","G/W 7" ] },
      { id: "4", groupClass: "hbt-room-gw", beds: [ "G/W 3", "G/W 2", "G/W 1"] },
    ],
  },
  {
    key: "first",
    title: "FIRST FLOOR",
    rooms: [
      { id: "1", groupClass: "hbt-room-nicu", beds: ["NICU 1", "NICU 2", "HDU"] },
      { id: "2", groupClass: "hbt-room-pvt", beds: ["PVT 1", "PVT 2"] },
      { id: "3", groupClass: "hbt-room-pvt", beds: ["PVT 3", "PVT 4"] },
    ],
  },
  {
    key: "second",
    title: "SECOND FLOOR",
    rooms: [
      { id: "1", groupClass: "hbt-room-icu", beds: ["ICU 7", "ICU 8", "ICU 9", "ICU 10","ICU 11", "ICU 12"] },
      { id: "2", groupClass: "hbt-room-icu", beds: [ "ICU 13", "ICU 14", "ICU 15", "ICU 16"] },
      { id: "3", groupClass: "hbt-room-pvt", beds: ["PVT 5", "PVT 6"] },
      { id: "4", groupClass: "hbt-room-pvt", beds: ["PVT 7", "PVT 8"] },
      { id: "5", groupClass: "hbt-room-pvt", beds: ["PVT 9", "PVT 10"] },
    ],
  },
];

function wardLabelFromWardType(wardType) {
  const t = String(wardType || "").toUpperCase();
  if (t === "ICU") return "ICU";
  if (t === "PRIVATE") return "Private";
  return "General";
}

function toUiBedStatus(dbStatus) {
  const s = String(dbStatus || "").toUpperCase();
  if (s === "OCCUPIED") return "occupied";
  if (s === "MAINTENANCE") return "cleaning";
  return "empty";
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function matchesFilter(status, filter) {
  if (filter === "ALL") return true;
  if (filter === "OCCUPIED") return status === "occupied";
  if (filter === "EMPTY") return status === "empty";
  if (filter === "CLEANING") return status === "cleaning";
  return true;
}

function RoomBlock({ floorKey, room, onSelectBed, getBedStatus, filter }) {
  const rowsRaw = chunk(room.beds, 3); // close to the sheet look
  // If last row has a single bed, align it to the right (so e.g. G/W 1 sits under G/W 2)
  const rows = rowsRaw.map((r, idx) => {
    const isLast = idx === rowsRaw.length - 1;
    if (isLast && r.length === 1) return [null, null, r[0]];
    return r;
  });
  return (
    <div className="hbt-room">
      <div className="hbt-room-id">{room.id}</div>
      <div className="hbt-room-grid">
        {rows.map((r, idx) => (
          <div className="hbt-room-row" key={idx}>
            {r.map((b, i) => {
              if (!b) return <div className="hbt-room-bed hbt-room-bed-empty" key={`e-${idx}-${i}`} />;
              const st = getBedStatus ? getBedStatus(b) : "empty";
              const show = matchesFilter(st, filter);
              if (!show) {
                return <div className="hbt-room-bed hbt-room-bed-empty" key={`f-${b}`} />;
              }
              const stCls =
                st === "occupied"
                  ? "hbt-room-bed--occupied"
                  : st === "cleaning"
                    ? "hbt-room-bed--cleaning"
                    : "hbt-room-bed--empty";
              return (
                <div
                  className={`hbt-room-bed ${stCls} ${b === "HDU" ? "hbt-room-bed-hdu" : ""}`}
                  key={b}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectBed({ floorKey, roomId: room.id, bedLabel: b })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelectBed({ floorKey, roomId: room.id, bedLabel: b });
                  }}
                >
                  {b}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ selected, onClose, roomDetails }) {
  if (!selected) return null;
  return (
    <>
      <div className="hbt-panel-overlay" onClick={onClose} />
      <aside className="hbt-detail-panel">
        <button className="hbt-panel-close-btn" onClick={onClose}>
          <X size={16} />
        </button>

        <div className="hbt-panel-bed-id">{selected.bedLabel}</div>
        <div className="hbt-panel-ward-tag">
          {selected.floorKey.toUpperCase()} FLOOR · ROOM {selected.roomId}
        </div>

        <div className="hbt-panel-divider" />

        <div className="hbt-panel-info-row">
          <span className="hbt-info-key">Patients</span>
          <span className="hbt-info-val">
            {roomDetails?.patients?.length ? roomDetails.patients.join(", ") : "—"}
          </span>
        </div>
        <div className="hbt-panel-info-row">
          <span className="hbt-info-key">Doctor</span>
          <span className="hbt-info-val">{roomDetails?.doctor ?? "—"}</span>
        </div>
        <div className="hbt-panel-info-row">
          <span className="hbt-info-key">Nurse</span>
          <span className="hbt-info-val">{roomDetails?.nurse ?? "—"}</span>
        </div>
      </aside>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function HospitalBedTracker() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("ALL"); // ALL | OCCUPIED | EMPTY | CLEANING
  const [bedsIndex, setBedsIndex] = useState(() => new Map()); // code -> {id,status,wardType}
  const [admissionIndex, setAdmissionIndex] = useState(() => new Map()); // bedCode -> {patients[], doctors[], nurses[]}

  const refresh = async () => {
    const [bedsRes, activeRes] = await Promise.all([
      api.get("/receptionist/ipd/beds"),
      api.get("/receptionist/ipd/active", { params: { q: "" } }),
    ]);
    const bedItems = Array.isArray(bedsRes?.data?.items) ? bedsRes.data.items : [];
    const activePatients = Array.isArray(activeRes?.data?.patients) ? activeRes.data.patients : [];

    const bmap = new Map();
    for (const b of bedItems) {
      const code = String(b.code || "").trim();
      if (!code) continue;
      bmap.set(code, { id: b.id, status: b.status, wardType: b.wardType, wardName: b.wardName });
    }

    const amap = new Map();
    for (const p of activePatients) {
      const code = String(p?.bed || "").trim();
      if (!code) continue;
      if (!amap.has(code)) amap.set(code, { patients: [], doctors: [], nurses: [], admissions: [] });
      const row = amap.get(code);
      row.patients.push(p.name);
      if (p.doctor) row.doctors.push(p.doctor);
      if (p.nurse) row.nurses.push(p.nurse);
      row.admissions.push(p);
    }

    // normalize unique names
    for (const [code, row] of amap.entries()) {
      row.patients = Array.from(new Set(row.patients)).filter(Boolean);
      row.doctors = Array.from(new Set(row.doctors)).filter(Boolean);
      row.nurses = Array.from(new Set(row.nurses)).filter(Boolean);
      amap.set(code, row);
    }

    setBedsIndex(bmap);
    setAdmissionIndex(amap);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roomDetails = useMemo(() => {
    if (!selected) return null;
    const bedCode = String(selected.bedLabel || "").trim();
    const bedMeta = bedsIndex.get(bedCode);
    const occ = admissionIndex.get(bedCode);
    return {
      status: toUiBedStatus(bedMeta?.status),
      ward: wardLabelFromWardType(bedMeta?.wardType),
      patients: occ?.patients || [],
      doctor: occ?.doctors?.length ? occ.doctors.join(", ") : "—",
      nurse: occ?.nurses?.length ? occ.nurses.join(", ") : "—",
    };
  }, [selected, bedsIndex, admissionIndex]);

  const getBedStatus = useMemo(() => {
    return (bedCodeRaw) => {
      const bedCode = String(bedCodeRaw || "").trim();
      return toUiBedStatus(bedsIndex.get(bedCode)?.status);
    };
  }, [bedsIndex]);

  return (
    /* hbt-root starts right below the parent sidebar's content area */
    <div className="hbt-root">
      <div className="hbt-roommap-filters">
        {[
          ["ALL", "All"],
          ["OCCUPIED", "Patient present"],
          ["EMPTY", "Bed available"],
          ["CLEANING", "Cleaning"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`hbt-filter-btn ${filter === key ? "hbt-filter-active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="hbt-roommap">
        {FLOORS.map((f) => (
          <section className="hbt-floor" key={f.key}>
            <div className="hbt-floor-title">{f.title}</div>
            <div className="hbt-floor-grid">
              <div className="hbt-floor-room-label">ROOM</div>
              <div className="hbt-floor-rooms">
                {f.rooms.map((r) => {
                  const roomBedCodes = r.beds;
                  const statuses = roomBedCodes.map((c) => getBedStatus(c));
                  const anyOcc = statuses.includes("occupied");
                  const anyEmpty = statuses.includes("empty");
                  const anyClean = statuses.includes("cleaning");
                  if (filter === "OCCUPIED" && !anyOcc) return null;
                  if (filter === "EMPTY" && !anyEmpty) return null;
                  if (filter === "CLEANING" && !anyClean) return null;
                  return (
                    <RoomBlock
                      key={`${f.key}-${r.id}`}
                      floorKey={f.key}
                      room={r}
                      onSelectBed={setSelected}
                      getBedStatus={getBedStatus}
                      filter={filter}
                    />
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </main>

      <footer className="hbt-bottom-bar">
        <div className="hbt-legend">
          {[
            ["Bed available", "hbt-legend-empty"],
            ["Patient present", "hbt-legend-occupied"],
            ["Cleaning", "hbt-legend-cleaning"],
          ].map(([lbl, cls]) => (
            <div className="hbt-legend-item" key={lbl}>
              <div className={`hbt-legend-box ${cls}`} />
              {lbl}
            </div>
          ))}
        </div>
      </footer>

      <DetailPanel selected={selected} onClose={() => setSelected(null)} roomDetails={roomDetails} />
    </div>
  );
}