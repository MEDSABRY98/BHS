'use client';

import { AlertCircle, X } from 'lucide-react';
import { entryRef, formatAmount, formatDate, hasArabic, type IntercompanyEntry } from '../Utils/IntercompanyTypes';

export default function LabelModal({ entry, onClose }: { entry: IntercompanyEntry; onClose: () => void }) {
  const arabic = hasArabic(entry.LABEL);
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Label</h3>
              <p className="text-[11px] font-semibold text-slate-400">
                {formatDate(entry.ENTRY_DATE)} · {entryRef(entry)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p
            dir="auto"
            className={`text-[15px] leading-loose font-semibold text-slate-800 whitespace-pre-wrap break-words bg-slate-50 rounded-2xl p-4 ${arabic ? 'text-right' : 'text-left'}`}
          >
            {entry.LABEL || <span className="text-slate-400">No label</span>}
          </p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-slate-100 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Debit</p>
              <p className="text-lg font-black text-emerald-700">{entry.DEBIT ? formatAmount(entry.DEBIT) : '—'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Credit</p>
              <p className="text-lg font-black text-rose-700">{entry.CREDIT ? formatAmount(entry.CREDIT) : '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
