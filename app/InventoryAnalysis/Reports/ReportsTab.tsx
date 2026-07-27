'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  GitCompare,
  Loader2,
  Search,
  ShoppingCart,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { getInventoryProductsForReports } from '../Service/inventory_service';
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
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);
  const [isGeneratingQuarterly, setIsGeneratingQuarterly] = useState(false);
  const [isGeneratingMonthlyPurchases, setIsGeneratingMonthlyPurchases] = useState(false);
  const [isGeneratingQuarterlyPurchases, setIsGeneratingQuarterlyPurchases] = useState(false);
  const [isGeneratingMonthlyComparison, setIsGeneratingMonthlyComparison] = useState(false);
  const [isGeneratingQuarterlyComparison, setIsGeneratingQuarterlyComparison] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingCategories(true);
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

  const reportCards = [
    {
      title: 'Monthly Net Sales',
      description: 'Sales to customers minus returns, by month',
      icon: TrendingUp,
      accent: 'border-t-indigo-500',
      iconClass: 'text-indigo-600 bg-indigo-50',
      onClick: handleDownloadMonthly,
      disabled: !fromDate || !toDate || isGeneratingMonthly,
      loading: isGeneratingMonthly,
    },
    {
      title: 'Quarterly Net Sales',
      description: 'Three-month calendar quarter totals',
      icon: FileSpreadsheet,
      accent: 'border-t-blue-500',
      iconClass: 'text-blue-600 bg-blue-50',
      onClick: handleDownloadQuarterly,
      disabled: !fromDate || !toDate || isGeneratingQuarterly,
      loading: isGeneratingQuarterly,
    },
    {
      title: 'Monthly Net Purchases',
      description: 'Purchases from vendors minus returns, by month',
      icon: ShoppingCart,
      accent: 'border-t-emerald-500',
      iconClass: 'text-emerald-600 bg-emerald-50',
      onClick: handleDownloadMonthlyPurchases,
      disabled: !fromDate || !toDate || isGeneratingMonthlyPurchases,
      loading: isGeneratingMonthlyPurchases,
    },
    {
      title: 'Quarterly Net Purchases',
      description: 'Three-month calendar quarter purchase totals',
      icon: ShoppingCart,
      accent: 'border-t-teal-500',
      iconClass: 'text-teal-600 bg-teal-50',
      onClick: handleDownloadQuarterlyPurchases,
      disabled: !fromDate || !toDate || isGeneratingQuarterlyPurchases,
      loading: isGeneratingQuarterlyPurchases,
    },
    {
      title: 'Monthly Sales vs Purchases',
      description: 'Side-by-side net sales and purchases by month',
      icon: GitCompare,
      accent: 'border-t-violet-500',
      iconClass: 'text-violet-600 bg-violet-50',
      onClick: handleDownloadMonthlyComparison,
      disabled: !fromDate || !toDate || isGeneratingMonthlyComparison,
      loading: isGeneratingMonthlyComparison,
    },
    {
      title: 'Quarterly Sales vs Purchases',
      description: 'Side-by-side net sales and purchases by quarter',
      icon: GitCompare,
      accent: 'border-t-fuchsia-500',
      iconClass: 'text-fuchsia-600 bg-fuchsia-50',
      onClick: handleDownloadQuarterlyComparison,
      disabled: !fromDate || !toDate || isGeneratingQuarterlyComparison,
      loading: isGeneratingQuarterlyComparison,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-indigo-600" />
          Reports
        </h2>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
        <div className="flex items-center gap-2 text-slate-800">
          <Filter className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-lg">Report Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
              <Tag className="w-4 h-4 text-teal-500" />
              Category
            </label>
            {isLoadingCategories ? (
              <div className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
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

          <div>
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium transition-all"
            />
          </div>
        </div>

        <p className="text-sm font-medium text-slate-500 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
          Active scope: <span className="font-bold text-slate-700">{filterSummary}</span>
          {(fromDate || toDate) && (
            <span className="text-slate-500">
              {' '}
              · {fromDate || '…'} → {toDate || '…'}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.title}
              className={`bg-white px-4 py-4 rounded-xl border border-slate-100 shadow-sm border-t-[3px] ${report.accent} flex flex-col gap-3 hover:shadow-md transition-shadow min-h-[120px]`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${report.iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-slate-800 leading-tight">{report.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{report.description}</p>
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
    </div>
  );
}
