'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import { useSalesDataContext } from '@/app/Sales/Context/SalesDataContext';
import { useSalesTabFetch } from '@/app/Sales/Hooks/useSalesTabFetch';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import { getOverviewData } from '@/app/Sales/Service/sales_core_service';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';

interface SalesPeriodsTabProps {
  userId: string;
}

export default function SalesPeriodsTab({ userId }: SalesPeriodsTabProps) {
  const { commonFilters: filters } = useSalesModuleFilters();
  const { dataVersion } = useSalesDataContext();
  const { data, isInitialLoading, error, reload, loading } = useSalesTabFetch<{
    yearlyTableData: any[];
    monthlyTableData: any[];
  } | null>({
    tabKey: 'periods',
    userId,
    filters,
    dataVersion,
    fetcher: () => getOverviewData(userId, filters),
  });

  const [monthlyYearFilter, setMonthlyYearFilter] = useState('all');
  const [isMonthlyYearOpen, setIsMonthlyYearOpen] = useState(false);
  const monthlyYearRef = useRef<HTMLDivElement>(null);

  const monthlyYears = useMemo(() => {
    const years = new Set<string>();
    (data?.monthlyTableData || []).forEach((item: any) => {
      const year = String(item.monthKey || '').slice(0, 4);
      if (year) years.add(year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [data?.monthlyTableData]);

  const filteredMonthlyTableData = useMemo(() => {
    const rows = data?.monthlyTableData || [];
    if (monthlyYearFilter === 'all') return rows;
    return rows.filter((item: any) => String(item.monthKey || '').startsWith(monthlyYearFilter));
  }, [data?.monthlyTableData, monthlyYearFilter]);

  useEffect(() => {
    if (monthlyYearFilter !== 'all' && monthlyYears.length > 0 && !monthlyYears.includes(monthlyYearFilter)) {
      setMonthlyYearFilter('all');
    }
  }, [monthlyYears, monthlyYearFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthlyYearRef.current && !monthlyYearRef.current.contains(event.target as Node)) {
        setIsMonthlyYearOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const exportYearlyTableToExcel = async () => {
    if (!data) return;
    const headers = ['Year', 'Net Amount', 'Net Change', 'Net QTY', 'Cust. Count', 'Sales Amount', 'Sales Count', 'GRV Amount', 'GRV Count'];
    const rows = data.yearlyTableData.map((item: any) => [
      item.year,
      item.amount,
      item.amountDiff !== 0 ? (item.amountDiff > 0 ? '+' : '') + item.amountDiff : '-',
      item.qty,
      item.customerCount,
      item.grossSales,
      item.salesCount,
      item.grvAmount,
      item.grvCount,
    ]);
    const filename = `sales_yearly_table_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Yearly Sales',
      numericColumns: ['Net Amount', 'Net Change', 'Net QTY', 'Sales Amount', 'GRV Amount'],
      highlightNegativeInColumns: ['Net Change'],
    });
  };

  const exportMonthlyTableToExcel = async () => {
    if (!data) return;
    const headers = ['Month', 'Net Amount', 'Net Change', 'Net QTY', 'Cust. Count', 'Sales Amount', 'Sales Count', 'GRV Amount', 'GRV Count'];
    const rows = filteredMonthlyTableData.map((item: any) => [
      item.month,
      item.amount,
      item.amountDiff !== 0 ? (item.amountDiff > 0 ? '+' : '') + item.amountDiff : '-',
      item.qty,
      item.customerCount,
      item.grossSales,
      item.salesCount,
      item.grvAmount,
      item.grvCount,
    ]);
    const yearSuffix = monthlyYearFilter === 'all' ? 'all' : monthlyYearFilter;
    const filename = `sales_monthly_table_${yearSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Monthly Sales',
      numericColumns: ['Net Amount', 'Net Change', 'Net QTY', 'Sales Amount', 'GRV Amount'],
      highlightNegativeInColumns: ['Net Change'],
    });
  };

  if (isInitialLoading) {
    return <SalesTabLoader />;
  }

  if (error) {
    return (
      <TabFetchError
        message={error}
        onRetry={() => void reload()}
        isRetrying={loading}
        className="min-h-[360px]"
      />
    );
  }

  if (!data) {
    return <SalesTabLoader />;
  }

  const { yearlyTableData, monthlyTableData } = data;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-2xl font-medium text-slate-800">Periods Analysis</h1>
      </div>

      {/* Yearly Sales Table */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Yearly Sales</h2>
          <button
            onClick={exportYearlyTableToExcel}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
        {yearlyTableData.length === 0 ? (
          <NoData />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Year</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Net Amount</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Net Change</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Net QTY</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Cust. Count</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Sales Amount</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Sales Count</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">GRV Amount</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">GRV Count</th>
                </tr>
              </thead>
              <tbody>
                {yearlyTableData.map((item, index) => (
                  <tr key={item.year} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-base font-semibold text-gray-800 text-center">{item.year}</td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.amount.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                    </td>
                    <td className={`py-3 px-4 text-base text-center font-semibold ${item.amountDiff > 0
                      ? 'text-green-600'
                      : item.amountDiff < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                      }`}>
                      {item.amountDiff !== 0 ? (
                        <>
                          {item.amountDiff > 0 ? '+' : ''}
                          {item.amountDiff.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.qty.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold text-blue-600">
                      {item.customerCount}
                    </td>
                    <td className="py-3 px-4 text-base text-green-600 text-center font-bold">
                      {item.grossSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.salesCount}
                    </td>
                    <td className="py-3 px-4 text-base text-red-600 text-center font-bold">
                      {item.grvAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.grvCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly Sales Table */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">Monthly Sales</h2>
            <button
              onClick={exportMonthlyTableToExcel}
              className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
              title="Export to Excel"
            >
              <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
            </button>
          </div>

          <div className="relative w-[150px]" ref={monthlyYearRef}>
            <button
              type="button"
              onClick={() => setIsMonthlyYearOpen((open) => !open)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex items-center justify-between gap-3 hover:bg-white hover:border-slate-300 transition-all shadow-sm"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{monthlyYearFilter === 'all' ? 'All Years' : monthlyYearFilter}</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isMonthlyYearOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isMonthlyYearOpen && (
              <div className="absolute left-0 right-0 mt-2 w-full bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setMonthlyYearFilter('all');
                    setIsMonthlyYearOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors ${monthlyYearFilter === 'all'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  All Years
                </button>
                {monthlyYears.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setMonthlyYearFilter(year);
                      setIsMonthlyYearOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors ${monthlyYearFilter === year
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {filteredMonthlyTableData.length === 0 ? (
          <NoData />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Month</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Net Amount</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Net Change</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Net QTY</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Cust. Count</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Sales Amount</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Sales Count</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">GRV Amount</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">GRV Count</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlyTableData.map((item, index) => (
                  <tr key={item.month} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-base font-semibold text-gray-800 text-center">{item.month}</td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.amount.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                    </td>
                    <td className={`py-3 px-4 text-base text-center font-semibold ${item.amountDiff > 0
                      ? 'text-green-600'
                      : item.amountDiff < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                      }`}>
                      {item.amountDiff !== 0 ? (
                        <>
                          {item.amountDiff > 0 ? '+' : ''}
                          {item.amountDiff.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.qty.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold text-blue-600">
                      {item.customerCount}
                    </td>
                    <td className="py-3 px-4 text-base text-green-600 text-center font-bold">
                      {item.grossSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.salesCount}
                    </td>
                    <td className="py-3 px-4 text-base text-red-600 text-center font-bold">
                      {item.grvAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.grvCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
