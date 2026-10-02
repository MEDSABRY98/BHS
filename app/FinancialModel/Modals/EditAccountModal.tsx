import React, { useState, useEffect } from 'react';
import { X, Loader2, Edit2, Save } from 'lucide-react';
import { updateAccount, FinancialAccount } from '../Service/FinancialService';

interface EditAccountModalProps {
  account: FinancialAccount;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditAccountModal({ account, onClose, onSuccess }: EditAccountModalProps) {
  const [accountCode, setAccountCode] = useState(account.ACCOUNT_CODE || '');
  const [accountName, setAccountName] = useState(account.ACCOUNT_NAME || '');
  const [accountType, setAccountType] = useState(account.ACCOUNT_TYPE || 'REVENUE');
  const [accountCategory, setAccountCategory] = useState(account.ACCOUNT_CATEGORY || '');
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountCode || !accountName || !accountType) {
      setError('Please fill in all required fields');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    try {
      await updateAccount(account.ID, {
        ACCOUNT_CODE: accountCode,
        ACCOUNT_NAME: accountName,
        ACCOUNT_TYPE: accountType,
        ACCOUNT_CATEGORY: accountCategory || 'General',
      });
      import('@/app/Components/Notification').then(({ toast }) => {
        toast.success('Account updated successfully!');
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update account');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f0f0f] flex items-center justify-center shadow-lg shadow-black/10">
              <Edit2 className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Edit Account</h2>
              <p className="text-xs font-semibold text-slate-500">Update details for {account.ACCOUNT_NAME}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold">
              {error}
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Account Code *</label>
            <input 
              type="text" 
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
              placeholder="e.g. REV-04"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all text-slate-900 font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Account Name *</label>
            <input 
              type="text" 
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Online Subscriptions"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all text-slate-900 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Account Type *</label>
              <select 
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all text-slate-900 font-semibold"
              >
                <option value="REVENUE">Revenue</option>
                <option value="COGS">COGS (Cost)</option>
                <option value="EXPENSE">Expenses</option>
                <option value="DEPRECIATION">Depreciation</option>
                <option value="TAXES">Taxes</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Category</label>
              <input 
                type="text" 
                value={accountCategory}
                onChange={(e) => setAccountCategory(e.target.value)}
                placeholder="e.g. Marketing"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all text-slate-900 font-semibold"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 bg-[#0f0f0f] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black transition-colors px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-black/10 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
