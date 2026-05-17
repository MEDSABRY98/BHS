'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { FileCheck, UserCheck, Clock, ShieldCheck, AlertCircle, Save, Loader2, CheckCircle2, XCircle, Lock, Truck } from 'lucide-react';
import NoData from '@/components/01-Unified/NoDataTab';

interface InvoicesStatusTabProps {
  orderId: string;
}

export default function InvoicesStatusTab({ orderId }: InvoicesStatusTabProps) {
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [handoverUser, setHandoverUser] = useState<any>(null);
  const [driverStaff, setDriverStaff] = useState<any>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
    resolveCurrentUser();

    // Subscribe to realtime updates for this order's driver tracking
    const channel = app_lpos_supabase
      .channel(`delivery_tracking_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_lpos_DRIVERS',
          filter: `ORDER_ID=eq.${orderId}`
        },
        (payload) => {
          console.log('Realtime update received in InvoicesStatusTab:', payload);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      app_lpos_supabase.removeChannel(channel);
    };
  }, [orderId]);

  const resolveCurrentUser = async () => {
    try {
      const mainUserStr = localStorage.getItem('currentUser');
      if (mainUserStr) {
        const parsed = JSON.parse(mainUserStr);
        const name = parsed.name || parsed.NAME;
        if (name) {
          const { data } = await app_lpos_supabase
            .from('app_lpos_USERS')
            .select('*')
            .eq('NAME', name)
            .maybeSingle();
          if (data) {
            setCurrentUserProfile(data);
          } else {
            setCurrentUserProfile({
              ID: parsed.id || parsed.ID,
              NAME: name,
              ROLE: parsed.role || 'user'
            });
          }
        }
      }
    } catch (e) {
      console.error('Error resolving current user:', e);
    } finally {
      setIsUserLoaded(true);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch delivery data which contains handover info
      const { data: delData, error: delError } = await app_lpos_supabase
        .from('app_lpos_DRIVERS')
        .select('*')
        .eq('ORDER_ID', orderId)
        .maybeSingle();

      if (delError) throw delError;
      setDeliveryData(delData);

      // 2. Fetch handover user details if ID exists
      if (delData?.OFFICE_HANDOVER_ID) {
        const { data: userData } = await app_lpos_supabase
          .from('app_lpos_USERS')
          .select('NAME')
          .eq('ID', delData.OFFICE_HANDOVER_ID)
          .maybeSingle();
        setHandoverUser(userData);
      } else {
        setHandoverUser(null);
      }

      // 3. Fetch driver staff details if DRIVERS_NAME exists
      if (delData?.DRIVERS_NAME) {
        const { data: staffData } = await app_lpos_supabase
          .from('app_lpos_STAFF')
          .select('NAME')
          .eq('ID', delData.DRIVERS_NAME)
          .maybeSingle();
        setDriverStaff(staffData);
      } else {
        setDriverStaff(null);
      }

      // 4. Fetch order details for the digital invoice mockup
      const { data: ordData } = await app_lpos_supabase
        .from('app_lpos_ORDERS')
        .select('LPO_ID, CUSTOMER_NAME, TOTAL_AMOUNT, CREATED_AT')
        .eq('ID', orderId)
        .maybeSingle();
      setOrderDetail(ordData);
    } catch (err) {
      console.error('Error fetching invoice status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!deliveryData) return;
    setIsSaving(true);
    try {
      const isBypass = deliveryData.TRACKING_NOTES === 'SYSTEM_ALREADY_RECEIVED' ||
        deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED';

      let updatePayload: any = {
        OFFICE_HANDOVER_STATUS: newStatus,
        OFFICE_HANDOVER_TIME: new Date().toISOString()
      };

      if (newStatus === 'Rejected' && isBypass) {
        updatePayload = {
          STATUS: 'Assigned',
          DELIVERY_TIME: null,
          IS_CUSTOMER_SIGNED: false,
          OFFICE_HANDOVER_ID: null,
          OFFICE_HANDOVER_STATUS: null,
          OFFICE_HANDOVER_TIME: null,
          TRACKING_NOTES: null
        };
      }

      const { error } = await app_lpos_supabase
        .from('app_lpos_DRIVERS')
        .update(updatePayload)
        .eq('ID', deliveryData.ID);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Status...</p>
      </div>
    );
  }

  if (!deliveryData) {
    return (
      <NoData title="NO DELIVERY DATA" />
    );
  }

  return (
    <div className="w-full">
      <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="relative space-y-12">
          {/* Vertical Line Connector */}
          <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gray-100" />

          {/* Step 1: Customer Delivery */}
          <div className="relative flex items-start gap-8 group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 shadow-lg ${deliveryData.STATUS === 'Delivered' ? 'bg-black shadow-black/20 scale-110' : deliveryData.STATUS === 'Dispatched' ? 'bg-[#D4AF37] shadow-[#D4AF37]/20 scale-110' : 'bg-white border-2 border-gray-100 text-gray-300'}`}>
              <Truck className={`w-7 h-7 ${deliveryData.STATUS === 'Delivered' ? 'text-[#D4AF37]' : deliveryData.STATUS === 'Dispatched' ? 'text-white' : 'text-gray-300'}`} />
            </div>
            <div className="pt-1 flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-black text-black">Customer Delivery</h3>
                <div className={`w-44 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center leading-tight ${deliveryData.STATUS === 'Delivered' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : deliveryData.STATUS === 'Dispatched' ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/20' : 'bg-gray-100 text-gray-400'}`}>
                  {deliveryData.STATUS === 'Delivered' ? 'Completed' : deliveryData.STATUS === 'Dispatched' ? 'In Transit' : 'Pending'}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-gray-300" />
                  <span className="text-xs font-bold text-gray-600">
                    {driverStaff?.NAME ? `Driver: ${driverStaff.NAME}` : 'Driver: Not Assigned'}
                  </span>
                </div>
                {deliveryData.STATUS === 'Delivered' && deliveryData.DELIVERY_TIME && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-300" />
                    <span className="text-xs font-bold text-gray-500">
                      {new Date(deliveryData.DELIVERY_TIME).toLocaleDateString('en-GB')} - {new Date(deliveryData.DELIVERY_TIME).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {deliveryData.STATUS === 'Dispatched' && deliveryData.DISPATCH_TIME && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-300" />
                    <span className="text-xs font-bold text-gray-500">
                      Dispatched: {new Date(deliveryData.DISPATCH_TIME).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Customer Signature */}
          <div className="relative flex items-start gap-8 group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 shadow-lg ${deliveryData.IS_CUSTOMER_SIGNED ? 'bg-black shadow-black/20 scale-110' : deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED' ? 'bg-red-500 shadow-red-500/20 scale-110' : 'bg-white border-2 border-gray-100 text-gray-300'}`}>
              {deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED' ? (
                <XCircle className="w-7 h-7 text-white" />
              ) : (
                <FileCheck className={`w-7 h-7 ${deliveryData.IS_CUSTOMER_SIGNED ? 'text-[#D4AF37]' : ''}`} />
              )}
            </div>
            <div className="pt-1 flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-black text-black">Customer Signature</h3>
                <div className={`w-44 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center leading-tight ${deliveryData.IS_CUSTOMER_SIGNED ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-gray-100 text-gray-400'}`}>
                  {deliveryData.IS_CUSTOMER_SIGNED ? 'Completed' : deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED' ? 'Cancelled' : 'Pending'}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Driver Handover */}
          <div className="relative flex items-start gap-8 group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 shadow-lg ${deliveryData.OFFICE_HANDOVER_ID ? (deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED' ? 'bg-red-500 shadow-red-500/20 scale-110' : 'bg-black shadow-black/20 scale-110') : 'bg-white border-2 border-gray-100 text-gray-300'}`}>
              {deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED' ? (
                <XCircle className="w-7 h-7 text-white" />
              ) : (
                <UserCheck className={`w-7 h-7 ${deliveryData.OFFICE_HANDOVER_ID ? 'text-[#D4AF37]' : ''}`} />
              )}
            </div>
            <div className="pt-1 flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-black text-black">Driver Handover</h3>
                <div className={`w-44 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center leading-tight ${deliveryData.OFFICE_HANDOVER_ID ? (deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20') : 'bg-gray-100 text-gray-400'}`}>
                  {deliveryData.TRACKING_NOTES === 'SYSTEM_ALREADY_RECEIVED' ? 'Already Received' : deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED' ? 'Returned' : deliveryData.OFFICE_HANDOVER_ID ? 'Handed Over' : 'Waiting'}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-300" />
                  <span className="text-xs font-bold text-gray-600">
                    {deliveryData.TRACKING_NOTES === 'SYSTEM_ALREADY_RECEIVED'
                      ? 'Already Received by Office (Target: U-0001)'
                      : deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED'
                        ? 'Returned & Cancelled at Warehouse (Target: U-0007)'
                        : handoverUser?.NAME || 'Not Yet'}
                  </span>
                </div>
                {deliveryData.OFFICE_HANDOVER_TIME && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-300" />
                    <span className="text-xs font-bold text-gray-500">
                      {new Date(deliveryData.OFFICE_HANDOVER_TIME).toLocaleDateString('en-GB')} - {new Date(deliveryData.OFFICE_HANDOVER_TIME).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 4: Office Confirmation */}
          <div className="relative flex items-start gap-8 group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 shadow-lg ${deliveryData.OFFICE_HANDOVER_STATUS === 'Confirmed' ? 'bg-black shadow-black/20 scale-110' : deliveryData.OFFICE_HANDOVER_STATUS === 'Rejected' ? 'bg-red-500 shadow-red-500/20 scale-110' : 'bg-white border-2 border-gray-100 text-gray-300'}`}>
              {deliveryData.OFFICE_HANDOVER_STATUS === 'Rejected' ? (
                <XCircle className="w-7 h-7 text-white" />
              ) : (
                <CheckCircle2 className={`w-7 h-7 ${deliveryData.OFFICE_HANDOVER_STATUS === 'Confirmed' ? 'text-[#D4AF37]' : ''}`} />
              )}
            </div>
            <div className="pt-1 flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-black text-black">Office Confirmation</h3>
                <div className={`w-44 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center leading-tight ${deliveryData.OFFICE_HANDOVER_STATUS === 'Confirmed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : deliveryData.OFFICE_HANDOVER_STATUS === 'Rejected' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'}`}>
                  {deliveryData.OFFICE_HANDOVER_STATUS === 'Confirmed'
                    ? (deliveryData.TRACKING_NOTES === 'SYSTEM_ALREADY_RECEIVED'
                      ? 'Verified (Already Received)'
                      : deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED'
                        ? 'Verified (Returned & Cancelled)'
                        : 'Verified')
                    : deliveryData.OFFICE_HANDOVER_STATUS === 'Rejected'
                      ? 'Rejected'
                      : 'Action Required'}
                </div>
              </div>
              {(deliveryData.OFFICE_HANDOVER_STATUS === 'Confirmed' || deliveryData.OFFICE_HANDOVER_STATUS === 'Rejected') && deliveryData.OFFICE_HANDOVER_TIME && (
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-300" />
                    <span className="text-xs font-bold text-gray-500">
                      {new Date(deliveryData.OFFICE_HANDOVER_TIME).toLocaleDateString('en-GB')} - {new Date(deliveryData.OFFICE_HANDOVER_TIME).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Action Bar */}
      {deliveryData.OFFICE_HANDOVER_ID && deliveryData.OFFICE_HANDOVER_STATUS !== 'Confirmed' && deliveryData.OFFICE_HANDOVER_STATUS !== 'Rejected' && (
        <div className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {deliveryData.TRACKING_NOTES === 'SYSTEM_ALREADY_RECEIVED' && (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-amber-900 font-bold text-sm">Already Received by Office</h5>
                <p className="text-amber-700 text-xs mt-1 font-medium">
                  The driver has flagged this invoice as <strong>Already Received by Office</strong>. By confirming, you verify that the office has previously received this document.
                </p>
              </div>
            </div>
          )}
          {deliveryData.TRACKING_NOTES === 'SYSTEM_CANCELLED' && (
            <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-red-900 font-bold text-sm">Returned & Goods Cancelled</h5>
                <p className="text-red-700 text-xs mt-1 font-medium">
                  The driver has flagged this invoice as <strong>Returned & Goods Cancelled</strong>. By confirming, you verify that the goods were returned and cancelled at the warehouse.
                </p>
              </div>
            </div>
          )}

          {isUserLoaded && currentUserProfile?.ID !== deliveryData.OFFICE_HANDOVER_ID ? (
            <div className="bg-amber-50/40 border border-amber-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 relative shrink-0">
                  <Lock className="w-5 h-5 text-white" />
                  <span className="absolute -inset-1 rounded-3xl bg-amber-500/10 animate-ping opacity-75" />
                </div>
                <div>
                  <h4 className="text-black font-black text-base">Office Review (Restricted)</h4>
                  <p className="text-gray-500 text-xs mt-1 font-medium">
                    This invoice was physically handed over to <strong className="text-black">{handoverUser?.NAME || `User (${deliveryData.OFFICE_HANDOVER_ID})`}</strong>. Only they are authorized to confirm or reject this handover.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
                  <CheckCircle2 className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <div>
                  <h4 className="text-black font-black text-lg">Office Review</h4>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <button
                  onClick={() => handleUpdateStatus('Rejected')}
                  disabled={isSaving}
                  className="w-full md:w-auto px-10 py-4 bg-white border border-red-100 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-red-50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                  Reject
                </button>
                <button
                  onClick={() => handleUpdateStatus('Confirmed')}
                  disabled={isSaving}
                  className="w-full md:w-auto px-10 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
