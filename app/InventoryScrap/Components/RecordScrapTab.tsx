'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllProductsForScrap, saveDirectScrapReport } from '../Service/InventoryScrapService';
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
  Save
} from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';

interface Product {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT NAME': string;
  'PRODUCT BARCODE': string;
  'ITEM CODE'?: number | null;
}

interface DraftEntry {
  ID: string;
  PRODUCT_ID: string;
  PRODUCT_BARCODE: string;
  PRODUCT_NAME: string;
  QTY: number;
  REASON: 'EXPIRED' | 'DAMAGED';
  UNIT: string;
}

interface RecordScrapTabProps {
  onReportSaved?: () => void;
}

export default function RecordScrapTab({ onReportSaved }: RecordScrapTabProps = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isSavingReport, setIsSavingReport] = useState(false);
  
  // Draft Items State
  const [draftItems, setDraftItems] = useState<DraftEntry[]>([]);

  // Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState<string>('');
  const [reason, setReason] = useState<'EXPIRED' | 'DAMAGED'>('EXPIRED');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsProductsLoading(true);
      const allProducts = await fetchAllProductsForScrap();
      setProducts(allProducts);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setIsProductsLoading(false);
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

  // Add item to draft
  const handleAddItem = (e: React.FormEvent) => {
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

    const newItem: DraftEntry = {
      ID: Math.random().toString(36).substring(7),
      PRODUCT_ID: selectedProduct['PRODUCT ID'],
      PRODUCT_BARCODE: selectedProduct['PRODUCT BARCODE'],
      PRODUCT_NAME: selectedProduct['PRODUCT NAME'],
      QTY: numQty,
      REASON: reason,
      UNIT: 'PCS'
    };

    setDraftItems(prev => [...prev, newItem]);
    
    // Reset form
    setSelectedProduct(null);
    setQty('');
    setSearchQuery('');
  };

  // Remove item from draft
  const handleRemoveDraftItem = (id: string) => {
    setDraftItems(prev => prev.filter(item => item.ID !== id));
  };

  // Save the entire report
  const handleSaveReport = async () => {
    if (draftItems.length === 0) {
      toast.error('No items to save.');
      return;
    }
    
    setIsSavingReport(true);
    try {
      const payload = draftItems.map(item => ({
        productId: item.PRODUCT_ID,
        qty: item.QTY,
        reason: item.REASON,
        unit: item.UNIT
      }));

      const res = await saveDirectScrapReport(payload);
      toast.success(`Report ${res.reportId} saved successfully!`);
      
      // Clear drafts
      setDraftItems([]);
      if (onReportSaved) {
        onReportSaved();
      }
    } catch (err: any) {
      console.error('Error saving report:', err);
      toast.error(err.message || 'Failed to save report');
    } finally {
      setIsSavingReport(false);
    }
  };

  const draftMetrics = useMemo(() => {
    let totalQty = 0;
    let expiredQty = 0;
    let damagedQty = 0;

    draftItems.forEach((entry) => {
      const q = Number(entry.QTY) || 0;
      totalQty += q;
      if (entry.REASON === 'EXPIRED') expiredQty += q;
      else if (entry.REASON === 'DAMAGED') damagedQty += q;
    });

    return { totalQty, expiredQty, damagedQty };
  }, [draftItems]);

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 rounded-2xl bg-black">
            <Box className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase">Draft Total Qty</p>
            <p className="text-3xl font-black text-black tracking-tighter mt-1">{draftMetrics.totalQty.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 rounded-2xl bg-orange-50 text-orange-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase">Draft Expired</p>
            <p className="text-3xl font-black text-black tracking-tighter mt-1">{draftMetrics.expiredQty.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase">Draft Damaged</p>
            <p className="text-3xl font-black text-black tracking-tighter mt-1">{draftMetrics.damagedQty.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Record Scrap Row Form */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl shadow-black/[0.02]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-black text-black flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
            Record Scrap Product
          </h3>
          
          <button
            onClick={handleSaveReport}
            disabled={draftItems.length === 0 || isSavingReport}
            className="px-6 py-3.5 bg-[#D4AF37] hover:bg-[#c9a32c] text-black rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-[#D4AF37]/10 transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSavingReport ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Report
          </button>
        </div>

        <form onSubmit={handleAddItem} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
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
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${reason === 'EXPIRED'
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
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${reason === 'DAMAGED'
                  ? 'bg-black text-[#D4AF37] shadow-xl'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Damaged
              </button>
            </div>
          </div>

          {/* Add Button */}
          <div className="lg:col-span-1">
            <button
              type="submit"
              disabled={!selectedProduct}
              className="w-full py-4 bg-black text-[#D4AF37] hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer h-[58px]"
              title="Add to Draft"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
            </button>
          </div>
        </form>
      </div>

      {/* Bottom Area: Draft Items List */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm min-h-[400px] flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black text-black flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-[#D4AF37]" />
              Draft Scrap Items
            </h3>
            <p className="text-xs text-gray-400 font-bold mt-0.5">These items will be included when you save the report</p>
          </div>
        </div>

        {/* Entries Table */}
        {draftItems.length === 0 ? (
          <NoData title="No Draft Items" message="Add items from the form above." />
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Barcode</th>
                  <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Product Name</th>
                  <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Quantity</th>
                  <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Reason</th>
                  <th className="pb-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center w-16">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                  {draftItems.map((e) => (
                    <tr key={e.ID} className="group hover:bg-gray-50/30 transition-all text-center animate-in fade-in duration-200">
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex px-2.5 py-1 bg-gray-50 rounded-xl text-[11px] font-black text-gray-600 border border-gray-100 uppercase">
                          {e.PRODUCT_BARCODE || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <p className="text-sm font-black text-black leading-snug line-clamp-1 max-w-[400px] mx-auto" title={e.PRODUCT_NAME}>
                          {e.PRODUCT_NAME || 'Unknown Product'}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm font-black text-black">
                          {Number(e.QTY).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${e.REASON === 'EXPIRED'
                          ? 'bg-orange-50/50 text-orange-600 border-orange-100'
                          : 'bg-red-50/50 text-red-600 border-red-100'
                          }`}>
                          {e.REASON}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleRemoveDraftItem(e.ID)}
                            className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100 active:scale-90 cursor-pointer"
                            title="Remove from draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
