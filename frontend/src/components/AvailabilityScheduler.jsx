import { useMemo } from 'react';
import Badge from './Badge';

const DAYS = [
  { key: 'MONDAY', label: 'Monday' },
  { key: 'TUESDAY', label: 'Tuesday' },
  { key: 'WEDNESDAY', label: 'Wednesday' },
  { key: 'THURSDAY', label: 'Thursday' },
  { key: 'FRIDAY', label: 'Friday' },
  { key: 'SATURDAY', label: 'Saturday' },
  { key: 'SUNDAY', label: 'Sunday' },
];

function toTime(v) {
  if (!v) return '10:00';
  return String(v).slice(0, 5);
}

export default function AvailabilityScheduler({
  doctorLabel = 'Select a doctor',
  slots = [],
  onChange,
  loading = false,
}) {
  const map = useMemo(() => {
    const m = new Map();
    for (const s of slots || []) m.set(s.dayOfWeek, s);
    return m;
  }, [slots]);

  const update = (dayOfWeek, patch) => {
    const current = map.get(dayOfWeek) || { dayOfWeek, startTime: '10:00', endTime: '14:00', isAvailable: false };
    const next = { ...current, ...patch, dayOfWeek };
    const nextSlots = DAYS.map((d) => (d.key === dayOfWeek ? next : (map.get(d.key) || { dayOfWeek: d.key, startTime: '10:00', endTime: '14:00', isAvailable: false })));
    onChange?.(nextSlots);
  };

  return (
    <div className="bg-white rounded-3xl ring-1 ring-black/5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)] overflow-hidden">
      <div className="px-6 sm:px-8 py-6 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[#2D2A6E]">Weekly Schedule</p>
          <p className="text-xs text-gray-500 mt-0.5">{doctorLabel}</p>
        </div>
        <Badge variant={loading ? 'amber' : 'blue'}>{loading ? 'Loading…' : 'Ready'}</Badge>
      </div>

      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-3">
          {DAYS.map((d) => {
            const s = map.get(d.key) || { dayOfWeek: d.key, startTime: '10:00', endTime: '14:00', isAvailable: false };
            return (
              <div
                key={d.key}
                className="rounded-2xl ring-1 ring-gray-200 p-4 bg-[#F5F7FA]/55 hover:bg-[#F5F7FA] transition"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-[160px]">
                    <p className="text-sm font-extrabold text-gray-900">{d.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Set availability + timings</p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-extrabold text-gray-600">Start</label>
                      <input
                        type="time"
                        value={toTime(s.startTime)}
                        onChange={(e) => update(d.key, { startTime: e.target.value })}
                        className="px-3 py-2 rounded-xl ring-1 ring-gray-200 focus:ring-2 focus:ring-[#00AEEF] outline-none bg-white text-sm font-bold text-gray-800"
                        disabled={!s.isAvailable}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-extrabold text-gray-600">End</label>
                      <input
                        type="time"
                        value={toTime(s.endTime)}
                        onChange={(e) => update(d.key, { endTime: e.target.value })}
                        className="px-3 py-2 rounded-xl ring-1 ring-gray-200 focus:ring-2 focus:ring-[#00AEEF] outline-none bg-white text-sm font-bold text-gray-800"
                        disabled={!s.isAvailable}
                      />
                    </div>

                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl ring-1 ring-gray-200 bg-white">
                      <span className="text-xs font-extrabold text-gray-700">Available</span>
                      <input
                        type="checkbox"
                        checked={Boolean(s.isAvailable)}
                        onChange={(e) => update(d.key, { isAvailable: e.target.checked })}
                        className="h-5 w-5 accent-[#00AEEF]"
                      />
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

