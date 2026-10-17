'use client';

// Add / edit a customer support (customer + monthly amount + period).

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { AddSupport, ListCustomerOptions, UpdateSupport } from '../Service/RoiService';
import { DefaultMonth } from './RoiCalc';
import type { CustomerOption, SalespersonOption, SupportRecord } from './Types';
import SearchSelect, { type SelectOption } from './SearchSelect';

export default function SupportForm({
  editing,
  onCancel,
  onSaved,
}: {
  editing: SupportRecord | null;
  /** shown as a Cancel button (modal); the inline Overview form has none */
  onCancel?: () => void;
  onSaved: () => void;
}) {
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [salespersons, setSalespersons] = useState<SalespersonOption[]>([]);
  const [salespersonId, setSalespersonId] = useState(editing?.salespersonId || '');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [customerId, setCustomerId] = useState(editing?.customerId || '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [month, setMonth] = useState(editing?.month || DefaultMonth());
  const [notes, setNotes] = useState(editing?.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ListCustomerOptions()
      .then((res) => {
        if (cancelled) return;
        setOptions(res.customers);
        setSalespersons(res.salespersons);
      })
      .catch((e) => toast.error(e?.message || 'Failed to load customers'))
      .finally(() => !cancelled && setLoadingOptions(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const customerOptions = useMemo<SelectOption[]>(
    () => options.map((o) => ({ id: o.id, label: o.name, sub: `${o.id}${o.city ? ` • ${o.city}` : ''}` })),
    [options],
  );
  const salespersonOptions = useMemo<SelectOption[]>(() => salespersons.map((p) => ({ id: p.id, label: p.name })), [salespersons]);

  const numeric = Number(amount);
  const problem = !customerId
    ? 'Choose a customer'
    : !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ? 'Choose the month of the support'
      : !(numeric > 0)
        ? 'Enter the support amount'
        : '';

  const save = async () => {
    if (problem || saving) return;
    setSaving(true);
    const input = { customerId, salespersonId, month, amount: numeric, notes };
    const res = editing ? await UpdateSupport(editing.id, input) : await AddSupport(input);
    setSaving(false);
    if (res.success) {
      toast.success(editing ? 'Support updated' : 'Customer added');
      if (!editing) {
        setCustomerId('');
        setSalespersonId('');
        setAmount('');
        setNotes('');
      }
      onSaved();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div>
        <div className="p-6 space-y-4">
          {/* customer */}
          <SearchSelect
            label="Customer"
            value={customerId}
            loading={loadingOptions}
            placeholder="Choose a customer"
            searchPlaceholder="Type a customer name, id or city..."
            emptyText="No customer found"
            fallbackLabel={editing?.customerName}
            options={customerOptions}
            onChange={(id) => {
              setCustomerId(id);
              // the support is grouped under the customer's salesperson (can be changed below)
              const c = options.find((o) => o.id === id);
              if (c?.salespersonId) setSalespersonId(c.salespersonId);
            }}
          />

          {/* salesperson */}
          <SearchSelect
            label="Salesperson"
            value={salespersonId}
            loading={loadingOptions}
            placeholder={customerId ? "Customer's salesperson" : 'Choose the customer first'}
            searchPlaceholder="Type a salesperson name..."
            emptyText="No salesperson found"
            fallbackLabel={editing?.salespersonName}
            options={salespersonOptions}
            onChange={setSalespersonId}
          />

          {/* month + amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1 w-full h-[52px] px-4 rounded-xl border border-slate-200 font-bold text-slate-900 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Support (AED)</label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 100"
                className="mt-1 w-full h-[52px] px-4 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {/* notes */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Benefit from this customer (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-[#D4AF37] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <span className="text-xs font-semibold text-red-600">{problem && (customerId || amount) ? problem : ''}</span>
          <div className="flex gap-2">
            {onCancel ? (
              <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white">
                Cancel
              </button>
            ) : null}
            <button
              onClick={save}
              disabled={!!problem || saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white text-sm font-bold shadow-lg shadow-[#D4AF37]/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editing ? 'Save' : 'Add Customer'}
            </button>
          </div>
        </div>
    </div>
  );
}
