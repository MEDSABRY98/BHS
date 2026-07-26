'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderOpen, Loader2, Trash2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import {
  deleteReconciliationSession,
  fetchReconciliationSessions,
  type ICReconciliationSessionSummary,
} from '../Service/inventory_counting_service';
import DeleteReconciliationSessionModal from './DeleteReconciliationSessionModal';

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

function sessionLabel(session: ICReconciliationSessionSummary): string {
  const parts = [session.reconciliationId];
  if (session.countDate) parts.push(session.countDate);
  if (session.label) parts.push(session.label);
  parts.push(`(${session.rowCount})`);
  return parts.join(' · ');
}

interface ReconciliationSessionPickerProps {
  selectedId: string | null;
  onSelect: (session: ICReconciliationSessionSummary) => void;
  onClear: () => void;
  refreshKey?: number;
}

export default function ReconciliationSessionPicker({
  selectedId,
  onSelect,
  onClear,
  refreshKey = 0,
}: ReconciliationSessionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<ICReconciliationSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ICReconciliationSessionSummary | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetchReconciliationSessions();
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
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSession = sessions.find((s) => s.reconciliationId === selectedId) || null;

  const handleDeleteClick = (event: React.MouseEvent, session: ICReconciliationSessionSummary) => {
    event.stopPropagation();
    setSessionToDelete(session);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    const sessionId = sessionToDelete.reconciliationId;
    setDeletingId(sessionId);
    try {
      const res = await deleteReconciliationSession(sessionId);
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
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) void loadSessions();
        }}
        title={selectedSession ? sessionLabel(selectedSession) : 'Load saved reconciliation'}
        className={`flex items-center gap-2 rounded-xl border text-xs font-black uppercase tracking-wide transition-all shadow-sm px-3 py-3 ${
          selectedSession
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <FolderOpen className="w-4 h-4 shrink-0" />
        <span className="max-w-[160px] truncate hidden sm:inline">
          {selectedSession ? selectedSession.reconciliationId : 'Saved'}
        </span>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : (
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-[min(100vw-2rem,420px)] bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 py-2 z-50 max-h-[360px] overflow-y-auto">
          {sessions.length === 0 && !loading && (
            <p className="px-4 py-3 text-xs text-slate-400 font-medium">No saved sessions yet</p>
          )}

          {loading && sessions.length === 0 && (
            <p className="px-4 py-3 text-xs text-slate-400 font-medium flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading...
            </p>
          )}

          {sessions.map((session) => (
            <div
              key={session.reconciliationId}
              className={`flex items-center gap-1 px-2 ${
                selectedId === session.reconciliationId ? 'bg-emerald-50/80' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onSelect(session);
                  setIsOpen(false);
                }}
                className="flex-1 text-left px-2 py-3 hover:bg-slate-50 rounded-xl transition-colors min-w-0"
              >
                <p className="text-sm font-black text-slate-800 truncate">{session.reconciliationId}</p>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">
                  {session.countDate || 'No date'}
                  {session.label ? ` · ${session.label}` : ''}
                  {` · ${session.rowCount} row(s)`}
                </p>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                  Saved {formatSavedAt(session.savedAt)}
                </p>
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteClick(e, session)}
                disabled={deletingId === session.reconciliationId}
                title="Delete session"
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
              >
                {deletingId === session.reconciliationId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}

          {selectedId && (
            <div className="border-t border-slate-100 mt-2 pt-2 px-2">
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2.5 text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Clear loaded session
              </button>
            </div>
          )}
        </div>
      )}

      {sessionToDelete && (
        <DeleteReconciliationSessionModal
          session={sessionToDelete}
          isDeleting={deletingId === sessionToDelete.reconciliationId}
          onClose={() => {
            if (deletingId) return;
            setSessionToDelete(null);
          }}
          onConfirm={confirmDeleteSession}
        />
      )}
    </div>
  );
}
