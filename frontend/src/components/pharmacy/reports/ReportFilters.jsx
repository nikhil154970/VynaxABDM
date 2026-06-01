import { ChevronDown, Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const PRESETS = [
  { value: '', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export default function ReportFilters({
  datePreset,
  dateFrom,
  dateTo,
  onPresetChange,
  onDateFromChange,
  onDateToChange,
  onRefresh,
  onExportCsv,
  onExportExcel,
  onExportPdf,
}) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={datePreset}
          onChange={(e) => onPresetChange(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
        >
          {PRESETS.map((p) => (
            <option key={p.value || 'all'} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {datePreset === 'custom' ? (
          <>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="rounded-xl border border-slate-200 px-2 py-2 text-xs"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="rounded-xl border border-slate-200 px-2 py-2 text-xs"
            />
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Export <ChevronDown className="h-3 w-3" />
          </button>
          {exportOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-32 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <button type="button" onClick={() => { onExportCsv?.(); setExportOpen(false); }} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">CSV</button>
              <button type="button" onClick={() => { onExportExcel?.(); setExportOpen(false); }} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">Excel</button>
              <button type="button" onClick={() => { onExportPdf?.(); setExportOpen(false); }} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">PDF / Print</button>
            </div>
          ) : null}
        </div>
        <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>
    </div>
  );
}
