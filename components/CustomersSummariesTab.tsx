'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { FileSpreadsheet, FileText, Filter, LayoutGrid, PieChart } from 'lucide-react';
import { InvoiceRow } from '@/types';
import { SalesInvoice } from '@/lib/googleSheets';
import NoData from './Unified/NoData';

interface CustomersSummariesTabProps {
  data: InvoiceRow[];
}

interface CustomerSummary {
  customerName: string;
  salesPrev: number;
  returnsPrev: number;
  salesCurrent: number;
  returnsCurrent: number;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
  totalAging: number;
}

const parseInvoiceDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p3 > 1000) {
        const parsed = new Date(p3, p2 - 1, p1);
        if (!isNaN(parsed.getTime())) return parsed;
      } else if (p1 > 1000) {
        const parsed = new Date(p1, p2 - 1, p3);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
  }
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  return null;
};

const columnHelper = createColumnHelper<CustomerSummary>();

export default function CustomersSummariesTab({ data }: CustomersSummariesTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideNegative, setHideNegative] = useState(false);
  const [logic, setLogic] = useState<'full' | 'almarai'>('full');
  const [almaraiData, setAlmaraiData] = useState<SalesInvoice[]>([]);
  const [loadingAlmarai, setLoadingAlmarai] = useState(false);

  // Fetch Almarai data when needed
  useState(() => {
    const fetchAlmarai = async () => {
      setLoadingAlmarai(true);
      try {
        const res = await fetch('/api/sales');
        const json = await res.json();
        if (json.data) setAlmaraiData(json.data);
      } catch (err) {
        console.error('Failed to fetch Almarai data:', err);
      } finally {
        setLoadingAlmarai(false);
      }
    };
    fetchAlmarai();
  });

  // Find dynamic years
  const { currentYear, previousYear } = useMemo(() => {
    let maxYear = new Date().getFullYear();
    if (data && data.length > 0) {
      const years = data
        .map(d => parseInvoiceDate(d.date)?.getFullYear())
        .filter((y): y is number => y !== undefined && !isNaN(y));
      if (years.length > 0) {
        maxYear = Math.max(...years);
      }
    }
    return { currentYear: maxYear, previousYear: maxYear - 1 };
  }, [data]);

  const summaryData = useMemo(() => {
    const summaries: CustomerSummary[] = [];

    if (logic === 'full') {
      const customerMap = new Map<string, InvoiceRow[]>();
      data.forEach((row) => {
        if (row.customerName && row.customerName.trim() !== '') {
          const existing = customerMap.get(row.customerName) || [];
          existing.push(row);
          customerMap.set(row.customerName, existing);
        }
      });

      customerMap.forEach((customerInvoices, customerName) => {
        let salesPrev = 0;
        let returnsPrev = 0;
        let salesCurrent = 0;
        let returnsCurrent = 0;

        customerInvoices.forEach((inv) => {
          const date = parseInvoiceDate(inv.date);
          const year = date ? date.getFullYear() : null;
          const number = inv.number ? inv.number.toUpperCase() : '';
          
          if (year === previousYear) {
            if (number.startsWith('SAL')) salesPrev += inv.debit;
            else if (number.startsWith('RSAL')) returnsPrev += inv.credit;
          } else if (year === currentYear) {
            if (number.startsWith('SAL')) salesCurrent += inv.debit;
            else if (number.startsWith('RSAL')) returnsCurrent += inv.credit;
          }
        });

        // Aging Logic
        let oneToThirty = 0, thirtyOneToSixty = 0, sixtyOneToNinety = 0, ninetyOneToOneTwenty = 0, older = 0;
        const matchingTotals = new Map<string, number>();
        const maxDebits = new Map<string, number>();
        const mainInvoiceIndices = new Map<string, number>();

        customerInvoices.forEach((inv, idx) => {
          if (inv.matching) {
            const net = inv.debit - inv.credit;
            matchingTotals.set(inv.matching, (matchingTotals.get(inv.matching) || 0) + net);
            const currentMax = maxDebits.get(inv.matching) ?? -1;
            if (inv.debit > currentMax) {
              maxDebits.set(inv.matching, inv.debit);
              mainInvoiceIndices.set(inv.matching, idx);
            } else if (!mainInvoiceIndices.has(inv.matching)) {
              maxDebits.set(inv.matching, inv.debit);
              mainInvoiceIndices.set(inv.matching, idx);
            }
          }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        customerInvoices.forEach((inv, idx) => {
          let amountToAge = 0;
          let shouldAge = false;
          if (!inv.matching) {
            const net = inv.debit - inv.credit;
            if (Math.abs(net) > 0.01) { amountToAge = net; shouldAge = true; }
          } else if (mainInvoiceIndices.get(inv.matching) === idx) {
            const residual = matchingTotals.get(inv.matching) || 0;
            if (Math.abs(residual) > 0.01) { amountToAge = residual; shouldAge = true; }
          }

          if (shouldAge) {
            let daysOverdue = 0;
            let targetDate = parseInvoiceDate(inv.dueDate) || parseInvoiceDate(inv.date);
            if (targetDate && !isNaN(targetDate.getTime())) {
              targetDate.setHours(0, 0, 0, 0);
              const diffTime = today.getTime() - targetDate.getTime();
              daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
            if (daysOverdue <= 30) oneToThirty += amountToAge;
            else if (daysOverdue <= 60) thirtyOneToSixty += amountToAge;
            else if (daysOverdue <= 90) sixtyOneToNinety += amountToAge;
            else if (daysOverdue <= 120) ninetyOneToOneTwenty += amountToAge;
            else older += amountToAge;
          }
        });

        const totalAging = oneToThirty + thirtyOneToSixty + sixtyOneToNinety + ninetyOneToOneTwenty + older;
        if (salesPrev > 0 || returnsPrev > 0 || salesCurrent > 0 || returnsCurrent > 0 || Math.abs(totalAging) > 0.01) {
          summaries.push({
            customerName, salesPrev, returnsPrev, salesCurrent, returnsCurrent,
            oneToThirty, thirtyOneToSixty, sixtyOneToNinety, ninetyOneToOneTwenty, older, totalAging
          });
        }
      });
    } else {
      // Almarai Logic from SalesInvoice sheet
      const almaraiCustomerMap = new Map<string, SalesInvoice[]>();
      almaraiData.forEach((row) => {
        if (row.customerMainName && row.customerMainName.trim() !== '') {
          const name = row.customerMainName.trim();
          const existing = almaraiCustomerMap.get(name) || [];
          existing.push(row);
          almaraiCustomerMap.set(name, existing);
        }
      });

      // Also get financial customer names to ensure we include those with debt but no recent Almarai sales
      const financialCustomerMap = new Map<string, InvoiceRow[]>();
      data.forEach((row) => {
        if (row.customerName && row.customerName.trim() !== '') {
          const name = row.customerName.trim();
          const existing = financialCustomerMap.get(name) || [];
          existing.push(row);
          financialCustomerMap.set(name, existing);
        }
      });

      const allCustomerNames = new Set([...almaraiCustomerMap.keys(), ...financialCustomerMap.keys()]);

      allCustomerNames.forEach((customerName) => {
        let salesPrev = 0, returnsPrev = 0, salesCurrent = 0, returnsCurrent = 0;

        const customerSales = almaraiCustomerMap.get(customerName) || [];
        customerSales.forEach((inv) => {
          const date = parseInvoiceDate(inv.invoiceDate);
          const year = date ? date.getFullYear() : null;
          const number = inv.invoiceNumber ? inv.invoiceNumber.toUpperCase() : '';
          const amount = inv.amount || 0;
          
          if (year === previousYear) {
            if (number.startsWith('RSAL')) returnsPrev += Math.abs(amount);
            else salesPrev += amount;
          } else if (year === currentYear) {
            if (number.startsWith('RSAL')) returnsCurrent += Math.abs(amount);
            else salesCurrent += amount;
          }
        });

        // Aging data from 'Invoices' sheet
        let oneToThirty = 0, thirtyOneToSixty = 0, sixtyOneToNinety = 0, ninetyOneToOneTwenty = 0, older = 0;
        const matchingInvoices = financialCustomerMap.get(customerName) || [];
        
        if (matchingInvoices.length > 0) {
          const mTotals = new Map<string, number>();
          const mDebits = new Map<string, number>();
          const mIndices = new Map<string, number>();

          matchingInvoices.forEach((inv, idx) => {
            if (inv.matching) {
              const net = inv.debit - inv.credit;
              mTotals.set(inv.matching, (mTotals.get(inv.matching) || 0) + net);
              if (inv.debit > (mDebits.get(inv.matching) ?? -1)) {
                mDebits.set(inv.matching, inv.debit);
                mIndices.set(inv.matching, idx);
              }
            }
          });

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          matchingInvoices.forEach((inv, idx) => {
            let val = 0; let active = false;
            if (!inv.matching) {
              const net = inv.debit - inv.credit;
              if (Math.abs(net) > 0.01) { val = net; active = true; }
            } else if (mIndices.get(inv.matching) === idx) {
              const residual = mTotals.get(inv.matching) || 0;
              if (Math.abs(residual) > 0.01) { val = residual; active = true; }
            }
            if (active) {
              let targetDate = parseInvoiceDate(inv.dueDate) || parseInvoiceDate(inv.date);
              if (targetDate && !isNaN(targetDate.getTime())) {
                targetDate.setHours(0, 0, 0, 0);
                const diffTime = today.getTime() - targetDate.getTime();
                const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (days <= 30) oneToThirty += val;
                else if (days <= 60) thirtyOneToSixty += val;
                else if (days <= 90) sixtyOneToNinety += val;
                else if (days <= 120) ninetyOneToOneTwenty += val;
                else older += val;
              }
            }
          });
        }

        const totalAging = oneToThirty + thirtyOneToSixty + sixtyOneToNinety + ninetyOneToOneTwenty + older;
        if (salesPrev > 0 || returnsPrev > 0 || salesCurrent > 0 || returnsCurrent > 0 || Math.abs(totalAging) > 0.01) {
          summaries.push({
            customerName, salesPrev, returnsPrev, salesCurrent, returnsCurrent,
            oneToThirty, thirtyOneToSixty, sixtyOneToNinety, ninetyOneToOneTwenty, older, totalAging
          });
        }
      });
    }

    return summaries.sort((a, b) => b.totalAging - a.totalAging);
  }, [data, almaraiData, logic, currentYear, previousYear]);

  const filteredData = useMemo(() => {
    let filtered = summaryData;

    if (hideNegative) {
      filtered = filtered.filter(item => item.totalAging >= -0.01);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((customer) =>
        customer.customerName.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [summaryData, searchQuery, hideNegative]);

  const exportToExcel = () => {
    const headers = ['Customer Name', `Sale ${previousYear}`, `GRV ${previousYear}`, `Sale ${currentYear}`, `GRV ${currentYear}`, '0 - 30', '31 - 60', '61 - 90', '91 - 120', 'OLDER', 'TOTAL'];
    const rows = filteredData.map((item) => [
      item.customerName,
      item.salesPrev,
      item.returnsPrev,
      item.salesCurrent,
      item.returnsCurrent,
      item.oneToThirty,
      item.thirtyOneToSixty,
      item.sixtyOneToNinety,
      item.ninetyOneToOneTwenty,
      item.older,
      item.totalAging,
    ]);

    // Add totals row
    rows.push([
      'TOTAL',
      filteredData.reduce((sum, item) => sum + item.salesPrev, 0),
      filteredData.reduce((sum, item) => sum + item.returnsPrev, 0),
      filteredData.reduce((sum, item) => sum + item.salesCurrent, 0),
      filteredData.reduce((sum, item) => sum + item.returnsCurrent, 0),
      filteredData.reduce((sum, item) => sum + item.oneToThirty, 0),
      filteredData.reduce((sum, item) => sum + item.thirtyOneToSixty, 0),
      filteredData.reduce((sum, item) => sum + item.sixtyOneToNinety, 0),
      filteredData.reduce((sum, item) => sum + item.ninetyOneToOneTwenty, 0),
      filteredData.reduce((sum, item) => sum + item.older, 0),
      filteredData.reduce((sum, item) => sum + item.totalAging, 0)
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers Summaries');

    const colWidths = [35, 15, 15, 15, 15, 12, 12, 12, 12, 12, 15];
    worksheet['!cols'] = colWidths.map(w => ({ wch: w }));

    XLSX.writeFile(workbook, `customers_summaries_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', {
        header: 'Customer Name',
        cell: (info) => (
          <div className="font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor('salesPrev', {
        header: `Sale ${previousYear}`,
        cell: (info) => <span className="text-emerald-600 font-medium">{info.getValue().toLocaleString('en-US')}</span>,
      }),
      columnHelper.accessor('returnsPrev', {
        header: `GRV ${previousYear}`,
        cell: (info) => <span className="text-rose-600 font-medium">{info.getValue().toLocaleString('en-US')}</span>,
      }),
      columnHelper.accessor('salesCurrent', {
        header: `Sale ${currentYear}`,
        cell: (info) => <span className="text-emerald-600 font-medium">{info.getValue().toLocaleString('en-US')}</span>,
      }),
      columnHelper.accessor('returnsCurrent', {
        header: `GRV ${currentYear}`,
        cell: (info) => <span className="text-rose-600 font-medium">{info.getValue().toLocaleString('en-US')}</span>,
      }),
      columnHelper.accessor('oneToThirty', {
        header: '0 - 30',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('thirtyOneToSixty', {
        header: '31 - 60',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('sixtyOneToNinety', {
        header: '61 - 90',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('ninetyOneToOneTwenty', {
        header: '91 - 120',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('older', {
        header: 'Older',
        cell: (info) => <span className="text-red-600 font-semibold">{info.getValue().toLocaleString('en-US')}</span>,
      }),
      columnHelper.accessor('totalAging', {
        header: 'Total',
        cell: (info) => (
          <span className={`font-bold ${info.getValue() > 0 ? 'text-gray-900' : 'text-green-600'}`}>
            {info.getValue().toLocaleString('en-US')}
          </span>
        ),
      }),
    ],
    [currentYear, previousYear]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative gap-4">
        <div className="flex-1 flex justify-center items-center gap-3">
          {/* Logic Selection */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner shrink-0">
            <button
              onClick={() => setLogic('full')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all uppercase tracking-tight ${
                logic === 'full' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Full Sales
            </button>
            <button
              onClick={() => setLogic('almarai')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all uppercase tracking-tight ${
                logic === 'almarai'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <PieChart className="w-4 h-4" />
              Almarai Sales
            </button>
          </div>

          <input
            type="text"
            placeholder="Search by customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-lg px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50 transition-all focus:bg-white text-center"
          />
          <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-xl border border-slate-200 shadow-inner">
            <span className="text-[10px] font-bold text-slate-500 ml-2 uppercase tracking-wider">Negatives</span>
            <button
              onClick={() => setHideNegative(!hideNegative)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-sm ${
                hideNegative ? 'bg-slate-300' : 'bg-emerald-500'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                  hideNegative ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </button>
            <span className={`text-[10px] font-bold mr-2 uppercase tracking-wider transition-colors ${hideNegative ? 'text-slate-400' : 'text-emerald-600'}`}>
              {hideNegative ? "Hidden" : "Shown"}
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center h-10 w-10 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: '1400px' }}>
            <thead className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const id = header.column.id;
                    let width = '8%';
                    if (id === 'customerName') width = '20%';
                    return (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-center font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-700 transition-colors whitespace-nowrap select-none"
                        style={{ width }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-[10px] text-slate-400">
                            {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? null}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12">
                    <NoData />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, idx) => (
                  <tr key={row.id} className={`border-b hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    {row.getVisibleCells().map((cell) => {
                      const id = cell.column.id;
                      let width = '8%';
                      if (id === 'customerName') width = '20%';
                      return (
                        <td
                          key={cell.id}
                          className="px-4 py-3 text-center whitespace-nowrap"
                          style={{ width }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
              {/* Grand Total Row */}
              <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-900">
                <td className="px-4 py-4 text-center whitespace-nowrap" style={{ width: '20%' }}>
                  TOTAL
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap text-emerald-400">
                  {filteredData.reduce((sum, i) => sum + i.salesPrev, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap text-rose-400">
                  {filteredData.reduce((sum, i) => sum + i.returnsPrev, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap text-emerald-400">
                  {filteredData.reduce((sum, i) => sum + i.salesCurrent, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap text-rose-400">
                  {filteredData.reduce((sum, i) => sum + i.returnsCurrent, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap">
                  {filteredData.reduce((sum, i) => sum + i.oneToThirty, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap">
                  {filteredData.reduce((sum, i) => sum + i.thirtyOneToSixty, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap">
                  {filteredData.reduce((sum, i) => sum + i.sixtyOneToNinety, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap">
                  {filteredData.reduce((sum, i) => sum + i.ninetyOneToOneTwenty, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap text-red-400">
                  {filteredData.reduce((sum, i) => sum + i.older, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap text-blue-200">
                  {filteredData.reduce((sum, i) => sum + i.totalAging, 0).toLocaleString('en-US')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
