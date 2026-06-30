'use client';

import { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import {
  Filter,
  ChevronDown,
  CheckCircle2,
  X,
  RotateCcw,
  Calendar,
  Layers,
  RefreshCcw,
  TrendingUp,
  Tag,
  Search,
} from 'lucide-react';
import Loading from '@/app/Components/Loading';

export type InvoiceTypeFilter = 'all' | 'sales' | 'returns';
export type SalesFilterTab = 'mode' | 'timing' | 'product' | 'outreach' | 'advanced';

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
};

export type SalesFilterOptions = {
  areas: string[];
  markets: string[];
  merchandisers: string[];
  salesReps: string[];
  productTags: string[];
  years: string[];
};

const MONTH_OPTIONS = [
  { label: 'All Months', value: '' },
  ...Array.from({ length: 12 }, (_, i) => ({
    label: new Date(2000, i).toLocaleString('en-US', { month: 'long' }),
    value: (i + 1).toString(),
  })),
];

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
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<InvoiceTypeFilter>('all');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterMarket, setFilterMarket] = useState('');
  const [filterMerchandiser, setFilterMerchandiser] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  const [filterProductTag, setFilterProductTag] = useState('');
  const [inactiveDays, setInactiveDays] = useState('30');
  const [inactiveMinAmount, setInactiveMinAmount] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<SalesFilterTab>('mode');

  const hasAnyFilter = useMemo(() => {
    return (
      invoiceTypeFilter !== 'all' ||
      filterYear ||
      filterMonth ||
      dateFrom ||
      dateTo ||
      filterArea ||
      filterMarket ||
      filterMerchandiser ||
      filterSalesRep ||
      filterProductTag
    );
  }, [
    invoiceTypeFilter,
    filterYear,
    filterMonth,
    dateFrom,
    dateTo,
    filterArea,
    filterMarket,
    filterMerchandiser,
    filterSalesRep,
    filterProductTag,
  ]);

  const resetFilters = () => {
    setInvoiceTypeFilter('all');
    setFilterYear('');
    setFilterMonth('');
    setDateFrom('');
    setDateTo('');
    setFilterArea('');
    setFilterMarket('');
    setFilterMerchandiser('');
    setFilterSalesRep('');
    setFilterProductTag('');
  };

  const getCommonFilters = (): SalesCommonFilters => ({
    invoiceType: invoiceTypeFilter,
    year: filterYear,
    month: filterMonth,
    dateFrom,
    dateTo,
    area: filterArea,
    market: filterMarket,
    merchandiser: filterMerchandiser,
    salesRep: filterSalesRep,
    productTag: filterProductTag,
  });

  return {
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
    inactiveDays,
    setInactiveDays,
    inactiveMinAmount,
    setInactiveMinAmount,
    isFilterOpen,
    setIsFilterOpen,
    isFiltering,
    setIsFiltering,
    activeFilterTab,
    setActiveFilterTab,
    hasAnyFilter,
    resetFilters,
    getCommonFilters,
  };
}

export type SalesFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
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
  inactiveDays: string;
  setInactiveDays: (value: string) => void;
  inactiveMinAmount: string;
  setInactiveMinAmount: (value: string) => void;
  isFiltering: boolean;
  setIsFiltering: (value: boolean) => void;
  activeFilterTab: SalesFilterTab;
  setActiveFilterTab: (value: SalesFilterTab) => void;
  resetFilters: () => void;
};

export function SalesFilterModal({
  isOpen,
  onClose,
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
  inactiveDays,
  setInactiveDays,
  inactiveMinAmount,
  setInactiveMinAmount,
  isFiltering,
  setIsFiltering,
  activeFilterTab,
  setActiveFilterTab,
  resetFilters,
}: SalesFilterModalProps) {
  if (!isOpen) return null;

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
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetFilters}
              title="Reset All Filters"
              className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              title="Apply Filters"
              className="p-3 bg-green-600 text-white rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 hover:scale-[1.05] active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-6 h-6" />
            </button>
            <div className="w-[1px] h-8 bg-slate-200 mx-2" />
            <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-xl transition-colors group">
              <X className="w-6 h-6 text-slate-300 group-hover:text-slate-600 transition-colors" />
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 bg-white">
          <div className="px-10 py-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
            {[
              { id: 'mode', label: 'Reporting Mode' },
              { id: 'timing', label: 'Timing & Periods' },
              { id: 'product', label: 'Product Category' },
              { id: 'outreach', label: 'Team & Territory' },
              ...(activeTab === 'sales-inactive-customers'
                ? [{ id: 'advanced', label: 'Comprehensive Filters' }]
                : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilterTab(tab.id as SalesFilterTab)}
                className={`flex-1 flex items-center justify-center px-2 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeFilterTab === tab.id
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 ring-4 ring-slate-900/10'
                    : 'text-slate-400 hover:bg-white hover:text-slate-600 border border-transparent hover:border-slate-100'
                }`}
              >
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p-10 overflow-y-auto custom-scrollbar flex-1 min-h-[450px] relative">
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
                            options={uniqueValues.years}
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
                  <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                    <div className="space-y-4">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Tag className="w-3 h-3" /> Product Category (Tag)
                      </h5>
                      <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                            Select Category
                          </label>
                          <ModernSelect
                            value={filterProductTag}
                            onChange={setFilterProductTag}
                            options={[
                              { label: 'All Categories', value: '' },
                              ...uniqueValues.productTags.map((v) => ({ label: v, value: v })),
                            ]}
                            placeholder="All Categories"
                          />
                        </div>
                      </div>
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
            </div>
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

export function SalesFilterButton() {
  const { hasAnyFilter, setIsFilterOpen } = useSalesModuleFilters();

  return (
    <button
      type="button"
      onClick={() => setIsFilterOpen(true)}
      className={`group relative p-3 rounded-xl transition-all duration-300 border shadow-sm ${
        !hasAnyFilter
          ? 'bg-white border-slate-200 text-slate-400 hover:border-green-200 hover:text-green-600 hover:bg-green-50'
          : 'bg-green-600 border-green-700 text-white shadow-lg shadow-green-200'
      }`}
      title="Open Global Filters"
    >
      <div className="flex items-center gap-2">
        <Filter
          className={`w-5 h-5 transition-transform group-hover:scale-110 ${hasAnyFilter ? 'animate-pulse' : ''}`}
        />
      </div>
      {hasAnyFilter && (
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
  const commonFilters = useMemo(
    () => filterState.getCommonFilters(),
    [
      filterState.invoiceTypeFilter,
      filterState.filterYear,
      filterState.filterMonth,
      filterState.dateFrom,
      filterState.dateTo,
      filterState.filterArea,
      filterState.filterMarket,
      filterState.filterMerchandiser,
      filterState.filterSalesRep,
      filterState.filterProductTag,
    ]
  );

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
        onClose={() => filterState.setIsFilterOpen(false)}
        activeTab={activeTab}
        uniqueValues={uniqueValues}
        invoiceTypeFilter={filterState.invoiceTypeFilter}
        setInvoiceTypeFilter={filterState.setInvoiceTypeFilter}
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
        inactiveDays={filterState.inactiveDays}
        setInactiveDays={filterState.setInactiveDays}
        inactiveMinAmount={filterState.inactiveMinAmount}
        setInactiveMinAmount={filterState.setInactiveMinAmount}
        isFiltering={filterState.isFiltering}
        setIsFiltering={filterState.setIsFiltering}
        activeFilterTab={filterState.activeFilterTab}
        setActiveFilterTab={filterState.setActiveFilterTab}
        resetFilters={filterState.resetFilters}
      />
    </SalesFiltersContext.Provider>
  );
}
