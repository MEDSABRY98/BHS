import React, { useState, useEffect } from 'react';
import { Save, Loader2, Calendar, Plus, Edit2 } from 'lucide-react';
import DataLoader from '@/app/Components/Loading/DataLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import AddAccountModal from '../Modals/AddAccountModal';
import EditAccountModal from '../Modals/EditAccountModal';
import { fetchAccounts, fetchEntriesByMonthYear, saveFinancialEntries, FinancialAccount } from '../Service/FinancialService';

interface EntryFormState {
  [accountId: string]: {
    ACTUAL_AMOUNT: number;
    FORECAST_AMOUNT: number;
  };
}

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

const YEARS = [2024, 2025, 2026, 2027, 2028];

export function DataEntryTab() {
  const [selectedMonth, setSelectedMonth] = useState<number | string>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number | string>(new Date().getFullYear());
  
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [entries, setEntries] = useState<EntryFormState>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    const month = Number(selectedMonth);
    const year = Number(selectedYear);
    if (!month || !year || month < 1 || month > 12) return;

    setIsLoading(true);
    try {
      const [accs, monthEntries] = await Promise.all([
        fetchAccounts(),
        fetchEntriesByMonthYear(month, year)
      ]);
      
      accs.sort((a, b) => a.ACCOUNT_NAME.localeCompare(b.ACCOUNT_NAME));
      setAccounts(accs);
      
      const newEntriesState: EntryFormState = {};
      accs.forEach(acc => {
        const existingEntry = monthEntries.find(e => e.ACCOUNT_ID === acc.ID);
        newEntriesState[acc.ID] = {
          ACTUAL_AMOUNT: existingEntry?.ACTUAL_AMOUNT || 0,
          FORECAST_AMOUNT: existingEntry?.FORECAST_AMOUNT || 0,
        };
      });
      setEntries(newEntriesState);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (val: number): string => {
    if (val === 0) return '';
    return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const parseNumber = (str: string): number => {
    const cleaned = str.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleInputChange = (accountId: string, field: 'ACTUAL_AMOUNT' | 'FORECAST_AMOUNT', value: string) => {
    // allow typing: strip commas, keep raw value
    const numValue = parseNumber(value);
    setEntries(prev => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [field]: numValue
      }
    }));
  };

  const handleInputBlur = (accountId: string, field: 'ACTUAL_AMOUNT' | 'FORECAST_AMOUNT', value: string) => {
    const numValue = parseNumber(value);
    setEntries(prev => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [field]: numValue
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dataToSave = Object.keys(entries).map(accountId => ({
        ACCOUNT_ID: accountId,
        PERIOD_MONTH: Number(selectedMonth),
        PERIOD_YEAR: Number(selectedYear),
        ACTUAL_AMOUNT: entries[accountId].ACTUAL_AMOUNT,
        FORECAST_AMOUNT: entries[accountId].FORECAST_AMOUNT,
      }));
      await saveFinancialEntries(dataToSave);
      toast.success('Data saved successfully!');
    } catch (error) {
      console.error('Failed to save data:', error);
      toast.error('Error saving data');
    } finally {
      setIsSaving(false);
    }
  };

  // Group accounts by type for display
  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.ACCOUNT_TYPE]) acc[account.ACCOUNT_TYPE] = [];
    acc[account.ACCOUNT_TYPE].push(account);
    return acc;
  }, {} as Record<string, FinancialAccount[]>);

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'REVENUE': return 'Revenues';
      case 'COGS': return 'Cost of Goods Sold';
      case 'EXPENSE': return 'Expenses';
      case 'DEPRECIATION': return 'Depreciation';
      case 'TAXES': return 'Taxes';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Dark Header */}
      <div className="bg-[#0f0f0f] rounded-3xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
            <Save className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">P&L Data</h1>
            <div className="h-0.5 w-16 bg-[#D4AF37] mt-1 rounded-full" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="number" min={1} max={12} placeholder="MM"
                className="w-20 pl-8 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-center font-black text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/30"
                value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              />
              <Calendar className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <span className="text-white/20 font-light text-xl">/</span>
            <input
              type="number" min={2000} max={2100} placeholder="YYYY"
              className="w-24 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-center font-black text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/30"
              value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            title="Add Account"
            className="flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors w-11 h-11 rounded-xl"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || isLoading || accounts.length === 0}
            className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#c9a430] text-black transition-colors px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-black/20 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Main Form Area */}
      {isLoading ? (
        <DataLoader message="" className="min-h-[400px]" />
      ) : accounts.length === 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60">
          
          <div className="grid grid-cols-12 gap-4 mb-4 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500">
            <div className="col-span-6 text-center">Account Name</div>
            <div className="col-span-3 text-center text-blue-600">Forecast Amount</div>
            <div className="col-span-3 text-center text-emerald-600">Actual Amount</div>
          </div>

          <div className="space-y-8">
            {['REVENUE', 'COGS', 'EXPENSE', 'DEPRECIATION', 'TAXES'].map((type) => {
              const typeAccounts = groupedAccounts[type] || [];
              if (typeAccounts.length === 0) return null;

              return (
                <div key={type} className="space-y-3">
                  <h3 className="font-black text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">
                    {getTypeLabel(type)}
                  </h3>
                  
                  {typeAccounts.map((acc) => (
                    <div key={acc.ID} className="grid grid-cols-12 gap-4 items-center px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors group">
                      <div className="col-span-6 flex items-center justify-center gap-2">
                        <span className="font-bold text-slate-700">{acc.ACCOUNT_NAME}</span>
                        <button 
                          onClick={() => setEditingAccount(acc)}
                          className="p-1.5 text-slate-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit Account Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="col-span-3 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input 
                          type="text"
                          inputMode="decimal"
                          value={entries[acc.ID]?.FORECAST_AMOUNT ? formatNumber(entries[acc.ID].FORECAST_AMOUNT) : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '');
                            setEntries(prev => ({ ...prev, [acc.ID]: { ...prev[acc.ID], FORECAST_AMOUNT: raw === '' ? 0 : parseFloat(raw) || 0 } }));
                          }}
                          onBlur={(e) => handleInputBlur(acc.ID, 'FORECAST_AMOUNT', e.target.value)}
                          className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-lg text-slate-700 font-bold transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-3 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input 
                          type="text"
                          inputMode="decimal"
                          value={entries[acc.ID]?.ACTUAL_AMOUNT ? formatNumber(entries[acc.ID].ACTUAL_AMOUNT) : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '');
                            setEntries(prev => ({ ...prev, [acc.ID]: { ...prev[acc.ID], ACTUAL_AMOUNT: raw === '' ? 0 : parseFloat(raw) || 0 } }));
                          }}
                          onBlur={(e) => handleInputBlur(acc.ID, 'ACTUAL_AMOUNT', e.target.value)}
                          className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20 rounded-lg text-slate-700 font-bold transition-all text-center"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

        </div>
      )}

      {isAddModalOpen && (
        <AddAccountModal 
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            loadData();
          }}
        />
      )}

      {editingAccount && (
        <EditAccountModal 
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={() => {
            setEditingAccount(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
