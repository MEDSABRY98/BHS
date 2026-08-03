'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, RefreshCw, ChevronDown, FileSpreadsheet, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { writeTrackedXlsxFile } from '@/app/Audit/Utils/TrackedDownload';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import {
  fetchICUserComparisonData,
  fetchArchivedICUserComparisonData,
  ICUserComparisonRow,
} from './Service/InventoryCountingService';
import { useInventoryCountingArchive } from './InventoryCountingArchiveContext';
import { ICRecord } from './Utils/EditItemModal';
import { useInventoryCountingFilters, matchesICWarehouse } from './InventoryCountingFiltersContext';

type ComparisonRow = ICUserComparisonRow & { userQtys: Record<string, number> };
type SortKey = 'barcodeName' | 'productName' | 'availableQty' | 'grandTotal' | 'difference' | `user:${string}`;

function getRowDifference(item: ComparisonRow) {
  return item.grandTotal - item.availableQty;
}

function getSortValue(item: ComparisonRow, key: SortKey): number | string {
  if (key.startsWith('user:')) {
    return item.userQtys[key.slice(5)] || 0;
  }
  if (key === 'difference') return getRowDifference(item);
  if (key === 'barcodeName') return item.barcodeName;
  if (key === 'productName') return item.productName;
  if (key === 'availableQty') return item.availableQty;
  return item.grandTotal;
}

function formatQty(qty: number) {
  return qty > 0 ? qty.toLocaleString() : '-';
}

function getUserMismatchInfo(values: number[]) {
  const active = values.filter((v) => v > 0);
  if (active.length <= 1) {
    return { hasMismatch: false, reference: active[0] ?? 0 };
  }
  const counts = new Map<number, number>();
  active.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let reference = active[0];
  let maxCount = 0;
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      reference = value;
    }
  });
  const distinct = counts.size;
  return { hasMismatch: distinct > 1, reference };
}

function userCellClass(qty: number, hasMismatch: boolean, reference: number) {
  if (!hasMismatch || qty <= 0) return 'bg-slate-50 text-slate-400 border-slate-100';
  if (qty !== reference) return 'bg-amber-100 text-amber-900 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
}

function diffClass(diff: number, hasCount: boolean) {
  if (!hasCount) return 'text-slate-300';
  if (diff === 0) return 'text-emerald-600';
  if (diff < 0) return 'text-red-600';
  return 'text-blue-600';
}

export default function UserComparisonTab() {
  const { archiveId, sessionVersion } = useInventoryCountingArchive();
  const { selectedUsers, selectedWarehouses } = useInventoryCountingFilters();
  const [baseData, setBaseData] = useState<ICUserComparisonRow[]>([]);
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [normalRecords, setNormalRecords] = useState<ICRecord[]>([]);
  const [damageRecords, setDamageRecords] = useState<ICRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Counted' | 'Pending'>('All');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const fetchData = async (isSilent = false) => {
    if (isSilent) setIsRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const result = archiveId
        ? await fetchArchivedICUserComparisonData(archiveId)
        : await fetchICUserComparisonData();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load data');
      }
      setBaseData(result.data);
      setAllUsers(result.users || []);
      setNormalRecords(result.normalRecords || []);
      setDamageRecords(result.damageRecords || []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load data';
      console.error('Failed to load user comparison data', e);
      setError(message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [archiveId, sessionVersion]);

  const statusOptions = [
    { value: 'All', label: 'All Items' },
    { value: 'Counted', label: 'Counted' },
    { value: 'Pending', label: 'Pending' },
  ] as const;
  const currentStatus = statusOptions.find((opt) => opt.value === statusFilter);

  const visibleUsers = useMemo(() => {
    if (selectedUsers.length > 0) {
      return [...selectedUsers].sort((a, b) => a.localeCompare(b));
    }
    return allUsers;
  }, [selectedUsers, allUsers]);

  const comparisonRows = useMemo((): ComparisonRow[] => {
    const warehouseFiltered = [...normalRecords, ...damageRecords].filter((record) =>
      matchesICWarehouse(record.warehouse, selectedWarehouses)
    );

    return baseData.map((item) => {
      const userQtys: Record<string, number> = {};
      visibleUsers.forEach((user) => {
        userQtys[user] = 0;
      });

      warehouseFiltered
        .filter((record) => record.productId === item.productId && visibleUsers.includes(record.user))
        .forEach((record) => {
          userQtys[record.user] = (userQtys[record.user] || 0) + record.countedQty;
        });

      return { ...item, userQtys };
    });
  }, [baseData, normalRecords, damageRecords, selectedWarehouses, visibleUsers]);

  const totalItems = comparisonRows.length;
  const countedItems = comparisonRows.filter((item) => item.grandTotal > 0).length;
  const pendingItems = comparisonRows.filter((item) => item.grandTotal === 0).length;
  const mismatchItems = comparisonRows.filter((item) => {
    const values = visibleUsers.map((user) => item.userQtys[user] || 0);
    return getUserMismatchInfo(values).hasMismatch;
  }).length;

  const filteredData = comparisonRows.filter((item) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.productName.toLowerCase().includes(query) ||
      item.productId.toLowerCase().includes(query) ||
      item.barcodeName.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Counted' ? item.grandTotal > 0 : item.grandTotal === 0);

    return matchesSearch && matchesStatus;
  });

  let sortedData = filteredData;
  if (sortConfig) {
    sortedData = [...filteredData].sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortableHeaderClass =
    'px-4 py-5 text-center text-xs font-black uppercase tracking-widest text-white cursor-pointer hover:bg-white/10 transition-colors';

  const renderSortableHeader = (key: SortKey, label: string, className = '') => (
    <th key={key} onClick={() => handleSort(key)} className={`${sortableHeaderClass} ${className}`}>
      <div className="flex items-center justify-center gap-2">
        <span className={key.startsWith('user:') ? 'truncate max-w-[120px]' : ''}>{label}</span>
        <ArrowUpDown className="w-3 h-3 text-white/50 shrink-0" />
      </div>
    </th>
  );

  const handleExport = () => {
    const exportData = sortedData.map((item, idx) => {
      const row: Record<string, string | number> = {
        '#': idx + 1,
        Barcode: item.barcodeName,
        'Product Name': item.productName,
        'Available Qty': item.availableQty,
        'Grand Total': item.grandTotal,
        Diff: getRowDifference(item),
      };
      visibleUsers.forEach((user) => {
        row[user] = item.userQtys[user] || 0;
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Comparison');
    writeTrackedXlsxFile(workbook, `User_Comparison_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <TabLoader />;

  if (error) {
    return (
      <TabFetchError
        message={error}
        onRetry={() => fetchData()}
        className="min-h-[360px]"
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 p-4 flex flex-wrap items-center gap-4">
        <div className="flex gap-2 flex-wrap">
          <div className="px-3 py-2 bg-violet-50 text-violet-700 rounded-xl border border-violet-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
            <span className="text-slate-400">Total:</span> {totalItems}
          </div>
          <div className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
            <span className="text-slate-400">Counted:</span> {countedItems}
          </div>
          <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
            <span className="text-slate-400">Pending:</span> {pendingItems}
          </div>
          <div className="px-3 py-2 bg-orange-50 text-orange-700 rounded-xl border border-orange-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
            <span className="text-slate-400">Mismatches:</span> {mismatchItems}
          </div>
        </div>

        <div className="relative flex-1 min-w-[200px] group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-violet-500 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Product Name or Barcode..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-transparent rounded-xl text-sm font-bold text-slate-700 placeholder:text-gray-300 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all outline-none"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setIsStatusOpen(!isStatusOpen)}
            className="w-[140px] bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-black rounded-xl px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-all outline-none shadow-sm"
          >
            <span>{currentStatus?.label}</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isStatusOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isStatusOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsStatusOpen(false)} />
              <div className="absolute right-0 mt-3 min-w-[140px] bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 py-2 z-20 overflow-hidden">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setStatusFilter(opt.value);
                      setIsStatusOpen(false);
                    }}
                    className={`w-full text-left px-5 py-3 text-[11px] font-bold transition-all ${
                      statusFilter === opt.value ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="w-12 h-12 flex items-center justify-center bg-violet-600 text-white rounded-xl shadow-lg shadow-violet-200/50 hover:bg-violet-700 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            title="Refresh Data"
          >
            <RefreshCw className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200/50 hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-6 h-6" />
          </button>
        </div>
      </div>

      {sortedData.length === 0 ? (
        <NoData title="No Data Found" />
      ) : (
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-black text-white sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-5 text-center text-xs font-black uppercase tracking-widest text-white w-[50px]">
                    #
                  </th>
                  {renderSortableHeader('barcodeName', 'Barcode', 'min-w-[120px]')}
                  {renderSortableHeader('productName', 'Product Name', 'min-w-[200px]')}
                  {renderSortableHeader('availableQty', 'Available', 'min-w-[90px]')}
                  {renderSortableHeader('grandTotal', 'Grand Total', 'min-w-[100px]')}
                  {renderSortableHeader('difference', 'Diff', 'min-w-[90px]')}
                  {visibleUsers.map((user) => renderSortableHeader(`user:${user}`, user, 'min-w-[100px]'))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedData.map((item, idx) => {
                  const userValues = visibleUsers.map((user) => item.userQtys[user] || 0);
                  const { hasMismatch, reference } = getUserMismatchInfo(userValues);
                  const hasGrandTotal = item.grandTotal > 0;
                  const difference = getRowDifference(item);

                  return (
                    <tr key={item.productId} className="hover:bg-violet-50/40 transition-all group">
                      <td className="px-4 py-4 text-center text-sm font-bold text-slate-400 group-hover:text-violet-600">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-black text-slate-600 truncate">
                        {item.barcodeName || '-'}
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-black text-slate-800">
                        {item.productName}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-bold text-slate-600 tabular-nums">
                        {item.availableQty.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex px-3 py-1.5 rounded-xl text-sm font-black border shadow-sm tabular-nums ${
                            hasGrandTotal
                              ? 'bg-violet-50 text-violet-700 border-violet-100'
                              : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}
                        >
                          {formatQty(item.grandTotal)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-sm font-black tabular-nums ${diffClass(difference, hasGrandTotal)}`}>
                          {hasGrandTotal ? (
                            <>
                              {difference > 0 ? '+' : ''}
                              {difference.toLocaleString()}
                            </>
                          ) : (
                            '-'
                          )}
                        </span>
                      </td>
                      {visibleUsers.map((user) => {
                        const qty = item.userQtys[user] || 0;
                        return (
                          <td key={user} className="px-4 py-4 text-center">
                            <span
                              className={`inline-flex px-3 py-1.5 rounded-xl text-sm font-black border shadow-sm tabular-nums ${userCellClass(
                                qty,
                                hasMismatch,
                                reference
                              )}`}
                            >
                              {formatQty(qty)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50/50 px-8 py-5 border-t border-gray-100">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                <Package className="w-5 h-5 text-violet-500" />
              </div>
              <span className="text-sm font-bold">
                Showing <span className="text-slate-900">{sortedData.length}</span> items
                {visibleUsers.length > 0 && (
                  <>
                    {' '}
                    across <span className="text-slate-900">{visibleUsers.length}</span> users
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
