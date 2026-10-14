'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Pencil, Search, Trash2, X } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import ConfirmDialog from './ConfirmDialog';
import { deleteTransferRequest } from '../Service/TransferService';
import { generateTransferPdf } from '../Utils/TransferPdf';
import {
  TRANSFER_TYPES,
  formatAmount,
  formatDate,
  formatIban,
  round2,
  type TransferBank,
  type TransferBeneficiary,
  type TransferRequest,
  type TransferType,
} from '../Utils/TransferTypes';

const PAGE_SIZE = 50;
type TypeFilter = 'ALL' | 'INTERNAL' | 'IC';

interface RequestsTabProps {
  requests: TransferRequest[];
  banks: TransferBank[];
  beneficiaries: TransferBeneficiary[];
  viewAll: boolean;
  canEdit: boolean;
  onEdit: (r: TransferRequest) => void;
  onDeleted: (id: string) => void;
}

const TYPE_BADGE: Record<TransferType, string> = {
  INTERNAL: 'bg-slate-100 text-slate-700',
  AIN_TO_DUBAI: 'bg-blue-50 text-blue-700',
  DUBAI_TO_AIN: 'bg-violet-50 text-violet-700',
};

export default function RequestsTab({ requests, banks, beneficiaries, viewAll, canEdit, onEdit, onDeleted }: RequestsTabProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransferRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const bankById = useMemo(() => new Map(banks.map((b) => [b.ID, b])), [banks]);
  const benById = useMemo(() => new Map(beneficiaries.map((b) => [b.ID, b])), [beneficiaries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qNoSpace = q.replace(/\s/g, '');
    return requests.filter((r) => {
      if (typeFilter === 'INTERNAL' && r.TRANSFER_TYPE !== 'INTERNAL') return false;
      if (typeFilter === 'IC' && r.TRANSFER_TYPE === 'INTERNAL') return false;
      if (dateFrom && r.REQUEST_DATE < dateFrom) return false;
      if (dateTo && r.REQUEST_DATE > dateTo) return false;
      if (!q) return true;
      const b = benById.get(r.BENEFICIARY_ID);
      return (
        r.REQUEST_NO.toLowerCase().includes(q) ||
        String(b?.NAME || '').toLowerCase().includes(q) ||
        String(b?.IBAN || '').toLowerCase().includes(qNoSpace) ||
        String(b?.ACCOUNT_NO || '').toLowerCase().includes(q) ||
        r.REASON.toLowerCase().includes(q) ||
        String(r.CREATED_BY_NAME || '').toLowerCase().includes(q) ||
        formatAmount(r.AMOUNT).includes(q)
      );
    });
  }, [requests, search, typeFilter, dateFrom, dateTo, benById]);

  // totals per currency
  const totals = useMemo(() => {
    const m = new Map<string, { count: number; amount: number }>();
    for (const r of filtered) {
      const t = m.get(r.CURRENCY) || { count: 0, amount: 0 };
      t.count++;
      t.amount = round2(t.amount + r.AMOUNT);
      m.set(r.CURRENCY, t);
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] === 'AED' ? -1 : b[0] === 'AED' ? 1 : a[0].localeCompare(b[0])));
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(1), [search, typeFilter, dateFrom, dateTo]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtersActive = !!(search || dateFrom || dateTo || typeFilter !== 'ALL');

  const printPdf = async (r: TransferRequest) => {
    setPdfId(r.ID);
    try {
      const b = benById.get(r.BENEFICIARY_ID) || null;
      await generateTransferPdf({
        request: r,
        beneficiary: b,
        beneficiaryBank: b?.BANK_ID ? bankById.get(b.BANK_ID) || null : null,
        transferBank: r.BANK_ID ? bankById.get(r.BANK_ID) || null : null,
      });
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
      await deleteTransferRequest(deleteTarget.ID);
      onDeleted(deleteTarget.ID);
      toast.success(`${deleteTarget.REQUEST_NO} deleted`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete the request');
    } finally {
      setDeleting(false);
    }
  };

  const colCount = 8 + (viewAll ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">{viewAll ? 'All Requests' : 'My Requests'}</h1>
        <div className="flex flex-wrap gap-2">
          {totals.map(([cur, t]) => (
            <span key={cur} className="px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
              <span className="text-slate-400 mr-1">{t.count} ·</span>
              {cur} {formatAmount(t.amount)}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search request no., beneficiary, IBAN, reason, amount…"
            dir="auto"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(
            [
              ['ALL', 'All'],
              ['INTERNAL', 'Internal'],
              ['IC', 'Al Ain ↔ Dubai'],
            ] as [TypeFilter, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTypeFilter(v)}
              className={`px-4 h-9 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${typeFilter === v ? 'bg-[#0a0f1d] text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {l}
            </button>
          ))}
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
              setTypeFilter('ALL');
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
              <tr className="bg-[#0a0f1d] text-[11px] font-black uppercase tracking-[0.15em] text-[#D4AF37] text-center">
                <th className="py-4 px-3">Request No.</th>
                <th className="py-4 px-3">Date</th>
                <th className="py-4 px-3">Type</th>
                <th className="py-4 px-3">Beneficiary</th>
                <th className="py-4 px-3">Bank</th>
                <th className="py-4 px-3">Amount</th>
                <th className="py-4 px-3">Reason</th>
                {viewAll && <th className="py-4 px-3">Created By</th>}
                <th className="py-4 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pageRows.length === 0 ? (
                <NoData isTable colSpan={colCount} title={requests.length ? 'NO MATCHING REQUESTS' : 'NO REQUESTS YET'} />
              ) : (
                pageRows.map((r) => {
                  const b = benById.get(r.BENEFICIARY_ID);
                  const bankName = r.TRANSFER_TYPE === 'INTERNAL' ? bankById.get(r.BANK_ID || '')?.NAME : b?.BANK_ID ? bankById.get(b.BANK_ID)?.NAME : '';
                  return (
                    <tr key={r.ID} className="text-center hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">{r.REQUEST_NO}</td>
                      <td className="py-3 px-3 font-semibold text-slate-600 whitespace-nowrap">{formatDate(r.REQUEST_DATE)}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${TYPE_BADGE[r.TRANSFER_TYPE]}`}>
                          {TRANSFER_TYPES.find((t) => t.value === r.TRANSFER_TYPE)?.short}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[260px]">
                        <p className="font-bold text-slate-800 truncate" dir="auto" title={b?.NAME}>
                          {b?.NAME || '—'}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400 truncate tracking-wide">{b?.IBAN ? formatIban(b.IBAN) : b?.ACCOUNT_NO || ''}</p>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-semibold max-w-[180px] truncate" dir="auto" title={bankName || ''}>
                        {bankName || '—'}
                      </td>
                      <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">
                        <span className="text-slate-400 text-xs mr-1">{r.CURRENCY}</span>
                        {formatAmount(r.AMOUNT)}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-[240px] truncate" dir="auto" title={r.REASON}>
                        {r.REASON}
                      </td>
                      {viewAll && <td className="py-3 px-3 text-slate-600 font-semibold whitespace-nowrap">{r.CREATED_BY_NAME || '—'}</td>}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => void printPdf(r)}
                            disabled={pdfId === r.ID}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                            title="Print PDF"
                          >
                            {pdfId === r.ID ? (
                              <span className="block w-4 h-4 rounded-full border-2 border-current border-b-transparent border-l-transparent animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </button>
                          {canEdit && (
                            <button onClick={() => onEdit(r)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => setDeleteTarget(r)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
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

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.REQUEST_NO || ''}?`}
        message={
          deleteTarget ? (
            <>
              {benById.get(deleteTarget.BENEFICIARY_ID)?.NAME} · {deleteTarget.CURRENCY} {formatAmount(deleteTarget.AMOUNT)}
              <span className="block mt-2 text-xs text-slate-400">The serial number will not be reused.</span>
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
