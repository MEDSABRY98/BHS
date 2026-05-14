'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { Truck, Navigation, CheckCircle2, Clock, Save, MapPin } from 'lucide-react';
import SearchSelect from '../../../components/SearchSelect';

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
      
      setDeliveryData(delData || {
        ORDER_ID: orderId,
        DRIVERS_NAME: '',
        ASSISTANT_NAME: '',
        STATUS: 'Assigned',
        TRACKING_NOTES: ''
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
      const currentData = { ...deliveryData, ...updatedFields };
      
      if (!currentData.ID) {
        // Create new record
        const nextId = await generateNextId();
        const { data, error } = await app_lpos_supabase
          .from('app_lpos_DRIVERS')
          .insert([{ ...currentData, ID: nextId }])
          .select()
          .single();
        if (error) throw error;
        setDeliveryData(data);
      } else {
        // Update existing record
        const { data, error } = await app_lpos_supabase
          .from('app_lpos_DRIVERS')
          .update(currentData)
          .eq('ID', currentData.ID)
          .select()
          .single();
        if (error) throw error;
        setDeliveryData(data);
      }
    } catch (error) {
      console.error('Error saving delivery data:', error);
      alert('Failed to update tracking');
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

  const staffOptions = allStaff.map(s => ({ id: s.NAME, label: s.NAME }));

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

          <div className="space-y-6">
            <SearchSelect
              label="Primary Driver"
              placeholder="Select driver..."
              options={staffOptions}
              value={deliveryData.DRIVERS_NAME}
              onChange={(val) => setDeliveryData({...deliveryData, DRIVERS_NAME: val})}
            />

            <SearchSelect
              label="Assistant / Helper"
              placeholder="Select assistant (optional)..."
              options={staffOptions}
              value={deliveryData.ASSISTANT_NAME}
              onChange={(val) => setDeliveryData({...deliveryData, ASSISTANT_NAME: val})}
            />

            <div className="pt-4 flex justify-end">
              <button
                disabled={isSaving || !deliveryData.DRIVERS_NAME}
                onClick={() => handleSave()}
                className="h-[68px] w-[68px] bg-black text-[#D4AF37] rounded-2xl font-black flex items-center justify-center hover:bg-gray-900 transition-all shadow-xl shadow-black/10 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" /> : <Save className="w-6 h-6" />}
              </button>
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
            <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm ${
              deliveryData.STATUS === 'Delivered' ? 'bg-emerald-500 text-white' :
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
              className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${
                deliveryData.DISPATCH_TIME 
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
              disabled={!deliveryData.DISPATCH_TIME || !!deliveryData.DELIVERY_TIME}
              onClick={() => setTimestamp('DELIVERY_TIME')}
              className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${
                deliveryData.DELIVERY_TIME 
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-500/20' 
                  : 'bg-white border-gray-100 hover:border-emerald-500 group disabled:opacity-50'
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
              onChange={(e) => setDeliveryData({...deliveryData, TRACKING_NOTES: e.target.value})}
              onBlur={() => handleSave()}
              className="w-full bg-gray-50 border border-gray-100 rounded-[2rem] p-6 text-sm font-medium focus:ring-2 focus:ring-black/10 outline-none transition-all min-h-[150px] resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
