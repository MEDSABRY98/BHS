import React, { useState } from 'react';
import { Trash2, X, Loader2 } from 'lucide-react';
import { FinancialAccount, deleteAccount } from '../../Service/FinancialService';

interface DeleteAccountModalProps {
  account: FinancialAccount;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteAccountModal({ account, onClose, onSuccess }: DeleteAccountModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAccount(account.ID);
      import('@/app/Components/Notification').then(({ toast }) => {
        toast.success('Account deleted successfully!');
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col items-center justify-center p-8 text-center relative">
        <button 
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 shadow-xl shadow-red-600/10">
          <Trash2 className="w-8 h-8" />
        </div>
        
        <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Account?</h3>
        
        <p className="text-sm font-semibold text-slate-600 mb-8 max-w-[280px]">
          Are you sure you want to delete <span className="text-red-600 font-bold">"{account.ACCOUNT_NAME}"</span>? This action cannot be undone.
        </p>
        
        {error && (
          <div className="p-3 mb-6 w-full rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 flex justify-center items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-red-600/30"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
