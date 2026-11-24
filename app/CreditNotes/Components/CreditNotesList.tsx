'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, FileSpreadsheet, FileText, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import ConfirmDialog from './ConfirmDialog';
import { deleteCreditNote } from '../Service/CreditNoteService';
import { generateCreditNotePdf } from '../Utils/CreditNotePdf';
import { formatAmount, formatDate, round2, type CreditNote } from '../Utils/CreditNoteTypes';

/** Styled dropdown for the filters pop-up (replaces the browser's plain <select>). */
function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full h-11 px-3.5 rounded-xl border bg-white text-sm font-semibold text-slate-800 flex items-center justify-between gap-2 transition-all ${
          open ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/25' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className="truncate" dir="auto">{current?.label}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-[#B8860B]' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-60 overflow-y-auto rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value || '__all'}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                  active ? 'bg-[#FDF6DC] text-[#8a6508] font-bold' : 'text-slate-700 font-medium hover:bg-slate-50'
                }`}
              >
                <span className="truncate" dir="auto">{o.label}</span>
                {active && <Check className="w-4 h-4 shrink-0 text-[#B8860B]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

const userOf = (n: { CREATED_BY_NAME?: string; CREATED_BY: string }) => n.CREATED_BY_NAME || n.CREATED_BY || '—';
const monthKey = (d: string) => String(d || '').slice(0, 7); // yyyy-mm
const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—';
};

export interface ListFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  user: string;
  sort?: string; // '' = grouped by month; otherwise one flat list in this order
}
const NO_FILTERS: ListFilters = { search: '', dateFrom: '', dateTo: '', user: '', sort: '' };
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default (grouped by month)' },
  { value: 'amount_desc', label: 'Amount: highest first' },
  { value: 'amount_asc', label: 'Amount: lowest first' },
  { value: 'date_desc', label: 'Date: newest first' },
  { value: 'date_asc', label: 'Date: oldest first' },
];

interface CreditNotesListProps {
  notes: CreditNote[];
  admin: boolean; // sees all, edits & deletes
  canEdit: boolean;
  onEdit: (n: CreditNote) => void;
  onDeleted: (id: string) => void;
  filters: ListFilters;
  onFiltersChange: (f: ListFilters) => void;
  filtersOpen: boolean;
  onCloseFilters: () => void;
}

export default function CreditNotesList({ notes, admin, canEdit, onEdit, onDeleted, filters, onFiltersChange, filtersOpen, onCloseFilters }: CreditNotesListProps) {
  const { search, dateFrom, dateTo, user } = filters;
  const sort = filters.sort || '';
  const [draft, setDraft] = useState<ListFilters>(filters);
  useEffect(() => {
    if (filtersOpen) setDraft(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersOpen]);
  const users = useMemo(() => Array.from(new Set(notes.map(userOf))).sort((a, b) => a.localeCompare(b)), [notes]);
  const [page, setPage] = useState(1);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreditNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (dateFrom && n.NOTE_DATE < dateFrom) return false;
      if (dateTo && n.NOTE_DATE > dateTo) return false;
      if (user && userOf(n) !== user) return false;
      if (!q) return true;
      return (
        n.ID.toLowerCase().includes(q) ||
        n.BODY_TEXT.toLowerCase().includes(q) ||
        String(n.CREATED_BY_NAME || '').toLowerCase().includes(q) ||
        formatAmount(n.TOTAL).includes(q) ||
        n.LINES.some((l) => l.description.toLowerCase().includes(q))
      );
    });
  }, [notes, search, dateFrom, dateTo, user]);

  // grouped by month (newest first), then by user
  const sorted = useMemo(() => {
    const byDefault = (a: CreditNote, b: CreditNote) =>
      monthKey(b.NOTE_DATE).localeCompare(monthKey(a.NOTE_DATE)) ||
      b.NOTE_DATE.localeCompare(a.NOTE_DATE) ||
      b.ID.localeCompare(a.ID);
    const flat: Record<string, (a: CreditNote, b: CreditNote) => number> = {
      amount_desc: (a, b) => b.TOTAL - a.TOTAL || byDefault(a, b),
      amount_asc: (a, b) => a.TOTAL - b.TOTAL || byDefault(a, b),
      date_desc: (a, b) => b.NOTE_DATE.localeCompare(a.NOTE_DATE) || b.ID.localeCompare(a.ID),
      date_asc: (a, b) => a.NOTE_DATE.localeCompare(b.NOTE_DATE) || a.ID.localeCompare(b.ID),
    };
    return [...filtered].sort(flat[sort] || byDefault);
  }, [filtered, sort]);
  const groupTotals = useMemo(() => {
    const m = new Map<string, { count: number; amount: number }>();
    const add = (k: string, v: number) => {
      const t = m.get(k) || { count: 0, amount: 0 };
      t.count++;
      t.amount = round2(t.amount + v);
      m.set(k, t);
    };
    for (const n of filtered) {
      add(monthKey(n.NOTE_DATE), n.TOTAL);
    }
    return m;
  }, [filtered]);

  const total = round2(filtered.reduce((s, n) => s + n.TOTAL, 0));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(1), [search, dateFrom, dateTo, user, sort]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtersActive = !!(search || dateFrom || dateTo || user);

  const pdf = async (n: CreditNote) => {
    setPdfId(n.ID);
    try {
      await generateCreditNotePdf(n);
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the PDF');
    } finally {
      setPdfId(null);
    }
  };

  // Excel of everything currently shown (all pages, respecting search + filters), in the same order as the list
  const exportExcel = async () => {
    if (sorted.length === 0) {
      toast.error('Nothing to export');
      return;
    }
    setExporting(true);
    try {
      const { exportStyledExcelWorkbook } = await import('@/app/Components/Export/ExcelExport');
      const notesSheet: Record<string, unknown>[] = sorted.map((n) => ({
        'Credit Note No.': n.ID,
        'Date': formatDate(n.NOTE_DATE),
        'Description': n.LINES.map((l) => l.description).filter(Boolean).join(' | ') || n.BODY_TEXT,
        'Amount (AED)': n.TOTAL,
        ...(admin ? { 'Created By': userOf(n) } : {}),
      }));
      notesSheet.push({
        'Credit Note No.': 'TOTAL',
        'Date': '',
        'Description': `${sorted.length} notes`,
        'Amount (AED)': total,
        ...(admin ? { 'Created By': '' } : {}),
      });
      const linesSheet: Record<string, unknown>[] = sorted.flatMap((n) =>
        n.LINES.map((l) => ({
          'Credit Note No.': n.ID,
          'Date': formatDate(n.NOTE_DATE),
          'Line Description': l.description,
          'Amount (AED)': l.amount,
        })),
      );
      await exportStyledExcelWorkbook(
        [
          { name: 'Credit Notes', data: notesSheet, options: { columnWidth: 24, numericColumns: ['Amount (AED)'] } },
          { name: 'Lines', data: linesSheet, options: { columnWidth: 24, numericColumns: ['Amount (AED)'] } },
        ],
        `credit_notes_${new Date().toISOString().split('T')[0]}`,
      );
    } catch (err: any) {
      toast.error(err?.message || 'Could not export to Excel');
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCreditNote(deleteTarget.ID);
      onDeleted(deleteTarget.ID);
      toast.success(`${deleteTarget.ID} deleted`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete');
    } finally {
      setDeleting(false);
    }
  };

  const grouped = !sort; // month headers only in the default order
  const colCount = 5 + (admin ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Credit Notes</h1>
        <div className="self-start sm:self-auto flex items-center gap-2">
          <span className="px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
            <span className="text-slate-400 mr-1">{filtered.length} ·</span>AED {formatAmount(total)}
          </span>
          <button
            onClick={() => void exportExcel()}
            disabled={exporting || filtered.length === 0}
            title="Export to Excel"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Search (dates / user: the Filters icon in the sidebar) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Search number, description, amount…"
            dir="auto"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/25"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1F3864] text-[11px] font-black uppercase tracking-[0.15em] text-white text-center">
                <th className="py-4 px-3">Credit Note No.</th>
                <th className="py-4 px-3">Date</th>
                <th className="py-4 px-3">Description</th>
                <th className="py-4 px-3">Amount (AED)</th>
                {admin && <th className="py-4 px-3">Created By</th>}
                <th className="py-4 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <NoData isTable colSpan={colCount} title={notes.length ? 'NO MATCHING CREDIT NOTES' : 'NO CREDIT NOTES YET'} />
              ) : (
                rows.map((n, i) => {
                  const mk = monthKey(n.NOTE_DATE);
                  const prev = rows[i - 1];
                  const newMonth = grouped && (!prev || monthKey(prev.NOTE_DATE) !== mk);
                  const mt = groupTotals.get(mk);
                  return (
                    <Fragment key={n.ID}>
                      {newMonth && (
                        <tr className="bg-slate-100/80">
                          <td colSpan={colCount} className="py-2.5 px-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-black text-[#1F3864] uppercase tracking-wide text-xs">{monthLabel(mk)}</span>
                              <span className="text-xs font-bold text-slate-600">
                                <span className="text-slate-400 mr-1">{mt?.count} ·</span>AED {formatAmount(mt?.amount || 0)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className="text-center hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-black text-[#1F3864] whitespace-nowrap">{n.ID}</td>
                        <td className="py-3 px-3 font-semibold text-slate-600 whitespace-nowrap">{formatDate(n.NOTE_DATE)}</td>
                        <td className="py-3 px-3 max-w-[380px]">
                          <p className="font-bold text-slate-800 truncate" dir="auto" title={n.LINES.map((l) => l.description).join(' · ')}>
                            {n.LINES[0]?.description || '—'}
                          </p>
                          {n.LINES.length > 1 && <p className="text-[11px] font-semibold text-slate-400">+ {n.LINES.length - 1} more line{n.LINES.length > 2 ? 's' : ''}</p>}
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">{formatAmount(n.TOTAL)}</td>
                        {admin && <td className="py-3 px-3 text-slate-600 font-semibold whitespace-nowrap">{n.CREATED_BY_NAME || n.CREATED_BY}</td>}
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => void pdf(n)}
                              disabled={pdfId === n.ID}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                              title="Download PDF"
                            >
                              {pdfId === n.ID ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            </button>
                            {canEdit && (
                              <button onClick={() => onEdit(n)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#1F3864] hover:bg-slate-100" title="Edit">
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {admin && (
                              <button onClick={() => setDeleteTarget(n)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm font-semibold text-slate-500">
            <span>
              Page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-9 px-3 rounded-lg border border-slate-200 disabled:opacity-40">
                Previous
              </button>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="h-9 px-3 rounded-lg border border-slate-200 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters modal */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onCloseFilters}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-[#0a0f1d] text-[#D4AF37] flex items-center justify-between rounded-t-3xl">
              <h3 className="text-base font-black tracking-wide">Filters</h3>
              <button onClick={onCloseFilters} className="p-1.5 rounded-lg hover:bg-white/10" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">From date</label>
                  <input type="date" value={draft.dateFrom} onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">To date</label>
                  <input type="date" value={draft.dateTo} onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Sort rows by</label>
                <FilterSelect value={draft.sort || ''} onChange={(v) => setDraft({ ...draft, sort: v })} options={SORT_OPTIONS} />
              </div>
              {admin && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Created by</label>
                  <FilterSelect value={draft.user} onChange={(v) => setDraft({ ...draft, user: v })} options={[{ value: '', label: 'All users' }, ...users.map((u) => ({ value: u, label: u }))]} />
                </div>
              )}
            </div>
            <div className="px-6 pb-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onFiltersChange({ ...NO_FILTERS, search });
                  onCloseFilters();
                }}
                className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Clear all
              </button>
              <button
                onClick={() => {
                  onFiltersChange({ ...draft, search });
                  onCloseFilters();
                }}
                className="h-11 rounded-xl bg-black text-[#C4A052] text-sm font-bold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.ID || ''}?`}
        message={
          deleteTarget ? (
            <>
              AED {formatAmount(deleteTarget.TOTAL)} · {formatDate(deleteTarget.NOTE_DATE)}
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
