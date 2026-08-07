'use client';

import React, { useState } from 'react';
import { Archive } from 'lucide-react';
import CloseSessionModal from './CloseSessionModal';
import {
  canCloseInventoryCountSession,
  useInventoryCountingArchive,
} from '../InventoryCountingArchiveContext';

export default function CloseSessionButton({ className = '' }: { className?: string }) {
  const { isReadOnly } = useInventoryCountingArchive();
  const [showCloseModal, setShowCloseModal] = useState(false);
  const canClose = canCloseInventoryCountSession();

  if (isReadOnly || !canClose) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowCloseModal(true)}
        className={`flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl border border-slate-900 shadow-sm hover:bg-black transition-all text-xs font-black uppercase tracking-wide whitespace-nowrap ${className}`}
        title="Close Session"
      >
        <Archive className="w-4 h-4 shrink-0" />
        Close Session
      </button>

      {showCloseModal && (
        <CloseSessionModal onClose={() => setShowCloseModal(false)} />
      )}
    </>
  );
}
