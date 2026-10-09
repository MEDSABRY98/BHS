'use client';

import { useState, useMemo, useEffect } from 'react';
import { SalesInvoice } from '@/lib/supabase';;
import { Search, ChevronLeft, ChevronRight, Loader2, FileText, FileSpreadsheet, FileDown, Settings2, X } from 'lucide-react';
import { generateSalesPricelistPDF } from './Pricelist';
import { generateSalesStockFormPDF } from './StockForm';
import { generateSalesAnalysisComparisonPDF } from './AnalysisComparison';
import NoData from '@/app/Components/DataState/NoDataTab';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';
import JSZip from 'jszip';
import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';
import { exportSalesExcel } from '@/app/Sales/Export/ExcelExport';

interface SalesST_ByCustomersProps {
  customersData: any[];
  refreshTrigger?: number;
  loading: boolean;
  showCosts?: boolean;
}

const ITEMS_PER_PAGE = 50;

export default function SalesST_ByCustomers({ customersData, loading, refreshTrigger, showCosts = true }: SalesST_ByCustomersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [analysisModalConfig, setAnalysisModalConfig] = useState<{ isOpen: boolean; customerName: string | null; mode: 'pdf' | 'excel' | 'bulk_pdf' } | null>(null);
  const [selectedAnalysisCols, setSelectedAnalysisCols] = useState({ barcode: true, product: true, mostPrice: true, maxPrice: true, cost: showCosts, diff: showCosts, margin: showCosts });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredCustomers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return customersData;
    const query = debouncedSearchQuery.toLowerCase().trim();
    return customersData.filter(c =>
      c.customer.toLowerCase().includes(query) ||
      c.customerId.toLowerCase().includes(query) ||
      (c.allNames && c.allNames.some((name: string) => name.includes(query)))
    );
  }, [customersData, debouncedSearchQuery]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearchQuery]);

  const handleDownload = async (customerName: string, mode: 'order' | 'pricelist' | 'analysis', strategy: 'most' | 'max' = 'most', selectedCols?: any) => {
    const customer = customersData.find(c => c.customer === customerName);
    if (!customer) return;
    try {
      setIsGenerating(true);
      const productsToPrint = customer.products.map((p: any) => {
        const maxPrice = (p.pricesDistribution && Array.isArray(p.pricesDistribution) && p.pricesDistribution.length > 0)
          ? Math.max(...p.pricesDistribution)
          : p.mostPrice;

        return {
          barcode: p.barcode,
          product: p.product,
          price: mode === 'pricelist' || mode === 'analysis'
            ? (strategy === 'max' ? maxPrice : p.mostPrice)
            : undefined,
          avgPrice: mode === 'analysis' ? maxPrice : undefined,
          costPrice: mode === 'analysis' ? p.cost : undefined
        };
      });
      if (mode === 'pricelist') {
        await generateSalesPricelistPDF(customer.customer, productsToPrint as any, false, strategy);
      } else if (mode === 'analysis') {
        await generateSalesAnalysisComparisonPDF(customer.customer, productsToPrint as any, false, selectedCols);
      } else {
        await generateSalesStockFormPDF(customer.customer, productsToPrint as any, false);
      }
    } catch (error) { console.error(error); } finally { setIsGenerating(false); }
  };

  const handleExportStandardExcel = async (customerName: string) => {
    const customer = customersData.find(c => c.customer === customerName);
    if (!customer) return;

    try {
      setIsGenerating(true);

      const exportData = customer.products.map((p: any, index: number) => ({
        '#': index + 1,
        Barcode: p.barcode || '-',
        Product: p.product || '-',
        Quantity: '',
      }));

      await exportSalesExcel(exportData, `Standard_Order_Form_${customerName}_${new Date().toISOString().split('T')[0]}.xlsx`, {
        sheetName: 'Order Form',
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportAnalysisExcel = async (customerName: string, selectedCols: any) => {
    const customer = customersData.find(c => c.customer === customerName);
    if (!customer) return;

    try {
      setIsGenerating(true);

      const exportData = customer.products.map((p: any, index: number) => {
        const frequent = p.mostPrice;
        const maxPrice = (p.pricesDistribution && Array.isArray(p.pricesDistribution) && p.pricesDistribution.length > 0)
          ? Math.max(...p.pricesDistribution)
          : p.mostPrice;
        const cost = p.cost;
        const diff = frequent - cost;
        const margin = frequent > 0 ? (diff / frequent) * 100 : 0;

        const row: any = { '#': index + 1 };
        if (selectedCols.barcode) row['Barcode'] = p.barcode;
        if (selectedCols.product) row['Product'] = p.product;
        if (selectedCols.mostPrice) row['Most Price'] = frequent;
        if (selectedCols.maxPrice) row['Max Price'] = maxPrice;

        if (showCosts) {
          if (selectedCols.cost) row['Cost'] = cost;
          if (selectedCols.diff) row['Diff'] = diff;
          if (selectedCols.margin) row['%'] = `${margin.toFixed(1)}%`;
        }

        return row;
      });

      const numericColumns = [];
      if (selectedCols.mostPrice) numericColumns.push('Most Price');
      if (selectedCols.maxPrice) numericColumns.push('Max Price');
      if (showCosts) {
        if (selectedCols.cost) numericColumns.push('Cost');
        if (selectedCols.diff) numericColumns.push('Diff');
      }

      await exportSalesExcel(exportData, `Sales_Analysis_${customerName}_${new Date().toISOString().split('T')[0]}.xlsx`, {
        sheetName: 'Analysis',
        numericColumns,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadAllPDFs = async (mode: 'order' | 'pricelist' | 'analysis', strategy: 'most' | 'max' = 'most', selectedCols?: any) => {
    if (filteredCustomers.length === 0) return;
    setShowDownloadModal(false);
    try {
      setIsGenerating(true);
      setGenerationProgress({ current: 0, total: filteredCustomers.length });
      const zip = new JSZip();
      for (let i = 0; i < filteredCustomers.length; i++) {
        const customer = filteredCustomers[i];
        setGenerationProgress({ current: i + 1, total: filteredCustomers.length });
        const productsToPrint = customer.products.map((p: any) => {
          const maxPrice = (p.pricesDistribution && Array.isArray(p.pricesDistribution) && p.pricesDistribution.length > 0)
            ? Math.max(...p.pricesDistribution)
            : p.mostPrice;

          return {
            barcode: p.barcode,
            product: p.product,
            price: mode === 'pricelist' || mode === 'analysis'
              ? (strategy === 'max' ? maxPrice : p.mostPrice)
              : undefined,
            avgPrice: mode === 'analysis' ? maxPrice : undefined,
            costPrice: mode === 'analysis' ? p.cost : undefined
          };
        });
        let blob: Blob;
        if (mode === 'pricelist') {
          blob = await generateSalesPricelistPDF(customer.customer, productsToPrint as any, true, strategy) as unknown as Blob;
        } else if (mode === 'analysis') {
          blob = await generateSalesAnalysisComparisonPDF(customer.customer, productsToPrint as any, true, selectedCols) as unknown as Blob;
        } else {
          blob = await generateSalesStockFormPDF(customer.customer, productsToPrint as any, true) as unknown as Blob;
        }
        const safeName = customer.customer.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
        zip.file(`${safeName}.pdf`, blob);
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 50));
      }
      const zipName = mode === 'pricelist' ? `Price_Lists_${new Date().toISOString().split('T')[0]}.zip` : mode === 'analysis' ? `Analysis_Reports_${new Date().toISOString().split('T')[0]}.zip` : `Stock_Reports_${new Date().toISOString().split('T')[0]}.zip`;
      const content = await zip.generateAsync({ type: 'blob' });
      saveTrackedAs(content, zipName);
    } catch (error) { console.error(error); } finally { setIsGenerating(false); setGenerationProgress({ current: 0, total: 0 }); }
  };

  if (loading) return <SalesTabLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center pt-2">
        <div className="flex items-center gap-3 w-full max-w-2xl">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:border-green-500 outline-none transition-all shadow-sm text-sm font-medium"
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setShowDownloadModal(true)}
              disabled={isGenerating || filteredCustomers.length === 0}
              className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group disabled:opacity-30 shrink-0"
              title="Bulk Export"
            >
              <FileSpreadsheet className={`h-5 w-5 ${isGenerating ? 'opacity-50' : 'transition-transform group-hover:scale-110'}`} />
            </button>
            {isGenerating && (
              <span className="text-[8px] font-black text-green-600 uppercase animate-pulse">{generationProgress.current}/{generationProgress.total}</span>
            )}
          </div>


        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="py-4 px-8 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Name</th>
                  <th className="py-4 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-[180px]">Items</th>
                  <th className="py-4 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">Standard</th>
                  {showCosts && <th className="py-4 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">Analysis</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedCustomers.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-3 px-8 text-sm font-semibold text-gray-800 truncate" title={c.customer}>{c.customer}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">{c.products.length}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleExportStandardExcel(c.customer)}
                          disabled={isGenerating}
                          className="p-2 bg-white border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all disabled:opacity-30"
                          title="Standard Excel"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(c.customer, 'order')}
                          disabled={isGenerating}
                          className="p-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-600 hover:text-white hover:border-red-600 transition-all disabled:opacity-30"
                          title="Standard PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    {showCosts && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setAnalysisModalConfig({ isOpen: true, customerName: c.customer, mode: 'excel' })}
                            disabled={isGenerating}
                            className="p-2 bg-white border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all disabled:opacity-30"
                            title="Analysis Excel"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setAnalysisModalConfig({ isOpen: true, customerName: c.customer, mode: 'pdf' })}
                            disabled={isGenerating}
                            className="p-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-600 hover:text-white hover:border-red-600 transition-all disabled:opacity-30"
                            title="Analysis PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length > ITEMS_PER_PAGE && (
            <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">Coverage: {filteredCustomers.length} Customers</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
                <div className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 shadow-sm">Page {currentPage} / {totalPages}</div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all shadow-sm"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {showDownloadModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowDownloadModal(false)} />
          <div className="relative bg-white rounded-[40px] shadow-2xl p-10 max-w-sm w-full animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="w-20 h-20 bg-green-100 rounded-[30px] flex items-center justify-center mx-auto mb-8">
              <FileDown className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 text-center mb-2 tracking-tight">Bulk Document Engine</h2>
            <p className="text-slate-400 text-center text-xs font-bold uppercase tracking-[0.1em] mb-10">Exporting {filteredCustomers.length} entities</p>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => handleDownloadAllPDFs('order')}
                className="w-full py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.1em] rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3"
              >
                <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                Generate Stock Reports
              </button>

              {showCosts && (
                <button
                  onClick={() => {
                    setShowDownloadModal(false);
                    setAnalysisModalConfig({ isOpen: true, customerName: null, mode: 'bulk_pdf' });
                  }}
                  className="w-full py-5 bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.1em] rounded-2xl hover:bg-emerald-500 transition-all shadow-xl flex items-center justify-center gap-3"
                >
                  <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  Generate Profit Analysis
                </button>
              )}

              <div className="space-y-2 mt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Price List Exports</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleDownloadAllPDFs('pricelist', 'most')}
                    className="py-5 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-lg flex flex-col items-center gap-2"
                  >
                    <span className="text-white/70 text-[8px]">Mode 1</span>
                    <span>Most Price</span>
                  </button>
                  <button
                    onClick={() => handleDownloadAllPDFs('pricelist', 'max')}
                    className="py-5 bg-amber-100 text-amber-700 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-amber-200 transition-all shadow-sm flex flex-col items-center gap-2"
                  >
                    <span className="text-amber-500/70 text-[8px]">Mode 2</span>
                    <span>Max Price</span>
                  </button>
                </div>
              </div>

            </div>
            <button onClick={() => setShowDownloadModal(false)} className="mt-8 w-full text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">Abort Engine</button>
          </div>
        </div>
      )}
      {analysisModalConfig?.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setAnalysisModalConfig(null)} />
          <div className="relative bg-white rounded-[32px] shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-300 border border-white/20">
            <button onClick={() => setAnalysisModalConfig(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-blue-50 rounded-[24px] flex items-center justify-center mx-auto mb-6">
              <Settings2 className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900 text-center mb-1 tracking-tight">Select Columns</h2>
            <p className="text-slate-500 text-center text-xs font-bold uppercase tracking-wider mb-8">Customize your report</p>
            
            <div className="space-y-2 mb-8">
              {Object.keys(selectedAnalysisCols).map((key) => {
                const labelMap: any = { barcode: 'Barcode', product: 'Product', mostPrice: 'Most Price', maxPrice: 'Max Price', cost: 'Cost', diff: 'Difference', margin: 'Margin %' };
                if ((key === 'cost' || key === 'diff' || key === 'margin') && !showCosts) return null;
                const isChecked = (selectedAnalysisCols as any)[key];
                
                return (
                  <label key={key} className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border ${isChecked ? 'bg-blue-50/50 border-blue-100 shadow-sm scale-[1.02]' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}>
                    <span className={`text-sm font-bold transition-colors ${isChecked ? 'text-blue-900' : 'text-slate-500'}`}>{labelMap[key]}</span>
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={isChecked} 
                        onChange={(e) => setSelectedAnalysisCols(prev => ({ ...prev, [key]: e.target.checked }))} 
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${isChecked ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <div className={`absolute left-[2px] top-[2px] w-5 h-5 rounded-full transition-transform duration-300 flex items-center justify-center bg-white shadow-sm ${isChecked ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <button
              onClick={() => {
                const { customerName, mode } = analysisModalConfig;
                setAnalysisModalConfig(null);
                if (mode === 'bulk_pdf') {
                  handleDownloadAllPDFs('analysis', 'most', selectedAnalysisCols);
                } else if (mode === 'pdf' && customerName) {
                  handleDownload(customerName, 'analysis', 'most', selectedAnalysisCols);
                } else if (mode === 'excel' && customerName) {
                  handleExportAnalysisExcel(customerName, selectedAnalysisCols);
                }
              }}
              className="w-full py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.1em] rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              Generate Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

