'use client';

import React, { useState } from 'react';
import { History, Save, X } from 'lucide-react';
import type { CountType, ICRecord } from '../Service/InventoryCountingService';

function formatCountType(countType: CountType): string {
  return countType === 'Normal' ? 'Normal' : 'Damage & Expire';
}

interface EditRecordModalProps {
  record: ICRecord;
  onSave: (values: { qtyInBox: number; countedQty: number; countDetails: string }) => Promise<void>;
  onClose: () => void;
}

export default function EditRecordModal({ record, onSave, onClose }: EditRecordModalProps) {
  const [qtyInBox, setQtyInBox] = useState(record.qtyInBox);
  const [countedQty, setCountedQty] = useState(record.countedQty);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const qty = Number(countedQty);
      await onSave({
        qtyInBox: Number(qtyInBox),
        countedQty: qty,
        countDetails: `Manual: ${qty} pcs`,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save record:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      dir="ltr"
    >
      <div
        className="bg-white rounded-[2rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center shadow-sm">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Edit Record</h3>
              <p className="text-sm font-bold text-gray-400 mt-1">ID: {record.rowId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-slate-50 rounded-2xl space-y-2 text-sm font-bold text-slate-600">
          <p>Date: <span className="text-slate-900">{record.date}</span></p>
          <p>Type: <span className="text-slate-900">{formatCountType(record.countType)}</span></p>
          <p>User: <span className="text-slate-900">{record.user}</span></p>
          <p>Warehouse: <span className="text-slate-900">{record.warehouse}</span></p>
          <p>Product: <span className="text-slate-900">{record.productName}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
              Qty in Box
            </label>
            <input
              type="number"
              step="any"
              value={qtyInBox}
              onChange={(e) => setQtyInBox(Number(e.target.value))}
              required
              className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-800 transition-all shadow-sm text-center"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
              Counted Qty
            </label>
            <input
              type="number"
              step="any"
              value={countedQty}
              onChange={(e) => setCountedQty(Number(e.target.value))}
              required
              className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-800 transition-all shadow-sm text-center"
            />
          </div>

          <div className="flex gap-4 pt-4 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-[0.4] py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all text-sm"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
