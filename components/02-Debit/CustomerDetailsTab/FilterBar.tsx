import React from 'react';
import { Calendar, ListFilter, X } from 'lucide-react';

interface FilterBarProps {
  invoiceSearchQuery: string;
  setInvoiceSearchQuery: (s: string) => void;
  startDateFilter: string;
  setStartDateFilter: (s: string) => void;
  endDateFilter: string;
  setEndDateFilter: (s: string) => void;
  availableYears: string[];
  selectedYearFilter: string[];
  setSelectedYearFilter: React.Dispatch<React.SetStateAction<string[]>>;
  isYearDropdownOpen: boolean;
  setIsYearDropdownOpen: (s: boolean) => void;
  availableMonths: string[];
  selectedMonthFilter: string[];
  setSelectedMonthFilter: React.Dispatch<React.SetStateAction<string[]>>;
  isMonthDropdownOpen: boolean;
  setIsMonthDropdownOpen: (s: boolean) => void;
  availableOverdueMonths: string[];
  selectedOverdueMonthFilter: string[];
  setSelectedOverdueMonthFilter: React.Dispatch<React.SetStateAction<string[]>>;
  isOverdueMonthDropdownOpen: boolean;
  setIsOverdueMonthDropdownOpen: (s: boolean) => void;
  availableMatchingsWithResidual: string[];
  selectedMatchingFilter: string[];
  setSelectedMatchingFilter: React.Dispatch<React.SetStateAction<string[]>>;
  isMatchingDropdownOpen: boolean;
  setIsMatchingDropdownOpen: (s: boolean) => void;
  MATCHING_FILTER_ALL_OPEN: string;
  MATCHING_FILTER_ALL_UNMATCHED: string;
  // Type filters
  showOB: boolean; setShowOB: (s: boolean) => void;
  showSales: boolean; setShowSales: (s: boolean) => void;
  showReturns: boolean; setShowReturns: (s: boolean) => void;
  showPayments: boolean; setShowPayments: (s: boolean) => void;
  showDiscounts: boolean; setShowDiscounts: (s: boolean) => void;
  showJV: boolean; setShowJV: (s: boolean) => void;
  invoiceTypeTotals: any;
}

export default function FilterBar(props: FilterBarProps) {
  const {
    invoiceSearchQuery, setInvoiceSearchQuery,
    startDateFilter, setStartDateFilter, endDateFilter, setEndDateFilter,
    availableYears, selectedYearFilter, setSelectedYearFilter, isYearDropdownOpen, setIsYearDropdownOpen,
    availableMonths, selectedMonthFilter, setSelectedMonthFilter, isMonthDropdownOpen, setIsMonthDropdownOpen,
    availableOverdueMonths, selectedOverdueMonthFilter, setSelectedOverdueMonthFilter, isOverdueMonthDropdownOpen, setIsOverdueMonthDropdownOpen,
    availableMatchingsWithResidual, selectedMatchingFilter, setSelectedMatchingFilter, isMatchingDropdownOpen, setIsMatchingDropdownOpen,
    MATCHING_FILTER_ALL_OPEN, MATCHING_FILTER_ALL_UNMATCHED,
    showOB, setShowOB, showSales, setShowSales, showReturns, setShowReturns,
    showPayments, setShowPayments, showDiscounts, setShowDiscounts, showJV, setShowJV,
    invoiceTypeTotals
  } = props;

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-center gap-6 sticky top-0 z-20 backdrop-blur-xl bg-white/90 supports-[backdrop-filter]:bg-white/60">

        {/* Search */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={invoiceSearchQuery}
            onChange={(e) => setInvoiceSearchQuery(e.target.value)}
            className="block w-full pl-11 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white border focus:border-blue-500 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-500/10 transition-all font-medium"
          />
        </div>

        <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-center">

          {/* Date Range */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm hover:border-gray-300 transition-all focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 overflow-hidden group px-2">
            <style dangerouslySetInnerHTML={{ __html: `.hide-date-icon::-webkit-calendar-picker-indicator { display: none !important; -webkit-appearance: none; }` }} />
            <div className="flex items-center">
              <input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)}
                className="hide-date-icon bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 py-2.5 px-3 cursor-pointer w-[125px]" />
              <div className="w-px h-5 bg-gray-200 mx-1"></div>
              <input type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)}
                className="hide-date-icon bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 py-2.5 px-3 cursor-pointer w-[125px]" />
            </div>
            {(startDateFilter || endDateFilter) && (
              <button onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                className="mr-3 ml-1 p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all" title="Clear Dates">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Year Filter */}
          <div className="relative w-full md:w-56">
            <button type="button" onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${isYearDropdownOpen || selectedYearFilter.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-100' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}>
              <div className="flex items-center gap-2 truncate">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="truncate">{selectedYearFilter.length === 0 ? 'All Years' : selectedYearFilter.length === 1 ? selectedYearFilter[0] : `${selectedYearFilter.length} Selected`}</span>
              </div>
              <svg className={`w-4 h-4 shrink-0 transition-transform ${isYearDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isYearDropdownOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsYearDropdownOpen(false)}></div>
                <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 origin-top">
                  <div className="p-3 border-b border-gray-100 bg-gray-50/50 sticky top-0 backdrop-blur-sm">
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all">
                      <input type="checkbox"
                        checked={selectedYearFilter.length === availableYears.length && availableYears.length > 0}
                        onChange={(e) => { e.target.checked ? setSelectedYearFilter([...availableYears]) : setSelectedYearFilter([]); }}
                        className="peer h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm font-semibold text-gray-700">Select All</span>
                    </label>
                  </div>
                  <div className="p-2 space-y-1">
                    {availableYears.map((year) => (
                      <label key={year} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <input type="checkbox" checked={selectedYearFilter.includes(year)}
                          onChange={(e) => { if (e.target.checked) setSelectedYearFilter([...selectedYearFilter, year]); else setSelectedYearFilter(selectedYearFilter.filter(y => y !== year)); }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-600">{year}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Month Filter */}
          <div className="relative w-full md:w-56">
            <button type="button" onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${isMonthDropdownOpen || selectedMonthFilter.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-100' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}>
              <div className="flex items-center gap-2 truncate">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="truncate">{selectedMonthFilter.length === 0 ? 'All Months' : selectedMonthFilter.length === 1 ? selectedMonthFilter[0] : `${selectedMonthFilter.length} Selected`}</span>
              </div>
              <svg className={`w-4 h-4 shrink-0 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isMonthDropdownOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsMonthDropdownOpen(false)}></div>
                <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 origin-top">
                  <div className="p-3 border-b border-gray-100 bg-gray-50/50 sticky top-0 backdrop-blur-sm">
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all">
                      <input type="checkbox"
                        checked={selectedMonthFilter.length === availableMonths.length && availableMonths.length > 0}
                        onChange={(e) => { e.target.checked ? setSelectedMonthFilter([...availableMonths]) : setSelectedMonthFilter([]); }}
                        className="peer h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm font-semibold text-gray-700">Select All</span>
                    </label>
                  </div>
                  <div className="p-2 space-y-1">
                    {availableMonths.map((month) => (
                      <label key={month} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <input type="checkbox" checked={selectedMonthFilter.includes(month)}
                          onChange={(e) => { if (e.target.checked) setSelectedMonthFilter([...selectedMonthFilter, month]); else setSelectedMonthFilter(selectedMonthFilter.filter(m => m !== month)); }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-600">{month}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Overdue Month Filter */}
          <div className="relative w-full md:w-56">
            <button type="button" onClick={() => setIsOverdueMonthDropdownOpen(!isOverdueMonthDropdownOpen)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${isOverdueMonthDropdownOpen || selectedOverdueMonthFilter.length > 0 ? 'bg-red-50 border-red-200 text-red-700 ring-2 ring-red-100' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}>
              <div className="flex items-center gap-2 truncate">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="truncate">{selectedOverdueMonthFilter.length === 0 ? 'All Overdue Months' : selectedOverdueMonthFilter.length === 1 ? selectedOverdueMonthFilter[0] : `${selectedOverdueMonthFilter.length} Selected`}</span>
              </div>
              <svg className={`w-4 h-4 shrink-0 transition-transform ${isOverdueMonthDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOverdueMonthDropdownOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsOverdueMonthDropdownOpen(false)}></div>
                <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 origin-top">
                  <div className="p-3 border-b border-gray-100 bg-gray-50/50 sticky top-0 backdrop-blur-sm">
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all">
                      <input type="checkbox"
                        checked={selectedOverdueMonthFilter.length === availableOverdueMonths.length && availableOverdueMonths.length > 0}
                        onChange={(e) => { e.target.checked ? setSelectedOverdueMonthFilter([...availableOverdueMonths]) : setSelectedOverdueMonthFilter([]); }}
                        className="peer h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                      <span className="text-sm font-semibold text-gray-700">Select All</span>
                    </label>
                  </div>
                  <div className="p-2 space-y-1">
                    {availableOverdueMonths.length === 0 && <div className="text-center text-sm text-gray-500 py-2">No overdue months</div>}
                    {availableOverdueMonths.map((month) => (
                      <label key={month} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <input type="checkbox" checked={selectedOverdueMonthFilter.includes(month)}
                          onChange={(e) => { if (e.target.checked) setSelectedOverdueMonthFilter([...selectedOverdueMonthFilter, month]); else setSelectedOverdueMonthFilter(selectedOverdueMonthFilter.filter(m => m !== month)); }}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                        <span className="text-sm text-gray-600">{month}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Matching Filter */}
          <div className="relative w-full md:w-56">
            <button type="button" onClick={() => setIsMatchingDropdownOpen(!isMatchingDropdownOpen)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${isMatchingDropdownOpen || selectedMatchingFilter.length > 0 ? 'bg-purple-50 border-purple-200 text-purple-700 ring-2 ring-purple-100' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}>
              <div className="flex items-center gap-2 truncate">
                <ListFilter className="w-4 h-4 shrink-0" />
                <span className="truncate">{selectedMatchingFilter.length === 0 ? 'All Matchings' : selectedMatchingFilter.length === 1 ? selectedMatchingFilter[0] : `${selectedMatchingFilter.length} Selected`}</span>
              </div>
              <svg className={`w-4 h-4 shrink-0 transition-transform ${isMatchingDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isMatchingDropdownOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsMatchingDropdownOpen(false)}></div>
                <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 origin-top">
                  <div className="p-3 border-b border-gray-100 bg-gray-50/50 sticky top-0 backdrop-blur-sm">
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all">
                      <input type="checkbox"
                        checked={selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN) && availableMatchingsWithResidual.every(m => selectedMatchingFilter.includes(m))}
                        onChange={(e) => { if (e.target.checked) setSelectedMatchingFilter([MATCHING_FILTER_ALL_OPEN, ...availableMatchingsWithResidual]); else setSelectedMatchingFilter([]); }}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                      <span className="text-sm font-semibold text-gray-700">Select All</span>
                    </label>
                  </div>
                  <div className="p-2 space-y-1">
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors bg-purple-50/50">
                      <input type="checkbox" checked={selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED)}
                        onChange={(e) => { if (e.target.checked) setSelectedMatchingFilter([...selectedMatchingFilter, MATCHING_FILTER_ALL_UNMATCHED]); else setSelectedMatchingFilter(selectedMatchingFilter.filter(m => m !== MATCHING_FILTER_ALL_UNMATCHED)); }}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                      <span className="text-sm font-medium text-gray-900">All Unmatched</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors bg-blue-50/50">
                      <input type="checkbox" checked={selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN)}
                        onChange={(e) => { if (e.target.checked) setSelectedMatchingFilter([...selectedMatchingFilter, MATCHING_FILTER_ALL_OPEN]); else setSelectedMatchingFilter(selectedMatchingFilter.filter(m => m !== MATCHING_FILTER_ALL_OPEN)); }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm font-medium text-gray-900">All Open Matchings</span>
                    </label>
                    <div className="h-px bg-gray-100 my-2"></div>
                    {availableMatchingsWithResidual.map((matching) => (
                      <label key={matching} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <input type="checkbox" checked={selectedMatchingFilter.includes(matching)}
                          onChange={(e) => { if (e.target.checked) setSelectedMatchingFilter([...selectedMatchingFilter, matching]); else setSelectedMatchingFilter(selectedMatchingFilter.filter(m => m !== matching)); }}
                          className="rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                        <span className="text-sm text-gray-600 font-mono">{matching}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Type Filters */}
      <div className="flex justify-center mt-4 px-4 pb-4">
        <div className="w-full">
          <div className="flex flex-nowrap gap-2 justify-center items-stretch bg-white p-2 border border-gray-100 rounded-xl shadow-sm">
            {[
              { key: 'ob', label: 'OB', checked: showOB, onChange: setShowOB, color: 'purple', total: invoiceTypeTotals.ob },
              { key: 'sales', label: 'المبيعات (SAL)', checked: showSales, onChange: setShowSales, color: 'blue', total: invoiceTypeTotals.sales },
              { key: 'returns', label: 'مرتجعات (RSAL)', checked: showReturns, onChange: setShowReturns, color: 'orange', total: invoiceTypeTotals.returns },
              { key: 'payments', label: 'الدفعات', checked: showPayments, onChange: setShowPayments, color: 'green', total: invoiceTypeTotals.payments },
              { key: 'discounts', label: 'الخصومات (BIL)', checked: showDiscounts, onChange: setShowDiscounts, color: 'yellow', total: invoiceTypeTotals.discounts },
              { key: 'jv', label: 'قيود (JV)', checked: showJV, onChange: setShowJV, color: 'indigo', total: invoiceTypeTotals.jv },
            ].map(({ key, label, checked, onChange, color, total }) => (
              <label key={key} className={`flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer p-3 bg-${color}-50 rounded-lg border border-${color}-100 hover:bg-${color}-100 transition-all text-center`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
                    className={`w-4 h-4 text-${color}-600 border-gray-300 rounded focus:ring-1 focus:ring-${color}-500 cursor-pointer`} />
                  <span className="text-sm font-bold text-gray-700">{label}</span>
                </div>
                <span className={`text-sm font-bold text-${color}-700`}>
                  {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </label>
            ))}
            <div className="flex-1 flex flex-col items-center justify-center gap-1 p-3 bg-emerald-50 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-all text-center shadow-sm">
              <span className="text-sm font-bold text-gray-700">صافي المبيعات</span>
              <span className="text-sm font-bold text-emerald-700">
                {(invoiceTypeTotals.sales + invoiceTypeTotals.returns).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
