'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { FileCheck, UserCheck, Clock, ShieldCheck, AlertCircle, Save, Loader2, CheckCircle2 } from 'lucide-react';

interface InvoicesStatusTabProps {
  orderId: string;
}

export default function InvoicesStatusTab({ orderId }: InvoicesStatusTabProps) {
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [handoverUser, setHandoverUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [orderId]);

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
      const { error } = await app_lpos_supabase
        .from('app_lpos_DRIVERS')
        .update({ 
          OFFICE_HANDOVER_STATUS: 'Confirmed',
          OFFICE_HANDOVER_TIME: new Date().toISOString()
        })
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
      <div className="flex flex-col items-center justify-center min-h-[300px] bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200">
        <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-sm font-bold text-gray-500">No delivery data available for this order yet.</p>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Please assign a driver first.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="relative space-y-12">
          {/* Vertical Line Connector */}
          <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gray-100" />

        {/* Step 1: Customer Signature */}
        <div className="relative flex items-start gap-8 group">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 shadow-lg ${deliveryData.IS_CUSTOMER_SIGNED ? 'bg-black shadow-black/20 scale-110' : 'bg-white border-2 border-gray-100 text-gray-300'}`}>
            <FileCheck className={`w-7 h-7 ${deliveryData.IS_CUSTOMER_SIGNED ? 'text-[#D4AF37]' : ''}`} />
          </div>
          <div className="pt-1 flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-black text-black">Customer Signature</h3>
              <div className={`w-32 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-center ${deliveryData.IS_CUSTOMER_SIGNED ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-100 text-gray-400'}`}>
                {deliveryData.IS_CUSTOMER_SIGNED ? 'Completed' : 'Pending'}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Driver Handover */}
        <div className="relative flex items-start gap-8 group">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 shadow-lg ${deliveryData.OFFICE_HANDOVER_ID ? 'bg-black shadow-black/20 scale-110' : 'bg-white border-2 border-gray-100 text-gray-300'}`}>
            <UserCheck className={`w-7 h-7 ${deliveryData.OFFICE_HANDOVER_ID ? 'text-[#D4AF37]' : ''}`} />
          </div>
          <div className="pt-1 flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-black text-black">Driver Handover</h3>
              <div className={`w-32 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-center ${deliveryData.OFFICE_HANDOVER_ID ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-100 text-gray-400'}`}>
                {deliveryData.OFFICE_HANDOVER_ID ? 'Handed Over' : 'Waiting'}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-300" />
                <span className="text-xs font-bold text-gray-600">{handoverUser?.NAME || 'Not Yet'}</span>
              </div>
              {deliveryData.OFFICE_HANDOVER_TIME && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-300" />
                  <span className="text-xs font-bold text-gray-500">{new Date(deliveryData.OFFICE_HANDOVER_TIME).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Office Confirmation */}
        <div className="relative flex items-start gap-8 group">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 shadow-lg ${deliveryData.OFFICE_HANDOVER_STATUS === 'Confirmed' ? 'bg-black shadow-black/20 scale-110' : 'bg-white border-2 border-gray-100 text-gray-300'}`}>
            <CheckCircle2 className={`w-7 h-7 ${deliveryData.OFFICE_HANDOVER_STATUS === 'Confirmed' ? 'text-[#D4AF37]' : ''}`} />
          </div>
          <div className="pt-1 flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-black text-black">Office Confirmation</h3>
              <div className={`w-32 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-center ${deliveryData.OFFICE_HANDOVER_STATUS === 'Confirmed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'}`}>
                {deliveryData.OFFICE_HANDOVER_STATUS === 'Confirmed' ? 'Verified' : 'Action Required'}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Admin Action Bar */}
      {deliveryData.OFFICE_HANDOVER_ID && deliveryData.OFFICE_HANDOVER_STATUS !== 'Confirmed' && (
        <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-emerald-900 font-black text-lg">Confirm Receipt?</h4>
              <p className="text-emerald-700/70 text-sm font-bold">Has the invoice been physically handed over to the office?</p>
            </div>
          </div>
          <button
            onClick={() => handleUpdateStatus('Confirmed')}
            disabled={isSaving}
            className="w-full md:w-auto px-10 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Confirm Handover
          </button>
        </div>
      )}
    </div>
  );
}
