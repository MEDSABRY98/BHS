'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
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
  X,
  Calendar
} from 'lucide-react';
import SearchSelect from '../Components/DropDownList';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { toast } from '@/components/01-Unified/Notification';

export default function CreateOrderPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [excelActionType, setExcelActionType] = useState<'import' | 'update'>('import');

  // Form State
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  // Form State for the current entry
  const [formData, setFormData] = useState({
    CREATED_BY: '',
    CUSTOMER_ID: '',
    LPO_ID: '',
    INVOICE_ID: '',
    AMOUNT: '',
    DRIVER_ID: '',
    ORDER_DATE: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      const [usersRes, customersRes] = await Promise.all([
        app_lpos_supabase.from('bhs_USERS').select('*').order('NAME'),
        app_lpos_supabase.from('bhs_CUSTOMERS').select('*, "CUSTOMER NAME":"CUSTOMER SUB NAME"').order('CUSTOMER SUB NAME')
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

  const addOrderToList = async () => {
    if (!formData.CUSTOMER_ID) {
      toast.error('Please select a customer first');
      return;
    }

    if (!formData.AMOUNT || parseFloat(formData.AMOUNT) <= 0) {
      toast.error('Please enter a valid order amount');
      return;
    }

    if (!formData.LPO_ID && !formData.INVOICE_ID) {
      toast.error('Please enter either LPO ID or Invoice ID');
      return;
    }

    // 1. Validation for duplicate Invoice ID
    if (formData.INVOICE_ID) {
      const trimmedInvoice = formData.INVOICE_ID.trim();
      const invoiceLower = trimmedInvoice.toLowerCase();

      // Check current pending list
      const isDuplicateInPending = pendingOrders.some(
        o => o.INVOICE_ID && o.INVOICE_ID.trim().toLowerCase() === invoiceLower
      );
      if (isDuplicateInPending) {
        toast.error(`Invoice ID "${trimmedInvoice}" is already in the pending list`);
        return;
      }

      // Check Supabase database
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .select('ORDER_ID')
        .eq('INVOICE_ID', trimmedInvoice)
        .limit(1);

      if (data && data.length > 0) {
        toast.error(`Invoice ID "${trimmedInvoice}" already exists in Order ${data[0].ORDER_ID}`);
        return;
      }
    }

    const customer = customers.find(c => c.ID === formData.CUSTOMER_ID);
    const user = users.find(u => u.ID === formData.CREATED_BY);
    const matchedDriver = users.find(u => u.ID === formData.DRIVER_ID);

    const newOrder = {
      ...formData,
      tempId: Math.random().toString(36).substr(2, 9),
      customerName: customer?.["CUSTOMER NAME"],
      userName: user?.NAME || 'Current User',
      driverId: formData.DRIVER_ID || null,
      driverName: matchedDriver?.NAME || ''
    };

    setPendingOrders([...pendingOrders, newOrder]);
    // Reset fields but keep Sales Rep
    setFormData(prev => ({
      ...prev,
      CUSTOMER_ID: '',
      LPO_ID: '',
      INVOICE_ID: '',
      AMOUNT: '',
      DRIVER_ID: '',
      ORDER_DATE: ''
    }));
  };

  const removeOrderFromList = (tempId: string) => {
    setPendingOrders(pendingOrders.filter(o => o.tempId !== tempId));
  };

  async function generateNextOrderId() {
    const { data } = await app_lpos_supabase
      .from('app_lpos_ORDERS')
      .select('ID');

    let highestNum = 0;
    if (data && data.length > 0) {
      data.forEach(row => {
        const lastId = row.ID;
        if (lastId) {
          const parts = lastId.split('-');
          const num = parseInt(parts[parts.length - 1]);
          if (!isNaN(num) && num > highestNum) {
            highestNum = num;
          }
        }
      });
    }
    const nextNum = highestNum + 1;
    return `R-${nextNum.toString().padStart(4, '0')}`;
  }

  async function generateNextDriverId() {
    const { data } = await app_lpos_supabase
      .from('app_lpos_DRIVERS')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
      const lastId = data[0].ID;
      if (lastId && lastId.startsWith('R-')) {
        const lastNum = parseInt(lastId.split('-')[1]);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
    }
    return `R-${nextNum.toString().padStart(4, '0')}`;
  }

  const handleSaveAll = async () => {
    if (pendingOrders.length === 0) {
      toast.error('Add at least one order to the list');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate sequential IDs for each order
      const startId = await generateNextOrderId();
      const baseNum = parseInt(startId.split('-')[1]);

      const tempIdToOrderId: Record<string, string> = {};
      const ordersToInsert = pendingOrders.map(({ tempId, customerName, userName, driverId, driverName, DRIVER_ID, ...rest }, index) => {
        const currentPkId = `R-${(baseNum + index).toString().padStart(4, '0')}`;
        const currentOrderId = `ONI-${(baseNum + index).toString().padStart(4, '0')}`;
        tempIdToOrderId[tempId] = currentOrderId;

        const orderDateVal = rest.ORDER_DATE
          ? new Date(rest.ORDER_DATE).toISOString()
          : new Date().toISOString();

        return {
          ...rest,
          ID: currentPkId,
          ORDER_ID: currentOrderId,
          AMOUNT: parseFloat(rest.AMOUNT) || 0,
          ORDER_DATE: orderDateVal,
          STATUS: 'Approved'
        };
      });

      const { error: orderError } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .insert(ordersToInsert);

      if (orderError) throw orderError;

      // Insert drivers for those who have a driver assigned
      const ordersWithDrivers = pendingOrders.filter(o => o.driverId);
      if (ordersWithDrivers.length > 0) {
        const startDriverId = await generateNextDriverId();
        const baseDriverNum = parseInt(startDriverId.split('-')[1]);

        const driversToInsert = ordersWithDrivers.map((order, index) => {
          const currentDriverId = `R-${(baseDriverNum + index).toString().padStart(4, '0')}`;
          return {
            ID: currentDriverId,
            ORDER_ID: tempIdToOrderId[order.tempId],
            DRIVERS_NAME: order.driverId,
            STATUS: 'Dispatched',
            DISPATCH_TIME: new Date().toISOString()
          };
        });

        const { error: driverError } = await app_lpos_supabase
          .from('app_lpos_DRIVERS')
          .insert(driversToInsert);

        if (driverError) throw driverError;
      }

      toast.success(`${pendingOrders.length} Orders created successfully!`);
      setPendingOrders([]);
    } catch (err: any) {
      console.error('Submit Error:', err);
      toast.error(err.message || 'Failed to create orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Order Date": "2026-05-18",
        "LPO ID": "LPO-001",
        "Invoice ID": "INV-001",
        "Driver": "Driver Name",
        "Customer Name": "Example Customer",
        "Amount": 1500.50
      }
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
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        const newPendingOrders: any[] = [];
        const errors: string[] = [];

        // 1. Get all unique non-empty Invoice IDs from the uploaded excel data to check database
        const uploadedInvoiceIds: string[] = data
          .map(row => row["Invoice ID"]?.toString().trim())
          .filter(Boolean);

        // Fetch existing Invoice IDs from the database to prevent duplicates
        let dbExistingInvoices: Record<string, string> = {}; // invoice_id -> order_id
        if (uploadedInvoiceIds.length > 0) {
          const { data: dbOrders, error: dbError } = await app_lpos_supabase
            .from('app_lpos_ORDERS')
            .select('ORDER_ID, INVOICE_ID')
            .in('INVOICE_ID', uploadedInvoiceIds);

          if (!dbError && dbOrders) {
            dbOrders.forEach(row => {
              if (row.INVOICE_ID && row.ORDER_ID) {
                dbExistingInvoices[row.INVOICE_ID.trim().toLowerCase()] = row.ORDER_ID;
              }
            });
          }
        }

        // 2. Keep track of duplicates seen in this Excel sheet and current pending orders list
        const sheetInvoicesSeen = new Set<string>();
        const pendingInvoicesSeen = new Set<string>(
          pendingOrders.map(o => o.INVOICE_ID?.trim().toLowerCase()).filter(Boolean)
        );

        data.forEach((row, index) => {
          const customerName = row["Customer Name"];
          const lpoId = row["LPO ID"];
          const invoiceId = row["Invoice ID"]?.toString().trim();
          const driverName = row["Driver"];

          // Check if invoice ID is duplicate
          if (invoiceId) {
            const invoiceLower = invoiceId.toLowerCase();

            // Check database
            if (dbExistingInvoices[invoiceLower]) {
              errors.push(`Row ${index + 2}: Invoice ID "${invoiceId}" already exists in database (Order ${dbExistingInvoices[invoiceLower]})`);
              return;
            }

            // Check current pending list
            if (pendingInvoicesSeen.has(invoiceLower)) {
              errors.push(`Row ${index + 2}: Invoice ID "${invoiceId}" is already in the pending list`);
              return;
            }

            // Check within this Excel file
            if (sheetInvoicesSeen.has(invoiceLower)) {
              errors.push(`Row ${index + 2}: Duplicate Invoice ID "${invoiceId}" inside the Excel sheet`);
              return;
            }

            sheetInvoicesSeen.add(invoiceLower);
          }

          const customer = customers.find(c =>
            c["CUSTOMER NAME"]?.toLowerCase() === customerName?.toString().toLowerCase()
          );

          if (customer) {
            const hasAmount = row["Amount"] && parseFloat(row["Amount"]) > 0;
            const hasId = lpoId || invoiceId;

            if (hasAmount && hasId) {
              let driverId = null;
              let matchedDriverName = '';

              if (driverName) {
                const matchedStaff = users.find(u =>
                  u.NAME?.toLowerCase() === driverName?.toString().trim().toLowerCase()
                );
                if (matchedStaff) {
                  driverId = matchedStaff.ID;
                  matchedDriverName = matchedStaff.NAME;
                } else {
                  errors.push(`Row ${index + 2}: Driver "${driverName}" not found in users list`);
                  return;
                }
              }

              // Convert Excel serial date or string to Date format
              let parsedOrderDate = '';
              if (row["Order Date"]) {
                try {
                  const rawDate = row["Order Date"];
                  if (typeof rawDate === 'number') {
                    const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
                    parsedOrderDate = dateObj.toISOString().split('T')[0];
                  } else {
                    const dateObj = new Date(rawDate.toString().trim());
                    if (!isNaN(dateObj.getTime())) {
                      parsedOrderDate = dateObj.toISOString().split('T')[0];
                    }
                  }
                } catch (e) {
                  console.error('Error parsing excel date', e);
                }
              }

              newPendingOrders.push({
                CREATED_BY: formData.CREATED_BY,
                CUSTOMER_ID: customer.ID,
                LPO_ID: lpoId || '',
                INVOICE_ID: invoiceId || '',
                AMOUNT: row["Amount"] || 0,
                tempId: Math.random().toString(36).substr(2, 9),
                customerName: customer["CUSTOMER NAME"],
                userName: users.find(u => u.ID === formData.CREATED_BY)?.NAME || 'Current User',
                driverId: driverId,
                driverName: matchedDriverName,
                ORDER_DATE: parsedOrderDate
              });
            } else {
              errors.push(`Row ${index + 2}: Amount and at least one ID (LPO or Invoice) are required`);
            }
          } else {
            errors.push(`Row ${index + 2}: Customer "${customerName}" not found`);
          }
        });

        if (newPendingOrders.length > 0) {
          setPendingOrders(prev => [...prev, ...newPendingOrders]);
          if (errors.length > 0) {
            toast.warning(`Imported ${newPendingOrders.length} orders. ${errors.length} failed.`);
          } else {
            toast.success(`Imported ${newPendingOrders.length} orders successfully.`);
          }
        } else if (errors.length > 0) {
          toast.error(`Import failed: ${errors[0]}`);
        }

        setIsExcelModalOpen(false);
      } catch (err) {
        console.error('Import Error:', err);
        toast.error('Failed to parse Excel file');
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadUpdateTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Order Date": "2026-05-18", "Invoice ID": "INV-001", "LPO ID": "LPO-100", "Customer Name": "Example Customer", "Amount": 1500.50 }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Update Template");
    XLSX.writeFile(wb, "Orders_Update_Template.xlsx");
  };

  const handleUpdateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        let updatedCount = 0;
        const errors: string[] = [];

        for (let index = 0; index < data.length; index++) {
          const row = data[index];
          const invoiceId = row["Invoice ID"]?.toString().trim();
          const lpoId = row["LPO ID"]?.toString().trim();
          const customerName = row["Customer Name"]?.toString().trim();
          const amount = row["Amount"];

          if (!invoiceId) {
            errors.push(`Row ${index + 2}: Invoice ID is required`);
            continue;
          }

          // Check if this invoice ID exists in database
          const { data: dbOrders, error: findError } = await app_lpos_supabase
            .from('app_lpos_ORDERS')
            .select('ORDER_ID')
            .eq('INVOICE_ID', invoiceId)
            .limit(1);

          if (findError || !dbOrders || dbOrders.length === 0) {
            errors.push(`Row ${index + 2}: Invoice ID "${invoiceId}" not found in database`);
            continue;
          }

          const orderId = dbOrders[0].ORDER_ID;
          const updatePayload: any = {};

          // Validate and parse Order Date if provided
          const rawDate = row["Order Date"] || row["Date"];
          if (rawDate !== undefined && rawDate !== null && rawDate !== '') {
            try {
              let parsedOrderDate = '';
              if (typeof rawDate === 'number') {
                const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
                parsedOrderDate = dateObj.toISOString();
              } else {
                const dateObj = new Date(rawDate.toString().trim());
                if (!isNaN(dateObj.getTime())) {
                  parsedOrderDate = dateObj.toISOString();
                }
              }
              if (parsedOrderDate) {
                updatePayload.ORDER_DATE = parsedOrderDate;
              } else {
                errors.push(`Row ${index + 2}: Invalid date "${rawDate}"`);
                continue;
              }
            } catch (e) {
              errors.push(`Row ${index + 2}: Error parsing date "${rawDate}"`);
              continue;
            }
          }

          // Validate and parse amount if provided
          if (amount !== undefined && amount !== null && amount !== '') {
            const parsedAmount = parseFloat(amount);
            if (!isNaN(parsedAmount) && parsedAmount >= 0) {
              updatePayload.AMOUNT = parsedAmount;
            } else {
              errors.push(`Row ${index + 2}: Invalid amount "${amount}"`);
              continue;
            }
          }

          // LPO ID if provided
          if (lpoId !== undefined && lpoId !== null) {
            updatePayload.LPO_ID = lpoId || null;
          }

          // Validate and match Customer Name if provided
          if (customerName) {
            const matchedCustomer = customers.find(c =>
              c["CUSTOMER NAME"]?.toLowerCase() === customerName.toLowerCase()
            );
            if (matchedCustomer) {
              updatePayload.CUSTOMER_ID = matchedCustomer.ID;
            } else {
              errors.push(`Row ${index + 2}: Customer "${customerName}" not found in customers list`);
              continue;
            }
          }

          // Perform database update
          if (Object.keys(updatePayload).length > 0) {
            const { error: updateErr } = await app_lpos_supabase
              .from('app_lpos_ORDERS')
              .update(updatePayload)
              .eq('ORDER_ID', orderId);

            if (updateErr) {
              errors.push(`Row ${index + 2}: Failed to update Order ${orderId}: ${updateErr.message}`);
            } else {
              updatedCount++;
            }
          } else {
            errors.push(`Row ${index + 2}: Nothing to update`);
          }
        }

        if (updatedCount > 0) {
          if (errors.length > 0) {
            toast.warning(`Successfully updated ${updatedCount} orders. ${errors.length} failed.`);
          } else {
            toast.success(`Successfully updated ${updatedCount} orders.`);
          }
        } else if (errors.length > 0) {
          toast.error(`Update failed: ${errors[0]}`);
        }

        setIsExcelModalOpen(false);
      } catch (err) {
        console.error('Update Error:', err);
        toast.error('Failed to update via Excel');
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

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
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_2.5fr_1.1fr_1.1fr_0.9fr_1.4fr_auto] items-end gap-6 w-full">
            {/* 3d. Order Date Input (Optional) */}
            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <Calendar className="w-3 h-3 text-[#D4AF37]" />
                Order Date
              </label>
              <input
                type="date"
                value={formData.ORDER_DATE}
                onChange={(e) => setFormData({ ...formData, ORDER_DATE: e.target.value })}
                className="w-full px-6 h-[68px] bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:bg-white focus:border-black transition-all text-sm font-bold text-black"
              />
            </div>

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

            {/* 3b. Amount Input */}
            <div className="flex flex-col gap-2 min-w-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 text-[#D4AF37]">
                <Activity className="w-3 h-3" />
                AMOUNT
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.AMOUNT}
                onChange={(e) => setFormData({ ...formData, AMOUNT: e.target.value })}
                className="w-full px-6 h-[68px] bg-amber-50/30 border border-[#D4AF37]/20 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10 focus:bg-white focus:border-[#D4AF37] transition-all text-sm font-black text-black"
              />
            </div>

            {/* 3c. Driver Selection */}
            <div className="min-w-0">
              <SearchSelect
                label=""
                options={users.filter(u => u.USER_TYPE === 'Driver').map(u => ({ id: u.ID, label: u.NAME }))}
                value={formData.DRIVER_ID}
                onChange={(val) => setFormData({ ...formData, DRIVER_ID: val })}
                placeholder="Driver"
                isLoading={isLoading}
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
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Order Date</th>
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">LPO ID</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">INVOICE_ID</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">AMOUNT</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Driver</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingOrders.map((order) => (
                  <tr key={order.tempId} className="hover:bg-gray-50/50 transition-all">
                    <td className="px-8 py-6">
                      <span className="font-bold text-gray-600 text-sm">{order.ORDER_DATE ? new Date(order.ORDER_DATE).toLocaleDateString('en-GB') : 'Today'}</span>
                    </td>
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
                      <span className="font-black text-black text-sm">{parseFloat(order.AMOUNT).toLocaleString()} AED</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-bold text-gray-600 text-sm">{order.driverName || '-'}</span>
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
            <div className="mb-8">
              <div className="w-14 h-14 bg-emerald-50 rounded-[1.25rem] flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-black text-black">Excel Actions</h3>
            </div>
            {/* Tab Bar Selector */}
            {/* Tab Bar Selector (Segmented Pill Switcher) */}
            <div className="flex w-full bg-gray-50 border border-gray-100 p-1.5 rounded-[1.5rem] mb-8">
              <button
                type="button"
                onClick={() => setExcelActionType('import')}
                className={`flex-1 text-center py-3.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-[1.25rem] ${excelActionType === 'import'
                  ? 'bg-white text-black shadow-lg shadow-black/5 border border-gray-100/50'
                  : 'text-gray-400 hover:text-black'
                  }`}
              >
                Import New Orders
              </button>
              <button
                type="button"
                onClick={() => setExcelActionType('update')}
                className={`flex-1 text-center py-3.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-[1.25rem] ${excelActionType === 'update'
                  ? 'bg-white text-black shadow-lg shadow-black/5 border border-gray-100/50'
                  : 'text-gray-400 hover:text-black'
                  }`}
              >
                Update Details
              </button>
            </div>

            {excelActionType === 'import' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] hover:bg-white hover:border-black hover:shadow-xl hover:shadow-black/5 transition-all group gap-4"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-black group-hover:text-white transition-all">
                    <Download className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-black uppercase tracking-widest">Download Template</p>
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
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                <button
                  type="button"
                  onClick={downloadUpdateTemplate}
                  className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] hover:bg-white hover:border-black hover:shadow-xl hover:shadow-black/5 transition-all group gap-4"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-black group-hover:text-white transition-all">
                    <Download className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-black uppercase tracking-widest">Update Template</p>
                  </div>
                </button>

                <label className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] hover:bg-white hover:border-black hover:shadow-xl hover:shadow-black/5 transition-all group gap-4 cursor-pointer relative overflow-hidden">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleUpdateFileUpload}
                    disabled={isUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-[#D4AF37] group-hover:text-black transition-all">
                    {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-black uppercase tracking-widest">{isUploading ? 'Updating...' : 'Update Data'}</p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Message Notification */}
      {false && (
        <div className="fixed bottom-10 left-[calc(50%+9rem)] -translate-x-1/2 px-8 py-4 rounded-[2rem] shadow-2xl z-[600] flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 border-b-4 bg-black text-white border-[#D4AF37]">
          {true ? (
            <CheckCircle2 className="w-5 h-5 text-[#D4AF37]" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <p className="text-[11px] font-black uppercase tracking-widest leading-none"></p>
        </div>
      )}
    </div>
  );
}
