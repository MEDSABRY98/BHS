'use client';

import { useState, useEffect } from 'react';
import { bhs_supabas } from '@/lib/supabase';
import {
  UserCircle,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Building2,
  Loader2,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '../../LPOs/Components/ConfirmModal';
import NoData from '@/app/Components/NoDataTab';
import { usePermissions } from '../../LPOs/Hooks/usePermissions';
import { exportDatabaseExcel } from '../ExcelExport';
import { downloadUploadIssuesReport, normalizeExcelId } from '../Utils/ExcelUploadUtils';

export default function SuppliersPage() {
  const { canEdit, canDelete } = usePermissions();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Form states
  const [SUPPLIER_NAME, setSUPPLIER_NAME] = useState('');
  const [SUPPLIER_ID, setSUPPLIER_ID] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchSuppliers(searchTerm, currentPage);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, currentPage]);

  async function fetchSuppliers(search: string = '', page: number = 1) {
    try {
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;

      let query = bhs_supabas
        .from('bhs_SUPPLIERS')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`"SUPPLIER NAME".ilike.${term},"SUPPLIER ID".ilike.${term}`);
      }

      const { data, error, count } = await query
        .order('SUPPLIER NAME')
        .range(start, end);

      if (error) throw error;
      setSuppliers(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (supplier: any = null) => {
    setEditingSupplier(supplier);
    setSUPPLIER_NAME(supplier ? supplier["SUPPLIER NAME"] : '');
    setSUPPLIER_ID(supplier ? supplier["SUPPLIER ID"] : '');
    setIsModalOpen(true);
  };

  const executeSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Validate Supplier ID is unique
      if (SUPPLIER_ID.trim()) {
        const { data: existing, error: checkError } = await bhs_supabas
          .from('bhs_SUPPLIERS')
          .select('ID')
          .eq('SUPPLIER ID', SUPPLIER_ID.trim())
          .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          if (!editingSupplier || existing.ID !== editingSupplier.ID) {
            alert(`The Supplier ID "${SUPPLIER_ID}" is already in use!`);
            setIsSaving(false);
            return;
          }
        }
      }

      if (editingSupplier) {
        const { error } = await bhs_supabas
          .from('bhs_SUPPLIERS')
          .update({
            "SUPPLIER NAME": SUPPLIER_NAME,
            "SUPPLIER ID": SUPPLIER_ID
          })
          .eq('ID', editingSupplier.ID);
        if (error) throw error;
      } else {
        // Find Max ID manually
        const { data: allData, error: fetchErr } = await bhs_supabas
          .from('bhs_SUPPLIERS')
          .select('ID');
          
        if (fetchErr) throw fetchErr;
        
        let maxNum = 0;
        if (allData && allData.length > 0) {
          allData.forEach(row => {
             const numStr = String(row.ID || '').split('-')[1];
             if(numStr) {
               const num = parseInt(numStr, 10);
               if(!isNaN(num) && num > maxNum) maxNum = num;
             }
          });
        }
        
        const nextId = `R-${String(maxNum + 1).padStart(4, '0')}`;

        const { error } = await bhs_supabas
          .from('bhs_SUPPLIERS')
          .insert({
            ID: nextId,
            "SUPPLIER NAME": SUPPLIER_NAME,
            "SUPPLIER ID": SUPPLIER_ID
          });
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchSuppliers(searchTerm, currentPage);
      triggerMessage('success', editingSupplier ? 'Supplier updated successfully!' : 'Supplier added successfully!');
    } catch (err: any) {
      triggerMessage('error', err.message || 'Failed to save supplier');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    setIsSaving(true);
    try {
      const { error } = await bhs_supabas
        .from('bhs_SUPPLIERS')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      fetchSuppliers(searchTerm, currentPage);
      triggerMessage('success', 'Supplier deleted successfully!');
    } catch (err: any) {
      triggerMessage('error', err.message || 'Failed to delete supplier');
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const triggerMessage = (type: 'success' | 'error', text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  };

  const downloadSuppliersExcel = async () => {
    setIsSaving(true);
    try {
      let allSuppliers: any[] = [];
      let fetchMore = true;
      let pageIndex = 0;
      const limit = 1000;

      while (fetchMore) {
        const { data, error } = await bhs_supabas
          .from('bhs_SUPPLIERS')
          .select('*')
          .order('SUPPLIER NAME')
          .range(pageIndex * limit, (pageIndex + 1) * limit - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allSuppliers = [...allSuppliers, ...data];
          if (data.length < limit) fetchMore = false;
          else pageIndex++;
        } else {
          fetchMore = false;
        }
      }

      const exportData = (allSuppliers || []).map(s => ({
        "ID": s.ID,
        "Supplier ID": s["SUPPLIER ID"] || '',
        "Supplier Name": s["SUPPLIER NAME"] || '',
      }));

      if (exportData.length === 0) {
        triggerMessage('error', 'No suppliers found in database to export');
        setIsSaving(false);
        return;
      }

      await exportDatabaseExcel(exportData, "Suppliers.xlsx");
      triggerMessage('success', 'Excel file exported successfully!');
    } catch (err: any) {
      console.error(err);
      triggerMessage('error', 'Failed to export Excel file');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

        if (data.length === 0) {
          triggerMessage('error', 'Excel file is empty');
          setIsUploading(false);
          return;
        }

        const { data: latestSuppliers, error: fetchErr } = await bhs_supabas
          .from('bhs_SUPPLIERS')
          .select('ID, "SUPPLIER ID"');

        if (fetchErr) throw fetchErr;

        const dbSupplierIdToSupplierMap = new Map<string, any>();
        let maxRecordNum = 0;

        (latestSuppliers || []).forEach((supplier) => {
          const supplierId = normalizeExcelId(supplier['SUPPLIER ID']);
          if (supplierId) {
            dbSupplierIdToSupplierMap.set(supplierId, supplier);
          }
          if (supplier.ID && supplier.ID.startsWith('R-')) {
            const num = parseInt(supplier.ID.split('-')[1], 10);
            if (!isNaN(num) && num > maxRecordNum) {
              maxRecordNum = num;
            }
          }
        });

        const missingSupplierIdRows: number[] = [];
        const missingNameRows: number[] = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNumber = i + 2;
          const supplierId = normalizeExcelId(row['Supplier ID']);
          const supplierName = String(row['Supplier Name'] ?? '').trim();

          if (!supplierId) missingSupplierIdRows.push(rowNumber);
          if (!supplierName) missingNameRows.push(rowNumber);
        }

        const issueSections = [
          {
            heading: `=== MISSING SUPPLIER ID (${missingSupplierIdRows.length}) ===`,
            lines: missingSupplierIdRows.map((row) => `Row ${row}`),
          },
          {
            heading: `=== MISSING SUPPLIER NAME (${missingNameRows.length}) ===`,
            lines: missingNameRows.map((row) => `Row ${row}`),
          },
        ];

        const hasIssues = issueSections.some((section) => section.lines.length > 0);
        if (hasIssues) {
          downloadUploadIssuesReport(
            `Suppliers_Upload_Issues_${new Date().toISOString().split('T')[0]}.txt`,
            'Suppliers Upload - Issues Found',
            issueSections
          );
          triggerMessage(
            'error',
            'Upload blocked. A text file with all issues has been downloaded. Fix the Excel file and upload again.'
          );
          setIsUploading(false);
          e.target.value = '';
          return;
        }

        const recordsToUpsert: any[] = [];
        let nextRecordNum = maxRecordNum;

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const supplierId = normalizeExcelId(row['Supplier ID']);
          if (!supplierId) continue;

          let idToUse = '';
          const existingSupplier = dbSupplierIdToSupplierMap.get(supplierId);
          if (existingSupplier) {
            idToUse = existingSupplier.ID;
          } else {
            nextRecordNum += 1;
            idToUse = `R-${String(nextRecordNum).padStart(4, '0')}`;
          }

          const record: any = {
            ID: idToUse,
            'SUPPLIER ID': supplierId,
            'SUPPLIER NAME': String(row['Supplier Name'] ?? '').trim()
          };

          recordsToUpsert.push(record);
        }

        if (recordsToUpsert.length === 0) {
          triggerMessage('error', 'No valid supplier rows found to upload.');
          setIsUploading(false);
          e.target.value = '';
          return;
        }

        // Upsert in batches of 1000
        for (let i = 0; i < recordsToUpsert.length; i += 1000) {
           const batch = recordsToUpsert.slice(i, i + 1000);
           const { error: upsertErr } = await bhs_supabas
             .from('bhs_SUPPLIERS')
             .upsert(batch, { onConflict: 'ID' });
           if (upsertErr) throw upsertErr;
        }

        triggerMessage('success', `${recordsToUpsert.length} suppliers processed successfully!`);
        fetchSuppliers(searchTerm, currentPage);
      } catch (err: any) {
        console.error(err);
        triggerMessage('error', err.message || 'Failed to process Excel file');
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      triggerMessage('error', 'Error reading Excel file');
      setIsUploading(false);
    };

    reader.readAsBinaryString(file);
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">Suppliers DB <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">{totalCount.toLocaleString()}</span></h1>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {canEdit && (
            <>
              <button
                onClick={downloadSuppliersExcel}
                disabled={isSaving}
                className="p-4 bg-white border border-gray-200 text-green-600 rounded-2xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50"
                title="Export Excel"
              >
                <Download className="w-6 h-6" />
              </button>

              <label
                className={`p-4 bg-white border border-gray-200 text-blue-600 rounded-2xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Import/Update from Excel"
              >
                {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>

              <button
                onClick={() => handleOpenModal()}
                className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center"
                title="New Supplier"
              >
                <Plus className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by supplier name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse bg-white border border-gray-100 rounded-[2.5rem] p-6 h-[220px] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl" />
                <div className="h-6 bg-gray-50 rounded-xl w-3/4" />
                <div className="h-4 bg-gray-50 rounded-xl w-1/2" />
              </div>
              <div className="h-10 bg-gray-50 rounded-2xl w-full" />
            </div>
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <NoData title="NO SUPPLIERS FOUND" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {suppliers.map((supplier) => {
            const initials = supplier["SUPPLIER NAME"] 
              ? supplier["SUPPLIER NAME"].split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() 
              : '?';

            return (
              <div
                key={supplier.ID}
                onClick={() => canEdit && handleOpenModal(supplier)}
                className={`group bg-white border border-gray-100 rounded-[2.5rem] p-6 transition-all duration-300 flex flex-col justify-between min-h-[220px] ${canEdit ? 'hover:shadow-xl hover:border-black/5 cursor-pointer' : ''}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-black text-[#D4AF37] flex items-center justify-center font-black text-base shadow-lg shadow-black/10">
                      {initials}
                    </div>
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{supplier.ID}</span>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-black text-black text-lg leading-tight group-hover:text-[#D4AF37] transition-colors line-clamp-2" title={supplier["SUPPLIER NAME"]}>
                      {supplier["SUPPLIER NAME"] || '-'}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-xl text-xs font-black uppercase tracking-widest font-mono">
                        ID: {supplier["SUPPLIER ID"]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-gray-50 flex items-center justify-end">
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(supplier);
                        }}
                        className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-black transition-all border border-transparent hover:border-gray-100"
                        title="Edit Supplier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(supplier.ID);
                        }}
                        className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                        title="Delete Supplier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="bg-white px-8 py-6 rounded-3xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm mt-6">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Showing <span className="text-black font-black">{startIndex + 1}</span> to{" "}
            <span className="text-black font-black">
              {Math.min(startIndex + itemsPerPage, totalCount)}
            </span>{" "}
            of <span className="text-black font-black">{totalCount}</span> suppliers
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-black hover:border-black disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-100 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-black hover:border-black disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-100 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{editingSupplier ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={executeSave} className="p-8 space-y-8">
              <div className="grid grid-cols-1 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">SUPPLIER ID</label>
                  <input
                    type="text"
                    value={SUPPLIER_ID}
                    onChange={(e) => setSUPPLIER_ID(e.target.value)}
                    placeholder="e.g. SUP-1001"
                    required
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">SUPPLIER NAME</label>
                  <input
                    type="text"
                    value={SUPPLIER_NAME}
                    onChange={(e) => setSUPPLIER_NAME(e.target.value)}
                    placeholder="Full Company Name"
                    required
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-4 bg-black text-[#D4AF37] rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  SAVE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onConfirm={executeDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isSaving}
        title="Confirm Deletion"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
      />
    </div>
  );
}
