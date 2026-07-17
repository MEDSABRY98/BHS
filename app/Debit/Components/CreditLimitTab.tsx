'use client';

import { useMemo, useState } from 'react';
import { InvoiceRow } from '@/types';
import { useCustomerData } from './CustomersTab/CustomersData';
import { exportDebitExcelTable } from '../Utils/ExcelExport';
import { useDebouncedValue } from '../Hooks/useDebouncedValue';
import { 
  ShieldAlert, 
  Search, 
  FileSpreadsheet, 
  MapPin
} from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';

interface CreditLimitTabProps {
  data: InvoiceRow[];
}

export default function CreditLimitTab({ data }: CreditLimitTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  // Initial dummy filters to pass to useCustomerData
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

  // Aggregate all customer data
  const { customerAnalysis } = useCustomerData(data, filters, 'DEBIT', { id: 'netDebt', desc: true });

  // Calculate exceeded customers
  const exceededCustomers = useMemo(() => {
    return customerAnalysis
      .map(c => {
        const limit = c.creditLimit || 0;
        const debt = c.netDebt || 0;
        const exceededAmount = debt - limit;
        const exceededPercentage = limit > 0 ? (exceededAmount / limit) * 100 : 0;
        const cityStr = c.salesReps && c.salesReps instanceof Set && c.salesReps.size > 0 
          ? Array.from(c.salesReps).join(', ') 
          : (Array.isArray(c.salesReps) ? (c.salesReps as string[]).join(', ') : '-');

        return {
          customerId: c.customerId || '',
          customerName: c.customerName,
          city: cityStr,
          netDebt: debt,
          creditLimit: limit,
          exceededAmount,
          exceededPercentage
        };
      })
      .filter(c => c.creditLimit > 0 && c.exceededAmount > 0.01)
      .sort((a, b) => b.exceededAmount - a.exceededAmount);
  }, [customerAnalysis]);

  // Filter exceeded customers by search term
  const filteredCustomers = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return exceededCustomers;
    const term = debouncedSearchTerm.toLowerCase().trim();
    return exceededCustomers.filter(c => 
      c.customerName.toLowerCase().includes(term) ||
      c.city.toLowerCase().includes(term) ||
      c.customerId.toLowerCase().includes(term)
    );
  }, [exceededCustomers, debouncedSearchTerm]);

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const headers = ['Customer ID', 'Customer Name', 'City', 'Net Debt (AED)', 'Credit Limit (AED)', 'Exceeded Amount (AED)', 'Exceeded %'];
      const rows = filteredCustomers.map(c => [
        c.customerId,
        c.customerName,
        c.city,
        c.netDebt,
        c.creditLimit,
        c.exceededAmount,
        `${c.exceededPercentage.toFixed(1)}%`
      ]);

      await exportDebitExcelTable(headers, rows, `Credit_Limit_Warnings_${new Date().toISOString().split('T')[0]}`, {
        sheetName: 'Credit Limit Warnings',
        numericColumns: ['Net Debt (AED)', 'Credit Limit (AED)', 'Exceeded Amount (AED)']
      });
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Error exporting Excel report.');
    }
  };

  const totalExceededSum = useMemo(() => {
    return filteredCustomers.reduce((sum, c) => sum + c.exceededAmount, 0);
  }, [filteredCustomers]);

  return (
    <div className="p-6 font-sans">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-normal text-black tracking-tighter flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse shrink-0" />
            Credit Limit Warnings
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-black border border-red-100 shadow-sm">
              {filteredCustomers.length} Exceeded
            </span>
            <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-black border border-amber-100 shadow-sm">
              Total Overdraft: {Math.round(totalExceededSum).toLocaleString('en-US')} AED
            </span>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer, ID or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm font-bold transition-all"
            />
          </div>

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
      <div className="overflow-x-auto">
        {filteredCustomers.length === 0 ? (
          <NoData title="NO DEBT LIMIT WARNINGS FOUND" />
        ) : (
          <table className="w-full text-center border-collapse" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
            <thead>
              <tr className="bg-slate-900 text-white text-center">
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '32%' }}>Customer Name</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '13%' }}>City</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '13%' }}>Net Debt</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '13%' }}>Credit Limit</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '15%' }}>Exceeded Amount</th>
                <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider" style={{ width: '14%' }}>% Exceeded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {filteredCustomers.map((c, index) => (
                <tr key={index} className="group hover:bg-gray-50/50 transition-all text-center">
                  <td className="py-5 px-4 text-center">
                    <span className="font-black text-black text-sm block truncate max-w-xs mx-auto">{c.customerName}</span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider">
                      <MapPin className="w-3 h-3" /> {c.city}
                    </span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="text-sm font-black text-black">
                      {c.netDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                    </span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="text-sm font-black text-gray-400">
                      {c.creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                    </span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg font-black text-sm">
                      +{c.exceededAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                    </span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="inline-block px-2.5 py-1 bg-red-100 text-red-700 text-xs font-black rounded-lg">
                      {c.exceededPercentage.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              
              {/* Total Footer Row */}
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-center">
                <td className="py-5 px-4 text-sm font-black text-black">Total Exceeded</td>
                <td className="py-5 px-4">-</td>
                <td className="py-5 px-4 text-sm font-black text-black">
                  {filteredCustomers.reduce((sum, c) => sum + c.netDebt, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                </td>
                <td className="py-5 px-4 text-sm font-black text-gray-500">
                  {filteredCustomers.reduce((sum, c) => sum + c.creditLimit, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                </td>
                <td className="py-5 px-4 text-sm font-black text-red-600">
                  +{totalExceededSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                </td>
                <td className="py-5 px-4">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs font-black rounded-lg">
                    Warning
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
