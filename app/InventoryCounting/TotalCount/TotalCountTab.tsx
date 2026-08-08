'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, Search, Package, RefreshCw, ChevronDown, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { writeTrackedXlsxFile } from '@/app/Audit/Utils/TrackedDownload';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import {
  fetchICTotalCountData,
  fetchICDetailRecords,
  fetchArchivedICTotalCountData,
  fetchArchivedICDetailRecords,
  updateICItem,
  ICTotalCountItem,
} from '../Service/InventoryCountingService';
import { ICItem, ICRecord } from '../Utils/EditItemModal';
import EditItemModal from '../Utils/EditItemModal';
import { useInventoryCountingArchive } from '../Archives/InventoryCountingArchiveContext';
import { useInventoryCountingFilters, matchesICUser, matchesICWarehouse, hasICScopeFilter } from '../Model/InventoryCountingFiltersContext';
import { peekICPrefetch } from '../Utils/ICPrefetchCache';

type SortKey = keyof ICTotalCountItem | '#';

export default function TotalCountTab() {
  const { archiveId, isReadOnly, sessionVersion } = useInventoryCountingArchive();
  const [data, setData] = useState<ICTotalCountItem[]>([]);
  const [normalRecords, setNormalRecords] = useState<ICRecord[]>([]);
  const [damageRecords, setDamageRecords] = useState<ICRecord[]>([]);
  const { selectedUsers, selectedWarehouses } = useInventoryCountingFilters();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Counted' | 'Pending'>('All');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [editingItem, setEditingItem] = useState<ICItem | null>(null);

  const toICItem = (item: ICTotalCountItem): ICItem => ({
    productId: item.productId,
    barcodeName: item.barcodeName,
    productName: item.productName,
    availableQty: item.availableQty,
    qtyInBox: item.qtyInBox,
    countedQty: item.totalCountedQty,
  });

  const fetchData = async (isSilent = false) => {
    if (isSilent) setIsRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      // Prefer session bootstrap cache on first paint (refresh always hits network).
      if (!isSilent) {
        const prefetched = peekICPrefetch(archiveId);
        if (prefetched) {
          setData(prefetched.totalCount.data);
          setNormalRecords([]);
          setDamageRecords([]);
          setLoading(false);
          return;
        }
      }

      const needScopeRecords = hasICScopeFilter(selectedUsers, selectedWarehouses);

      const totalsPromise = archiveId
        ? fetchArchivedICTotalCountData(archiveId)
        : fetchICTotalCountData();

      const detailsPromise = needScopeRecords
        ? archiveId
          ? fetchArchivedICDetailRecords(archiveId)
          : fetchICDetailRecords()
        : null;

      const [result, detailsResult] = await Promise.all([totalsPromise, detailsPromise]);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to load data');
      }

      if (detailsResult?.success) {
        setNormalRecords(detailsResult.normalRecords || []);
        setDamageRecords(detailsResult.damageRecords || []);
      } else if (!needScopeRecords) {
        setNormalRecords([]);
        setDamageRecords([]);
      } else if (detailsResult && !detailsResult.success) {
        throw new Error(detailsResult.error || 'Failed to load scope records');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load data';
      console.error('Failed to load total count data', e);
      setError(message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [archiveId, sessionVersion]);

  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  });

  useEffect(() => {
    const handleTriggerRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.activeTab === 'total_count') {
        fetchDataRef.current(true);
      }
    };
    window.addEventListener('inventory-counting-trigger-refresh', handleTriggerRefresh);
    return () => {
      window.removeEventListener('inventory-counting-trigger-refresh', handleTriggerRefresh);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('inventory-counting-refresh-state', {
        detail: { activeTab: 'total_count', isRefreshing }
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('inventory-counting-refresh-state', {
          detail: { activeTab: 'total_count', isRefreshing: false }
        })
      );
    };
  }, [isRefreshing]);

  useEffect(() => {
    if (!hasICScopeFilter(selectedUsers, selectedWarehouses)) return;
    if (normalRecords.length > 0 || damageRecords.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const detailsResult = archiveId
          ? await fetchArchivedICDetailRecords(archiveId)
          : await fetchICDetailRecords();
        if (cancelled) return;
        if (detailsResult.success) {
          setNormalRecords(detailsResult.normalRecords || []);
          setDamageRecords(detailsResult.damageRecords || []);
        }
      } catch (e) {
        console.error('Failed to load scope detail records', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedUsers, selectedWarehouses, archiveId, normalRecords.length, damageRecords.length]);

  const statusOptions = [
    { value: 'All', label: 'All Items' },
    { value: 'Counted', label: 'Counted' },
    { value: 'Pending', label: 'Pending' },
  ] as const;
  const currentStatus = statusOptions.find((opt) => opt.value === statusFilter);

  const scopedData = (() => {
    if (!hasICScopeFilter(selectedUsers, selectedWarehouses)) {
      return data;
    }

    const matchesScope = (record: ICRecord) => {
      const matchesUser = matchesICUser(record.user, selectedUsers);
      const matchesWarehouse = matchesICWarehouse(record.warehouse, selectedWarehouses);
      return matchesUser && matchesWarehouse;
    };

    const normalMap = new Map<string, number>();
    const damageMap = new Map<string, number>();

    normalRecords.filter(matchesScope).forEach((record) => {
      normalMap.set(record.productId, (normalMap.get(record.productId) || 0) + record.countedQty);
    });
    damageRecords.filter(matchesScope).forEach((record) => {
      damageMap.set(record.productId, (damageMap.get(record.productId) || 0) + record.countedQty);
    });

    return data.map((item) => {
      const normalQty = normalMap.get(item.productId) || 0;
      const damageQty = damageMap.get(item.productId) || 0;
      const totalCountedQty = normalQty + damageQty;
      return {
        ...item,
        normalQty,
        damageQty,
        totalCountedQty,
        difference: totalCountedQty - item.availableQty,
      };
    });
  })();

  const totalItems = scopedData.length;
  const countedItems = scopedData.filter((item) => item.totalCountedQty > 0).length;
  const pendingItems = scopedData.filter((item) => item.totalCountedQty === 0).length;

  let filteredData = scopedData.filter((item) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.productName.toLowerCase().includes(query) ||
      item.productId.toLowerCase().includes(query) ||
      item.barcodeName.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Counted' ? item.totalCountedQty > 0 : item.totalCountedQty === 0);

    return matchesSearch && matchesStatus;
  });

  if (sortConfig && sortConfig.key !== '#') {
    filteredData = [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof ICTotalCountItem];
      const bVal = b[sortConfig.key as keyof ICTotalCountItem];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (key: SortKey) => {
    if (key === '#') return;
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    const exportData = filteredData.map((item, idx) => ({
      '#': idx + 1,
      Barcode: item.barcodeName,
      'Product Name': item.productName,
      'Available Qty': item.availableQty,
      'Total Counted': item.totalCountedQty,
      Difference: item.difference,
      Normal: item.normalQty,
      'Damage & Expire': item.damageQty,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Total Count');
    writeTrackedXlsxFile(workbook, `Total_Count_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSaveItem = async (updatedValues: Partial<ICItem>) => {
    if (!editingItem) return;

    const res = await updateICItem('IC Total', editingItem.productId, updatedValues as ICItem);

    if (!res.success) {
      throw new Error(res.error || res.details || 'Failed to update item');
    }

    setData((prev) =>
      prev.map((p) =>
        p.productId === editingItem.productId ? { ...p, ...updatedValues } : p
      )
    );
  };

  const diffClass = (diff: number, hasCount: boolean) => {
    if (!hasCount) return 'text-slate-300';
    if (diff === 0) return 'text-emerald-600';
    if (diff < 0) return 'text-red-600';
    return 'text-blue-600';
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
        <div className="flex gap-2">
          <div className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
            <span className="text-slate-400">Total:</span> {totalItems}
          </div>
          <div className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
            <span className="text-slate-400">Counted:</span> {countedItems}
          </div>
          <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
            <span className="text-slate-400">Pending:</span> {pendingItems}
          </div>
        </div>

        <div className="relative flex-1 min-w-[200px] group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Product Name or Barcode..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-transparent rounded-xl text-sm font-bold text-slate-700 placeholder:text-gray-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setIsStatusOpen(!isStatusOpen)}
            className="w-[140px] bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-black rounded-xl px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-all outline-none shadow-sm"
          >
            <span>{currentStatus?.label}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isStatusOpen ? 'rotate-180' : ''}`} />
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
                      statusFilter === opt.value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
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
            onClick={handleExport}
            className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200/50 hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-6 h-6" />
          </button>
        </div>
      </div>

      {scopedData.length === 0 ? (
        <NoData title="No Data Found" />
      ) : (
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full"
              style={{ tableLayout: 'fixed', minWidth: 890 }}
            >
              <colgroup>
                <col style={{ width: 50 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead className="bg-black text-white sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-5 text-center text-xs font-black uppercase tracking-widest text-white overflow-hidden">#</th>
                  {(
                    [
                      ['barcodeName', 'Barcode'],
                      ['productName', 'Product Name'],
                      ['availableQty', 'Available'],
                      ['totalCountedQty', 'Total Count'],
                      ['difference', 'Diff'],
                      ['normalQty', 'Normal'],
                      ['damageQty', 'Damage'],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="px-4 py-5 text-center text-xs font-black uppercase tracking-widest text-white cursor-pointer hover:bg-white/10 transition-colors overflow-hidden"
                    >
                      <div className="flex items-center justify-center gap-2">
                        {label}
                        <ArrowUpDown className="w-3 h-3 text-white/50 shrink-0" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-sm font-bold text-slate-400">
                      No matching items
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => {
                  const hasCount = item.totalCountedQty > 0;
                  return (
                    <tr
                      key={item.productId}
                      onClick={() => !isReadOnly && setEditingItem(toICItem(item))}
                      className={`hover:bg-indigo-50/40 transition-all group ${isReadOnly ? '' : 'cursor-pointer'}`}
                    >
                      <td className="px-4 py-4 text-center text-sm font-bold text-slate-400 group-hover:text-indigo-600 overflow-hidden">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-black text-slate-600 truncate overflow-hidden">
                        {item.barcodeName || '-'}
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-black text-slate-800 truncate overflow-hidden">
                        {item.productName}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-bold text-slate-600 overflow-hidden">
                        {item.availableQty.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center overflow-hidden">
                        <span
                          className={`inline-flex px-3 py-1.5 rounded-xl text-sm font-black border shadow-sm ${
                            hasCount
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}
                        >
                          {hasCount ? item.totalCountedQty.toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center overflow-hidden">
                        <span className={`text-sm font-black ${diffClass(item.difference, hasCount)}`}>
                          {hasCount ? (
                            <>
                              {item.difference > 0 ? '+' : ''}
                              {item.difference.toLocaleString()}
                            </>
                          ) : (
                            '-'
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center overflow-hidden">
                        <span className="text-sm font-bold text-blue-700">
                          {item.normalQty > 0 ? item.normalQty.toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center overflow-hidden">
                        <span className="text-sm font-bold text-red-600">
                          {item.damageQty > 0 ? item.damageQty.toLocaleString() : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50/50 px-8 py-5 border-t border-gray-100">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                <Package className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="text-sm font-bold">
                Showing <span className="text-slate-900">{filteredData.length}</span> items
              </span>
            </div>
          </div>
        </div>
      )}

      {editingItem && !isReadOnly && (
        <EditItemModal
          item={editingItem}
          onSave={handleSaveItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
