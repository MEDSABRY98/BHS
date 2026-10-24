'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, FileSpreadsheet, FileText, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import ConfirmDialog from './ConfirmDialog';
import { deleteAllocation } from '../Service/AnalyticService';
import { exportAllocationExcel, exportAllocationPdf } from '../Utils/AnalyticExport';
import { computeAllocation, formatAmount, formatDate, round2, type Allocation } from '../Utils/AnalyticTypes';

interface ArchiveTabProps {
  allocations: Allocation[];
  admin: boolean;
  canEdit: boolean;
  onEdit: (a: Allocation) => void;
  onDeleted: (id: number) => void;
}

export default function ArchiveTab({ allocations, admin, canEdit, onEdit, onDeleted }: ArchiveTabProps) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Allocation | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allocations.filter((a) => {
      if (dateFrom && a.ALLOC_DATE < dateFrom) return false;
      if (dateTo && a.ALLOC_DATE > dateTo) return false;
      if (!q) return true;
      return (
        a.TITLE.toLowerCase().includes(q) ||
        a.NOTES.toLowerCase().includes(q) ||
        formatAmount(a.AMOUNT).includes(q) ||
        a.PEOPLE.some((p) => p.NAME.toLowerCase().includes(q)) ||
        a.LINES.some((l) => l.ACCOUNT.toLowerCase().includes(q))
      );
    });
  }, [allocations, search, dateFrom, dateTo]);
  const total = round2(rows.reduce((s, a) => s + a.AMOUNT, 0));

  const run = async (a: Allocation, kind: 'pdf' | 'excel') => {
    setBusy(`${kind}-${a.ID}`);
    try {
      await (kind === 'pdf' ? exportAllocationPdf(a) : exportAllocationExcel(a));
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the file');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(`del-${deleteTarget.ID}`);
    try {
      await deleteAllocation(deleteTarget.ID);
      onDeleted(deleteTarget.ID);
      toast.success('Allocation deleted');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Archive</h1>
        <span className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
          <span className="text-slate-400 mr-1">{rows.length} ·</span>AED {formatAmount(total)}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, person, account, amount…" dir="auto" className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="From date" />
          <span className="text-slate-300">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="To date" />
        </div>
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }} className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5">
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      <div className="space-y-3">
        {rows.map((a) => {
          const open = openId === a.ID;
          const calc = open ? computeAllocation(a.AMOUNT, a.PEOPLE) : null;
          return (
            <div key={a.ID} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-3">
                <button onClick={() => setOpenId(open ? null : a.ID)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate" dir="auto">{a.TITLE}</p>
                    <p className="text-xs font-semibold text-slate-400">
                      #{a.ID} · {formatDate(a.ALLOC_DATE)} · {a.PEOPLE.length} people · {new Set(a.LINES.map((l) => l.ACCOUNT)).size} accounts
                      {admin && a.CREATED_BY_NAME ? ` · ${a.CREATED_BY_NAME}` : ''}
                    </p>
                  </div>
                </button>
                <span className="font-black text-lg text-slate-900 tabular-nums md:mr-3">AED {formatAmount(a.AMOUNT)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => void run(a, 'excel')} disabled={!!busy} className="w-9 h-9 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" title="Excel">
                    {busy === `excel-${a.ID}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  </button>
                  <button onClick={() => void run(a, 'pdf')} disabled={!!busy} className="w-9 h-9 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50" title="PDF">
                    {busy === `pdf-${a.ID}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  </button>
                  {canEdit && (
                    <button onClick={() => onEdit(a)} className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {admin && (
                    <button onClick={() => setDeleteTarget(a)} className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {calc && (
                <div className="border-t border-slate-100 p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 text-center border-b border-slate-100">
                        <th className="py-2 px-2">Analytic Account</th>
                        <th className="py-2 px-2">Amount (AED)</th>
                        <th className="py-2 px-2">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {calc.accounts.map((x) => (
                        <tr key={x.ACCOUNT} className="text-center">
                          <td className="py-2 px-2 font-bold text-slate-800">{x.ACCOUNT}</td>
                          <td className="py-2 px-2 tabular-nums">{formatAmount(x.AMOUNT)}</td>
                          <td className="py-2 px-2 tabular-nums">{x.PCT.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 text-center border-b border-slate-100">
                        <th className="py-2 px-2">Person</th>
                        <th className="py-2 px-2">%</th>
                        <th className="py-2 px-2">Amount (AED)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {calc.persons.map((p) => (
                        <tr key={p.NAME} className="text-center">
                          <td className="py-2 px-2 font-bold text-slate-800" dir="auto">{p.NAME}</td>
                          <td className="py-2 px-2 tabular-nums">{p.PCT.toFixed(2)}%</td>
                          <td className="py-2 px-2 tabular-nums">{formatAmount(p.AMOUNT)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {a.NOTES && <p className="lg:col-span-2 text-sm text-slate-500" dir="auto">{a.NOTES}</p>}
                </div>
              )}
            </div>
          );
        })}
        {!rows.length && <NoData title={allocations.length ? 'NO MATCHING ALLOCATIONS' : 'NO SAVED ALLOCATIONS YET'} />}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.TITLE || ''}"?`}
        message={deleteTarget ? <>AED {formatAmount(deleteTarget.AMOUNT)} · {formatDate(deleteTarget.ALLOC_DATE)}<br />This can&apos;t be undone.</> : null}
        busy={busy === `del-${deleteTarget?.ID}`}
        onConfirm={() => void remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
