'use client';

// Merge Suppliers popup — same look and two-step confirm as Merge Customers.

import { useMemo } from 'react';
import { AlertTriangle, GitMerge, X } from 'lucide-react';
import SearchSelect from '@/app/InvoicesTracking/Components/DropDownList';
import type { SupplierRecord } from '../Hooks/UseMergeSuppliers';

const AFFECTED_TABLES = [
  'Every table that uses the Supplier ID (purchase prices, suppliers analysis, …)',
  'All changes happen together — if anything fails, nothing is changed',
];

type MergeSuppliersModalProps = {
  isOpen: boolean;
  isConfirmingMerge: boolean;
  isMerging: boolean;
  selectedSuppliers: SupplierRecord[];
  mergeTargetName: string;
  mergeTargetTerm: string;
  survivorSupplierId: string;
  onClose: () => void;
  onConfirm: () => void;
  onBackFromConfirm: () => void;
  setMergeTargetName: (value: string) => void;
  setMergeTargetTerm: (value: string) => void;
  chooseSurvivor: (value: string) => void;
};

export default function MergeSuppliersModal({
  isOpen,
  isConfirmingMerge,
  isMerging,
  selectedSuppliers,
  mergeTargetName,
  mergeTargetTerm,
  survivorSupplierId,
  onClose,
  onConfirm,
  onBackFromConfirm,
  setMergeTargetName,
  setMergeTargetTerm,
  chooseSurvivor,
}: MergeSuppliersModalProps) {
  const survivorOptions = useMemo(
    () =>
      selectedSuppliers.map((s) => {
        const supplierId = String(s['SUPPLIER ID'] || '').trim();
        const term = s['PAYMENT TERM'];
        return {
          id: supplierId,
          label: String(s['SUPPLIER NAME'] || '').trim() || supplierId,
          subLabel: term !== null && term !== undefined && term !== '' ? `ID ${supplierId} · ${term} days` : `ID ${supplierId}`,
        };
      }),
    [selectedSuppliers],
  );

  const sourceSuppliers = useMemo(
    () => selectedSuppliers.filter((s) => String(s['SUPPLIER ID'] || '').trim() !== survivorSupplierId.trim()),
    [selectedSuppliers, survivorSupplierId],
  );

  if (!isOpen) return null;
  const back = () => (isConfirmingMerge ? onBackFromConfirm() : onClose());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/30 animate-in fade-in duration-200" onClick={back}>
      <div
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitMerge className="w-6 h-6 text-[#D4AF37]" />
            <h2 className="text-2xl font-bold tracking-tight">Merge Suppliers</h2>
          </div>
          <button type="button" onClick={back} disabled={isMerging} className="p-2 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!isConfirmingMerge ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Survivor Supplier ID (kept)</label>
                <SearchSelect
                  label=""
                  options={survivorOptions}
                  value={survivorSupplierId}
                  onChange={chooseSurvivor}
                  placeholder="Select survivor supplier..."
                  heightClass="h-[64px]"
                  allowClear={false}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Final Supplier Name</label>
                <input
                  type="text"
                  value={mergeTargetName}
                  onChange={(e) => setMergeTargetName(e.target.value)}
                  placeholder="Supplier name to keep"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Final Payment Term (days)</label>
                <input
                  type="number"
                  min={0}
                  value={mergeTargetTerm}
                  onChange={(e) => setMergeTargetTerm(e.target.value)}
                  placeholder="Payment term to keep"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Supplier IDs to be merged away</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sourceSuppliers.map((s) => (
                    <span
                      key={s.ID}
                      className="inline-flex items-center px-3 py-1 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-red-100"
                    >
                      {s['SUPPLIER ID']} — {s['SUPPLIER NAME']}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 bg-red-50 rounded-3xl border-2 border-dashed border-red-300 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-lg font-black text-red-700 uppercase tracking-wide">Permanent Cascade Data Change</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Are you absolutely sure? Every reference for{' '}
                <strong className="text-black">{sourceSuppliers.map((s) => s['SUPPLIER ID']).join(', ')}</strong> will be moved to survivor{' '}
                <strong className="text-black">{survivorSupplierId}</strong>, and the merged supplier records will be deleted.
              </p>
              <p className="text-sm text-black font-bold">
                Final name: {mergeTargetName}
                {mergeTargetTerm.trim() ? ` · ${mergeTargetTerm.trim()} days` : ''}
              </p>
              <div className="text-left text-xs text-gray-500 space-y-1 pt-2">
                <p className="font-black uppercase tracking-wider text-gray-400">Affected tables</p>
                {AFFECTED_TABLES.map((t) => (
                  <p key={t}>• {t}</p>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">This action cannot be undone.</p>
            </div>
          )}
        </div>

        <div className="p-8 pt-0 flex gap-4">
          <button
            type="button"
            onClick={back}
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
              isConfirmingMerge ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-black text-[#D4AF37] hover:scale-[1.02]'
            }`}
          >
            {isConfirmingMerge ? 'Yes, Execute Merge' : 'Proceed to Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
