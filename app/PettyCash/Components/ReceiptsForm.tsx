import React, { useState } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';

interface ReceiptsFormProps {
  loading: boolean;
  onSubmit: (formData: {
    amount: string;
    source: string;
    description: string;
    paid: string;
    date: string;
  }) => Promise<boolean>; // return true if save was successful, to reset the form
}

export default function ReceiptsForm({ loading, onSubmit }: ReceiptsFormProps) {
  const [formData, setFormData] = useState({
    amount: '',
    source: '',
    description: '',
    paid: 'No',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSave = async () => {
    if (!formData.amount || !formData.source || !formData.description) {
      toast.warning('Please fill all fields');
      return;
    }
    const success = await onSubmit(formData);
    if (success) {
      setFormData({
        amount: '',
        source: '',
        description: '',
        paid: 'No',
        date: new Date().toISOString().split('T')[0]
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto no-print">
      <div className="space-y-6">
        <div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-black text-white p-2 rounded-lg">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold">New Receipt</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <label className="block font-semibold mb-2 text-sm text-gray-700">Source</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                    placeholder="Source name"
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
              </div>

              <div>
                <label className="block font-semibold mb-2 text-sm text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors resize-none"
                  rows={3}
                  placeholder="Receipt description"
                />
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 bg-slate-900 text-white min-w-[220px] py-3 rounded-xl font-bold text-base hover:bg-black hover:translate-y-[-1px] transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Save Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
