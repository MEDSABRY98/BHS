'use client';

import { useState, useEffect, useRef } from 'react';
import { cleanSearch } from '@/app/DataBase/Utils/SearchUtils';
import { parseBoolFlag, toTextBoolFlag } from '@/lib/supabase';
import { adminListUsers, adminSaveUser, adminDeleteUser, adminRevealPassword } from '@/app/DataBase/Service/database_service';
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
  MapPin,
  Eye,
  Copy,
  ChevronDown,
  Smartphone,
} from 'lucide-react';
import { ConfirmModal } from '../../InvoicesTracking/Components/ConfirmModal';
import NoData from '@/app/Components/DataState/NoDataTab';
import { usePermissions } from '../../InvoicesTracking/Hooks/usePermissions';
import SignatureModal from './components/SignatureModal';
import { toast } from '@/app/Components/Notification';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';

/** Apps of the mobile BHS App (IDs must match AppModules.dart in the Flutter app). */
const MOBILE_APPS = [
  { id: 'customers', label: 'Customers' },
  { id: 'lpos', label: 'LPOs' },
  { id: 'inventory', label: 'Inventory Counting' },
];
const ALL_MOBILE_APP_IDS = MOBILE_APPS.map((a) => a.id);

/** bhs_USERS.MOBILE_APPS -> list of app IDs (empty column = every app). */
function readMobileApps(value: unknown): string[] {
  if (value === null || value === undefined) return [...ALL_MOBILE_APP_IDS];
  const list = Array.isArray(value)
    ? value
    : String(value).replace(/^\{|\}$/g, '').split(',');
  return list.map((v) => String(v).replace(/"/g, '').trim().toLowerCase()).filter(Boolean);
}

function MobileAppsDropdown({ value, onChange }: { value: string[]; onChange: (apps: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((a) => a !== id) : [...value, id]);
  const allSelected = ALL_MOBILE_APP_IDS.every((id) => value.includes(id));
  const summary =
    value.length === 0
      ? 'No apps'
      : allSelected
        ? 'All apps'
        : MOBILE_APPS.filter((a) => value.includes(a.id)).map((a) => a.label).join(', ');

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold flex items-center justify-between gap-3"
      >
        <span className={`truncate ${value.length === 0 ? 'text-gray-400' : ''}`}>{summary}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            type="button"
            onClick={() => onChange(allSelected ? [] : [...ALL_MOBILE_APP_IDS])}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all text-left"
          >
            <span
              className={`w-5 h-5 rounded-md border flex items-center justify-center ${allSelected ? 'bg-black border-black' : 'border-gray-300'}`}
            >
              {allSelected && <Check className="w-3.5 h-3.5 text-[#D4AF37]" />}
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Select all</span>
          </button>
          <div className="h-px bg-gray-100 my-1" />
          {MOBILE_APPS.map((app) => {
            const checked = value.includes(app.id);
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => toggle(app.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all text-left"
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center ${checked ? 'bg-black border-black' : 'border-gray-300'}`}
                >
                  {checked && <Check className="w-3.5 h-3.5 text-[#D4AF37]" />}
                </span>
                <span className="text-sm font-bold text-black">{app.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const { canEdit, canDelete, isLoaded } = usePermissions();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [isRevealing, setIsRevealing] = useState(false);
  const [IS_IN_OFFICE, setIS_IN_OFFICE] = useState(false);
  const [CANCEL_AUTHORITY, setCANCEL_AUTHORITY] = useState(false);
  const [CITY, setCITY] = useState('');
  const [TEAM, setTEAM] = useState('');
  const [mobileApps, setMobileApps] = useState<string[]>([...ALL_MOBILE_APP_IDS]);
  const [salesDataAccess, setSalesDataAccess] = useState(false);

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
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleOpenSignatureModal = (userId?: string) => {
    setSelectedSignatureUserId(userId);
    setIsSignatureModalOpen(true);
  };

  const usersSeq = useRef(0);
  async function fetchUsers(search: string = '') {
    const seq = ++usersSeq.current;
    setLoadError(null);
    try {
      const data = await adminListUsers(cleanSearch(search));
      if (seq !== usersSeq.current) return; // a newer search is already running
      setUsers(data || []);
    } catch (err) {
      if (seq !== usersSeq.current) return;
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (user: any = null) => {
    setEditingUser(user);
    setNAME(user ? user.NAME : '');
    setROLE(user ? user.ROLE : 'user');
    setUSER_TYPE(user ? user.USER_TYPE : 'Creator');
    setPASSWORD(''); // passwords are never sent to the browser; leave empty to keep
    setIS_IN_OFFICE(user ? user.IS_IN_OFFICE : false);
    setCANCEL_AUTHORITY(user ? parseBoolFlag(user.CANCEL_AUTHORITY) : false);
    setCITY(user ? user.CITY || '' : '');
    setTEAM(user ? user.TEAM || '' : '');
    setMobileApps(user ? readMobileApps(user.MOBILE_APPS) : [...ALL_MOBILE_APP_IDS]);
    setSalesDataAccess(user ? parseBoolFlag(user.FULL_DATA_ACCESS) : false);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave();
  };

  const executeSave = async () => {
    setIsSaving(true);
    const salesDataAccessValue = toTextBoolFlag(salesDataAccess);
    try {
      const saved = await adminSaveUser(
        {
          NAME,
          ROLE,
          USER_TYPE,
          PASSWORD, // empty when editing = keep the current password
          IS_IN_OFFICE,
          CANCEL_AUTHORITY,
          CITY,
          TEAM,
          // every app ticked = empty column (new apps added later are open to the user too)
          MOBILE_APPS: ALL_MOBILE_APP_IDS.every((id) => mobileApps.includes(id)) ? null : mobileApps,
          FULL_DATA_ACCESS: salesDataAccessValue,
        },
        editingUser ? editingUser.ID : null
      );
      if (editingUser && saved) {
        setUsers((prev) => prev.map((u) => (u.ID === (saved as any).ID ? saved : u)));
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

  const handleRevealPassword = async () => {
    if (!editingUser) return;
    setIsRevealing(true);
    try {
      const result = await adminRevealPassword(editingUser.ID);
      if (result.ok) {
        setPASSWORD(result.password);
      } else if (result.reason === 'hashed') {
        toast.error('This password is encrypted and cannot be shown. Type a new one instead.');
      } else {
        toast.error('This user has no password set.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load password');
    } finally {
      setIsRevealing(false);
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
      await adminDeleteUser(itemToDelete);
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

  // Loader only (no header / search) until the first load finishes
  const [firstLoad, setFirstLoad] = useState(true);
  useEffect(() => {
    if (!isLoading) setFirstLoad(false);
  }, [isLoading]);
  if (firstLoad) return <TabLoader />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">Users DB <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">{filteredUsers.length.toLocaleString()}</span></h1>
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
        <TabLoader className="!min-h-[60vh]" />
      ) : loadError ? (
        <TabFetchError message={loadError} onRetry={() => { setIsLoading(true); void fetchUsers(searchTerm); }} className="min-h-[60vh]" />
      ) : filteredUsers.length === 0 ? (
        <NoData title="NO USERS FOUND" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredUsers.map((user) => {
            const initials = user.NAME ? user.NAME.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '?';
            const isCancelAuth = parseBoolFlag(user.CANCEL_AUTHORITY);
            const hasSalesAccess = parseBoolFlag(user.FULL_DATA_ACCESS);

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
                      {/* Team Badge */}
                      {user.TEAM ? (
                        <span className="inline-flex items-center px-3 py-1 bg-amber-50 text-[#B8860B] rounded-xl text-[9px] font-black uppercase tracking-widest">
                          {user.TEAM}
                        </span>
                      ) : null}
                      {/* Mobile Apps Badges */}
                      {(() => {
                        const apps = readMobileApps(user.MOBILE_APPS);
                        if (ALL_MOBILE_APP_IDS.every((id) => apps.includes(id))) return null;
                        if (apps.length === 0) {
                          return (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest">
                              <Smartphone className="w-2.5 h-2.5" /> No apps
                            </span>
                          );
                        }
                        return MOBILE_APPS.filter((a) => apps.includes(a.id)).map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-widest"
                          >
                            <Smartphone className="w-2.5 h-2.5 text-[#D4AF37]" /> {a.label}
                          </span>
                        ));
                      })()}
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
                    {hasSalesAccess && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-amber-100">
                        <Shield className="w-2.5 h-2.5" /> Full Data Access
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

                {/* TEAM: users with the same team see and continue each other's work */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">TEAM</label>
                  <input
                    type="text"
                    list="user-teams"
                    value={TEAM}
                    onChange={(e) => setTEAM(e.target.value)}
                    placeholder="No team (own work only). Several teams: separate with comma"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                  />
                  <datalist id="user-teams">
                    {Array.from(new Set(users.map((u: any) => String(u.TEAM || '').trim()).filter(Boolean))).map((t) => (
                      <option key={t as string} value={t as string} />
                    ))}
                  </datalist>
                </div>

                {/* MOBILE APPS: which apps the user can open in the BHS mobile app */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">MOBILE APPS</label>
                  <MobileAppsDropdown value={mobileApps} onChange={setMobileApps} />
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

                {/* FULL_DATA_ACCESS Toggle */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">FULL DATA ACCESS</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setSalesDataAccess(true)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${salesDataAccess
                        ? 'bg-emerald-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {salesDataAccess && <Check className="w-4 h-4" />}
                      TRUE
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalesDataAccess(false)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${!salesDataAccess
                        ? 'bg-red-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {!salesDataAccess && <Check className="w-4 h-4" />}
                      FALSE
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
                      placeholder={editingUser ? 'Leave empty to keep current password' : 'Access Code'}
                      required={!editingUser}
                      autoComplete="new-password"
                      className="w-full pl-14 pr-28 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {editingUser && (
                        <button
                          type="button"
                          title="Show current password (admin only)"
                          disabled={isRevealing}
                          onClick={handleRevealPassword}
                          className="p-2 rounded-xl text-gray-400 hover:text-black hover:bg-gray-100 transition-all disabled:opacity-50"
                        >
                          {isRevealing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                        </button>
                      )}
                      {PASSWORD && (
                        <button
                          type="button"
                          title="Copy password"
                          onClick={() => {
                            navigator.clipboard?.writeText(PASSWORD).then(
                              () => toast.success('Password copied'),
                              () => toast.error('Could not copy')
                            );
                          }}
                          className="p-2 rounded-xl text-gray-400 hover:text-black hover:bg-gray-100 transition-all"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                      )}
                    </div>
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
