import React, { useState, useMemo, useEffect } from 'react';
import { InvoiceRow } from '@/types';
import { parseDate } from '../CustomersTab/CstomersUtils';
import { 
  Settings2, 
  CalendarDays, 
  Users, 
  Tags, 
  Clock, 
  CalendarClock, 
  X, 
  Check,
  ChevronDown,
  RotateCcw,
  Filter,
  CheckCircle2,
  Wallet
} from 'lucide-react';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: any;
  setFilters: (filters: any) => void;
  filteredDataCount: number;
  data: InvoiceRow[];
}

interface CustomSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  value,
  options,
  onChange,
  isOpen,
  setIsOpen
}) => {
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="relative">
      <label className="block text-[11px] font-bold text-gray-400 mb-2 tracking-wider uppercase">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 border-2 border-slate-100 text-slate-700 text-sm py-3 px-4 rounded-xl focus:outline-none focus:border-indigo-500 hover:bg-slate-100 hover:border-slate-200 transition-all font-semibold flex justify-between items-center text-left"
      >
        <span>{selectedOption.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 z-40 py-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors flex justify-between items-center ${
                  opt.value === value
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 font-medium'
                }`}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  setFilters,
  filteredDataCount,
  data
}) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'BALANCES' | 'DATES' | 'CUSTOMER_CLASSES' | 'CUSTOMER_TAGS' | 'OVERDUE_YEARS' | 'OVERDUE_MONTHS'>('GENERAL');
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [isAreaOpen, setIsAreaOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);

  const [draftFilters, setDraftFilters] = useState({
    customerRating: 'ALL',
    selectedSalesRep: 'ALL',
    emailFilter: 'ALL',
    overdueMonth: [] as string[],
    overdueYear: [] as string[],
    selectedCustomerTags: [] as string[],
    selectedCustomerClasses: [] as string[],
    dateFrom: '',
    dateTo: '',
    hideZeroAndNegativeBalance: false,
    hideZeroBalanceOnly: false,
    hideNegativeBalanceOnly: false,
    agingMode: 'days' as 'days' | 'months',
  });

  useEffect(() => {
    if (isOpen) {
      setDraftFilters({
        customerRating: filters.customerRating || 'ALL',
        selectedSalesRep: filters.selectedSalesRep || 'ALL',
        emailFilter: filters.emailFilter || 'ALL',
        overdueMonth: filters.overdueMonth || [],
        overdueYear: filters.overdueYear || [],
        selectedCustomerTags: filters.selectedCustomerTags || [],
        selectedCustomerClasses: filters.selectedCustomerClasses || [],
        dateFrom: filters.dateFrom || '',
        dateTo: filters.dateTo || '',
        hideZeroAndNegativeBalance: filters.hideZeroAndNegativeBalance || false,
        hideZeroBalanceOnly: filters.hideZeroBalanceOnly || false,
        hideNegativeBalanceOnly: filters.hideNegativeBalanceOnly || false,
        agingMode: filters.agingMode || 'days',
      });
    }
  }, [isOpen, filters]);

  const formatMonthYear = (date: Date) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const overdueMonths = useMemo(() => {
    const monthsMap = new Map<string, Date>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const customerInvoicesMap = new Map<string, InvoiceRow[]>();
    data.forEach(row => {
      const invoices = customerInvoicesMap.get(row.customerName) || [];
      invoices.push(row);
      customerInvoicesMap.set(row.customerName, invoices);
    });

    customerInvoicesMap.forEach((customerInvoices) => {
      const matchingGroups = new Map<string, InvoiceRow[]>();
      customerInvoices.forEach(inv => {
        const key = inv.matching || 'UNMATCHED';
        const group = matchingGroups.get(key) || [];
        group.push(inv);
        matchingGroups.set(key, group);
      });

      matchingGroups.forEach((group, matchingKey) => {
        const groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
        if (groupNetDebt <= 0.01) return;

        if (matchingKey === 'UNMATCHED') {
          group.forEach(inv => {
            const invNetDebt = inv.debit - inv.credit;
            if (invNetDebt <= 0.01) return;
            const targetDate = inv.dueDate ? parseDate(inv.dueDate) : (inv.date ? parseDate(inv.date) : null);
            if (targetDate && targetDate < today) {
              const label = formatMonthYear(targetDate);
              if (!monthsMap.has(label)) {
                monthsMap.set(label, new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
              }
            }
          });
        } else {
          let firstInv = group[0];
          let maxDebit = -1;
          group.forEach(inv => { if (inv.debit > maxDebit) { maxDebit = inv.debit; firstInv = inv; } });
          const targetDate = firstInv.dueDate ? parseDate(firstInv.dueDate) : (firstInv.date ? parseDate(firstInv.date) : null);
          if (targetDate && targetDate < today) {
            const label = formatMonthYear(targetDate);
            if (!monthsMap.has(label)) {
              monthsMap.set(label, new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
            }
          }
        }
      });
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => a[1].getTime() - b[1].getTime())
      .map(entry => entry[0]);
  }, [data]);

  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    overdueMonths.forEach(m => {
      const parts = m.split(' ');
      if (parts.length === 2) {
        years.add(parts[1]);
      }
    });
    return Array.from(years).sort((a, b) => parseInt(a) - parseInt(b));
  }, [overdueMonths]);

  const displayedMonths = useMemo(() => {
    const selectedYears = draftFilters.overdueYear || [];
    if (!Array.isArray(selectedYears) || selectedYears.length === 0) return overdueMonths;
    return overdueMonths.filter(m => selectedYears.some((year: string) => m.endsWith(year)));
  }, [overdueMonths, draftFilters.overdueYear]);

  const toggleOverdueYear = (year: string) => {
    const current = Array.isArray(draftFilters.overdueYear) ? draftFilters.overdueYear : [];
    const next = current.includes(year)
      ? current.filter((y: string) => y !== year)
      : [...current, year];
    updateDraftFilter('overdueYear', next);
  };

  const toggleOverdueMonth = (month: string) => {
    const current = Array.isArray(draftFilters.overdueMonth) ? draftFilters.overdueMonth : [];
    const next = current.includes(month)
      ? current.filter((m: string) => m !== month)
      : [...current, month];
    updateDraftFilter('overdueMonth', next);
  };

  const uniqueCustomerClasses = useMemo(() => {
    const classes = new Set<string>();
    data.forEach((row) => {
      const cls = row.customerClass?.trim();
      if (cls) classes.add(cls);
    });
    return Array.from(classes).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const toggleCustomerClass = (cls: string) => {
    const current = Array.isArray(draftFilters.selectedCustomerClasses)
      ? draftFilters.selectedCustomerClasses
      : [];
    const next = current.includes(cls)
      ? current.filter((c: string) => c !== cls)
      : [...current, cls];
    updateDraftFilter('selectedCustomerClasses', next);
  };

  const uniqueCustomerTags = useMemo(() => {
    const tags = new Set<string>();
    data.forEach((row) => {
      const tag = row.customerTag?.trim();
      if (tag) tags.add(tag);
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const toggleCustomerTag = (tag: string) => {
    const current = Array.isArray(draftFilters.selectedCustomerTags)
      ? draftFilters.selectedCustomerTags
      : [];
    const next = current.includes(tag)
      ? current.filter((t: string) => t !== tag)
      : [...current, tag];
    updateDraftFilter('selectedCustomerTags', next);
  };

  const ratingOptions = [
    { value: 'ALL', label: 'All Ratings' },
    { value: 'GOOD', label: 'Good' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'BAD', label: 'Bad' }
  ];

  const allSalesReps = useMemo(() => {
    const reps = new Set<string>();
    data.forEach(row => { if (row.salesRep && row.salesRep.trim()) reps.add(row.salesRep.trim()); });
    return Array.from(reps).sort();
  }, [data]);

  const areaOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Areas' },
      ...allSalesReps.map(rep => ({ value: rep, label: rep }))
    ];
  }, [allSalesReps]);

  const emailOptions = [
    { value: 'ALL', label: 'All Customers' },
    { value: 'EMAIL_NORMAL', label: 'Normal Emails Only' },
    { value: 'EMAIL_LULU', label: 'Lulu Emails Only' }
  ];

  if (!isOpen) return null;

  const updateDraftFilter = (key: string, value: any) => {
    setDraftFilters((prev: any) => ({ ...prev, [key]: value }));
  };

  const resetAllFilters = () => {
    setDraftFilters({
      customerRating: 'ALL',
      selectedSalesRep: 'ALL',
      emailFilter: 'ALL',
      overdueMonth: [],
      overdueYear: [],
      selectedCustomerTags: [],
      selectedCustomerClasses: [],
      dateFrom: '',
      dateTo: '',
      hideZeroAndNegativeBalance: false,
      hideZeroBalanceOnly: false,
      hideNegativeBalanceOnly: false,
      agingMode: 'days',
    });
  };

  const handleApplyFilters = () => {
    setFilters({
      ...filters,
      customerRating: draftFilters.customerRating,
      selectedSalesRep: draftFilters.selectedSalesRep,
      emailFilter: draftFilters.emailFilter,
      overdueMonth: draftFilters.overdueMonth,
      overdueYear: draftFilters.overdueYear,
      selectedCustomerTags: draftFilters.selectedCustomerTags,
      selectedCustomerClasses: draftFilters.selectedCustomerClasses,
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      hideZeroAndNegativeBalance: draftFilters.hideZeroAndNegativeBalance,
      hideZeroBalanceOnly: draftFilters.hideZeroBalanceOnly,
      hideNegativeBalanceOnly: draftFilters.hideNegativeBalanceOnly,
      agingMode: draftFilters.agingMode,
    });
    onClose();
  };

  const tabs = [
    { id: 'GENERAL', label: 'General', icon: Settings2 },
    { id: 'BALANCES', label: 'Balances', icon: Wallet },
    { id: 'DATES', label: 'Dates', icon: CalendarDays },
    { id: 'CUSTOMER_CLASSES', label: 'Classes', icon: Users },
    { id: 'CUSTOMER_TAGS', label: 'Tags', icon: Tags },
    { id: 'OVERDUE_YEARS', label: 'Years', icon: Clock },
    { id: 'OVERDUE_MONTHS', label: 'Months', icon: CalendarClock },
  ];

  const getBadgeCount = (tabId: string) => {
    let c = 0;
    switch(tabId) {
      case 'GENERAL':
        if (draftFilters.customerRating !== 'ALL') c++;
        if (draftFilters.selectedSalesRep !== 'ALL') c++;
        if (draftFilters.emailFilter !== 'ALL') c++;
        return c;
      case 'BALANCES':
        if (draftFilters.hideZeroAndNegativeBalance || draftFilters.hideZeroBalanceOnly || draftFilters.hideNegativeBalanceOnly) c++;
        if (draftFilters.agingMode !== 'days') c++;
        return c;
      case 'DATES':
        if (draftFilters.dateFrom) c++;
        if (draftFilters.dateTo) c++;
        return c;
      case 'CUSTOMER_CLASSES': return draftFilters.selectedCustomerClasses?.length || 0;
      case 'CUSTOMER_TAGS': return draftFilters.selectedCustomerTags?.length || 0;
      case 'OVERDUE_YEARS': return draftFilters.overdueYear?.length || 0;
      case 'OVERDUE_MONTHS': return draftFilters.overdueMonth?.length || 0;
      default: return 0;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[800px] max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-slate-900/5">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Advanced Filters</h3>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">{filteredDataCount}</span> results match your criteria
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={resetAllFilters}
              title="Reset All Filters"
              className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={handleApplyFilters}
              title="Apply Filters"
              className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-full transition-colors"
            >
              <Check className="w-5 h-5" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            <button onClick={onClose} title="Close" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split */}
        <div className="flex flex-1 overflow-hidden bg-slate-50/50">
          
          {/* Sidebar */}
          <div className="w-64 bg-white border-r border-slate-100 p-4 space-y-2 overflow-y-auto z-10">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Filter Categories</div>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badgeCount = getBadgeCount(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {badgeCount > 0 && (
                    <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {badgeCount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8 overflow-y-auto relative">
            <div className="w-full animate-in slide-in-from-right-4 fade-in duration-300">
              
              {activeTab === 'GENERAL' && (
                <div className="space-y-8 max-w-2xl">
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 mb-6">General Settings</h4>
                    <div className="space-y-5">
                      <CustomSelect
                        label="Customer Rating"
                        value={draftFilters.customerRating || 'ALL'}
                        options={ratingOptions}
                        onChange={(val) => updateDraftFilter('customerRating', val)}
                        isOpen={isRatingOpen}
                        setIsOpen={(open) => { setIsRatingOpen(open); if (open) { setIsAreaOpen(false); setIsEmailOpen(false); } }}
                      />
                      <CustomSelect
                        label="Area / Sales Rep"
                        value={draftFilters.selectedSalesRep || 'ALL'}
                        options={areaOptions}
                        onChange={(val) => updateDraftFilter('selectedSalesRep', val)}
                        isOpen={isAreaOpen}
                        setIsOpen={(open) => { setIsAreaOpen(open); if (open) { setIsRatingOpen(false); setIsEmailOpen(false); } }}
                      />
                      <CustomSelect
                        label="Email Status"
                        value={draftFilters.emailFilter || 'ALL'}
                        options={emailOptions}
                        onChange={(val) => updateDraftFilter('emailFilter', val)}
                        isOpen={isEmailOpen}
                        setIsOpen={(open) => { setIsEmailOpen(open); if (open) { setIsRatingOpen(false); setIsAreaOpen(false); } }}
                      />
                    </div>
                  </div>
                </div>
              )}

              
              {activeTab === 'BALANCES' && (
                <div className="space-y-8 max-w-2xl">
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 mb-6">Balance Filters</h4>
                    <div className="space-y-4">
                      {/* Hide Zero and Negative */}
                      <label className="flex items-center justify-between cursor-pointer group bg-white border-2 border-slate-100 hover:border-indigo-200 p-4 rounded-2xl transition-all shadow-sm hover:shadow-md">
                        <div>
                          <p className="text-sm font-bold text-slate-800">Hide Zero & Negative Balance</p>
                        </div>
                        <div className="relative inline-flex items-center">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={draftFilters.hideZeroAndNegativeBalance}
                            onChange={(e) => updateDraftFilter('hideZeroAndNegativeBalance', e.target.checked)}
                          />
                          <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${draftFilters.hideZeroAndNegativeBalance ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                          <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${draftFilters.hideZeroAndNegativeBalance ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                      </label>

                      {/* Hide Zero Only */}
                      <label className="flex items-center justify-between cursor-pointer group bg-white border-2 border-slate-100 hover:border-indigo-200 p-4 rounded-2xl transition-all shadow-sm hover:shadow-md">
                        <div>
                          <p className="text-sm font-bold text-slate-800">Hide Zero Balance Only</p>
                        </div>
                        <div className="relative inline-flex items-center">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={draftFilters.hideZeroBalanceOnly}
                            onChange={(e) => updateDraftFilter('hideZeroBalanceOnly', e.target.checked)}
                          />
                          <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${draftFilters.hideZeroBalanceOnly ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                          <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${draftFilters.hideZeroBalanceOnly ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                      </label>

                      {/* Hide Negative Only */}
                      <label className="flex items-center justify-between cursor-pointer group bg-white border-2 border-slate-100 hover:border-indigo-200 p-4 rounded-2xl transition-all shadow-sm hover:shadow-md">
                        <div>
                          <p className="text-sm font-bold text-slate-800">Hide Negative Balance Only</p>
                        </div>
                        <div className="relative inline-flex items-center">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={draftFilters.hideNegativeBalanceOnly}
                            onChange={(e) => updateDraftFilter('hideNegativeBalanceOnly', e.target.checked)}
                          />
                          <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${draftFilters.hideNegativeBalanceOnly ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                          <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${draftFilters.hideNegativeBalanceOnly ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <h4 className="text-[11px] font-bold text-slate-400 mb-4 tracking-wider uppercase">Aging Calculation Mode</h4>
                      <div className="flex bg-slate-100 p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
                        <button
                          onClick={() => updateDraftFilter('agingMode', 'days')}
                          className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-colors ${draftFilters.agingMode === 'days' ? 'bg-white text-indigo-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                          title="Calculate aging by exact days from invoice date"
                        >
                          Exact Days
                        </button>
                        <button
                          onClick={() => updateDraftFilter('agingMode', 'months')}
                          className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-colors ${draftFilters.agingMode === 'months' ? 'bg-white text-indigo-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                          title="Calculate aging by payment terms in calendar months"
                        >
                          Calendar Months
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {activeTab === 'DATES' && (
                <div className="space-y-8 max-w-2xl">
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 mb-6">Time Period</h4>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="relative">
                        <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-wider uppercase">Date From</label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 border-2 border-slate-100 text-slate-700 text-sm py-3 px-4 rounded-xl focus:outline-none focus:border-indigo-500 hover:bg-slate-100 transition-colors font-semibold"
                          value={draftFilters.dateFrom}
                          onChange={(e) => updateDraftFilter('dateFrom', e.target.value)}
                        />
                      </div>
                      <div className="relative">
                        <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-wider uppercase">Date To</label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 border-2 border-slate-100 text-slate-700 text-sm py-3 px-4 rounded-xl focus:outline-none focus:border-indigo-500 hover:bg-slate-100 transition-colors font-semibold"
                          value={draftFilters.dateTo}
                          onChange={(e) => updateDraftFilter('dateTo', e.target.value)}
                        />
                      </div>
                    </div>
                    

                  </div>
                </div>
              )}

              {activeTab === 'CUSTOMER_CLASSES' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">Customer Classes</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateDraftFilter('selectedCustomerClasses', [...uniqueCustomerClasses])}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => updateDraftFilter('selectedCustomerClasses', [])}
                        className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  {uniqueCustomerClasses.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl">
                      No customer classes found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {uniqueCustomerClasses.map((cls) => {
                        const isSelected = draftFilters.selectedCustomerClasses?.includes(cls);
                        return (
                          <button
                            key={cls}
                            onClick={() => toggleCustomerClass(cls)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                            {cls}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'CUSTOMER_TAGS' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">Customer Tags</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateDraftFilter('selectedCustomerTags', [...uniqueCustomerTags])}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => updateDraftFilter('selectedCustomerTags', [])}
                        className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  {uniqueCustomerTags.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl">
                      No customer tags found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {uniqueCustomerTags.map((tag) => {
                        const isSelected = draftFilters.selectedCustomerTags?.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleCustomerTag(tag)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'OVERDUE_YEARS' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">Overdue Years</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateDraftFilter('overdueYear', [...uniqueYears])}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => updateDraftFilter('overdueYear', [])}
                        className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  {uniqueYears.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl">
                      No overdue years detected.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {uniqueYears.map(year => {
                        const isSelected = draftFilters.overdueYear?.includes(year);
                        return (
                          <button
                            key={year}
                            onClick={() => toggleOverdueYear(year)}
                            className={`py-4 rounded-xl text-lg font-bold transition-all flex flex-col items-center justify-center gap-1 border-2 ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {year}
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'OVERDUE_MONTHS' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">Overdue Months</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateDraftFilter('overdueMonth', [...displayedMonths])}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => updateDraftFilter('overdueMonth', [])}
                        className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  {draftFilters.overdueYear?.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex justify-between items-center">
                      <p className="text-sm text-blue-800 font-medium">
                        Showing months for year(s): <span className="font-bold">{draftFilters.overdueYear.join(', ')}</span>
                      </p>
                      <button
                        onClick={() => updateDraftFilter('overdueYear', [])}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        Show All
                      </button>
                    </div>
                  )}

                  {displayedMonths.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl">
                      No overdue months detected.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {displayedMonths.map(month => {
                        const isSelected = draftFilters.overdueMonth?.includes(month);
                        return (
                          <button
                            key={month}
                            onClick={() => toggleOverdueMonth(month)}
                            className={`py-3 px-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border-2 ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                            {month}
                          </button>
                        );
                      })}
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
};

export default FilterModal;
