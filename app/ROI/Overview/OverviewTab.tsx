'use client';

// Overview = the input form only: one ROW per customer, many rows saved together.
// row = customer + salesperson + month + support amount

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { UseRoi } from '../Context/RoiContext';
import { AddSupports, ListCustomerOptions } from '../Service/RoiService';
import { DefaultMonth } from '../Utils/RoiCalc';
import type { CustomerOption, SalespersonOption } from '../Utils/Types';
import SearchSelect, { type SelectOption } from '../Utils/SearchSelect';
import BenefitDialog from '../Utils/BenefitDialog';
import { money } from '../Utils/Mini';

type Row = { key: number; customerId: string; salespersonId: string; month: string; amount: string; benefit: string };

const MONTH_OK = /^\d{4}-(0[1-9]|1[0-2])$/;
// the customer box is wider; salesperson / month / amount are equal; then the benefit and delete buttons
const GRID = 'lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_40px_40px]';
let nextKey = 1;
const blankRow = (month: string): Row => ({ key: nextKey++, customerId: '', salespersonId: '', month, amount: '', benefit: '' });

const LABEL = 'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400';

export default function OverviewTab() {
  const { refresh } = UseRoi();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [salespersons, setSalespersons] = useState<SalespersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>(() => [blankRow(DefaultMonth())]);
  const [saving, setSaving] = useState(false);
  const [benefitKey, setBenefitKey] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    ListCustomerOptions()
      .then((res) => {
        if (cancelled) return;
        setCustomers(res.customers);
        setSalespersons(res.salespersons);
      })
      .catch((e) => toast.error(e?.message || 'Failed to load customers'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const customerOptions = useMemo<SelectOption[]>(
    () => customers.map((o) => ({ id: o.id, label: o.name, sub: `${o.id}${o.city ? ` • ${o.city}` : ''}` })),
    [customers],
  );
  const salespersonOptions = useMemo<SelectOption[]>(() => salespersons.map((p) => ({ id: p.id, label: p.name })), [salespersons]);

  const update = (key: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((list) => [...list, blankRow(list[list.length - 1]?.month || DefaultMonth())]);
  const removeRow = (key: number) => setRows((list) => (list.length > 1 ? list.filter((r) => r.key !== key) : [blankRow(list[0].month)]));

  // a row is "used" as soon as a customer or an amount is filled; fully empty rows are ignored on save
  const used = rows.filter((r) => r.customerId || r.amount);
  const rowProblem = (r: Row) =>
    !r.customerId ? 'Choose a customer' : !MONTH_OK.test(r.month) ? 'Choose the month' : !(Number(r.amount) > 0) ? 'Enter the amount' : '';
  const incomplete = used.filter((r) => rowProblem(r));
  const total = used.reduce((a, r) => a + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0);
  const canSave = used.length > 0 && incomplete.length === 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const res = await AddSupports(
      used.map((r) => ({ customerId: r.customerId, salespersonId: r.salespersonId, month: r.month, amount: Number(r.amount), notes: r.benefit })),
    );
    setSaving(false);
    if (res.success) {
      toast.success(`${res.count} customer${res.count > 1 ? 's' : ''} added`);
      // keep the last month so the next batch of the same month is quick to enter
      setRows([blankRow(used[used.length - 1].month)]);
      void refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="w-full">
      <section className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] overflow-visible">
        <div className="flex items-start gap-2.5 px-6 pt-5">
          <span className="w-1.5 h-5 rounded-full bg-[#D4AF37] mt-0.5 shrink-0" />
          <div>
            <h3 className="font-black text-slate-900 tracking-tight">Add Customers Support</h3>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {/* column titles (desktop) */}
          <div className={`hidden lg:grid ${GRID} gap-3 px-1`}>
            <span className={LABEL}>Customer</span>
            <span className={LABEL}>Salesperson</span>
            <span className={LABEL}>Month</span>
            <span className={LABEL}>Support (AED)</span>
            <span />
            <span />
          </div>

          {rows.map((r, i) => {
            const problem = used.includes(r) ? rowProblem(r) : '';
            return (
              <div
                key={r.key}
                className={`grid grid-cols-1 sm:grid-cols-2 ${GRID} gap-3 items-center rounded-xl p-3 lg:p-0 border lg:border-0 ${
                  problem ? 'border-red-200 bg-red-50/40 lg:bg-transparent' : 'border-slate-100 bg-slate-50/50 lg:bg-transparent'
                }`}
              >
                <div>
                  <span className={`${LABEL} lg:hidden block mb-1`}>Customer</span>
                  <SearchSelect
                    value={r.customerId}
                    loading={loading}
                    placeholder="Choose a customer"
                    searchPlaceholder="Type a customer name, id or city..."
                    emptyText="No customer found"
                    options={customerOptions}
                    onChange={(id) => {
                      // the support is grouped under the customer's salesperson (can be changed in the next box)
                      const c = customers.find((o) => o.id === id);
                      update(r.key, { customerId: id, ...(c?.salespersonId ? { salespersonId: c.salespersonId } : {}) });
                    }}
                  />
                </div>
                <div>
                  <span className={`${LABEL} lg:hidden block mb-1`}>Salesperson</span>
                  <SearchSelect
                    value={r.salespersonId}
                    loading={loading}
                    placeholder={r.customerId ? "Customer's salesperson" : 'Salesperson'}
                    searchPlaceholder="Type a salesperson name..."
                    emptyText="No salesperson found"
                    options={salespersonOptions}
                    onChange={(id) => update(r.key, { salespersonId: id })}
                  />
                </div>
                <div>
                  <span className={`${LABEL} lg:hidden block mb-1`}>Month</span>
                  <input
                    type="month"
                    value={r.month}
                    onChange={(e) => update(r.key, { month: e.target.value })}
                    className="w-full h-[52px] px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <span className={`${LABEL} lg:hidden block mb-1`}>Support (AED)</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={r.amount}
                    placeholder="e.g. 100"
                    onChange={(e) => update(r.key, { amount: e.target.value })}
                    onKeyDown={(e) => {
                      // Enter on the last row's amount opens the next row
                      if (e.key === 'Enter' && i === rows.length - 1 && Number(r.amount) > 0) addRow();
                    }}
                    className="w-full h-[52px] px-4 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2 lg:contents">
                  <button
                    type="button"
                    title={r.benefit ? 'Benefit from this customer (written)' : 'Benefit from this customer'}
                    onClick={() => setBenefitKey(r.key)}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-xl border transition-colors ${
                      r.benefit ? 'border-[#D4AF37] bg-amber-50 text-[#B8860B]' : 'border-slate-200 text-slate-400 hover:text-[#B8860B] hover:border-[#D4AF37]'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    {r.benefit ? <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#D4AF37] border-2 border-white" /> : null}
                  </button>
                  <button
                    type="button"
                    title="Remove row"
                    onClick={() => removeRow(r.key)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#D4AF37] text-[#B8860B] text-sm font-bold hover:bg-amber-50"
          >
            <Plus className="w-4 h-4" />
            Add row
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <span className="text-xs font-semibold text-slate-500">
            {used.length} customer{used.length === 1 ? '' : 's'} • total support{' '}
            <span className="font-mono text-slate-900">{money(total)}</span> AED
            {incomplete.length ? <span className="text-red-600"> • {incomplete.length} incomplete</span> : null}
          </span>
          <button
            onClick={() => void save()}
            disabled={!canSave}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white text-sm font-bold shadow-lg shadow-[#D4AF37]/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save {used.length > 1 ? `${used.length} customers` : 'customer'}
          </button>
        </div>
      </section>

      {benefitKey !== null ? (
        <BenefitDialog
          customerName={customers.find((c) => c.id === rows.find((r) => r.key === benefitKey)?.customerId)?.name || ''}
          value={rows.find((r) => r.key === benefitKey)?.benefit || ''}
          onSave={(text) => {
            update(benefitKey, { benefit: text });
            setBenefitKey(null);
          }}
          onClose={() => setBenefitKey(null)}
        />
      ) : null}
    </div>
  );
}
