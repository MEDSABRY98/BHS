import React, { useState } from 'react';
import { CheckCircle2, TrendingUp } from 'lucide-react';
import { toast } from '@/app/Components/Notification';

interface ReceiptsFormProps {
  loading: boolean;
  onSubmit: (formData: {
    amount: string;
    source: string;
    description: string;
    paid: string;
    date: string;
  }) => Promise<boolean>;
}

const defaultFormData = () => ({
  amount: '',
  source: '',
  description: '',
  paid: 'Yes',
  date: new Date().toISOString().split('T')[0],
});

const cellInputClass =
  'w-full border-2 border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white bg-gray-50/60 rounded-xl px-3 py-2.5 text-sm transition-all outline-none text-center';

export default function ReceiptsForm({ loading, onSubmit }: ReceiptsFormProps) {
  const [formData, setFormData] = useState(defaultFormData());

  const updateField = (field: keyof ReturnType<typeof defaultFormData>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.amount || !formData.source || !formData.description) {
      toast.warning('Please fill all fields');
      return;
    }
    const success = await onSubmit(formData);
    if (success) {
      setFormData(defaultFormData());
    }
  };

  const totalAmount = parseFloat(formData.amount) || 0;

  return (
    <div className="max-w-[98%] mx-auto no-print animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden border border-gray-100">
        <div className="bg-gray-900 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-white">
            <div className="bg-emerald-500/20 p-2.5 rounded-xl backdrop-blur-sm border border-white/10">
              <TrendingUp className="w-5 h-5 text-emerald-200" />
            </div>
            <h3 className="text-xl font-black tracking-tight">New Receipt</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50/90 border-b border-gray-100">
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[160px]">Date</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[140px]">AED</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[280px]">Source</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[350px]">Description</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[120px]">Paid?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50/70 transition-colors">
                <td className="px-5 py-4 text-center">
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => updateField('date', e.target.value)}
                    className={cellInputClass}
                  />
                </td>
                <td className="px-5 py-4 text-center">
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => updateField('amount', e.target.value)}
                    placeholder="0.00"
                    className={`${cellInputClass} font-bold text-emerald-600`}
                  />
                </td>
                <td className="px-5 py-4 text-center">
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => updateField('source', e.target.value)}
                    placeholder="Source name"
                    className={`${cellInputClass} font-semibold`}
                  />
                </td>
                <td className="px-5 py-4 text-center">
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Receipt description..."
                    className={cellInputClass}
                  />
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex bg-gray-100 p-1 rounded-xl w-24 mx-auto border border-gray-200/60">
                    <button
                      type="button"
                      onClick={() => updateField('paid', 'No')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${formData.paid === 'No' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                    >
                      NO
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('paid', 'Yes')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${formData.paid === 'Yes' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}
                    >
                      YES
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            Receipt Amount:{' '}
            <span className="font-semibold text-emerald-600">{totalAmount.toFixed(2)} AED</span>
          </p>

          <div className="flex gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setFormData(defaultFormData())}
              className="flex-1 lg:flex-none px-6 py-3 text-gray-500 font-bold bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-all"
            >
              Clear
            </button>
            <button
              type="button"
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
  );
}
