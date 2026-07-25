'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Archive, ChevronDown, Loader2, Radio, X } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = isArchiveView ? archiveMeta?.archiveId || archiveId || 'Archive' : null;

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={selectedLabel ? `Archive: ${selectedLabel}` : 'Browse archived sessions'}
        className={`flex items-center gap-2 rounded-xl border text-xs font-black uppercase tracking-wide transition-all shadow-sm ${
          isArchiveView
            ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 px-3 py-3'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 p-3'
        }`}
      >
        <Archive className="w-4 h-4 shrink-0" />
        {selectedLabel && <span className="max-w-[140px] truncate">{selectedLabel}</span>}
        {loadingArchives ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : (
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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

      {isOpen && (
        <div className="absolute left-0 top-full mt-3 w-[min(100vw-2rem,380px)] bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 py-2 z-50 max-h-[360px] overflow-y-auto">
          {archives.length === 0 && !loadingArchives && (
            <p className="px-4 py-3 text-xs text-slate-400 font-medium">
              No archived sessions yet
            </p>
          )}

          {archives.map((archive) => {
            const isSelected = archiveId === archive.archiveId;
            return (
              <button
                key={archive.archiveId}
                type="button"
                onClick={() => {
                  setArchiveId(archive.archiveId);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all ${
                  isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'
                }`}
              >
                <Radio className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-300'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{archive.archiveId}</p>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {archive.countDate || '—'}
                    {archive.label ? ` · ${archive.label}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Closed {formatClosedAt(archive.closedAt)}
                    {archive.resetLive ? ' · Live reset' : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
