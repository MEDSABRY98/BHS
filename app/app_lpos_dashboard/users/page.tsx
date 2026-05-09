'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { 
  Users, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Save,
  Shield,
  Key,
  Loader2,
  Check
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import NoData from '@/components/01-Unified/NoDataTab';
import { usePermissions } from '../hooks/usePermissions';

export default function UsersPage() {
  const { canEdit, canDelete, isLoaded } = usePermissions();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'save' | 'delete'>('save');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states - Matching DB columns
  const [NAME, setNAME] = useState('');
  const [ROLE, setROLE] = useState('sales_rep'); // internally sales_rep or admin
  const [PASSWORD, setPASSWORD] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_USERS')
        .select('*')
        .order('NAME');
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (user: any = null) => {
    setEditingUser(user);
    setNAME(user ? user.NAME : '');
    setROLE(user ? user.ROLE : 'sales_rep');
    setPASSWORD(user ? user.PASSWORD : '');
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
      if (editingUser) {
        const { error } = await app_lpos_supabase
          .from('app_lpos_USERS')
          .update({ NAME, ROLE, PASSWORD })
          .eq('ID', editingUser.ID);
        if (error) throw error;
      } else {
        const nextId = `U-${(users.length + 1).toString().padStart(4, '0')}`;
        const { error } = await app_lpos_supabase
          .from('app_lpos_USERS')
          .insert({ ID: nextId, NAME, ROLE, PASSWORD });
        if (error) throw error;
      }
      setIsConfirmOpen(false);
      setIsModalOpen(false);
      fetchUsers();
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
        .from('app_lpos_USERS')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ID?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Staff Management</h1>
        </div>
        {canEdit && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-8 py-4 bg-black text-[#D4AF37] rounded-2xl font-bold text-sm shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-5 h-5" />
            NEW USER
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name or user ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-56 bg-gray-100 rounded-[2.5rem] animate-pulse"></div>
          ))
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full">
            <NoData title="NO USERS FOUND" />
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.ID} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 group transition-all duration-500 hover:border-black/10">
              <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                  user.ROLE === 'admin' ? 'bg-black text-[#D4AF37]' : 'bg-gray-100 text-black/40'
                }`}>
                  {user.ROLE === 'admin' ? <Shield className="w-7 h-7" /> : <Users className="w-7 h-7" />}
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <button onClick={() => handleOpenModal(user)} className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-black transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(user.ID)} className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-xl text-black leading-tight">{user.NAME}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      user.ROLE === 'admin' ? 'text-[#D4AF37]' : 'text-gray-400'
                    }`}>
                      {user.ROLE === 'admin' ? 'admin' : 'user'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">PW: {'•'.repeat(user.PASSWORD?.length || 0)}</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{user.ID}</span>
                <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                  user.ROLE === 'admin' ? 'bg-black text-[#D4AF37]' : 'bg-gray-100 text-gray-500'
                }`}>
                  {user.ROLE === 'admin' ? 'admin' : 'user'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{editingUser ? 'Edit User' : 'New User'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-8">
              {/* NAME Field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">NAME</label>
                <input 
                  type="text" 
                  value={NAME}
                  onChange={(e) => setNAME(e.target.value)}
                  placeholder="Full Name"
                  required
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                />
              </div>

              {/* ROLE Field - Modern Toggle */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">ROLE</label>
                <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                  <button
                    type="button"
                    onClick={() => setROLE('sales_rep')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${
                      ROLE === 'sales_rep' 
                        ? 'bg-white text-black shadow-sm ring-1 ring-gray-100' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {ROLE === 'sales_rep' && <Check className="w-4 h-4" />}
                    user
                  </button>
                  <button
                    type="button"
                    onClick={() => setROLE('admin')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${
                      ROLE === 'admin' 
                        ? 'bg-black text-[#D4AF37] shadow-xl' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {ROLE === 'admin' && <Check className="w-4 h-4" />}
                    admin
                  </button>
                </div>
              </div>

              {/* PASSWORD Field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">PASSWORD</label>
                <div className="relative">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    value={PASSWORD}
                    onChange={(e) => setPASSWORD(e.target.value)}
                    placeholder="Access Code"
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
                  SAVE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onConfirm={confirmAction === 'save' ? executeSave : executeDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isSaving}
        title={confirmAction === 'save' ? 'Confirm Save' : 'Confirm Deletion'}
        message={confirmAction === 'save' ? 'Are you sure you want to save these changes?' : 'Are you sure you want to delete this user? This action cannot be undone.'}
      />
    </div>
  );
}
