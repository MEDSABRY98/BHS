'use client';

import React, { useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import {
  saveReconciliationSession,
  type ICReconciliationSaveLine,
} from '../Service/InventoryCountingService';

interface SaveReconciliationModalProps {
  countDate: string;
  lines: ICReconciliationSaveLine[];
  reconciliationId?: string | null;
  onClose: () => void;
  onSuccess: (reconciliationId: string) => void;
}

export default function SaveReconciliationModal({
  countDate,
  lines,
  reconciliationId,
  onClose,
  onSuccess,
}: SaveReconciliationModalProps) {
  const isUpdate = Boolean(reconciliationId?.trim());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await saveReconciliationSession({
        countDate,
        lines,
        reconciliationId: isUpdate ? reconciliationId!.trim() : undefined,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save reconciliation');
      }

      if (result.updated) {
        toast.success(`Updated ${result.reconciliationId} (${result.rowCount} row(s))`);
      } else {
        toast.success(`Saved as ${result.reconciliationId} (${result.rowCount} row(s))`);
      }
      onSuccess(result.reconciliationId);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save reconciliation';
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
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Save className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {isUpdate ? 'Update Reconciliation' : 'Save Reconciliation'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isUpdate ? `${reconciliationId} · ` : ''}
                {lines.length} row(s) · Count date {countDate}
              </p>
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

        <div className="px-6 py-5">
          <p className="text-xs font-medium text-slate-500">
            {isUpdate
              ? 'Changes will overwrite the loaded session. Only rows with a filled result quantity are saved.'
              : 'Only rows with a filled result quantity will be saved. Ending balances are stored as a snapshot.'}
          </p>
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
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isUpdate ? 'Updating...' : 'Saving...'}
              </>
            ) : isUpdate ? (
              'Update Session'
            ) : (
              'Save Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
