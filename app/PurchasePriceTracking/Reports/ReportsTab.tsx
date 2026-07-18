import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileSpreadsheet, Download, Building2, Package, Search, ChevronDown, Calendar, TrendingUp, AlertTriangle, ListOrdered, Filter } from 'lucide-react';
import { PurchaseRecord, Product, Supplier } from '../page';
import { generateSupplierPriceHistoryReport } from './SupplierPriceHistoryReport';
import { generateProductSupplierComparisonReport } from './ProductSupplierComparisonReport';
import { generatePriceInflationReport } from './PriceInflationReport';
import { generateSupplierDependencyReport } from './SupplierDependencyReport';
import { generateProductPriceSequenceReport } from './ProductPriceSequenceReport';
import { ReportFilters } from './ReportFilters';

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
  const selectedOption = options.find(opt => opt.id === value);
  const focusRing = colorTheme === 'emerald' ? 'focus:ring-emerald-500/50 focus:border-emerald-500' : 'focus:ring-blue-500/50 focus:border-blue-500';

  return (
    <div className="relative" ref={selectRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl cursor-pointer flex justify-between items-center transition-all hover:bg-slate-100 outline-none ${isOpen ? focusRing : ''}`}
      >
        <span className={selectedOption ? 'text-slate-900 font-bold truncate pr-2' : 'text-slate-400 font-medium truncate pr-2'}>
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
                  key={opt.id || '__all__'}
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
  const [isGenerating5, setIsGenerating5] = useState(false);

  const activeSuppliers = useMemo(() => {
    const supplierIds = new Set(purchases.map(p => p.supplierId));
    return suppliers
      .filter(s => supplierIds.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => ({ id: s.id, label: s.name }));
  }, [purchases, suppliers]);

  const supplierOptions = useMemo(
    () => [{ id: '', label: 'All Suppliers' }, ...activeSuppliers],
    [activeSuppliers]
  );

  const filteredProductIds = useMemo(() => {
    const relevant = selectedSupplierId
      ? purchases.filter(p => p.supplierId === selectedSupplierId)
      : purchases;
    return new Set(relevant.map(p => p.productId));
  }, [purchases, selectedSupplierId]);

  const activeProducts = useMemo(() => {
    return products
      .filter(p => filteredProductIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => ({ id: p.id, label: p.barcode ? `[${p.barcode}] ${p.name}` : p.name }));
  }, [products, filteredProductIds]);

  const productOptions = useMemo(
    () => [{ id: '', label: 'All Products' }, ...activeProducts],
    [activeProducts]
  );

  useEffect(() => {
    if (selectedProductId && !filteredProductIds.has(selectedProductId)) {
      setSelectedProductId('');
    }
  }, [selectedProductId, filteredProductIds]);

  const filters: ReportFilters = useMemo(() => ({
    supplierId: selectedSupplierId || undefined,
    productId: selectedProductId || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  }), [selectedSupplierId, selectedProductId, fromDate, toDate]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedSupplierId) {
      parts.push(suppliers.find(s => s.id === selectedSupplierId)?.name || 'Supplier');
    } else {
      parts.push('All Suppliers');
    }
    if (selectedProductId) {
      parts.push(products.find(p => p.id === selectedProductId)?.name || 'Product');
    } else {
      parts.push('All Products');
    }
    return parts.join(' · ');
  }, [selectedSupplierId, selectedProductId, suppliers, products]);

  const handleDownloadSupplierReport = async () => {
    if (!selectedSupplierId) return;
    setIsGenerating1(true);
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (supplier) {
      await generateSupplierPriceHistoryReport(supplier.name, purchases, products, filters);
    }
    setIsGenerating1(false);
  };

  const handleDownloadProductReport = async () => {
    if (!selectedProductId) return;
    setIsGenerating2(true);
    const product = products.find(p => p.id === selectedProductId);
    if (product) {
      await generateProductSupplierComparisonReport(product.name, purchases, suppliers, filters);
    }
    setIsGenerating2(false);
  };

  const handleDownloadInflationReport = async () => {
    setIsGenerating3(true);
    await generatePriceInflationReport(purchases, products, filters);
    setIsGenerating3(false);
  };

  const handleDownloadDependencyReport = async () => {
    setIsGenerating4(true);
    await generateSupplierDependencyReport(purchases, products, suppliers, filters);
    setIsGenerating4(false);
  };

  const handleDownloadPriceSequenceReport = async () => {
    setIsGenerating5(true);
    await generateProductPriceSequenceReport(purchases, products, filters);
    setIsGenerating5(false);
  };

  const reportCards = [
    {
      title: 'Supplier History',
      icon: Building2,
      accent: 'border-t-blue-500',
      iconClass: 'text-blue-500 bg-blue-50',
      onClick: handleDownloadSupplierReport,
      disabled: !selectedSupplierId || isGenerating1,
      loading: isGenerating1,
    },
    {
      title: 'Product Comparison',
      icon: Package,
      accent: 'border-t-emerald-500',
      iconClass: 'text-emerald-500 bg-emerald-50',
      onClick: handleDownloadProductReport,
      disabled: !selectedProductId || isGenerating2,
      loading: isGenerating2,
    },
    {
      title: 'Supplier Dependency',
      icon: AlertTriangle,
      accent: 'border-t-purple-500',
      iconClass: 'text-purple-500 bg-purple-50',
      onClick: handleDownloadDependencyReport,
      disabled: isGenerating4,
      loading: isGenerating4,
    },
    {
      title: 'Price Inflation',
      icon: TrendingUp,
      accent: 'border-t-rose-500',
      iconClass: 'text-rose-500 bg-rose-50',
      onClick: handleDownloadInflationReport,
      disabled: isGenerating3,
      loading: isGenerating3,
    },
    {
      title: 'Price Sequence',
      icon: ListOrdered,
      accent: 'border-t-amber-500',
      iconClass: 'text-amber-600 bg-amber-50',
      onClick: handleDownloadPriceSequenceReport,
      disabled: isGenerating5,
      loading: isGenerating5,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-[#D4AF37]" />
          Excel Reports
        </h2>
        <p className="text-slate-500 font-medium mt-1">Set filters once, then download any report below.</p>
      </div>

      {/* Global Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
        <div className="flex items-center gap-2 text-slate-800">
          <Filter className="w-5 h-5 text-[#D4AF37]" />
          <h3 className="font-bold text-lg">Report Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Supplier
            </label>
            <SearchableSelect
              options={supplierOptions}
              value={selectedSupplierId}
              onChange={setSelectedSupplierId}
              placeholder="All Suppliers"
              colorTheme="blue"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
              <Package className="w-4 h-4 text-emerald-500" />
              Product
            </label>
            <SearchableSelect
              options={productOptions}
              value={selectedProductId}
              onChange={setSelectedProductId}
              placeholder="All Products"
              colorTheme="emerald"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] font-medium transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] font-medium transition-all"
            />
          </div>
        </div>

        <p className="text-sm font-medium text-slate-500 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
          Active scope: <span className="font-bold text-slate-700">{filterSummary}</span>
          {(fromDate || toDate) && (
            <span className="text-slate-500"> · {fromDate || '…'} → {toDate || '…'}</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.title}
              className={`bg-white px-4 py-4 rounded-xl border border-slate-100 shadow-sm border-t-[3px] ${report.accent} flex items-center justify-between gap-3 hover:shadow-md transition-shadow min-h-[68px]`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className={`p-2 rounded-lg shrink-0 ${report.iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-[15px] font-bold text-slate-800 leading-tight truncate">
                  {report.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={report.onClick}
                disabled={report.disabled}
                title={`Download ${report.title}`}
                className="shrink-0 w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-[#D4AF37] hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {report.loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-[18px] h-[18px]" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
