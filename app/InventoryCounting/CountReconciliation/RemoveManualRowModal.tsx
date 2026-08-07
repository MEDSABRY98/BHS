'use client';

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface RemoveManualRowModalProps {
  productId: string;
  productName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function RemoveManualRowModal({
  productId,
  productName,
  onClose,
  onConfirm,
}: RemoveManualRowModalProps) {
  const label = productName || productId;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-7 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-manual-row-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 id="remove-manual-row-title" className="text-xl font-black text-slate-900 pr-8">
          Remove product?
        </h3>
        <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed">
          Remove <strong className="text-slate-800">{label}</strong> from reconciliation?
          You can add it again later via search.
        </p>

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 bg-rose-600 text-white hover:bg-rose-700 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
