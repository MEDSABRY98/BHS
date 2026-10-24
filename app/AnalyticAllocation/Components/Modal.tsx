'use client';

import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({ open, title, subtitle, onClose, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-6xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900 truncate">{title}</h3>
            {subtitle && <div className="text-xs font-semibold text-slate-400 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap justify-end gap-3 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
