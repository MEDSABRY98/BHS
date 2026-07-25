'use client';

import React, { useState } from 'react';
import { Archive, Loader2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { closeInventoryCountSession } from '../Service/inventory_counting_service';
import { useInventoryCountingArchive } from '../InventoryCountingArchiveContext';

interface CloseSessionModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

function todayInputValue(): string {
  return new Date().toISOString().split('T')[0];
}

export default function CloseSessionModal({ onClose, onSuccess }: CloseSessionModalProps) {
  const { notifySessionClosed } = useInventoryCountingArchive();
  const [label, setLabel] = useState('');
  const [countDate, setCountDate] = useState(todayInputValue());
  const [resetLive, setResetLive] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await closeInventoryCountSession({
        label: label.trim() || undefined,
        countDate,
        resetLive,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to close session');
      }

      toast.success(`Session archived as ${result.archiveId}`);
      notifySessionClosed(result.resetLive);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to close session';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Archive className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Close Count Session</h3>
              <p className="text-xs text-slate-500 font-medium">Archive current counts to history</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-2">
              Label (optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. January warehouse count"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-2">
              Count Date
            </label>
            <input
              type="date"
              value={countDate}
              onChange={(e) => setCountDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
            />
          </div>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/50 cursor-pointer">
            <input
              type="checkbox"
              checked={resetLive}
              onChange={(e) => setResetLive(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <p className="text-sm font-black text-amber-900">Reset live counting data after archiving</p>
              <p className="text-xs text-amber-700/80 font-medium mt-1">
                Clears all rows in mix_INVENTORY_COUNT_DETAILS and mix_INVENTORY_COUNT_TOTALS.
                Mobile sync may repopulate data later.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmEmpty}
              onChange={(e) => setConfirmEmpty(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <p className="text-sm font-bold text-slate-700">I confirm closing this session</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Required to proceed — works even if no counts exist yet
              </p>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !confirmEmpty}
            className="px-5 py-2.5 rounded-xl text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Archiving...
              </>
            ) : (
              'Close Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
