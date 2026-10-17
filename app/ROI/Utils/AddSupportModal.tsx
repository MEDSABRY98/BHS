'use client';

// Edit-a-support popup (the add form lives in the Overview tab).

import { X } from 'lucide-react';
import SupportForm from './SupportForm';
import type { SupportRecord } from './Types';

export default function AddSupportModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: SupportRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-visible" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-5 rounded-full bg-[#D4AF37]" />
            <h3 className="font-black text-slate-900 tracking-tight">{editing ? 'Edit Support' : 'Add Customer'}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SupportForm editing={editing} onCancel={onClose} onSaved={onSaved} />
      </div>
    </div>
  );
}
