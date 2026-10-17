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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
        <div>
          <p className="text-base font-bold text-[#001B48]">Weekly Schedule</p>
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
                className={`rounded-2xl border p-4 transition-all duration-200 ${
                  s.isAvailable
                    ? 'border-blue-100 bg-gradient-to-r from-blue-50/50 to-white hover:from-blue-50 hover:to-white/80 shadow-sm'
                    : 'border-gray-100 bg-gradient-to-r from-slate-50/60 to-white hover:from-slate-50 hover:to-white/80'
                }`}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-[160px]">
                    <p className="text-sm font-bold text-gray-900">{d.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Set availability & timings</p>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">Start</span>
                      <input
                        type="time"
                        value={toTime(s.startTime)}
                        onChange={(e) => update(d.key, { startTime: e.target.value })}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none bg-white text-sm font-semibold text-gray-700 transition duration-200 hover:border-gray-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!s.isAvailable}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">End</span>
                      <input
                        type="time"
                        value={toTime(s.endTime)}
                        onChange={(e) => update(d.key, { endTime: e.target.value })}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#0077B6]/25 focus:border-[#0077B6] outline-none bg-white text-sm font-semibold text-gray-700 transition duration-200 hover:border-gray-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!s.isAvailable}
                      />
                    </div>

                    <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-gray-300 transition duration-200">
                      <span className="text-xs font-semibold text-gray-700">Available</span>
                      <input
                        type="checkbox"
                        checked={Boolean(s.isAvailable)}
                        onChange={(e) => update(d.key, { isAvailable: e.target.checked })}
                        className="h-4.5 w-4.5 accent-[#0077B6] cursor-pointer"
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

