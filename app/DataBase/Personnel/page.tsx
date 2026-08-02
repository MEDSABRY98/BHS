'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Loader2,
  Check,
  UserCheck,
  UserMinus,
  Briefcase
} from 'lucide-react';
import { ConfirmModal } from '../../LPOs/Components/ConfirmModal';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { fetchPersonnel, addPersonnel, updatePersonnel, deletePersonnel } from '../Service/database_service';

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [NAME, setNAME] = useState('');
  const [ROLE_TYPE, setROLE_TYPE] = useState('sales_rep');
  const [IS_ACTIVE, setIS_ACTIVE] = useState(true);
  const [SUPERVISOR_ID, setSUPERVISOR_ID] = useState('');

  // Fetch personnel when search term changes (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      loadPersonnel();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  async function loadPersonnel() {
    try {
      const json = await fetchPersonnel();
      if (!json.success) throw new Error(json.error || 'Failed to load personnel');
      
      let data = json.data || [];
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        data = data.filter((p: any) => 
          (p.NAME && p.NAME.toLowerCase().includes(term)) || 
          (p.ID && p.ID.toLowerCase().includes(term))
        );
      }
      setPersonnel(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenModal = (person: any = null) => {
    setEditingPerson(person);
    setNAME(person ? person.NAME : '');
    setROLE_TYPE(person ? person.ROLE_TYPE : 'sales_rep');
    setIS_ACTIVE(person ? person.IS_ACTIVE : true);
    setSUPERVISOR_ID(person ? person.SUPERVISOR_ID || '' : '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let res;
      if (editingPerson) {
        res = await updatePersonnel(editingPerson.ID, NAME, ROLE_TYPE, IS_ACTIVE, SUPERVISOR_ID);
      } else {
        res = await addPersonnel(NAME, ROLE_TYPE, IS_ACTIVE, SUPERVISOR_ID);
      }
      
      if (!res.success) throw new Error(res.error || 'Failed to save');

      setIsModalOpen(false);
      await loadPersonnel();
      toast.success(editingPerson ? 'Updated successfully!' : 'Added successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    setIsSaving(true);
    try {
      const res = await deletePersonnel(itemToDelete);
      if (!res.success) throw new Error(res.error || 'Failed to delete');
      
      loadPersonnel();
      toast.success('Deleted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">Sales Personnel DB <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">{personnel.length.toLocaleString()}</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenModal()}
            className="p-4 bg-black text-[#D4AF37] rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
            title="New Personnel"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or ID..."
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
            </div>
          ))}
        </div>
      ) : personnel.length === 0 ? (
        <NoData title="NO PERSONNEL FOUND" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {personnel.map((person) => {
            const initials = person.NAME ? person.NAME.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '?';

            return (
              <div
                key={person.ID}
                onClick={() => handleOpenModal(person)}
                className="group bg-white border border-gray-100 rounded-[2.5rem] p-6 hover:shadow-xl hover:border-black/5 transition-all duration-300 flex flex-col justify-between min-h-[220px] cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-black text-[#D4AF37] flex items-center justify-center font-black text-base shadow-lg shadow-black/10">
                      {initials}
                    </div>
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{person.ID}</span>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-black text-black text-base leading-tight group-hover:text-[#D4AF37] transition-colors">{person.NAME}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${person.ROLE_TYPE === 'sales_rep' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        <Briefcase className="w-2.5 h-2.5" />
                        {person.ROLE_TYPE === 'sales_rep' ? 'Sales Rep' : 'Merchandiser'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {person.IS_ACTIVE ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest">
                        <UserCheck className="w-2.5 h-2.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest">
                        <UserMinus className="w-2.5 h-2.5" /> Inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-gray-50 flex items-end justify-end">
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(person.ID);
                      }}
                      className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 pb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{editingPerson ? 'Edit Personnel' : 'New Personnel'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 pt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
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

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">ROLE TYPE</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setROLE_TYPE('sales_rep')}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${ROLE_TYPE === 'sales_rep'
                        ? 'bg-black text-[#D4AF37] shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {ROLE_TYPE === 'sales_rep' && <Check className="w-4 h-4" />}
                      Sales Rep
                    </button>
                    <button
                      type="button"
                      onClick={() => setROLE_TYPE('merchandiser')}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${ROLE_TYPE === 'merchandiser'
                        ? 'bg-black text-[#D4AF37] shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {ROLE_TYPE === 'merchandiser' && <Check className="w-4 h-4" />}
                      Merchandiser
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">STATUS</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setIS_ACTIVE(true)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${IS_ACTIVE
                        ? 'bg-emerald-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {IS_ACTIVE && <Check className="w-4 h-4" />}
                      ACTIVE
                    </button>
                    <button
                      type="button"
                      onClick={() => setIS_ACTIVE(false)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${!IS_ACTIVE
                        ? 'bg-red-500 text-white shadow-xl'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {!IS_ACTIVE && <Check className="w-4 h-4" />}
                      INACTIVE
                    </button>
                  </div>
                </div>
                
                {ROLE_TYPE === 'merchandiser' && (
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">SUPERVISOR (SALES REP)</label>
                    <select
                      value={SUPERVISOR_ID}
                      onChange={(e) => setSUPERVISOR_ID(e.target.value)}
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold appearance-none"
                    >
                      <option value="">-- No Supervisor --</option>
                      {personnel.filter(p => p.ROLE_TYPE === 'sales_rep' && p.IS_ACTIVE).map(rep => (
                        <option key={rep.ID} value={rep.ID}>
                          {rep.NAME} ({rep.ID})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
        message="Are you sure you want to delete this person? This action cannot be undone."
      />
    </div>
  );
}
