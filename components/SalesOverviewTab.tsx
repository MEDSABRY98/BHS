'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { TrendingUp, Package, Users, DollarSign, BarChart3, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown, Download, Filter, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SalesOverviewTabProps {
  data: SalesInvoice[];
  loading: boolean;
}


export default function SalesOverviewTab({ data, loading }: SalesOverviewTabProps) {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalAmount: 0,
        totalQty: 0,
        totalCustomers: 0,
        totalProducts: 0,
        avgAmountPerSale: 0,
        avgQtyPerSale: 0,
        avgMonthlyAmount: 0,
        avgMonthlyQty: 0,
      };
    }

    const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
    const totalQty = data.reduce((sum, item) => sum + item.qty, 0);
    const uniqueCustomers = new Set(data.map(item => item.customerName)).size;
    const uniqueProducts = new Set(data.map(item => item.product)).size;
    const avgAmountPerSale = totalAmount / data.length;
    const avgQtyPerSale = totalQty / data.length;

    // Calculate monthly averages
    const monthsSet = new Set<string>();
    const monthlyData = new Map<string, { amount: number; qty: number }>();

    data.forEach(item => {
      if (item.invoiceDate) {
        try {
          const date = new Date(item.invoiceDate);
          if (!isNaN(date.getTime())) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthsSet.add(monthKey);

            const existing = monthlyData.get(monthKey) || { amount: 0, qty: 0 };
            existing.amount += item.amount;
            existing.qty += item.qty;
            monthlyData.set(monthKey, existing);
          }
        } catch (e) {
          // Invalid date, skip
        }
      }
    });

    const totalMonths = monthsSet.size || 1;
    const totalMonthlyAmount = Array.from(monthlyData.values()).reduce((sum, m) => sum + m.amount, 0);
    const totalMonthlyQty = Array.from(monthlyData.values()).reduce((sum, m) => sum + m.qty, 0);
    const avgMonthlyAmount = totalMonthlyAmount / totalMonths;
    const avgMonthlyQty = totalMonthlyQty / totalMonths;

    return {
      totalAmount,
      totalQty,
      totalCustomers: uniqueCustomers,
      totalProducts: uniqueProducts,
      avgAmountPerSale,
      avgQtyPerSale,
      avgMonthlyAmount,
      avgMonthlyQty,
    };
  }, [data]);


  // Monthly sales data for charts - if filters are applied, show filtered data, otherwise show last 12 months
  const monthlySales = useMemo(() => {
    const monthMap = new Map<string, { month: string; monthKey: string; amount: number; qty: number }>();
    const dataToProcess = data;

    dataToProcess.forEach(item => {
      if (!item.invoiceDate) return;

      try {
        const date = new Date(item.invoiceDate);
        if (isNaN(date.getTime())) return;

        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[month]} ${String(year).slice(-2)}`;

        const existing = monthMap.get(monthKey) || {
          month: monthLabel,
          monthKey,
          amount: 0,
          qty: 0,
        };

        existing.amount += item.amount;
        existing.qty += item.qty;

        monthMap.set(monthKey, existing);
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Find the latest month in the data
    const allMonths = Array.from(monthMap.values());
    if (allMonths.length === 0) return [];

    const latestMonth = allMonths.reduce((latest, current) => {
      return current.monthKey > latest.monthKey ? current : latest;
    }, allMonths[0]);

    // Calculate the last 12 months from the latest month
    const last12MonthsKeys = new Set<string>();
    const [latestYear, latestMonthNum] = latestMonth.monthKey.split('-').map(Number);

    // Create array with all last 12 months, filling missing months with zeros
    const result: Array<{ month: string; monthKey: string; amount: number; qty: number }> = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(latestYear, latestMonthNum - 1 - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthLabel = `${monthNames[month - 1]} ${String(year).slice(-2)}`;

      const existing = monthMap.get(monthKey);
      result.push({
        month: monthLabel,
        monthKey,
        amount: existing?.amount || 0,
        qty: existing?.qty || 0,
      });
    }

    return result;
  }, [data]);

  // Chart data for monthly sales - show last 12 months only, reverse order for chart (oldest to newest for better visualization)
  const chartData = useMemo(() => {
    // monthlySales already contains exactly last 12 months
    const chartRes = monthlySales.map((item, index) => {
      // Calculate difference from previous month for amount
      const previousAmount = index > 0 ? monthlySales[index - 1].amount : item.amount;
      const amountDiff = item.amount - previousAmount;

      // Calculate difference from previous month for quantity
      const previousQty = index > 0 ? monthlySales[index - 1].qty : item.qty;
      const qtyDiff = item.qty - previousQty;

      return {
        month: item.month,
        amount: item.amount,
        amountDiff: amountDiff,
        qty: item.qty,
        qtyDiff: qtyDiff,
        isNegativeAmount: item.amount < 0,
        isNegativeAmountDiff: amountDiff < 0,
        isNegativeQty: item.qty < 0,
        isNegativeQtyDiff: qtyDiff < 0,
        isMaxMonth: false,
      };
    });

    // Find max month by amount (highest positive amount, or least negative if all negative)
    if (chartRes.length > 0) {
      const maxAmount = Math.max(...chartRes.map(d => d.amount));
      chartRes.forEach(item => {
        item.isMaxMonth = item.amount === maxAmount;
      });
    }

    return chartRes;
  }, [monthlySales]);

  // Yearly sales table data - sorted newest to oldest
  const yearlyTableData = useMemo(() => {
    const yearMap = new Map<string, {
      year: string;
      amount: number;
      qty: number;
      customerCount: Set<string>;
      invoiceNumbers: Set<string>;
      grvNumbers: Set<string>;
      grossSales: number;
      grvAmount: number;
    }>();

    data.forEach(item => {
      if (!item.invoiceDate) return;

      try {
        const date = new Date(item.invoiceDate);
        if (isNaN(date.getTime())) return;

        const year = date.getFullYear().toString();

        const existing = yearMap.get(year) || {
          year: year,
          amount: 0,
          qty: 0,
          customerCount: new Set<string>(),
          invoiceNumbers: new Set<string>(),
          grvNumbers: new Set<string>(),
          grossSales: 0,
          grvAmount: 0,
        };

        existing.amount += item.amount;
        existing.qty += item.qty;
        existing.customerCount.add(item.customerId || item.customerName);

        const invNum = item.invoiceNumber || (item as any).number || (item as any).invoiceNo;
        const invoiceId = invNum || `missing-${Math.random()}`;

        if (item.amount > 0) {
          existing.grossSales += item.amount;
          existing.invoiceNumbers.add(invoiceId);
        } else if (item.amount < 0) {
          existing.grvAmount += Math.abs(item.amount);
          existing.grvNumbers.add(invoiceId);
        }

        yearMap.set(year, existing);
      } catch (e) {
        // Skip invalid dates
      }
    });

    const sorted = Array.from(yearMap.values()).sort((a, b) => b.year.localeCompare(a.year));

    return sorted.map((item, index) => {
      const previousYear = index < sorted.length - 1 ? sorted[index + 1] : null;
      const amountDiff = previousYear ? item.amount - previousYear.amount : 0;

      return {
        year: item.year,
        amount: item.amount,
        amountDiff: previousYear ? item.amount - previousYear.amount : 0,
        qty: item.qty,
        customerCount: item.customerCount.size,
        grossSales: item.grossSales,
        salesCount: item.invoiceNumbers.size,
        grvAmount: item.grvAmount,
        grvCount: item.grvNumbers.size,
      };
    });
  }, [data]);

  // Monthly sales table data - sorted from newest to oldest, showing ALL months
  const monthlyTableData = useMemo(() => {
    // Get all months from data
    const monthMap = new Map<string, {
      month: string;
      monthKey: string;
      amount: number;
      qty: number;
      customerCount: Set<string>;
      invoiceNumbers: Set<string>;
      grvNumbers: Set<string>;
      grossSales: number;
      grvAmount: number;
    }>();

    data.forEach(item => {
      if (!item.invoiceDate) return;

      try {
        const date = new Date(item.invoiceDate);
        if (isNaN(date.getTime())) return;

        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[month]} ${String(year).slice(-2)}`;

        const existing = monthMap.get(monthKey) || {
          month: monthLabel,
          monthKey,
          amount: 0,
          qty: 0,
          customerCount: new Set<string>(),
          invoiceNumbers: new Set<string>(),
          grvNumbers: new Set<string>(),
          grossSales: 0,
          grvAmount: 0,
        };

        existing.amount += item.amount;
        existing.qty += item.qty;
        existing.customerCount.add(item.customerId || item.customerName);

        const invNum = item.invoiceNumber || (item as any).number || (item as any).invoiceNo;
        const invoiceId = invNum || `missing-${Math.random()}`;

        if (item.amount > 0) {
          existing.grossSales += item.amount;
          existing.invoiceNumbers.add(invoiceId);
        } else if (item.amount < 0) {
          existing.grvAmount += Math.abs(item.amount);
          existing.grvNumbers.add(invoiceId);
        }

        monthMap.set(monthKey, existing);
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Sort from newest to oldest (descending by monthKey)
    const sorted = Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    return sorted.map((item, index) => {
      // Get previous month for comparison
      const previousMonth = index < sorted.length - 1 ? sorted[index + 1] : null;
      const amountDiff = previousMonth ? item.amount - previousMonth.amount : 0;

      return {
        month: item.month,
        monthKey: item.monthKey,
        amount: item.amount,
        amountDiff: amountDiff,
        qty: item.qty,
        customerCount: item.customerCount.size,
        grossSales: item.grossSales,
        salesCount: item.invoiceNumbers.size,
        grvAmount: item.grvAmount,
        grvCount: item.grvNumbers.size,
      };
    });
  }, [data]);

  // Export yearly table to Excel
  const exportYearlyTableToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const headers = ['Year', 'Net Amount', 'Net Change', 'Net QTY', 'Cust. Count', 'Sales Amount', 'Sales Count', 'GRV Amount', 'GRV Count'];
    const rows = yearlyTableData.map(item => [
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
    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Yearly Sales');
    const filename = `sales_yearly_table_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Export monthly table to Excel
  const exportMonthlyTableToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const headers = ['Month', 'Net Amount', 'Net Change', 'Net QTY', 'Cust. Count', 'Sales Amount', 'Sales Count', 'GRV Amount', 'GRV Count'];
    const rows = monthlyTableData.map(item => [
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

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Monthly Sales');

    const filename = `sales_monthly_table_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-medium text-slate-800 tracking-tight">Sales Overview</h1>
          </div>
        </div>
      </div>


      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Total Sales</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">
                {metrics.totalAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-indigo-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">AVG AMOUNT / MON</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">
                {metrics.avgMonthlyAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Total Qty</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">
                {metrics.totalQty.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <Package className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-cyan-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Avg Qty / Mon</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">
                {metrics.avgMonthlyQty.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
            </div>
            <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <TrendingUp className="w-5 h-5 text-cyan-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Customers</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">{metrics.totalCustomers}</p>
            </div>
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Products</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">{metrics.totalProducts}</p>
            </div>
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Sales Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Monthly Sales Trend</h2>
        {chartData.length > 0 ? (
          <div className="space-y-6">
            {/* Amount Chart */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Amount</h3>
              <div className="relative" style={{ height: '380px' }}>
                {/* Top labels row with connecting lines */}
                <div className="absolute top-0 left-0 right-0 h-12 z-10" style={{ paddingLeft: '40px', paddingRight: '30px' }}>
                  <div className="relative w-full h-full">
                    <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                      {chartData.map((item, index) => {
                        const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                        return (
                          <line
                            key={index}
                            x1={`${xPercent}%`}
                            y1="30"
                            x2={`${xPercent}%`}
                            y2="12"
                            stroke="#d1d5db"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                          />
                        );
                      })}
                    </svg>
                    <div className="relative w-full" style={{ height: '30px' }}>
                      {chartData.map((item, index) => {
                        const value = item.amount;
                        const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                        const isNegative = value < 0;
                        return (
                          <div
                            key={index}
                            className="absolute text-base font-bold text-center"
                            style={{
                              left: `${xPercent}%`,
                              transform: 'translateX(-50%)',
                              top: 0,
                              color: isNegative ? '#ef4444' : '#374151'
                            }}
                          >
                            {value.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 50, right: 30, left: 40, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke="#6b7280"
                      style={{ fontSize: '16px', fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      style={{ fontSize: '11px' }}
                      tickFormatter={() => ''}
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                      hide={true}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        padding: '12px'
                      }}
                      formatter={(value: number, name: string, props: any) => {
                        const isNegative = value < 0;
                        const displayName = name === 'Difference from Previous Month' || name === 'amountDiff' ? 'DIFF' : 'Amount';
                        return [
                          <span key="value" style={{ color: isNegative ? '#ef4444' : '#374151' }}>
                            {value.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            })}
                          </span>,
                          displayName
                        ];
                      }}
                      labelStyle={{
                        color: '#374151',
                        fontWeight: 600,
                        marginBottom: '8px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#10b981"
                      strokeWidth={3}
                      name="Amount"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.4))' }}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const isNegative = payload?.isNegativeAmount;
                        const isMaxMonth = payload?.isMaxMonth;
                        const radius = isMaxMonth ? 8 : (isNegative ? 6 : 4);
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={radius}
                            fill={isNegative ? "#ef4444" : (isMaxMonth ? "#fbbf24" : "#10b981")}
                            stroke={isNegative ? "#dc2626" : (isMaxMonth ? "#f59e0b" : "#059669")}
                            strokeWidth={isMaxMonth ? 3 : (isNegative ? 2 : 0)}
                            style={{
                              filter: isMaxMonth
                                ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.9)) drop-shadow(0 2px 8px rgba(245, 158, 11, 0.6))'
                                : (isNegative ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.5))')
                            }}
                          />
                        );
                      }}
                      activeDot={{ r: 7, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amountDiff"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Difference from Previous Month"
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const isNegative = payload?.isNegativeAmountDiff;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill={isNegative ? "#ef4444" : "#10b981"}
                            stroke={isNegative ? "#dc2626" : "#059669"}
                            strokeWidth={isNegative ? 2 : 0}
                            style={{
                              filter: isNegative
                                ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))'
                                : 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.5))'
                            }}
                          />
                        );
                      }}
                      activeDot={{ r: 6, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quantity Chart */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Quantity</h3>
              <div className="relative" style={{ height: '380px' }}>
                {/* Top labels row with connecting lines */}
                <div className="absolute top-0 left-0 right-0 h-12 z-10" style={{ paddingLeft: '40px', paddingRight: '30px' }}>
                  <div className="relative w-full h-full">
                    <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                      {chartData.map((item, index) => {
                        const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                        return (
                          <line
                            key={index}
                            x1={`${xPercent}%`}
                            y1="30"
                            x2={`${xPercent}%`}
                            y2="12"
                            stroke="#d1d5db"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                          />
                        );
                      })}
                    </svg>
                    <div className="relative w-full" style={{ height: '30px' }}>
                      {chartData.map((item, index) => {
                        const value = item.qty;
                        const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                        const isNegative = value < 0;
                        return (
                          <div
                            key={index}
                            className="absolute text-base font-bold text-center"
                            style={{
                              left: `${xPercent}%`,
                              transform: 'translateX(-50%)',
                              top: 0,
                              color: isNegative ? '#ef4444' : '#374151'
                            }}
                          >
                            {value.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 50, right: 30, left: 40, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke="#6b7280"
                      style={{ fontSize: '16px', fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      style={{ fontSize: '11px' }}
                      tickFormatter={() => ''}
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                      hide={true}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        padding: '12px'
                      }}
                      formatter={(value: number, name: string, props: any) => {
                        const isNegative = value < 0;
                        const displayName = name === 'Difference from Previous Month' || name === 'qtyDiff' ? 'DIFF' : 'Quantity';
                        return [
                          <span key="value" style={{ color: isNegative ? '#ef4444' : '#374151' }}>
                            {value.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            })}
                          </span>,
                          displayName
                        ];
                      }}
                      labelStyle={{
                        color: '#374151',
                        fontWeight: 600,
                        marginBottom: '8px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="qty"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4))' }}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const isNegative = payload?.isNegativeQty;
                        const isMaxMonth = payload?.isMaxMonth;
                        const radius = isMaxMonth ? 8 : (isNegative ? 6 : 4);
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={radius}
                            fill={isNegative ? "#ef4444" : (isMaxMonth ? "#fbbf24" : "#3b82f6")}
                            stroke={isNegative ? "#dc2626" : (isMaxMonth ? "#f59e0b" : "#2563eb")}
                            strokeWidth={isMaxMonth ? 3 : (isNegative ? 2 : 0)}
                            style={{
                              filter: isMaxMonth
                                ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.9)) drop-shadow(0 2px 8px rgba(245, 158, 11, 0.6))'
                                : (isNegative ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.5))')
                            }}
                          />
                        );
                      }}
                      activeDot={{ r: 7, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                    />
                    <Line
                      type="monotone"
                      dataKey="qtyDiff"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Difference from Previous Month"
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const isNegative = payload?.isNegativeQtyDiff;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill={isNegative ? "#ef4444" : "#10b981"}
                            stroke={isNegative ? "#dc2626" : "#059669"}
                            strokeWidth={isNegative ? 2 : 0}
                            style={{
                              filter: isNegative
                                ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))'
                                : 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.5))'
                            }}
                          />
                        );
                      }}
                      activeDot={{ r: 6, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96 text-gray-500">
            <p>No sales data available for chart</p>
          </div>
        )}
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Year</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Net Amount</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Net Change</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Net QTY</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cust. Count</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sales Amount</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sales Count</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">GRV Amount</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">GRV Count</th>
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
              {yearlyTableData.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    No yearly sales data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Sales Table */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Monthly Sales</h2>
          <button
            onClick={exportMonthlyTableToExcel}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Month</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Net Amount</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Net Change</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Net QTY</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cust. Count</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sales Amount</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sales Count</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">GRV Amount</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">GRV Count</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTableData.map((item, index) => (
                <tr key={item.monthKey} className="border-b border-gray-100 hover:bg-gray-50">
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
              {monthlyTableData.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    No monthly sales data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
