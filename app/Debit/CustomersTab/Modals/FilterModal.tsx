import React, { useState, useMemo, useEffect } from 'react';
import { InvoiceRow } from '@/types';
import { parseDate } from '../CstomersUtils';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: any;
  setFilters: (filters: any) => void;
  allSalesReps: string[];
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
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-200 text-gray-800 text-sm py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold flex justify-between items-center text-left hover:border-gray-300"
      >
        <span>{selectedOption.label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4.5 w-4.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-150 rounded-xl shadow-xl z-40 py-1.5 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-all flex justify-between items-center ${
                  opt.value === value
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{opt.label}</span>
                {opt.value === value && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
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
  allSalesReps,
  filteredDataCount,
  data
}) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'OVERDUE_YEARS' | 'OVERDUE_MONTHS'>('GENERAL');
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [isAreaOpen, setIsAreaOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);

  const [draftFilters, setDraftFilters] = useState({
    customerRating: 'ALL',
    selectedSalesRep: 'ALL',
    emailFilter: 'ALL',
    overdueMonth: [] as string[],
    overdueYear: [] as string[],
  });

  // Sync draft filters with parent filters when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftFilters({
        customerRating: filters.customerRating || 'ALL',
        selectedSalesRep: filters.selectedSalesRep || 'ALL',
        emailFilter: filters.emailFilter || 'ALL',
        overdueMonth: filters.overdueMonth || [],
        overdueYear: filters.overdueYear || [],
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

  // Calculate unique overdue months from dataset, sorted oldest to newest
  const overdueMonths = useMemo(() => {
    const monthsMap = new Map<string, Date>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group invoices by customer name
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

  const ratingOptions = [
    { value: 'ALL', label: 'All Ratings' },
    { value: 'GOOD', label: 'Good' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'BAD', label: 'Bad' }
  ];

  const areaOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Regions' },
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
    });
  };

  const handleApplyFilters = () => {
    setFilters((prev: any) => ({
      ...prev,
      customerRating: draftFilters.customerRating,
      selectedSalesRep: draftFilters.selectedSalesRep,
      emailFilter: draftFilters.emailFilter,
      overdueMonth: draftFilters.overdueMonth,
      overdueYear: draftFilters.overdueYear,
    }));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[700px] max-h-[90vh] overflow-visible flex flex-col animate-in zoom-in-95 duration-300">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Advanced Filters</h3>
            <p className="text-sm text-gray-500">
              <span className="font-medium text-blue-600">{filteredDataCount}</span> results found
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Modal Body - Split Layout */}
        <div className="flex flex-1 overflow-visible">
          {/* Sidebar Tabs */}
          <div className="w-52 bg-gray-50 border-r border-gray-100 p-2 space-y-1 overflow-y-auto rounded-bl-2xl">
            {[
              { id: 'GENERAL', label: 'General Filters' },
              { id: 'OVERDUE_YEARS', label: 'Overdue Years' },
              { id: 'OVERDUE_MONTHS', label: 'Overdue Months' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className={`flex-1 p-6 bg-white ${activeTab === 'GENERAL' ? 'overflow-visible' : 'overflow-y-auto'}`}>
            {activeTab === 'GENERAL' && (
              <div className="space-y-6 max-w-lg">
                <h4 className="text-base font-semibold text-gray-800 border-b pb-2">General Filters</h4>
                <div className="space-y-4">
                  <CustomSelect
                    label="Customer Rating"
                    value={draftFilters.customerRating || 'ALL'}
                    options={ratingOptions}
                    onChange={(val) => updateDraftFilter('customerRating', val)}
                    isOpen={isRatingOpen}
                    setIsOpen={(open) => {
                      setIsRatingOpen(open);
                      if (open) { setIsAreaOpen(false); setIsEmailOpen(false); }
                    }}
                  />

                  <CustomSelect
                    label="Area / Region"
                    value={draftFilters.selectedSalesRep || 'ALL'}
                    options={areaOptions}
                    onChange={(val) => updateDraftFilter('selectedSalesRep', val)}
                    isOpen={isAreaOpen}
                    setIsOpen={(open) => {
                      setIsAreaOpen(open);
                      if (open) { setIsRatingOpen(false); setIsEmailOpen(false); }
                    }}
                  />

                  <CustomSelect
                    label="Email Status"
                    value={draftFilters.emailFilter || 'ALL'}
                    options={emailOptions}
                    onChange={(val) => updateDraftFilter('emailFilter', val)}
                    isOpen={isEmailOpen}
                    setIsOpen={(open) => {
                      setIsEmailOpen(open);
                      if (open) { setIsRatingOpen(false); setIsAreaOpen(false); }
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'OVERDUE_YEARS' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-base font-semibold text-gray-800 border-b pb-2">Overdue Years</h4>
                  <p className="text-sm text-gray-500 mt-2">Filter customers who have overdue balances in the selected year(s). Select multiple if needed.</p>
                </div>
                {uniqueYears.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm font-medium">
                    No overdue years detected in the dataset.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => updateDraftFilter('overdueYear', [])}
                      className={`px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all text-center flex items-center justify-center ${
                        (!draftFilters.overdueYear || draftFilters.overdueYear.length === 0)
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      All Years
                    </button>
                    {uniqueYears.map(year => (
                      <button
                        key={year}
                        onClick={() => toggleOverdueYear(year)}
                        className={`px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all text-center flex items-center justify-center ${
                          (draftFilters.overdueYear && draftFilters.overdueYear.includes(year))
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100 font-bold'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'OVERDUE_MONTHS' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-base font-semibold text-gray-800 border-b pb-2">Overdue Months</h4>
                  <p className="text-sm text-gray-500 mt-2">Filter and select specific month(s) to see customers with overdue balances. Select multiple if needed.</p>
                </div>

                {Array.isArray(draftFilters.overdueYear) && draftFilters.overdueYear.length > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex justify-between items-center text-xs text-blue-700 font-medium">
                    <span>Showing months for year(s): <strong>{draftFilters.overdueYear.join(', ')}</strong></span>
                    <button
                      onClick={() => updateDraftFilter('overdueYear', [])}
                      className="text-blue-600 hover:text-blue-800 underline font-bold"
                    >
                      Show All Years
                    </button>
                  </div>
                )}

                {displayedMonths.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm font-medium">
                    No overdue months detected for the selected criteria.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => updateDraftFilter('overdueMonth', [])}
                      className={`px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all text-center flex items-center justify-center ${
                        (!draftFilters.overdueMonth || draftFilters.overdueMonth.length === 0)
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      All Months
                    </button>
                    {displayedMonths.map(month => (
                      <button
                        key={month}
                        onClick={() => toggleOverdueMonth(month)}
                        className={`px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all text-center flex items-center justify-center ${
                          (draftFilters.overdueMonth && draftFilters.overdueMonth.includes(month))
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100 font-bold'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {month}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-2xl">
          <button
            onClick={resetAllFilters}
            className="text-red-600 hover:text-red-700 text-sm font-semibold px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
          >
            Reset All Filters
          </button>
          <button
            onClick={handleApplyFilters}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all shadow-blue-200"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
