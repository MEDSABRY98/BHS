'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import {
  ReceiptText,
  Send,
  User,
  Users,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileSpreadsheet,
  Download,
  Upload,
  Loader2,
  X
} from 'lucide-react';
import SearchSelect from '../components/DropDownList';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function CreateOrderPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  // Form State for the current entry
  const [formData, setFormData] = useState({
    CREATED_BY: '',
    CUSTOMER_ID: '',
    LPO_ID: '',
    INVOICE_ID: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      const [usersRes, customersRes] = await Promise.all([
        app_lpos_supabase.from('app_lpos_USERS').select('*').order('NAME'),
        app_lpos_supabase.from('app_lpos_CUSTOMERS').select('*').order('CUSTOMER NAME')
      ]);

      const fetchedUsers = usersRes.data || [];
      setUsers(fetchedUsers);
      setCustomers(customersRes.data || []);

      // Auto-set the logged-in user as the Sales Rep by matching NAME
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          const userName = userData.name || userData.NAME;

          if (userName) {
            // Find the corresponding user in the Supabase users table to get their ID
            const dbUser = fetchedUsers.find(u => u.NAME.toLowerCase() === userName.toLowerCase());
            if (dbUser) {
              setFormData(prev => ({ ...prev, CREATED_BY: dbUser.ID }));
            }
          }
        } catch (e) {
          console.error('Error parsing stored user:', e);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const addOrderToList = () => {
    if (!formData.CUSTOMER_ID) {
      setMessage({ type: 'error', text: 'Please select a customer first' });
      return;
    }

    const customer = customers.find(c => c.ID === formData.CUSTOMER_ID);
    const user = users.find(u => u.ID === formData.CREATED_BY);

    const newOrder = {
      ...formData,
      tempId: Math.random().toString(36).substr(2, 9),
      customerName: customer?.["CUSTOMER NAME"],
      userName: user?.NAME || 'Current User'
    };

    setPendingOrders([...pendingOrders, newOrder]);
    // Reset fields but keep Sales Rep
    setFormData(prev => ({
      ...prev,
      CUSTOMER_ID: '',
      LPO_ID: '',
      INVOICE_ID: ''
    }));
    setMessage(null);
  };

  const removeOrderFromList = (tempId: string) => {
    setPendingOrders(pendingOrders.filter(o => o.tempId !== tempId));
  };

  async function generateNextOrderId() {
    const { data } = await app_lpos_supabase
      .from('app_lpos_ORDERS_NO_ITEMS')
      .select('ORDER_ID')
      .order('ORDER_ID', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
      const lastId = data[0].ORDER_ID;
      if (lastId && lastId.startsWith('ONI-')) {
        const lastNum = parseInt(lastId.split('-')[1]);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
    }
    return `ONI-${nextNum.toString().padStart(4, '0')}`;
  }

  const handleSaveAll = async () => {
    if (pendingOrders.length === 0) {
      setMessage({ type: 'error', text: 'Add at least one order to the list' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      // Generate sequential IDs for each order
      const startId = await generateNextOrderId();
      const baseNum = parseInt(startId.split('-')[1]);

      const ordersToInsert = pendingOrders.map(({ tempId, customerName, userName, ...rest }, index) => {
        const currentId = `ONI-${(baseNum + index).toString().padStart(4, '0')}`;
        return {
          ...rest,
          ID: currentId,
          ORDER_ID: currentId
        };
      });

      const { error } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .insert(ordersToInsert);

      if (error) throw error;

      setMessage({ type: 'success', text: `${pendingOrders.length} Orders created successfully!` });
      setPendingOrders([]);
    } catch (err: any) {
      console.error('Submit Error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to create orders' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Customer Name": "Example Customer", "LPO ID": "LPO-001", "Invoice ID": "INV-001" }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders Template");
    XLSX.writeFile(wb, "Orders_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        const newPendingOrders: any[] = [];
        const errors: string[] = [];

        data.forEach((row, index) => {
          const customerName = row["Customer Name"];
          const lpoId = row["LPO ID"];
          const invoiceId = row["Invoice ID"];

          const customer = customers.find(c => 
            c["CUSTOMER NAME"]?.toLowerCase() === customerName?.toString().toLowerCase()
          );

          if (customer) {
            newPendingOrders.push({
              CREATED_BY: formData.CREATED_BY,
              CUSTOMER_ID: customer.ID,
              LPO_ID: lpoId || '',
              INVOICE_ID: invoiceId || '',
              tempId: Math.random().toString(36).substr(2, 9),
              customerName: customer["CUSTOMER NAME"],
              userName: users.find(u => u.ID === formData.CREATED_BY)?.NAME || 'Current User'
            });
          } else {
            errors.push(`Row ${index + 2}: Customer "${customerName}" not found`);
          }
        });

        if (newPendingOrders.length > 0) {
          setPendingOrders(prev => [...prev, ...newPendingOrders]);
          setMessage({ 
            type: errors.length > 0 ? 'error' : 'success', 
            text: `Imported ${newPendingOrders.length} orders. ${errors.length > 0 ? `${errors.length} failed.` : ''}` 
          });
        } else if (errors.length > 0) {
          setMessage({ type: 'error', text: `Import failed: ${errors[0]}` });
        }

        setIsExcelModalOpen(false);
      } catch (err) {
        console.error('Import Error:', err);
        setMessage({ type: 'error', text: 'Failed to parse Excel file' });
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Auto-hide messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">
            Create New Orders
          </h1>
        </div>
        <button
          onClick={() => setIsExcelModalOpen(true)}
          className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-black hover:border-black hover:bg-gray-50 transition-all shadow-sm group"
          title="Excel Actions"
        >
          <FileSpreadsheet className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Input Form Container */}
      <div className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-black/5 border border-gray-100 relative">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] items-end gap-6 w-full">
            {/* 1. Customer Selection */}
            <div className="min-w-0">
              <SearchSelect
                label=""
                options={customers.map(c => ({ id: c.ID, label: c["CUSTOMER NAME"], subLabel: c["CUSTOMER CITY"] }))}
                value={formData.CUSTOMER_ID}
                onChange={(val) => setFormData({ ...formData, CUSTOMER_ID: val })}
                placeholder="Select Customer"
                isLoading={isLoading}
              />
            </div>

            {/* 2. LPO ID Input */}
            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                LPO ID
              </label>
              <input
                type="text"
                placeholder="ID..."
                value={formData.LPO_ID}
                onChange={(e) => setFormData({ ...formData, LPO_ID: e.target.value })}
                className="w-full px-6 h-[68px] bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:bg-white focus:border-black transition-all text-sm font-black text-black truncate"
              />
            </div>

            {/* 3. Invoice ID Input */}
            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Invoice ID
              </label>
              <input
                type="text"
                placeholder="Invoice..."
                value={formData.INVOICE_ID}
                onChange={(e) => setFormData({ ...formData, INVOICE_ID: e.target.value })}
                className="w-full px-6 h-[68px] bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:bg-white focus:border-black transition-all text-sm font-black text-black truncate"
              />
            </div>

            {/* 4. Add Button */}
            <div className="flex flex-col gap-2 w-fit">
              <div className="h-4" /> {/* Spacer to align with labels */}
              <button
                onClick={addOrderToList}
                type="button"
                className="w-[68px] h-[68px] bg-[#D4AF37] text-black rounded-2xl font-black shadow-lg shadow-[#D4AF37]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                title="Add to List"
              >
                <Send className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pending List Table */}
      {pendingOrders.length > 0 && (
        <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-8 px-4">
            <h3 className="text-2xl font-black text-black flex items-center gap-3">
              <Activity className="w-6 h-6 text-[#D4AF37]" />
              Pending Submission ({pendingOrders.length})
            </h3>
            <button
              disabled={isSubmitting}
              onClick={handleSaveAll}
              className={`px-12 py-4 bg-black text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-black/20 hover:bg-gray-900 transition-all flex items-center gap-3 ${isSubmitting ? 'opacity-50' : ''}`}
            >
              {isSubmitting ? 'SAVING...' : 'SAVE ALL ORDERS'} <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
            </button>
          </div>

          <div className="overflow-hidden rounded-[2.5rem] border border-gray-50">
            <table className="w-full text-center">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">LPO ID</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">INVOICE_ID</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingOrders.map((order) => (
                  <tr key={order.tempId} className="hover:bg-gray-50/50 transition-all">
                    <td className="px-8 py-6">
                      <span className="font-black text-black text-sm">{order.customerName}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-bold text-gray-600 text-sm">{order.LPO_ID || '-'}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-bold text-gray-600 text-sm">{order.INVOICE_ID || '-'}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <button
                          onClick={() => removeOrderFromList(order.tempId)}
                          className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white hover:scale-110 transition-all shadow-sm"
                          title="Remove from list"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Excel Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => !isUploading && setIsExcelModalOpen(false)} />
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
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Import orders or download template</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={downloadTemplate}
                className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] hover:bg-white hover:border-black hover:shadow-xl hover:shadow-black/5 transition-all group gap-4"
              >
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-black group-hover:text-white transition-all">
                  <Download className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-black uppercase tracking-widest">Template</p>
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
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-[#D4AF37] group-hover:text-black transition-all">
                  {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-black uppercase tracking-widest">{isUploading ? 'Uploading...' : 'Import Data'}</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Global Message Notification */}
      {message && (
        <div className={`fixed bottom-10 left-[calc(50%+9rem)] -translate-x-1/2 px-8 py-4 rounded-[2rem] shadow-2xl z-[600] flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 border-b-4 ${message.type === 'success' ? 'bg-black text-white border-[#D4AF37]' : 'bg-red-600 text-white border-red-800'
          }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[#D4AF37]" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <p className="text-[11px] font-black uppercase tracking-widest leading-none">{message.text}</p>
        </div>
      )}
    </div>
  );
}
