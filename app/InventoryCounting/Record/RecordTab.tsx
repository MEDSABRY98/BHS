'use client';

import React, { useState, useEffect } from 'react';
import { Search, History, RefreshCw, FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { writeTrackedXlsxFile } from '@/app/Audit/Utils/TrackedDownload';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import EditRecordModal from './EditRecordModal';
import {
  fetchAllICDetails,
  fetchArchivedAllICDetails,
  updateICRecord,
  deleteICRecord,
  type ICRecord,
  type CountType,
} from '../Service/InventoryCountingService';
import { useInventoryCountingArchive } from '../Archives/InventoryCountingArchiveContext';
import { useInventoryCountingFilters, matchesICUser, matchesICWarehouse } from '../Model/InventoryCountingFiltersContext';
import { peekICPrefetch } from '../Utils/ICPrefetchCache';

function formatCountType(countType: CountType): string {
  return countType === 'Normal' ? 'Normal' : 'Damage & Expire';
}

export default function RecordTab() {
  const { archiveId, isReadOnly, sessionVersion } = useInventoryCountingArchive();
  const [data, setData] = useState<ICRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRecord, setEditingRecord] = useState<ICRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<ICRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { selectedUsers, selectedWarehouses } = useInventoryCountingFilters();
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (isSilent = false) => {
    if (isSilent) setIsRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      // Prefer session bootstrap cache on first paint (refresh always hits network).
      if (!isSilent) {
        const prefetched = peekICPrefetch(archiveId);
        if (prefetched) {
          setData(prefetched.records.data);
          setLoading(false);
          return;
        }
      }

      const json = archiveId
        ? await fetchArchivedAllICDetails(archiveId)
        : await fetchAllICDetails();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to load data');
      }
    } catch (e: any) {
      console.error('Failed to load IC records', e);
      setError(e.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [archiveId, sessionVersion]);

  const filteredData = data.filter((item) => {
    const query = searchQuery.toLowerCase().trim();
    const typeLabel = formatCountType(item.countType).toLowerCase();
    const matchesSearch =
      !query ||
      item.productName.toLowerCase().includes(query) ||
      item.productId.toLowerCase().includes(query) ||
      item.barcodeName.toLowerCase().includes(query) ||
      item.user.toLowerCase().includes(query) ||
      item.warehouse.toLowerCase().includes(query) ||
      typeLabel.includes(query);

    const matchesUser = matchesICUser(item.user, selectedUsers);
    const matchesWarehouse = matchesICWarehouse(item.warehouse, selectedWarehouses);

    return matchesSearch && matchesUser && matchesWarehouse;
  });

  const handleExport = () => {
    const exportData = filteredData.map((item, idx) => ({
      '#': idx + 1,
      'Row ID': item.rowId,
      Date: item.date,
      Type: formatCountType(item.countType),
      User: item.user,
      Warehouse: item.warehouse,
      Barcode: item.barcodeName,
      'Product Name': item.productName,
      'Qty in Box': item.qtyInBox,
      'Count Details': item.countDetails,
      'Counted Qty': item.countedQty,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Record');
    writeTrackedXlsxFile(workbook, `Inventory_Record_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSaveRecord = async (values: { qtyInBox: number; countedQty: number; countDetails: string }) => {
    if (!editingRecord) return;

    const res = await updateICRecord(
      editingRecord.rowId,
      editingRecord.countType,
      editingRecord.productId,
      values
    );

    if (!res.success) {
      throw new Error(res.error || res.details || 'Failed to update record');
    }

    setData((prev) =>
      prev.map((row) =>
        row.rowId === editingRecord.rowId
          ? {
              ...row,
              qtyInBox: values.qtyInBox,
              countedQty: values.countedQty,
              countDetails: values.countDetails,
            }
          : row
      )
    );
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;

    setIsDeleting(true);
    try {
      const res = await deleteICRecord(
        deletingRecord.rowId,
        deletingRecord.countType,
        deletingRecord.productId
      );

      if (!res.success) {
        throw new Error(res.error || res.details || 'Failed to delete record');
      }

      setData((prev) => prev.filter((row) => row.rowId !== deletingRecord.rowId));
      setDeletingRecord(null);
    } catch (e: any) {
      console.error('Failed to delete record', e);
      alert(e.message || 'Failed to delete record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <TabLoader />;
  }

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
        <div className="relative flex-1 min-w-[200px] group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Product, User, Warehouse, Type..."
            className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-transparent rounded-2xl text-base font-bold text-slate-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200/50 hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 group/refresh"
            title="Refresh Data"
          >
            <RefreshCw
              className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : 'group-hover/refresh:rotate-180'} transition-all duration-500`}
            />
          </button>

          <button
            onClick={handleExport}
            className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200/50 hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all group/export"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-6 h-6 group-hover/export:rotate-12 transition-transform" />
          </button>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <NoData title="No Records Found" />
      ) : (
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '90px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '70px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
              </colgroup>
              <thead className="bg-black text-white sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    Date
                  </th>
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    Type
                  </th>
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    User
                  </th>
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    Warehouse
                  </th>
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    Barcode
                  </th>
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    Product Name
                  </th>
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    In Box
                  </th>
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    Details
                  </th>
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    Counted
                  </th>
                  {!isReadOnly && (
                  <th className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                    Actions
                  </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((item) => (
                  <tr key={item.rowId} className="hover:bg-slate-50 transition-all group border-b border-gray-50">
                    <td className="px-3 py-4 text-center whitespace-nowrap">
                      <span className="text-[11px] font-semibold text-slate-700 tabular-nums">{item.date}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                          item.countType === 'Normal'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {formatCountType(item.countType)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                          {item.user.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-slate-600 truncate max-w-[80px]">{item.user}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase">
                        {item.warehouse}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="text-[11px] font-bold text-slate-700 truncate block">{item.barcodeName}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="text-xs font-black text-slate-800 leading-tight truncate block">
                        {item.productName}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="text-sm font-bold text-slate-600">
                        {item.qtyInBox === 0 ? '-' : item.qtyInBox}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span
                        className="text-[11px] font-bold text-slate-600 truncate max-w-[130px] inline-block"
                        title={item.countDetails}
                      >
                        {item.countDetails}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-black border border-blue-100 shadow-sm">
                        {item.countedQty === 0 ? '-' : item.countedQty.toLocaleString()}
                      </span>
                    </td>
                    {!isReadOnly && (
                    <td className="px-3 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingRecord(item)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          title="Edit Record"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingRecord(item)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50/50 px-8 py-5 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                  <History className="w-5 h-5 text-slate-600" />
                </div>
                <span className="text-sm font-bold">
                  Total Records: <span className="text-slate-900">{filteredData.length}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onSave={handleSaveRecord}
          onClose={() => setEditingRecord(null)}
        />
      )}

      {deletingRecord && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !isDeleting && setDeletingRecord(null)}
        >
          <div
            className="bg-white rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-black text-gray-900 mb-3">Delete Record</h3>
            <p className="text-sm font-bold text-slate-600 mb-6">
              Are you sure you want to delete this record? This will recalculate the product total in the
              database.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingRecord(null)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 transition-all text-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
