'use client';

// Small dialog to write the benefit we get from a customer for the support (printed in the PDF).

import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function BenefitDialog({
  customerName,
  value,
  onSave,
  onClose,
}: {
  customerName: string;
  value: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150" onMouseDown={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#B8860B] flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 tracking-tight">Benefit from this customer</h3>
              <p className="text-xs font-semibold text-slate-400 truncate">{customerName || 'Customer'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            placeholder="What do we get from this customer in return for the support? (shows in the customer's PDF page)"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 leading-relaxed focus:outline-none focus:border-[#D4AF37] resize-none"
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button onClick={() => setDraft('')} disabled={!draft} className="text-sm font-bold text-red-500 hover:text-red-600 disabled:opacity-30">
            Clear
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={() => onSave(draft.trim())}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white text-sm font-bold shadow-lg shadow-[#D4AF37]/30"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
