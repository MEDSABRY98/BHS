'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { bhs_supabas } from '@/lib/secureDb';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  FileSpreadsheet,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { ConfirmModal } from '../Components/ConfirmModal';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { usePermissions } from '../Hooks/usePermissions';
import OrderDetailsTab, { OrderDetailsTabHandle } from './Components/OrderDetailsTab';
import { exportInvoicesTrackingExcel } from '../Export/ExcelExport';
import { useInvoicesTrackingOrderDetailsTabAudit } from '@/app/Audit/Model/InvoicesTrackingTabAudit';

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
  const orderInfoRef = useRef<OrderDetailsTabHandle>(null);
  const [pendingStatus, setPendingStatus] = useState('');
  // one tab only (order details + driver + invoice status)
  useInvoicesTrackingOrderDetailsTabAudit('INFO');

  const handleOrderInfoActionState = useCallback((state: { isSaving: boolean; isLoadingOptions: boolean }) => {
    setOrderInfoSaving(state.isSaving);
    setOrderInfoLoadingOptions(state.isLoadingOptions);
  }, []);

  useEffect(() => {
    if (id) fetchOrderDetails();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const onRefresh = () => {
      void fetchOrderDetails(true);
    };
    window.addEventListener('lpo-data-refresh', onRefresh);
    return () => window.removeEventListener('lpo-data-refresh', onRefresh);
  }, [id]);

  async function fetchOrderDetails(silent = false) {
    try {
      const { data: orderData, error: orderError } = await bhs_supabas
        .from('app_INVOICES_TRACKING_ORDERS')
        .select(`
          *,
          bhs_CUSTOMERS ( *, "CUSTOMER NAME":"CUSTOMER SUB NAME" )
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
      if (!silent) router.push('/InvoicesTracking/Orders');
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

      // 1. Delete Delivery data (common for both types)
      await Promise.all([
        bhs_supabas.from('app_INVOICES_TRACKING_DRIVERS').delete().eq('ORDER_ID', order.ID)
      ]);

      // 3. Delete the order itself from the main table
      const { error: orderError } = await bhs_supabas
        .from('app_INVOICES_TRACKING_ORDERS')
        .delete()
        .eq('ID', order.ID);

      if (orderError) throw orderError;

      router.push('/InvoicesTracking/Orders');
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
      let statusToSave = pendingStatus;

      // Removed items logic
      // Direct status update for orders without items
      const { error: orderError } = await bhs_supabas
        .from('app_INVOICES_TRACKING_ORDERS')
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
    return <TabLoader />;
  }

  const totalAmount = items.reduce((sum, item) => {
    if (item.ITEMS_STATUS === 'Rejected') return sum;
    const sentQty = parseFloat(item.QTY_RECEIVED) || 0;
    return sum + (item.PRICE * sentQty);
  }, 0);

  const handleDownloadExcel = async () => {
    try {
      const exportData: Record<string, unknown>[] = items.map(item => ({
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

      await exportInvoicesTrackingExcel(exportData, `Order_${order.ORDER_ID}_Export`, {
        sheetName: 'Order Details',
        numericColumns: ['Quantity'],
      });
    } catch (err) {
      console.error('Excel Export Error:', err);
      alert('Failed to export Excel');
    }
  };

  const isTabsEnabled = isNoItemsOrder || order?.STATUS === 'Approved' || order?.STATUS === 'Partially Approved';

  const handleStartEditOrderInfo = () => {
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
                  onClick={() => orderInfoRef.current?.save(adminNotes)}
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



      <OrderDetailsTab
        ref={orderInfoRef}
        order={order}
        isApproved={isTabsEnabled}
        canEdit={canEdit}
        isEditing={isEditingOrderInfo}
        onEditingChange={setIsEditingOrderInfo}
        onOrderUpdated={fetchOrderDetails}
        onActionStateChange={handleOrderInfoActionState}
      />

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
          readOnly={!canEdit || (order?.STATUS !== 'Pending' && !isEditingStatus && !isEditingOrderInfo)}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder={canEdit && (order?.STATUS === 'Pending' || isEditingStatus || isEditingOrderInfo) ? "Add any internal notes about this order..." : "No notes available"}
          className={`w-full h-32 p-6 bg-gray-50 border border-gray-100 rounded-3xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold placeholder:text-gray-400 resize-none ${!canEdit || (order?.STATUS !== 'Pending' && !isEditingStatus && !isEditingOrderInfo) ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
    </div>
  );
}

export default function OrderDetailsPage() {
  return (
    <Suspense fallback={<TabLoader />}>
      <OrderDetailsPageContent />
    </Suspense>
  );
}
