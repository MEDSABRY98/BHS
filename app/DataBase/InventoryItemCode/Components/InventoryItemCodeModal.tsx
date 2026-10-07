'use client';

import { X, Save, Loader2 } from 'lucide-react';
import { InventoryItemCodeRow } from './InventoryItemCodeTable';

export interface InventoryItemCodeFormValues {
  tags: string;
  itemCode: string;
  barcode: string;
}

interface Props {
  isOpen: boolean;
  editing: InventoryItemCodeRow | null;
  values: InventoryItemCodeFormValues;
  isSaving: boolean;
  onChange: (values: InventoryItemCodeFormValues) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function InventoryItemCodeModal({
  isOpen,
  editing,
  values,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  if (!isOpen) return null;

  const set = (key: keyof InventoryItemCodeFormValues, val: string) =>
    onChange({ ...values, [key]: val });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between p-8 border-b border-gray-50">
          <h2 className="text-2xl font-black text-black tracking-tight">
            {editing ? 'Edit Item Code' : 'New Item Code'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-5">
          {editing && (
            <div>
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Record ID</label>
              <input value={editing.ID} readOnly className="w-full mt-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-mono text-gray-500" />
            </div>
          )}

          <div>
            <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Tags</label>
            <input value={values.tags} onChange={(e) => set('tags', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
          </div>

          <div>
            <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Item Code</label>
            <input value={values.itemCode} onChange={(e) => set('itemCode', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 font-mono" />
          </div>

          <div>
            <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Barcode</label>
            <input value={values.barcode} onChange={(e) => set('barcode', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 font-mono" />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-gray-50 text-black rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-black text-[#D4AF37] rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
