'use client';

// The saved forms of one form: search, date range, download, edit (admin), delete (admin).

import { useMemo, useState } from 'react';
import { FileDown, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import ConfirmDialog from './ConfirmDialog';
import { deleteFormRecord } from './FormsArchiveService';
import { formatAmount, formatDate } from './FormsUtils';
import type { FormRecord } from './FormsArchiveTypes';

interface FormArchiveListProps {
  formId: string;
  records: FormRecord[];
  admin: boolean;
  canEdit: boolean;
  onEdit: (r: FormRecord) => void;
  onDeleted: (id: string) => void;
  onDownload?: (r: FormRecord) => Promise<void>;
  downloadLabel?: string;
}

const savedAt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};

export default function FormArchiveList({ formId, records, admin, canEdit, onEdit, onDeleted, onDownload, downloadLabel = 'Download PDF' }: FormArchiveListProps) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormRecord | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const d = r.DOC_DATE || r.CREATED_AT.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (!q) return true;
      return r.REF_NO.toLowerCase().includes(q) || r.TITLE.toLowerCase().includes(q) || (r.CREATED_BY_NAME || '').toLowerCase().includes(q) || (r.AMOUNT !== null && formatAmount(r.AMOUNT).includes(q));
    });
  }, [records, search, dateFrom, dateTo]);
  const hasAmount = records.some((r) => r.AMOUNT !== null);
  const cols = 5 + (hasAmount ? 1 : 0) + (admin ? 1 : 0);

  const download = async (r: FormRecord) => {
    if (!onDownload) return;
    setBusy(`dl-${r.ID}`);
    try {
      await onDownload(r);
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
      await deleteFormRecord(formId, deleteTarget.ID);
      onDeleted(deleteTarget.ID);
      toast.success(`${deleteTarget.REF_NO} deleted`);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number, title, amount…" dir="auto" className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
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

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black text-[11px] font-black uppercase tracking-[0.15em] text-white text-center border-b-2 border-[#C4A052]">
                <th className="py-4 px-3 w-12">#</th>
                <th className="py-4 px-3">Number</th>
                <th className="py-4 px-3">Date</th>
                <th className="py-4 px-3">Title</th>
                {hasAmount && <th className="py-4 px-3">Amount (AED)</th>}
                {admin && <th className="py-4 px-3">Saved By</th>}
                <th className="py-4 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, i) => (
                <tr key={r.ID} className="text-center align-middle hover:bg-slate-50/60">
                  <td className="py-3 px-3 text-xs font-bold text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">{r.REF_NO}</td>
                  <td className="py-3 px-3 tabular-nums whitespace-nowrap">{r.DOC_DATE ? formatDate(r.DOC_DATE) : '-'}</td>
                  <td className="py-3 px-3 text-slate-700 max-w-[380px] truncate" dir="auto" title={r.TITLE}>{r.TITLE || '-'}</td>
                  {hasAmount && <td className="py-3 px-3 font-bold tabular-nums">{r.AMOUNT !== null ? formatAmount(r.AMOUNT) : '-'}</td>}
                  {admin && (
                    <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                      <span className="font-bold text-slate-700">{r.CREATED_BY_NAME || '-'}</span>
                      <span className="block text-[11px] text-slate-400">{savedAt(r.CREATED_AT)}</span>
                    </td>
                  )}
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1">
                      {onDownload && (
                        <button onClick={() => void download(r)} disabled={!!busy} className="w-9 h-9 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50" title={downloadLabel}>
                          {busy === `dl-${r.ID}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => onEdit(r)} className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {admin && (
                        <button onClick={() => setDeleteTarget(r)} className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <NoData isTable colSpan={cols} title={records.length ? 'NO MATCHING FORMS' : 'NO SAVED FORMS YET'} />}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.REF_NO || ''}?`}
        message={deleteTarget ? <>{deleteTarget.TITLE}<br />This can&apos;t be undone.</> : null}
        busy={busy === `del-${deleteTarget?.ID}`}
        onConfirm={() => void remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
