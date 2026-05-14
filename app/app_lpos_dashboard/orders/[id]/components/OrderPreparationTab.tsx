'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { UserPlus, Trash2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import SearchSelect from '../../../components/SearchSelect';
import { ConfirmModal } from '../../../components/ConfirmModal';

interface OrderPreparationTabProps {
  orderId: string;
}

export default function OrderPreparationTab({ orderId }: OrderPreparationTabProps) {
  const [prepStaff, setPrepStaff] = useState<any[]>([]);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [orderId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all staff for dropdown
      const { data: staffData } = await app_lpos_supabase
        .from('app_lpos_STAFF')
        .select('*')
        .order('NAME');
      setAllStaff(staffData || []);

      // Fetch current prep assignments for this order
      const { data: prepData } = await app_lpos_supabase
        .from('app_lpos_PREPARATION')
        .select('*')
        .eq('ORDER_ID', orderId)
        .order('PREPARED_AT', { ascending: false });
      setPrepStaff(prepData || []);
    } catch (error) {
      console.error('Error fetching prep data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNextId = async () => {
    const { data } = await app_lpos_supabase
      .from('app_lpos_PREPARATION')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return 'PRE-0001';

    const lastId = data[0].ID;
    const lastNum = parseInt(lastId.split('-')[1]);
    return `PRE-${(lastNum + 1).toString().padStart(4, '0')}`;
  };

  const handleAddStaff = async () => {
    if (!selectedStaffId) return;
    setIsActionLoading(true);

    try {
      const staffMember = allStaff.find(s => s.ID === selectedStaffId);
      const nextId = await generateNextId();

        const { error } = await app_lpos_supabase
        .from('app_lpos_PREPARATION')
        .insert([{
          ID: nextId,
          ORDER_ID: orderId,
          PREPARATION_NAME: staffMember.ID
        }]);

      if (error) throw error;
      
      setSelectedStaffId('');
      fetchData();
    } catch (error) {
      console.error('Error adding staff:', error);
      alert('Failed to add staff');
    } finally {
      setIsActionLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setStaffToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!staffToDelete) return;
    setIsActionLoading(true);
    try {
      const { error } = await app_lpos_supabase
        .from('app_lpos_PREPARATION')
        .delete()
        .eq('ID', staffToDelete);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting staff:', error);
    } finally {
      setIsDeleteModalOpen(false);
      setStaffToDelete(null);
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Assignment Form */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
        <div className="flex items-end gap-6">
          <div className="flex-1">
            <SearchSelect
              label="Select Staff Member"
              placeholder="Pick a warehouse worker..."
              options={allStaff.map(s => ({ id: s.ID, label: s.NAME }))}
              value={selectedStaffId}
              onChange={setSelectedStaffId}
            />
          </div>
          <button
            disabled={!selectedStaffId || isActionLoading}
            onClick={handleAddStaff}
            className="h-[68px] w-[68px] bg-black text-[#D4AF37] rounded-2xl font-black flex items-center justify-center hover:bg-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-black/10 active:scale-95"
          >
            <UserPlus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between mb-8 px-2">
          <h3 className="text-2xl font-black text-black">Warehouse Team</h3>
          <div className="px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-xs font-black uppercase tracking-widest">
            {prepStaff.length} Members
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 border-4 border-gray-100 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading staff assignments...</p>
          </div>
        ) : prepStaff.length === 0 ? (
          <div className="py-20 text-center bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100 mx-2">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Clock className="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-sm font-bold text-gray-400">No staff assigned to this order yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Assignment ID</th>
                  <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Staff Name</th>
                  <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Assigned At</th>
                  <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prepStaff.map((staff) => {
                  const staffInfo = allStaff.find(s => s.ID === staff.PREPARATION_NAME);
                  return (
                    <tr key={staff.ID} className="group hover:bg-gray-50/50 transition-all">
                      <td className="py-6 px-4">
                        <span className="text-xs font-black text-gray-400">{staff.ID}</span>
                      </td>
                      <td className="py-6 px-4">
                        <span className="text-sm font-black text-black">{staffInfo?.NAME || staff.PREPARATION_NAME}</span>
                      </td>
                    <td className="py-6 px-4">
                      <span className="text-xs text-gray-500 font-medium">
                        {new Date(staff.PREPARED_AT).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-6 px-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => confirmDelete(staff.ID)}
                          className="w-10 h-10 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onConfirm={executeDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        isLoading={isActionLoading}
        title="Remove Staff Member"
        message="Are you sure you want to remove this staff member from this order?"
      />
    </div>
  );
}
