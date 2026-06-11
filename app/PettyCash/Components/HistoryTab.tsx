import React, { useState, useMemo, useEffect } from 'react';
import { Search, Calendar, TrendingUp, TrendingDown, Wallet, FileText, CheckCircle2, ChevronDown, Check, User, Filter } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';

interface HistoryRecord {
  id: string;
  rowIndex: number;
  liquidationDate: string;
  date: string;
  type: string;
  amount: number;
  name: string;
  description: string;
  paid: string;
}

interface HistoryTabProps {
  records: HistoryRecord[];
  loading: boolean;
}

interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
  searchable?: boolean;
}

function CustomSelect({ label, value, onChange, options, placeholder = 'Select option', icon, searchable = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectSearchQuery, setSelectSearchQuery] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search query when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSelectSearchQuery('');
    }
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value);

  // Filter options based on selectSearchQuery
  const filteredOptions = useMemo(() => {
    if (!searchable || !selectSearchQuery) return options;
    const q = selectSearchQuery.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, selectSearchQuery, searchable]);

  return (
    <div className="w-full relative" ref={containerRef}>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full pl-4 pr-10 py-2.5 border-2 border-cyan-100 focus:border-cyan-500 rounded-xl bg-white font-bold text-gray-700 shadow-sm transition-all duration-200 hover:border-cyan-200 text-left flex items-center justify-between min-h-[46px]"
        >
          <div className="flex items-center gap-2 truncate">
            {icon && <div className="text-cyan-600 flex-shrink-0">{icon}</div>}
            <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-cyan-600 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col">
            {searchable && (
              <div className="px-3 py-2 border-b border-gray-100 sticky top-0 bg-white z-10 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={selectSearchQuery}
                    onChange={(e) => setSelectSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 focus:border-cyan-500 rounded-lg focus:outline-none bg-gray-50/50 font-bold"
                    onClick={(e) => e.stopPropagation()} // Prevent closing dropdown on input click
                  />
                </div>
              </div>
            )}
            <div className="overflow-y-auto flex-1 max-h-[200px]">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-400 font-semibold italic text-center">No options available</div>
              ) : (
                filteredOptions.map(option => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors duration-150 flex items-center justify-between ${isSelected
                          ? 'bg-cyan-50 text-cyan-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-cyan-600'
                        }`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-cyan-600 flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryTab({ records, loading }: HistoryTabProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedName, setSelectedName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);


  // 1. Get unique liquidation dates (sorted descending from newest to oldest)
  const uniqueDates = useMemo(() => {
    const parseLiquidationDate = (dateStr: string) => {
      if (!dateStr) return 0;
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        const [d, m, y] = parts.map(Number);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          return new Date(y, m - 1, d).getTime();
        }
      }
      return Date.parse(dateStr) || 0;
    };
    const dates = new Set(records.map(r => r.liquidationDate).filter(Boolean));
    return Array.from(dates).sort((a, b) => parseLiquidationDate(b) - parseLiquidationDate(a));
  }, [records]);

  // 1b. Get unique names for the selected liquidation date (sorted alphabetically)
  const uniqueNames = useMemo(() => {
    const recordsToSource = selectedDate
      ? records.filter(r => r.liquidationDate === selectedDate)
      : records;
    const names = new Set(
      recordsToSource
        .map(r => r.name)
        .filter(Boolean)
    );
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [records, selectedDate]);

  // 3. Filter records for the selected liquidation date, type, name & search query (sorted newest to oldest)
  const filteredRecords = useMemo(() => {
    if (records.length === 0) return [];

    const parseDate = (dateStr: string) => {
      if (!dateStr) return 0;
      if (dateStr.includes('.')) {
        const parts = dateStr.split('.');
        if (parts.length === 3) {
          const [d, m, y] = parts.map(Number);
          if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
            return new Date(y, m - 1, d).getTime();
          }
        }
      }
      const parsed = Date.parse(dateStr);
      return isNaN(parsed) ? 0 : parsed;
    };

    return records
      .filter(r => {
        if (selectedDate && r.liquidationDate !== selectedDate) return false;
        if (selectedType && r.type !== selectedType) return false;
        if (selectedName && r.name !== selectedName) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            r.name.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q) ||
            r.amount.toString().includes(q) ||
            r.date.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => parseDate(b.date) - parseDate(a.date));
  }, [records, selectedDate, selectedType, selectedName, searchQuery]);

  // 3b. Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedType, selectedName, searchQuery]);

  // 3c. Calculate total pages
  const totalPages = Math.ceil(filteredRecords.length / 50);

  // 3d. Get paginated records
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * 50;
    return filteredRecords.slice(startIndex, startIndex + 50);
  }, [filteredRecords, currentPage]);

  // 3e. Prepare options lists for custom select dropdowns
  const dateOptions = useMemo(() => {
    return [
      { label: 'All', value: '' },
      ...uniqueDates.map(date => ({ label: date, value: date }))
    ];
  }, [uniqueDates]);

  const typeOptions = [
    { label: 'All', value: '' },
    { label: 'Receipt', value: 'Receipt' },
    { label: 'Expense', value: 'Expense' }
  ];

  const nameOptions = useMemo(() => {
    return [
      { label: 'All', value: '' },
      ...uniqueNames.map(name => ({ label: name, value: name }))
    ];
  }, [uniqueNames]);



  // 4. Calculate stats for the current view
  const stats = useMemo(() => {
    let receipts = 0;
    let expenses = 0;
    filteredRecords.forEach(r => {
      const amt = r.amount || 0;
      if (r.type === 'Receipt') {
        receipts += amt;
      } else if (r.type === 'Expense') {
        expenses += amt;
      }
    });
    return {
      receipts,
      expenses,
      balance: receipts - expenses,
    };
  }, [filteredRecords]);

  if (loading && records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-semibold">Loading history records...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return <NoData title="NO HISTORY FOUND" />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 no-print">
      {/* Date, Type, Name & Search Filters */}
      <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Liquidation Date Dropdown */}
          <CustomSelect
            label="Liquidation Date"
            value={selectedDate}
            onChange={(val) => {
              setSelectedDate(val);
              setSearchQuery('');
              setSelectedType('');
              setSelectedName('');
            }}
            options={dateOptions}
            icon={<Calendar className="w-5 h-5" />}
          />

          {/* Type Dropdown */}
          <CustomSelect
            label="Type"
            value={selectedType}
            onChange={setSelectedType}
            options={typeOptions}
            icon={<Filter className="w-5 h-5" />}
          />

          {/* Name Dropdown */}
          <CustomSelect
            label="Name"
            value={selectedName}
            onChange={setSelectedName}
            options={nameOptions}
            icon={<User className="w-5 h-5" />}
            searchable={true}
          />


          {/* Search Box */}
          <div className="w-full">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, description, amount, or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 focus:border-cyan-500 rounded-xl focus:outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Receipts */}
        <div className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-md p-5 border border-green-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Total Receipts</span>
            <h2 className="text-3xl font-bold text-gray-900 mt-1">{stats.receipts.toFixed(2)}</h2>
            <span className="text-xs text-gray-500 font-semibold">AED</span>
          </div>
          <div className="bg-green-500 text-white p-3.5 rounded-xl shadow-lg shadow-green-100">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-rose-50 to-white rounded-xl shadow-md p-5 border border-rose-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Total Expenses</span>
            <h2 className="text-3xl font-bold text-gray-900 mt-1">{stats.expenses.toFixed(2)}</h2>
            <span className="text-xs text-gray-500 font-semibold">AED</span>
          </div>
          <div className="bg-rose-500 text-white p-3.5 rounded-xl shadow-lg shadow-rose-100">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        {/* Balance */}
        <div className="bg-gradient-to-br from-cyan-900 to-slate-900 rounded-xl shadow-xl p-5 text-white flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-cyan-200 uppercase tracking-widest">Liquidation Balance</span>
            <h2 className="text-3xl font-bold mt-1">{stats.balance.toFixed(2)}</h2>
            <span className="text-xs text-cyan-200 font-semibold">AED</span>
          </div>
          <div className="bg-cyan-500 text-white p-3.5 rounded-xl shadow-lg shadow-cyan-500/20 animate-pulse">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Operations Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">
            {selectedDate ? `Liquidation Details for ${selectedDate}` : 'All Liquidation Details'}
          </h3>
          <span className="bg-cyan-100 text-cyan-700 text-xs px-3 py-1 rounded-full font-bold">
            {filteredRecords.length} Entries
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-8">
            <NoData title="NO MATCHING ENTRIES" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="text-center py-4 px-4 text-xs font-black text-gray-500 uppercase tracking-widest w-[140px]">Date</th>
                  <th className="text-center py-4 px-4 text-xs font-black text-gray-500 uppercase tracking-widest w-[120px]">Type</th>
                  <th className="text-center py-4 px-4 text-xs font-black text-gray-500 uppercase tracking-widest w-[160px]">Amount</th>
                  <th className="text-center py-4 px-4 text-xs font-black text-gray-500 uppercase tracking-widest w-[220px]">Name</th>
                  <th className="text-center py-4 px-4 text-xs font-black text-gray-500 uppercase tracking-widest">Description</th>
                  <th className="text-center py-4 px-4 text-xs font-black text-gray-500 uppercase tracking-widest w-[120px]">Paid?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRecords.map((record, index) => {
                  const isReceipt = record.type === 'Receipt';
                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-cyan-50/20 transition-all ${index % 2 === 0 ? 'bg-gray-50/30' : 'bg-white'}`}
                    >
                      <td className="py-3 px-4 text-center text-sm font-semibold text-gray-600">
                        {record.date}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${isReceipt
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                          {record.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-black text-gray-900">
                        {record.amount.toFixed(2)} AED
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-bold text-gray-700 uppercase">
                        {record.name}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-600 max-w-xs truncate" title={record.description}>
                        {record.description}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${record.paid?.toLowerCase() === 'yes'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                          }`}>
                          {record.paid || 'No'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm font-semibold text-gray-500">
                  Showing <span className="text-gray-900 font-bold">{(currentPage - 1) * 50 + 1}</span> to{' '}
                  <span className="text-gray-900 font-bold">
                    {Math.min(currentPage * 50, filteredRecords.length)}
                  </span>{' '}
                  of <span className="text-gray-900 font-bold">{filteredRecords.length}</span> entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3.5 py-2 border border-gray-200 rounded-lg hover:bg-cyan-50 disabled:opacity-50 disabled:hover:bg-transparent text-sm font-bold text-gray-600 transition-colors shadow-sm disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <div className="hidden md:flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm ${currentPage === page
                                ? 'bg-cyan-600 text-white'
                                : 'border border-gray-200 text-gray-600 hover:bg-cyan-50'
                              }`}
                          >
                            {page}
                          </button>
                        );
                      }
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <span key={page} className="px-1.5 text-gray-400 font-bold text-sm">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3.5 py-2 border border-gray-200 rounded-lg hover:bg-cyan-50 disabled:opacity-50 disabled:hover:bg-transparent text-sm font-bold text-gray-600 transition-colors shadow-sm disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
