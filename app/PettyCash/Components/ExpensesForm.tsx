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

const defaultRow = (): ExpenseRow => ({
  amount: '',
  source: '',
  description: '',
  paid: 'Yes',
  date: new Date().toISOString().split('T')[0],
});

const cellInputClass =
  'w-full border-2 border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white bg-gray-50/60 rounded-xl px-3 py-2.5 text-sm transition-all outline-none text-center';

export default function ExpensesForm({ loading, onSubmit }: ExpensesFormProps) {
  const [expenseCart, setExpenseCart] = useState<ExpenseRow[]>([defaultRow()]);

  const addExpenseRow = () => {
    const lastDate = expenseCart[expenseCart.length - 1]?.date || defaultRow().date;
    setExpenseCart([...expenseCart, { ...defaultRow(), date: lastDate }]);
  };

  const removeExpenseRow = (index: number) => {
    if (expenseCart.length === 1) {
      setExpenseCart([defaultRow()]);
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
      [field]: value,
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
      setExpenseCart([defaultRow()]);
    }
  };

  const totalAccumulated = expenseCart.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <div className="max-w-[98%] mx-auto no-print animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden border border-gray-100">
        <div className="bg-gray-900 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-white">
            <div className="bg-red-500/20 p-2.5 rounded-xl backdrop-blur-sm border border-white/10">
              <TrendingDown className="w-5 h-5 text-red-200" />
            </div>
            <h3 className="text-xl font-black tracking-tight">New Expenses</h3>
          </div>
          <button
            type="button"
            onClick={addExpenseRow}
            disabled={loading}
            title="Add Row"
            className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl transition-all flex items-center justify-center border border-white/20 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50/90 border-b border-gray-100">
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[160px]">Date</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[140px]">AED</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[280px]">Recipient</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] min-w-[350px]">Description</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[120px]">Paid?</th>
                <th className="px-5 py-4 w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenseCart.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-4 text-center">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateExpenseRow(index, 'date', e.target.value)}
                      className={cellInputClass}
                    />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <input
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => updateExpenseRow(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className={`${cellInputClass} font-bold text-red-600`}
                    />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <input
                      type="text"
                      value={row.source}
                      onChange={(e) => updateExpenseRow(index, 'source', e.target.value)}
                      placeholder="Recipient name"
                      className={`${cellInputClass} font-semibold`}
                    />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => updateExpenseRow(index, 'description', e.target.value)}
                      placeholder="Expense details..."
                      className={cellInputClass}
                    />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex bg-gray-100 p-1 rounded-xl w-24 mx-auto border border-gray-200/60">
                      <button
                        type="button"
                        onClick={() => updateExpenseRow(index, 'paid', 'No')}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${row.paid === 'No' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                      >
                        NO
                      </button>
                      <button
                        type="button"
                        onClick={() => updateExpenseRow(index, 'paid', 'Yes')}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${row.paid === 'Yes' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}
                      >
                        YES
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => removeExpenseRow(index)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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

        <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600">
            <span>
              Total Rows: <span className="font-semibold text-gray-900">{expenseCart.length}</span>
            </span>
            <span>
              Accumulated Amount:{' '}
              <span className="font-semibold text-red-600">
                {totalAccumulated.toFixed(2)} AED
              </span>
            </span>
          </div>

          <div className="flex gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setExpenseCart([defaultRow()])}
              className="flex-1 lg:flex-none px-6 py-3 text-gray-500 font-bold bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-all"
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
  );
}
