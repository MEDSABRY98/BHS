'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
import {
  Search,
  Trash2,
  Loader2,
  AlertTriangle,
  Calendar,
  Sparkles,
  TrendingDown,
  CheckCircle2,
  Box,
  X,
  Plus,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '@/components/01-Unified/Notification';

interface Product {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT NAME': string;
  'PRODUCT BARCODE': string;
  'ITEM CODE'?: number | null;
}

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

interface RecordScrapTabProps {
  scrapEntries: ScrapEntry[];
  isEntriesLoading: boolean;
  fetchScrapEntries: () => Promise<void>;
  currentSession: string;
  setCurrentSession: (session: string) => void;
}

export default function RecordScrapTab({
  scrapEntries,
  isEntriesLoading,
  fetchScrapEntries,
  currentSession,
  setCurrentSession
}: RecordScrapTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState<string>('');
  const [reason, setReason] = useState<'EXPIRED' | 'DAMAGED'>('EXPIRED');
  const [showDropdown, setShowDropdown] = useState(false);

  // Confirm States
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [sessionToSaveConfirm, setSessionToSaveConfirm] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  // Fetch all products from database for local search filter (using recursive pagination to load all products bypass API limit)
  const fetchProducts = async () => {
    try {
      setIsProductsLoading(true);
      let allProducts: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const start = page * pageSize;
        const end = start + pageSize - 1;
        const { data, error } = await app_lpos_supabase
          .from('bhs_PRODUCTS')
          .select('*')
          .order('PRODUCT NAME')
          .range(start, end);

        if (error) throw error;

        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      setProducts(allProducts);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setIsProductsLoading(false);
    }
  };

  const calculateNextSessionId = (entries: { SESSION_ID: string }[], currentSessionId?: string) => {
    const sessionIds = new Set<string>();
    if (entries) {
      entries.forEach(e => {
        if (e.SESSION_ID) sessionIds.add(e.SESSION_ID);
      });
    }
    if (currentSessionId) {
      sessionIds.add(currentSessionId);
    }

    let maxNum = 0;
    sessionIds.forEach(id => {
      const match = id.match(/^S-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    return `S-${String(nextNum).padStart(4, '0')}`;
  };

  const calculateNextRecordId = (entries: ScrapEntry[]) => {
    if (!entries || entries.length === 0) {
      return 'R-0001';
    }

    let maxNum = 0;
    entries.forEach(e => {
      if (e.ID) {
        const match = e.ID.match(/^R-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    });

    const nextNum = maxNum + 1;
    return `R-${String(nextNum).padStart(4, '0')}`;
  };

  // Roll over to a new session
  const handleSaveAndNewSession = async () => {
    try {
      const nextSession = calculateNextSessionId(scrapEntries, currentSession);
      const { error } = await app_lpos_supabase
        .from('web_system_settings')
        .upsert({ key: 'active_scrap_session', value: nextSession });

      if (error) throw error;

      setCurrentSession(nextSession);
      setSessionToSaveConfirm(false);
      toast.success(`Session saved! New session started: ${nextSession}`);
      await fetchScrapEntries();
    } catch (err: any) {
      console.error('Error saving session:', err);
      toast.error(err.message || 'Failed to roll over session');
    }
  };

  // Local autocomplete filter
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const name = p['PRODUCT NAME']?.toLowerCase() || '';
      const barcode = p['PRODUCT BARCODE']?.toLowerCase() || '';
      const id = p['PRODUCT ID']?.toLowerCase() || '';
      const itemCode = p['ITEM CODE'] != null ? String(p['ITEM CODE']).toLowerCase() : '';
      return name.includes(query) || barcode.includes(query) || id.includes(query) || itemCode.includes(query);
    }).slice(0, 10);
  }, [searchQuery, products]);

  // Submit scrap entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error('Please select a product first');
      return;
    }
    const numQty = parseFloat(qty);
    if (isNaN(numQty) || numQty <= 0) {
      toast.error('Please enter a valid quantity greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const nextRecordId = calculateNextRecordId(scrapEntries);
      const { error } = await app_lpos_supabase
        .from('web_INVENTORY_SCRAB')
        .insert({
          ID: nextRecordId,
          'PRODUCT ID': selectedProduct['PRODUCT ID'],
          QTY: numQty,
          REASON: reason,
          SESSION_ID: currentSession
        });

      if (error) throw error;

      toast.success('Entry added to current session!');
      
      // Reset form fields
      setSelectedProduct(null);
      setQty('');
      setSearchQuery('');
      
      // Reload parent list
      await fetchScrapEntries();
    } catch (err: any) {
      console.error('Error saving scrap entry:', err);
      toast.error(err.message || 'Failed to save scrap entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete scrap entry
  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await app_lpos_supabase
        .from('web_INVENTORY_SCRAB')
        .delete()
        .eq('ID', entryToDelete);

      if (error) throw error;
      toast.success('Entry deleted successfully');
      await fetchScrapEntries();
      setEntryToDelete(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Failed to delete entry');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export session to Excel
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



  // Filter for current active session
  const currentSessionEntries = useMemo(() => {
    return scrapEntries.filter(e => e.SESSION_ID === currentSession);
  }, [scrapEntries, currentSession]);

  // Current session metrics
  const currentSessionMetrics = useMemo(() => {
    let totalQty = 0;
    let expiredQty = 0;
    let damagedQty = 0;

    currentSessionEntries.forEach((entry) => {
      const q = Number(entry.QTY) || 0;
      totalQty += q;
      if (entry.REASON === 'EXPIRED') expiredQty += q;
      else if (entry.REASON === 'DAMAGED') damagedQty += q;
    });

    return { totalQty, expiredQty, damagedQty };
  }, [currentSessionEntries]);

  return (
    <div className="space-y-8">

      {/* Active Session Code Card */}
      <div className="bg-black text-white rounded-[2rem] p-6 border border-gray-900 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-white/10 text-[#D4AF37]">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase">Current Active Session</p>
            <p className="text-xl font-black text-[#D4AF37] tracking-tight mt-1">{currentSession}</p>
          </div>
        </div>
        
        {currentSessionEntries.length > 0 ? (
          <button
            onClick={() => setSessionToSaveConfirm(true)}
            className="px-6 py-3.5 bg-[#D4AF37] hover:bg-[#c9a32c] text-black rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-[#D4AF37]/10 transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4" />
            Save Session
          </button>
        ) : (
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider py-2 px-4 bg-white/5 border border-white/5 rounded-xl">
            Add products below to log under this session
          </span>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 rounded-2xl bg-black">
            <Box className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase">Session Total Qty</p>
            <p className="text-3xl font-black text-black tracking-tighter mt-1">{currentSessionMetrics.totalQty.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 rounded-2xl bg-orange-50 text-orange-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase">Session Expired</p>
            <p className="text-3xl font-black text-black tracking-tighter mt-1">{currentSessionMetrics.expiredQty.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase">Session Damaged</p>
            <p className="text-3xl font-black text-black tracking-tighter mt-1">{currentSessionMetrics.damagedQty.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Record Scrap Row Form */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl shadow-black/[0.02]">
        <h3 className="text-xl font-black text-black mb-6 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          Record Scrap Product
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          {/* Search Box / Selected Product */}
          <div className="lg:col-span-6 space-y-2 relative">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Search Product
            </label>
            
            {!selectedProduct ? (
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or barcode..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full pl-13 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:bg-white focus:border-black transition-all text-sm font-bold text-black"
                />
                
                {/* Suggestion Dropdown */}
                {showDropdown && searchQuery.trim() && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                    <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl z-20 max-h-64 overflow-y-auto divide-y divide-gray-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      {isProductsLoading ? (
                        <div className="flex items-center justify-center p-6 text-gray-400 gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-xs font-bold">Loading products...</span>
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-xs font-bold">
                          No matching products found
                        </div>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.ID}
                            type="button"
                            onClick={() => {
                              setSelectedProduct(p);
                              setShowDropdown(false);
                              setSearchQuery('');
                            }}
                            className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                          >
                            <span className="text-sm font-black text-black leading-snug line-clamp-1">
                              {p['PRODUCT NAME']}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex justify-between">
                              <span>Barcode: {p['PRODUCT BARCODE'] || 'N/A'}</span>
                              {p['ITEM CODE'] != null && (
                                <span className="text-[#B8960C]">Code: {p['ITEM CODE']}</span>
                              )}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Selected Product Display */
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 relative flex items-center justify-between gap-4 h-[58px]">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-[#D4AF37] uppercase tracking-widest leading-none mb-1">Selected Product</p>
                  <h4 className="text-xs font-black text-black leading-none truncate" title={selectedProduct['PRODUCT NAME']}>
                    {selectedProduct['PRODUCT NAME']}
                  </h4>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedProduct['ITEM CODE'] != null && (
                    <span className="px-2 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-lg text-[9px] font-bold text-[#B8960C] font-mono">
                      Code: {selectedProduct['ITEM CODE']}
                    </span>
                  )}
                  <span className="px-2 py-1 bg-white border border-gray-100 rounded-lg text-[9px] font-bold text-gray-500">
                    BC: {selectedProduct['PRODUCT BARCODE'] || 'N/A'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="w-7 h-7 bg-white hover:bg-red-50 hover:text-red-500 rounded-lg shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 transition-all active:scale-95 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quantity Input */}
          <div className="lg:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Scrap Qty
            </label>
            <input
              type="number"
              step="any"
              placeholder="Qty..."
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:bg-white focus:border-black transition-all text-sm font-bold text-black h-[58px]"
            />
          </div>

          {/* Reason Selection */}
          <div className="lg:col-span-3 space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Reason of Scrap
            </label>
            <div className="grid grid-cols-2 gap-3 p-1 bg-gray-50 rounded-2xl border border-gray-100 h-[58px]">
              <button
                type="button"
                onClick={() => setReason('EXPIRED')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${
                  reason === 'EXPIRED'
                    ? 'bg-white text-black shadow-sm border border-gray-100'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Calendar className={`w-4 h-4 ${reason === 'EXPIRED' ? 'text-[#D4AF37]' : ''}`} />
                Expired
              </button>
              <button
                type="button"
                onClick={() => setReason('DAMAGED')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${
                  reason === 'DAMAGED'
                    ? 'bg-black text-[#D4AF37] shadow-xl'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Damaged
              </button>
            </div>
          </div>

          {/* Record Button */}
          <div className="lg:col-span-1">
            <button
              type="submit"
              disabled={isSubmitting || !selectedProduct}
              className="w-full py-4 bg-[#D4AF37] text-black hover:bg-[#c9a32c] disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl shadow-xl shadow-[#D4AF37]/10 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer h-[58px]"
              title="Add to Session"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5 stroke-[3]" />
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Bottom Area: Current Session Logs List */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm min-h-[400px] flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black text-black flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-[#D4AF37]" />
              Current Session Logs
            </h3>
            <p className="text-xs text-gray-400 font-bold mt-0.5">Showing logs in {currentSession}</p>
          </div>

          {currentSessionEntries.length > 0 && (
            <button
              onClick={() => handleExportSessionExcel(currentSession)}
              className="w-10 h-10 bg-white border border-gray-100 text-black hover:bg-slate-50 rounded-xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
              title="Export Session Excel"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </button>
          )}
        </div>

        {/* Entries Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Barcode</th>
                <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Product Name</th>
                <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Quantity</th>
                <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Reason</th>
                <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isEntriesLoading ? (
                <tr>
                  <td colSpan={5} className="py-20">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-10 h-10 animate-spin text-black" />
                      <span className="text-sm font-bold text-gray-400">Loading current batch logs...</span>
                    </div>
                  </td>
                </tr>
              ) : currentSessionEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 text-gray-300">
                      <Box className="w-14 h-14" />
                      <p className="text-sm font-black text-gray-400 uppercase tracking-wider">No logs in this session yet</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentSessionEntries.map((e) => (
                  <tr key={e.ID} className="group hover:bg-gray-50/30 transition-all text-center animate-in fade-in duration-200">
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex px-2.5 py-1 bg-gray-50 rounded-xl text-[11px] font-black text-gray-600 border border-gray-100 uppercase">
                        {e['PRODUCT BARCODE'] || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <p className="text-sm font-black text-black leading-snug line-clamp-1 max-w-[400px] mx-auto" title={e['PRODUCT NAME']}>
                        {e['PRODUCT NAME'] || 'Unknown Product'}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-sm font-black text-black">
                        {Number(e.QTY).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                        e.REASON === 'EXPIRED'
                          ? 'bg-orange-50/50 text-orange-600 border-orange-100'
                          : 'bg-red-50/50 text-red-600 border-red-100'
                      }`}>
                        {e.REASON}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEntryToDelete(e.ID)}
                          className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100 active:scale-90 cursor-pointer"
                          title="Delete Entry"
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
      </div>

      {/* Deletion Confirm Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isDeleting && setEntryToDelete(null)} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-2xl relative w-full max-w-sm z-10 animate-in zoom-in-95 duration-200">
            <h4 className="text-xl font-black text-black">Confirm Deletion</h4>
            <p className="text-sm text-gray-500 font-bold mt-2 leading-relaxed">
              Are you sure you want to delete this scrap entry? This action cannot be undone.
            </p>
            
            <div className="flex gap-4 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setEntryToDelete(null)}
                className="flex-1 py-3 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteEntry}
                className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Session Confirmation Modal */}
      {sessionToSaveConfirm && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSessionToSaveConfirm(false)} />
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-2xl relative w-full max-w-md z-10 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-[#D4AF37] mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-black text-black">Save Active Session?</h4>
            <p className="text-sm text-gray-500 font-bold mt-2 leading-relaxed">
              Saving the session **{currentSession}** marks this batch of entries as completed.
              A new Session ID code will be generated for your next batch of logs.
            </p>
            
            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={() => setSessionToSaveConfirm(false)}
                className="flex-1 py-3 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAndNewSession}
                className="flex-1 py-3 bg-black text-[#D4AF37] hover:bg-gray-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Save & Start New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
