'use client';

import React, { useState } from 'react';
import { Archive, Loader2, Radio, X } from 'lucide-react';
import { useInventoryCountingArchive } from '../InventoryCountingArchiveContext';

function formatClosedAt(value: string): string {
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

export default function ArchiveSelector() {
  const {
    archiveId,
    archives,
    setArchiveId,
    isArchiveView,
    archiveMeta,
    loadingArchives,
  } = useInventoryCountingArchive();
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = isArchiveView ? archiveMeta?.archiveId || archiveId || 'Archive' : null;

  const handleSelect = (id: string) => {
    setArchiveId(id);
    setIsOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title={selectedLabel ? `Archive: ${selectedLabel}` : 'Browse archived sessions'}
          className={`p-3 rounded-xl border transition-all shadow-sm ${
            isArchiveView
              ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-700'
          }`}
        >
          {loadingArchives ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : (
            <Archive className="w-5 h-5 shrink-0" />
          )}
        </button>

        {isArchiveView && (
          <button
            type="button"
            onClick={() => setArchiveId(null)}
            title="Back to current session"
            className="p-3 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-[2rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div>
                <h3 className="text-xl font-black text-gray-900">Archived Sessions</h3>
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
              {archives.length === 0 && !loadingArchives && (
                <p className="text-sm font-bold text-slate-400 text-center py-8">No archived sessions yet</p>
              )}

              {loadingArchives && archives.length === 0 && (
                <p className="text-sm font-bold text-slate-400 text-center py-8 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading archives...
                </p>
              )}

              {archives.map((archive) => {
                const isSelected = archiveId === archive.archiveId;
                return (
                  <button
                    key={archive.archiveId}
                    type="button"
                    onClick={() => handleSelect(archive.archiveId)}
                    className={`w-full text-left px-4 py-3.5 flex items-start gap-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-amber-300 bg-amber-50 shadow-sm shadow-amber-100'
                        : 'border-slate-100 bg-slate-50/80 hover:border-amber-200 hover:bg-amber-50/50'
                    }`}
                  >
                    <Radio className={`w-4 h-4 mt-1 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-300'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{archive.archiveId}</p>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {archive.countDate || '—'}
                        {archive.label ? ` · ${archive.label}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Closed {formatClosedAt(archive.closedAt)}
                        {archive.resetLive ? ' · Live reset' : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {isArchiveView && (
              <button
                type="button"
                onClick={() => {
                  setArchiveId(null);
                  setIsOpen(false);
                }}
                className="w-full mt-4 py-3 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
              >
                Back to current session
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
