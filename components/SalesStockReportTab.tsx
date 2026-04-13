'use client';

import { useState, useMemo, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, FileDown, ChevronLeft, ChevronRight, Loader2, DollarSign, FileText } from 'lucide-react';
import { generateDownloadFormPDF } from '@/lib/pdf/PdfUtils';
import NoData from './Unified/NoData';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface SalesStockReportTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

const ITEMS_PER_PAGE = 50;

const calculateMode = (numbers: number[]): number => {
  if (!numbers || numbers.length === 0) return 0;
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let mode = numbers[0];
  for (const n of numbers) {
    const val = parseFloat(n.toFixed(2));
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount) {
      maxCount = counts[val];
      mode = val;
    }
  }
  return mode;
};

export default function SalesStockReportTab({ data, loading }: SalesStockReportTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const customersData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const customerMap = new Map<string, Map<string, { barcode: string; product: string; prices: number[] }>>();

    data.forEach(item => {
      const custName = item.customerName || 'Unknown';
      if (!customerMap.has(custName)) customerMap.set(custName, new Map());
      const productsMap = customerMap.get(custName)!;
      const productKey = item.productId || item.barcode || item.product;

      const itemAny = item as any;
      let price = itemAny.price || itemAny.unitPrice || 0;
      if (!price && itemAny.amount && itemAny.qty) price = itemAny.amount / itemAny.qty;
      const pNum = parseFloat(price);

      if (!productsMap.has(productKey)) {
        productsMap.set(productKey, {
          barcode: item.barcode || '-',
          product: item.product || '-',
          prices: []
        });
      }
      if (!isNaN(pNum) && pNum > 0) productsMap.get(productKey)!.prices.push(pNum);
    });

    return Array.from(customerMap.entries()).map(([customerName, productsMap]) => ({
      customer: customerName,
      products: Array.from(productsMap.values()).sort((a, b) => a.product.localeCompare(b.product))
    })).sort((a, b) => a.customer.localeCompare(b.customer));
  }, [data]);

  const filteredCustomers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return customersData;
    const query = debouncedSearchQuery.toLowerCase().trim();
    return customersData.filter(c => c.customer.toLowerCase().includes(query));
  }, [customersData, debouncedSearchQuery]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearchQuery]);

  const handleDownload = async (customerName: string, mode: 'order' | 'pricelist') => {
    const customer = customersData.find(c => c.customer === customerName);
    if (!customer) return;
    try {
      setIsGenerating(true);
      const productsToPrint = customer.products.map(p => ({
        barcode: p.barcode,
        product: p.product,
        price: mode === 'pricelist' ? calculateMode(p.prices) : undefined
      }));
      await generateDownloadFormPDF(customer.customer, productsToPrint, false, mode);
    } catch (error) { console.error(error); } finally { setIsGenerating(false); }
  };

  const handleDownloadAllPDFs = async (mode: 'order' | 'pricelist') => {
    if (filteredCustomers.length === 0) return;
    setShowDownloadModal(false);
    try {
      setIsGenerating(true);
      setGenerationProgress({ current: 0, total: filteredCustomers.length });
      const zip = new JSZip();
      for (let i = 0; i < filteredCustomers.length; i++) {
        const customer = filteredCustomers[i];
        setGenerationProgress({ current: i + 1, total: filteredCustomers.length });
        const productsToPrint = customer.products.map(p => ({
          barcode: p.barcode,
          product: p.product,
          price: mode === 'pricelist' ? calculateMode(p.prices) : undefined
        }));
        const blob = await generateDownloadFormPDF(customer.customer, productsToPrint, true, mode) as Blob;
        const safeName = customer.customer.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
        zip.file(`${safeName}.pdf`, blob);
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 50));
      }
      const zipName = mode === 'pricelist' ? `Price_Lists_${new Date().toISOString().split('T')[0]}.zip` : `Stock_Reports_${new Date().toISOString().split('T')[0]}.zip`;
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, zipName);
    } catch (error) { console.error(error); } finally { setIsGenerating(false); setGenerationProgress({ current: 0, total: 0 }); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium text-slate-800 tracking-tight">Sales Stock Reports</h1>
        </div>

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
              className="p-2.5 bg-green-600 text-white rounded-xl shadow-md shadow-green-100 hover:bg-green-700 transition-all active:scale-95 shrink-0 flex items-center gap-2"
              title="Bulk Export"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
            </button>
            {isGenerating && (
              <span className="text-[8px] font-black text-green-600 uppercase animate-pulse">{generationProgress.current}/{generationProgress.total}</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="py-4 px-8 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Name</th>
                <th className="py-4 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Items</th>
                <th className="py-4 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Standard Mode</th>
                <th className="py-4 px-8 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Pricing Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCustomers.length === 0 ? (
                <tr><td colSpan={4} className="py-20"><NoData /></td></tr>
              ) : (
                paginatedCustomers.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-3 px-8 text-sm font-semibold text-gray-800">{c.customer}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">{c.products.length}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDownload(c.customer, 'order')}
                        disabled={isGenerating}
                        className="px-4 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 mx-auto disabled:opacity-30"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Order Form</span>
                      </button>
                    </td>
                    <td className="py-3 px-8 text-center">
                      <button
                        onClick={() => handleDownload(c.customer, 'pricelist')}
                        disabled={isGenerating}
                        className="px-4 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 mx-auto disabled:opacity-30"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Price List</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
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
                className="w-full py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-800 transition-all shadow-xl"
              >
                Generate Stock Reports
              </button>
              <button
                onClick={() => handleDownloadAllPDFs('pricelist')}
                className="w-full py-5 bg-green-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-green-700 transition-all shadow-xl"
              >
                Generate Price Lists
              </button>
            </div>
            <button onClick={() => setShowDownloadModal(false)} className="mt-8 w-full text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">Abort Engine</button>
          </div>
        </div>
      )}
    </div>
  );
}
