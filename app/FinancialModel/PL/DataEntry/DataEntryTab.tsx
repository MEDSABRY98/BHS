import React, { useState, useEffect } from 'react';
import { Save, Loader2, Calendar, Plus, Edit2, Trash2, Download, Upload, ArrowUp, ArrowDown, Search, X } from 'lucide-react';
import DataLoader from '@/app/Components/Loading/DataLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import AddAccountModal from '../Modals/AddAccountModal';
import EditAccountModal from '../Modals/EditAccountModal';
import DeleteAccountModal from '../Modals/DeleteAccountModal';
import { fetchAccounts, fetchEntriesByMonthYear, saveFinancialEntries, FinancialAccount, createAccount, updateAccountOrder, updateAccount } from '../../Service/FinancialService';

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
  const [deletingAccount, setDeletingAccount] = useState<FinancialAccount | null>(null);
  const [activeType, setActiveType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();

    const handleRefresh = () => loadData(true);
    window.addEventListener('refresh-financial-model', handleRefresh);
    return () => window.removeEventListener('refresh-financial-model', handleRefresh);
  }, [selectedMonth, selectedYear]);

  const loadData = async (silent = false) => {
    const month = Number(selectedMonth);
    const year = Number(selectedYear);
    if (!month || !year || month < 1 || month > 12) return;

    if (!silent) setIsLoading(true);
    try {
      const [accs, monthEntries] = await Promise.all([
        fetchAccounts(),
        fetchEntriesByMonthYear(month, year)
      ]);
      
      accs.sort((a, b) => {
        const orderA = a.ORDER_INDEX || 0;
        const orderB = b.ORDER_INDEX || 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.ACCOUNT_NAME.localeCompare(b.ACCOUNT_NAME);
      });
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
      if (!silent) setIsLoading(false);
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

  const moveAccount = async (account: FinancialAccount, direction: 'up' | 'down', siblings?: FinancialAccount[]) => {
    const typeAccounts = accounts.filter(a => a.ACCOUNT_TYPE === account.ACCOUNT_TYPE);
    // Move within the visible group (e.g. category group) when provided
    const group = siblings && siblings.length > 0 ? siblings : typeAccounts;
    const index = group.findIndex(a => a.ID === account.ID);
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === group.length - 1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const targetAccount = group[targetIndex];
    
    // Ensure both have explicit unique order indices before swapping
    const currentOrders = typeAccounts.map(a => typeof a.ORDER_INDEX === 'number' ? a.ORDER_INDEX : 0);
    const hasDuplicates = new Set(currentOrders).size !== currentOrders.length;
    
    let updates = typeAccounts.map((a, i) => ({
      id: a.ID,
      order: hasDuplicates ? i : (typeof a.ORDER_INDEX === 'number' ? a.ORDER_INDEX : i)
    }));
    
    const accUpdate = updates.find(u => u.id === account.ID);
    const targetUpdate = updates.find(u => u.id === targetAccount.ID);
    
    if (accUpdate && targetUpdate) {
      const temp = accUpdate.order;
      accUpdate.order = targetUpdate.order;
      targetUpdate.order = temp;
    }
    
    const newAccounts = accounts.map(a => {
      const up = updates.find(u => u.id === a.ID);
      if (up) return { ...a, ORDER_INDEX: up.order };
      return a;
    });
    
    newAccounts.sort((a, b) => {
      const orderA = a.ORDER_INDEX || 0;
      const orderB = b.ORDER_INDEX || 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.ACCOUNT_NAME.localeCompare(b.ACCOUNT_NAME);
    });
    
    setAccounts(newAccounts);
    
    try {
      const updatesToSend = hasDuplicates ? updates : [accUpdate!, targetUpdate!];
      await updateAccountOrder(updatesToSend);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save new order');
      loadData();
    }
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
        STATEMENT_TYPE: 'PL',
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

  const handleExportExcel = async () => {
    setIsLoading(true);
    try {
      const year = Number(selectedYear);
      const { fetchEntriesByYear } = await import('../../Service/FinancialService');
      const yearEntries = await fetchEntriesByYear(year, 'PL');
      
      const orderedAccounts = [...accounts].sort((a, b) => {
        const orderA = a.ORDER_INDEX || 0;
        const orderB = b.ORDER_INDEX || 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.ACCOUNT_NAME.localeCompare(b.ACCOUNT_NAME);
      });

      const actualRows = orderedAccounts.map(acc => {
        const rowData: any = {
          'ACCOUNT TYPE': acc.ACCOUNT_TYPE,
          'ACCOUNT CATEGORY': acc.ACCOUNT_CATEGORY,
          'COST BEHAVIOR': acc.COST_BEHAVIOR || '',
          'ACCOUNT CODE': acc.ACCOUNT_CODE,
          'ACCOUNT NAME': acc.ACCOUNT_NAME,
        };
        MONTHS.forEach(m => {
          const entry = yearEntries.find(e => e.ACCOUNT_ID === acc.ID && e.PERIOD_MONTH === m.value);
          rowData[`${m.label.substring(0, 3)}-${year}`] = entry?.ACTUAL_AMOUNT || 0;
        });
        return rowData;
      });

      const forecastRows = orderedAccounts.map(acc => {
        const rowData: any = {
          'ACCOUNT TYPE': acc.ACCOUNT_TYPE,
          'ACCOUNT CATEGORY': acc.ACCOUNT_CATEGORY,
          'COST BEHAVIOR': acc.COST_BEHAVIOR || '',
          'ACCOUNT CODE': acc.ACCOUNT_CODE,
          'ACCOUNT NAME': acc.ACCOUNT_NAME,
        };
        MONTHS.forEach(m => {
          const entry = yearEntries.find(e => e.ACCOUNT_ID === acc.ID && e.PERIOD_MONTH === m.value);
          rowData[`${m.label.substring(0, 3)}-${year}`] = entry?.FORECAST_AMOUNT || 0;
        });
        return rowData;
      });

      const { exportStyledExcelWorkbook } = await import('@/app/Components/Export/ExcelExport');
      const monthCols = MONTHS.map(m => `${m.label.substring(0, 3)}-${year}`);
      
      await exportStyledExcelWorkbook([
        {
          name: 'Actual',
          data: actualRows,
          options: { numericColumns: monthCols }
        },
        {
          name: 'Forecast',
          data: forecastRows,
          options: { numericColumns: monthCols }
        }
      ], `PnL_DataEntry_${year}.xlsx`);

      toast.success('Excel exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(data, { type: 'binary' });
        
        const year = Number(selectedYear);
        const { fetchEntriesByYear } = await import('../../Service/FinancialService');
        const existingEntries = await fetchEntriesByYear(year, 'PL');
        
        const bulkDataMap = new Map<string, any>();
        let updatedAccounts = [...accounts];

        const processSheet = async (sheetName: string, isActual: boolean) => {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;
          const rows = XLSX.utils.sheet_to_json<any>(sheet);
          
          for (const row of rows) {
            const accCode = String(row['ACCOUNT CODE'] || '').trim();
            const accName = String(row['ACCOUNT NAME'] || '').trim();
            const accType = String(row['ACCOUNT TYPE'] || '').trim();
            const accCat = String(row['ACCOUNT CATEGORY'] || '').trim();
            const costBehavior = String(row['COST BEHAVIOR'] || '').trim();
            
            if (!accCode && !accName) continue;
            
            let matchedAccount = updatedAccounts.find(a => 
              (accCode && String(a.ACCOUNT_CODE).trim() === accCode) || 
              (!accCode && accName && a.ACCOUNT_NAME.trim() === accName.trim())
            );
            
            if (!matchedAccount && accCode && accName && accType) {
              try {
                const newAcc = await createAccount({
                  ACCOUNT_CODE: accCode,
                  ACCOUNT_NAME: accName,
                  ACCOUNT_TYPE: accType,
                  ACCOUNT_CATEGORY: accCat || 'General',
                  COST_BEHAVIOR: costBehavior || undefined,
                  IS_ACTIVE: true,
                  STATEMENT_TYPE: 'PL'
                } as any);
                if (newAcc) {
                  matchedAccount = newAcc;
                  updatedAccounts.push(newAcc);
                }
              } catch (err) {
                console.error('Failed to create account', accCode, err);
              }
            }
            
            if (matchedAccount) {
              if (
                (accName && matchedAccount.ACCOUNT_NAME !== accName) || 
                (accType && matchedAccount.ACCOUNT_TYPE !== accType) || 
                (accCat && matchedAccount.ACCOUNT_CATEGORY !== accCat) ||
                (costBehavior && matchedAccount.COST_BEHAVIOR !== costBehavior)
              ) {
                try {
                  await updateAccount(matchedAccount.ID, {
                    ACCOUNT_NAME: accName || matchedAccount.ACCOUNT_NAME,
                    ACCOUNT_TYPE: accType || matchedAccount.ACCOUNT_TYPE,
                    ACCOUNT_CATEGORY: accCat || matchedAccount.ACCOUNT_CATEGORY,
                    COST_BEHAVIOR: (costBehavior || matchedAccount.COST_BEHAVIOR) as "VARIABLE" | "FIXED" | undefined,
                  });
                  matchedAccount.ACCOUNT_NAME = accName || matchedAccount.ACCOUNT_NAME;
                  matchedAccount.ACCOUNT_TYPE = accType || matchedAccount.ACCOUNT_TYPE;
                  matchedAccount.ACCOUNT_CATEGORY = accCat || matchedAccount.ACCOUNT_CATEGORY;
                  matchedAccount.COST_BEHAVIOR = costBehavior as any || matchedAccount.COST_BEHAVIOR;
                } catch (err) {
                  console.error('Failed to update account details for', accCode, err);
                }
              }

              Object.keys(row).forEach(colName => {
                if (['ACCOUNT TYPE', 'ACCOUNT CATEGORY', 'COST BEHAVIOR', 'ACCOUNT CODE', 'ACCOUNT NAME'].includes(colName.toUpperCase())) return;
                
                const cleanCol = colName.trim();
                const parts = cleanCol.split('-');
                if (parts.length === 2) {
                  const monthStr = parts[0].trim();
                  const yearStr = parts[1].trim();
                  const monthObj = MONTHS.find(m => m.label.toLowerCase().startsWith(monthStr.toLowerCase()));
                  
                  if (monthObj) {
                    const monthVal = monthObj.value;
                    const yearVal = parseInt(yearStr, 10);
                    if (!isNaN(yearVal)) {
                      const key = `${matchedAccount.ID}_${monthVal}_${yearVal}`;
                      if (!bulkDataMap.has(key)) {
                        const existing = existingEntries.find(e => e.ACCOUNT_ID === matchedAccount?.ID && e.PERIOD_MONTH === monthVal && e.PERIOD_YEAR === yearVal);
                        bulkDataMap.set(key, {
                          ACCOUNT_ID: matchedAccount!.ID,
                          PERIOD_MONTH: monthVal,
                          PERIOD_YEAR: yearVal,
                          STATEMENT_TYPE: 'PL',
                          ACTUAL_AMOUNT: existing?.ACTUAL_AMOUNT || 0,
                          FORECAST_AMOUNT: existing?.FORECAST_AMOUNT || 0,
                        });
                      }
                      
                      const entry = bulkDataMap.get(key);
                      let amount = 0;
                      if (typeof row[colName] === 'number') amount = row[colName];
                      else if (typeof row[colName] === 'string') amount = parseFloat(row[colName].replace(/,/g, ''));
                      
                      if (!isNaN(amount)) {
                        if (isActual) entry.ACTUAL_AMOUNT = amount;
                        else entry.FORECAST_AMOUNT = amount;
                      }
                    }
                  }
                }
              });
            }
          }
        };

        await processSheet('Actual', true);
        await processSheet('Forecast', false);

        const dataToSave = Array.from(bulkDataMap.values());
        
        if (dataToSave.length > 0) {
          await saveFinancialEntries(dataToSave);
          toast.success(`Successfully processed ${dataToSave.length} monthly entries`);
        } else {
          toast.info('No valid data found to upload');
        }

        await loadData(true);
      } catch (err) {
        console.error('Upload error:', err);
        toast.error('Failed to parse or save Excel file');
      } finally {
        setIsLoading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
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
      case 'DIRECT_EXPENSE': return 'Direct Expenses';
      case 'INDIRECT_EXPENSE': return 'Indirect Expenses';
      case 'DEPRECIATION': return 'Depreciation';
      case 'FINANCE_COST': return 'Finance Cost';
      case 'TAXES': return 'Taxes';
      default: return type;
    }
  };

  // Account types that are displayed grouped by ACCOUNT_CATEGORY (same as P&L)
  const CATEGORY_GROUPED_TYPES = ['DIRECT_EXPENSE'];

  const groupByCategory = (list: FinancialAccount[]) => {
    const grouped = list.reduce((acc, curr) => {
      const cat = curr.ACCOUNT_CATEGORY?.trim() || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(curr);
      return acc;
    }, {} as Record<string, FinancialAccount[]>);
    return { grouped, categories: Object.keys(grouped).sort() };
  };

  const KNOWN_TYPES = ['REVENUE', 'COGS', 'DIRECT_EXPENSE', 'DIRECT EXPENSES', 'INDIRECT_EXPENSE', 'INDIRECT EXPENSES', 'DEPRECIATION', 'FINANCE_COST', 'TAXES'];
  const sortedTypes = Object.keys(groupedAccounts).sort((a, b) => {
    const indexA = KNOWN_TYPES.indexOf(a);
    const indexB = KNOWN_TYPES.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  // Flattened list of accounts in the exact order they appear on screen
  const currentType = activeType === 'ALL' || sortedTypes.includes(activeType) ? activeType : 'ALL';
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = (a: FinancialAccount) =>
    !normalizedQuery ||
    a.ACCOUNT_NAME?.toLowerCase().includes(normalizedQuery) ||
    String(a.ACCOUNT_CODE ?? '').toLowerCase().includes(normalizedQuery) ||
    (a.ACCOUNT_CATEGORY || '').toLowerCase().includes(normalizedQuery);
  const visibleTypeAccounts = (type: string) => (groupedAccounts[type] || []).filter(matchesSearch);
  const visibleCount = sortedTypes
    .filter(t => currentType === 'ALL' || t === currentType)
    .reduce((s, t) => s + visibleTypeAccounts(t).length, 0);
  const getDisplayOrderedAccounts = (): FinancialAccount[] => {
    const result: FinancialAccount[] = [];
    sortedTypes.forEach(type => {
      const typeAccounts = groupedAccounts[type] || [];
      if (!CATEGORY_GROUPED_TYPES.includes(type)) {
        result.push(...typeAccounts);
        return;
      }
      const { grouped, categories } = groupByCategory(typeAccounts);
      if (categories.length === 1 && categories[0] === 'General') {
        result.push(...typeAccounts);
        return;
      }
      categories.forEach(cat => result.push(...grouped[cat]));
    });
    return result;
  };

  const sumField = (list: FinancialAccount[], field: 'ACTUAL_AMOUNT' | 'FORECAST_AMOUNT') =>
    list.reduce((s, a) => s + (entries[a.ID]?.[field] || 0), 0);

  const renderAccountRow = (acc: FinancialAccount, index: number, siblings: FinancialAccount[]) => (
    <div key={acc.ID} className="grid grid-cols-12 gap-4 items-center px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors group">
      <div className="col-span-6 flex items-center justify-start gap-2">
        <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => moveAccount(acc, 'up', siblings)}
            disabled={index === 0}
            className="p-0.5 text-slate-300 hover:text-blue-500 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => moveAccount(acc, 'down', siblings)}
            disabled={index === siblings.length - 1}
            className="p-0.5 text-slate-300 hover:text-blue-500 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <span className="font-bold text-slate-700 ml-1">{acc.ACCOUNT_NAME}</span>
        <button 
          onClick={() => setEditingAccount(acc)}
          className="p-1.5 ml-auto text-slate-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          title="Edit Account Details"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={() => setDeletingAccount(acc)}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          title="Delete Account"
        >
          <Trash2 className="w-3.5 h-3.5" />
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
  );

  const renderTypeAccounts = (type: string, typeAccounts: FinancialAccount[]) => {
    if (!CATEGORY_GROUPED_TYPES.includes(type)) {
      return typeAccounts.map((acc, index) => renderAccountRow(acc, index, typeAccounts));
    }

    const { grouped, categories } = groupByCategory(typeAccounts);
    // If only 'General' exists, no need for visual grouping
    if (categories.length === 1 && categories[0] === 'General') {
      return typeAccounts.map((acc, index) => renderAccountRow(acc, index, typeAccounts));
    }

    return categories.map(cat => {
      const catAccounts = grouped[cat];
      const forecastTotal = sumField(catAccounts, 'FORECAST_AMOUNT');
      const actualTotal = sumField(catAccounts, 'ACTUAL_AMOUNT');
      return (
        <div key={`${type}-${cat}`} className="rounded-2xl border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 items-center px-4 py-2 bg-slate-100 border-b border-slate-200">
            <div className="col-span-6 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[#D4AF37]" />
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{cat}</span>
              <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">{catAccounts.length}</span>
            </div>
            <div className="col-span-3 text-center text-xs font-black text-blue-600 tabular-nums">
              {forecastTotal ? forecastTotal.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-'}
            </div>
            <div className="col-span-3 text-center text-xs font-black text-emerald-600 tabular-nums">
              {actualTotal ? actualTotal.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-'}
            </div>
          </div>
          <div className="py-1">
            {catAccounts.map((acc, index) => renderAccountRow(acc, index, catAccounts))}
          </div>
        </div>
      );
    });
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

          <div className="h-8 w-px bg-white/10 mx-1" />

          <button
            onClick={handleExportExcel}
            title="Download Template / Current Data"
            disabled={isLoading || accounts.length === 0}
            className="flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-400 hover:text-emerald-300 transition-colors w-11 h-11 rounded-xl disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
          </button>

          <label
            title="Upload Excel Data"
            className={`flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-blue-400 hover:text-blue-300 transition-colors w-11 h-11 rounded-xl cursor-pointer ${isLoading || accounts.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Upload className="w-5 h-5" />
            <input type="file" accept=".xlsx" className="hidden" onChange={handleUploadExcel} />
          </label>

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

      {/* Search + Type Filter Tabs */}
      {!isLoading && accounts.length > 0 && (
        <div className="space-y-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="data-entry-account-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search account..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-3">
          {['ALL', ...sortedTypes].map(type => {
            const isActive = currentType === type;
            const count = type === 'ALL'
              ? sortedTypes.reduce((s, t) => s + visibleTypeAccounts(t).length, 0)
              : visibleTypeAccounts(type).length;
            return (
              <button
                key={type}
                id={`data-entry-filter-${type.toLowerCase()}`}
                onClick={() => setActiveType(type)}
                className={`group relative flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-sm font-black transition-all duration-200 ${
                  isActive
                    ? 'bg-[#0f0f0f] border-[#D4AF37]/60 text-white shadow-lg shadow-black/10 -translate-y-0.5'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-[#D4AF37]/50 hover:text-slate-900 hover:-translate-y-0.5 hover:shadow-md'
                }`}
              >
                <span className="truncate">{type === 'ALL' ? 'All' : getTypeLabel(type)}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-[#D4AF37] text-black' : 'bg-slate-100 text-slate-500 group-hover:bg-[#D4AF37]/15 group-hover:text-[#b8952b]'}`}>
                  {count}
                </span>
                {isActive && <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full bg-[#D4AF37]" />}
              </button>
            );
          })}
        </div>
        </div>
      )}

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

          {visibleCount === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-semibold text-lg">No accounts match your search.</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedTypes
                .filter(type => currentType === 'ALL' || type === currentType)
                .map((type) => {
                const typeAccounts = visibleTypeAccounts(type);
                if (typeAccounts.length === 0) return null;

                return (
                  <div key={type} className="space-y-3">
                    <h3 className="font-black text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">
                      {getTypeLabel(type)}
                    </h3>
                    
                    {renderTypeAccounts(type, typeAccounts)}
                  </div>
                );
              })}
            </div>
          )}

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

      {deletingAccount && (
        <DeleteAccountModal
          account={deletingAccount}
          onClose={() => setDeletingAccount(null)}
          onSuccess={() => {
            setDeletingAccount(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
