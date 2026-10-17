'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Search, Trash2 } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { UseRoi } from '../Context/RoiContext';
import { DeleteSupport } from '../Service/RoiService';
import { FullMonthLabel, PeriodLabel } from '../Utils/RoiCalc';
import type { RoiResult, SupportRecord } from '../Utils/Types';
import ToneBadge from '../Utils/ToneBadge';
import ConfirmDialog from '../Utils/ConfirmDialog';
import AddSupportModal from '../Utils/AddSupportModal';
import { PdfIconButton, Stat, money, shortMoney } from '../Utils/Mini';

export default function CustomersTab() {
  const { results, months, refresh } = UseRoi();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [confirming, setConfirming] = useState<RoiResult | null>(null);
  const [editing, setEditing] = useState<SupportRecord | null>(null);

  // results are already A-Z by customer name
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results;
    return results.filter((r) =>
      `${r.support.customerName} ${r.support.mainName} ${r.support.customerId} ${r.support.city} ${r.support.salespersonName}`.toLowerCase().includes(q),
    );
  }, [results, query]);

  const open = results.find((r) => r.support.customerId === openId);

  // this customer's months (newest first): one card each, with PDF + delete
  const customerMonths: RoiResult[] = open
    ? months.flatMap((g) => g.results.filter((r) => r.support.customerId === open.support.customerId))
    : [];

  const removeMonth = async (r: RoiResult) => {
    const entries = r.months[0]?.entries || [];
    if (!entries.length) {
      setConfirming(null);
      return;
    }
    setBusyKey(r.support.id);
    let failed = '';
    for (const e of entries) {
      const res = await DeleteSupport(e.id);
      if (!res.success) {
        failed = res.error;
        break;
      }
    }
    setBusyKey('');
    setConfirming(null);
    if (failed) toast.error(failed);
    else toast.success('Support deleted');
    void refresh();
  };

  if (open) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setOpenId('')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:text-[#B8860B] hover:border-[#D4AF37]"
          >
            <ArrowLeft className="w-4 h-4" />
            Customers
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 text-right">
              <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{open.support.customerName}</h3>
              <p className="text-xs font-semibold text-slate-400 truncate">
                {open.support.salespersonName}
                {open.support.city ? ` • ${open.support.city}` : ''}
              </p>
            </div>
            <PdfIconButton results={[open]} title="Download PDF - all months of this customer" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {customerMonths.map((r) => (
            <div
              key={r.support.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] flex flex-col gap-4 min-w-0"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-slate-900 text-lg tracking-tight">{FullMonthLabel(r.support.startMonth)}</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <ToneBadge tone={r.assessment.tone}>{r.assessment.label}</ToneBadge>
                  </div>
                </div>
                <PdfIconButton
                  results={[r]}
                  fileName={`ROI_${r.support.customerName}_${r.support.startMonth}`}
                  title={`Download PDF - ${FullMonthLabel(r.support.startMonth)}`}
                />
                {(r.months[0]?.entries || []).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    title={`Edit ${money(e.amount)}`}
                    onClick={() => setEditing(e)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-[#B8860B] hover:border-[#D4AF37] hover:bg-amber-50 shrink-0 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                ))}
                <button
                  type="button"
                  title="Delete this month's support"
                  disabled={busyKey === r.support.id}
                  onClick={() => setConfirming(r)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-40 shrink-0 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <Stat label="Support" value={money(r.totalSupport)} />
                <Stat label="Net sales" value={shortMoney(r.net)} />
              </div>
            </div>
          ))}
        </div>

        {confirming ? (
          <ConfirmDialog
            title="Do you want to delete this support?"
            busy={busyKey === confirming.support.id}
            onConfirm={() => void removeMonth(confirming)}
            onCancel={() => setConfirming(null)}
          />
        ) : null}

        {editing ? (
          <AddSupportModal
            editing={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void refresh();
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* search */}
      <div className="flex">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a customer, salesperson or city..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
      </div>

      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[45vh] gap-4">
          <NoData title="NO CUSTOMERS YET - ADD ONE FROM THE OVERVIEW TAB" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400 font-medium">No customer matches "{query}"</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <div
              key={r.support.id}
              onClick={() => setOpenId(r.support.customerId)}
              className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] hover:border-[#D4AF37] hover:shadow-lg cursor-pointer transition-all flex flex-col gap-4 min-w-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center font-black shrink-0">
                  {r.support.customerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-slate-900 leading-snug line-clamp-2" title={r.support.customerName}>
                    {r.support.customerName}
                  </h3>
                  <p className="text-xs font-semibold text-slate-400">
                    {r.monthsCount} month{r.monthsCount > 1 ? 's' : ''}
                  </p>
                </div>
                <PdfIconButton results={[r]} title="Download PDF (details)" />
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
