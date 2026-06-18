'use client';

import { X, Save, Loader2 } from 'lucide-react';
import { InventoryMoveRow } from './InventoryMovesTable';

export interface InventoryMoveFormValues {
  date: string;
  reference: string;
  locationFrom: string;
  locationTo: string;
  productId: string;
  qty: string;
}

interface ProductOption {
  'PRODUCT ID': string;
  'PRODUCT NAME': string;
}

interface Props {
  isOpen: boolean;
  editing: InventoryMoveRow | null;
  values: InventoryMoveFormValues;
  productOptions: ProductOption[];
  isSaving: boolean;
  onChange: (values: InventoryMoveFormValues) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const LOCATION_SUGGESTIONS = [
  'Partners/Customers',
  'Partners/Vendors',
];

export default function InventoryMovesModal({
  isOpen,
  editing,
  values,
  productOptions,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  if (!isOpen) return null;

  const set = (key: keyof InventoryMoveFormValues, val: string) =>
    onChange({ ...values, [key]: val });

  const filteredProducts = productOptions.filter((p) => {
    if (!values.productId.trim()) return true;
    const q = values.productId.toLowerCase();
    return p['PRODUCT ID'].toLowerCase().includes(q) || p['PRODUCT NAME'].toLowerCase().includes(q);
  }).slice(0, 50);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between p-8 border-b border-gray-50">
          <h2 className="text-2xl font-black text-black tracking-tight">
            {editing ? 'Edit Inventory Move' : 'New Inventory Move'}
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
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Date</label>
              <input type="date" value={values.date} onChange={(e) => set('date', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
            </div>
            <div>
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Reference</label>
              <input value={values.reference} onChange={(e) => set('reference', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Location From</label>
              <input list="location-from-list" value={values.locationFrom} onChange={(e) => set('locationFrom', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
              <datalist id="location-from-list">
                {LOCATION_SUGGESTIONS.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
            </div>
            <div>
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Location To</label>
              <input list="location-to-list" value={values.locationTo} onChange={(e) => set('locationTo', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
              <datalist id="location-to-list">
                {LOCATION_SUGGESTIONS.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Product ID *</label>
            <input
              required
              list="product-id-list"
              value={values.productId}
              onChange={(e) => set('productId', e.target.value)}
              className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 font-mono"
              placeholder="Select or type product ID"
            />
            <datalist id="product-id-list">
              {filteredProducts.map((p) => (
                <option key={p['PRODUCT ID']} value={p['PRODUCT ID']}>{p['PRODUCT NAME']}</option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Qty *</label>
            <input type="number" step="any" required value={values.qty} onChange={(e) => set('qty', e.target.value)} className="w-full mt-2 px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5" />
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
