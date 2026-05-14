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
  Loader2,
  Check,
  Briefcase
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import NoData from '@/components/01-Unified/NoDataTab';
import { usePermissions } from '../hooks/usePermissions';

export default function StaffPage() {
  const { canEdit, canDelete } = usePermissions();
  const [staff, setStaff] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'save' | 'delete'>('save');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [NAME, setNAME] = useState('');
  const [ROLE, setROLE] = useState('Staff'); 

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_STAFF')
        .select('*')
        .order('NAME');
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (item: any = null) => {
    setEditingStaff(item);
    setNAME(item ? item.NAME : '');
    setROLE(item ? item.ROLE || 'Staff' : 'Staff');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave();
  };

  const generateNextId = async () => {
    const { data } = await app_lpos_supabase
      .from('app_lpos_STAFF')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return 'S-0001';

    const lastId = data[0].ID;
    const lastNum = parseInt(lastId.split('-')[1]);
    return `S-${(lastNum + 1).toString().padStart(4, '0')}`;
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      if (editingStaff) {
        const { error } = await app_lpos_supabase
          .from('app_lpos_STAFF')
          .update({ NAME, ROLE })
          .eq('ID', editingStaff.ID);
        if (error) throw error;
      } else {
        const nextId = await generateNextId();
        const { error } = await app_lpos_supabase
          .from('app_lpos_STAFF')
          .insert({ ID: nextId, NAME, ROLE });
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchStaff();
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
        .from('app_lpos_STAFF')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      fetchStaff();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const filteredStaff = staff.filter(s => 
    s.NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.ID?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Staff</h1>

        </div>
        {canEdit && (
          <button 
            onClick={() => handleOpenModal()}
            className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center"
            title="New Staff Member"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name or staff ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-sm font-bold"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="w-[15%] px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Staff ID</th>
                <th className="w-[45%] px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Name</th>
                <th className="w-[25%] px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Designation / Role</th>
                <th className="w-[15%] px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-8 py-6">
                      <div className="h-8 bg-gray-50 rounded-xl w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center">
                    <NoData title="NO STAFF FOUND" />
                  </td>
                </tr>
              ) : (
                filteredStaff.map((person) => (
                  <tr key={person.ID} className="group hover:bg-gray-50/50 transition-all duration-300">
                    <td className="px-8 py-6 text-center">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{person.ID}</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center font-black text-[#D4AF37] shrink-0 shadow-lg shadow-black/10">
                          {person.NAME.charAt(0)}
                        </div>
                        <span className="font-bold text-black">{person.NAME}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100">
                        <Briefcase className="w-3.5 h-3.5" />
                        {person.ROLE || 'Staff'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {canEdit && (
                          <button onClick={() => handleOpenModal(person)} className="p-2.5 hover:bg-white hover:shadow-sm rounded-xl text-gray-400 hover:text-black transition-all border border-transparent hover:border-gray-100">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(person.ID)} className="p-2.5 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500 border border-white">
            <div className="p-8 flex items-center justify-between border-b border-gray-50">
              <h2 className="text-2xl font-bold">{editingStaff ? 'Edit Staff' : 'New Staff Member'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-8">
              {/* NAME Field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">FULL NAME</label>
                <input 
                  type="text" 
                  value={NAME}
                  onChange={(e) => setNAME(e.target.value)}
                  placeholder="Enter staff full name"
                  required
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                />
              </div>

              {/* ROLE Field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">DESIGNATION / ROLE</label>
                <div className="relative">
                  <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    value={ROLE}
                    onChange={(e) => setROLE(e.target.value)}
                    placeholder="e.g. Warehouse, Driver, Assistant..."
                    required
                    className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
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
                  SAVE STAFF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onConfirm={executeDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isSaving}
        title="Confirm Removal"
        message="Are you sure you want to remove this staff member? This will not delete their historical tracking data but they will no longer appear in selection lists."
      />
    </div>
  );
}
