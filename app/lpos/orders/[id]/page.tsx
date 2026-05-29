'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { app_lpos_supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Package,
  User,
  Hash,
  Banknote,
  Calendar,
  AlertCircle,
  Loader2,
  Trash2,
  Undo2,
  FileText,
  Printer,
  FileSpreadsheet,
  Edit2,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { usePermissions } from '../../hooks/usePermissions';
import { generateLpoPackingListPDF } from '@/lib/pdf/PackingListUtils';
import OrderItemsTab from '../components/OrderItemsTab';
import OrderPreparationTab from '../components/OrderPreparationTab';
import OrderDeliveryTab from '../components/OrderDeliveryTab';
import InvoicesStatusTab from '../components/InvoicesStatusTab';
import NoData from '@/components/01-Unified/NoDataTab';
import * as XLSX from 'xlsx';

export default function OrderDetailsPage() {
  const { canEdit, canDelete, isLoaded } = usePermissions();
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isNoItemsOrder, setIsNoItemsOrder] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [prepStaff, setPrepStaff] = useState<any[]>([]);
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [allStaff, setAllStaff] = useState<any[]>([]);

  useEffect(() => {
    if (id) fetchOrderDetails();
  }, [id]);

  async function fetchOrderDetails() {
    try {
      const { data: orderData, error: orderError } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .select(`
          *,
          bhs_CUSTOMERS ( * ),
          bhs_USERS ( "NAME" )
        `)
        .or(`ID.eq.${id},ORDER_ID.eq.${id}`)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('Order not found');
      // 3. Fetch items
      const { data: itemsData, error: itemsError } = await app_lpos_supabase
        .from('app_lpos_ORDERS_ITEMS')
        .select(`
          *,
          bhs_PRODUCTS ( "PRODUCT NAME", "PRODUCT BARCODE" )
        `)
        .eq('ORDER_ID', orderData.ID);

      if (itemsError) throw itemsError;

      const initialItems = itemsData || [];
      const noItems = initialItems.length === 0;
      setIsNoItemsOrder(noItems);

      let enrichedItems = [];
      if (!noItems) {
        enrichedItems = initialItems.map((item: any) => ({
          ...item,
          QTY_RECEIVED: (orderData.STATUS === 'Pending' && (!item.QTY_RECEIVED || item.QTY_RECEIVED === 0))
            ? item.QTY_REQUEST
            : item.QTY_RECEIVED
        }));
      }

      // 4. Fetch Logistics & Prep for PDF
      const [prepRes, deliveryRes, staffRes] = await Promise.all([
        app_lpos_supabase.from('app_lpos_PREPARATION').select('*').eq('ORDER_ID', orderData.ID),
        app_lpos_supabase.from('app_lpos_DRIVERS').select('*').eq('ORDER_ID', orderData.ORDER_ID).maybeSingle(),
        app_lpos_supabase.from('bhs_USERS').select('*')
      ]);

      setPrepStaff(prepRes.data || []);
      setDeliveryData(deliveryRes.data);
      setAllStaff(staffRes.data || []);

      setOrder(orderData);
      setItems(enrichedItems);
      setAdminNotes(orderData.NOTES || '');
    } catch (err) {
      console.error(err);
      router.push('/lpos/orders');
    } finally {
      setIsLoading(false);
    }
  }

  const handleQtyChange = (itemId: string, value: string) => {
    setItems(items.map(item =>
      item.ID === itemId ? { ...item, QTY_RECEIVED: value } : item
    ));
  };

  const toggleItemStatus = (itemId: string) => {
    setItems(items.map(item => {
      if (item.ID === itemId) {
        const nextStatus = item.ITEMS_STATUS === 'Rejected' ? 'Pending' : 'Rejected';
        return { ...item, ITEMS_STATUS: nextStatus };
      }
      return item;
    }));
  };

  const confirmStatusUpdate = (status: string) => {
    setPendingStatus(status);
    setIsConfirmOpen(true);
  };

  const handleDeleteOrder = async () => {
    setIsSaving(true);
    try {
      const targetTable = isNoItemsOrder ? 'app_lpos_ORDERS_NO_ITEMS' : 'app_lpos_ORDERS';

      // 1. Delete items if it's a standard order
      if (!isNoItemsOrder) {
        const { error: itemsError } = await app_lpos_supabase
          .from('app_lpos_ORDERS_ITEMS')
          .delete()
          .eq('ORDER_ID', order.ID);

        if (itemsError) throw itemsError;
      }

      // 2. Delete Preparation & Delivery data (common for both types)
      await Promise.all([
        app_lpos_supabase.from('app_lpos_PREPARATION').delete().eq('ORDER_ID', order.ID),
        app_lpos_supabase.from('app_lpos_DRIVERS').delete().eq('ORDER_ID', order.ID)
      ]);

      // 3. Delete the order itself from the main table
      const { error: orderError } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .delete()
        .eq('ID', order.ID);

      if (orderError) throw orderError;

      router.push('/lpos/orders');
    } catch (err) {
      alert('Error deleting order: ' + (err as any).message);
    } finally {
      setIsSaving(false);
      setIsDeleteModalOpen(false);
    }
  };

  const executeUpdateStatus = async () => {
    setIsSaving(true);
    try {
      const targetTable = isNoItemsOrder ? 'app_lpos_ORDERS_NO_ITEMS' : 'app_lpos_ORDERS';
      let statusToSave = pendingStatus;

      if (!isNoItemsOrder) {
        // Prepare updates and determine final order status
        const processedItems = items.map(item => {
          let sentQty = parseFloat(item.QTY_RECEIVED) || 0;
          let itemStatus = item.ITEMS_STATUS;

          if (pendingStatus === 'Rejected') {
            itemStatus = 'Rejected';
            sentQty = 0;
          } else if (itemStatus === 'Rejected' || sentQty === 0 || !item.QTY_RECEIVED) {
            itemStatus = 'Rejected';
            sentQty = 0;
          } else if (pendingStatus === 'Approved') {
            itemStatus = 'Approved';
          }

          return { ...item, finalQty: sentQty, finalStatus: itemStatus };
        });

        if (pendingStatus === 'Approved') {
          const hasApprovedItems = processedItems.some(i => i.finalStatus === 'Approved');
          const hasReducedOrRejected = processedItems.some(i => i.finalStatus === 'Rejected' || i.finalQty < i.QTY_REQUEST);

          if (!hasApprovedItems) {
            statusToSave = 'Rejected';
          } else if (hasReducedOrRejected) {
            statusToSave = 'Partially Approved';
          }
        }

        // 1. Update order status and notes in the main table
        const { error: orderError } = await app_lpos_supabase
          .from('app_lpos_ORDERS')
          .update({ STATUS: statusToSave, NOTES: adminNotes })
          .eq('ID', order.ID);

        if (orderError) throw orderError;

        // 2. Update item quantities and statuses
        for (const item of processedItems) {
          await app_lpos_supabase
            .from('app_lpos_ORDERS_ITEMS')
            .update({
              QTY_RECEIVED: item.finalQty,
              ITEMS_STATUS: item.finalStatus
            })
            .eq('ID', item.ID);
        }
      } else {
        // Direct status update for orders without items
        const { error: orderError } = await app_lpos_supabase
          .from('app_lpos_ORDERS')
          .update({ STATUS: statusToSave, NOTES: adminNotes })
          .eq('ID', order.ID);

        if (orderError) throw orderError;
      }

      await fetchOrderDetails();
      setIsEditingStatus(false);
    } catch (err) {
      alert('Error updating order: ' + (err as any).message);
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
    }
  };

  const [activeTab, setActiveTab] = useState('INFO');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  const totalAmount = items.reduce((sum, item) => {
    if (item.ITEMS_STATUS === 'Rejected') return sum;
    const sentQty = parseFloat(item.QTY_RECEIVED) || 0;
    return sum + (item.PRICE * sentQty);
  }, 0);

  const handlePrintPDF = async (action: 'print' | 'download') => {
    setIsSaving(true);
    try {
      // Re-fetch latest logistics data to ensure PDF is not stale
      const [prepRes, deliveryRes] = await Promise.all([
        app_lpos_supabase.from('app_lpos_PREPARATION').select('*').eq('ORDER_ID', order.ID),
        app_lpos_supabase.from('app_lpos_DRIVERS').select('*').eq('ORDER_ID', order.ID).maybeSingle()
      ]);

      const latestPrep = prepRes.data || [];
      const latestDelivery = deliveryRes.data;

      const getStaffName = (id: string) => {
        return allStaff.find(s => s.ID === id)?.NAME || id;
      };

      const enrichedPrep = latestPrep.map(s => ({
        ...s,
        PREPARATION_NAME: getStaffName(s.PREPARATION_NAME)
      }));

      const enrichedDelivery = latestDelivery ? {
        ...latestDelivery,
        DRIVERS_NAME: getStaffName(latestDelivery.DRIVERS_NAME),
        ASSISTANT_NAME: getStaffName(latestDelivery.ASSISTANT_NAME)
      } : null;

      await generateLpoPackingListPDF(order, items, action, enrichedPrep, enrichedDelivery);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF with latest data');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadExcel = () => {
    try {
      const customerName = order.bhs_CUSTOMERS?.["CUSTOMER NAME"] || '-';

      const exportData: any[] = items.map(item => ({
        'Product': item.bhs_PRODUCTS?.["PRODUCT NAME"] || '-',
        'Unit': item.UNIT || item.bhs_PRODUCTS?.["PRODUCT UNIT"] || '-',
        'Quantity': item.QTY_REQUEST || 0
      }));

      if (exportData.length === 0 && isNoItemsOrder) {
        exportData.push({
          'Product': '-',
          'Unit': '-',
          'Quantity': 0
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Order Details");
      XLSX.writeFile(workbook, `Order_${order.ORDER_ID}_Export.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
      alert('Failed to export Excel');
    }
  };

  const isTabsEnabled = isNoItemsOrder || order?.STATUS === 'Approved' || order?.STATUS === 'Partially Approved';

  return (
    <div className="space-y-8 pb-20">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-normal text-black tracking-tighter">
            Order Processing <span className="text-gray-400 font-light">#{order.ORDER_ID}</span>
          </h1>
          {canDelete && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isSaving}
              className="p-3 bg-white border border-red-100 text-red-500 rounded-2xl hover:bg-red-50 transition-all flex items-center justify-center shadow-sm"
              title="Delete Order"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadExcel}
              disabled={isSaving}
              className="p-4 bg-white border border-green-100 text-green-600 rounded-2xl hover:bg-green-50 transition-all flex items-center justify-center shadow-sm"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
            <button
              onClick={() => handlePrintPDF('print')}
              disabled={isSaving}
              className="p-4 bg-white border border-gray-100 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm"
              title="Print Packing List"
            >
              <Printer className="w-5 h-5 text-blue-500" />
            </button>
            <button
              onClick={() => handlePrintPDF('download')}
              disabled={isSaving}
              className="p-4 bg-white border border-gray-100 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm"
              title="Download PDF"
            >
              <FileText className="w-5 h-5 text-red-500" />
            </button>
            {(order?.STATUS === 'Pending' || isEditingStatus) ? (
              <>
                <button
                  onClick={() => confirmStatusUpdate('Rejected')}
                  disabled={isSaving}
                  className="w-[160px] py-4 bg-white border border-red-100 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  REJECT
                </button>
                <button
                  onClick={() => confirmStatusUpdate('Approved')}
                  disabled={isSaving || (!isNoItemsOrder && !items.some(item => (parseFloat(item.QTY_RECEIVED) || 0) > 0 && item.ITEMS_STATUS !== 'Rejected'))}
                  className={`w-[160px] py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${isSaving || (!isNoItemsOrder && !items.some(item => (parseFloat(item.QTY_RECEIVED) || 0) > 0 && item.ITEMS_STATUS !== 'Rejected'))
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                    : 'bg-black text-[#D4AF37] shadow-black/20 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {order?.STATUS === 'Pending' ? 'APPROVE' : 'CONFIRM'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditingStatus(true)}
                disabled={isSaving}
                className="p-4 bg-white border border-gray-100 text-black rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm"
                title="Edit Status"
              >
                <Edit2 className="w-5 h-5 text-[#D4AF37]" />
              </button>
            )}
          </div>
        )}
      </div>



      {/* Tab Switcher */}
      <div className="flex items-center gap-4 bg-[#D4AF37]/5 backdrop-blur-md p-2 rounded-[2rem] border-2 border-[#D4AF37]/30 w-full max-w-5xl mx-auto shadow-lg shadow-[#D4AF37]/5">
        <button
          onClick={() => setActiveTab('INFO')}
          className={`flex-1 px-6 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 border ${activeTab === 'INFO'
            ? 'bg-black text-[#D4AF37] border-[#D4AF37]/40 shadow-xl shadow-black/10'
            : 'text-gray-400 border-transparent hover:text-black hover:bg-white'
            }`}
        >
          <Info className="w-4 h-4" />
          Order Info
        </button>
        {!isNoItemsOrder && (
          <button
            onClick={() => setActiveTab('ITEMS')}
            className={`flex-1 px-6 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 border ${activeTab === 'ITEMS'
              ? 'bg-black text-[#D4AF37] border-[#D4AF37]/40 shadow-xl shadow-black/10'
              : 'text-gray-400 border-transparent hover:text-black hover:bg-white'
              }`}
          >
            <Package className="w-4 h-4" />
            Order Items
          </button>
        )}
        <button
          onClick={() => setActiveTab('PREPARATION')}
          className={`flex-1 px-6 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 border ${activeTab === 'PREPARATION'
            ? 'bg-black text-[#D4AF37] border-[#D4AF37]/40 shadow-xl shadow-black/10'
            : 'text-gray-400 border-transparent hover:text-black hover:bg-white'
            }`}
        >
          <Loader2 className={`w-4 h-4 ${activeTab === 'PREPARATION' ? 'animate-spin' : ''}`} />
          Preparation
        </button>
        <button
          onClick={() => setActiveTab('DELIVERY')}
          className={`flex-1 px-6 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 border ${activeTab === 'DELIVERY'
            ? 'bg-black text-[#D4AF37] border-[#D4AF37]/40 shadow-xl shadow-black/10'
            : 'text-gray-400 border-transparent hover:text-black hover:bg-white'
            }`}
        >
          <Printer className="w-4 h-4" />
          Logistics / Delivery
        </button>
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`flex-1 px-6 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 border ${activeTab === 'INVOICES'
            ? 'bg-black text-[#D4AF37] border-[#D4AF37]/40 shadow-xl shadow-black/10'
            : 'text-gray-400 border-transparent hover:text-black hover:bg-white'
            }`}
        >
          <FileText className="w-4 h-4" />
          Invoices Status
        </button>
      </div>

      {/* Active Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'INFO' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Grid of details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

              {/* Card: Customer (Spans 2 columns on larger screens) */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Customer</span>
                  <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h4 className="text-xl font-black text-black truncate">{order.bhs_CUSTOMERS?.["CUSTOMER NAME"] || 'None'}</h4>
                  <p className="text-xs font-semibold text-gray-400 mt-1">Customer account name</p>
                </div>
              </div>

              {/* Card: Status */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Order Status</span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${order.STATUS === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                    order.STATUS === 'Partially Approved' ? 'bg-teal-50 text-teal-600' :
                      order.STATUS === 'Rejected' ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-600'
                    }`}>
                    {order.STATUS === 'Approved' && <CheckCircle2 className="w-4 h-4" />}
                    {order.STATUS === 'Partially Approved' && <CheckCircle2 className="w-4 h-4" />}
                    {order.STATUS === 'Rejected' && <XCircle className="w-4 h-4" />}
                    {order.STATUS === 'Pending' && <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                </div>
                <div>
                  <h4 className={`text-xl font-black ${order.STATUS === 'Approved' ? 'text-emerald-600' :
                    order.STATUS === 'Partially Approved' ? 'text-teal-600' :
                      order.STATUS === 'Rejected' ? 'text-red-600' :
                        'text-amber-500'
                    }`}>{order.STATUS}</h4>
                  <p className="text-xs font-semibold text-gray-400 mt-1">Current processing stage</p>
                </div>
              </div>

              {/* Card: Order ID */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Order ID</span>
                  <button
                    onClick={() => handleCopy(order.ORDER_ID, 'order_id')}
                    className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 hover:text-black transition-all"
                    title="Copy ID"
                  >
                    {copiedField === 'order_id' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div>
                  <h4 className="text-xl font-black text-black tracking-tight">{order.ORDER_ID}</h4>
                  <p className="text-xs font-semibold text-gray-400 mt-1">System reference ID</p>
                </div>
              </div>

              {/* Card: Invoice ID */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Invoice ID</span>
                  {order.INVOICE_ID && (
                    <button
                      onClick={() => handleCopy(order.INVOICE_ID, 'invoice_id')}
                      className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 hover:text-black transition-all"
                      title="Copy Invoice ID"
                    >
                      {copiedField === 'invoice_id' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <div>
                  <h4 className="text-xl font-black text-black tracking-tight">{order.INVOICE_ID || 'Not Available'}</h4>
                  <p className="text-xs font-semibold text-gray-400 mt-1">Invoice tracking code</p>
                </div>
              </div>

              {/* Card: LPO ID */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">LPO ID</span>
                  {order.LPO_ID && (
                    <button
                      onClick={() => handleCopy(order.LPO_ID, 'lpo_id')}
                      className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 hover:text-black transition-all"
                      title="Copy LPO ID"
                    >
                      {copiedField === 'lpo_id' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <div>
                  <h4 className="text-xl font-black text-black tracking-tight">{order.LPO_ID || 'Not Available'}</h4>
                  <p className="text-xs font-semibold text-gray-400 mt-1">Local Purchase Order ID</p>
                </div>
              </div>

              {/* Card: Created At */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Created At</span>
                  <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-black text-black">{new Date(order.CREATED_AT).toLocaleString('en-GB')}</h4>
                  <p className="text-xs font-semibold text-gray-400 mt-1">System registration timestamp</p>
                </div>
              </div>

              {/* Card: Order Date */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Order Date</span>
                  <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-black text-black">
                    {order.ORDER_DATE ? new Date(order.ORDER_DATE).toLocaleDateString('en-GB') : new Date(order.CREATED_AT).toLocaleDateString('en-GB')}
                  </h4>
                  <p className="text-xs font-semibold text-gray-400 mt-1">Requested delivery/order date</p>
                </div>
              </div>

              {/* Card: Total Amount */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Amount</span>
                  <div className="w-8 h-8 rounded-xl bg-gray-50 text-[#D4AF37] flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h4 className="text-xl font-black text-black">
                    <span className="text-[#D4AF37]">{order.AMOUNT ? order.AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span> <span className="text-xs text-gray-500 font-bold">AED</span>
                  </h4>
                  <p className="text-xs font-semibold text-gray-400 mt-1">Calculated order value</p>
                </div>
              </div>

              {/* Card: Sales Rep */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Sales Rep</span>
                  <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-black text-black truncate">{order.bhs_USERS?.NAME || 'None'}</h4>
                  <p className="text-xs font-semibold text-gray-400 mt-1">Responsible account manager</p>
                </div>
              </div>

            </div>
          </div>
        )}
        {activeTab === 'ITEMS' && !isNoItemsOrder && (
          <OrderItemsTab
            items={items}
            canEdit={canEdit && (order?.STATUS === 'Pending' || isEditingStatus)}
            totalAmount={totalAmount}
            toggleItemStatus={toggleItemStatus}
            handleQtyChange={handleQtyChange}
          />
        )}

        {activeTab === 'PREPARATION' && (
          !isTabsEnabled ? (
            <NoData title="ORDER NOT APPROVED" />
          ) : (
            <OrderPreparationTab orderId={order.ID} />
          )
        )}

        {activeTab === 'DELIVERY' && (
          !isTabsEnabled ? (
            <NoData title="ORDER NOT APPROVED" />
          ) : (
            <OrderDeliveryTab orderId={order.ORDER_ID} />
          )
        )}

        {activeTab === 'INVOICES' && (
          !isTabsEnabled ? (
            <NoData title="ORDER NOT APPROVED" />
          ) : (
            <InvoicesStatusTab orderId={order.ORDER_ID} />
          )
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onConfirm={executeUpdateStatus}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isSaving}
        title={pendingStatus === 'Rejected' ? 'Confirm Rejection' : 'Confirm Order Update'}
        message={`Are you sure you want to ${pendingStatus === 'Rejected' ? 'reject' : 'save and finalize'} this order?`}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onConfirm={handleDeleteOrder}
        onCancel={() => setIsDeleteModalOpen(false)}
        title="Delete Order"
        message="Are you sure you want to permanently delete this order? This action cannot be undone."
        isLoading={isSaving}
      />

      {/* Admin Notes at the End */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
        <h3 className="text-xl font-black mb-6 text-black">Admin Notes</h3>
        <textarea
          value={adminNotes}
          readOnly={!canEdit || (order?.STATUS !== 'Pending' && !isEditingStatus)}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder={canEdit && (order?.STATUS === 'Pending' || isEditingStatus) ? "Add any internal notes about this order..." : "No notes available"}
          className={`w-full h-32 p-6 bg-gray-50 border border-gray-100 rounded-3xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold placeholder:text-gray-400 resize-none ${!canEdit || (order?.STATUS !== 'Pending' && !isEditingStatus) ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
    </div>
  );
}
