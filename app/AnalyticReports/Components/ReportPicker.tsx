'use client';

import { monthLabel, type ReportMeta } from '../Utils/ReportTypes';
import Dropdown from './Dropdown';

export default function ReportPicker({ reports, reportId, onSelect, closed, onToggleClosed }: { reports: ReportMeta[]; reportId: string; onSelect: (id: string) => void; closed?: string[]; onToggleClosed?: (m: string) => void }) {
  const report = reports.find((r) => r.id === reportId);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row lg:items-center gap-3">
      <Dropdown
        className="lg:w-[300px]"
        value={reportId}
        placeholder="No reports yet"
        onChange={onSelect}
        options={reports.map((r) => ({ value: r.id, label: r.name, hint: `${r.months.map(monthLabel).join(', ')} · ${r.lineCount} lines` }))}
      />
      {report && closed && onToggleClosed && (
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
          <span className="uppercase tracking-wider">Closed months</span>
          {report.months.map((m) => (
            <label key={m} className={`h-9 px-3 rounded-lg border flex items-center gap-2 cursor-pointer ${closed.includes(m) ? 'bg-amber-50 border-amber-300 text-slate-900' : 'bg-white border-slate-200'}`}>
              <input type="checkbox" className="accent-amber-500" checked={closed.includes(m)} onChange={() => onToggleClosed(m)} /> {monthLabel(m)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
