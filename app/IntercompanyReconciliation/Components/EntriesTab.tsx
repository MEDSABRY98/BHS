'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Plus,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import ExcelModal from './ExcelModal';
import AttachmentCell from './AttachmentCell';
import ConfirmDialog from './ConfirmDialog';
import EditEntryModal from './EditEntryModal';
import LabelModal from './LabelModal';
import StatusDropdown, { type StatusOption } from './StatusDropdown';
import AccountDropdown, { ALL_ACCOUNTS, NO_ACCOUNT, type AccountOption } from './AccountDropdown';
import { deleteIntercompanyEntries, deleteIntercompanyEntry } from '../Service/IntercompanyService';
import { exportIntercompanyPdf } from '../Utils/IntercompanyPdf';
import {
  formatAmount,
  entryRef,
  formatDate,
  round2,
  type IntercompanyEntry,
  type IntercompanyPermissions,
} from '../Utils/IntercompanyTypes';

type StatusFilter = 'all' | 'unmatched' | 'missing-dubai' | 'missing-ain' | 'matched' | 'no-attachments' | 'with-attachments';

const PAGE_SIZE = 100;

const STATUS_OPTIONS: Omit<StatusOption<StatusFilter>, 'count'>[] = [
  { value: 'all', label: 'All lines', dot: 'bg-slate-400' },
  { value: 'unmatched', label: 'Unmatched', dot: 'bg-orange-500' },
  { value: 'missing-dubai', label: 'Missing Dubai No', dot: 'bg-amber-500' },
  { value: 'missing-ain', label: 'Missing Al Ain No', dot: 'bg-yellow-400' },
  { value: 'matched', label: 'Matched', dot: 'bg-emerald-500' },
  { value: 'no-attachments', label: 'No attachments', dot: 'bg-rose-500' },
  { value: 'with-attachments', label: 'With attachments', dot: 'bg-blue-500' },
];

function matchesStatus(e: IntercompanyEntry, status: StatusFilter): boolean {
  if (status === 'unmatched') return !e.DUBAI_ENTRY_NUMBER || !e.AIN_ENTRY_NUMBER;
  if (status === 'missing-dubai') return !e.DUBAI_ENTRY_NUMBER;
  if (status === 'missing-ain') return !e.AIN_ENTRY_NUMBER;
  if (status === 'matched') return !!e.DUBAI_ENTRY_NUMBER && !!e.AIN_ENTRY_NUMBER;
  if (status === 'no-attachments') return e.ATTACHMENTS_COUNT === 0;
  if (status === 'with-attachments') return e.ATTACHMENTS_COUNT > 0;
  return true;
}

interface EntriesTabProps {
  entries: IntercompanyEntry[];
  permissions: IntercompanyPermissions;
  onReload: () => Promise<void>;
  onEntryChanged: (entry: IntercompanyEntry) => void;
  onEntryAdded: (entry: IntercompanyEntry) => void;
  onEntryDeleted: (id: string) => void;
  onEntriesDeleted: (ids: string[]) => void;
  onAttachmentsCountChanged: (id: string, count: number) => void;
}

export default function EntriesTab({ entries, permissions, onReload, onEntryChanged, onEntryAdded, onEntryDeleted, onEntriesDeleted, onAttachmentsCountChanged }: EntriesTabProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [account, setAccount] = useState<string>(ALL_ACCOUNTS);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [editEntry, setEditEntry] = useState<IntercompanyEntry | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [labelEntry, setLabelEntry] = useState<IntercompanyEntry | null>(null);

  const [excelOpen, setExcelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IntercompanyEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search + dates
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (dateFrom && e.ENTRY_DATE < dateFrom) return false;
      if (dateTo && e.ENTRY_DATE > dateTo) return false;
      if (!q) return true;
      return (
        String(e.ACCOUNT_NAME || '').toLowerCase().includes(q) ||
        String(e.AIN_ENTRY_NUMBER || '').toLowerCase().includes(q) ||
        String(e.DUBAI_ENTRY_NUMBER || '').toLowerCase().includes(q) ||
        String(e.LABEL || '').toLowerCase().includes(q) ||
        formatAmount(e.DEBIT).includes(q) ||
        formatAmount(e.CREDIT).includes(q)
      );
    });
  }, [entries, search, dateFrom, dateTo]);

  // Account dropdown: counts based on search + dates
  const accountOptions = useMemo<AccountOption[]>(() => {
    const counts = new Map<string, number>();
    let none = 0;
    for (const e of searched) {
      if (e.ACCOUNT_NAME) counts.set(e.ACCOUNT_NAME, (counts.get(e.ACCOUNT_NAME) || 0) + 1);
      else none++;
    }
    const list: AccountOption[] = Array.from(counts, ([name, count]) => ({ value: name, label: name, count })).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
    );
    if (none) list.push({ value: NO_ACCOUNT, label: 'No account', count: none });
    if (account && !list.some((o) => o.value === account)) list.push({ value: account, label: account === NO_ACCOUNT ? 'No account' : account, count: 0 });
    return [{ value: ALL_ACCOUNTS, label: 'All accounts', count: searched.length }, ...list];
  }, [searched, account]);

  // Search + dates + account (the status dropdown counts are based on this)
  const byAccount = useMemo(
    () => (account ? searched.filter((e) => (account === NO_ACCOUNT ? !e.ACCOUNT_NAME : e.ACCOUNT_NAME === account)) : searched),
    [searched, account],
  );

  const filtered = useMemo(() => byAccount.filter((e) => matchesStatus(e, status)), [byAccount, status]);

  const statusOptions = useMemo<StatusOption<StatusFilter>[]>(
    () =>
      STATUS_OPTIONS.map((o) => ({
        ...o,
        count: o.value === 'all' ? byAccount.length : byAccount.filter((e) => matchesStatus(e, o.value)).length,
      })),
    [byAccount],
  );


  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let missing = 0;
    let noFiles = 0;
    for (const e of filtered) {
      debit += e.DEBIT;
      credit += e.CREDIT;
      if (!e.DUBAI_ENTRY_NUMBER || !e.AIN_ENTRY_NUMBER) missing++;
      if (e.ATTACHMENTS_COUNT === 0) noFiles++;
    }
    return { debit: round2(debit), credit: round2(credit), balance: round2(debit - credit), missing, noFiles };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(1), [search, status, account, dateFrom, dateTo]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filtersActive = !!(search || dateFrom || dateTo || account || status !== 'all');

  const exportPdf = async () => {
    if (!filtered.length) return;
    setPdfBusy(true);
    try {
      await exportIntercompanyPdf(filtered, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        filterLabel: [
          account ? `Account: ${account === NO_ACCOUNT ? 'No account' : account}` : '',
          status !== 'all' ? STATUS_OPTIONS.find((o) => o.value === status)?.label : '',
          search.trim() ? `Search: ${search.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' | ') || undefined,
      });
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteIntercompanyEntry(deleteTarget.ID);
      onEntryDeleted(deleteTarget.ID);
      toast.success('Line deleted');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete the line');
    } finally {
      setDeleting(false);
    }
  };

  const hasActions = permissions.edit || permissions.delete;
  const canSelect = permissions.delete;
  const colCount = 9 + (hasActions ? 1 : 0) + (canSelect ? 1 : 0);

  // Keep only lines that still exist
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(entries.map((e) => e.ID));
      const next = new Set(Array.from(prev).filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [entries]);

  const selectedRows = useMemo(() => entries.filter((e) => selected.has(e.ID)), [entries, selected]);
  const allShownSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.ID));
  const someShownSelected = !allShownSelected && filtered.some((e) => selected.has(e.ID));

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllShown = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) filtered.forEach((e) => next.delete(e.ID));
      else filtered.forEach((e) => next.add(e.ID));
      return next;
    });

  const confirmBulkDelete = async () => {
    const ids = selectedRows.map((e) => e.ID);
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      let done = 0;
      for (let i = 0; i < ids.length; i += 500) done += await deleteIntercompanyEntries(ids.slice(i, i + 500));
      onEntriesDeleted(ids);
      setSelected(new Set());
      setBulkOpen(false);
      toast.success(`${done} line(s) deleted`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete the lines');
      await onReload();
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Intercompany Entries</h1>
          <button
            onClick={() => setExcelOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/10 transition-all"
            title="Excel template / upload"
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>
          <button
            onClick={() => void exportPdf()}
            disabled={pdfBusy || filtered.length === 0}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/10 transition-all disabled:opacity-50"
            title="Export PDF"
          >
            {pdfBusy ? (
              <span className="block w-5 h-5 rounded-full border-2 border-white border-b-transparent border-l-transparent animate-spin" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </button>
          {permissions.edit && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0a0f1d] hover:bg-black text-[#D4AF37] shadow-lg shadow-black/10 transition-all"
              title="Add line"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-sm font-semibold text-slate-400">Al Ain ↔ Dubai</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card title="Lines" value={filtered.length.toLocaleString('en-US')} />
        <Card title="Total Debit" value={formatAmount(totals.debit)} tone="text-emerald-600" />
        <Card title="Total Credit" value={formatAmount(totals.credit)} tone="text-rose-600" />
        <Card title="Balance" value={formatAmount(totals.balance)} tone={totals.balance === 0 ? 'text-slate-900' : 'text-amber-600'} />
        <Card
          title="Unmatched"
          value={totals.missing.toLocaleString('en-US')}
          tone={totals.missing ? 'text-amber-600' : 'text-emerald-600'}
          onClick={() => setStatus(status === 'unmatched' ? 'all' : 'unmatched')}
          active={status === 'unmatched'}
        />
        <Card
          title="No Attachments"
          value={totals.noFiles.toLocaleString('en-US')}
          tone={totals.noFiles ? 'text-amber-600' : 'text-emerald-600'}
          onClick={() => setStatus(status === 'no-attachments' ? 'all' : 'no-attachments')}
          active={status === 'no-attachments'}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account, entry number, label, amount..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />
        </div>
        <AccountDropdown value={account} options={accountOptions} onChange={setAccount} />
        <StatusDropdown value={status} options={statusOptions} onChange={setStatus} />
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="From date" />
          <span className="text-slate-300">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="To date" />
        </div>
        {filtersActive && (
          <button
            onClick={() => {
              setSearch('');
              setStatus('all');
              setAccount(ALL_ACCOUNTS);
              setDateFrom('');
              setDateTo('');
            }}
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Selection bar */}
      {canSelect && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-[#0a0f1d] text-white shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="text-sm font-bold">
            <span className="text-[#D4AF37]">{selected.size.toLocaleString('en-US')}</span> line(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10">
              Clear
            </button>
            <button onClick={() => setBulkOpen(true)} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-bold flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0a0f1d] text-[11px] font-black uppercase tracking-[0.15em] text-[#D4AF37] text-center">
                {canSelect && (
                  <th className="py-4 pl-4 pr-1 w-10">
                    <Checkbox checked={allShownSelected} indeterminate={someShownSelected} onChange={toggleAllShown} title="Select all shown lines" />
                  </th>
                )}
                <th className="py-4 px-3">#</th>
                <th className="py-4 px-3">Date</th>
                <th className="py-4 px-3">Account</th>
                <th className="py-4 px-3">Al Ain Entry</th>
                <th className="py-4 px-3">Dubai Entry</th>
                <th className="py-4 px-3">Label</th>
                <th className="py-4 px-3">Debit</th>
                <th className="py-4 px-3">Credit</th>
                <th className="py-4 px-3">Attachments</th>
                {hasActions && <th className="py-4 px-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pageRows.length === 0 ? (
                <NoData isTable colSpan={colCount} title={entries.length ? 'NO MATCHING LINES' : 'NO ENTRIES YET'} message={entries.length ? undefined : 'Use the Excel button to upload the entries'} />
              ) : (
                pageRows.map((e, i) => {
                  return (
                    <tr
                      key={e.ID}
                      className={`text-center transition-colors ${
                        selected.has(e.ID) ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {canSelect && (
                        <td className="py-3 pl-4 pr-1">
                          <Checkbox checked={selected.has(e.ID)} onChange={() => toggleRow(e.ID)} />
                        </td>
                      )}
                      <td className="py-3 px-3 text-xs font-bold text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">{formatDate(e.ENTRY_DATE)}</td>
                      <td className="py-3 px-3 max-w-[220px]" dir="auto">
                        {e.ACCOUNT_NAME ? (
                          <span className="block truncate font-semibold text-slate-700" title={e.ACCOUNT_NAME}>{e.ACCOUNT_NAME}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {e.AIN_ENTRY_NUMBER ? (
                          <span className="font-bold text-slate-900">{e.AIN_ENTRY_NUMBER}</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-[11px] font-black uppercase tracking-wider">Missing</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {!e.DUBAI_ENTRY_NUMBER ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-[11px] font-black uppercase tracking-wider">Missing</span>
                        ) : (
                          <span className="font-bold text-slate-900">{e.DUBAI_ENTRY_NUMBER}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => setLabelEntry(e)}
                          className={`p-2 rounded-lg transition-colors ${e.LABEL ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50' : 'text-slate-300 hover:bg-slate-100'}`}
                          title={e.LABEL || 'No label'}
                        >
                          <AlertCircle className="w-5 h-5" />
                        </button>
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700 whitespace-nowrap">{e.DEBIT ? formatAmount(e.DEBIT) : <span className="text-slate-300">—</span>}</td>
                      <td className="py-3 px-3 font-bold text-rose-700 whitespace-nowrap">{e.CREDIT ? formatAmount(e.CREDIT) : <span className="text-slate-300">—</span>}</td>
                      <td className="py-3 px-3">
                        <AttachmentCell
                          entry={e}
                          canEdit={permissions.edit}
                          canDelete={permissions.delete}
                          onCountChanged={(count) => onAttachmentsCountChanged(e.ID, count)}
                        />
                      </td>
                      {hasActions && (
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            {permissions.edit && (
                              <button onClick={() => setEditEntry(e)} className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit line">
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {permissions.delete && (
                              <button onClick={() => setDeleteTarget(e)} className="p-2 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete line">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 text-center font-black">
                  <td colSpan={canSelect ? 7 : 6} />
                  <td className="py-3.5 px-3 text-emerald-700 whitespace-nowrap">{formatAmount(totals.debit)}</td>
                  <td className="py-3.5 px-3 text-rose-700 whitespace-nowrap">{formatAmount(totals.credit)}</td>
                  <td colSpan={hasActions ? 2 : 1} className="py-3.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                    Balance {formatAmount(totals.balance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm">
            <span className="text-slate-400 font-semibold">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString('en-US')}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-600">
                {page} / {pageCount}
              </span>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ExcelModal open={excelOpen} onClose={() => setExcelOpen(false)} entries={entries} filtered={filtered} canEdit={permissions.edit} onImported={onReload} />


      {editEntry && <EditEntryModal entry={editEntry} onClose={() => setEditEntry(null)} onSaved={onEntryChanged} />}
      {addOpen && <EditEntryModal onClose={() => setAddOpen(false)} onSaved={onEntryAdded} />}
      {labelEntry && <LabelModal entry={labelEntry} onClose={() => setLabelEntry(null)} />}

      <ConfirmDialog
        open={bulkOpen}
        title={`Delete ${selectedRows.length} line(s)?`}
        message={
          <>
            Total debit {formatAmount(round2(selectedRows.reduce((s, e) => s + e.DEBIT, 0)))} · credit{' '}
            {formatAmount(round2(selectedRows.reduce((s, e) => s + e.CREDIT, 0)))}
            {selectedRows.some((e) => e.ATTACHMENTS_COUNT > 0) && (
              <span className="block mt-2 font-bold text-red-600">
                Their {selectedRows.reduce((s, e) => s + e.ATTACHMENTS_COUNT, 0)} attachment(s) will be deleted too.
              </span>
            )}
          </>
        }
        busy={bulkDeleting}
        onConfirm={() => void confirmBulkDelete()}
        onCancel={() => setBulkOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this line?"
        message={
          deleteTarget ? (
            <>
              {formatDate(deleteTarget.ENTRY_DATE)} · {entryRef(deleteTarget)} · {formatAmount(deleteTarget.DEBIT || deleteTarget.CREDIT)}
              {deleteTarget.ATTACHMENTS_COUNT > 0 && (
                <span className="block mt-2 font-bold text-red-600">Its {deleteTarget.ATTACHMENTS_COUNT} attachment(s) will be deleted too.</span>
              )}
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

function Card({ title, value, tone = 'text-slate-900', onClick, active }: { title: string; value: string; tone?: string; onClick?: () => void; active?: boolean }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`text-left bg-white rounded-2xl p-5 border shadow-sm transition-all ${
        active ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-100'
      } ${onClick ? 'hover:-translate-y-0.5 cursor-pointer' : ''}`}
    >
      <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-1.5">{title}</p>
      <p className={`text-2xl font-black tracking-tight ${tone}`}>{value}</p>
    </Tag>
  );
}

function Checkbox({ checked, indeterminate = false, onChange, title }: { checked: boolean; indeterminate?: boolean; onChange: () => void; title?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      onClick={onChange}
      title={title}
      className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-colors ${
        checked || indeterminate ? 'bg-[#D4AF37] border-[#D4AF37]' : 'bg-white border-slate-300 hover:border-[#D4AF37]'
      }`}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-[#0a0f1d]" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M2 6.5l2.5 2.5L10 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {!checked && indeterminate && <span className="w-2 h-0.5 rounded bg-[#0a0f1d]" />}
    </button>
  );
}
