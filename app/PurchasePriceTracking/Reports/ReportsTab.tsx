import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileSpreadsheet, Download, Building2, Package, Search, ChevronDown, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import { PurchaseRecord, Product, Supplier } from '../page';
import { generateSupplierPriceHistoryReport } from './SupplierPriceHistoryReport';
import { generateProductSupplierComparisonReport } from './ProductSupplierComparisonReport';
import { generatePriceInflationReport } from './PriceInflationReport';
import { generateSupplierDependencyReport } from './SupplierDependencyReport';

interface SearchableSelectProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  colorTheme?: 'blue' | 'emerald';
}

function SearchableSelect({ options, value, onChange, placeholder, colorTheme = 'blue' }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
  const selectedOption = options.find(opt => opt.id === value);
  const focusRing = colorTheme === 'emerald' ? 'focus:ring-emerald-500/50 focus:border-emerald-500' : 'focus:ring-blue-500/50 focus:border-blue-500';

  return (
    <div className="relative" ref={selectRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-50 border border-slate-200 p-4 rounded-xl cursor-pointer flex justify-between items-center transition-all hover:bg-slate-100 outline-none tabindex-0 ${isOpen ? focusRing : ''}`}
      >
        <span className={selectedOption ? "text-slate-900 font-bold truncate pr-2" : "text-slate-400 font-medium truncate pr-2"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50 sticky top-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className={`w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all ${focusRing}`}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">No results found</div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                    opt.id === value 
                      ? 'bg-[#D4AF37]/10 text-[#b8962e] font-bold' 
                      : 'hover:bg-slate-50 text-slate-700 font-medium hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
}

export default function ReportsTab({ purchases, products, suppliers }: Props) {
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isGenerating1, setIsGenerating1] = useState(false);
  const [isGenerating2, setIsGenerating2] = useState(false);
  const [isGenerating3, setIsGenerating3] = useState(false);
  const [isGenerating4, setIsGenerating4] = useState(false);

  const activeSuppliers = useMemo(() => {
    const supplierIds = new Set(purchases.map(p => p.supplierId));
    return suppliers.filter(s => supplierIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name)).map(s => ({ id: s.id, label: s.name }));
  }, [purchases, suppliers]);

  const activeProducts = useMemo(() => {
    const productIds = new Set(purchases.map(p => p.productId));
    return products.filter(p => productIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ id: p.id, label: p.barcode ? `[${p.barcode}] ${p.name}` : p.name }));
  }, [purchases, products]);

  const handleDownloadSupplierReport = async () => {
    if (!selectedSupplierId) return;
    setIsGenerating1(true);
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (supplier) {
      await generateSupplierPriceHistoryReport(supplier.id, supplier.name, purchases, products, fromDate, toDate);
    }
    setIsGenerating1(false);
  };

  const handleDownloadProductReport = async () => {
    if (!selectedProductId) return;
    setIsGenerating2(true);
    const product = products.find(p => p.id === selectedProductId);
    if (product) {
      await generateProductSupplierComparisonReport(product.id, product.name, purchases, suppliers, fromDate, toDate);
    }
    setIsGenerating2(false);
  };

  const handleDownloadInflationReport = async () => {
    setIsGenerating3(true);
    await generatePriceInflationReport(purchases, products, fromDate, toDate);
    setIsGenerating3(false);
  };

  const handleDownloadDependencyReport = async () => {
    setIsGenerating4(true);
    await generateSupplierDependencyReport(purchases, products, suppliers, fromDate, toDate);
    setIsGenerating4(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-[#D4AF37]" />
            Excel Reports
          </h2>
          <p className="text-slate-500 font-medium mt-1">Generate and download detailed Excel reports for analysis.</p>
        </div>

        <div className="flex flex-row items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="From Date"
              className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] font-medium transition-all"
            />
          </div>
          <span className="text-slate-300 font-bold">-</span>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="To Date"
              className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] font-medium transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Report 1: Supplier Price History */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-blue-500 flex flex-col hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Building2 className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 leading-tight">Supplier History</h3>
              <p className="text-xs text-slate-500 mt-1">Product price changes over time</p>
            </div>
          </div>
          
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Select Supplier</label>
              <SearchableSelect 
                options={activeSuppliers}
                value={selectedSupplierId}
                onChange={setSelectedSupplierId}
                placeholder="Search supplier..."
                colorTheme="blue"
              />
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={handleDownloadSupplierReport}
              disabled={!selectedSupplierId || isGenerating1}
              className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#D4AF37] hover:text-black hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating1 ? <span className="animate-pulse">Generating...</span> : <><Download className="w-5 h-5" /> Download Excel</>}
            </button>
          </div>
        </div>

        {/* Report 2: Product Supplier Comparison */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-emerald-500 flex flex-col hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Package className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 leading-tight">Product Comparison</h3>
              <p className="text-xs text-slate-500 mt-1">Compare prices across suppliers</p>
            </div>
          </div>
          
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Select Product</label>
              <SearchableSelect 
                options={activeProducts}
                value={selectedProductId}
                onChange={setSelectedProductId}
                placeholder="Search product..."
                colorTheme="emerald"
              />
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={handleDownloadProductReport}
              disabled={!selectedProductId || isGenerating2}
              className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#D4AF37] hover:text-black hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating2 ? <span className="animate-pulse">Generating...</span> : <><Download className="w-5 h-5" /> Download Excel</>}
            </button>
          </div>
        </div>

        {/* Report 3: Supplier Dependency */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-purple-500 flex flex-col hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-50 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 leading-tight">Supplier Dependency</h3>
              <p className="text-xs text-slate-500 mt-1">Identify high-risk single sourcing</p>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <p className="text-sm font-medium text-slate-500">
              Analyzes all products to find which ones are heavily dependent on a single supplier, highlighting sourcing risks.
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={handleDownloadDependencyReport}
              disabled={isGenerating4}
              className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#D4AF37] hover:text-black hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating4 ? <span className="animate-pulse">Generating...</span> : <><Download className="w-5 h-5" /> Download Excel</>}
            </button>
          </div>
        </div>

        {/* Report 4: Price Inflation */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-rose-500 flex flex-col hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-rose-50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 leading-tight">Price Inflation</h3>
              <p className="text-xs text-slate-500 mt-1">Global price increases/decreases</p>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <p className="text-sm font-medium text-slate-500">
              Generates a comprehensive report showing the inflation or deflation percentage for all products across the selected date range.
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={handleDownloadInflationReport}
              disabled={isGenerating3}
              className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#D4AF37] hover:text-black hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating3 ? <span className="animate-pulse">Generating...</span> : <><Download className="w-5 h-5" /> Download Excel</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
