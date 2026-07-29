'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Box, ArrowLeft, FileSpreadsheet, Search, Filter, ChevronDown, Check, X, RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { getProductPeriodMovements } from '../Service/inventory_service';
import type { PeriodMovement, ProductBalanceRow } from '../Service/inventory_types';
import NoData from '@/app/Components/NoDataTab';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import { getScopedQtyEffect, isMoveInLocationScope } from '../Utils/locationTypes';

interface Props {
  selectedProduct: ProductBalanceRow;
  dateFrom: string;
  dateTo: string;
  location?: string;
  onBack: () => void;
}

const MOVEMENT_TYPES = [
  { value: 'All',               label: 'All Movement Types' },
  { value: 'vendor_in',         label: 'Purchase (Vendor → WH)' },
  { value: 'vendor_return',     label: 'Return to Vendor' },
  { value: 'customer_sale',     label: 'Sale (WH → Customer)' },
  { value: 'customer_return',   label: 'Customer Return' },
  { value: 'production_in',     label: 'Production In' },
  { value: 'production_out',    label: 'Production Out' },
  { value: 'subcontracting_in', label: 'Subcontracting In' },
  { value: 'subcontracting_out',label: 'Subcontracting Out' },
  { value: 'adjustment_in',     label: 'Adjustment (+)' },
  { value: 'adjustment_out',    label: 'Adjustment (-)' },
  { value: 'transfer',          label: 'Internal Transfer' },
];

function getMovementStockChange(move: PeriodMovement, location?: string): number {
  return getScopedQtyEffect(move.locationFrom, move.locationTo, move.qty, location);
}

function sortMovementsAsc(movements: PeriodMovement[]) {
  return [...movements].sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    return (a.moveId || a.reference).localeCompare(b.moveId || b.reference);
  });
}

interface LedgerRow {
  move: PeriodMovement;
  stockChange: number;
  runningBalance: number;
}

export default function InventoryProductsBalanceDetailsTab({ selectedProduct, dateFrom, dateTo, location, onBack }: Props) {
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [periodMovements, setPeriodMovements] = useState<PeriodMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Custom Dropdown State
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMovements = async () => {
      try {
        setMovementsLoading(true);
        setMovementsError(null);
        const res = await getProductPeriodMovements(selectedProduct.productId, { dateFrom, dateTo });
        if (cancelled) return;
        if (!res.success) {
          throw new Error(res.error || 'Failed to fetch product movements');
        }
        setPeriodMovements(res.data || []);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Error fetching product period movements:', err);
        setMovementsError(err.message || 'Failed to load movement ledger');
        setPeriodMovements([]);
      } finally {
        if (!cancelled) {
          setMovementsLoading(false);
        }
      }
    };

    loadMovements();
    return () => {
      cancelled = true;
    };
  }, [selectedProduct.productId, dateFrom, dateTo]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTypes = useMemo(() => {
    if (!typeSearch.trim()) return MOVEMENT_TYPES;
    return MOVEMENT_TYPES.filter(t => t.label.toLowerCase().includes(typeSearch.toLowerCase().trim()));
  }, [typeSearch]);

  const selectedTypeLabel = useMemo(() => {
    return MOVEMENT_TYPES.find(t => t.value === typeFilter)?.label || 'All Movement Types';
  }, [typeFilter]);

  const scopedMovements = useMemo(() => {
    if (!location) return periodMovements;
    return periodMovements.filter((move) =>
      isMoveInLocationScope(move.locationFrom, move.locationTo, location),
    );
  }, [periodMovements, location]);

  // Build chronological ledger with running balance attached to each row
  const ledgerRows = useMemo((): LedgerRow[] => {
    let balance = selectedProduct.openingStock;

    return sortMovementsAsc(scopedMovements).map(move => {
      const stockChange = getMovementStockChange(move, location);
      balance += stockChange;
      return { move, stockChange, runningBalance: balance };
    });
  }, [scopedMovements, selectedProduct.openingStock, location]);

  const filteredLedgerRows = useMemo(() => {
    return ledgerRows
      .filter(({ move }) => {
        if (typeFilter !== 'All' && move.type !== typeFilter) return false;

        if (ledgerSearch.trim()) {
          const q = ledgerSearch.toLowerCase().trim();
          const matchesRef = move.reference.toLowerCase().includes(q);
          const matchesFrom = move.locationFrom.toLowerCase().includes(q);
          const matchesTo = move.locationTo.toLowerCase().includes(q);
          if (!matchesRef && !matchesFrom && !matchesTo) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.move.date ? new Date(a.move.date).getTime() : 0;
        const timeB = b.move.date ? new Date(b.move.date).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return (b.move.moveId || b.move.reference).localeCompare(a.move.moveId || a.move.reference);
      });
  }, [ledgerRows, ledgerSearch, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [ledgerSearch, typeFilter, selectedProduct.productId, dateFrom, dateTo]);

  const tableTotals = useMemo(() => {
    const totalQty = filteredLedgerRows.reduce((sum, row) => sum + row.move.qty, 0);
    const chronRows = sortMovementsAsc(filteredLedgerRows.map(row => row.move))
      .map(move => filteredLedgerRows.find(row => row.move === move)!)
      .filter(Boolean);
    const endingBalance = chronRows.length > 0
      ? chronRows[chronRows.length - 1].runningBalance
      : selectedProduct.openingStock;

    return { totalQty, endingBalance };
  }, [filteredLedgerRows, selectedProduct.openingStock]);

  const totalPages = Math.ceil(filteredLedgerRows.length / itemsPerPage);
  const paginatedLedgerRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLedgerRows.slice(start, start + itemsPerPage);
  }, [filteredLedgerRows, currentPage]);

  // Export ledger to Excel
  const handleExportLedgerExcel = async () => {
    const headers = [
      '#',
      'Date',
      'Reference',
      'Location From',
      'Location To',
      'Movement Type',
      'Quantity',
      'Running Balance',
    ];

    const filteredSet = new Set(filteredLedgerRows.map(row => row.move));
    const exportRows = ledgerRows.filter(row => filteredSet.has(row.move));

    const rows = exportRows.map((row, index) => [
      index + 1,
      row.move.date ? new Date(row.move.date).toLocaleDateString('en-US') : '-',
      row.move.reference,
      row.move.locationFrom,
      row.move.locationTo,
      row.move.type,
      row.move.qty,
      row.runningBalance,
    ]);

    const filename = `movement_ledger_${selectedProduct.productId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Movement Ledger',
      numericColumns: ['Quantity', 'Running Balance'],
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-xs flex items-center gap-2 text-xs font-bold"
              title="Back to Products List"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Box className="w-5 h-5 text-indigo-600" />
                Product Ledger Details: {selectedProduct.productName}
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Code: {selectedProduct.productId} | Barcode: {selectedProduct.barcode || '-'} | Category: {selectedProduct.category}
              </p>
            </div>
          </div>

          <button
            onClick={handleExportLedgerExcel}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm group shrink-0"
            title="Export Movement Ledger to Excel"
          >
            <FileSpreadsheet className="w-5 h-5 transition-transform group-hover:scale-110" />
          </button>
        </div>

        {/* Toolbar Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          {/* Search Input */}
          <div className="relative flex items-center h-11 bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
            <input
              type="text"
              placeholder="Search reference, location from/to..."
              value={ledgerSearch}
              onChange={e => setLedgerSearch(e.target.value)}
              className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
            />
            {ledgerSearch && (
              <button onClick={() => setLedgerSearch('')} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Custom Searchable Movement Type Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsTypeOpen(!isTypeOpen)}
              className={`w-full flex items-center justify-between h-11 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs cursor-pointer ${
                isTypeOpen ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  Type: <strong className="text-indigo-900 font-bold">{selectedTypeLabel}</strong>
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isTypeOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>

            {isTypeOpen && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search Bar inside Popover */}
                <div className="relative flex items-center h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    placeholder="Search type..."
                    value={typeSearch}
                    onChange={e => setTypeSearch(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                    autoFocus
                  />
                  {typeSearch && (
                    <button onClick={() => setTypeSearch('')} className="p-0.5 text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Options List */}
                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 text-xs">
                  {filteredTypes.map(t => {
                    const isSelected = typeFilter === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          setTypeFilter(t.value);
                          setIsTypeOpen(false);
                          setTypeSearch('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="truncate">{t.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Opening Stock</p>
          <p className="text-lg font-black text-slate-800 mt-1">{selectedProduct.openingStock.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Net Purchases</p>
          <p className="text-lg font-black text-emerald-600 mt-1">
            {selectedProduct.netVendors >= 0 ? `+${selectedProduct.netVendors.toLocaleString('en-US')}` : selectedProduct.netVendors.toLocaleString('en-US')}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Net Sales</p>
          <p className="text-lg font-black text-rose-600 mt-1">{selectedProduct.netCustomers.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Net Production & Sub.</p>
          <p className="text-lg font-black text-indigo-600 mt-1">{selectedProduct.netProduction.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs bg-amber-50/20">
          <p className="text-[10px] font-bold text-amber-600 uppercase">Net Adjustment</p>
          <p className={`text-lg font-black mt-1 ${
            selectedProduct.netAdjustment > 0
              ? 'text-emerald-600'
              : selectedProduct.netAdjustment < 0
                ? 'text-rose-600'
                : 'text-slate-500'
          }`}>
            {selectedProduct.netAdjustment >= 0
              ? `+${selectedProduct.netAdjustment.toLocaleString('en-US')}`
              : selectedProduct.netAdjustment.toLocaleString('en-US')}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs bg-indigo-50/20">
          <p className="text-[10px] font-bold text-indigo-500 uppercase">Ending Stock</p>
          <p className="text-lg font-black text-indigo-900 mt-1">{selectedProduct.endingStock.toLocaleString('en-US')}</p>
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden transition-opacity duration-300 ${movementsLoading ? 'opacity-60' : ''}`}>
        {movementsError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-rose-600">{movementsError}</p>
            <button
              type="button"
              onClick={() => {
                setMovementsLoading(true);
                setMovementsError(null);
                getProductPeriodMovements(selectedProduct.productId, { dateFrom, dateTo })
                  .then(res => {
                    if (!res.success) throw new Error(res.error || 'Failed to fetch product movements');
                    setPeriodMovements(res.data || []);
                  })
                  .catch(err => setMovementsError(err.message || 'Failed to load movement ledger'))
                  .finally(() => setMovementsLoading(false));
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
            >
              <RefreshCcw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs font-semibold min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-3 text-center w-12">#</th>
                  <th className="py-3.5 px-3 text-center w-36">Date</th>
                  <th className="py-3.5 px-3 text-center w-44">Reference</th>
                  <th className="py-3.5 px-3 text-center w-56">Location From</th>
                  <th className="py-3.5 px-3 text-center w-56">Location To</th>
                  <th className="py-3.5 px-3 text-center w-44">Movement Type</th>
                  <th className="py-3.5 px-3 text-center w-32">Quantity</th>
                  <th className="py-3.5 px-3 text-center w-32 bg-indigo-50/50 text-indigo-900">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {movementsLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="py-3.5 px-3"><div className="h-3 w-4 bg-slate-100 rounded mx-auto" /></td>
                      <td className="py-3.5 px-3"><div className="h-3 w-20 bg-slate-100 rounded mx-auto" /></td>
                      <td className="py-3.5 px-3"><div className="h-3 w-24 bg-slate-100 rounded mx-auto" /></td>
                      <td className="py-3.5 px-3"><div className="h-3 w-32 bg-slate-100 rounded mx-auto" /></td>
                      <td className="py-3.5 px-3"><div className="h-3 w-32 bg-slate-100 rounded mx-auto" /></td>
                      <td className="py-3.5 px-3"><div className="h-6 w-24 bg-slate-100 rounded-lg mx-auto" /></td>
                      <td className="py-3.5 px-3"><div className="h-3 w-12 bg-slate-100 rounded mx-auto" /></td>
                      <td className="py-3.5 px-3"><div className="h-3 w-12 bg-slate-100 rounded mx-auto" /></td>
                    </tr>
                  ))
                ) : filteredLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <NoData />
                    </td>
                  </tr>
                ) : (
                  paginatedLedgerRows.map((row, idx) => {
                  const move = row.move;
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                  const dateStr = move.date ? new Date(move.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) : '-';

                  let typeBadge = <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-500 font-medium">Other</span>;
                  if      (move.type === 'vendor_in')          typeBadge = <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold">Purchase</span>;
                  else if (move.type === 'vendor_return')      typeBadge = <span className="px-2.5 py-1 bg-orange-100 text-orange-800 rounded-lg font-bold">Vendor Return</span>;
                  else if (move.type === 'customer_sale')      typeBadge = <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-bold">Sale</span>;
                  else if (move.type === 'customer_return')    typeBadge = <span className="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-lg font-bold">Customer Return</span>;
                  else if (move.type === 'production_in')      typeBadge = <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg font-bold">Production In</span>;
                  else if (move.type === 'production_out')     typeBadge = <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg font-bold">Production Out</span>;
                  else if (move.type === 'subcontracting_in')  typeBadge = <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold">Subcontracting In</span>;
                  else if (move.type === 'subcontracting_out') typeBadge = <span className="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-lg font-bold">Subcontracting Out</span>;
                  else if (move.type === 'adjustment_in')      typeBadge = <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold">Adjustment (+)</span>;
                  else if (move.type === 'adjustment_out')     typeBadge = <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-lg font-bold">Adjustment (−)</span>;
                  else if (move.type === 'transfer')           typeBadge = <span className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg font-bold">Internal Transfer</span>;

                  const { runningBalance } = row;

                  return (
                    <tr key={`${move.moveId || move.reference}-${globalIdx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3 text-center text-slate-400 font-bold">{globalIdx}</td>
                      <td className="py-3.5 px-3 text-center font-medium text-slate-500">{dateStr}</td>
                      <td className="py-3.5 px-3 text-center font-mono text-slate-600 text-[11px]">{move.reference}</td>
                      <td className="py-3.5 px-3 text-center truncate max-w-[220px]" title={move.locationFrom}>{move.locationFrom}</td>
                      <td className="py-3.5 px-3 text-center truncate max-w-[220px]" title={move.locationTo}>{move.locationTo}</td>
                      <td className="py-3.5 px-3 text-center">{typeBadge}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-800 text-sm">{move.qty.toLocaleString('en-US')}</td>
                      <td className="py-3.5 px-3 text-center bg-indigo-50/20">
                        <span className={`font-black text-sm ${
                          runningBalance < 0 ? 'text-rose-700' : runningBalance > 0 ? 'text-indigo-900' : 'text-slate-500'
                        }`}>
                          {runningBalance.toLocaleString('en-US')}
                        </span>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
              {!movementsLoading && filteredLedgerRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-black uppercase">
                    <td colSpan={6} className="py-3.5 px-3" />
                    <td className="py-3.5 px-3 text-center text-slate-800 text-sm">
                      {tableTotals.totalQty.toLocaleString('en-US')}
                    </td>
                    <td className="py-3.5 px-3 text-center bg-indigo-50/40">
                      <span className={`text-sm ${
                        tableTotals.endingBalance < 0 ? 'text-rose-700' : tableTotals.endingBalance > 0 ? 'text-indigo-900' : 'text-slate-500'
                      }`}>
                        {tableTotals.endingBalance.toLocaleString('en-US')}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {!movementsError && !movementsLoading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
            <div>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLedgerRows.length)} of {filteredLedgerRows.length} movements
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
