'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Search, Package, RefreshCw, ChevronDown, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import {
  fetchICTotalCountData,
  fetchICCountTabData,
  fetchArchivedICTotalCountData,
  fetchArchivedICCountTabData,
  updateICItem,
  ICTotalCountItem,
} from './Service/InventoryCountingService';
import { ICItem, ICRecord } from './Utils/EditItemModal';
import EditItemModal from './Utils/EditItemModal';
import { useInventoryCountingArchive } from './InventoryCountingArchiveContext';
import { useInventoryCountingFilters, matchesICUser, matchesICWarehouse, hasICScopeFilter } from './InventoryCountingFiltersContext';

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
      const [result, normalResult, damageResult] = archiveId
        ? await Promise.all([
            fetchArchivedICTotalCountData(archiveId),
            fetchArchivedICCountTabData(archiveId, 'Normal'),
            fetchArchivedICCountTabData(archiveId, 'DamageExpire'),
          ])
        : await Promise.all([
            fetchICTotalCountData(),
            fetchICCountTabData('Normal'),
            fetchICCountTabData('DamageExpire'),
          ]);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to load data');
      }

      if (normalResult.success && normalResult.records) {
        setNormalRecords(normalResult.records);
      }
      if (damageResult.success && damageResult.records) {
        setDamageRecords(damageResult.records);
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
    XLSX.writeFile(workbook, `Total_Count_${new Date().toISOString().split('T')[0]}.xlsx`);
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
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200/50 hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
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

      {filteredData.length === 0 ? (
        <NoData title="No Data Found" />
      ) : (
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '50px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '100px' }} />
              </colgroup>
              <thead className="bg-black text-white sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-5 text-center text-xs font-black uppercase tracking-widest text-white">#</th>
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
                      className="px-4 py-5 text-center text-xs font-black uppercase tracking-widest text-white cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-2">
                        {label}
                        <ArrowUpDown className="w-3 h-3 text-white/50" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((item, idx) => {
                  const hasCount = item.totalCountedQty > 0;
                  return (
                    <tr
                      key={item.productId}
                      onClick={() => !isReadOnly && setEditingItem(toICItem(item))}
                      className={`hover:bg-indigo-50/40 transition-all group ${isReadOnly ? '' : 'cursor-pointer'}`}
                    >
                      <td className="px-4 py-4 text-center text-sm font-bold text-slate-400 group-hover:text-indigo-600">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-black text-slate-600 truncate">
                        {item.barcodeName || '-'}
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-black text-slate-800 truncate">
                        {item.productName}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-bold text-slate-600">
                        {item.availableQty.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center">
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
                      <td className="px-4 py-4 text-center">
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
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-bold text-blue-700">
                          {item.normalQty > 0 ? item.normalQty.toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-bold text-red-600">
                          {item.damageQty > 0 ? item.damageQty.toLocaleString() : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
