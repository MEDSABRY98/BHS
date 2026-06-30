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
  MapPin,
  Building2,
  Loader2,
  Phone,
  FileSpreadsheet,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  GitMerge
} from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '../../LPOs/Components/ConfirmModal';
import NoData from '@/app/Components/NoDataTab';
import { usePermissions } from '../../LPOs/Hooks/usePermissions';
import { useMergeCustomers } from './Hooks/UseMergeCustomers';
import MergeCustomersModal from './Components/MergeCustomersModal';


export default function CustomersPage() {
  const { canEdit, canDelete, isLoaded } = usePermissions();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'save' | 'delete'>('save');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Form states - Matching DB columns
  const [CUSTOMER_SUB_NAME, setCUSTOMER_SUB_NAME] = useState('');
  const [CUSTOMER_MAIN_NAME, setCUSTOMER_MAIN_NAME] = useState('');
  const [CUSTOMER_CITY, setCUSTOMER_CITY] = useState('');
  const [CUSTOMER_ID, setCUSTOMER_ID] = useState('');

  // Fetch customers when page or search term changes (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchCustomers(searchTerm, currentPage);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, currentPage]);

  async function fetchCustomers(search: string = '', page: number = 1) {
    try {
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;

      let query = bhs_supabas
        .from('bhs_CUSTOMERS')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`"CUSTOMER SUB NAME".ilike.${term},"CUSTOMER MAIN NAME".ilike.${term},"CUSTOMER ID".ilike.${term},"CUSTOMER CITY".ilike.${term}`);
      }

      const { data, error, count } = await query
        .order('CUSTOMER SUB NAME')
        .range(start, end);

      if (error) throw error;
      setCustomers(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (customer: any = null) => {
    setEditingCustomer(customer);
    setCUSTOMER_SUB_NAME(customer ? customer["CUSTOMER SUB NAME"] : '');
    setCUSTOMER_MAIN_NAME(customer ? customer["CUSTOMER MAIN NAME"] : '');
    setCUSTOMER_CITY(customer ? customer["CUSTOMER CITY"] : '');
    setCUSTOMER_ID(customer ? customer["CUSTOMER ID"] : '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave();
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      // Validate Customer ID is unique
      if (CUSTOMER_ID.trim()) {
        const { data: existing, error: checkError } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .select('ID')
          .eq('CUSTOMER ID', CUSTOMER_ID.trim())
          .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          if (!editingCustomer || existing.ID !== editingCustomer.ID) {
            alert(`The Customer ID "${CUSTOMER_ID}" is already in use by another customer!`);
            setIsSaving(false);
            return;
          }
        }
      }

      if (editingCustomer) {
        const { error } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .update({
            "CUSTOMER SUB NAME": CUSTOMER_SUB_NAME,
            "CUSTOMER MAIN NAME": CUSTOMER_MAIN_NAME,
            "CUSTOMER CITY": CUSTOMER_CITY,
            "CUSTOMER ID": CUSTOMER_ID
          })
          .eq('ID', editingCustomer.ID);
        if (error) throw error;
      } else {
        const { data: maxIdData, error: maxIdError } = await bhs_supabas
          .from('bhs_CUSTOMERS_MAX_ID')
          .select('ID')
          .single();

        if (maxIdError && maxIdError.code !== 'PGRST116') {
          throw maxIdError;
        }

        let nextNum = 1;
        if (maxIdData && maxIdData.ID) {
          const match = maxIdData.ID.match(/^R-(\d+)$/i);
          if (match) {
            nextNum = parseInt(match[1], 10) + 1;
          }
        }
        const nextId = `R-${String(nextNum).padStart(4, '0')}`;

        const { error } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .insert({
            ID: nextId,
            "CUSTOMER SUB NAME": CUSTOMER_SUB_NAME,
            "CUSTOMER MAIN NAME": CUSTOMER_MAIN_NAME,
            "CUSTOMER CITY": CUSTOMER_CITY,
            "CUSTOMER ID": CUSTOMER_ID
          });
        if (error) throw error;
      }
      setIsConfirmOpen(false);
      setIsModalOpen(false);
      fetchCustomers(searchTerm, currentPage);
      triggerMessage('success', editingCustomer ? 'Customer updated successfully!' : 'Customer added successfully!');
    } catch (err: any) {
      triggerMessage('error', err.message || 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setConfirmAction('delete');
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    setIsSaving(true);
    try {
      const { error } = await bhs_supabas
        .from('bhs_CUSTOMERS')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      fetchCustomers(searchTerm, currentPage);
      triggerMessage('success', 'Customer deleted successfully!');
    } catch (err: any) {
      triggerMessage('error', err.message || 'Failed to delete customer');
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

  const merge = useMergeCustomers(
    customers,
    () => fetchCustomers(searchTerm, currentPage),
    (msg, type = 'success') => triggerMessage(type, msg)
  );

  useEffect(() => {
    merge.setSelectedInternalIds([]);
  }, [searchTerm, currentPage]);

  const normalizeExcelId = (val: unknown): string => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number' && Number.isFinite(val)) {
      return Number.isInteger(val) ? String(Math.trunc(val)) : String(val);
    }
    return String(val).trim();
  };

  const downloadUploadIssuesReport = (
    fileName: string,
    title: string,
    sections: { heading: string; lines: string[] }[]
  ) => {
    const nonEmptySections = sections.filter((section) => section.lines.length > 0);
    if (nonEmptySections.length === 0) return;

    const lines: string[] = [title, `Generated: ${new Date().toLocaleString('en-GB')}`, ''];
    nonEmptySections.forEach((section) => {
      lines.push(section.heading);
      section.lines.forEach((line) => lines.push(line));
      lines.push('');
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCustomersExcel = async () => {
    setIsSaving(true);
    try {
      let allCustomers: any[] = [];
      let fetchMore = true;
      let pageIndex = 0;
      const limit = 1000;

      while (fetchMore) {
        const { data, error } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .select('*')
          .order('CUSTOMER SUB NAME')
          .range(pageIndex * limit, (pageIndex + 1) * limit - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data];
          if (data.length < limit) fetchMore = false;
          else pageIndex++;
        } else {
          fetchMore = false;
        }
      }

      const exportData = (allCustomers || []).map(c => ({
        "ID": c.ID,
        "Customer ID": c["CUSTOMER ID"] || '',
        "Customer Main Name": c["CUSTOMER MAIN NAME"] || '',
        "Customer Sub Name": c["CUSTOMER SUB NAME"] || '',
        "Customer City": c["CUSTOMER CITY"] || ''
      }));

      if (exportData.length === 0) {
        triggerMessage('error', 'No customers found in database to export');
        setIsSaving(false);
        return;
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customers");
      XLSX.writeFile(wb, "Customers_Data.xlsx");
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

        // Fetch existing customers. Upload updates existing customers only.
        const { data: latestCustomers, error: fetchErr } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .select('ID, "CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME", "CUSTOMER CITY"');

        if (fetchErr) throw fetchErr;

        const dbCustomerIdToCustomerMap = new Map<string, any>();
        (latestCustomers || []).forEach((c) => {
          const customerId = normalizeExcelId(c['CUSTOMER ID']);
          if (customerId) {
            dbCustomerIdToCustomerMap.set(customerId, c);
          }
        });

        const duplicateCustomerIdsInFile = new Map<string, number[]>();
        const missingCustomerIdRows: number[] = [];
        const notFoundCustomerIdRows: string[] = [];

        const trackRow = (map: Map<string, number[]>, key: string, rowNumber: number) => {
          if (!key) return;
          const rows = map.get(key) || [];
          rows.push(rowNumber);
          map.set(key, rows);
        };

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNumber = i + 2;
          const customerId = normalizeExcelId(row['Customer ID']);

          if (!customerId) {
            missingCustomerIdRows.push(rowNumber);
          } else {
            trackRow(duplicateCustomerIdsInFile, customerId, rowNumber);
            if (!dbCustomerIdToCustomerMap.has(customerId)) {
              notFoundCustomerIdRows.push(`Row ${rowNumber}: CUSTOMER ID "${customerId}" not found in database`);
            }
          }
        }

        const issueSections = [
          {
            heading: `=== MISSING CUSTOMER ID (${missingCustomerIdRows.length}) ===`,
            lines: missingCustomerIdRows.map((row) => `Row ${row}`),
          },
          {
            heading: `=== DUPLICATE CUSTOMER ID IN FILE ===`,
            lines: [...duplicateCustomerIdsInFile.entries()]
              .filter(([, rows]) => rows.length > 1)
              .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
              .map(([customerId, rows]) => `${customerId} -> rows ${rows.join(', ')}`),
          },
          {
            heading: `=== CUSTOMER ID NOT FOUND IN DATABASE (${notFoundCustomerIdRows.length}) ===`,
            lines: notFoundCustomerIdRows,
          },
        ];

        const hasIssues = issueSections.some((section) => section.lines.length > 0);
        if (hasIssues) {
          downloadUploadIssuesReport(
            `Customers_Upload_Issues_${new Date().toISOString().split('T')[0]}.txt`,
            'Customers Upload - Issues Found',
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

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const customerId = normalizeExcelId(row['Customer ID']);
          if (!customerId) continue;

          const existingCustomer = dbCustomerIdToCustomerMap.get(customerId);
          if (!existingCustomer) continue;

          const subNameSource =
            row['Customer Sub Name'] !== undefined ? row['Customer Sub Name'] : row['Customer Name'];

          const record: any = {
            ID: existingCustomer.ID,
            'CUSTOMER ID': customerId,
            'CUSTOMER MAIN NAME': String(row['Customer Main Name'] ?? '').trim(),
            'CUSTOMER SUB NAME': String(subNameSource ?? '').trim(),
            'CUSTOMER CITY': String(row['Customer City'] ?? '').trim(),
          };

          recordsToUpsert.push(record);
        }

        if (recordsToUpsert.length === 0) {
          triggerMessage('error', 'No valid customer rows found to upload.');
          setIsUploading(false);
          e.target.value = '';
          return;
        }

        const { error: upsertErr } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .upsert(recordsToUpsert, { onConflict: 'ID' });

        if (upsertErr) throw upsertErr;

        triggerMessage('success', `${recordsToUpsert.length} customers processed successfully!`);
        fetchCustomers(searchTerm, currentPage);
      } catch (err: any) {
        console.error(err);
        triggerMessage('error', err.message || 'Failed to process Excel file');
      } finally {
        setIsUploading(false);
        // Reset file input
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
  const paginatedCustomers = customers;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Customers</h1>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {canEdit && (
            <>
              <button
                onClick={downloadCustomersExcel}
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
                onClick={merge.handleMergeTrigger}
                disabled={merge.isMerging || merge.selectedInternalIds.length < 2}
                className="p-4 bg-white border border-gray-200 text-purple-600 rounded-2xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50"
                title={
                  merge.selectedInternalIds.length < 2
                    ? 'Select at least 2 customers to merge'
                    : `Merge ${merge.selectedInternalIds.length} customers`
                }
              >
                {merge.isMerging ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <GitMerge className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={() => handleOpenModal()}
                className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center"
                title="New Customer"
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
            placeholder="Search by customer name, ID, or city..."
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
      ) : paginatedCustomers.length === 0 ? (
        <NoData title="NO CUSTOMERS FOUND" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {paginatedCustomers.map((customer) => {
            const initials = customer["CUSTOMER MAIN NAME"] 
              ? customer["CUSTOMER MAIN NAME"].split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() 
              : '?';
            const isSelected = merge.selectedInternalIds.includes(customer.ID);

            return (
              <div
                key={customer.ID}
                onClick={() => canEdit && handleOpenModal(customer)}
                className={`group bg-white border rounded-[2.5rem] p-6 transition-all duration-300 flex flex-col justify-between min-h-[220px] ${
                  isSelected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/20' : 'border-gray-100'
                } ${canEdit ? 'hover:shadow-xl hover:border-black/5 cursor-pointer' : ''}`}
              >
                <div>
                  {/* Top Row with Initials/Avatar and ID */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      {canEdit && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => merge.handleToggleSelect(customer.ID)}
                          className="mt-3 w-4 h-4 rounded border-gray-300"
                          title="Select for merge"
                        />
                      )}
                      <div className="w-12 h-12 rounded-2xl bg-black text-[#D4AF37] flex items-center justify-center font-black text-base shadow-lg shadow-black/10">
                        {initials}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{customer.ID}</span>
                  </div>

                  {/* Name and Customer ID */}
                  <div className="mt-4">
                    <h3 className="font-black text-black text-base leading-tight group-hover:text-[#D4AF37] transition-colors line-clamp-2" title={customer["CUSTOMER MAIN NAME"]}>
                      {customer["CUSTOMER MAIN NAME"] || '-'}
                    </h3>
                    <div className="text-xs font-bold text-gray-400 mt-1 line-clamp-1" title={customer["CUSTOMER SUB NAME"]}>
                      {customer["CUSTOMER SUB NAME"]}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-xl text-[9px] font-black uppercase tracking-widest font-mono">
                        ID: {customer["CUSTOMER ID"]}
                      </span>
                      {customer["CUSTOMER CITY"] && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest">
                          <MapPin className="w-2.5 h-2.5" /> {customer["CUSTOMER CITY"]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer with Actions */}
                <div className="mt-6 pt-3 border-t border-gray-50 flex items-center justify-end">
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(customer);
                        }}
                        className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-black transition-all border border-transparent hover:border-gray-100"
                        title="Edit Customer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(customer.ID);
                        }}
                        className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                        title="Delete Customer"
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white px-8 py-6 rounded-3xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm mt-6">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Showing <span className="text-black font-black">{startIndex + 1}</span> to{" "}
            <span className="text-black font-black">
              {Math.min(startIndex + itemsPerPage, totalCount)}
            </span>{" "}
            of <span className="text-black font-black">{totalCount}</span> customers
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-black hover:border-black disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-100 transition-all"
              title="Previous Page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;

                return (
                  <div key={p} className="flex items-center gap-2">
                    {showEllipsis && <span className="text-xs text-gray-400 font-bold px-1">...</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`w-10 h-10 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${currentPage === p
                        ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10'
                        : 'bg-gray-50 text-gray-400 hover:text-black border border-gray-100 hover:border-black'
                        }`}
                    >
                      {p}
                    </button>
                  </div>
                );
              })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-black hover:border-black disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-100 transition-all"
              title="Next Page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{editingCustomer ? 'Edit Customer' : 'New Customer'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CUSTOMER MAIN NAME</label>
                  <input
                    type="text"
                    value={CUSTOMER_MAIN_NAME}
                    onChange={(e) => setCUSTOMER_MAIN_NAME(e.target.value)}
                    placeholder="Main Company Name"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CUSTOMER SUB NAME</label>
                  <input
                    type="text"
                    value={CUSTOMER_SUB_NAME}
                    onChange={(e) => setCUSTOMER_SUB_NAME(e.target.value)}
                    placeholder="Full Company Sub Name"
                    required
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CUSTOMER ID</label>
                  <input
                    type="text"
                    value={CUSTOMER_ID}
                    onChange={(e) => setCUSTOMER_ID(e.target.value)}
                    placeholder="TRN or Reg No."
                    required
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CUSTOMER CITY</label>
                  <div className="relative">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={CUSTOMER_CITY}
                      onChange={(e) => setCUSTOMER_CITY(e.target.value)}
                      placeholder="e.g. Dubai"
                      required
                      className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                    />
                  </div>
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
        message="Are you sure you want to delete this customer? This action cannot be undone."
      />

      <MergeCustomersModal
        isOpen={merge.showMergeModal}
        isConfirmingMerge={merge.isConfirmingMerge}
        isMerging={merge.isMerging}
        selectedCustomers={merge.selectedCustomers}
        mergeTargetMainName={merge.mergeTargetMainName}
        mergeTargetSubName={merge.mergeTargetSubName}
        mergeTargetCity={merge.mergeTargetCity}
        survivorCustomerId={merge.survivorCustomerId}
        onClose={merge.closeMergeModal}
        onConfirm={merge.handleConfirmMerge}
        onBackFromConfirm={() => merge.setIsConfirmingMerge(false)}
        setMergeTargetMainName={merge.setMergeTargetMainName}
        setMergeTargetSubName={merge.setMergeTargetSubName}
        setMergeTargetCity={merge.setMergeTargetCity}
        setSurvivorCustomerId={merge.setSurvivorCustomerId}
      />

    </div>
  );
}
