'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CalendarCheck,
  ChevronDown,
  Check,
  FileSpreadsheet,
  Layers,
  MapPin,
  RefreshCcw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import TabLoader from '@/app/Components/TabLoader';
import NoData from '@/app/Components/NoDataTab';
import { getLocationPeriodMovements } from '../Service/inventory_service';
import type { LocationMovementRow } from '../Service/inventory_types';
import { INTERNAL_WAREHOUSES_SORTED } from './locationTypes';
import { exportSalesExcelWorkbook, recordsFromTable } from '@/app/Sales/Utils/ExcelExport';

type DirectionFilter = 'All' | 'in' | 'out';

const MOVEMENT_TYPES = [
  { value: 'All', label: 'All Movement Types' },
  { value: 'vendor_in', label: 'Purchase (Vendor → WH)' },
  { value: 'vendor_return', label: 'Return to Vendor' },
  { value: 'customer_sale', label: 'Sale (WH → Customer)' },
  { value: 'customer_return', label: 'Customer Return' },
  { value: 'production_in', label: 'Production In' },
  { value: 'production_out', label: 'Production Out' },
  { value: 'subcontracting_in', label: 'Subcontracting In' },
  { value: 'subcontracting_out', label: 'Subcontracting Out' },
  { value: 'adjustment_in', label: 'Adjustment (+)' },
  { value: 'adjustment_out', label: 'Adjustment (-)' },
  { value: 'transfer', label: 'Internal Transfer' },
];

function formatLocationLabel(loc: string): string {
  const slashIndex = loc.lastIndexOf('/');
  return slashIndex === -1 ? loc : loc.slice(slashIndex + 1).trim();
}

function getMovementTypeLabel(type: string): string {
  return MOVEMENT_TYPES.find((item) => item.value === type)?.label || type || 'Other';
}

function formatDate(value: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB');
}

const FILTER_DROPDOWN_WIDTH = 'relative w-full sm:w-56';

export default function InventoryLocationMovementsTab() {
  const [data, setData] = useState<LocationMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<string>(
    INTERNAL_WAREHOUSES_SORTED[0] || '',
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('All');
  const [typeFilter, setTypeFilter] = useState('All');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const fetchRequestId = useRef(0);

  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const locationRef = useRef<HTMLDivElement>(null);

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const typeRef = useRef<HTMLDivElement>(null);

  const [isDirectionOpen, setIsDirectionOpen] = useState(false);
  const directionRef = useRef<HTMLDivElement>(null);

  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const categoryRef = useRef<HTMLDivElement>(null);

  const locations = useMemo(() => INTERNAL_WAREHOUSES_SORTED, []);

  const filteredLocations = useMemo(() => {
    if (!locationSearch.trim()) return locations;
    const q = locationSearch.toLowerCase().trim();
    return locations.filter((loc) => loc.toLowerCase().includes(q) || formatLocationLabel(loc).toLowerCase().includes(q));
  }, [locations, locationSearch]);

  const filteredTypes = useMemo(() => {
    if (!typeSearch.trim()) return MOVEMENT_TYPES;
    return MOVEMENT_TYPES.filter((item) => item.label.toLowerCase().includes(typeSearch.toLowerCase().trim()));
  }, [typeSearch]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      if (row.category) set.add(row.category);
    });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))];
  }, [data]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase().trim();
    return categories.filter((cat) => cat.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const fetchReport = async (
    location = selectedLocation,
    from = appliedDateFrom,
    to = appliedDateTo,
  ) => {
    if (!location) return;

    const requestId = ++fetchRequestId.current;
    try {
      setLoading(true);
      const res = await getLocationPeriodMovements({
        location,
        dateFrom: from || undefined,
        dateTo: to || undefined,
      });
      if (requestId !== fetchRequestId.current) return;
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch location movements');
      }
      setData(res.data || []);
      setError(null);
    } catch (err: any) {
      if (requestId !== fetchRequestId.current) return;
      console.error('Error fetching location movements:', err);
      setError(err.message || 'Failed to load location movements');
      setData([]);
    } finally {
      if (requestId === fetchRequestId.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchReport(selectedLocation, appliedDateFrom, appliedDateTo);
  }, [selectedLocation, appliedDateFrom, appliedDateTo]);

  useEffect(() => {
    setSelectedCategory('All');
    setCurrentPage(1);
  }, [selectedLocation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(event.target as Node)) {
        setIsLocationOpen(false);
      }
      if (typeRef.current && !typeRef.current.contains(event.target as Node)) {
        setIsTypeOpen(false);
      }
      if (directionRef.current && !directionRef.current.contains(event.target as Node)) {
        setIsDirectionOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyDateFilter = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setCurrentPage(1);
  };

  const handleClearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
    setCurrentPage(1);
  };

  const hasPendingDateChanges = dateFrom !== appliedDateFrom || dateTo !== appliedDateTo;

  const filteredRows = useMemo(() => {
    return data.filter((row) => {
      if (selectedCategory !== 'All' && row.category !== selectedCategory) return false;
      if (directionFilter !== 'All' && row.direction !== directionFilter) return false;
      if (typeFilter !== 'All' && row.type !== typeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const haystack = [
          row.reference,
          row.productName,
          row.productId,
          row.barcode,
          row.category,
          row.locationFrom,
          row.locationTo,
          getMovementTypeLabel(row.type),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [data, selectedCategory, directionFilter, typeFilter, searchQuery]);

  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    filteredRows.forEach((row) => {
      if (row.stockChange > 0) totalIn += row.stockChange;
      if (row.stockChange < 0) totalOut += Math.abs(row.stockChange);
    });
    return {
      moveCount: filteredRows.length,
      totalIn,
      totalOut,
      net: totalIn - totalOut,
    };
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage]);

  const handleExport = async () => {
    const movementHeaders = [
      'Date',
      'Reference',
      'Direction',
      'Product',
      'Barcode',
      'Category',
      'From',
      'To',
      'Qty',
      'Type',
      'Stock Change',
    ];

    const movementRows = filteredRows.map((row) => [
      formatDate(row.date),
      row.reference,
      row.direction === 'in' ? 'In' : 'Out',
      row.productName,
      row.barcode,
      row.category,
      row.locationFrom,
      row.locationTo,
      row.qty,
      getMovementTypeLabel(row.type),
      row.stockChange,
    ]);

    const productMap = new Map<string, {
      productId: string;
      productName: string;
      barcode: string;
      category: string;
      totalIn: number;
      totalOut: number;
      netBalance: number;
    }>();

    filteredRows.forEach((row) => {
      const existing = productMap.get(row.productId);
      if (!existing) {
        productMap.set(row.productId, {
          productId: row.productId,
          productName: row.productName,
          barcode: row.barcode,
          category: row.category,
          totalIn: 0,
          totalOut: 0,
          netBalance: 0,
        });
      }

      const entry = productMap.get(row.productId)!;
      if (row.stockChange > 0) entry.totalIn += row.stockChange;
      if (row.stockChange < 0) entry.totalOut += Math.abs(row.stockChange);
      entry.netBalance += row.stockChange;
    });

    const productSummary = Array.from(productMap.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }),
    );

    const productHeaders = [
      '#',
      'Product Code',
      'Barcode',
      'Product Name',
      'Category',
      'Total In',
      'Total Out',
      'Net Balance',
    ];

    const productRows = productSummary.map((item, index) => [
      index + 1,
      item.productId,
      item.barcode,
      item.productName,
      item.category,
      item.totalIn,
      item.totalOut,
      item.netBalance,
    ]);

    if (productSummary.length > 0) {
      const totals = productSummary.reduce(
        (acc, item) => ({
          totalIn: acc.totalIn + item.totalIn,
          totalOut: acc.totalOut + item.totalOut,
          netBalance: acc.netBalance + item.netBalance,
        }),
        { totalIn: 0, totalOut: 0, netBalance: 0 },
      );

      productRows.push([
        '',
        '',
        '',
        'TOTALS',
        '',
        totals.totalIn,
        totals.totalOut,
        totals.netBalance,
      ]);
    }

    const filename = `Location_Movements_${formatLocationLabel(selectedLocation).replace(/[^\w\s-]/g, '')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    await exportSalesExcelWorkbook(
      [
        {
          name: 'Movements',
          data: recordsFromTable(movementHeaders, movementRows),
          options: { numericColumns: ['Qty', 'Stock Change'] },
        },
        {
          name: 'Products Balance',
          data: recordsFromTable(productHeaders, productRows),
          options: {
            numericColumns: ['Total In', 'Total Out', 'Net Balance'],
            highlightNegativeInColumns: ['Net Balance'],
          },
        },
      ],
      filename,
    );
  };

  const renderStockChange = (value: number) => {
    if (value === 0) return <span className="text-slate-400 font-medium">0</span>;
    const formatted = value.toLocaleString('en-US');
    return (
      <span className={`inline-flex font-bold text-sm ${value > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
        {value > 0 ? `+${formatted}` : formatted}
      </span>
    );
  };

  if (loading && data.length === 0) return <TabLoader />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
            Location Movements In / Out
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <div className="relative flex items-center h-11 w-full sm:w-64 bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
            <input
              type="text"
              placeholder="Search product, ref, barcode..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className={`${FILTER_DROPDOWN_WIDTH}`} ref={locationRef}>
            <button
              type="button"
              onClick={() => setIsLocationOpen(!isLocationOpen)}
              className={`w-full flex items-center justify-between h-11 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs cursor-pointer ${
                isLocationOpen ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  Location: <strong className="text-indigo-900 font-bold">{formatLocationLabel(selectedLocation)}</strong>
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isLocationOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>

            {isLocationOpen && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative flex items-center h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    placeholder="Search location..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 text-xs">
                  {filteredLocations.map((loc) => {
                    const isSelected = selectedLocation === loc;
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setSelectedLocation(loc);
                          setCurrentPage(1);
                          setIsLocationOpen(false);
                          setLocationSearch('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="truncate" title={loc}>{formatLocationLabel(loc)}</span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className={`${FILTER_DROPDOWN_WIDTH}`} ref={categoryRef}>
            <button
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className={`w-full flex items-center justify-between h-11 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs cursor-pointer ${
                isCategoryOpen ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  Category: <strong className="text-indigo-900 font-bold">{selectedCategory}</strong>
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isCategoryOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>

            {isCategoryOpen && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative flex items-center h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    placeholder="Search category..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                    autoFocus
                  />
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch('')}
                      className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 text-xs">
                  {filteredCategories.length === 0 ? (
                    <div className="p-3 text-center text-xs font-semibold text-slate-400">
                      No category found
                    </div>
                  ) : (
                    filteredCategories.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setCurrentPage(1);
                            setIsCategoryOpen(false);
                            setCategorySearch('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className="truncate">{cat}</span>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={`${FILTER_DROPDOWN_WIDTH}`} ref={directionRef}>
            <button
              type="button"
              onClick={() => setIsDirectionOpen(!isDirectionOpen)}
              className={`w-full flex items-center justify-between h-11 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs ${
                isDirectionOpen ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  Direction: <strong className="text-indigo-900 font-bold">{directionFilter === 'All' ? 'All' : directionFilter === 'in' ? 'In' : 'Out'}</strong>
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isDirectionOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>
            {isDirectionOpen && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 space-y-0.5">
                {(['All', 'in', 'out'] as DirectionFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setDirectionFilter(value);
                      setCurrentPage(1);
                      setIsDirectionOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold ${
                      directionFilter === value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {value === 'All' ? 'All Directions' : value === 'in' ? 'In Only' : 'Out Only'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`${FILTER_DROPDOWN_WIDTH}`} ref={typeRef}>
            <button
              type="button"
              onClick={() => setIsTypeOpen(!isTypeOpen)}
              className={`w-full flex items-center justify-between h-11 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs ${
                isTypeOpen ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  Type: <strong className="text-indigo-900 font-bold">{typeFilter === 'All' ? 'All' : getMovementTypeLabel(typeFilter)}</strong>
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isTypeOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>
            {isTypeOpen && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 space-y-2">
                <div className="relative flex items-center h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    placeholder="Search type..."
                    value={typeSearch}
                    onChange={(e) => setTypeSearch(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {filteredTypes.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setTypeFilter(item.value);
                        setCurrentPage(1);
                        setIsTypeOpen(false);
                        setTypeSearch('');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold ${
                        typeFilter === item.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex items-center h-11 w-full sm:w-56 bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1.5 uppercase">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            />
          </div>

          <div className="relative flex items-center h-11 w-full sm:w-56 bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1.5 uppercase">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleApplyDateFilter}
              disabled={loading || !hasPendingDateChanges}
              className="h-11 w-11 flex items-center justify-center rounded-xl transition-all shadow-sm border disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
              title="Apply Dates"
            >
              <CalendarCheck className="w-4 h-4" />
            </button>
            {(appliedDateFrom || appliedDateTo) && (
              <button
                type="button"
                onClick={handleClearDateFilter}
                className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
                title="Clear Dates"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={filteredRows.length === 0}
              className="h-11 w-11 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm group shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
            </button>
            <button
              type="button"
              onClick={() => fetchReport()}
              disabled={loading}
              className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Movements</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{summary.moveCount.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5" /> Total In
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">+{summary.totalIn.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-rose-100 p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> Total Out
          </p>
          <p className="text-2xl font-black text-rose-600 mt-1">-{summary.totalOut.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-indigo-100 p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Net Change</p>
          <p className={`text-2xl font-black mt-1 ${summary.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {summary.net >= 0 ? `+${summary.net.toLocaleString('en-US')}` : summary.net.toLocaleString('en-US')}
          </p>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-sm font-semibold">
          {error}
        </div>
      ) : filteredRows.length === 0 ? (
        <NoData message="No location movements found for the selected filters." />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  {['Date', 'Reference', 'Direction', 'Product', 'From', 'To', 'Qty', 'Type', 'Stock Change'].map((header) => (
                    <th key={header} className="py-3.5 px-3 text-center">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {paginatedRows.map((row) => (
                  <tr key={`${row.moveId}-${row.productId}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="py-3.5 px-3 text-center max-w-[180px] truncate" title={row.reference}>{row.reference}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        row.direction === 'in'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {row.direction === 'in' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {row.direction}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center min-w-[200px]">
                      <div className="text-xs font-bold text-slate-800">{row.productName}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{row.barcode || row.productId}</div>
                    </td>
                    <td className="py-3.5 px-3 text-center max-w-[160px] truncate" title={row.locationFrom}>
                      {formatLocationLabel(row.locationFrom)}
                    </td>
                    <td className="py-3.5 px-3 text-center max-w-[160px] truncate" title={row.locationTo}>
                      {formatLocationLabel(row.locationTo)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-800">{row.qty.toLocaleString('en-US')}</td>
                    <td className="py-3.5 px-3 text-center max-w-[180px] truncate" title={getMovementTypeLabel(row.type)}>
                      {getMovementTypeLabel(row.type)}
                    </td>
                    <td className="py-3.5 px-3 text-center">{renderStockChange(row.stockChange)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-500">
              Showing {paginatedRows.length} of {filteredRows.length.toLocaleString('en-US')} movements
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
