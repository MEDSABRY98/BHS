'use client';

import { useState } from 'react';
import { Archive, Calendar, Download, Loader2, MapPin } from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { useICSession, useICTabRefresh } from '../Sessions/ICSessionContext';
import { fetchICSessionData } from '../Sessions/ICSessionsService';
import { formatICDate } from '../Sessions/SessionBar';
import { downloadArchiveExcel } from './ArchiveExcel';

/** Closed counts as cards: count date + Excel download (Total, Users and Records sheets). */
export default function ArchiveTab() {
  useICTabRefresh('archive');
  const { closedSessions, loading } = useICSession();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const download = async (id: number) => {
    setError('');
    setDownloadingId(id);
    try {
      await downloadArchiveExcel(await fetchICSessionData(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the Excel file.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading && closedSessions.length === 0) return <TabLoader />;
  if (closedSessions.length === 0) {
    return <NoData title="No archived counts" message="A count appears here once it is closed." />;
  }

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl px-5 py-4 text-sm font-bold">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {closedSessions.map((s) => (
          <div
            key={s.id}
            className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-slate-900 truncate">{s.name || `Session #${s.id}`}</div>
                {s.warehouse && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> <span className="truncate">{s.warehouse}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              {formatICDate(s.createdAt) || '-'}
            </div>
            <button
              type="button"
              onClick={() => void download(s.id)}
              disabled={downloadingId !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-[#0f0f0f] text-[#D4AF37] hover:bg-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloadingId === s.id ? 'Building...' : 'Download Excel'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
