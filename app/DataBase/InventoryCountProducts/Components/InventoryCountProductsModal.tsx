'use client';

import { X, Save, Loader2 } from 'lucide-react';
import { InventoryCountProductRow } from './InventoryCountProductsTable';

export interface InventoryCountProductFormValues {
  productId: string;
  barcodeName: string;
  productName: string;
  availableQty: string;
  qtyInBox: string;
}

interface Props {
  isOpen: boolean;
  editing: InventoryCountProductRow | null;
  values: InventoryCountProductFormValues;
  isSaving: boolean;
  onChange: (values: InventoryCountProductFormValues) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function InventoryCountProductsModal({
  isOpen,
  editing,
  values,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  if (!isOpen) return null;

  const set = (key: keyof InventoryCountProductFormValues, val: string) =>
    onChange({ ...values, [key]: val });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between p-8 border-b border-gray-50">
          <h2 className="text-2xl font-black text-black tracking-tight">
            {editing ? 'Edit Inventory Count Product' : 'New Inventory Count Product'}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Product ID *</label>
              <input required value={values.productId} onChange={(e) => set('productId', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Barcode Name</label>
              <input value={values.barcodeName} onChange={(e) => set('barcodeName', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Product Name *</label>
            <input required value={values.productName} onChange={(e) => set('productName', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Available Qty</label>
              <input type="number" step="any" value={values.availableQty} onChange={(e) => set('availableQty', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Qty in Box</label>
              <input type="number" step="any" value={values.qtyInBox} onChange={(e) => set('qtyInBox', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
            </div>
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
