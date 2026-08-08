'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  GitCompare,
  Loader2,
  PackageX,
  Search,
  ShoppingCart,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react';
import { getInventoryProductsForReports } from '../Service/inventory_service';
import { peekIAPrefetch } from '../Utils/IAPrefetchCache';
import { generateDeadStockReport } from './DeadStockReport';
import { generateMonthlyNetPurchasesReport } from './MonthlyNetPurchasesReport';
import { generateMonthlyNetSalesReport } from './MonthlyNetSalesReport';
import { generateMonthlySalesPurchasesReport } from './MonthlySalesPurchasesReport';
import { generateQuarterlyNetPurchasesReport } from './QuarterlyNetPurchasesReport';
import { generateQuarterlyNetSalesReport } from './QuarterlyNetSalesReport';
import { generateQuarterlySalesPurchasesReport } from './QuarterlySalesPurchasesReport';
import { ReportFilters } from './ReportFilters';

interface SearchableSelectProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}

function SearchableSelect({ options, value, onChange, placeholder }: SearchableSelectProps) {
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

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <div className="relative" ref={selectRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl cursor-pointer flex justify-between items-center transition-all hover:bg-slate-100 outline-none ${
          isOpen ? 'focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500' : ''
        }`}
      >
        <span
          className={
            selectedOption
              ? 'text-slate-900 font-bold truncate pr-2'
              : 'text-slate-400 font-medium truncate pr-2'
          }
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
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
                className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">No results found</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.id || '__all__'}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`p-3 text-sm rounded-lg cursor-pointer transition-colors ${
                    opt.id === value
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
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

export default function ReportsTab() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);
  const [isGeneratingQuarterly, setIsGeneratingQuarterly] = useState(false);
  const [isGeneratingMonthlyPurchases, setIsGeneratingMonthlyPurchases] = useState(false);
  const [isGeneratingQuarterlyPurchases, setIsGeneratingQuarterlyPurchases] = useState(false);
  const [isGeneratingMonthlyComparison, setIsGeneratingMonthlyComparison] = useState(false);
  const [isGeneratingQuarterlyComparison, setIsGeneratingQuarterlyComparison] = useState(false);
  const [isGeneratingDeadStock, setIsGeneratingDeadStock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingCategories(true);

      const prefetched = peekIAPrefetch();
      if (prefetched?.reportProducts) {
        if (cancelled) return;
        const unique = Array.from(new Set(prefetched.reportProducts.map((p) => p.category))).sort((a, b) =>
          a.localeCompare(b),
        );
        setCategories(unique);
        setIsLoadingCategories(false);
        return;
      }

      const result = await getInventoryProductsForReports();
      if (cancelled) return;
      if (result.success) {
        const unique = Array.from(new Set(result.data.map((p) => p.category))).sort((a, b) =>
          a.localeCompare(b),
        );
        setCategories(unique);
      }
      setIsLoadingCategories(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  const categoryOptions = useMemo(
    () => [
      { id: '', label: 'All Categories' },
      ...categories.map((cat) => ({ id: cat, label: cat })),
    ],
    [categories],
  );

  const filters: ReportFilters = useMemo(
    () => ({
      category: selectedCategory || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [selectedCategory, fromDate, toDate],
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== '') count++;
    if (fromDate !== '' || toDate !== '') count++;
    return count;
  }, [selectedCategory, fromDate, toDate]);

  const filterSummary = selectedCategory || 'All Categories';

  const handleDownloadMonthly = async () => {
    setIsGeneratingMonthly(true);
    try {
      await generateMonthlyNetSalesReport(filters);
    } finally {
      setIsGeneratingMonthly(false);
    }
  };

  const handleDownloadQuarterly = async () => {
    setIsGeneratingQuarterly(true);
    try {
      await generateQuarterlyNetSalesReport(filters);
    } finally {
      setIsGeneratingQuarterly(false);
    }
  };

  const handleDownloadMonthlyPurchases = async () => {
    setIsGeneratingMonthlyPurchases(true);
    try {
      await generateMonthlyNetPurchasesReport(filters);
    } finally {
      setIsGeneratingMonthlyPurchases(false);
    }
  };

  const handleDownloadQuarterlyPurchases = async () => {
    setIsGeneratingQuarterlyPurchases(true);
    try {
      await generateQuarterlyNetPurchasesReport(filters);
    } finally {
      setIsGeneratingQuarterlyPurchases(false);
    }
  };

  const handleDownloadMonthlyComparison = async () => {
    setIsGeneratingMonthlyComparison(true);
    try {
      await generateMonthlySalesPurchasesReport(filters);
    } finally {
      setIsGeneratingMonthlyComparison(false);
    }
  };

  const handleDownloadQuarterlyComparison = async () => {
    setIsGeneratingQuarterlyComparison(true);
    try {
      await generateQuarterlySalesPurchasesReport(filters);
    } finally {
      setIsGeneratingQuarterlyComparison(false);
    }
  };

  const handleDownloadDeadStock = async () => {
    setIsGeneratingDeadStock(true);
    try {
      await generateDeadStockReport(filters);
    } finally {
      setIsGeneratingDeadStock(false);
    }
  };

  const reportCards = [
    {
      title: 'Monthly Net Sales',
      icon: TrendingUp,
      accent: 'border-t-indigo-500',
      iconClass: 'text-indigo-600 bg-indigo-50',
      onClick: handleDownloadMonthly,
      disabled: !fromDate || !toDate || isGeneratingMonthly,
      loading: isGeneratingMonthly,
    },
    {
      title: 'Quarterly Net Sales',
      icon: FileSpreadsheet,
      accent: 'border-t-blue-500',
      iconClass: 'text-blue-600 bg-blue-50',
      onClick: handleDownloadQuarterly,
      disabled: !fromDate || !toDate || isGeneratingQuarterly,
      loading: isGeneratingQuarterly,
    },
    {
      title: 'Monthly Net Purchases',
      icon: ShoppingCart,
      accent: 'border-t-emerald-500',
      iconClass: 'text-emerald-600 bg-emerald-50',
      onClick: handleDownloadMonthlyPurchases,
      disabled: !fromDate || !toDate || isGeneratingMonthlyPurchases,
      loading: isGeneratingMonthlyPurchases,
    },
    {
      title: 'Quarterly Net Purchases',
      icon: ShoppingCart,
      accent: 'border-t-teal-500',
      iconClass: 'text-teal-600 bg-teal-50',
      onClick: handleDownloadQuarterlyPurchases,
      disabled: !fromDate || !toDate || isGeneratingQuarterlyPurchases,
      loading: isGeneratingQuarterlyPurchases,
    },
    {
      title: 'Monthly Sales vs Purchases',
      icon: GitCompare,
      accent: 'border-t-violet-500',
      iconClass: 'text-violet-600 bg-violet-50',
      onClick: handleDownloadMonthlyComparison,
      disabled: !fromDate || !toDate || isGeneratingMonthlyComparison,
      loading: isGeneratingMonthlyComparison,
    },
    {
      title: 'Quarterly Sales vs Purchases',
      icon: GitCompare,
      accent: 'border-t-fuchsia-500',
      iconClass: 'text-fuchsia-600 bg-fuchsia-50',
      onClick: handleDownloadQuarterlyComparison,
      disabled: !fromDate || !toDate || isGeneratingQuarterlyComparison,
      loading: isGeneratingQuarterlyComparison,
    },
    {
      title: 'Dead Stock / Slow Movers',
      icon: PackageX,
      accent: 'border-t-rose-500',
      iconClass: 'text-rose-600 bg-rose-50',
      onClick: handleDownloadDeadStock,
      disabled: !fromDate || !toDate || isGeneratingDeadStock,
      loading: isGeneratingDeadStock,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Top Title & Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-indigo-600 shrink-0" />
          Reports
        </h2>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Popover Filter Trigger */}
          <div className="relative w-full sm:w-auto" ref={filtersRef}>
            <button
              type="button"
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`w-full sm:w-11 h-11 flex items-center justify-center rounded-xl border transition-all font-semibold text-xs shadow-xs hover:bg-slate-50 cursor-pointer relative ${
                isFiltersOpen ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'
              }`}
              title="Advanced Filters"
            >
              <Filter className="w-4 h-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-amber-500 text-white rounded-full text-[10px] font-bold shadow-sm">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Filters pop-up modal is rendered at the bottom of the file */}
          </div>
        </div>
      </div>

      {/* Warning Banner / Status Scope on Main Page */}
      {(!fromDate || !toDate) ? (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm font-semibold text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          Please select From/To dates in the filters above to enable Excel report downloads.
        </div>
      ) : (
        <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl text-sm font-medium text-slate-600 flex flex-wrap items-center gap-2">
          <span className="font-bold text-indigo-900">Active scope:</span>
          <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-100 text-xs font-bold text-slate-800">
            {filterSummary}
          </span>
          <span className="text-slate-300">·</span>
          <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-100 text-xs font-bold text-slate-800">
            {fromDate} → {toDate}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.title}
              className={`bg-white px-4 py-4 rounded-xl border border-slate-100 shadow-sm border-t-[3px] ${report.accent} flex flex-col gap-3 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${report.iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-slate-800 leading-tight">{report.title}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={report.onClick}
                disabled={report.disabled}
                title={`Download ${report.title}`}
                className="mt-auto w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {report.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Excel
              </button>
            </div>
          );
        })}
      </div>
      {/* Advanced Filters Pop-up Modal */}
      {isFiltersOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsFiltersOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-indigo-600 shrink-0" />
                <h3 className="text-base font-black text-slate-800">Filter Reports</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFiltersOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">
                  Category
                </label>
                {isLoadingCategories ? (
                  <div className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    Loading categories...
                  </div>
                ) : (
                  <SearchableSelect
                    options={categoryOptions}
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    placeholder="All Categories"
                  />
                )}
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">
                  Date Range
                </label>
                <div className="space-y-2">
                  <div className="relative flex items-center h-11 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                    <span className="text-[10px] font-black text-slate-400 shrink-0 mr-1.5 uppercase">From:</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    />
                  </div>
                  <div className="relative flex items-center h-11 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                    <span className="text-[10px] font-black text-slate-400 shrink-0 mr-1.5 uppercase">To:</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('');
                  setFromDate('');
                  setToDate('');
                  setIsFiltersOpen(false);
                }}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setIsFiltersOpen(false)}
                className="px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/10 transition-all cursor-pointer"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
