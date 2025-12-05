'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { InvoiceRow } from '@/types';

interface CustomerDetailsProps {
  customerName: string;
  invoices: InvoiceRow[];
  onBack: () => void;
}

interface InvoiceWithNetDebt extends InvoiceRow {
  netDebt: number;
}

interface MonthlyDebt {
  year: string;
  month: string;
  debit: number;
  credit: number;
  netDebt: number;
}

interface AgingSummary {
  atDate: number;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
  total: number;
}

const invoiceColumnHelper = createColumnHelper<InvoiceWithNetDebt>();
const monthlyColumnHelper = createColumnHelper<MonthlyDebt>();

export default function CustomerDetails({ customerName, invoices, onBack }: CustomerDetailsProps) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'monthly' | 'ages'>('invoices');
  const [invoiceSorting, setInvoiceSorting] = useState<SortingState>([]);
  const [monthlySorting, setMonthlySorting] = useState<SortingState>([]);
  
  // PDF Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'combined' | 'separated'>('combined');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Prepare invoices data with Net Debt
  const invoicesWithNetDebt = useMemo(() => {
    return invoices.map((invoice) => ({
      ...invoice,
      netDebt: invoice.debit - invoice.credit,
    }));
  }, [invoices]);

  // Get available months for filtering
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    invoices.forEach(inv => {
      if (inv.date) {
        const date = new Date(inv.date);
        if (!isNaN(date.getTime())) {
          const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // e.g., January 2025
          monthsSet.add(monthYear);
        }
      }
    });
    // Convert to array and sort by date descending
    return Array.from(monthsSet).sort((a, b) => {
      const dateA = new Date(`1 ${a}`);
      const dateB = new Date(`1 ${b}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [invoices]);

  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('All Months');

  // Initialize selected months with all available months
  useEffect(() => {
    setSelectedMonths(availableMonths);
  }, [availableMonths]);

  // Prepare monthly debt data
  const monthlyDebt = useMemo(() => {
    const monthlyMap = new Map<string, MonthlyDebt>();

    invoices.forEach((invoice) => {
      if (!invoice.date) return;

      // Parse date to extract year and month
      const date = new Date(invoice.date);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear().toString();
      const month = date.toLocaleString('en-US', { month: 'long' });
      const key = `${year}-${month}`;

      const existing = monthlyMap.get(key) || {
        year,
        month,
        debit: 0,
        credit: 0,
        netDebt: 0,
      };

      existing.debit += invoice.debit;
      existing.credit += invoice.credit;
      existing.netDebt = existing.debit - existing.credit;

      monthlyMap.set(key, existing);
    });

    return Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      return new Date(`${a.month} 1, ${a.year}`).getTime() - new Date(`${b.month} 1, ${b.year}`).getTime();
    });
  }, [invoices]);

  // Prepare aging data
  const agingData = useMemo<AgingSummary>(() => {
    const totalNetDebt = invoicesWithNetDebt.reduce((sum, inv) => sum + inv.netDebt, 0);
    
    const summary: AgingSummary = {
      atDate: 0,
      oneToThirty: 0,
      thirtyOneToSixty: 0,
      sixtyOneToNinety: 0,
      ninetyOneToOneTwenty: 0,
      older: 0,
      total: totalNetDebt
    };

    if (totalNetDebt <= 0) return summary;

    // Get all debits sorted by due date descending (newest first)
    const debits = invoicesWithNetDebt
      .filter(inv => inv.debit > 0)
      .sort((a, b) => {
         // Prefer Due Date, fallback to Date
         const dateA = a.dueDate ? new Date(a.dueDate) : (a.date ? new Date(a.date) : new Date(0));
         const dateB = b.dueDate ? new Date(b.dueDate) : (b.date ? new Date(b.date) : new Date(0));
         return dateB.getTime() - dateA.getTime();
      });

    let remainingDebt = totalNetDebt;

    for (const inv of debits) {
      if (remainingDebt <= 0) break;

      const amountToAllocate = Math.min(inv.debit, remainingDebt);
      
      // Calculate days overdue
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : (inv.date ? new Date(inv.date) : new Date());
      const today = new Date();
      // Reset time part to ensure accurate day calculation
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - dueDate.getTime();
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        summary.atDate += amountToAllocate;
      } else if (daysOverdue <= 30) {
        summary.oneToThirty += amountToAllocate;
      } else if (daysOverdue <= 60) {
        summary.thirtyOneToSixty += amountToAllocate;
      } else if (daysOverdue <= 90) {
        summary.sixtyOneToNinety += amountToAllocate;
      } else if (daysOverdue <= 120) {
        summary.ninetyOneToOneTwenty += amountToAllocate;
      } else {
        summary.older += amountToAllocate;
      }

      remainingDebt -= amountToAllocate;
    }

    return summary;
  }, [invoicesWithNetDebt]);

  // Invoice columns - Order: DATE, NUMBER, DEBIT, CREDIT, Net Debt
  const invoiceColumns = useMemo(
    () => [
      invoiceColumnHelper.accessor('date', {
        header: 'Date',
        cell: (info) => {
          const dateStr = info.getValue();
          if (!dateStr) return '';
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          return `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
        },
      }),
      invoiceColumnHelper.accessor('number', {
        header: 'Number',
        cell: (info) => info.getValue(),
      }),
      invoiceColumnHelper.accessor('debit', {
        header: 'Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      invoiceColumnHelper.accessor('credit', {
        header: 'Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      invoiceColumnHelper.accessor('netDebt', {
        header: 'Net Debt',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : ''}>
              {value.toLocaleString('en-US')}
            </span>
          );
        },
      }),
    ],
    []
  );

  // Monthly debt columns - Order: Year, Month, DEBIT, CREDIT, Net Debt
  const monthlyColumns = useMemo(
    () => [
      monthlyColumnHelper.accessor('year', {
        header: 'Year',
        cell: (info) => info.getValue(),
      }),
      monthlyColumnHelper.accessor('month', {
        header: 'Month',
        cell: (info) => info.getValue(),
      }),
      monthlyColumnHelper.accessor('debit', {
        header: 'Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      monthlyColumnHelper.accessor('credit', {
        header: 'Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      monthlyColumnHelper.accessor('netDebt', {
        header: 'Net Debt',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : ''}>
              {value.toLocaleString('en-US')}
            </span>
          );
        },
      }),
    ],
    []
  );

  // Filter invoices based on selected month filter
  const filteredInvoicesByMonth = useMemo(() => {
    if (selectedMonthFilter === 'All Months') return invoicesWithNetDebt;
    return invoicesWithNetDebt.filter((inv) => {
      if (!inv.date) return false;
      const date = new Date(inv.date);
      if (isNaN(date.getTime())) return false;
      const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      return monthYear === selectedMonthFilter;
    });
  }, [invoicesWithNetDebt, selectedMonthFilter]);

  const invoiceTable = useReactTable({
    data: filteredInvoicesByMonth,
    columns: invoiceColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: invoiceSorting },
    onSortingChange: setInvoiceSorting,
  });

  const monthlyTable = useReactTable({
    data: monthlyDebt,
    columns: monthlyColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: monthlySorting },
    onSortingChange: setMonthlySorting,
  });

  const totalNetDebt = filteredInvoicesByMonth.reduce((sum, inv) => sum + inv.netDebt, 0);
  const totalDebit = filteredInvoicesByMonth.reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = filteredInvoicesByMonth.reduce((sum, inv) => sum + inv.credit, 0);

  const monthlyTotalNetDebt = monthlyDebt.reduce((sum, m) => sum + m.netDebt, 0);
  const monthlyTotalDebit = monthlyDebt.reduce((sum, m) => sum + m.debit, 0);
  const monthlyTotalCredit = monthlyDebt.reduce((sum, m) => sum + m.credit, 0);
  
  const toggleMonthSelection = (month: string) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const toggleAllMonths = () => {
    if (selectedMonths.length === availableMonths.length) {
      setSelectedMonths([]);
    } else {
      setSelectedMonths(availableMonths);
    }
  };

  const handleExport = async () => {
    try {
      // Filter invoices based on selected months
      const filteredInvoices = invoicesWithNetDebt.filter(inv => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return selectedMonths.includes(monthYear);
      });

      if (filteredInvoices.length === 0) {
        alert('Please select at least one month to export.');
        return;
      }

      const { generateAccountStatementPDF, generateMonthlySeparatedPDF } = await import('@/lib/pdfUtils');
      
      if (exportMode === 'separated') {
        await generateMonthlySeparatedPDF(customerName, filteredInvoices);
      } else {
        // Determine months label
        let monthsLabel = 'All Months';
        if (selectedMonths.length < availableMonths.length) {
          // Sort selected months by date descending
          const sortedSelectedMonths = [...selectedMonths].sort((a, b) => {
            const dateA = new Date(`1 ${a}`);
            const dateB = new Date(`1 ${b}`);
            return dateB.getTime() - dateA.getTime();
          });
          monthsLabel = sortedSelectedMonths.join(', ');
        }
        
        await generateAccountStatementPDF(customerName, filteredInvoices, false, monthsLabel);
      }
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">{customerName}</h2>
          <p className="text-gray-600">Customer Details</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setExportMode('combined');
              setShowExportModal(true);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            📄 Export PDF
          </button>
          <button
            onClick={() => {
              setExportMode('separated');
              setShowExportModal(true);
            }}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
          >
            📑 Export Monthly PDF
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Customers
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Select Months to Export</h3>
            
            <div className="mb-4">
              <label className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer font-bold border-b border-gray-200 pb-2 mb-2">
                <input
                  type="checkbox"
                  checked={selectedMonths.length === availableMonths.length}
                  onChange={toggleAllMonths}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                Select All
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                {availableMonths.map((month) => (
                  <label key={month} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(month)}
                      onChange={() => toggleMonthSelection(month)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    {month}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                {exportMode === 'separated' 
                  ? `Export Separate Sheets (${selectedMonths.length})`
                  : `Export PDF (${selectedMonths.length})`
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="mb-6 flex justify-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'invoices'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'monthly'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Debit by Months
        </button>
        <button
          onClick={() => setActiveTab('ages')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'ages'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Ages
        </button>
      </div>

      {/* Tab Content: Invoices */}
      {activeTab === 'invoices' && (
        <div>
          <div className="mb-4 flex items-center justify-end">
            <div className="flex items-center gap-2">
              <label htmlFor="monthFilter" className="font-medium text-gray-700">Filter by Month:</label>
              <select
                id="monthFilter"
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="All Months">All Months</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
              <thead className="bg-gray-100">
                {invoiceTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const getWidth = () => {
                        const columnId = header.column.id;
                        if (columnId === 'date') return '20%';
                        if (columnId === 'number') return '20%';
                        if (columnId === 'debit') return '20%';
                        if (columnId === 'credit') return '20%';
                        if (columnId === 'netDebt') return '20%';
                        return '20%';
                      };
                      return (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-200"
                          style={{ width: getWidth() }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {invoiceTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => {
                      const getWidth = () => {
                        const columnId = cell.column.id;
                        if (columnId === 'date') return '20%';
                        if (columnId === 'number') return '20%';
                        if (columnId === 'debit') return '20%';
                        if (columnId === 'credit') return '20%';
                        if (columnId === 'netDebt') return '20%';
                        return '20%';
                      };
                      return (
                        <td key={cell.id} className="px-4 py-3 text-center text-lg" style={{ width: getWidth() }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>Total</td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    {totalDebit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    {totalCredit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    <span className={totalNetDebt > 0 ? 'text-red-600' : totalNetDebt < 0 ? 'text-green-600' : ''}>
                      {totalNetDebt.toLocaleString('en-US')}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Tab Content: Monthly Debt */}
      {activeTab === 'monthly' && (
        <div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
              <thead className="bg-gray-100">
                {monthlyTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const getWidth = () => {
                        const columnId = header.column.id;
                        if (columnId === 'year') return '20%';
                        if (columnId === 'month') return '20%';
                        if (columnId === 'debit') return '20%';
                        if (columnId === 'credit') return '20%';
                        if (columnId === 'netDebt') return '20%';
                        return '20%';
                      };
                      return (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-200"
                          style={{ width: getWidth() }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {monthlyTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => {
                      const getWidth = () => {
                        const columnId = cell.column.id;
                        if (columnId === 'year') return '20%';
                        if (columnId === 'month') return '20%';
                        if (columnId === 'debit') return '20%';
                        if (columnId === 'credit') return '20%';
                        if (columnId === 'netDebt') return '20%';
                        return '20%';
                      };
                      return (
                        <td key={cell.id} className="px-4 py-3 text-center text-lg" style={{ width: getWidth() }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>Total</td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    {monthlyTotalDebit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    {monthlyTotalCredit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    <span className={monthlyTotalNetDebt > 0 ? 'text-red-600' : monthlyTotalNetDebt < 0 ? 'text-green-600' : ''}>
                      {monthlyTotalNetDebt.toLocaleString('en-US')}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Tab Content: Ages */}
      {activeTab === 'ages' && (
        <div>
          {agingData.total <= 0 ? (
            <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
              <p className="text-lg">No outstanding debt to display aging information.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>AT DATE</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>1 - 30</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>31 - 60</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>61 - 90</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>91 - 120</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>OLDER</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '16%' }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-4 py-4 text-center text-lg text-green-600 font-semibold">
                        {agingData.atDate.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.oneToThirty.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.thirtyOneToSixty.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.sixtyOneToNinety.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.ninetyOneToOneTwenty.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg text-red-600 font-semibold">
                        {agingData.older.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg font-bold bg-gray-50">
                        {agingData.total.toLocaleString('en-US')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}