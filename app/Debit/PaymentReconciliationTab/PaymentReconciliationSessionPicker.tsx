'use client';

import React, { useEffect, useState } from 'react';
import { FolderOpen, Loader2, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import {
  deletePaymentReconciliationSession,
  fetchPaymentReconciliationSessions,
  type PaymentReconciliationSessionSummary,
} from '../Service/debit_service';
import DeletePaymentReconciliationSessionModal from '../SavedReconciliations/DeletePaymentReconciliationSessionModal';

function formatSavedAt(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface PaymentReconciliationSessionPickerProps {
  selectedId: string | null;
  onSelect: (session: PaymentReconciliationSessionSummary) => void;
  onClear: () => void;
  refreshKey?: number;
}

export default function PaymentReconciliationSessionPicker({
  selectedId,
  onSelect,
  onClear,
  refreshKey = 0,
}: PaymentReconciliationSessionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<PaymentReconciliationSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<PaymentReconciliationSessionSummary | null>(
    null,
  );

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetchPaymentReconciliationSessions();
      if (!res.success) {
        throw new Error(res.error || 'Failed to load saved sessions');
      }
      setSessions(res.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load saved sessions';
      toast.error(message);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [refreshKey]);

  useEffect(() => {
    if (isOpen) {
      void loadSessions();
    }
  }, [isOpen]);

  const selectedSession = sessions.find((s) => s.sessionId === selectedId) || null;

  const handleDeleteClick = (event: React.MouseEvent, session: PaymentReconciliationSessionSummary) => {
    event.stopPropagation();
    setSessionToDelete(session);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    const sessionId = sessionToDelete.sessionId;
    setDeletingId(sessionId);
    try {
      const res = await deletePaymentReconciliationSession(sessionId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete session');
      }
      toast.success('Session deleted');
      if (selectedId === sessionId) {
        onClear();
      }
      setSessionToDelete(null);
      await loadSessions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={
          selectedSession
            ? `Loaded: ${selectedSession.sessionId}`
            : 'Load saved payment reconciliation'
        }
        className={`p-2.5 rounded-xl border transition-all shadow-sm shrink-0 flex items-center justify-center ${
          selectedSession
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-700'
        }`}
      >
        {loading && !isOpen ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : (
          <FolderOpen className="w-5 h-5" />
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-[2rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div>
                <h3 className="text-xl font-black text-gray-900">Saved Payment Sessions</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
              {sessions.length === 0 && !loading && (
                <p className="text-sm font-bold text-slate-400 text-center py-8">No saved sessions yet</p>
              )}

              {loading && sessions.length === 0 && (
                <p className="text-sm font-bold text-slate-400 text-center py-8 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading sessions...
                </p>
              )}

              {sessions.map((session) => {
                const isSelected = selectedId === session.sessionId;
                return (
                  <div
                    key={session.sessionId}
                    className={`flex items-center gap-1 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-100 bg-slate-50/80 hover:border-emerald-200 hover:bg-emerald-50/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(session);
                        setIsOpen(false);
                      }}
                      className="flex-1 text-left px-4 py-3.5 min-w-0"
                    >
                      <p className="text-sm font-black text-slate-800 truncate">{session.sessionId}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">
                        {session.paymentDate || 'No date'}
                        {` · ${formatAmount(session.paymentAmount)} AED`}
                        {session.lineCount > 0 ? ` · ${session.lineCount} invoice(s)` : ''}
                      </p>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                        Saved {formatSavedAt(session.savedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, session)}
                      disabled={deletingId === session.sessionId}
                      title="Delete session"
                      className="p-2.5 mr-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                    >
                      {deletingId === session.sessionId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {selectedId && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="w-full mt-4 py-3 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-red-600 transition-colors shrink-0"
              >
                Clear loaded session
              </button>
            )}
          </div>
        </div>
      )}

      {sessionToDelete && (
        <DeletePaymentReconciliationSessionModal
          session={sessionToDelete}
          isDeleting={deletingId === sessionToDelete.sessionId}
          onClose={() => {
            if (deletingId) return;
            setSessionToDelete(null);
          }}
          onConfirm={confirmDeleteSession}
        />
      )}
    </>
  );
}
