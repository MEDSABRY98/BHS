import React, { useState } from 'react';
import { Plus, CheckCircle2, X, TrendingDown } from 'lucide-react';
import { toast } from '@/app/Components/Notification';

interface ExpenseRow {
  amount: string;
  source: string;
  description: string;
  paid: string;
  date: string;
}

interface ExpensesFormProps {
  loading: boolean;
  onSubmit: (cart: ExpenseRow[]) => Promise<boolean>;
}

export default function ExpensesForm({ loading, onSubmit }: ExpensesFormProps) {
  const [expenseCart, setExpenseCart] = useState<ExpenseRow[]>([
    { amount: '', source: '', description: '', paid: 'No', date: new Date().toISOString().split('T')[0] }
  ]);

  const addExpenseRow = () => {
    const lastDate = expenseCart[expenseCart.length - 1]?.date || new Date().toISOString().split('T')[0];
    setExpenseCart([...expenseCart, { amount: '', source: '', description: '', paid: 'No', date: lastDate }]);
  };

  const removeExpenseRow = (index: number) => {
    if (expenseCart.length === 1) {
      setExpenseCart([{ amount: '', source: '', description: '', paid: 'No', date: new Date().toISOString().split('T')[0] }]);
      return;
    }
    const newCart = [...expenseCart];
    newCart.splice(index, 1);
    setExpenseCart(newCart);
  };

  const updateExpenseRow = (index: number, field: keyof ExpenseRow, value: string) => {
    const newCart = [...expenseCart];
    newCart[index] = {
      ...newCart[index],
      [field]: value
    };
    setExpenseCart(newCart);
  };

  const handleSave = async () => {
    const validRows = expenseCart.filter(row => row.amount && row.source && row.description);

    if (validRows.length === 0) {
      toast.warning('Please fill at least one complete expense row');
      return;
    }

    const success = await onSubmit(validRows);
    if (success) {
      setExpenseCart([{ amount: '', source: '', description: '', paid: 'No', date: new Date().toISOString().split('T')[0] }]);
    }
  };

  const totalAccumulated = expenseCart.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <div className="max-w-[98%] mx-auto no-print">
      <div className="space-y-6">
        <div>
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-gray-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold uppercase tracking-wider">New Expenses</h3>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={addExpenseRow}
                  disabled={loading}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 border border-white/20"
                >
                  <Plus className="w-4 h-4" /> Add Row
                </button>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest w-[160px]">Date</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest w-[140px]">AED</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest w-[280px]">Recipient</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest min-w-[350px]">Description</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest w-[120px]">Paid?</th>
                    <th className="px-6 py-4 w-[60px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenseCart.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-3 text-center">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateExpenseRow(index, 'date', e.target.value)}
                          className="w-full border-2 border-transparent hover:border-gray-200 focus:border-black focus:bg-white bg-transparent rounded-lg px-3 py-2 text-sm transition-all outline-none text-center"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          value={row.amount}
                          onChange={(e) => updateExpenseRow(index, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="w-full border-2 border-transparent hover:border-gray-200 focus:border-black focus:bg-white bg-transparent rounded-lg px-3 py-2 text-sm font-bold text-red-600 transition-all outline-none text-center"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <input
                          type="text"
                          value={row.source}
                          onChange={(e) => updateExpenseRow(index, 'source', e.target.value)}
                          placeholder="Recipient name"
                          className="w-full border-2 border-transparent hover:border-gray-200 focus:border-black focus:bg-white bg-transparent rounded-lg px-3 py-2 text-sm font-semibold transition-all outline-none text-center"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateExpenseRow(index, 'description', e.target.value)}
                          placeholder="Expense details..."
                          className="w-full border-2 border-transparent hover:border-gray-200 focus:border-black focus:bg-white bg-transparent rounded-lg px-3 py-2 text-sm transition-all outline-none text-center"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex bg-gray-100 p-1 rounded-lg w-24 mx-auto">
                          <button
                            type="button"
                            onClick={() => updateExpenseRow(index, 'paid', 'No')}
                            className={`flex-1 py-1 rounded-md text-[10px] font-black transition-all ${row.paid === 'No' ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}
                          >
                            NO
                          </button>
                          <button
                            type="button"
                            onClick={() => updateExpenseRow(index, 'paid', 'Yes')}
                            className={`flex-1 py-1 rounded-md text-[10px] font-black transition-all ${row.paid === 'Yes' ? 'bg-black text-white shadow-sm' : 'text-gray-400'}`}
                          >
                            YES
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeExpenseRow(index)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove Row"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 px-6 py-6 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex gap-8">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Rows</p>
                  <p className="text-xl font-bold text-gray-700">{expenseCart.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Accumulated Amount</p>
                  <p className="text-xl font-bold text-red-600">
                    {totalAccumulated.toFixed(2)} <span className="text-xs">AED</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setExpenseCart([{ amount: '', source: '', description: '', paid: 'No', date: new Date().toISOString().split('T')[0] }])}
                  className="flex-1 md:flex-none px-6 py-3 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-all"
                >
                  Clear All
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
                      <span>Saving Records...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Save Expenses</span>
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
