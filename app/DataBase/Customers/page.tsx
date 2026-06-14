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
  ChevronRight
} from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '../../LPOs/Components/ConfirmModal';
import NoData from '@/app/Components/NoDataTab';
import { usePermissions } from '../../LPOs/Hooks/usePermissions';


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
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          triggerMessage('error', 'Excel file is empty');
          setIsUploading(false);
          return;
        }

        // Fetch latest customers from DB to ensure sequential IDs are unique and correct
        const { data: latestCustomers, error: fetchErr } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .select('ID, "CUSTOMER ID"');

        if (fetchErr) throw fetchErr;

        // Build mapping of CUSTOMER ID -> ID from DB, and track existing DB IDs
        const dbCustomerIdToIdMap = new Map<string, string>();
        const dbIdSet = new Set<string>();
        let highestNum = 0;

        (latestCustomers || []).forEach(c => {
          if (c["CUSTOMER ID"]) {
            dbCustomerIdToIdMap.set(c["CUSTOMER ID"].trim(), c.ID);
          }
          if (c.ID) {
            dbIdSet.add(c.ID.trim());
            if (c.ID.startsWith('R-')) {
              const num = parseInt(c.ID.split('-')[1]);
              if (!isNaN(num) && num > highestNum) {
                highestNum = num;
              }
            }
          }
        });

        // Track duplicate CUSTOMER IDs and IDs within the Excel file itself to prevent collisions in the batch
        const excelCustomerIdSet = new Set<string>();
        const excelIdSet = new Set<string>();

        const recordsToUpsert = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          let id = row["ID"]?.toString().trim();
          const customerId = row["Customer ID"]?.toString().trim() || '';

          if (customerId) {
            // Check for duplicates of Customer ID within the Excel sheet itself
            if (excelCustomerIdSet.has(customerId)) {
              triggerMessage('error', `Row ${i + 2}: Duplicate 'Customer ID' "${customerId}" found within the Excel file.`);
              setIsUploading(false);
              return;
            }
            excelCustomerIdSet.add(customerId);
          }

          // Determine database ID for this customer (prioritize explicit ID column, then Customer ID lookup)
          let finalId = id;
          if (!finalId && customerId) {
            finalId = dbCustomerIdToIdMap.get(customerId);
          }

          const isExisting = !!finalId;

          // Check if name is provided in the Excel row
          const customerSubNameRaw = row["Customer Sub Name"] !== undefined ? row["Customer Sub Name"] : row["Customer Name"];
          const customerSubName = customerSubNameRaw !== undefined ? customerSubNameRaw.toString().trim() : undefined;

          // If it's a new customer, name is required
          if (!isExisting && !customerSubName) {
            triggerMessage('error', `Row ${i + 2}: 'Customer Sub Name' or 'Customer Name' is required for new customers.`);
            setIsUploading(false);
            return;
          }

          // Check if this DB ID is already claimed by another row in the same Excel file
          if (finalId) {
            if (excelIdSet.has(finalId)) {
              triggerMessage('error', `Row ${i + 2}: Database ID "${finalId}" is claimed by multiple rows in the Excel file.`);
              setIsUploading(false);
              return;
            }
          } else {
            // Generate a new ID for new customer
            highestNum++;
            finalId = `R-${highestNum.toString().padStart(4, '0')}`;
            while (dbIdSet.has(finalId) || excelIdSet.has(finalId)) {
              highestNum++;
              finalId = `R-${highestNum.toString().padStart(4, '0')}`;
            }
          }

          excelIdSet.add(finalId);

          // Build payload dynamically - only include fields defined in the Excel sheet
          const record: any = { ID: finalId };

          if (row["Customer ID"] !== undefined) {
            record["CUSTOMER ID"] = customerId;
          }
          if (row["Customer Main Name"] !== undefined) {
            record["CUSTOMER MAIN NAME"] = row["Customer Main Name"].toString().trim();
          }
          if (customerSubNameRaw !== undefined) {
            record["CUSTOMER SUB NAME"] = customerSubName;
          }
          if (row["Customer City"] !== undefined) {
            record["CUSTOMER CITY"] = row["Customer City"].toString().trim();
          }

          recordsToUpsert.push(record);
        }

        // Perform bulk upsert
        const { error: upsertErr } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .upsert(recordsToUpsert);

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

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
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

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-32">ID</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-48">Customer ID</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer Main Name</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer Sub Name</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-40">City</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6">
                      <div className="h-8 bg-gray-50 rounded-xl w-full"></div>
                    </td>
                  </tr>
                ))
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center">
                    <NoData title="NO CUSTOMERS FOUND" />
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr key={customer.ID} className="group hover:bg-gray-50/50 transition-all duration-300">
                    <td className="px-8 py-6 text-center">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{customer.ID}</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="text-xs font-medium font-mono text-gray-400 tracking-wider">{customer["CUSTOMER ID"]}</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-black/5">
                          <Building2 className="w-5 h-5 text-[#D4AF37]" />
                        </div>
                        <span className="font-bold text-black">{customer["CUSTOMER MAIN NAME"] || '-'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="font-bold text-black">{customer["CUSTOMER SUB NAME"]}</span>
                    </td>
                    <td className="px-8 py-6 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <MapPin className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">{customer["CUSTOMER CITY"]}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {canEdit && (
                          <button onClick={() => handleOpenModal(customer)} className="p-2.5 hover:bg-white hover:shadow-sm rounded-xl text-gray-400 hover:text-black transition-all border border-transparent hover:border-gray-100">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(customer.ID)} className="p-2.5 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

    </div>
  );
}
