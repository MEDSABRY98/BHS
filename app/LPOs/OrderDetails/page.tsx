'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { bhs_supabas } from '@/lib/supabase';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Package,
  Loader2,
  Trash2,
  FileText,
  Printer,
  FileSpreadsheet,
  Edit2,
  Info,
  Save,
  X,
} from 'lucide-react';
import { ConfirmModal } from '../Components/ConfirmModal';
import { usePermissions } from '../Hooks/usePermissions';
import OrderItemsTab from './Components/OrderItemsTab';
import OrderInfoTab, { OrderInfoTabHandle } from './Components/OrderInfoTab';

import OrderDeliveryTab from './Components/OrderDeliveryTab';
import InvoicesStatusTab from './Components/InvoicesStatusTab';
import NoData from '@/app/Components/NoDataTab';
import * as XLSX from 'xlsx';

function OrderDetailsPageContent() {
  const { canEdit, canDelete, isLoaded } = usePermissions();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
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
  const [isEditingOrderInfo, setIsEditingOrderInfo] = useState(false);
  const [orderInfoSaving, setOrderInfoSaving] = useState(false);
  const [orderInfoLoadingOptions, setOrderInfoLoadingOptions] = useState(false);
  const orderInfoRef = useRef<OrderInfoTabHandle>(null);
  const [pendingStatus, setPendingStatus] = useState('');
  const [activeTab, setActiveTab] = useState('INFO');

  const handleOrderInfoActionState = useCallback((state: { isSaving: boolean; isLoadingOptions: boolean }) => {
    setOrderInfoSaving(state.isSaving);
    setOrderInfoLoadingOptions(state.isLoadingOptions);
  }, []);

  useEffect(() => {
    if (id) fetchOrderDetails();
  }, [id]);

  async function fetchOrderDetails() {
    try {
      const { data: orderData, error: orderError } = await bhs_supabas
        .from('app_lpos_ORDERS')
        .select(`
          *,
          bhs_CUSTOMERS ( *, "CUSTOMER NAME":"CUSTOMER SUB NAME" ),
          bhs_USERS ( "NAME" )
        `)
        .or(`ID.eq.${id},ORDER_ID.eq.${id}`)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('Order not found');
      const initialItems: any[] = [];
      const noItems = true;
      setIsNoItemsOrder(noItems);

      let enrichedItems: any[] = [];

      setOrder(orderData);
      setItems(enrichedItems);
      setAdminNotes(orderData.NOTES || '');
    } catch (err) {
      console.error(err);
      router.push('/LPOs/Orders');
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

      // 1. Delete Delivery data (common for both types)
      await Promise.all([
        bhs_supabas.from('app_lpos_DRIVERS').delete().eq('ORDER_ID', order.ID)
      ]);

      // 3. Delete the order itself from the main table
      const { error: orderError } = await bhs_supabas
        .from('app_lpos_ORDERS')
        .delete()
        .eq('ID', order.ID);

      if (orderError) throw orderError;

      router.push('/LPOs/Orders');
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

      // Removed items logic
      // Direct status update for orders without items
      const { error: orderError } = await bhs_supabas
        .from('app_lpos_ORDERS')
        .update({ STATUS: statusToSave, NOTES: adminNotes })
        .eq('ID', order.ID);

      if (orderError) throw orderError;

      await fetchOrderDetails();
      setIsEditingStatus(false);
    } catch (err) {
      alert('Error updating order: ' + (err as any).message);
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
    }
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

  const handleStartEditOrderInfo = () => {
    setActiveTab('INFO');
    setIsEditingOrderInfo(true);
  };

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
            {(order?.STATUS === 'Pending' || isEditingStatus) && !isEditingOrderInfo ? (
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
            ) : isEditingOrderInfo ? (
              <>
                <button
                  onClick={() => orderInfoRef.current?.cancel()}
                  disabled={orderInfoSaving}
                  className="p-4 bg-white border border-gray-100 text-gray-600 rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm"
                  title="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => orderInfoRef.current?.save()}
                  disabled={orderInfoSaving || orderInfoLoadingOptions}
                  className="p-4 bg-black border border-black text-[#D4AF37] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center shadow-xl shadow-black/20 disabled:opacity-50"
                  title="Save Changes"
                >
                  {orderInfoSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <button
                onClick={handleStartEditOrderInfo}
                disabled={isSaving}
                className="p-4 bg-white border border-gray-100 text-black rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm"
                title="Edit Order Info"
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
          <OrderInfoTab
            ref={orderInfoRef}
            order={order}
            isEditing={isEditingOrderInfo}
            onEditingChange={setIsEditingOrderInfo}
            onOrderUpdated={fetchOrderDetails}
            onActionStateChange={handleOrderInfoActionState}
          />
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
            <InvoicesStatusTab orderId={order.ORDER_ID} order={order} />
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

export default function OrderDetailsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    }>
      <OrderDetailsPageContent />
    </Suspense>
  );
}
