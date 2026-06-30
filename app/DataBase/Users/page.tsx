'use client';

import { useState, useEffect } from 'react';
import { bhs_supabas, parseBoolFlag, toTextBoolFlag } from '@/lib/supabase';
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
  Check,
  FilePenLine,
  MapPin
} from 'lucide-react';
import { ConfirmModal } from '../../LPOs/Components/ConfirmModal';
import NoData from '@/app/Components/NoDataTab';
import { usePermissions } from '../../LPOs/Hooks/usePermissions';
import SignatureModal from './components/SignatureModal';
import { toast } from '@/app/Components/Notification';

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
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [selectedSignatureUserId, setSelectedSignatureUserId] = useState<string | undefined>(undefined);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  // Form states - Matching DB columns
  const [NAME, setNAME] = useState('');
  const [ROLE, setROLE] = useState('user');
  const [USER_TYPE, setUSER_TYPE] = useState('Creator');
  const [PASSWORD, setPASSWORD] = useState('');
  const [IS_IN_OFFICE, setIS_IN_OFFICE] = useState(false);
  const [CANCEL_AUTHORITY, setCANCEL_AUTHORITY] = useState(false);
  const [CITY, setCITY] = useState('');
  const [IS_SALESMANAGER, setIS_SALESMANAGER] = useState(false);

  useEffect(() => {
    const mainUserStr = localStorage.getItem('currentUser');
    if (mainUserStr) {
      const u = JSON.parse(mainUserStr);
      setCurrentAdmin({
        id: u.id || u.ID || 'R-0001',
        name: u.name || u.NAME || 'MED Sabry'
      });
    }
  }, []);

  // Fetch users when search term changes (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchUsers(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleOpenSignatureModal = (userId?: string) => {
    setSelectedSignatureUserId(userId);
    setIsSignatureModalOpen(true);
  };

  async function fetchUsers(search: string = '') {
    try {
      let query = bhs_supabas
        .from('bhs_USERS')
        .select('*');

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`NAME.ilike.${term},ID.ilike.${term}`);
      }

      const { data, error } = await query.order('NAME');
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
    setROLE(user ? user.ROLE : 'user');
    setUSER_TYPE(user ? user.USER_TYPE : 'Creator');
    setPASSWORD(user ? user.PASSWORD : '');
    setIS_IN_OFFICE(user ? user.IS_IN_OFFICE : false);
    setCANCEL_AUTHORITY(user ? parseBoolFlag(user.CANCEL_AUTHORITY) : false);
    setCITY(user ? user.CITY || '' : '');
    setIS_SALESMANAGER(user ? parseBoolFlag(user.IS_SALESMANAGER) : false);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave();
  };

  const executeSave = async () => {
    setIsSaving(true);
    const salesManagerValue = toTextBoolFlag(IS_SALESMANAGER);
    try {
      if (editingUser) {
        const { data, error } = await bhs_supabas
          .from('bhs_USERS')
          .update({
            NAME,
            ROLE,
            USER_TYPE,
            PASSWORD,
            IS_IN_OFFICE,
            CANCEL_AUTHORITY,
            CITY,
            IS_SALESMANAGER: salesManagerValue,
          })
          .eq('ID', editingUser.ID)
          .select('*')
          .single();
        if (error) throw error;
        if (data) {
          setUsers((prev) => prev.map((u) => (u.ID === data.ID ? data : u)));
        }
      } else {
        const { data: maxIdData, error: maxIdError } = await bhs_supabas
          .from('bhs_USERS_MAX_ID')
          .select('ID')
          .single();

        if (maxIdError && maxIdError.code !== 'PGRST116') {
          throw maxIdError;
        }

        let nextNum = 1;
        if (maxIdData && maxIdData.ID) {
          const match = maxIdData.ID.match(/^R-(\d+)$/i);
          if (match) {
            nextNum = parseInt(match[1], 10) + 1;
          }
        }
        const nextId = `R-${String(nextNum).padStart(4, '0')}`;

        const { error } = await bhs_supabas
          .from('bhs_USERS')
          .insert({
            ID: nextId,
            NAME,
            ROLE,
            USER_TYPE,
            PASSWORD,
            IS_IN_OFFICE,
            CANCEL_AUTHORITY,
            CITY,
            IS_SALESMANAGER: salesManagerValue,
          });
        if (error) throw error;
      }
      setIsConfirmOpen(false);
      setIsModalOpen(false);
      await fetchUsers(searchTerm);
      toast.success(editingUser ? 'User updated successfully!' : 'User added successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save user');
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
      const { error } = await bhs_supabas
        .from('bhs_USERS')
        .delete()
        .eq('ID', itemToDelete);
      if (error) throw error;
      fetchUsers(searchTerm);
      toast.success('User deleted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const filteredUsers = users;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">Users</h1>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenSignatureModal()}
              className="p-4 bg-white border border-gray-200 text-black hover:border-black hover:bg-gray-50 rounded-2xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
              title="Manage Signatures"
            >
              <FilePenLine className="w-6 h-6" />
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
              title="New User"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
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

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse bg-white border border-gray-100 rounded-[2.5rem] p-6 h-[220px] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl" />
                <div className="h-6 bg-gray-50 rounded-xl w-3/4" />
                <div className="h-4 bg-gray-50 rounded-xl w-1/2" />
              </div>
              <div className="h-10 bg-gray-50 rounded-2xl w-full" />
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <NoData title="NO USERS FOUND" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredUsers.map((user) => {
            const initials = user.NAME ? user.NAME.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '?';
            const isCancelAuth = parseBoolFlag(user.CANCEL_AUTHORITY);
            const isSalesManager = parseBoolFlag(user.IS_SALESMANAGER);

            return (
              <div
                key={user.ID}
                onClick={() => handleOpenModal(user)}
                className="group bg-white border border-gray-100 rounded-[2.5rem] p-6 hover:shadow-xl hover:border-black/5 transition-all duration-300 flex flex-col justify-between min-h-[220px] cursor-pointer"
              >
                <div>
                  {/* Top Row with Initials/Avatar and ID */}
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-black text-[#D4AF37] flex items-center justify-center font-black text-base shadow-lg shadow-black/10">
                      {initials}
                    </div>
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{user.ID}</span>
                  </div>

                  {/* Name and Role */}
                  <div className="mt-4">
                    <h3 className="font-black text-black text-base leading-tight group-hover:text-[#D4AF37] transition-colors">{user.NAME}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {/* Permission Role Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${user.ROLE === 'admin' ? 'bg-black text-[#D4AF37]' : 'bg-gray-50 text-gray-400'}`}>
                        {user.ROLE === 'admin' ? <Shield className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                        {user.ROLE}
                      </span>
                      {/* User Type Badge */}
                      <span className="inline-flex items-center px-3 py-1 bg-gray-50 text-gray-500 rounded-xl text-[9px] font-black uppercase tracking-widest">
                        {user.USER_TYPE || 'Creator'}
                      </span>
                    </div>
                  </div>

                  {/* Extra Capabilities Tags */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {user.IS_IN_OFFICE && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest">
                        <Check className="w-2.5 h-2.5" /> Office
                      </span>
                    )}
                    {isCancelAuth && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest">
                        <Shield className="w-2.5 h-2.5" /> Cancel Auth
                      </span>
                    )}
                    {user.CITY && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest">
                        <MapPin className="w-2.5 h-2.5" /> {user.CITY}
                      </span>
                    )}
                    {isSalesManager && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-amber-100">
                        <Shield className="w-2.5 h-2.5" /> Sales Manager
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer with Signature and Actions */}
                <div className="mt-6 pt-3 border-t border-gray-50 flex items-center justify-between">
                  {/* Signature Preview */}
                  <div>
                    {user.SIGNATURE ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={user.SIGNATURE}
                          alt="Signature"
                          className="h-8 max-w-[80px] object-contain bg-gray-50 border border-gray-100/50 rounded p-0.5"
                        />
                      </div>
                    ) : (
                      <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">No Signature</span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    {canEdit && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSignatureModal(user.ID);
                          }}
                          className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-black transition-all border border-transparent hover:border-gray-100"
                          title="Edit Signature"
                        >
                          <FilePenLine className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(user.ID);
                        }}
                        className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 pb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{editingUser ? 'Edit User' : 'New User'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 pt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

                {/* NAME Field (Full Width) */}
                <div className="space-y-2 md:col-span-2">
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

                {/* ROLE Toggle (admin/user) */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">PERMISSIONS</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setROLE('user')}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${ROLE === 'user'
                        ? 'bg-white text-black shadow-sm ring-1 ring-gray-100'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {ROLE === 'user' && <Check className="w-4 h-4" />}
                      user
                    </button>
                    <button
                      type="button"
                      onClick={() => setROLE('admin')}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${ROLE === 'admin'
                        ? 'bg-black text-[#D4AF37] shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {ROLE === 'admin' && <Check className="w-4 h-4" />}
                      admin
                    </button>
                  </div>
                </div>

                {/* USER_TYPE Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">USER TYPE</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setUSER_TYPE('Creator')}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${USER_TYPE === 'Creator'
                        ? 'bg-white text-black shadow-sm ring-1 ring-gray-100'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      Creator
                    </button>
                    <button
                      type="button"
                      onClick={() => setUSER_TYPE('Driver')}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${USER_TYPE === 'Driver'
                        ? 'bg-white text-black shadow-sm ring-1 ring-gray-100'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      Driver
                    </button>
                  </div>
                </div>

                {/* IS_IN_OFFICE Toggle */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">OFFICE STATUS</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setIS_IN_OFFICE(true)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${IS_IN_OFFICE
                        ? 'bg-emerald-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {IS_IN_OFFICE && <Check className="w-4 h-4" />}
                      TRUE
                    </button>
                    <button
                      type="button"
                      onClick={() => setIS_IN_OFFICE(false)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${!IS_IN_OFFICE
                        ? 'bg-red-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {!IS_IN_OFFICE && <Check className="w-4 h-4" />}
                      FALSE
                    </button>
                  </div>
                </div>

                {/* CANCEL_AUTHORITY Toggle */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CANCEL AUTHORITY</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setCANCEL_AUTHORITY(true)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${CANCEL_AUTHORITY
                        ? 'bg-emerald-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {CANCEL_AUTHORITY && <Check className="w-4 h-4" />}
                      TRUE
                    </button>
                    <button
                      type="button"
                      onClick={() => setCANCEL_AUTHORITY(false)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${!CANCEL_AUTHORITY
                        ? 'bg-red-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {!CANCEL_AUTHORITY && <Check className="w-4 h-4" />}
                      FALSE
                    </button>
                  </div>
                </div>

                {/* IS_SALESMANAGER Toggle */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">SALES MANAGER</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setIS_SALESMANAGER(true)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${IS_SALESMANAGER
                        ? 'bg-emerald-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {IS_SALESMANAGER && <Check className="w-4 h-4" />}
                      TRUE
                    </button>
                    <button
                      type="button"
                      onClick={() => setIS_SALESMANAGER(false)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${!IS_SALESMANAGER
                        ? 'bg-red-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {!IS_SALESMANAGER && <Check className="w-4 h-4" />}
                      FALSE
                    </button>
                  </div>
                </div>

                {/* CITY Field */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">CITY</label>
                  <div className="relative">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={CITY}
                      onChange={(e) => setCITY(e.target.value)}
                      placeholder="City Name"
                      className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                    />
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
        onConfirm={executeDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isSaving}
        title="Confirm Deletion"
        message="Are you sure you want to delete this user? This action cannot be undone."
      />

      {isSignatureModalOpen && currentAdmin && (
        <SignatureModal
          isOpen={isSignatureModalOpen}
          onClose={() => {
            setIsSignatureModalOpen(false);
            fetchUsers();
          }}
          currentAdminId={currentAdmin.id}
          currentAdminName={currentAdmin.name}
          initialUserId={selectedSignatureUserId}
        />
      )}
    </div>
  );
}
