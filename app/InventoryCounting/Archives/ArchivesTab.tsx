'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Archive,
  Calendar,
  Package,
  RefreshCw,
  Search,
  Download,
  Loader2,
} from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { fetchArchivedAllICDetails } from '../Service/InventoryCountingService';
import { exportInventoryCountingExcel } from '../Export/ExcelExport';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { useInventoryCountingArchive } from './InventoryCountingArchiveContext';
import type { InventoryCountingTabId } from '../Utils/Sidebar';

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

interface ArchivesTabProps {
  onViewArchive: (tab: InventoryCountingTabId) => void;
}

export default function ArchivesTab({ onViewArchive }: ArchivesTabProps) {
  const {
    archiveId,
    archives,
    setArchiveId,
    refreshArchives,
    loadingArchives,
  } = useInventoryCountingArchive();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingArchiveId, setDownloadingArchiveId] = useState<string | null>(null);

  const handleDownloadExcel = async (e: React.MouseEvent, id: string, label: string) => {
    e.stopPropagation();
    setDownloadingArchiveId(id);
    try {
      const result = await fetchArchivedAllICDetails(id);
      if (result.success && result.data && result.data.length > 0) {
        const formattedData = result.data.map((row) => {
          const newRow: Record<string, unknown> = {};
          Object.entries(row).forEach(([k, v]) => {
            const newKey = k.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
            newRow[newKey] = v;
          });
          return newRow;
        });

        const filename = label 
          ? `IC_Archive_${id}_${label.replace(/[^a-z0-9]/gi, '_')}` 
          : `IC_Archive_${id}`;

        await exportInventoryCountingExcel(formattedData, filename, { sheetName: 'Details' });
      } else {
        alert(result.error || 'No data found or failed to download');
      }
    } catch (err) {
      console.error(err);
      alert('Error downloading archive data');
    } finally {
      setDownloadingArchiveId(null);
    }
  };

  useEffect(() => {
    void refreshArchives();
  }, [refreshArchives]);

  const filteredArchives = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return archives;
    return archives.filter((archive) => {
      const haystack = [
        archive.archiveId,
        archive.label || '',
        archive.countDate || '',
        formatClosedAt(archive.closedAt),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [archives, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshArchives();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshRef = useRef(handleRefresh);
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  });

  useEffect(() => {
    const handleTriggerRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.activeTab === 'archives') {
        void handleRefreshRef.current();
      }
    };
    window.addEventListener('inventory-counting-trigger-refresh', handleTriggerRefresh);
    return () => {
      window.removeEventListener('inventory-counting-trigger-refresh', handleTriggerRefresh);
    };
  }, []);

  useEffect(() => {
    const isCurrentlyRefreshing = isRefreshing || loadingArchives;
    window.dispatchEvent(
      new CustomEvent('inventory-counting-refresh-state', {
        detail: { activeTab: 'archives', isRefreshing: isCurrentlyRefreshing }
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('inventory-counting-refresh-state', {
          detail: { activeTab: 'archives', isRefreshing: false }
        })
      );
    };
  }, [isRefreshing, loadingArchives]);

  const openArchive = (id: string) => {
    setArchiveId(id);
    onViewArchive('total_count');
  };

  if (loadingArchives && archives.length === 0) {
    return <TabLoader />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 p-4 flex flex-wrap items-center gap-4">
        <div className="px-3 py-2 bg-amber-50 text-amber-800 rounded-xl border border-amber-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
          <Archive className="w-4 h-4 shrink-0" />
          <span className="text-slate-400">Archives:</span> {archives.length}
        </div>

        <div className="relative flex-1 min-w-[200px] group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-amber-500 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by archive ID, label, or date..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-transparent rounded-xl text-sm font-bold text-slate-700 placeholder:text-gray-300 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none"
          />
        </div>


      </div>

      {filteredArchives.length === 0 ? (
        <NoData title={searchQuery.trim() ? 'No Matching Archives' : 'No Archived Sessions Yet'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredArchives.map((archive) => {
            const isSelected = archiveId === archive.archiveId;
            return (
              <div
                key={archive.archiveId}
                role="button"
                tabIndex={0}
                onClick={() => openArchive(archive.archiveId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openArchive(archive.archiveId);
                  }
                }}
                className={`text-left rounded-[1.75rem] border p-5 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-300 bg-amber-50 shadow-md shadow-amber-100'
                    : 'border-slate-100 bg-white hover:border-amber-200 hover:bg-amber-50/40 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <Archive className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 truncate">
                        {archive.archiveId}
                      </h3>
                      {isSelected && (
                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider">
                          Viewing
                        </span>
                      )}
                    </div>
                    {archive.label && (
                      <p className="text-sm font-bold text-slate-700 mt-1 truncate">{archive.label}</p>
                    )}
                    <div className="mt-3 space-y-1.5">
                      <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        Count date: {archive.countDate || '—'}
                      </p>
                      <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Package className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        {archive.detailRowCount.toLocaleString()} detail ·{' '}
                        {archive.totalRowCount.toLocaleString()} totals
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <p className="text-[11px] font-medium text-slate-400">
                          Closed {formatClosedAt(archive.closedAt)}
                          {archive.resetLive ? ' · Live reset' : ''}
                        </p>
                        <button
                          onClick={(e) => handleDownloadExcel(e, archive.archiveId, archive.label || '')}
                          disabled={downloadingArchiveId === archive.archiveId}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                          title="Download Excel"
                        >
                          {downloadingArchiveId === archive.archiveId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
