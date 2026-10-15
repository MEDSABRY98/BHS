'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); if (!busy) onCancel(); }}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900">{title}</h3>
            <div className="text-sm text-slate-500 mt-1 break-words">{message}</div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} disabled={busy} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
