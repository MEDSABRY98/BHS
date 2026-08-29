'use client';

import { useMemo, useState } from 'react';
import { InvoiceRow } from '@/types';
import { useCustomerData } from '../CustomersTab/CustomersData';
import { exportDebitExcelTable } from '../Utils/ExcelExport';
import { useDebouncedValue } from '../Hooks/useDebouncedValue';
import { 
  FileText,
  Search, 
  FileSpreadsheet, 
  Edit2,
  X,
  Loader2,
  AlertCircle,
  Filter
} from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { bhs_supabase } from '@/lib/supabase';
import { toast } from '@/app/Components/Notification';
import { useDebitData } from '../Context/DebitDataContext';

interface CustomerTermsTabProps {
  data: InvoiceRow[];
}

export default function CustomerTermsTab({ data }: CustomerTermsTabProps) {
  const { refresh } = useDebitData();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  // Edit Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [editPaymentTerm, setEditPaymentTerm] = useState<string>('');
  const [editCreditLimit, setEditCreditLimit] = useState<string>('');
  const [editAccountStatus, setEditAccountStatus] = useState<'ACTIVE' | 'ON_HOLD'>('ACTIVE');
  const [isSaving, setIsSaving] = useState(false);

  // Applied Filter State
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ON_HOLD'>('ALL');
  const [appliedMinExceededDays, setAppliedMinExceededDays] = useState<string>('');
  const [appliedMinExceededAmount, setAppliedMinExceededAmount] = useState<string>('');

  // Draft Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ON_HOLD'>('ALL');
  const [draftMinExceededDays, setDraftMinExceededDays] = useState<string>('');
  const [draftMinExceededAmount, setDraftMinExceededAmount] = useState<string>('');

  const openFilterModal = () => {
    setDraftStatusFilter(appliedStatusFilter);
    setDraftMinExceededDays(appliedMinExceededDays);
    setDraftMinExceededAmount(appliedMinExceededAmount);
    setIsFilterOpen(true);
  };

  const applyFilters = () => {
    setAppliedStatusFilter(draftStatusFilter);
    setAppliedMinExceededDays(draftMinExceededDays);
    setAppliedMinExceededAmount(draftMinExceededAmount);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    setAppliedStatusFilter('ALL');
    setAppliedMinExceededDays('');
    setAppliedMinExceededAmount('');
    setIsFilterOpen(false);
  };

  const filters = useMemo(() => ({
    search: '',
    filterYear: '',
    filterMonth: '',
    dateRangeFrom: '',
    dateRangeTo: '',
    invoiceTypeFilter: 'ALL',
    matchingFilter: 'ALL',
    selectedSalesRep: 'ALL',
    closedFilter: 'ALL',
    debtOperator: 'GT',
    debtAmount: '',
    collectionRateOperator: 'GT',
    collectionRateValue: '',
    collectionRateTypes: new Set(['PAYMENT', 'RETURN', 'DISCOUNT']),
    lastPaymentValue: '',
    lastPaymentUnit: 'DAYS',
    lastPaymentStatus: 'ACTIVE',
    lastPaymentAmountOperator: 'GT',
    lastPaymentAmountValue: '',
    hasOB: false,
    overdueAmount: '',
    overdueAging: 'ALL',
    netSalesOperator: 'GT',
    minTotalDebit: '',
    noSalesValue: '',
    noSalesUnit: 'DAYS',
    lastSalesStatus: 'ACTIVE',
    lastSalesAmountOperator: 'GT',
    lastSalesAmountValue: '',
    dateRangeType: 'LAST_TRANSACTION',
    debtType: 'ALL',
    selectedReps: [],
    customerRating: 'ALL',
    emailFilter: 'ALL',
    overdueMonth: [],
    overdueYear: [],
  }), []);

  const { customerAnalysis } = useCustomerData(data, filters, 'DEBIT', { id: 'netDebt', desc: true });

  const customerTerms = useMemo(() => {
    return customerAnalysis
      .map(c => {
        const limit = c.creditLimit || 0;
        const debt = c.netDebt || 0;
        const paymentTerm = (c as any).paymentTerm ?? 90;
        const exceededDays = Math.max(0, (c.maxOverdueDays || 0) - paymentTerm);
        const exceededAmount = limit > 0 ? Math.max(0, debt - limit) : 0;
        const exceededPercentage = limit > 0 ? (exceededAmount / limit) * 100 : 0;
        const cityStr = c.salesReps && c.salesReps instanceof Set && c.salesReps.size > 0 
          ? Array.from(c.salesReps).join(', ') 
          : (Array.isArray(c.salesReps) ? (c.salesReps as string[]).join(', ') : '-');

        return {
          customerId: c.customerId || '',
          customerName: c.customerName,
          city: cityStr,
          paymentTerm,
          exceededDays,
          netDebt: debt,
          creditLimit: limit,
          exceededAmount,
          exceededPercentage,
          accountStatus: c.accountStatus || 'ACTIVE'
        };
      })
      .filter(c => Math.abs(c.netDebt) > 0.01)
      .sort((a, b) => b.netDebt - a.netDebt);
  }, [customerAnalysis]);

  const filteredCustomers = useMemo(() => {
    let result = customerTerms;

    // Search filter
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase().trim();
      result = result.filter(c => 
        c.customerName.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term) ||
        c.customerId.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (appliedStatusFilter !== 'ALL') {
      result = result.filter(c => c.accountStatus === appliedStatusFilter);
    }

    // Exceeded Days filter
    if (appliedMinExceededDays && !isNaN(Number(appliedMinExceededDays))) {
      result = result.filter(c => c.exceededDays >= Number(appliedMinExceededDays));
    }

    // Exceeded Amount filter
    if (appliedMinExceededAmount && !isNaN(Number(appliedMinExceededAmount))) {
      result = result.filter(c => c.exceededAmount >= Number(appliedMinExceededAmount));
    }

    return result;
  }, [customerTerms, debouncedSearchTerm, appliedStatusFilter, appliedMinExceededDays, appliedMinExceededAmount]);

  const handleExportExcel = async () => {
    try {
      const headers = ['Customer ID', 'Customer Name', 'City', 'Payment Term (Days)', 'Exceeded Days', 'Net Debt (AED)', 'Credit Limit (AED)', 'Exceeded Amount (AED)', 'Exceeded %'];
      const rows = filteredCustomers.map(c => [
        c.customerId,
        c.customerName,
        c.city,
        c.paymentTerm,
        c.exceededDays,
        c.netDebt,
        c.creditLimit,
        c.exceededAmount,
        `${c.exceededPercentage.toFixed(1)}%`
      ]);

      await exportDebitExcelTable(headers, rows, `Customer_Terms_${new Date().toISOString().split('T')[0]}`, {
        sheetName: 'Customer Terms',
        numericColumns: ['Net Debt (AED)', 'Credit Limit (AED)', 'Exceeded Amount (AED)']
      });
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Error exporting Excel report.');
    }
  };

  const openEditModal = (c: any) => {
    setSelectedCustomer(c);
    setEditPaymentTerm(c.paymentTerm.toString());
    setEditCreditLimit(c.creditLimit.toString());
    setEditAccountStatus(c.accountStatus || 'ACTIVE');
  };

  const handleSaveTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setIsSaving(true);
    try {
      const pTerm = Number(editPaymentTerm) || 90;
      const cLimit = Number(editCreditLimit) || 0;

      const { data: custData, error: fetchErr } = await bhs_supabase
        .from('bhs_CUSTOMERS')
        .select('"CUSTOMER MAIN NAME", "CUSTOMER TAG"')
        .eq('CUSTOMER ID', selectedCustomer.customerId)
        .limit(1)
        .single();

      if (fetchErr && fetchErr.code !== 'PGRST116') {
        throw fetchErr;
      }

      await bhs_supabase
        .from('bhs_CUSTOMERS')
        .update({ "PAYMENT TERM": pTerm, "CREDIT LIMIT": cLimit, "ACCOUNT STATUS": editAccountStatus })
        .eq('CUSTOMER ID', selectedCustomer.customerId);

      if (custData?.['CUSTOMER MAIN NAME']) {
        await bhs_supabase
          .from('bhs_CUSTOMERS')
          .update({ "PAYMENT TERM": pTerm })
          .eq('CUSTOMER MAIN NAME', custData['CUSTOMER MAIN NAME']);
      }

      if (custData?.['CUSTOMER TAG']) {
        await bhs_supabase
          .from('bhs_CUSTOMERS')
          .update({ "PAYMENT TERM": pTerm })
          .eq('CUSTOMER TAG', custData['CUSTOMER TAG']);
      }

      setSelectedCustomer(null);
      toast.success('Updated successfully! Refreshing data in background...');
      refresh(true).catch(console.error);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update customer terms.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalDebt = useMemo(() => filteredCustomers.reduce((sum, c) => sum + c.netDebt, 0), [filteredCustomers]);
  const totalExceeded = useMemo(() => filteredCustomers.reduce((sum, c) => sum + c.exceededAmount, 0), [filteredCustomers]);

  return (
    <div className="p-6 font-sans">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-normal text-black tracking-tighter flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500 shrink-0" />
            Customer Terms
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-black border border-blue-100 shadow-sm">
              {filteredCustomers.length} Customers
            </span>
            {totalExceeded > 0.01 && (
              <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-black border border-red-100 shadow-sm">
                Overdraft: {Math.round(totalExceeded).toLocaleString('en-US')} AED
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer, ID or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-bold transition-all"
            />
          </div>

          <button
            onClick={openFilterModal}
            className={`flex items-center justify-center h-11 w-11 rounded-xl transition-colors shadow-sm shrink-0 cursor-pointer ${
              appliedStatusFilter !== 'ALL' || appliedMinExceededDays || appliedMinExceededAmount
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-700'
            }`}
            title="Filter Customers"
          >
            <Filter className="h-5 w-5" />
            {(appliedStatusFilter !== 'ALL' || appliedMinExceededDays || appliedMinExceededAmount) && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredCustomers.length === 0}
            className="flex items-center justify-center h-11 w-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {filteredCustomers.length === 0 ? (
          <NoData title="NO CUSTOMERS FOUND" />
        ) : (
          <table className="w-full text-center border-collapse" style={{ tableLayout: 'fixed', minWidth: '1100px', direction: 'ltr' }}>
            <thead className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
              <tr className="text-center">
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '4%' }}>#</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '20%' }}>Customer Name</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '9%' }}>City</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '9%' }}>Payment Term</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '9%' }}>Exc Days</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '12%' }}>Net Debt</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '12%' }}>Credit Limit</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '12%' }}>Exceeded Amt</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '8%' }}>% Exc</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '5%' }}>
                  <AlertCircle className="w-4 h-4 mx-auto" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {filteredCustomers.map((c, index) => (
                <tr key={index} className="group hover:bg-gray-50/50 transition-all text-center">
                  <td className="py-5 px-4 text-center text-xs font-black text-gray-400">{index + 1}</td>
                  <td className="py-5 px-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-black text-sm block truncate max-w-xs mx-auto ${c.accountStatus === 'ON_HOLD' ? 'text-gray-400 line-through' : 'text-black'}`}>
                        {c.customerName}
                      </span>
                      {c.accountStatus === 'ON_HOLD' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-black uppercase tracking-wider">
                          On Hold
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider">
                      {c.city}
                    </span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-black">
                      {c.paymentTerm} days
                    </span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    {c.exceededDays > 0 ? (
                      <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg font-black text-sm">
                        +{c.exceededDays} d
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600 font-bold">OK</span>
                    )}
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="text-sm font-black text-black">
                      {c.netDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                    </span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    {c.creditLimit > 0 ? (
                      <span className="text-sm font-black text-gray-500">
                        {c.creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 font-bold">—</span>
                    )}
                  </td>
                  <td className="py-5 px-4 text-center">
                    {c.exceededAmount > 0.01 ? (
                      <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg font-black text-sm">
                        +{c.exceededAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600 font-bold">OK</span>
                    )}
                  </td>
                  <td className="py-5 px-4 text-center">
                    {c.exceededAmount > 0.01 ? (
                      <span className="inline-block px-2.5 py-1 bg-red-100 text-red-700 text-xs font-black rounded-lg">
                        {c.exceededPercentage.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 font-bold">—</span>
                    )}
                  </td>
                  <td className="py-5 px-4 text-center">
                    <button 
                      onClick={() => openEditModal(c)}
                      className="p-2 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
                      title="Edit Terms"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              
              {/* Total Footer Row */}
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-center">
                <td className="py-5 px-4">-</td>
                <td className="py-5 px-4 text-sm font-black text-black">Total</td>
                <td className="py-5 px-4">-</td>
                <td className="py-5 px-4 text-sm font-black text-indigo-600">
                  {Math.round(filteredCustomers.reduce((sum, c) => sum + c.paymentTerm, 0) / (filteredCustomers.length || 1))} days avg
                </td>
                <td className="py-5 px-4 text-sm font-black text-red-600">
                  {Math.round(filteredCustomers.reduce((sum, c) => sum + c.exceededDays, 0) / (filteredCustomers.length || 1))} days avg
                </td>
                <td className="py-5 px-4 text-sm font-black text-black">
                  {totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                </td>
                <td className="py-5 px-4 text-sm font-black text-gray-500">
                  {filteredCustomers.reduce((sum, c) => sum + c.creditLimit, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                </td>
                <td className="py-5 px-4 text-sm font-black text-red-600">
                  {totalExceeded > 0.01 ? `+${totalExceeded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED` : '—'}
                </td>
                <td className="py-5 px-4">
                  {totalExceeded > 0.01 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs font-black rounded-lg">
                      Warning
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs font-black rounded-lg">
                      OK
                    </span>
                  )}
                </td>
                <td className="py-5 px-4">-</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Edit Customer Terms</h3>
                <p className="text-sm text-gray-500 font-bold mt-1 line-clamp-1">{selectedCustomer.customerName}</p>
              </div>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveTerms} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Payment Term (Days)</label>
                <input
                  type="number"
                  value={editPaymentTerm}
                  onChange={(e) => setEditPaymentTerm(e.target.value)}
                  placeholder="e.g. 90"
                  min="0"
                  step="1"
                  required
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Credit Limit (AED)</label>
                <input
                  type="number"
                  value={editCreditLimit}
                  onChange={(e) => setEditCreditLimit(e.target.value)}
                  placeholder="e.g. 50000"
                  min="0"
                  step="any"
                  required
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Account Status</label>
                <label className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={editAccountStatus === 'ON_HOLD'}
                      onChange={(e) => setEditAccountStatus(e.target.checked ? 'ON_HOLD' : 'ACTIVE')}
                    />
                    <div className="w-11 h-6 bg-emerald-100 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                  </div>
                  <div>
                    <div className="text-sm font-black text-black">
                      {editAccountStatus === 'ON_HOLD' ? 'Suspend Account (On Hold)' : 'Active Account'}
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold">
                      {editAccountStatus === 'ON_HOLD' ? 'This customer is currently suspended.' : 'This customer can make new transactions.'}
                    </div>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="flex-1 py-4 bg-gray-50 text-gray-400 hover:text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-4 bg-black text-[#D4AF37] hover:bg-gray-900 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Filter Options</h3>
                <p className="text-sm text-gray-500 font-bold mt-1">Narrow down customers list</p>
              </div>
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Account Status</label>
                <div className="relative">
                  <select
                    value={draftStatusFilter}
                    onChange={(e) => setDraftStatusFilter(e.target.value as any)}
                    className="appearance-none cursor-pointer w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold pr-10 hover:bg-gray-100"
                  >
                    <option value="ALL">All Customers</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Min Exceeded Days</label>
                <input
                  type="number"
                  value={draftMinExceededDays}
                  onChange={(e) => setDraftMinExceededDays(e.target.value)}
                  placeholder="e.g. 30"
                  min="0"
                  step="1"
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">Min Exceeded Amount (AED)</label>
                <input
                  type="number"
                  value={draftMinExceededAmount}
                  onChange={(e) => setDraftMinExceededAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  min="0"
                  step="any"
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-black font-bold"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex-1 py-4 bg-gray-50 text-gray-400 hover:text-red-600 font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Clear Filters
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="flex-1 py-4 bg-black text-[#D4AF37] hover:bg-gray-900 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
