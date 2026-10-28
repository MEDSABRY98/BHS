'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import ConfirmDialog from './ConfirmDialog';
import { deleteCreditNote } from '../Service/CreditNoteService';
import { generateCreditNotePdf } from '../Utils/CreditNotePdf';
import { formatAmount, formatDate, round2, type CreditNote } from '../Utils/CreditNoteTypes';

const PAGE_SIZE = 50;

const userOf = (n: { CREATED_BY_NAME?: string; CREATED_BY: string }) => n.CREATED_BY_NAME || n.CREATED_BY || '—';
const monthKey = (d: string) => String(d || '').slice(0, 7); // yyyy-mm
const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—';
};

interface CreditNotesListProps {
  notes: CreditNote[];
  admin: boolean; // sees all, edits & deletes
  canEdit: boolean;
  onEdit: (n: CreditNote) => void;
  onDeleted: (id: string) => void;
}

export default function CreditNotesList({ notes, admin, canEdit, onEdit, onDeleted }: CreditNotesListProps) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreditNote | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (dateFrom && n.NOTE_DATE < dateFrom) return false;
      if (dateTo && n.NOTE_DATE > dateTo) return false;
      if (!q) return true;
      return (
        n.ID.toLowerCase().includes(q) ||
        n.BODY_TEXT.toLowerCase().includes(q) ||
        String(n.CREATED_BY_NAME || '').toLowerCase().includes(q) ||
        formatAmount(n.TOTAL).includes(q) ||
        n.LINES.some((l) => l.description.toLowerCase().includes(q))
      );
    });
  }, [notes, search, dateFrom, dateTo]);

  // grouped by month (newest first), then by user
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          monthKey(b.NOTE_DATE).localeCompare(monthKey(a.NOTE_DATE)) ||
          userOf(a).localeCompare(userOf(b)) ||
          b.NOTE_DATE.localeCompare(a.NOTE_DATE) ||
          b.ID.localeCompare(a.ID),
      ),
    [filtered],
  );
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
  useEffect(() => setPage(1), [search, dateFrom, dateTo]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtersActive = !!(search || dateFrom || dateTo);

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

  const colCount = 5 + (admin ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Credit Notes</h1>
        <span className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
          <span className="text-slate-400 mr-1">{filtered.length} ·</span>AED {formatAmount(total)}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, description, amount…"
            dir="auto"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/25"
          />
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="From date" />
          <span className="text-slate-300">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="To date" />
        </div>
        {filtersActive && (
          <button
            onClick={() => {
              setSearch('');
              setDateFrom('');
              setDateTo('');
            }}
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
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
                  const newMonth = !prev || monthKey(prev.NOTE_DATE) !== mk;
                  const newUser = newMonth || userOf(prev) !== userOf(n);
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
                      {newUser && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={colCount} className="py-2 px-4 pl-8">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-slate-700 text-xs" dir="auto">{userOf(n)}</span>
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
