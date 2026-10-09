'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, Edit2, FileText, Loader2, Printer, RefreshCw, Scale, Search, Trash2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { deleteVoucher, getVoucherSignature, listVouchers } from '../Service/cash_voucher_service';
import { formatAED, type CashVoucher, type VoucherType } from '../Utils/voucherTypes';
import { generateVoucherPdf } from '../Utils/VoucherPdf';
import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import NoData from '@/app/Components/DataState/NoDataTab';

type Props = {
  canEdit: { IN: boolean; OUT: boolean };
  currentUserName: string;
  onEdit: (v: CashVoucher) => void;
  refreshTrigger: number;
};

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

function fmtDate(d: string) {
  const p = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  return Number.isNaN(p.getTime()) ? d : p.toLocaleDateString('en-GB');
}

export default function VouchersRegister({ canEdit, currentUserName, onEdit, refreshTrigger }: Props) {
  const [rows, setRows] = useState<CashVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<VoucherType | 'ALL'>('ALL');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CashVoucher | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setRows(await listVouchers({ type, from: from || undefined, to: to || undefined }));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load vouchers');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [type, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (refreshTrigger > 0) void load(true);
  }, [refreshTrigger, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((v) =>
      [v.ID, v.PARTY, v.VIA, v.DESCRIPTION, v.REFERENCE, ...(v.LINES || []).flatMap((l) => [l.ref, l.party])]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;
    filtered.forEach((v) => (v.TYPE === 'IN' ? (cashIn += v.AMOUNT) : (cashOut += v.AMOUNT)));
    return { cashIn, cashOut, net: cashIn - cashOut };
  }, [filtered]);

  const printVoucher = async (v: CashVoucher) => {
    setBusyId(v.ID);
    try {
      const signature = await getVoucherSignature(v.ID).catch(() => null);
      await generateVoucherPdf(v, { signature, printedBy: currentUserName });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create the PDF');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusyId(toDelete.ID);
    try {
      await deleteVoucher(toDelete.ID);
      setRows((prev) => prev.filter((r) => r.ID !== toDelete.ID));
      toast.success(`${toDelete.ID} deleted`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    } finally {
      setBusyId(null);
      setToDelete(null);
    }
  };

  const exportExcel = async () => {
    if (!filtered.length) return toast.error('Nothing to export');
    await exportStyledExcel(
      filtered.map((v) => ({
        'Voucher No.': v.ID,
        Date: fmtDate(v.DATE),
        Type: v.TYPE === 'IN' ? 'Cash In' : 'Cash Out',
        'Received From / Paid To': v.PARTY,
        'Delivered / Collected By': v.VIA || '',
        Method: v.PAYMENT_METHOD,
        Reference: v.REFERENCE || '',
        'Cash In': v.TYPE === 'IN' ? v.AMOUNT : 0,
        'Cash Out': v.TYPE === 'OUT' ? v.AMOUNT : 0,
        'Created By': v.CREATED_BY || '',
      })),
      `Cash_Vouchers_${from || 'all'}_${to || 'today'}.xlsx`,
      { sheetName: 'Vouchers', numericColumns: ['Cash In', 'Cash Out'] }
    );
  };

  const kpi = (title: string, value: number, Icon: any, tone: string) => (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{title}</p>
        <p className="text-xl font-black tabular-nums text-slate-900">{formatAED(value)}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Vouchers Register
          </h1>
          <div className="mt-2 h-1 w-16 rounded-full bg-[#D4AF37]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {kpi('Cash In', totals.cashIn, ArrowDownLeft, 'bg-emerald-50 text-emerald-600')}
        {kpi('Cash Out', totals.cashOut, ArrowUpRight, 'bg-rose-50 text-rose-600')}
        {kpi('Net', totals.net, Scale, 'bg-[#0f0f0f] text-[#D4AF37]')}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex rounded-xl border border-slate-200 p-1">
          {(['ALL', 'IN', 'OUT'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${type === t ? 'bg-[#0f0f0f] text-[#D4AF37]' : 'text-slate-500 hover:text-slate-900'}`}>
              {t === 'ALL' ? 'All' : t === 'IN' ? 'Cash In' : 'Cash Out'}
            </button>
          ))}
        </div>
        <label className="text-xs font-bold text-slate-500">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900" />
        </label>
        <label className="text-xs font-bold text-slate-500">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900" />
        </label>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number, name, invoice…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#D4AF37]" dir="auto" />
        </div>
        <button onClick={() => void exportExcel()} title="Export to Excel" className="flex items-center justify-center rounded-lg bg-emerald-600 p-2.5 text-white hover:bg-emerald-700">
          <Download className="h-5 w-5" />
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#0f0f0f] text-[11px] font-black uppercase tracking-wider text-[#D4AF37]">
            <tr>
              <th className="px-4 py-3 text-center">Voucher</th>
              <th className="px-4 py-3 text-center">Date</th>
              <th className="px-4 py-3 text-center">Received From / Paid To</th>
              <th className="px-4 py-3 text-center">Method</th>
              <th className="px-4 py-3 text-center">Amount</th>
              <th className="w-32 px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-16 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
            ) : filtered.length === 0 ? (
              <NoData isTable={true} colSpan={6} title="NO VOUCHERS FOUND" message="There are no cash vouchers matching your filters in this period." />
            ) : (
              filtered.map((v) => {
                const editable = canEdit[v.TYPE];
                return (
                  <tr key={v.ID} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${v.TYPE === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {v.TYPE === 'IN' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </span>
                        <span className="font-black text-slate-900">{v.ID}</span>
                        {v.LEGACY_SOURCE && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">old</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-600">{fmtDate(v.DATE)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="font-bold text-slate-900" dir="auto">{v.PARTY}</div>
                      {v.VIA && <div className="mx-auto max-w-md truncate text-xs text-slate-400" dir="auto">{v.VIA}</div>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-500">{v.PAYMENT_METHOD}</td>
                    <td className={`px-4 py-3 text-center font-black tabular-nums ${v.TYPE === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {v.TYPE === 'IN' ? '+' : '−'} {v.AMOUNT.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => void printVoucher(v)} disabled={busyId === v.ID} title="Download PDF" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                          {busyId === v.ID ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        </button>
                        {editable && (
                          <>
                            <button onClick={() => onEdit(v)} title="Edit" className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => setToDelete(v)} title="Delete" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                          </>
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

      {toDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setToDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-900">Delete {toDelete.ID}?</h3>
            <p className="mt-1 text-sm text-slate-500" dir="auto">{toDelete.PARTY} · {formatAED(toDelete.AMOUNT)}. This cannot be undone.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setToDelete(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => void confirmDelete()} disabled={busyId === toDelete.ID} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition">
                {busyId === toDelete.ID && <Loader2 className="h-4 w-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
