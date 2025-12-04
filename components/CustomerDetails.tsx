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

const invoiceColumnHelper = createColumnHelper<InvoiceWithNetDebt>();
const monthlyColumnHelper = createColumnHelper<MonthlyDebt>();

export default function CustomerDetails({ customerName, invoices, onBack }: CustomerDetailsProps) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'monthly'>('invoices');
  const [invoiceSorting, setInvoiceSorting] = useState<SortingState>([]);
  const [monthlySorting, setMonthlySorting] = useState<SortingState>([]);
  
  // PDF Export State
  const [showExportModal, setShowExportModal] = useState(false);
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
          const monthYear = date.toLocaleString('en-US', { month: 'short', year: '2-digit' }).toUpperCase(); // e.g., JAN 25
          monthsSet.add(monthYear);
        }
      }
    });
    // Convert to array and sort by date descending
    return Array.from(monthsSet).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      const dateA = new Date(`${monthA} 1, 20${yearA}`);
      const dateB = new Date(`${monthB} 1, 20${yearB}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [invoices]);

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

  const invoiceTable = useReactTable({
    data: invoicesWithNetDebt,
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

  const totalNetDebt = invoicesWithNetDebt.reduce((sum, inv) => sum + inv.netDebt, 0);
  const totalDebit = invoicesWithNetDebt.reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = invoicesWithNetDebt.reduce((sum, inv) => sum + inv.credit, 0);

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
        const monthYear = date.toLocaleString('en-US', { month: 'short', year: '2-digit' }).toUpperCase();
        return selectedMonths.includes(monthYear);
      });

      if (filteredInvoices.length === 0) {
        alert('Please select at least one month to export.');
        return;
      }

      const { generateAccountStatementPDF } = await import('@/lib/pdfUtils');
      
      // Determine months label
      let monthsLabel = 'All Months';
      if (selectedMonths.length < availableMonths.length) {
        // Sort selected months by date descending
        const sortedSelectedMonths = [...selectedMonths].sort((a, b) => {
          const [monthA, yearA] = a.split(' ');
          const [monthB, yearB] = b.split(' ');
          const dateA = new Date(`${monthA} 1, 20${yearA}`);
          const dateB = new Date(`${monthB} 1, 20${yearB}`);
          return dateB.getTime() - dateA.getTime();
        });
        monthsLabel = sortedSelectedMonths.join(', ');
      }
      
      await generateAccountStatementPDF(customerName, filteredInvoices, false, monthsLabel);
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
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            📄 Export PDF
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
                Export PDF ({selectedMonths.length})
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
      </div>

      {/* Tab Content: Invoices */}
      {activeTab === 'invoices' && (
        <div>
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
    </div>
  );
}
