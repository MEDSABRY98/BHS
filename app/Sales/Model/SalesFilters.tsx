'use client';

import { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from 'react';
import {
  Filter,
  ChevronDown,
  CheckCircle2,
  X,
  Calendar,
  Layers,
  RefreshCcw,
  TrendingUp,
  Package,
  Search,
  ArrowLeft,
  Users,
  UserCircle,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import Loading from '@/app/Components/Loading';

export type InvoiceTypeFilter = 'all' | 'sales' | 'returns';
export type SalesFilterTab = 'mode' | 'timing' | 'product' | 'customer' | 'outreach' | 'advanced' | 'reporting';
export type ReportCompareMode = 'prevMonth' | 'sameMonthLastYear';
export type ReportCustomerView = 'main' | 'sub';

const DEFAULT_REPORT_COMPARE_MODE: ReportCompareMode = 'prevMonth';
const DEFAULT_REPORT_CUSTOMER_VIEW: ReportCustomerView = 'main';

const REPORTING_MODE_BADGE_LABELS: Record<InvoiceTypeFilter, string> = {
  all: 'Net Sales',
  sales: 'Sales Only',
  returns: 'GRV Only',
};

export type SalesCommonFilters = {
  invoiceType: InvoiceTypeFilter;
  year: string;
  month: string;
  dateFrom: string;
  dateTo: string;
  area: string;
  market: string;
  merchandiser: string;
  salesRep: string;
  productTag: string;
  product: string;
  customerMainName: string;
  customerSubName: string;
  customerTag: string;
  customerClass: string;
};

export type SalesFilterOptions = {
  areas: string[];
  markets: string[];
  merchandisers: string[];
  salesReps: string[];
  productTags: string[];
  products: string[];
  productCategoryByName?: Record<string, string>;
  customerMainNames: string[];
  customerSubNames: string[];
  customerTags: string[];
  customerClasses: string[];
  years: string[];
};

const MONTH_OPTIONS = [
  { label: 'All Months', value: '' },
  ...Array.from({ length: 12 }, (_, i) => ({
    label: new Date(2000, i).toLocaleString('en-US', { month: 'long' }),
    value: (i + 1).toString(),
  })),
];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function monthDateRange(year: string, month: string): { from: string; to: string } {
  if (!year || !month) return { from: '', to: '' };
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return { from: '', to: '' };
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(lastDay)}` };
}

function defaultMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(lastDay)}` };
}

export const DEFAULT_SALES_COMMON_FILTERS: SalesCommonFilters = {
  invoiceType: 'all',
  year: '',
  month: '',
  dateFrom: '',
  dateTo: '',
  area: '',
  market: '',
  merchandiser: '',
  salesRep: '',
  productTag: '',
  product: '',
  customerMainName: '',
  customerSubName: '',
  customerTag: '',
  customerClass: '',
};

function filtersEqual(a: SalesCommonFilters, b: SalesCommonFilters): boolean {
  return (
    a.invoiceType === b.invoiceType &&
    a.year === b.year &&
    a.month === b.month &&
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo &&
    a.area === b.area &&
    a.market === b.market &&
    a.merchandiser === b.merchandiser &&
    a.salesRep === b.salesRep &&
    a.productTag === b.productTag &&
    a.product === b.product &&
    a.customerMainName === b.customerMainName &&
    a.customerSubName === b.customerSubName &&
    a.customerTag === b.customerTag &&
    a.customerClass === b.customerClass
  );
}

function ModernSelect({
  value,
  onChange,
  options,
  placeholder = 'Select Option',
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[] | string[];
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const formattedOptions = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const filteredOptions = formattedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = formattedOptions.find((opt) => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-500/20 transition-all text-sm flex items-center justify-between group text-left"
      >
        <span className={!value ? 'text-slate-400 font-normal' : 'truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-300 group-hover:text-slate-600 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl pb-2 animate-in zoom-in-95 fade-in duration-200 overflow-hidden ring-1 ring-slate-100 flex flex-col">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50 sticky top-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500/40 transition-all"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto no-scrollbar scroll-smooth">
            {filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-5 py-3 text-left text-xs font-bold transition-all hover:bg-green-50 hover:text-green-600 ${
                  value === opt.value ? 'bg-green-50 text-green-600' : 'text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between font-outfit">
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-5 py-8 text-xs text-slate-400 italic text-center">
                <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function useSalesFilters() {
  const [appliedFilters, setAppliedFilters] = useState<SalesCommonFilters>(DEFAULT_SALES_COMMON_FILTERS);
  const [draftFilters, setDraftFilters] = useState<SalesCommonFilters>(DEFAULT_SALES_COMMON_FILTERS);
  const [appliedInactiveDays, setAppliedInactiveDays] = useState('30');
  const [draftInactiveDays, setDraftInactiveDays] = useState('30');
  const [appliedInactiveMinAmount, setAppliedInactiveMinAmount] = useState('');
  const [draftInactiveMinAmount, setDraftInactiveMinAmount] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<SalesFilterTab>('mode');
  const [appliedReportCompareMode, setAppliedReportCompareMode] =
    useState<ReportCompareMode>(DEFAULT_REPORT_COMPARE_MODE);
  const [draftReportCompareMode, setDraftReportCompareMode] =
    useState<ReportCompareMode>(DEFAULT_REPORT_COMPARE_MODE);
  const [appliedReportCustomerView, setAppliedReportCustomerView] =
    useState<ReportCustomerView>(DEFAULT_REPORT_CUSTOMER_VIEW);
  const [draftReportCustomerView, setDraftReportCustomerView] =
    useState<ReportCustomerView>(DEFAULT_REPORT_CUSTOMER_VIEW);

  const syncDraftFromApplied = useCallback(() => {
    setDraftFilters({ ...appliedFilters });
    setDraftInactiveDays(appliedInactiveDays);
    setDraftInactiveMinAmount(appliedInactiveMinAmount);
    setDraftReportCompareMode(appliedReportCompareMode);
    setDraftReportCustomerView(appliedReportCustomerView);
  }, [
    appliedFilters,
    appliedInactiveDays,
    appliedInactiveMinAmount,
    appliedReportCompareMode,
    appliedReportCustomerView,
  ]);

  const openFilterModal = useCallback(() => {
    syncDraftFromApplied();
    setIsFilterOpen(true);
  }, [syncDraftFromApplied]);

  const closeFilterModal = useCallback(() => {
    syncDraftFromApplied();
    setIsFilterOpen(false);
  }, [syncDraftFromApplied]);

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
    setAppliedInactiveDays(draftInactiveDays);
    setAppliedInactiveMinAmount(draftInactiveMinAmount);
    setAppliedReportCompareMode(draftReportCompareMode);
    setAppliedReportCustomerView(draftReportCustomerView);
    setIsFilterOpen(false);
  }, [
    draftFilters,
    draftInactiveDays,
    draftInactiveMinAmount,
    draftReportCompareMode,
    draftReportCustomerView,
  ]);

  const hasAnyFilter = useMemo(() => {
    const f = appliedFilters;
    return (
      f.invoiceType !== 'all' ||
      !!f.year ||
      !!f.month ||
      !!f.dateFrom ||
      !!f.dateTo ||
      !!f.area ||
      !!f.market ||
      !!f.merchandiser ||
      !!f.salesRep ||
      !!f.productTag ||
      !!f.product ||
      !!f.customerMainName ||
      !!f.customerSubName ||
      !!f.customerTag ||
      !!f.customerClass
    );
  }, [appliedFilters]);

  const hasPendingFilterChanges = useMemo(() => {
    return (
      !filtersEqual(draftFilters, appliedFilters) ||
      draftInactiveDays !== appliedInactiveDays ||
      draftInactiveMinAmount !== appliedInactiveMinAmount ||
      draftReportCompareMode !== appliedReportCompareMode ||
      draftReportCustomerView !== appliedReportCustomerView
    );
  }, [
    draftFilters,
    appliedFilters,
    draftInactiveDays,
    appliedInactiveDays,
    draftInactiveMinAmount,
    appliedInactiveMinAmount,
    draftReportCompareMode,
    appliedReportCompareMode,
    draftReportCustomerView,
    appliedReportCustomerView,
  ]);

  const resetFilters = useCallback(() => {
    setAppliedFilters(DEFAULT_SALES_COMMON_FILTERS);
    setDraftFilters(DEFAULT_SALES_COMMON_FILTERS);
    setAppliedInactiveDays('30');
    setDraftInactiveDays('30');
    setAppliedInactiveMinAmount('');
    setDraftInactiveMinAmount('');
    setAppliedReportCompareMode(DEFAULT_REPORT_COMPARE_MODE);
    setDraftReportCompareMode(DEFAULT_REPORT_COMPARE_MODE);
    setAppliedReportCustomerView(DEFAULT_REPORT_CUSTOMER_VIEW);
    setDraftReportCustomerView(DEFAULT_REPORT_CUSTOMER_VIEW);
  }, []);

  const updateDraftFilter = useCallback(<K extends keyof SalesCommonFilters>(key: K, value: SalesCommonFilters[K]) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setReportDateFrom = useCallback((value: string) => {
    setDraftFilters((prev) => {
      const next = { ...prev, dateFrom: value };
      if (value) {
        next.year = '';
        next.month = '';
      }
      return next;
    });
  }, []);

  const setReportDateTo = useCallback((value: string) => {
    setDraftFilters((prev) => {
      const next = { ...prev, dateTo: value };
      if (value) {
        next.year = '';
        next.month = '';
      }
      return next;
    });
  }, []);

  const getCommonFilters = (): SalesCommonFilters => appliedFilters;

  return {
    appliedFilters,
    draftFilters,
    updateDraftFilter,
    applyFilters,
    openFilterModal,
    closeFilterModal,
    invoiceTypeFilter: appliedFilters.invoiceType,
    draftInvoiceTypeFilter: draftFilters.invoiceType,
    setDraftInvoiceTypeFilter: (value: InvoiceTypeFilter) => updateDraftFilter('invoiceType', value),
    filterYear: draftFilters.year,
    setFilterYear: (value: string) => updateDraftFilter('year', value),
    filterMonth: draftFilters.month,
    setFilterMonth: (value: string) => updateDraftFilter('month', value),
    dateFrom: draftFilters.dateFrom,
    setDateFrom: (value: string) => updateDraftFilter('dateFrom', value),
    dateTo: draftFilters.dateTo,
    setDateTo: (value: string) => updateDraftFilter('dateTo', value),
    setReportDateFrom,
    setReportDateTo,
    reportCompareMode: appliedReportCompareMode,
    draftReportCompareMode,
    setDraftReportCompareMode,
    reportCustomerView: appliedReportCustomerView,
    draftReportCustomerView,
    setDraftReportCustomerView,
    filterArea: draftFilters.area,
    setFilterArea: (value: string) => updateDraftFilter('area', value),
    filterMarket: draftFilters.market,
    setFilterMarket: (value: string) => updateDraftFilter('market', value),
    filterMerchandiser: draftFilters.merchandiser,
    setFilterMerchandiser: (value: string) => updateDraftFilter('merchandiser', value),
    filterSalesRep: draftFilters.salesRep,
    setFilterSalesRep: (value: string) => updateDraftFilter('salesRep', value),
    filterProductTag: draftFilters.productTag,
    setFilterProductTag: (value: string) => updateDraftFilter('productTag', value),
    filterProduct: draftFilters.product,
    setFilterProduct: (value: string) => updateDraftFilter('product', value),
    filterCustomerMainName: draftFilters.customerMainName,
    setFilterCustomerMainName: (value: string) => updateDraftFilter('customerMainName', value),
    filterCustomerSubName: draftFilters.customerSubName,
    setFilterCustomerSubName: (value: string) => updateDraftFilter('customerSubName', value),
    filterCustomerTag: draftFilters.customerTag,
    setFilterCustomerTag: (value: string) => updateDraftFilter('customerTag', value),
    filterCustomerClass: draftFilters.customerClass,
    setFilterCustomerClass: (value: string) => updateDraftFilter('customerClass', value),
    inactiveDays: appliedInactiveDays,
    draftInactiveDays,
    setInactiveDays: setDraftInactiveDays,
    inactiveMinAmount: appliedInactiveMinAmount,
    draftInactiveMinAmount,
    setInactiveMinAmount: setDraftInactiveMinAmount,
    isFilterOpen,
    setIsFilterOpen: openFilterModal,
    isFiltering,
    setIsFiltering,
    activeFilterTab,
    setActiveFilterTab,
    hasAnyFilter,
    hasPendingFilterChanges,
    resetFilters,
    getCommonFilters,
  };
}

export type SalesFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  hasPendingFilterChanges: boolean;
  activeTab: string;
  uniqueValues: SalesFilterOptions;
  invoiceTypeFilter: InvoiceTypeFilter;
  setInvoiceTypeFilter: (value: InvoiceTypeFilter) => void;
  filterYear: string;
  setFilterYear: (value: string) => void;
  filterMonth: string;
  setFilterMonth: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  filterArea: string;
  setFilterArea: (value: string) => void;
  filterMarket: string;
  setFilterMarket: (value: string) => void;
  filterMerchandiser: string;
  setFilterMerchandiser: (value: string) => void;
  filterSalesRep: string;
  setFilterSalesRep: (value: string) => void;
  filterProductTag: string;
  setFilterProductTag: (value: string) => void;
  filterProduct: string;
  setFilterProduct: (value: string) => void;
  filterCustomerMainName: string;
  setFilterCustomerMainName: (value: string) => void;
  filterCustomerSubName: string;
  setFilterCustomerSubName: (value: string) => void;
  filterCustomerTag: string;
  setFilterCustomerTag: (value: string) => void;
  filterCustomerClass: string;
  setFilterCustomerClass: (value: string) => void;
  inactiveDays: string;
  setInactiveDays: (value: string) => void;
  inactiveMinAmount: string;
  setInactiveMinAmount: (value: string) => void;
  setReportDateFrom: (value: string) => void;
  setReportDateTo: (value: string) => void;
  draftReportCompareMode: ReportCompareMode;
  setDraftReportCompareMode: (value: ReportCompareMode) => void;
  draftReportCustomerView: ReportCustomerView;
  setDraftReportCustomerView: (value: ReportCustomerView) => void;
  isFiltering: boolean;
  setIsFiltering: (value: boolean) => void;
  activeFilterTab: SalesFilterTab;
  setActiveFilterTab: (value: SalesFilterTab) => void;
  resetFilters: () => void;
};

export function SalesFilterModal({
  isOpen,
  onClose,
  onApply,
  hasPendingFilterChanges,
  activeTab,
  uniqueValues,
  invoiceTypeFilter,
  setInvoiceTypeFilter,
  filterYear,
  setFilterYear,
  filterMonth,
  setFilterMonth,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  filterArea,
  setFilterArea,
  filterMarket,
  setFilterMarket,
  filterMerchandiser,
  setFilterMerchandiser,
  filterSalesRep,
  setFilterSalesRep,
  filterProductTag,
  setFilterProductTag,
  filterProduct,
  setFilterProduct,
  filterCustomerMainName,
  setFilterCustomerMainName,
  filterCustomerSubName,
  setFilterCustomerSubName,
  filterCustomerTag,
  setFilterCustomerTag,
  filterCustomerClass,
  setFilterCustomerClass,
  inactiveDays,
  setInactiveDays,
  inactiveMinAmount,
  setInactiveMinAmount,
  setReportDateFrom,
  setReportDateTo,
  draftReportCompareMode,
  setDraftReportCompareMode,
  draftReportCustomerView,
  setDraftReportCustomerView,
  isFiltering,
  setIsFiltering,
  activeFilterTab,
  setActiveFilterTab,
  resetFilters,
}: SalesFilterModalProps) {
  const [isHomeView, setIsHomeView] = useState(true);

  useEffect(() => {
    if (isOpen) setIsHomeView(true);
  }, [isOpen]);

  if (!isOpen) return null;

  const categoryTabs = [
    {
      id: 'mode' as SalesFilterTab,
      label: 'Sales Mode',
      icon: Layers,
    },
    {
      id: 'timing' as SalesFilterTab,
      label: 'Dates',
      icon: Calendar,
    },
    {
      id: 'customer' as SalesFilterTab,
      label: 'Customer',
      icon: UserCircle,
    },
    {
      id: 'outreach' as SalesFilterTab,
      label: 'Teams',
      icon: Users,
    },
    {
      id: 'product' as SalesFilterTab,
      label: 'Product',
      icon: Package,
    },
    ...(activeTab === 'sales-inactive-customers'
      ? [
          {
            id: 'advanced' as SalesFilterTab,
            label: 'Comprehensive Filters',
            icon: SlidersHorizontal,
          },
        ]
      : []),
    ...(activeTab === 'sales-reports'
      ? [
          {
            id: 'reporting' as SalesFilterTab,
            label: 'Reporting',
            icon: BarChart3,
          },
        ]
      : []),
  ].sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));

  const activeCategory = categoryTabs.find((tab) => tab.id === activeFilterTab);

  const monthRange = monthDateRange(filterYear, filterMonth);
  const fallbackRange = defaultMonthRange();
  const reportDisplayFrom = dateFrom || monthRange.from || fallbackRange.from;
  const reportDisplayTo = dateTo || monthRange.to || fallbackRange.to;

  const enterCategory = (id: SalesFilterTab) => {
    setActiveFilterTab(id);
    setIsHomeView(false);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative w-full max-w-5xl h-[850px] bg-white rounded-[40px] shadow-2xl border border-white/20 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 flex flex-col overflow-hidden">
        <div className="bg-slate-50/80 backdrop-blur-sm px-10 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-green-600 rounded-[18px] flex items-center justify-center shadow-lg shadow-green-100">
              <Filter className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Search & Filters</h3>
              {hasPendingFilterChanges && (
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mt-1">
                  Pending changes — click Apply to refresh data
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => resetFilters()}
              className="w-28 py-2.5 text-sm font-bold tracking-wide uppercase text-red-600 bg-transparent border-2 border-red-500 rounded-xl hover:bg-red-50 transition-all active:scale-95"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onApply}
              className={`w-28 py-2.5 text-sm font-bold tracking-wide uppercase bg-transparent border-2 rounded-xl transition-all active:scale-95 ${
                hasPendingFilterChanges
                  ? 'text-amber-600 border-amber-500 hover:bg-amber-50'
                  : 'text-green-600 border-green-600 hover:bg-green-50'
              }`}
            >
              Apply
            </button>
            <div className="w-[1px] h-8 bg-slate-200 mx-2" />
            <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-xl transition-colors group">
              <X className="w-6 h-6 text-slate-300 group-hover:text-slate-600 transition-colors" />
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 bg-white min-h-0">
          {!isHomeView && (
            <div className="px-10 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsHomeView(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="h-6 w-px bg-slate-200" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-900">
                {activeCategory?.label || 'Filters'}
              </p>
            </div>
          )}

          <div className="p-10 overflow-y-auto custom-scrollbar flex-1 min-h-[450px] relative">
            {isHomeView ? (
              <div className="h-full flex flex-col justify-center animate-in fade-in zoom-in-95 duration-300 px-4">
                <div
                  className={`grid gap-8 md:gap-10 ${
                    categoryTabs.length > 4 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
                  }`}
                >
                  {categoryTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => enterCategory(tab.id)}
                        className="flex flex-col items-center justify-center gap-5 text-center p-10 md:p-12 rounded-[36px] transition-all border-2 min-h-[220px] w-full bg-white border-slate-100 hover:border-slate-900 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5"
                      >
                        <div className="w-16 h-16 rounded-[22px] flex items-center justify-center shadow-lg bg-slate-900 text-white">
                          <Icon className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-black text-base uppercase tracking-[0.18em] text-slate-900">
                            {tab.label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              {activeFilterTab === 'mode' && (
                <div className="space-y-8 h-full flex flex-col justify-center">
                  <div className="grid grid-cols-3 gap-6">
                    {[
                      { id: 'all', label: 'NET SALES' },
                      { id: 'sales', label: 'SALES ONLY' },
                      { id: 'returns', label: 'GRV ONLY' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        disabled={isFiltering}
                        onClick={() => {
                          if (invoiceTypeFilter === t.id) return;
                          setIsFiltering(true);
                          setTimeout(() => {
                            setInvoiceTypeFilter(t.id as InvoiceTypeFilter);
                            setIsFiltering(false);
                          }, 100);
                        }}
                        className={`flex flex-col items-center justify-center gap-4 text-center p-8 rounded-[40px] transition-all border-2 h-44 w-full ${
                          invoiceTypeFilter === t.id
                            ? 'bg-green-50/50 border-green-600 shadow-2xl shadow-green-100/50'
                            : 'bg-white border-slate-100 hover:border-slate-300'
                        } ${isFiltering ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div
                          className={`w-14 h-14 rounded-[20px] flex items-center justify-center shadow-lg transition-all ${
                            invoiceTypeFilter === t.id
                              ? 'bg-green-600 text-white shadow-green-200'
                              : 'bg-slate-50 text-slate-400'
                          }`}
                        >
                          {t.id === 'all' ? (
                            <CheckCircle2 className="w-7 h-7" />
                          ) : t.id === 'sales' ? (
                            <Layers className="w-7 h-7" />
                          ) : (
                            <RefreshCcw className="w-7 h-7" />
                          )}
                        </div>
                        <p
                          className={`font-black text-base uppercase tracking-[0.2em] ${
                            invoiceTypeFilter === t.id ? 'text-green-700' : 'text-slate-800'
                          }`}
                        >
                          {t.label}
                        </p>
                      </button>
                    ))}
                  </div>

                  {isFiltering && (
                    <div className="absolute inset-0 z-[50] rounded-[40px] overflow-hidden">
                      <Loading
                        fullScreen={false}
                        message="Applying Mode..."
                        className="!absolute !inset-0 !min-h-0"
                      />
                    </div>
                  )}
                </div>
              )}

              {activeFilterTab === 'timing' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Standard Period
                      </h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">
                            Year
                          </label>
                          <ModernSelect
                            value={filterYear}
                            onChange={setFilterYear}
                            options={[
                              { label: 'All Years', value: '' },
                              ...uniqueValues.years.map((v) => ({ label: v, value: v })),
                            ]}
                            placeholder="All Years"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">
                            Month
                          </label>
                          <ModernSelect
                            value={filterMonth}
                            onChange={setFilterMonth}
                            options={MONTH_OPTIONS}
                            placeholder="All Months"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <TrendingUp className="w-3 h-3" /> Custom Interval
                      </h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">
                            From Date
                          </label>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-green-500/20 focus:ring-4 focus:ring-green-500/5 transition-all text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">
                            To Date
                          </label>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-green-500/20 focus:ring-4 focus:ring-green-500/5 transition-all text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeFilterTab === 'product' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Product Category
                      </label>
                      <ModernSelect
                        value={filterProductTag}
                        onChange={(value) => {
                          setFilterProductTag(value);
                          if (
                            value &&
                            filterProduct &&
                            uniqueValues.productCategoryByName?.[filterProduct] !== value
                          ) {
                            setFilterProduct('');
                          }
                        }}
                        options={[
                          { label: 'All Categories', value: '' },
                          ...uniqueValues.productTags.map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All Categories"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Product
                      </label>
                      <ModernSelect
                        value={filterProduct}
                        onChange={(value) => {
                          setFilterProduct(value);
                          if (value) {
                            const tag = uniqueValues.productCategoryByName?.[value];
                            if (tag) setFilterProductTag(tag);
                          }
                        }}
                        options={[
                          { label: 'All Products', value: '' },
                          ...(uniqueValues.products || [])
                            .filter(
                              (name) =>
                                !filterProductTag ||
                                uniqueValues.productCategoryByName?.[name] === filterProductTag
                            )
                            .map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All Products"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeFilterTab === 'customer' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Main Customer
                      </label>
                      <ModernSelect
                        value={filterCustomerMainName}
                        onChange={setFilterCustomerMainName}
                        options={[
                          { label: 'All Main Customers', value: '' },
                          ...(uniqueValues.customerMainNames || []).map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All Main Customers"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Sub Customer
                      </label>
                      <ModernSelect
                        value={filterCustomerSubName}
                        onChange={setFilterCustomerSubName}
                        options={[
                          { label: 'All Sub Customers', value: '' },
                          ...(uniqueValues.customerSubNames || []).map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All Sub Customers"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Customer Tag
                      </label>
                      <ModernSelect
                        value={filterCustomerTag}
                        onChange={setFilterCustomerTag}
                        options={[
                          { label: 'All Tags', value: '' },
                          ...(uniqueValues.customerTags || []).map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All Tags"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Customer Class
                      </label>
                      <ModernSelect
                        value={filterCustomerClass}
                        onChange={setFilterCustomerClass}
                        options={[
                          { label: 'All Classes', value: '' },
                          ...(uniqueValues.customerClasses || []).map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All Classes"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeFilterTab === 'outreach' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-2 gap-x-12 gap-y-8 bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Area
                      </label>
                      <ModernSelect
                        value={filterArea}
                        onChange={setFilterArea}
                        options={[
                          { label: 'All Areas', value: '' },
                          ...uniqueValues.areas.map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All Areas"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Market
                      </label>
                      <ModernSelect
                        value={filterMarket}
                        onChange={setFilterMarket}
                        options={[
                          { label: 'All Markets', value: '' },
                          ...uniqueValues.markets.map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All Markets"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Sales Rep
                      </label>
                      <ModernSelect
                        value={filterSalesRep}
                        onChange={setFilterSalesRep}
                        options={[
                          { label: 'All', value: '' },
                          ...uniqueValues.salesReps.map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Merchandiser
                      </label>
                      <ModernSelect
                        value={filterMerchandiser}
                        onChange={setFilterMerchandiser}
                        options={[
                          { label: 'All', value: '' },
                          ...uniqueValues.merchandisers.map((v) => ({ label: v, value: v })),
                        ]}
                        placeholder="All"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeFilterTab === 'advanced' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  {activeTab === 'sales-inactive-customers' && (
                    <div className="bg-orange-50/50 p-10 rounded-[44px] border border-orange-100/50">
                      <h4 className="flex items-center gap-3 text-sm font-black text-orange-400 uppercase tracking-[0.3em] mb-10">
                        <span className="w-12 h-[2px] bg-orange-200" />
                        Inactivity Logic
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Tolerance Threshold (Days)
                          </label>
                          <input
                            type="number"
                            value={inactiveDays}
                            onChange={(e) => setInactiveDays(e.target.value)}
                            placeholder="e.g. 30"
                            className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none shadow-sm focus:ring-4 focus:ring-orange-500/5 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Minimum Revenue Filter (AED)
                          </label>
                          <input
                            type="number"
                            value={inactiveMinAmount}
                            onChange={(e) => setInactiveMinAmount(e.target.value)}
                            placeholder="e.g. 500"
                            className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none shadow-sm focus:ring-4 focus:ring-orange-500/5 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeFilterTab === 'reporting' && activeTab === 'sales-reports' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-500 h-full flex flex-col justify-center">
                  <div className="bg-emerald-50/40 p-5 rounded-[28px] border border-emerald-100/60 space-y-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="flex items-center gap-2 text-[11px] font-black text-emerald-500 uppercase tracking-[0.25em]">
                        <span className="w-8 h-[2px] bg-emerald-200" />
                        Report Period
                      </h4>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
                        {REPORTING_MODE_BADGE_LABELS[invoiceTypeFilter]}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          From
                        </label>
                        <input
                          type="date"
                          value={reportDisplayFrom}
                          onChange={(e) => {
                            const value = e.target.value;
                            setReportDateFrom(value);
                            if (value && !dateTo) setReportDateTo(reportDisplayTo);
                          }}
                          className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl font-bold text-slate-700 outline-none shadow-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400/40 transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          To
                        </label>
                        <input
                          type="date"
                          value={reportDisplayTo}
                          onChange={(e) => {
                            const value = e.target.value;
                            setReportDateTo(value);
                            if (value && !dateFrom) setReportDateFrom(reportDisplayFrom);
                          }}
                          className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl font-bold text-slate-700 outline-none shadow-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400/40 transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-5 rounded-[28px] border border-slate-100 space-y-3 min-w-0">
                      <h4 className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
                        <span className="w-8 h-[2px] bg-slate-200" />
                        Compare vs
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { id: 'prevMonth' as ReportCompareMode, label: 'Previous Period' },
                            { id: 'sameMonthLastYear' as ReportCompareMode, label: 'Same Period Last Year' },
                          ] as const
                        ).map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setDraftReportCompareMode(mode.id)}
                            className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border-2 ${
                              draftReportCompareMode === mode.id
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100'
                                : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-[28px] border border-slate-100 space-y-3 min-w-0">
                      <h4 className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
                        <span className="w-8 h-[2px] bg-slate-200" />
                        View
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { id: 'main' as ReportCustomerView, label: 'Main Customer' },
                            { id: 'sub' as ReportCustomerView, label: 'Sub Customer' },
                          ] as const
                        ).map((view) => (
                          <button
                            key={view.id}
                            type="button"
                            onClick={() => setDraftReportCustomerView(view.id)}
                            className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border-2 ${
                              draftReportCustomerView === view.id
                                ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200'
                                : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'
                            }`}
                          >
                            {view.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export type SalesModuleFiltersContextValue = ReturnType<typeof useSalesFilters> & {
  commonFilters: SalesCommonFilters;
  uniqueValues: SalesFilterOptions;
  activeTab: string;
};

const SalesFiltersContext = createContext<SalesModuleFiltersContextValue | null>(null);

export function useSalesModuleFilters(): SalesModuleFiltersContextValue {
  const context = useContext(SalesFiltersContext);
  if (!context) {
    throw new Error('useSalesModuleFilters must be used within SalesFiltersProvider');
  }
  return context;
}

export function SalesFilterButton({
  inSidebar = false,
  isCollapsed = false,
}: {
  inSidebar?: boolean;
  isCollapsed?: boolean;
}) {
  const { hasAnyFilter, hasPendingFilterChanges, setIsFilterOpen } = useSalesModuleFilters();
  const showBadge = hasAnyFilter || hasPendingFilterChanges;

  if (inSidebar) {
    return (
      <button
        type="button"
        onClick={() => setIsFilterOpen()}
        className={`flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 group relative ${
          showBadge ? 'text-amber-400 bg-white/5 border border-amber-500/30' : 'text-emerald-400'
        }`}
        title="Open Global Filters"
      >
        <Filter
          className={`w-5 h-5 transition-transform group-hover:scale-110 ${showBadge ? 'animate-pulse' : ''}`}
        />
        {showBadge && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        )}
        {!isCollapsed && (
          <span className="absolute left-14 opacity-0 group-hover:opacity-100 whitespace-nowrap bg-black/80 px-2 py-1 rounded text-xs pointer-events-none transition-opacity z-50">
            Filters
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsFilterOpen()}
      className={`group relative p-3 rounded-xl transition-all duration-300 border shadow-sm ${
        !showBadge
          ? 'bg-white border-slate-200 text-slate-400 hover:border-green-200 hover:text-green-600 hover:bg-green-50'
          : hasPendingFilterChanges
            ? 'bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-200'
            : 'bg-green-600 border-green-700 text-white shadow-lg shadow-green-200'
      }`}
      title="Open Global Filters"
    >
      <div className="flex items-center gap-2">
        <Filter
          className={`w-5 h-5 transition-transform group-hover:scale-110 ${showBadge ? 'animate-pulse' : ''}`}
        />
      </div>
      {showBadge && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
      )}
    </button>
  );
}

export function SalesFiltersProvider({
  children,
  uniqueValues,
  activeTab,
}: {
  children: React.ReactNode;
  uniqueValues: SalesFilterOptions;
  activeTab: string;
}) {
  const filterState = useSalesFilters();
  const commonFilters = filterState.appliedFilters;

  useEffect(() => {
    if (activeTab !== 'sales-reports' && filterState.activeFilterTab === 'reporting') {
      filterState.setActiveFilterTab('mode');
    }
  }, [activeTab, filterState.activeFilterTab, filterState.setActiveFilterTab]);

  const value = useMemo(
    () => ({
      ...filterState,
      commonFilters,
      uniqueValues,
      activeTab,
    }),
    [filterState, commonFilters, uniqueValues, activeTab]
  );

  return (
    <SalesFiltersContext.Provider value={value}>
      {children}
      <SalesFilterModal
        isOpen={filterState.isFilterOpen}
        onClose={filterState.closeFilterModal}
        onApply={filterState.applyFilters}
        hasPendingFilterChanges={filterState.hasPendingFilterChanges}
        activeTab={activeTab}
        uniqueValues={uniqueValues}
        invoiceTypeFilter={filterState.draftInvoiceTypeFilter}
        setInvoiceTypeFilter={filterState.setDraftInvoiceTypeFilter}
        filterYear={filterState.filterYear}
        setFilterYear={filterState.setFilterYear}
        filterMonth={filterState.filterMonth}
        setFilterMonth={filterState.setFilterMonth}
        dateFrom={filterState.dateFrom}
        setDateFrom={filterState.setDateFrom}
        dateTo={filterState.dateTo}
        setDateTo={filterState.setDateTo}
        filterArea={filterState.filterArea}
        setFilterArea={filterState.setFilterArea}
        filterMarket={filterState.filterMarket}
        setFilterMarket={filterState.setFilterMarket}
        filterMerchandiser={filterState.filterMerchandiser}
        setFilterMerchandiser={filterState.setFilterMerchandiser}
        filterSalesRep={filterState.filterSalesRep}
        setFilterSalesRep={filterState.setFilterSalesRep}
        filterProductTag={filterState.filterProductTag}
        setFilterProductTag={filterState.setFilterProductTag}
        filterProduct={filterState.filterProduct}
        setFilterProduct={filterState.setFilterProduct}
        filterCustomerMainName={filterState.filterCustomerMainName}
        setFilterCustomerMainName={filterState.setFilterCustomerMainName}
        filterCustomerSubName={filterState.filterCustomerSubName}
        setFilterCustomerSubName={filterState.setFilterCustomerSubName}
        filterCustomerTag={filterState.filterCustomerTag}
        setFilterCustomerTag={filterState.setFilterCustomerTag}
        filterCustomerClass={filterState.filterCustomerClass}
        setFilterCustomerClass={filterState.setFilterCustomerClass}
        inactiveDays={filterState.draftInactiveDays}
        setInactiveDays={filterState.setInactiveDays}
        inactiveMinAmount={filterState.draftInactiveMinAmount}
        setInactiveMinAmount={filterState.setInactiveMinAmount}
        setReportDateFrom={filterState.setReportDateFrom}
        setReportDateTo={filterState.setReportDateTo}
        draftReportCompareMode={filterState.draftReportCompareMode}
        setDraftReportCompareMode={filterState.setDraftReportCompareMode}
        draftReportCustomerView={filterState.draftReportCustomerView}
        setDraftReportCustomerView={filterState.setDraftReportCustomerView}
        isFiltering={filterState.isFiltering}
        setIsFiltering={filterState.setIsFiltering}
        activeFilterTab={filterState.activeFilterTab}
        setActiveFilterTab={filterState.setActiveFilterTab}
        resetFilters={filterState.resetFilters}
      />
    </SalesFiltersContext.Provider>
  );
}
