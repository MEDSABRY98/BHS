'use client';

import React, { useState, useMemo } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
import {
  Layers,
  RefreshCw,
  Loader2,
  Eye,
  FileSpreadsheet,
  ArrowLeft,
  X,
  Box,
  Trash2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ScrapEntry {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT BARCODE': string;
  'PRODUCT NAME': string;
  QTY: number;
  REASON: 'EXPIRED' | 'DAMAGED';
  CREATED_AT: string;
  SESSION_ID: string;
}

interface SessionsHistoryTabProps {
  scrapEntries: ScrapEntry[];
  isEntriesLoading: boolean;
  fetchScrapEntries: () => Promise<void>;
  currentSession: string;
}

export default function SessionsHistoryTab({
  scrapEntries,
  isEntriesLoading,
  fetchScrapEntries,
  currentSession
}: SessionsHistoryTabProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deletion Confirm States
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  // Grouped unique sessions calculation
  const groupedSessions = useMemo(() => {
    const map: Record<string, { sessionId: string; date: string; totalQty: number; itemsCount: number; entries: ScrapEntry[] }> = {};
    
    scrapEntries.forEach((entry) => {
      const sId = entry.SESSION_ID || 'UNTAGGED';
      if (!map[sId]) {
        map[sId] = {
          sessionId: sId,
          date: entry.CREATED_AT,
          totalQty: 0,
          itemsCount: 0,
          entries: []
        };
      }
      map[sId].totalQty += Number(entry.QTY) || 0;
      map[sId].entries.push(entry);
    });

    // Count unique products per session
    Object.keys(map).forEach((sId) => {
      const uniqueProductIds = new Set(map[sId].entries.map(e => e['PRODUCT ID']));
      map[sId].itemsCount = uniqueProductIds.size;
    });

    return Object.values(map).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [scrapEntries]);

  // Delete entire session
  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      const { error } = await app_lpos_supabase
        .from('web_INVENTORY_SCRAB')
        .delete()
        .eq('SESSION_ID', sessionToDelete);

      if (error) throw error;
      
      showToast('success', `Session ${sessionToDelete} and all its logs deleted successfully`);
      
      // Close detail view if currently open on deleted session
      if (selectedSessionId === sessionToDelete) {
        setSelectedSessionId(null);
      }

      await fetchScrapEntries();
      setSessionToDelete(null);
    } catch (err: any) {
      console.error('Delete session error:', err);
      showToast('error', err.message || 'Failed to delete session');
    } finally {
      setIsDeletingSession(false);
    }
  };

  // Delete specific individual entry
  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    setIsDeletingEntry(true);
    try {
      const { error } = await app_lpos_supabase
        .from('web_INVENTORY_SCRAB')
        .delete()
        .eq('ID', entryToDelete);

      if (error) throw error;
      
      showToast('success', 'Entry deleted successfully');
      await fetchScrapEntries();
      setEntryToDelete(null);
    } catch (err: any) {
      console.error('Delete entry error:', err);
      showToast('error', err.message || 'Failed to delete entry');
    } finally {
      setIsDeletingEntry(false);
    }
  };

  // Export specific session logs to Excel
  const handleExportSessionExcel = (sessionId: string) => {
    const sessionLogs = scrapEntries.filter(e => e.SESSION_ID === sessionId);
    if (sessionLogs.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(
      sessionLogs.map((e) => ({
        'Session ID': e.SESSION_ID || 'UNTAGGED',
        'Barcode': e['PRODUCT BARCODE'] || '-',
        'Product Name': e['PRODUCT NAME'] || '-',
        'Quantity': e.QTY,
        'Reason': e.REASON,
        'Logged At': new Date(e.CREATED_AT).toLocaleString()
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Session Logs');
    XLSX.writeFile(wb, `BHS_Scrap_Session_${sessionId}.xlsx`);
  };

  // Toast Helper
  const showToast = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage(null);
    }, 4000);
  };

  // Selected session entries (for detail modal)
  const selectedSessionEntries = useMemo(() => {
    if (!selectedSessionId) return [];
    return scrapEntries.filter(e => e.SESSION_ID === selectedSessionId);
  }, [scrapEntries, selectedSessionId]);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {message && (
        <div className="fixed top-24 right-8 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl ${
            message.type === 'success' 
              ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
              : 'bg-red-500 text-white shadow-red-500/20'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="font-bold text-sm">{message.text}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl font-black text-black flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#D4AF37]" />
            Saved Scrap Sessions
          </h3>
        </div>
        
        <button
          onClick={fetchScrapEntries}
          disabled={isEntriesLoading}
          className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-black hover:border-black rounded-2xl shadow-sm transition-all flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
          title="Reload History"
        >
          <RefreshCw className={`w-5 h-5 ${isEntriesLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Session ID</th>
              <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Created At</th>
              <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Items Count</th>
              <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Qty Lost</th>
              <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-36">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isEntriesLoading ? (
              <tr>
                <td colSpan={5} className="py-20">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-black" />
                    <span className="text-sm font-bold text-gray-400">Loading sessions...</span>
                  </div>
                </td>
              </tr>
            ) : groupedSessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center gap-4 text-gray-300">
                    <Layers className="w-14 h-14" />
                    <p className="text-sm font-black text-gray-400 uppercase tracking-wider">No saved sessions found</p>
                  </div>
                </td>
              </tr>
            ) : (
              groupedSessions.map((s) => (
                <tr key={s.sessionId} className="group hover:bg-gray-50/30 transition-all text-center">
                  <td className="py-5 px-4 text-center">
                    <span className="inline-flex px-3 py-1.5 bg-[#D4AF37]/10 rounded-xl text-xs font-black text-[#8a6d1a] border border-[#D4AF37]/20 uppercase">
                      {s.sessionId}
                    </span>
                    {s.sessionId === currentSession && (
                      <span className="ml-2.5 px-2 py-0.5 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-5 px-4">
                    <span className="text-xs text-gray-500 font-bold">
                      {new Date(s.date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </td>
                  <td className="py-5 px-4">
                    <span className="text-sm font-black text-slate-800">{s.itemsCount} Products</span>
                  </td>
                  <td className="py-5 px-4">
                    <span className="text-sm font-black text-black">{s.totalQty.toLocaleString()}</span>
                  </td>
                  <td className="py-5 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedSessionId(s.sessionId)}
                        className="p-2 bg-slate-50 hover:bg-black hover:text-[#D4AF37] rounded-xl text-gray-500 transition-all border border-slate-100 flex items-center justify-center cursor-pointer"
                        title="View Session Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExportSessionExcel(s.sessionId)}
                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-100 flex items-center justify-center cursor-pointer"
                        title="Export Session"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      </button>
                      <button
                        onClick={() => setSessionToDelete(s.sessionId)}
                        className="p-2 bg-slate-50 hover:bg-red-50 hover:text-red-500 rounded-xl text-gray-400 transition-all border border-slate-100 flex items-center justify-center cursor-pointer"
                        title="Delete Entire Session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* MODALS                                                                     */}
      {/* ========================================================================= */}

      {/* Delete Session Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isDeletingSession && setSessionToDelete(null)} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-2xl relative w-full max-w-sm z-10 animate-in zoom-in-95 duration-200">
            <h4 className="text-xl font-black text-black">Delete Session?</h4>
            <p className="text-sm text-gray-500 font-bold mt-2 leading-relaxed">
              Are you sure you want to delete session **{sessionToDelete}**? This will permanently delete all loss entries registered under this session.
            </p>
            
            <div className="flex gap-4 mt-6">
              <button
                type="button"
                disabled={isDeletingSession}
                onClick={() => setSessionToDelete(null)}
                className="flex-1 py-3 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingSession}
                onClick={handleDeleteSession}
                className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeletingSession ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Delete Session'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Entry Modal (Inside details modal) */}
      {entryToDelete && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isDeletingEntry && setEntryToDelete(null)} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-2xl relative w-full max-w-sm z-10 animate-in zoom-in-95 duration-200">
            <h4 className="text-xl font-black text-black">Delete Entry?</h4>
            <p className="text-sm text-gray-500 font-bold mt-2 leading-relaxed">
              Are you sure you want to delete this scrap entry? This action cannot be undone.
            </p>
            
            <div className="flex gap-4 mt-6">
              <button
                type="button"
                disabled={isDeletingEntry}
                onClick={() => setEntryToDelete(null)}
                className="flex-1 py-3 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingEntry}
                onClick={handleDeleteEntry}
                className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeletingEntry ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Delete Entry'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Session Details Drawer/Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedSessionId(null)} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-2xl relative w-full max-w-3xl z-10 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="p-2 text-gray-400 hover:text-black rounded-lg transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h4 className="text-xl font-black text-black">Session Details</h4>
                  <p className="text-xs text-gray-400 font-bold">Logs logged under: **{selectedSessionId}**</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleExportSessionExcel(selectedSessionId)}
                  className="w-10 h-10 bg-white border border-gray-100 text-black hover:bg-slate-50 rounded-xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
                  title="Export to Excel"
                >
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </button>
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="p-2 hover:bg-slate-50 rounded-lg text-gray-400 hover:text-black transition-all cursor-pointer border border-transparent hover:border-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Product List Table */}
            <div className="flex-1 overflow-y-auto py-6">
              <table className="w-full border-collapse text-center">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Barcode</th>
                    <th className="pb-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Product Name</th>
                    <th className="pb-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Quantity</th>
                    <th className="pb-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Reason</th>
                    <th className="pb-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {selectedSessionEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400 text-xs font-bold">
                        No logs inside this session.
                      </td>
                    </tr>
                  ) : (
                    selectedSessionEntries.map((e) => (
                      <tr key={e.ID} className="text-center">
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex px-2.5 py-1 bg-gray-50 rounded-xl text-[11px] font-black text-gray-600 border border-gray-100 uppercase">
                            {e['PRODUCT BARCODE'] || '-'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <p className="text-sm font-black text-black leading-snug line-clamp-2 max-w-[400px] mx-auto" title={e['PRODUCT NAME']}>
                            {e['PRODUCT NAME'] || 'Unknown Product'}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm font-black text-black">
                            {Number(e.QTY).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                            e.REASON === 'EXPIRED'
                              ? 'bg-orange-50/50 text-orange-600 border-orange-100'
                              : 'bg-red-50/50 text-red-600 border-red-100'
                          }`}>
                            {e.REASON}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => setEntryToDelete(e.ID)}
                            className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100 active:scale-90 cursor-pointer"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSessionId(null)}
                className="px-6 py-3 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
