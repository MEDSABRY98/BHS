'use client';

// Scheduled Reports → Send Log: every send (automatic or manual).

import { useMemo, useState } from 'react';
import { CheckCircle2, History, MinusCircle, Search, XCircle } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { reportTypeLabel, type ReportLogRow } from '../Utils/Types';

const STATUS = {
  sent: { label: 'Sent', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  failed: { label: 'Failed', icon: XCircle, cls: 'bg-red-50 text-red-600 ring-red-200' },
  skipped: { label: 'Skipped', icon: MinusCircle, cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
} as const;

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtPeriod = (r: ReportLogRow) => (!r.periodStart ? '-' : r.periodStart === r.periodEnd ? r.periodStart : `${r.periodStart} → ${r.periodEnd}`);

export default function LogTab({ rows }: { rows: ReportLogRow[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ReportLogRow['status']>('all');

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!q || r.reportName.toLowerCase().includes(q) || (r.message || '').toLowerCase().includes(q) || r.emails.some((e) => e.includes(q))),
    );
  }, [rows, search, status]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center shadow-lg shadow-[#D4AF37]/30 shrink-0">
              <History className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-3xl font-normal text-black tracking-tighter">Send Log</h1>
              <p className="text-sm font-semibold text-slate-400">Last {rows.length} sends · Dubai time</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100">
              {(['all', 'sent', 'failed', 'skipped'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`h-9 px-3 rounded-lg text-xs font-black capitalize transition-all ${status === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="relative md:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="bg-[#0a0f1d] text-[11px] font-black uppercase tracking-[0.12em] text-[#D4AF37]">
                <th className="py-4 px-4 text-center">When</th>
                <th className="py-4 px-4 text-center">Report</th>
                <th className="py-4 px-4 text-center">Period</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-4 text-center">Sent to</th>
                <th className="py-4 px-4 text-center">Details</th>
                <th className="py-4 px-4 text-center">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 ? (
                <NoData isTable colSpan={7} title="NO SENDS YET" />
              ) : (
                list.map((r) => {
                  const st = STATUS[r.status] || STATUS.skipped;
                  const Icon = st.icon;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-semibold text-slate-600 whitespace-nowrap">{fmtWhen(r.createdAt)}</td>
                      <td className="py-3 px-4 text-center">
                        <p className="font-bold text-slate-900" dir="auto">
                          {r.reportName}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400">{reportTypeLabel(r.reportType)}</p>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-600 whitespace-nowrap">{fmtPeriod(r)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-black ring-1 ${st.cls}`}>
                          <Icon className="w-3.5 h-3.5" /> {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-semibold text-slate-600 max-w-[220px] truncate" title={r.emails.join(', ')}>
                        {r.emails.length ? `${r.emails[0]}${r.emails.length > 1 ? ` +${r.emails.length - 1}` : ''}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-semibold text-slate-500 max-w-[280px]">
                        <span className="line-clamp-2 break-words" title={r.message || ''}>
                          {r.message || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-bold text-slate-500 whitespace-nowrap">{r.trigger === 'manual' ? r.sentBy || 'Manual' : 'Automatic'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
