'use client';

// Every email sent (or failed): each user sees his own, the admin sees all.

import { useMemo, useState } from 'react';
import { CheckCircle2, Eye, Search, X, XCircle } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import Modal from './Modal';
import { describeAttachment, type MailLogRow } from '../Utils/MailTypes';

interface SentTabProps {
  rows: MailLogRow[];
  admin: boolean;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};

export default function SentTab({ rows, admin }: SentTabProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'sent' | 'failed'>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [view, setView] = useState<MailLogRow | null>(null);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const d = r.SENT_AT.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (status && r.STATUS !== status) return false;
      if (!q) return true;
      return (
        r.SUBJECT.toLowerCase().includes(q) ||
        (r.PARTY || '').toLowerCase().includes(q) ||
        [...r.TO_EMAILS, ...r.CC_EMAILS].some((e) => e.toLowerCase().includes(q)) ||
        (r.SENT_BY_NAME || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, status, dateFrom, dateTo]);

  const cols = 7 + (admin ? 1 : 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email, customer, subject…" dir="auto" className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm font-semibold">
          <option value="">All</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="From date" />
          <span className="text-slate-300">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="To date" />
        </div>
        {(search || status || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setStatus(''); setDateFrom(''); setDateTo(''); }} className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5">
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black text-[11px] font-black uppercase tracking-[0.15em] text-white text-center border-b-2 border-[#C4A052]">
                <th className="py-4 px-3 w-12">#</th>
                <th className="py-4 px-3">Date</th>
                <th className="py-4 px-3">To</th>
                <th className="py-4 px-3">Customer / Supplier</th>
                <th className="py-4 px-3">Subject</th>
                <th className="py-4 px-3">Files</th>
                {admin && <th className="py-4 px-3">Sent By</th>}
                <th className="py-4 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.map((r, i) => (
                <tr key={r.ID} className="text-center align-middle hover:bg-slate-50/60">
                  <td className="py-3 px-3 text-xs font-bold text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="py-3 px-3 text-xs whitespace-nowrap tabular-nums">{when(r.SENT_AT)}</td>
                  <td className="py-3 px-3 text-xs text-slate-600 max-w-[240px] truncate" title={r.TO_EMAILS.join(', ')}>{r.TO_EMAILS.join(', ') || '-'}</td>
                  <td className="py-3 px-3 font-bold text-slate-800 max-w-[220px] truncate" dir="auto">{r.PARTY || '-'}</td>
                  <td className="py-3 px-3 text-slate-600 max-w-[280px] truncate" dir="auto" title={r.SUBJECT}>{r.SUBJECT}</td>
                  <td className="py-3 px-3 tabular-nums">{r.ATTACHMENTS.length || '-'}</td>
                  {admin && <td className="py-3 px-3 text-xs font-bold text-slate-600 whitespace-nowrap">{r.SENT_BY_NAME || '-'}</td>}
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1">
                      {r.STATUS === 'sent' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black"><CheckCircle2 className="w-3.5 h-3.5" /> Sent</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-600 text-[11px] font-black" title={r.ERROR || ''}><XCircle className="w-3.5 h-3.5" /> Failed</span>
                      )}
                      <button onClick={() => setView(r)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length && <NoData isTable colSpan={cols} title={rows.length ? 'NO MATCHING EMAILS' : 'NO EMAILS SENT YET'} />}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!view} title={view?.SUBJECT || ''} subtitle={view ? `${when(view.SENT_AT)} · ${view.FROM_EMAIL || ''}` : ''} onClose={() => setView(null)} width="max-w-3xl">
        {view && (
          <div className="space-y-3 text-sm">
            {view.STATUS === 'failed' && <p className="rounded-xl bg-red-50 text-red-700 font-semibold px-4 py-2">{view.ERROR}</p>}
            <p className="break-words"><b>To:</b> {view.TO_EMAILS.join(', ') || '-'}</p>
            {view.CC_EMAILS.length > 0 && <p className="break-words"><b>CC:</b> {view.CC_EMAILS.join(', ')}</p>}
            {view.BCC_EMAILS.length > 0 && <p className="break-words"><b>BCC:</b> {view.BCC_EMAILS.join(', ')}</p>}
            {view.ATTACHMENTS.length > 0 && (
              <div>
                <b>Files:</b>
                <ul className="mt-1 space-y-0.5 text-slate-600">
                  {view.ATTACHMENTS.map((a, i) => (
                    <li key={i}>
                      {a.name} <span className="text-slate-400">({describeAttachment(a.spec)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 whitespace-pre-wrap leading-relaxed" dir="auto">{view.BODY.replace(/\*\*(.+?)\*\*/g, '$1')}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
