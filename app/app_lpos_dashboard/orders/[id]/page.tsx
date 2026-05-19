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
  FileSpreadsheet
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { usePermissions } from '../../hooks/usePermissions';
import { generateLpoPackingListPDF } from '@/lib/pdf/LpoPackingListUtils';
import OrderItemsTab from './components/OrderItemsTab';
import OrderPreparationTab from './components/OrderPreparationTab';
import OrderDeliveryTab from './components/OrderDeliveryTab';
import InvoicesStatusTab from './components/InvoicesStatusTab';
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
          app_lpos_CUSTOMERS ( * ),
          bhs_USERS ( "NAME" )
        `)
        .or(`ID.eq.${id},ORDER_ID.eq.${id}`)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('Order not found');

      const noItems = orderData.ORDER_ID?.startsWith('ONI-');
      setIsNoItemsOrder(noItems);

      setIsNoItemsOrder(noItems);

      // 3. Fetch items only for standard orders
      let enrichedItems = [];
      if (!noItems) {
        const { data: itemsData, error: itemsError } = await app_lpos_supabase
          .from('app_lpos_ORDERS_ITEMS')
          .select(`
            *,
            app_lpos_PRODUCTS ( "PRODUCT NAME", "PRODUCT BARCODE" )
          `)
          .eq('ORDER_ID', orderData.ID);

        if (itemsError) throw itemsError;

        const initialItems = itemsData || [];
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
        app_lpos_supabase.from('app_lpos_DRIVERS').select('*').eq('ORDER_ID', orderData.ID).maybeSingle(),
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
      router.push('/app_lpos_dashboard/orders');
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

      router.push('/app_lpos_dashboard/orders');
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
    } catch (err) {
      alert('Error updating order: ' + (err as any).message);
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
    }
  };

  const [activeTab, setActiveTab] = useState('ITEMS');

  // Handle No-Items order tab default
  useEffect(() => {
    if (isNoItemsOrder && activeTab === 'ITEMS') {
      setActiveTab('PREPARATION');
    }
  }, [isNoItemsOrder]);

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
      const customerName = order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"] || '-';

      const exportData: any[] = items.map(item => ({
        'Product': item.app_lpos_PRODUCTS?.["PRODUCT NAME"] || '-',
        'Unit': item.UNIT || item.app_lpos_PRODUCTS?.["PRODUCT UNIT"] || '-',
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
          <h1 className="text-3xl font-normal text-black tracking-tighter">Order Processing</h1>
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
              APPROVE
            </button>
          </div>
        )}
      </div>

      {/* Standalone Customer Name */}
      <div className="px-2 -mt-2 mb-2 text-center">
        <h2 className="text-2xl text-gray-800 font-normal truncate">
          {order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"]}
        </h2>
      </div>

      {/* Customer Info Row - Horizontal */}
      <div className="bg-black rounded-[2.5rem] p-8 text-white shadow-xl shadow-black/20 overflow-hidden">
        <div className="flex items-center justify-center gap-8 overflow-hidden w-full">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">Order ID</p>
              <p className="font-black text-lg text-white">{order.ORDER_ID}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">Created At</p>
              <p className="font-black text-lg text-white">{new Date(order.CREATED_AT).toLocaleDateString('en-GB')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">Order Date</p>
              <p className="font-black text-lg text-white">
                {order.ORDER_DATE ? new Date(order.ORDER_DATE).toLocaleDateString('en-GB') : new Date(order.CREATED_AT).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>

          {order.INVOICE_ID && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <Hash className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">Invoice ID</p>
                <p className="font-black text-lg text-white">{order.INVOICE_ID}</p>
              </div>
            </div>
          )}

          {order.LPO_ID && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <Hash className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">LPO ID</p>
                <p className="font-black text-lg text-white">{order.LPO_ID}</p>
              </div>
            </div>
          )}

          {order.AMOUNT > 0 && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">Amount</p>
                <p className="font-black text-lg text-white">{order.AMOUNT.toLocaleString()} AED</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">Sales Rep</p>
              <p className="font-black text-lg text-white truncate">{order.bhs_USERS?.NAME}</p>
            </div>
          </div>


        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-4 bg-gray-50/50 p-2 rounded-[2rem] border border-gray-100 w-full max-w-4xl mx-auto shadow-inner">
        {!isNoItemsOrder && (
          <button
            onClick={() => setActiveTab('ITEMS')}
            className={`flex-1 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 ${activeTab === 'ITEMS' ? 'bg-black text-[#D4AF37] shadow-xl shadow-black/10' : 'text-gray-400 hover:text-black hover:bg-white'
              }`}
          >
            <Package className="w-4 h-4" />
            Order Items
          </button>
        )}
        <button
          onClick={() => setActiveTab('PREPARATION')}
          className={`flex-1 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 ${activeTab === 'PREPARATION' ? 'bg-black text-[#D4AF37] shadow-xl shadow-black/10' : 'text-gray-400 hover:text-black hover:bg-white'
            }`}
        >
          <Loader2 className={`w-4 h-4 ${activeTab === 'PREPARATION' ? 'animate-spin' : ''}`} />
          Preparation
        </button>
        <button
          onClick={() => setActiveTab('DELIVERY')}
          className={`flex-1 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 ${activeTab === 'DELIVERY' ? 'bg-black text-[#D4AF37] shadow-xl shadow-black/10' : 'text-gray-400 hover:text-black hover:bg-white'
            }`}
        >
          <Printer className="w-4 h-4" />
          Logistics / Delivery
        </button>
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`flex-1 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 ${activeTab === 'INVOICES' ? 'bg-black text-[#D4AF37] shadow-xl shadow-black/10' : 'text-gray-400 hover:text-black hover:bg-white'
            }`}
        >
          <FileText className="w-4 h-4" />
          Invoices Status
        </button>
      </div>

      {/* Active Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'ITEMS' && !isNoItemsOrder && (
          <OrderItemsTab
            items={items}
            canEdit={canEdit}
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
            <OrderDeliveryTab orderId={order.ID} />
          )
        )}

        {activeTab === 'INVOICES' && (
          !isTabsEnabled ? (
            <NoData title="ORDER NOT APPROVED" />
          ) : (
            <InvoicesStatusTab orderId={order.ID} />
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
          readOnly={!canEdit}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder={canEdit ? "Add any internal notes about this order..." : "No notes available"}
          className={`w-full h-32 p-6 bg-gray-50 border border-gray-100 rounded-3xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold placeholder:text-gray-400 resize-none ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
    </div>
  );
}
