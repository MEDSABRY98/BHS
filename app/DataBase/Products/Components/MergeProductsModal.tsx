'use client';

import { useMemo } from 'react';
import { AlertTriangle, GitMerge, X } from 'lucide-react';
import SearchSelect from '@/app/LPOs/Components/DropDownList';
import type { ProductRecord } from '../Hooks/UseMergeProducts';

const AFFECTED_TABLES = [
  'web_Sales_DB',
  'web_INVENTORY_SCRAB',
  'web_INVENTORY_SCRAB_REPORT',
  'web_INVENTORY_MOVES',
  'mix_INVENTORY_COUNT_DETAILS',
  'mix_INVENTORY_COUNT_TOTALS',
  'web_INVENTORY_PRODUCTS',
  'mix_INVENTORY_COUNT_PRODUCTS',
];

type MergeProductsModalProps = {
  isOpen: boolean;
  isConfirmingMerge: boolean;
  isMerging: boolean;
  selectedProducts: ProductRecord[];
  mergeTargetName: string;
  mergeTargetBarcode: string;
  mergeTargetCategory: string;
  mergeTargetItemCode: string;
  survivorProductId: string;
  onClose: () => void;
  onConfirm: () => void;
  onBackFromConfirm: () => void;
  setMergeTargetName: (value: string) => void;
  setMergeTargetBarcode: (value: string) => void;
  setMergeTargetCategory: (value: string) => void;
  setMergeTargetItemCode: (value: string) => void;
  setSurvivorProductId: (value: string) => void;
};

export default function MergeProductsModal({
  isOpen,
  isConfirmingMerge,
  isMerging,
  selectedProducts,
  mergeTargetName,
  mergeTargetBarcode,
  mergeTargetCategory,
  mergeTargetItemCode,
  survivorProductId,
  onClose,
  onConfirm,
  onBackFromConfirm,
  setMergeTargetName,
  setMergeTargetBarcode,
  setMergeTargetCategory,
  setMergeTargetItemCode,
  setSurvivorProductId,
}: MergeProductsModalProps) {
  const survivorOptions = useMemo(
    () =>
      selectedProducts.map((p) => {
        const id = String(p['PRODUCT ID'] || '').trim();
        const name = p['PRODUCT NAME']?.trim() || id;
        const barcode = p['PRODUCT BARCODE']?.trim();
        return {
          id,
          label: name,
          subLabel: barcode ? `ID ${id} · ${barcode}` : `ID ${id}`,
        };
      }),
    [selectedProducts]
  );

  const sourceProducts = useMemo(
    () =>
      selectedProducts.filter(
        (p) => String(p['PRODUCT ID'] || '').trim() !== survivorProductId.trim()
      ),
    [selectedProducts, survivorProductId]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/30 animate-in fade-in duration-200"
      onClick={() => (isConfirmingMerge ? onBackFromConfirm() : onClose())}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitMerge className="w-6 h-6 text-[#D4AF37]" />
            <h2 className="text-2xl font-bold tracking-tight">Merge Products</h2>
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

        <div className="p-8 space-y-5">
          {!isConfirmingMerge ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">
                  Survivor Product ID (kept)
                </label>
                <SearchSelect
                  label=""
                  options={survivorOptions}
                  value={survivorProductId}
                  onChange={setSurvivorProductId}
                  placeholder="Select survivor product..."
                  heightClass="h-[64px]"
                  allowClear={false}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">
                    Final Product Name
                  </label>
                  <input
                    type="text"
                    value={mergeTargetName}
                    onChange={(e) => setMergeTargetName(e.target.value)}
                    placeholder="Product name to keep"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">
                    Final Product Barcode
                  </label>
                  <input
                    type="text"
                    value={mergeTargetBarcode}
                    onChange={(e) => setMergeTargetBarcode(e.target.value)}
                    placeholder="Barcode to keep"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">
                    Final Item Code
                  </label>
                  <input
                    type="text"
                    value={mergeTargetItemCode}
                    onChange={(e) => setMergeTargetItemCode(e.target.value)}
                    placeholder="Item code to keep"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold font-mono"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">
                    Final Product Category
                  </label>
                  <input
                    type="text"
                    value={mergeTargetCategory}
                    onChange={(e) => setMergeTargetCategory(e.target.value)}
                    placeholder="Category to keep"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  Product IDs to be merged away
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sourceProducts.map((p) => (
                    <span
                      key={p.ID}
                      className="inline-flex items-center px-3 py-1 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-red-100"
                    >
                      {p['PRODUCT ID']} — {p['PRODUCT NAME']}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 bg-red-50 rounded-3xl border-2 border-dashed border-red-300 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-lg font-black text-red-700 uppercase tracking-wide">
                Permanent Cascade Data Change
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Are you absolutely sure? Every reference for{' '}
                <strong className="text-black">
                  {sourceProducts.map((p) => p['PRODUCT ID']).join(', ')}
                </strong>{' '}
                will be moved to survivor{' '}
                <strong className="text-black">{survivorProductId}</strong>, and the merged
                product records will be deleted.
              </p>
              <p className="text-sm text-black font-bold">
                Final name: {mergeTargetName}
                {mergeTargetBarcode ? ` · ${mergeTargetBarcode}` : ''}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-left text-[10px] text-gray-500 pt-1">
                <p className="col-span-2 font-black uppercase tracking-wider text-gray-400 text-center pb-1">
                  Affected tables
                </p>
                {AFFECTED_TABLES.map((table) => (
                  <p key={table} className="truncate">• {table}</p>
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
