'use client';

// Clean confirmation dialog (replaces the browser's confirm box).

import { useEffect } from 'react';
import { Loader2, Trash2 } from 'lucide-react';

export type ConfirmDetail = { label: string; value: string };

export default function ConfirmDialog({
  title,
  message,
  details = [],
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  details?: ConfirmDetail[];
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-slate-900 text-lg tracking-tight">{title}</h3>
            {message ? <p className="mt-1 text-sm text-slate-500 font-medium">{message}</p> : null}
            {details.length ? (
              <dl className="mt-4 rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100">
                {details.map((d) => (
                  <div key={d.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 pt-0.5 shrink-0">{d.label}</dt>
                    <dd className="text-sm font-bold text-slate-900 text-right break-words min-w-0">{d.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="mt-3 text-xs font-semibold text-red-600">This can't be undone.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button
            onClick={onCancel}
            disabled={busy}
            className="w-28 justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className="w-28 justify-center px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
