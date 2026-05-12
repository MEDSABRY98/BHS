'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Package, 
  User, 
  MapPin, 
  Calendar,
  AlertCircle,
  Loader2,
  Trash2,
  Undo2,
  FileText,
  Printer
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { usePermissions } from '../../hooks/usePermissions';
import { generateLpoPackingListPDF } from '@/lib/pdf/LpoPackingListUtils';

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
  const [pendingStatus, setPendingStatus] = useState('');

  useEffect(() => {
    if (id) fetchOrderDetails();
  }, [id]);

  async function fetchOrderDetails() {
    try {
      const [orderRes, itemsRes] = await Promise.all([
        app_lpos_supabase
          .from('app_lpos_ORDERS')
          .select(`
            *,
            app_lpos_CUSTOMERS ( * ),
            app_lpos_USERS ( "NAME" )
          `)
          .eq('ID', id)
          .single(),
        app_lpos_supabase
          .from('app_lpos_ORDERS_ITEMS')
          .select(`
            *,
            app_lpos_PRODUCTS ( "PRODUCT NAME", "PRODUCT BARCODE" )
          `)
          .eq('ORDER_ID', id)
      ]);

      if (orderRes.error) throw orderRes.error;
      const initialItems = itemsRes.data || [];
      const enrichedItems = initialItems.map((item: any) => ({
        ...item,
        QTY_RECEIVED: (orderRes.data.STATUS === 'Pending' && (!item.QTY_RECEIVED || item.QTY_RECEIVED === 0)) 
          ? item.QTY_REQUEST 
          : item.QTY_RECEIVED
      }));

      setOrder(orderRes.data);
      setItems(enrichedItems);
      setAdminNotes(orderRes.data.NOTES || '');
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
      // 1. Delete items first
      const { error: itemsError } = await app_lpos_supabase
        .from('app_lpos_ORDERS_ITEMS')
        .delete()
        .eq('ORDER_ID', id);

      if (itemsError) throw itemsError;

      // 2. Delete the order
      const { error: orderError } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .delete()
        .eq('ID', id);

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
      let statusToSave = pendingStatus;

      // Prepare updates and determine final order status
      const processedItems = items.map(item => {
        let sentQty = parseFloat(item.QTY_RECEIVED) || 0;
        let itemStatus = item.ITEMS_STATUS;

        // Global rejection forces everything to 0 and Rejected
        if (pendingStatus === 'Rejected') {
          itemStatus = 'Rejected';
          sentQty = 0;
        } 
        // Individual rejection or empty qty forces to 0
        else if (itemStatus === 'Rejected' || sentQty === 0 || !item.QTY_RECEIVED) {
          itemStatus = 'Rejected';
          sentQty = 0;
        } 
        // Success case
        else if (pendingStatus === 'Approved') {
          itemStatus = 'Approved';
        }

        return {
          ...item,
          finalQty: sentQty,
          finalStatus: itemStatus
        };
      });

      // If user is approving, check if it should be "Partially Approved" or "Rejected"
      if (pendingStatus === 'Approved') {
        const hasApprovedItems = processedItems.some(i => i.finalStatus === 'Approved');
        const hasReducedOrRejected = processedItems.some(i => {
          return i.finalStatus === 'Rejected' || i.finalQty < i.QTY_REQUEST;
        });

        if (!hasApprovedItems) {
          statusToSave = 'Rejected';
        } else if (hasReducedOrRejected) {
          statusToSave = 'Partially Approved';
        }
      }

      // 1. Update order status and notes
      const { error: orderError } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .update({ STATUS: statusToSave, NOTES: adminNotes })
        .eq('ID', id);

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

      await fetchOrderDetails();
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
              onClick={() => generateLpoPackingListPDF(order, items, 'print')}
              className="p-4 bg-white border border-gray-100 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm"
              title="Print Packing List"
            >
              <Printer className="w-5 h-5 text-blue-500" />
            </button>
            <button
              onClick={() => generateLpoPackingListPDF(order, items)}
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
              disabled={isSaving || !items.some(item => (parseFloat(item.QTY_RECEIVED) || 0) > 0 && item.ITEMS_STATUS !== 'Rejected')}
              className={`w-[160px] py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${
                isSaving || !items.some(item => (parseFloat(item.QTY_RECEIVED) || 0) > 0 && item.ITEMS_STATUS !== 'Rejected')
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

      {/* Customer Info Row - Horizontal */}
      <div className="bg-black rounded-[2.5rem] p-8 text-white shadow-xl shadow-black/20 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-8">
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
              <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">Date</p>
              <p className="font-black text-lg text-white">{new Date(order.CREATED_AT).toLocaleDateString('en-GB')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">Sales Rep</p>
              <p className="font-black text-lg text-white truncate">{order.app_lpos_USERS?.NAME}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 md:col-span-2">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">Customer</p>
              <p className="font-black text-lg text-white truncate">{order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"]}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <p className="text-[10px] text-[#D4AF37]/60 font-black uppercase tracking-widest">City</p>
              <p className="font-black text-lg text-white">{order.app_lpos_CUSTOMERS?.["CUSTOMER CITY"]}</p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onConfirm={executeUpdateStatus}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isSaving}
        title={pendingStatus === 'Rejected' ? 'Confirm Rejection' : 'Confirm Order Update'}
        message={`Are you sure you want to ${pendingStatus === 'Rejected' ? 'reject all items' : 'save and finalize'} this order?`}
      />

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onConfirm={handleDeleteOrder}
        onCancel={() => setIsDeleteModalOpen(false)}
        title="Delete Order"
        message="Are you sure you want to permanently delete this order? This action cannot be undone and will remove all associated item records."
        isLoading={isSaving}
      />

      {/* Items Table */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between mb-8 px-2">
          <h3 className="text-2xl font-black text-black">Order Items</h3>
          <div className="flex items-center gap-6">
             <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Value</p>
              <p className="text-2xl font-black text-black">AED {totalAmount.toFixed(2)}</p>
            </div>
            <div className="px-4 py-2 bg-black text-[#D4AF37] rounded-xl text-xs font-black uppercase tracking-widest">
              {items.length} Products
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[15%]">Barcode</th>
                <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[30%]">Product Name</th>
                <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[10%]">Unit</th>
                <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[10%]">Price</th>
                <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[10%]">Requested</th>
                <th className="pb-6 px-4 text-[10px] font-black text-black uppercase tracking-[0.2em] w-[10%]">Sent</th>
                <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[10%]">Status</th>
                {canEdit && <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[5%]">Reject</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.ID} className={`group transition-all ${item.ITEMS_STATUS === 'Rejected' ? 'bg-red-50/30' : 'hover:bg-gray-50/50'}`}>
                  <td className="py-6 px-4 text-center">
                    <span className={`text-sm ${item.ITEMS_STATUS === 'Rejected' ? 'text-red-400 line-through' : 'text-gray-600'}`}>
                      {item.app_lpos_PRODUCTS?.["PRODUCT BARCODE"]}
                    </span>
                  </td>
                  <td className="py-6 px-4 text-center">
                    <span className={`text-sm font-medium ${item.ITEMS_STATUS === 'Rejected' ? 'text-red-500 line-through opacity-50' : 'text-black'}`}>
                      {item.app_lpos_PRODUCTS?.["PRODUCT NAME"]}
                    </span>
                  </td>
                  <td className="py-6 px-4 text-center">
                    <span className={`text-sm ${item.ITEMS_STATUS === 'Rejected' ? 'text-red-400' : 'text-gray-600'}`}>
                      {item.UNIT}
                    </span>
                  </td>
                  <td className="py-6 px-4 text-center">
                    <span className="text-gray-600 text-sm">{item.PRICE}</span>
                  </td>
                  <td className="py-6 px-4 text-center">
                    <span className="text-gray-400 text-sm">{item.QTY_REQUEST}</span>
                  </td>
                  <td className="py-6 px-4 text-center">
                    <div className="flex justify-center">
                      <input 
                        type="text" 
                        disabled={item.ITEMS_STATUS === 'Rejected' || !canEdit}
                        value={item.QTY_RECEIVED || ''}
                        onChange={(e) => handleQtyChange(item.ID, e.target.value)}
                        placeholder="0"
                        className={`w-24 bg-gray-50 border border-gray-100 rounded-xl py-2 px-3 text-center font-black text-black focus:ring-2 focus:ring-black/10 outline-none transition-all ${item.ITEMS_STATUS === 'Rejected' || !canEdit ? 'opacity-20' : ''}`}
                      />
                    </div>
                  </td>
                  <td className="py-6 px-4 text-center">
                    <div className={`inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                      item.ITEMS_STATUS === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                      item.ITEMS_STATUS === 'Pending' ? 'bg-blue-50 text-blue-600' :
                      item.ITEMS_STATUS === 'Rejected' ? 'bg-red-50 text-red-600' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {item.ITEMS_STATUS || 'Pending'}
                    </div>
                  </td>
                  {canEdit && (
                    <td className="py-6 px-4 text-center">
                      <div className="flex justify-center">
                        <button 
                          onClick={() => toggleItemStatus(item.ID)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            item.ITEMS_STATUS === 'Rejected' 
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                              : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
                          }`}
                          title={item.ITEMS_STATUS === 'Rejected' ? "Restore Item" : "Reject Item"}
                        >
                          {item.ITEMS_STATUS === 'Rejected' ? <Undo2 className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
