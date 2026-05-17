'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { Truck, Navigation, CheckCircle2, Clock, Save, MapPin, Trash2 } from 'lucide-react';
import SearchSelect from '../../../components/DropDownList';

interface OrderDeliveryTabProps {
  orderId: string;
}

export default function OrderDeliveryTab({ orderId }: OrderDeliveryTabProps) {
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [orderId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all staff for dropdowns
      const { data: staffData } = await app_lpos_supabase
        .from('app_lpos_STAFF')
        .select('*')
        .order('NAME');
      setAllStaff(staffData || []);

      // Fetch delivery tracking for this order
      const { data: delData } = await app_lpos_supabase
        .from('app_lpos_DRIVERS')
        .select('*')
        .eq('ORDER_ID', orderId)
        .maybeSingle();

      // Sanitize data: convert empty strings to null for FK columns
      const sanitizedDelData = delData ? {
        ...delData,
        DRIVERS_NAME: delData.DRIVERS_NAME || null,
        ASSISTANT_NAME: delData.ASSISTANT_NAME || null,
        TRACKING_NOTES: delData.TRACKING_NOTES || null
      } : null;

      setDeliveryData(sanitizedDelData || {
        ORDER_ID: orderId,
        DRIVERS_NAME: null,
        ASSISTANT_NAME: null,
        STATUS: 'Assigned',
        TRACKING_NOTES: null
      });
    } catch (error) {
      console.error('Error fetching delivery data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNextId = async () => {
    const { data } = await app_lpos_supabase
      .from('app_lpos_DRIVERS')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return 'DRI-0001';

    const lastId = data[0].ID;
    const lastNum = parseInt(lastId.split('-')[1]);
    return `DRI-${(lastNum + 1).toString().padStart(4, '0')}`;
  };

  const handleSave = async (updatedFields: any = {}) => {
    setIsSaving(true);
    try {
      // Sanitize fields: convert empty strings to null for FK columns
      const sanitizedFields = { ...updatedFields };
      if (sanitizedFields.DRIVERS_NAME === '') sanitizedFields.DRIVERS_NAME = null;
      if (sanitizedFields.ASSISTANT_NAME === '') sanitizedFields.ASSISTANT_NAME = null;

      const currentData = { ...deliveryData, ...sanitizedFields };

      if (!currentData.ID) {
        // Create new record
        const nextId = await generateNextId();
        const { data, error } = await app_lpos_supabase
          .from('app_lpos_DRIVERS')
          .insert([{ ...currentData, ID: nextId }])
          .select()
          .maybeSingle();
        if (error) throw error;
        if (data) setDeliveryData(data);
      } else {
        // Update existing record
        const { data, error } = await app_lpos_supabase
          .from('app_lpos_DRIVERS')
          .update(sanitizedFields)
          .eq('ID', currentData.ID)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (data) setDeliveryData(data);
        else setDeliveryData(currentData);
      }
    } catch (error: any) {
      console.error('Detailed error saving delivery data:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error
      });
      alert(`Failed to update tracking: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const setTimestamp = (field: 'DISPATCH_TIME' | 'DELIVERY_TIME') => {
    const now = new Date().toISOString();
    const newStatus = field === 'DISPATCH_TIME' ? 'Dispatched' : 'Delivered';
    handleSave({ [field]: now, STATUS: newStatus });
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center animate-pulse">
        <Truck className="w-12 h-12 text-gray-100 mx-auto mb-4" />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading logistics data...</p>
      </div>
    );
  }

  const staffOptions = allStaff.map(s => ({ id: s.ID, label: s.NAME }));

  const getStaffName = (id: string) => {
    return allStaff.find(s => s.ID === id)?.NAME || id;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left Side: Assignment */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 space-y-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-black">Logistics Team</h3>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assign personnel for delivery</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Driver Slot */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 block">Primary Driver</label>
              {deliveryData.DRIVERS_NAME ? (
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-[1.5rem] border border-gray-100 group hover:border-black transition-all animate-in fade-in slide-in-from-left-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black text-[#D4AF37] rounded-xl flex items-center justify-center font-black text-xs">
                      {getStaffName(deliveryData.DRIVERS_NAME).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-black tracking-tight">{getStaffName(deliveryData.DRIVERS_NAME)}</p>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Assigned Driver</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSave({
                      DRIVERS_NAME: null,
                      DISPATCH_TIME: null,
                      DELIVERY_TIME: null,
                      STATUS: 'Assigned'
                    })}
                    className="w-10 h-10 bg-white border border-red-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <SearchSelect
                      label=""
                      placeholder="Select driver..."
                      options={staffOptions}
                      value={deliveryData.DRIVERS_NAME}
                      onChange={(val) => {
                        const now = new Date().toISOString();
                        handleSave({ 
                          DRIVERS_NAME: val,
                          DISPATCH_TIME: deliveryData.DISPATCH_TIME || now,
                          STATUS: deliveryData.STATUS === 'Assigned' || !deliveryData.STATUS ? 'Dispatched' : deliveryData.STATUS
                        });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Assistant Slot */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 block">Assistant / Helper</label>
              {deliveryData.ASSISTANT_NAME ? (
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-[1.5rem] border border-gray-100 group hover:border-black transition-all animate-in fade-in slide-in-from-left-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 text-gray-500 rounded-xl flex items-center justify-center font-black text-xs">
                      {getStaffName(deliveryData.ASSISTANT_NAME).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-black tracking-tight">{getStaffName(deliveryData.ASSISTANT_NAME)}</p>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Assigned Assistant</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSave({ ASSISTANT_NAME: null })}
                    className="w-10 h-10 bg-white border border-red-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <SearchSelect
                      label=""
                      placeholder="Select assistant (optional)..."
                      options={staffOptions}
                      value={deliveryData.ASSISTANT_NAME}
                      onChange={(val) => handleSave({ ASSISTANT_NAME: val })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Status & Timeline */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 space-y-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <Navigation className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-black">Delivery Tracking</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Real-time status updates</p>
              </div>
            </div>
            <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm ${deliveryData.STATUS === 'Delivered' ? 'bg-emerald-500 text-white' :
              deliveryData.STATUS === 'Dispatched' ? 'bg-black text-[#D4AF37]' :
                'bg-gray-50 text-gray-400'
              }`}>
              {deliveryData.STATUS}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <button
              disabled={!deliveryData.ID || !!deliveryData.DISPATCH_TIME}
              onClick={() => setTimestamp('DISPATCH_TIME')}
              className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${deliveryData.DISPATCH_TIME
                ? 'bg-black border-black text-white'
                : 'bg-white border-gray-100 hover:border-black group'
                }`}
            >
              <div className="flex items-center gap-5 text-left">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${deliveryData.DISPATCH_TIME ? 'bg-white/10' : 'bg-gray-50 group-hover:bg-black group-hover:text-white'}`}>
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${deliveryData.DISPATCH_TIME ? 'text-gray-400' : 'text-gray-300'}`}>Dispatch Time</p>
                  <p className="text-sm font-black">
                    {deliveryData.DISPATCH_TIME ? new Date(deliveryData.DISPATCH_TIME).toLocaleTimeString() : 'Not Dispatched Yet'}
                  </p>
                </div>
              </div>
              {!deliveryData.DISPATCH_TIME && (
                <div className="px-4 py-2 bg-black text-[#D4AF37] rounded-xl text-[10px] font-black uppercase tracking-widest">Mark Dispatched</div>
              )}
            </button>

            <button
              disabled={true}
              onClick={() => setTimestamp('DELIVERY_TIME')}
              className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${deliveryData.DELIVERY_TIME
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-500/20'
                : 'bg-white border-gray-100 opacity-50 cursor-not-allowed group'
                }`}
            >
              <div className="flex items-center gap-5 text-left">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${deliveryData.DELIVERY_TIME ? 'bg-white/10' : 'bg-gray-50 group-hover:bg-emerald-500 group-hover:text-white'}`}>
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${deliveryData.DELIVERY_TIME ? 'text-emerald-100' : 'text-gray-300'}`}>Arrival Time</p>
                  <p className="text-sm font-black">
                    {deliveryData.DELIVERY_TIME ? new Date(deliveryData.DELIVERY_TIME).toLocaleTimeString() : 'Not Delivered Yet'}
                  </p>
                </div>
              </div>
              {!deliveryData.DELIVERY_TIME && deliveryData.DISPATCH_TIME && (
                <div className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Mark Delivered</div>
              )}
            </button>
          </div>

          <div className="pt-6">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 mb-2 block">Tracking Notes</label>
            <textarea
              placeholder="Enter notes about delivery, location, etc..."
              value={deliveryData.TRACKING_NOTES || ''}
              onChange={(e) => setDeliveryData({ ...deliveryData, TRACKING_NOTES: e.target.value })}
              onBlur={() => handleSave()}
              className="w-full bg-gray-50 border border-gray-100 rounded-[2rem] p-6 text-sm font-medium focus:ring-2 focus:ring-black/10 outline-none transition-all min-h-[150px] resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
