import React, { useState, useEffect } from 'react';
import { X, CheckCircle2 } from 'lucide-react';

interface EditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: any;
  entryType: 'receipt' | 'expense';
  onUpdate: (formData: {
    date: string;
    amount: string;
    source: string;
    description: string;
    paid: string;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  loading: boolean;
}

export default function EditEntryModal({
  isOpen,
  onClose,
  entry,
  entryType,
  onUpdate,
  onDelete,
  loading
}: EditEntryModalProps) {
  const [formData, setFormData] = useState({
    date: '',
    amount: '',
    source: '',
    description: '',
    paid: 'No'
  });

  useEffect(() => {
    if (entry) {
      setFormData({
        date: entry.date || '',
        amount: entry.amount ? entry.amount.toString() : '',
        source: entry.source || '',
        description: entry.description || '',
        paid: entry.paid || 'No'
      });
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  const handleUpdate = () => {
    if (!formData.date || !formData.amount || !formData.source || !formData.description) {
      alert('Please fill all fields');
      return;
    }
    onUpdate(formData);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 no-print">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800">
            {entryType === 'receipt' ? 'Edit Receipt' : 'Edit Expense'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-2 text-sm text-gray-700">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2 text-sm text-gray-700">Amount</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2 text-sm text-gray-700">
              {entryType === 'receipt' ? 'Source' : 'Recipient'}
            </label>
            <input
              type="text"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
              placeholder={entryType === 'receipt' ? 'Source name' : 'Recipient name'}
            />
          </div>

          <div>
            <label className="block font-semibold mb-2 text-sm text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors resize-none"
              rows={3}
              placeholder="Description"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2 text-sm text-gray-700">Paid?</label>
            <div className="flex bg-gray-100 p-1 rounded-xl h-[52px]">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paid: 'No' })}
                className={`flex-1 rounded-lg font-bold transition-all ${formData.paid === 'No' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paid: 'Yes' })}
                className={`flex-1 rounded-lg font-bold transition-all ${formData.paid === 'Yes' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Yes
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleUpdate}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold text-base hover:bg-black hover:translate-y-[-1px] transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update</span>
                </>
              )}
            </button>
            <button
              onClick={onDelete}
              disabled={loading}
              className="flex-1 bg-red-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
