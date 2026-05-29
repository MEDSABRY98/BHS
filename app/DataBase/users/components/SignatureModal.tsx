'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
import { X, Loader2, Save, FilePenLine } from 'lucide-react';
import SignaturePad from '@/app/DataBase/users/components/SignaturePad';
import SearchSelect from '../../../LPOs/Components/DropDownList';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdminId: string;
  currentAdminName: string;
  initialUserId?: string;
}

export default function SignatureModal({
  isOpen,
  onClose,
  currentAdminId,
  currentAdminName,
  initialUserId
}: SignatureModalProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserSignature, setSelectedUserSignature] = useState<string | null>(null);
  const [newSignatureBase64, setNewSignatureBase64] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(initialUserId || currentAdminId);
    }
  }, [initialUserId, currentAdminId, isOpen]);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserSignature(selectedUserId);
    } else {
      setSelectedUserSignature(null);
      setNewSignatureBase64('');
    }
  }, [selectedUserId]);

  async function fetchUsers() {
    setIsLoading(true);
    try {
      const { data, error } = await app_lpos_supabase
        .from('bhs_USERS')
        .select('*')
        .order('NAME');

      if (error) throw error;

      const sortedUsers = (data || []).sort((a, b) => {
        if (a.ID === currentAdminId) return -1;
        if (b.ID === currentAdminId) return 1;
        if (a.USER_TYPE === 'Driver' && b.USER_TYPE !== 'Driver') return -1;
        if (a.USER_TYPE !== 'Driver' && b.USER_TYPE === 'Driver') return 1;
        return a.NAME.localeCompare(b.NAME);
      });

      setUsers(sortedUsers);
    } catch (err) {
      console.error('Error fetching users for signatures:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUserSignature(userId: string) {
    try {
      const { data, error } = await app_lpos_supabase
        .from('bhs_USERS')
        .select('SIGNATURE')
        .eq('ID', userId)
        .single();

      if (error) throw error;
      setSelectedUserSignature(data?.SIGNATURE || null);
      setNewSignatureBase64('');
    } catch (err) {
      console.error('Error fetching user signature:', err);
    }
  }

  async function handleSave() {
    if (!selectedUserId || !newSignatureBase64) return;
    setIsSaving(true);
    setSuccessMsg('');
    try {
      const { error } = await app_lpos_supabase
        .from('bhs_USERS')
        .update({ SIGNATURE: newSignatureBase64 })
        .eq('ID', selectedUserId);

      if (error) throw error;

      setSelectedUserSignature(newSignatureBase64);
      setSuccessMsg('Signature saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error saving signature:', err);
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[3rem] p-8 md:p-10 w-full max-w-3xl shadow-2xl border border-gray-100 flex flex-col relative animate-in zoom-in-95 duration-200">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-all cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="w-12 h-12 bg-black text-[#D4AF37] rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-black/10">
            <FilePenLine className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black text-black tracking-tight">
            Manage Signatures
          </h3>
        </div>

        {/* Form Body */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading...</span>
          </div>
        ) : (
          <div className="space-y-6">

            {/* User Selector */}
            <SearchSelect
              label="Select Profile"
              placeholder="Pick a profile..."
              options={users.map((u) => ({
                id: u.ID,
                label: u.NAME,
                subLabel: `${u.USER_TYPE || u.ROLE}${u.ID === currentAdminId ? ' (You)' : ''}`
              }))}
              value={selectedUserId}
              onChange={(val) => {
                if (val) setSelectedUserId(val);
              }}
              isLoading={isLoading}
            />

            {/* Existing Signature View */}
            {selectedUserSignature && !newSignatureBase64 && (
              <div className="bg-gray-50 border border-gray-100 rounded-3xl p-4 flex flex-col items-center justify-center relative">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 block self-start">
                  Current Saved Signature
                </span>
                <div className="bg-white rounded-2xl p-2 w-full flex items-center justify-center border border-gray-100/50">
                  <img
                    src={selectedUserSignature}
                    alt="Signature"
                    className="max-h-36 object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserSignature(null)}
                  className="mt-3 text-[10px] font-black text-[#D4AF37] hover:text-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Redraw Signature
                </button>
              </div>
            )}

            {/* Signature Draw Area */}
            {(!selectedUserSignature || newSignatureBase64) && (
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                  Draw Signature
                </label>
                <SignaturePad onSave={setNewSignatureBase64} />
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-center text-xs font-bold animate-in fade-in duration-300">
                {successMsg}
              </div>
            )}

            {/* Save Button */}
            {newSignatureBase64 && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-4 bg-black text-[#D4AF37] rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-gray-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Save Signature
              </button>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
