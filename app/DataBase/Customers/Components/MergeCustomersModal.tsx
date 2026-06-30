'use client';

import { useMemo } from 'react';
import { AlertTriangle, GitMerge, X } from 'lucide-react';
import SearchSelect from '@/app/LPOs/Components/DropDownList';
import type { CustomerRecord } from '../Hooks/UseMergeCustomers';

const AFFECTED_TABLES = [
  'web_Sales_DB',
  'web_Sales_DB_INACTIVECUSTOMERS',
  'web_Sales_DB_CUSTOMERSMAPPING',
  'mix_DEBIT',
  'debit_EMILS',
  'debit_EMILS_LULU',
  'debit_NOTES',
  'app_lpos_ORDERS',
];

type MergeCustomersModalProps = {
  isOpen: boolean;
  isConfirmingMerge: boolean;
  isMerging: boolean;
  selectedCustomers: CustomerRecord[];
  mergeTargetMainName: string;
  mergeTargetSubName: string;
  mergeTargetCity: string;
  survivorCustomerId: string;
  onClose: () => void;
  onConfirm: () => void;
  onBackFromConfirm: () => void;
  setMergeTargetMainName: (value: string) => void;
  setMergeTargetSubName: (value: string) => void;
  setMergeTargetCity: (value: string) => void;
  setSurvivorCustomerId: (value: string) => void;
};

export default function MergeCustomersModal({
  isOpen,
  isConfirmingMerge,
  isMerging,
  selectedCustomers,
  mergeTargetMainName,
  mergeTargetSubName,
  mergeTargetCity,
  survivorCustomerId,
  onClose,
  onConfirm,
  onBackFromConfirm,
  setMergeTargetMainName,
  setMergeTargetSubName,
  setMergeTargetCity,
  setSurvivorCustomerId,
}: MergeCustomersModalProps) {
  const survivorOptions = useMemo(
    () =>
      selectedCustomers.map((c) => {
        const customerId = String(c['CUSTOMER ID'] || '').trim();
        const name =
          c['CUSTOMER SUB NAME']?.trim() ||
          c['CUSTOMER MAIN NAME']?.trim() ||
          customerId;
        const city = c['CUSTOMER CITY']?.trim();
        return {
          id: customerId,
          label: name,
          subLabel: city ? `ID ${customerId} · ${city}` : `ID ${customerId}`,
        };
      }),
    [selectedCustomers]
  );

  const sourceCustomers = useMemo(
    () =>
      selectedCustomers.filter(
        (c) => String(c['CUSTOMER ID'] || '').trim() !== survivorCustomerId.trim()
      ),
    [selectedCustomers, survivorCustomerId]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/30 animate-in fade-in duration-200"
      onClick={() => (isConfirmingMerge ? onBackFromConfirm() : onClose())}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitMerge className="w-6 h-6 text-[#D4AF37]" />
            <h2 className="text-2xl font-bold tracking-tight">Merge Customers</h2>
          </div>
          <button
            type="button"
            onClick={() => (isConfirmingMerge ? onBackFromConfirm() : onClose())}
            disabled={isMerging}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!isConfirmingMerge ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">
                  Survivor Customer ID (kept)
                </label>
                <SearchSelect
                  label=""
                  options={survivorOptions}
                  value={survivorCustomerId}
                  onChange={setSurvivorCustomerId}
                  placeholder="Select survivor customer..."
                  heightClass="h-[64px]"
                  allowClear={false}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">
                  Final Customer Main Name
                </label>
                <input
                  type="text"
                  value={mergeTargetMainName}
                  onChange={(e) => setMergeTargetMainName(e.target.value)}
                  placeholder="Main company name to keep"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">
                  Final Customer Sub Name
                </label>
                <input
                  type="text"
                  value={mergeTargetSubName}
                  onChange={(e) => setMergeTargetSubName(e.target.value)}
                  placeholder="Sub name to keep"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">
                  Final Customer City
                </label>
                <input
                  type="text"
                  value={mergeTargetCity}
                  onChange={(e) => setMergeTargetCity(e.target.value)}
                  placeholder="City to keep"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Customer IDs to be merged away
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sourceCustomers.map((c) => (
                    <span
                      key={c.ID}
                      className="inline-flex items-center px-3 py-1 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-red-100"
                    >
                      {c['CUSTOMER ID']} — {c['CUSTOMER SUB NAME']}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 bg-red-50 rounded-3xl border-2 border-dashed border-red-300 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-lg font-black text-red-700 uppercase tracking-wide">
                Permanent Cascade Data Change
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Are you absolutely sure? Every reference for{' '}
                <strong className="text-black">
                  {sourceCustomers.map((c) => c['CUSTOMER ID']).join(', ')}
                </strong>{' '}
                will be moved to survivor{' '}
                <strong className="text-black">{survivorCustomerId}</strong>, and the merged
                customer records will be deleted.
              </p>
              <p className="text-sm text-black font-bold">
                Final name: {mergeTargetMainName || '—'} / {mergeTargetSubName}
              </p>
              <div className="text-left text-xs text-gray-500 space-y-1 pt-2">
                <p className="font-black uppercase tracking-wider text-gray-400">Affected tables</p>
                {AFFECTED_TABLES.map((table) => (
                  <p key={table}>• {table}</p>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">This action cannot be undone.</p>
            </div>
          )}
        </div>

        <div className="p-8 pt-0 flex gap-4">
          <button
            type="button"
            onClick={() => (isConfirmingMerge ? onBackFromConfirm() : onClose())}
            disabled={isMerging}
            className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50"
          >
            {isConfirmingMerge ? 'Go Back' : 'Abort'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isMerging}
            className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 ${
              isConfirmingMerge
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-black text-[#D4AF37] hover:scale-[1.02]'
            }`}
          >
            {isConfirmingMerge ? 'Yes, Execute Merge' : 'Proceed to Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
