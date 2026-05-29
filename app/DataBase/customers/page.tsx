'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
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
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '../../LPOs/Components/ConfirmModal';
import NoData from '@/components/01-Unified/NoDataTab';
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
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Form states - Matching DB columns
  const [CUSTOMER_NAME, setCUSTOMER_NAME] = useState('');
  const [CUSTOMER_CITY, setCUSTOMER_CITY] = useState('');
  const [CUSTOMER_ID, setCUSTOMER_ID] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const { data, error } = await app_lpos_supabase
        .from('bhs_CUSTOMERS')
        .select('*')
        .order('CUSTOMER NAME');
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (customer: any = null) => {
    setEditingCustomer(customer);
    setCUSTOMER_NAME(customer ? customer["CUSTOMER NAME"] : '');
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
      if (editingCustomer) {
        const { error } = await app_lpos_supabase
          .from('bhs_CUSTOMERS')
          .update({
            "CUSTOMER NAME": CUSTOMER_NAME,
            "CUSTOMER CITY": CUSTOMER_CITY,
            "CUSTOMER ID": CUSTOMER_ID
          })
          .eq('ID', editingCustomer.ID);
        if (error) throw error;
      } else {
        const nextId = `R-${(customers.length + 1).toString().padStart(4, '0')}`;
        const { error } = await app_lpos_supabase
          .from('bhs_CUSTOMERS')
          .insert({
            ID: nextId,
            "CUSTOMER NAME": CUSTOMER_NAME,
            "CUSTOMER CITY": CUSTOMER_CITY,
            "CUSTOMER ID": CUSTOMER_ID
          });
        if (error) throw error;
      }
      setIsConfirmOpen(false);
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
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
      const { error } = await app_lpos_supabase
        .from('bhs_CUSTOMERS')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const triggerMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const downloadCustomersExcel = () => {
    try {
      const exportData = customers.map(c => ({
        "ID": c.ID,
        "Customer ID": c["CUSTOMER ID"] || '',
        "Customer Name": c["CUSTOMER NAME"] || '',
        "Customer City": c["CUSTOMER CITY"] || ''
      }));

      // If there's no customer data yet, provide a sample row
      if (exportData.length === 0) {
        exportData.push({
          "ID": "R-0001",
          "Customer ID": "CUST-1001",
          "Customer Name": "Lulu Hypermarket",
          "Customer City": "Dubai"
        });
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customers");
      XLSX.writeFile(wb, "Customers_Data.xlsx");
      triggerMessage('success', 'Excel file exported successfully!');
    } catch (err: any) {
      console.error(err);
      triggerMessage('error', 'Failed to export Excel file');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

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
        const { data: latestCustomers, error: fetchErr } = await app_lpos_supabase
          .from('bhs_CUSTOMERS')
          .select('ID');

        if (fetchErr) throw fetchErr;

        let highestNum = 0;
        (latestCustomers || []).forEach(c => {
          if (c.ID && c.ID.startsWith('R-')) {
            const num = parseInt(c.ID.split('-')[1]);
            if (!isNaN(num) && num > highestNum) {
              highestNum = num;
            }
          }
        });

        const recordsToUpsert = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          let id = row["ID"]?.toString().trim();
          const customerId = row["Customer ID"]?.toString().trim() || '';
          const customerName = row["Customer Name"]?.toString().trim();
          const customerCity = row["Customer City"]?.toString().trim() || '';

          if (!customerName) {
            triggerMessage('error', `Row ${i + 2}: 'Customer Name' is required`);
            setIsUploading(false);
            return;
          }

          if (!id) {
            highestNum++;
            id = `R-${highestNum.toString().padStart(4, '0')}`;
          }

          recordsToUpsert.push({
            ID: id,
            "CUSTOMER ID": customerId,
            "CUSTOMER NAME": customerName,
            "CUSTOMER CITY": customerCity
          });
        }

        // Perform bulk upsert
        const { error: upsertErr } = await app_lpos_supabase
          .from('bhs_CUSTOMERS')
          .upsert(recordsToUpsert);

        if (upsertErr) throw upsertErr;

        triggerMessage('success', `${recordsToUpsert.length} customers processed successfully!`);
        setIsExcelModalOpen(false);
        fetchCustomers();
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

  const filteredCustomers = customers.filter(c =>
    c["CUSTOMER NAME"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c["CUSTOMER ID"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c["CUSTOMER CITY"]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

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
                onClick={() => setIsExcelModalOpen(true)}
                className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-black hover:border-black hover:bg-gray-50 transition-all shadow-sm group"
                title="Excel Actions"
              >
                <FileSpreadsheet className="w-6 h-6 group-hover:scale-110 transition-transform" />
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
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-64">Customer ID</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer Name</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-48">City</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-6">
                      <div className="h-8 bg-gray-50 rounded-xl w-full"></div>
                    </td>
                  </tr>
                ))
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center">
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
                    <td className="px-8 py-6 text-left">
                      <div className="flex items-center justify-start gap-3">
                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-black/5">
                          <Building2 className="w-5 h-5 text-[#D4AF37]" />
                        </div>
                        <span className="font-bold text-black">{customer["CUSTOMER NAME"]}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <MapPin className="w-3.5 h-3.5 text-gray-300" />
                        <span className="text-xs font-bold uppercase tracking-widest">{customer["CUSTOMER CITY"]}</span>
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
              {Math.min(startIndex + itemsPerPage, filteredCustomers.length)}
            </span>{" "}
            of <span className="text-black font-black">{filteredCustomers.length}</span> customers
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
                      className={`w-10 h-10 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        currentPage === p
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
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CUSTOMER NAME</label>
                  <input
                    type="text"
                    value={CUSTOMER_NAME}
                    onChange={(e) => setCUSTOMER_NAME(e.target.value)}
                    placeholder="Full Company Name"
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

      {/* Excel Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-transparent" onClick={() => !isUploading && setIsExcelModalOpen(false)} />
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl relative w-full max-w-xl animate-in zoom-in-95 duration-300 border border-white/20">
            <button
              onClick={() => setIsExcelModalOpen(false)}
              className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center text-gray-300 hover:text-black hover:bg-gray-50 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-10">
              <div className="w-14 h-14 bg-emerald-50 rounded-[1.25rem] flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-black text-black">Excel Actions</h3>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Update or add customers via Excel</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={downloadCustomersExcel}
                className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] hover:bg-white hover:border-black hover:shadow-xl hover:shadow-black/5 transition-all group gap-4"
              >
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-black group-hover:text-white transition-all">
                  <Download className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-black uppercase tracking-widest">Download Data</p>
                </div>
              </button>

              <label className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] hover:bg-white hover:border-black hover:shadow-xl hover:shadow-black/5 transition-all group gap-4 cursor-pointer relative overflow-hidden">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-black uppercase tracking-widest">{isUploading ? 'Uploading...' : 'Upload Update'}</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Global Message Notification */}
      {message && (
        <div className={`fixed bottom-10 left-[calc(50%+9rem)] -translate-x-1/2 px-8 py-4 rounded-[2rem] shadow-2xl z-[600] flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 border-b-4 ${message.type === 'success' ? 'bg-black text-white border-emerald-500' : 'bg-red-600 text-white border-red-800'
          }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <p className="text-[11px] font-black uppercase tracking-widest leading-none">{message.text}</p>
        </div>
      )}
    </div>
  );
}
