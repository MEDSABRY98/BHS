'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, BarChart3, Check, CheckCheck, FileSpreadsheet, FileText, Loader2, Pencil, RotateCcw, Search, Send, Trash2, X } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import EmployeeSelect, { type EmployeeOption } from './EmployeeSelect';
import ConfirmDialog from './ConfirmDialog';
import { deletePettyCash, setPettyCashStatus, submitPettyCash } from '../Service/PettyCashService';
import { generatePettyCashPdf } from '../Utils/PettyCashPdf';
import { exportPettyCashExcel } from '../Utils/PettyCashExcel';
import { generatePettyCashAnalysisPdf } from '../Utils/PettyCashAnalysisPdf';
import {
  formatAmount,
  formatDate,
  missingInvoices,
  round2,
  STATUS_META,
  uaeDateOf,
  type PettyCash,
  type PettyCashStatus,
} from '../Utils/PettyCashTypes';

const PAGE_SIZE = 24;

interface PettyCashCardsProps {
  items: PettyCash[];
  viewAll: boolean;   // admin
  canEditTab: boolean; // has the New tab (the form is used for editing)
  onEdit: (p: PettyCash) => void;
  currentUserName: string;
  onDeleted: (id: string) => void;
  onChanged: (p: PettyCash) => void;
}

type StatusAction = { p: PettyCash; to: 'SUBMIT' | PettyCashStatus } | null;
const STATUS_FILTERS: ('' | PettyCashStatus)[] = ['', 'OPEN', 'SUBMITTED', 'SETTLED'];

type Kind = 'pdf' | 'xlsx' | 'analysis';
type Busy = { id: string; kind: Kind } | null;

export default function PettyCashCards({ items, viewAll, canEditTab, onEdit, currentUserName, onDeleted, onChanged }: PettyCashCardsProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | PettyCashStatus>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = openId ? items.find((x) => x.ID === openId) || null : null;

  // Esc closes the details popup
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);
  const [statusAction, setStatusAction] = useState<StatusAction>(null);
  const [changing, setChanging] = useState(false);

  // per card: the employee works on his OPEN one, the admin on everything
  const isOwnOpen = (p: PettyCash) => p.MINE && p.STATUS === 'OPEN';
  const canEditCard = (p: PettyCash) => canEditTab && (viewAll || isOwnOpen(p));
  const canDeleteCard = (p: PettyCash) => viewAll || isOwnOpen(p);

  const confirmStatus = async () => {
    if (!statusAction) return;
    setChanging(true);
    try {
      const { p, to } = statusAction;
      const updated = to === 'SUBMIT' ? await submitPettyCash(p.ID) : await setPettyCashStatus(p.ID, to);
      onChanged(updated);
      toast.success(
        to === 'SUBMIT' ? `${p.ID} submitted for settlement` : to === 'SETTLED' ? `${p.ID} settled` : `${p.ID} is ${STATUS_META[to].label.toLowerCase()} again`,
      );
      setStatusAction(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not update the status');
    } finally {
      setChanging(false);
    }
  };
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

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { '': items.length, OPEN: 0, SUBMITTED: 0, SETTLED: 0 };
    for (const p of items) c[p.STATUS] = (c[p.STATUS] || 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (status && p.STATUS !== status) return false;
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
  }, [items, search, status, employee, dateFrom, dateTo]);

  useEffect(() => setShown(PAGE_SIZE), [search, status, employee, dateFrom, dateTo]);

  const total = round2(filtered.reduce((s, p) => s + p.TOTAL_AMOUNT, 0));
  const filtersActive = !!(search || status || employee || dateFrom || dateTo);
  const period = dateFrom || dateTo ? `${dateFrom ? formatDate(dateFrom) : '…'} – ${dateTo ? formatDate(dateTo) : '…'}` : 'All';

  const run = async (id: string, kind: Kind, list: PettyCash[]) => {
    setBusy({ id, kind });
    try {
      if (kind === 'analysis') await generatePettyCashAnalysisPdf(list);
      else if (kind === 'pdf') await generatePettyCashPdf(list, { printedBy: currentUserName, period, showAccount: viewAll });
      else await exportPettyCashExcel(list, { period, showAccount: viewAll });
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the file');
    } finally {
      setBusy(null);
    }
  };

  const isBusy = (id: string, kind: Kind) => busy?.id === id && busy.kind === kind;

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

  const runSelected = async (kind: Kind) => {
    setBusy({ id: 'SELECTED', kind });
    try {
      if (kind === 'analysis') await generatePettyCashAnalysisPdf(selectedList);
      else if (kind === 'pdf') await generatePettyCashPdf(selectedList, { printedBy: currentUserName, period: selectedPeriod, showAccount: viewAll });
      else await exportPettyCashExcel(selectedList, { period: selectedPeriod, showAccount: viewAll });
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
          {viewAll && (
            <button
              onClick={() => void run('ALL', 'analysis', filtered)}
              disabled={!filtered.length || !!busy}
              className="h-10 px-4 rounded-xl bg-[#0a0f1d] border border-[#0a0f1d] text-sm font-bold text-[#D4AF37] hover:brightness-125 flex items-center gap-1.5 disabled:opacity-40"
              title="Analysis report for the cards shown"
            >
              {isBusy('ALL', 'analysis') ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Analysis
            </button>
          )}
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
              setStatus('');
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

      {/* Status */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => {
          const active = status === s;
          return (
            <button
              key={s || 'all'}
              onClick={() => setStatus(s)}
              className={`h-9 w-36 px-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                active ? 'bg-[#0a0f1d] border-[#0a0f1d] text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s && <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`} />}
              {s ? STATUS_META[s].label : 'All'}
              <span className={`text-xs font-black ${active ? 'text-[#D4AF37]' : 'text-slate-400'}`}>{statusCounts[s] || 0}</span>
            </button>
          );
        })}
      </div>

      {/* Cards: same size, click to open the details */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
          <NoData title={items.length ? 'NO MATCHING PETTY CASH' : 'NO PETTY CASH YET'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.slice(0, shown).map((p) => {
            const isSelected = selected.has(p.ID);
            const meta = STATUS_META[p.STATUS];
            return (
              <div
                key={p.ID}
                onClick={() => setOpenId(p.ID)}
                className={`h-[118px] bg-white rounded-2xl border shadow-sm p-4 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  isSelected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/60' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(p.ID);
                    }}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-slate-300 hover:border-[#D4AF37]'
                    }`}
                    title={isSelected ? 'Unselect' : 'Select'}
                  >
                    {isSelected && <Check className="w-4 h-4 text-[#0a0f1d]" strokeWidth={3} />}
                  </button>
                  <span className="text-base font-black text-slate-900 tracking-wide">{p.ID}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${meta.badge}`}>{meta.label}</span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate" dir="auto">{p.CREATED_BY}</p>
                    <p className="text-xs font-semibold text-slate-400">{formatDate(uaeDateOf(p.CREATED_AT))}</p>
                  </div>
                  <p className="text-xl font-black text-slate-900 whitespace-nowrap">
                    <span className="text-xs text-slate-400 mr-1">AED</span>
                    {formatAmount(p.TOTAL_AMOUNT)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details popup */}
      {openItem && (() => {
        const p = openItem;
        const meta = STATUS_META[p.STATUS];
        const missing = missingInvoices(p.LINES);
        const canEdit = canEditCard(p);
        const canDelete = canDeleteCard(p);
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpenId(null)}>
            <div
              className="w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-[#0a0f1d] px-6 py-5 border-b-2 border-[#D4AF37] flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-black text-[#D4AF37] tracking-wide flex items-center gap-3">
                    {p.ID}
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${meta.badge}`}>{meta.label}</span>
                  </p>
                  <p className="text-sm font-semibold text-slate-400 mt-1" dir="auto">
                    {p.CREATED_BY} · {formatDate(uaeDateOf(p.CREATED_AT))}
                    {p.STATUS === 'SETTLED' && p.SETTLED_AT && (
                      <span className="text-emerald-400">
                        {' '}· Settled {formatDate(uaeDateOf(p.SETTLED_AT))}
                        {viewAll && p.SETTLED_BY ? ` by ${p.SETTLED_BY}` : ''}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Total</p>
                  <p className="text-2xl font-black text-white whitespace-nowrap">
                    <span className="text-sm text-slate-400 mr-1">AED</span>
                    {formatAmount(p.TOTAL_AMOUNT)}
                  </p>
                </div>
                <button onClick={() => setOpenId(null)} className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0" title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-slate-50 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rows</p>
                    <p className="text-base font-black text-slate-800">{p.LINES_COUNT}</p>
                  </div>
                  <div className={`rounded-xl py-2.5 ${missing ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${missing ? 'text-red-400' : 'text-emerald-500'}`}>No Invoice</p>
                    <p className={`text-base font-black ${missing ? 'text-red-700' : 'text-emerald-700'}`}>{missing}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-2.5 col-span-2 sm:col-span-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Beneficiaries</p>
                    <p className="text-base font-black text-slate-800">{new Set(p.LINES.map((l) => l.BENEFICIARY.trim())).size}</p>
                  </div>
                </div>

                {p.NOTES && (
                  <div className="rounded-2xl bg-[#FBF8EE] border border-[#D4AF37]/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700/70 mb-1">Notes</p>
                    <p className="text-sm font-semibold text-slate-700 whitespace-pre-line" dir="auto">{p.NOTES}</p>
                  </div>
                )}

              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-slate-100 space-y-2">
                  {isOwnOpen(p) && (
                    <button
                      onClick={() => setStatusAction({ p, to: 'SUBMIT' })}
                      disabled={changing}
                      className="w-full h-11 px-5 rounded-xl justify-center bg-gradient-to-r from-amber-600 to-yellow-600 text-white text-sm font-black shadow-sm hover:brightness-105 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" /> Submit for Settlement
                    </button>
                  )}
                  {viewAll && p.STATUS === 'SUBMITTED' && (
                    <button
                      onClick={() => setStatusAction({ p, to: 'SETTLED' })}
                      disabled={changing}
                      className="w-full h-11 px-5 rounded-xl justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <BadgeCheck className="w-4 h-4" /> Mark as Settled
                    </button>
                  )}
                <div className="flex gap-2">
                <button
                  onClick={() => void run(p.ID, 'pdf', [p])}
                  disabled={!!busy}
                  className="flex-1 min-w-0 h-10 px-2 rounded-xl border border-slate-200 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40"
                >
                  {isBusy(p.ID, 'pdf') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
                </button>
                <button
                  onClick={() => void run(p.ID, 'xlsx', [p])}
                  disabled={!!busy}
                  className="flex-1 min-w-0 h-10 px-2 rounded-xl border border-slate-200 text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40"
                >
                  {isBusy(p.ID, 'xlsx') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
                </button>
                {viewAll && (
                  <button
                    onClick={() => void run(p.ID, 'analysis', [p])}
                    disabled={!!busy}
                    className="flex-1 min-w-0 h-10 px-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-amber-50 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40"
                  >
                    {isBusy(p.ID, 'analysis') ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Analysis
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => {
                      setOpenId(null);
                      onEdit(p);
                    }}
                    disabled={!!busy || deleting}
                    className="flex-1 min-w-0 h-10 px-2 rounded-xl border border-slate-200 text-sm font-bold text-amber-700 hover:bg-amber-50 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                )}
                {viewAll && p.STATUS !== 'SUBMITTED' && (
                  <button
                    onClick={() => setStatusAction({ p, to: 'SUBMITTED' })}
                    disabled={changing}
                    className="flex-1 min-w-0 h-10 px-2 rounded-xl border border-slate-200 text-sm font-bold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40"
                    title={p.STATUS === 'SETTLED' ? 'Undo settle (back to Submitted)' : 'Close it (Submitted)'}
                  >
                    <RotateCcw className="w-4 h-4" /> {p.STATUS === 'SETTLED' ? 'Undo Settle' : 'Close'}
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setDeleteTarget(p)}
                    disabled={!!busy || deleting}
                    className="flex-1 min-w-0 h-10 px-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
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
            {viewAll && (
              <button
                onClick={() => void runSelected('analysis')}
                disabled={!!busy}
                className="h-10 px-4 rounded-xl bg-[#D4AF37] text-[#0a0f1d] hover:brightness-110 text-sm font-black flex items-center gap-1.5 disabled:opacity-40"
              >
                {isBusy('SELECTED', 'analysis') ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Analysis
              </button>
            )}
            <button onClick={() => setSelected(new Set())} className="w-10 h-10 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center" title="Clear selection">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!statusAction}
        title={
          statusAction
            ? statusAction.to === 'SUBMIT'
              ? `Submit ${statusAction.p.ID} for settlement?`
              : statusAction.to === 'SETTLED'
                ? `Settle ${statusAction.p.ID}?`
                : `Move ${statusAction.p.ID} back to Submitted?`
            : ''
        }
        message={
          statusAction ? (
            <>
              {statusAction.p.CREATED_BY} · {statusAction.p.LINES_COUNT} row{statusAction.p.LINES_COUNT === 1 ? '' : 's'} · AED {formatAmount(statusAction.p.TOTAL_AMOUNT)}
              <br />
              {statusAction.to === 'SUBMIT'
                ? "You won't be able to edit it after submitting. New rows will start a new petty cash."
                : statusAction.to === 'SETTLED'
                  ? 'It will be marked as settled with the employee.'
                  : statusAction.p.STATUS === 'OPEN'
                    ? "The employee won't be able to add to it anymore."
                    : 'It will no longer show as settled.'}
            </>
          ) : null
        }
        confirmLabel={statusAction?.to === 'SUBMIT' ? 'Submit' : statusAction?.to === 'SETTLED' ? 'Settle' : 'Confirm'}
        tone="primary"
        busy={changing}
        onConfirm={() => void confirmStatus()}
        onCancel={() => setStatusAction(null)}
      />

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
