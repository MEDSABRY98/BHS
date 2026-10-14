'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCheck, FileSpreadsheet, FileText, Loader2, Search, Trash2, X } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import EmployeeSelect, { type EmployeeOption } from './EmployeeSelect';
import ConfirmDialog from './ConfirmDialog';
import { deletePettyCash } from '../Service/PettyCashService';
import { generatePettyCashPdf } from '../Utils/PettyCashPdf';
import { exportPettyCashExcel } from '../Utils/PettyCashExcel';
import {
  formatAmount,
  formatDate,
  missingInvoices,
  round2,
  uaeDateOf,
  type PettyCash,
} from '../Utils/PettyCashTypes';

const PAGE_SIZE = 24;

interface PettyCashCardsProps {
  items: PettyCash[];
  viewAll: boolean;
  canDelete: boolean; // admin only
  currentUserName: string;
  onDeleted: (id: string) => void;
}

type Busy = { id: string; kind: 'pdf' | 'xlsx' } | null;

export default function PettyCashCards({ items, viewAll, canDelete, currentUserName, onDeleted }: PettyCashCardsProps) {
  const [search, setSearch] = useState('');
  const [employee, setEmployee] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [busy, setBusy] = useState<Busy>(null);
  const [deleteTarget, setDeleteTarget] = useState<PettyCash | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // drop selections that no longer exist (e.g. deleted)
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      const ids = new Set(items.map((p) => p.ID));
      const next = new Set(Array.from(prev).filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePettyCash(deleteTarget.ID);
      onDeleted(deleteTarget.ID);
      toast.success(`${deleteTarget.ID} deleted`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete');
    } finally {
      setDeleting(false);
    }
  };

  const employees = useMemo<EmployeeOption[]>(() => {
    const m = new Map<string, EmployeeOption>();
    for (const p of items) {
      const e = m.get(p.CREATED_BY) || { name: p.CREATED_BY, count: 0, total: 0 };
      e.count++;
      e.total = round2(e.total + p.TOTAL_AMOUNT);
      m.set(p.CREATED_BY, e);
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      const day = uaeDateOf(p.CREATED_AT);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (employee && p.CREATED_BY !== employee) return false;
      if (!q) return true;
      return (
        p.ID.toLowerCase().includes(q) ||
        p.CREATED_BY.toLowerCase().includes(q) ||
        String(p.NOTES || '').toLowerCase().includes(q) ||
        formatAmount(p.TOTAL_AMOUNT).includes(q) ||
        p.LINES.some((l) => l.DESCRIPTION.toLowerCase().includes(q) || l.BENEFICIARY.toLowerCase().includes(q))
      );
    });
  }, [items, search, employee, dateFrom, dateTo]);

  useEffect(() => setShown(PAGE_SIZE), [search, employee, dateFrom, dateTo]);

  const total = round2(filtered.reduce((s, p) => s + p.TOTAL_AMOUNT, 0));
  const filtersActive = !!(search || employee || dateFrom || dateTo);
  const period = dateFrom || dateTo ? `${dateFrom ? formatDate(dateFrom) : '…'} – ${dateTo ? formatDate(dateTo) : '…'}` : 'All';

  const run = async (id: string, kind: 'pdf' | 'xlsx', list: PettyCash[]) => {
    setBusy({ id, kind });
    try {
      if (kind === 'pdf') await generatePettyCashPdf(list, { printedBy: currentUserName, period });
      else await exportPettyCashExcel(list, { period });
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the file');
    } finally {
      setBusy(null);
    }
  };

  const isBusy = (id: string, kind: 'pdf' | 'xlsx') => busy?.id === id && busy.kind === kind;

  // selected cards, oldest first so the combined file reads in order
  const selectedList = useMemo(
    () => items.filter((p) => selected.has(p.ID)).sort((a, b) => (a.CREATED_AT < b.CREATED_AT ? -1 : 1)),
    [items, selected],
  );
  const selectedTotal = round2(selectedList.reduce((s, p) => s + p.TOTAL_AMOUNT, 0));
  const selectedPeriod = useMemo(() => {
    const dates = selectedList.flatMap((p) => p.LINES.map((l) => l.INVOICE_DATE)).sort();
    return dates.length ? `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}` : 'All';
  }, [selectedList]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.ID));

  const runSelected = async (kind: 'pdf' | 'xlsx') => {
    setBusy({ id: 'SELECTED', kind });
    try {
      if (kind === 'pdf') await generatePettyCashPdf(selectedList, { printedBy: currentUserName, period: selectedPeriod });
      else await exportPettyCashExcel(selectedList, { period: selectedPeriod });
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the file');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`space-y-6 ${selected.size ? 'pb-24' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">{viewAll ? 'All Petty Cash' : 'My Petty Cash'}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
            <span className="text-slate-400 mr-1">{filtered.length} ·</span>AED {formatAmount(total)}
          </span>
          <button
            onClick={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (allFilteredSelected) filtered.forEach((p) => next.delete(p.ID));
                else filtered.forEach((p) => next.add(p.ID));
                return next;
              })
            }
            disabled={!filtered.length}
            className={`h-10 px-4 rounded-xl border text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 ${
              allFilteredSelected ? 'bg-[#0a0f1d] border-[#0a0f1d] text-[#D4AF37]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CheckCheck className="w-4 h-4" /> {allFilteredSelected ? 'Unselect All' : 'Select All'}
          </button>
          <button
            onClick={() => void run('ALL', 'pdf', filtered)}
            disabled={!filtered.length || !!busy}
            className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5 disabled:opacity-40"
          >
            {isBusy('ALL', 'pdf') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF All
          </button>
          <button
            onClick={() => void run('ALL', 'xlsx', filtered)}
            disabled={!filtered.length || !!busy}
            className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-1.5 disabled:opacity-40"
          >
            {isBusy('ALL', 'xlsx') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, description, beneficiary, amount…"
            dir="auto"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />
        </div>
        {viewAll && (
          <EmployeeSelect value={employee} options={employees} onChange={setEmployee} />
        )}
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="Saved from" />
          <span className="text-slate-300">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="Saved to" />
        </div>
        {filtersActive && (
          <button
            onClick={() => {
              setSearch('');
              setEmployee('');
              setDateFrom('');
              setDateTo('');
            }}
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
          <NoData title={items.length ? 'NO MATCHING PETTY CASH' : 'NO PETTY CASH YET'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5 items-start">
          {filtered.slice(0, shown).map((p) => {
            const missing = missingInvoices(p.LINES);
            const isSelected = selected.has(p.ID);
            return (
              <div
                key={p.ID}
                className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col transition-all ${
                  isSelected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/60 shadow-amber-900/10' : 'border-slate-100'
                }`}
              >
                <div
                  onClick={() => toggleSelect(p.ID)}
                  className="bg-[#0a0f1d] px-5 py-4 flex items-start justify-between gap-3 border-b-2 border-[#D4AF37] cursor-pointer select-none"
                  title={isSelected ? 'Unselect' : 'Select'}
                >
                  <span
                    className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-slate-500 hover:border-[#D4AF37]'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4 text-[#0a0f1d]" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-black text-[#D4AF37] tracking-wide">{p.ID}</p>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5 truncate">
                      {formatDate(uaeDateOf(p.CREATED_AT))}
                      {viewAll && <span className="text-slate-300"> · {p.CREATED_BY}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Total</p>
                    <p className="text-lg font-black text-white whitespace-nowrap">
                      <span className="text-xs text-slate-400 mr-1">AED</span>
                      {formatAmount(p.TOTAL_AMOUNT)}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rows</p>
                    <p className="text-sm font-black text-slate-800">{p.LINES_COUNT}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600/70">Tax Inv.</p>
                    <p className="text-sm font-black text-amber-800">{formatAmount(p.TAX_AMOUNT_TOTAL)}</p>
                  </div>
                  <div className={`rounded-xl py-2 ${missing ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${missing ? 'text-red-400' : 'text-emerald-500'}`}>No Invoice</p>
                    <p className={`text-sm font-black ${missing ? 'text-red-700' : 'text-emerald-700'}`}>{missing}</p>
                  </div>
                </div>

                {p.NOTES && (
                  <p className="px-5 -mt-1 pb-3 text-xs font-semibold text-slate-500 line-clamp-2" dir="auto">
                    {p.NOTES}
                  </p>
                )}

                <div className={`mt-auto px-3 py-3 border-t border-slate-100 grid gap-2 ${canDelete ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-2'}`}>
                  <button
                    onClick={() => void run(p.ID, 'pdf', [p])}
                    disabled={!!busy}
                    className="h-9 px-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 disabled:opacity-40"
                    title="Download PDF"
                  >
                    {isBusy(p.ID, 'pdf') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
                  </button>
                  <button
                    onClick={() => void run(p.ID, 'xlsx', [p])}
                    disabled={!!busy}
                    className="h-9 px-3 rounded-xl text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-1.5 disabled:opacity-40"
                    title="Download Excel"
                  >
                    {isBusy(p.ID, 'xlsx') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => setDeleteTarget(p)}
                      disabled={!!busy || deleting}
                      className="w-9 h-9 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center disabled:opacity-40"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > shown && (
        <div className="flex justify-center">
          <button onClick={() => setShown((n) => n + PAGE_SIZE)} className="h-11 px-6 rounded-xl bg-[#0a0f1d] text-white text-sm font-bold">
            Show more ({filtered.length - shown})
          </button>
        </div>
      )}

      {/* Selection bar: print the chosen cards in one PDF / one Excel */}
      {selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-2xl">
          <div className="bg-[#0a0f1d] text-white rounded-2xl shadow-2xl shadow-black/30 border border-[#D4AF37]/40 px-4 py-3 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="w-9 h-9 rounded-xl bg-[#D4AF37] text-[#0a0f1d] flex items-center justify-center text-sm font-black shrink-0">{selected.size}</span>
            <div className="flex-1 min-w-[140px]">
              <p className="text-sm font-black">
                {selected.size} card{selected.size === 1 ? '' : 's'} selected
              </p>
              <p className="text-xs font-semibold text-slate-400">AED {formatAmount(selectedTotal)}</p>
            </div>
            <button
              onClick={() => void runSelected('pdf')}
              disabled={!!busy}
              className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40"
            >
              {isBusy('SELECTED', 'pdf') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-red-400" />} One PDF
            </button>
            <button
              onClick={() => void runSelected('xlsx')}
              disabled={!!busy}
              className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40"
            >
              {isBusy('SELECTED', 'xlsx') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-400" />} One Excel
            </button>
            <button onClick={() => setSelected(new Set())} className="w-10 h-10 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center" title="Clear selection">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.ID || ''}?`}
        message={
          deleteTarget ? (
            <>
              {deleteTarget.CREATED_BY} · {deleteTarget.LINES_COUNT} row{deleteTarget.LINES_COUNT === 1 ? '' : 's'} · AED {formatAmount(deleteTarget.TOTAL_AMOUNT)}
              <br />
              This can&apos;t be undone.
            </>
          ) : null
        }
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
