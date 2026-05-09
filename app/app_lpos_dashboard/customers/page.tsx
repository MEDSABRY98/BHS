'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { 
  UserCircle, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Save,
  MapPin,
  Building2,
  Loader2,
  Phone
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import NoData from '@/components/01-Unified/NoDataTab';
import { usePermissions } from '../hooks/usePermissions';

export default function CustomersPage() {
  const { canEdit, canDelete, isLoaded } = usePermissions();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'save' | 'delete'>('save');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states - Matching DB columns
  const [CUSTOMER_NAME, setCUSTOMER_NAME] = useState('');
  const [CUSTOMER_CITY, setCUSTOMER_CITY] = useState('');
  const [CUSTOMER_ID, setCUSTOMER_ID] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_CUSTOMERS')
        .select('*')
        .order('CUSTOMER NAME');
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (customer: any = null) => {
    setEditingCustomer(customer);
    setCUSTOMER_NAME(customer ? customer["CUSTOMER NAME"] : '');
    setCUSTOMER_CITY(customer ? customer["CUSTOMER CITY"] : '');
    setCUSTOMER_ID(customer ? customer["CUSTOMER ID"] : '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmAction('save');
    setIsConfirmOpen(true);
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      if (editingCustomer) {
        const { error } = await app_lpos_supabase
          .from('app_lpos_CUSTOMERS')
          .update({ 
            "CUSTOMER NAME": CUSTOMER_NAME, 
            "CUSTOMER CITY": CUSTOMER_CITY,
            "CUSTOMER ID": CUSTOMER_ID
          })
          .eq('ID', editingCustomer.ID);
        if (error) throw error;
      } else {
        const nextId = `C-${(customers.length + 1).toString().padStart(4, '0')}`;
        const { error } = await app_lpos_supabase
          .from('app_lpos_CUSTOMERS')
          .insert({ 
            ID: nextId, 
            "CUSTOMER NAME": CUSTOMER_NAME, 
            "CUSTOMER CITY": CUSTOMER_CITY,
            "CUSTOMER ID": CUSTOMER_ID
          });
        if (error) throw error;
      }
      setIsConfirmOpen(false);
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setConfirmAction('delete');
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    setIsSaving(true);
    try {
      const { error } = await app_lpos_supabase
        .from('app_lpos_CUSTOMERS')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c["CUSTOMER NAME"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c["CUSTOMER ID"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c["CUSTOMER CITY"]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Customers</h1>
        </div>
        {canEdit && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-8 py-4 bg-black text-[#D4AF37] rounded-2xl font-bold text-sm shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-5 h-5" />
            NEW CUSTOMER
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by customer name, ID, or city..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-56 bg-gray-100 rounded-[2.5rem] animate-pulse"></div>
          ))
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full">
            <NoData title="NO CUSTOMERS FOUND" />
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.ID} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 group hover:shadow-xl hover:shadow-black/5 transition-all duration-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-black/[0.02] rounded-bl-[4rem] -mr-8 -mt-8 group-hover:bg-[#D4AF37]/5 transition-colors"></div>
              
              <div className="flex justify-between items-start mb-6 relative">
                <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
                  <Building2 className="w-7 h-7 text-[#D4AF37]" />
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <button onClick={() => handleOpenModal(customer)} className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-black transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(customer.ID)} className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] mb-1">CUSTOMER NAME</p>
                  <h3 className="font-bold text-xl text-black leading-tight">{customer["CUSTOMER NAME"]}</h3>
                </div>
                
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{customer["CUSTOMER CITY"]}</span>
                </div>

                <div className="flex items-center gap-3 text-gray-500">
                  <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">ID: {customer["CUSTOMER ID"]}</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{customer.ID}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{editingCustomer ? 'Edit Customer' : 'New Customer'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CUSTOMER NAME</label>
                  <input 
                    type="text" 
                    value={CUSTOMER_NAME}
                    onChange={(e) => setCUSTOMER_NAME(e.target.value)}
                    placeholder="Full Company Name"
                    required
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CUSTOMER ID</label>
                  <input 
                    type="text" 
                    value={CUSTOMER_ID}
                    onChange={(e) => setCUSTOMER_ID(e.target.value)}
                    placeholder="TRN or Reg No."
                    required
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CUSTOMER CITY</label>
                  <div className="relative">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text" 
                      value={CUSTOMER_CITY}
                      onChange={(e) => setCUSTOMER_CITY(e.target.value)}
                      placeholder="e.g. Dubai"
                      required
                      className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-1 py-4 bg-black text-[#D4AF37] rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  SAVE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal 
        isOpen={isConfirmOpen}
        onConfirm={confirmAction === 'save' ? executeSave : executeDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isSaving}
        title={confirmAction === 'save' ? 'Confirm Save' : 'Confirm Deletion'}
        message={confirmAction === 'save' ? 'Are you sure you want to save these changes?' : 'Are you sure you want to delete this customer? This action cannot be undone.'}
      />
    </div>
  );
}
