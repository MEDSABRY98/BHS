'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { TrendingUp, Package, Users, DollarSign, BarChart3, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown, Download, Filter, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  Line,
} from 'recharts';

interface SalesOverviewTabProps {
  data: SalesInvoice[];
  allData: SalesInvoice[]; // Data filtered by geography but not by time
  loading: boolean;
  selectedYear?: string;
}


export default function SalesOverviewTab({ data, allData, loading, selectedYear }: SalesOverviewTabProps) {
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

  // Chart data for monthly sales - show Jan-Dec of the main year
  const chartData = useMemo(() => {
    if (allData.length === 0) return [];

    const monthMap = new Map<string, { amount: number; qty: number }>();
    allData.forEach(item => {
      if (!item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { amount: 0, qty: 0 };
      existing.amount += item.amount;
      existing.qty += item.qty;
      monthMap.set(key, existing);
    });

    // Determine the target year
    let targetYear: number;
    if (selectedYear) {
      targetYear = parseInt(selectedYear, 10);
    } else {
      const allKeys = Array.from(monthMap.keys()).sort();
      const latestKey = allKeys[allKeys.length - 1];
      targetYear = parseInt(latestKey.split('-')[0], 10);
    }

    const prevYear = targetYear - 1;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    const result = [];

    for (let m = 1; m <= 12; m++) {
      const currKey = `${targetYear}-${String(m).padStart(2, '0')}`;
      const prevKey = `${prevYear}-${String(m).padStart(2, '0')}`;

      const currData = monthMap.get(currKey) || { amount: 0, qty: 0 };
      const prevData = monthMap.get(prevKey) || { amount: 0, qty: 0 };

      const diff = currData.amount - prevData.amount;
      const percent = prevData.amount !== 0 ? (diff / Math.abs(prevData.amount)) * 100 : (currData.amount !== 0 ? 100 : 0);

      const isFuture = (targetYear > nowYear) || (targetYear === nowYear && m > nowMonth);

      result.push({
        month: monthNames[m - 1],
        year: String(targetYear).slice(-2),
        prevYear: String(prevYear).slice(-2),
        currentAmount: currData.amount,
        prevAmount: prevData.amount,
        diff,
        percent,
        isPositive: diff >= 0,
        isFuture,
        legendCurr: String(targetYear),
        legendPrev: String(prevYear)
      });
    }

    const maxAmount = Math.max(...result.map(r => Math.max(r.currentAmount, r.prevAmount)));
    result.forEach(r => {
      // @ts-ignore
      r.topBaseline = maxAmount * 1.25;
    });

    return result;
  }, [allData, selectedYear]);

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

      {/* Monthly Sales Comparison Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 overflow-hidden">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Monthly Sales Performance Comparison</h2>
        {chartData.length > 0 ? (
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md overflow-hidden">
            <div className="relative w-full" style={{ height: '550px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 80, right: 30, left: 40, bottom: 20 }}
                  barGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#475569"
                    style={{ fontSize: '15px', fontWeight: 900 }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis hide={true} domain={[0, 'auto']} />
                  <Tooltip
                    content={(props: any) => {
                      const { active, payload, label } = props;
                      if (active && payload && payload.length > 0) {
                        const data = payload[0].payload;
                        const isPositive = data.isPositive;
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 min-w-[180px]">
                            <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{label}</p>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="text-gray-500 font-medium w-20 inline-block">{data.legendPrev}:</span>
                                <span className="font-bold text-slate-700">
                                  {data.prevAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-medium w-20 inline-block">{data.legendCurr}:</span>
                                <span className="font-bold text-blue-600">
                                  {data.currentAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-medium w-20 inline-block">Diff:</span>
                                <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {isPositive ? '+' : '-'}{Math.abs(data.diff).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-medium w-20 inline-block">Growth:</span>
                                <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {isPositive ? '+' : '-'}{data.percent.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />

                  {/* Previous Year Bar */}
                  <Bar
                    dataKey="prevAmount"
                    name={chartData[0]?.legendPrev || "Last Year"}
                    fill="#cbd5e1"
                    radius={[4, 4, 0, 0]}
                    barSize={45}
                  >
                    <LabelList
                      dataKey="prevAmount"
                      position="top"
                      formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                      style={{ fontSize: '13px', fontWeight: '900', fill: '#64748b' }}
                      offset={10}
                    />
                  </Bar>

                  {/* Current Year Bar */}
                  <Bar
                    dataKey="currentAmount"
                    name={chartData[0]?.legendCurr || "Current Year"}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    barSize={45}
                  >
                    <LabelList
                      dataKey="currentAmount"
                      position="top"
                      formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                      style={{ fontSize: '13px', fontWeight: '900', fill: '#059669' }}
                      offset={10}
                    />

                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isPositive ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>

                  {/* Top Row Performance Labels (Centered using a hidden line) */}
                  <Line
                    type="monotone"
                    dataKey="topBaseline"
                    stroke="none"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  >
                    <LabelList
                      dataKey="diff"
                      content={(props: any) => {
                        const { x, index } = props;
                        const entry = chartData[index];
                        if (!entry) return null;

                        const isPositive = entry.isPositive;
                        const isFuture = entry.isFuture && entry.currentAmount === 0;
                        const color = isFuture ? '#94a3b8' : (isPositive ? '#059669' : '#e11d48');
                        
                        const diffStr = isFuture ? '-' : ((isPositive ? '▲ +' : '▼ ') + Math.abs(entry.diff).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }));
                        const percentStr = isFuture ? '' : (entry.percent.toFixed(1) + '%');

                        return (
                          <g style={{ pointerEvents: 'none' }}>
                            {/* Card Background */}
                            <rect 
                              x={x - 45} 
                              y={10} 
                              width={90} 
                              height={55} 
                              rx={12} 
                              fill={isFuture ? '#f8fafc' : (isPositive ? '#f0fdf4' : '#fef2f2')} 
                              stroke={isFuture ? '#e2e8f0' : (isPositive ? '#bcf0da' : '#fecaca')}
                              strokeWidth={1.5}
                              className="shadow-sm"
                            />
                            {/* Difference Text */}
                            <text 
                              x={x} 
                              y={isFuture ? 42 : 35} 
                              fill={color} 
                              textAnchor="middle" 
                              style={{ fontSize: isFuture ? '20px' : '14px', fontWeight: '900' }}
                            >
                              {diffStr}
                            </text>
                            {/* Percentage Text */}
                            {!isFuture && (
                              <text 
                                x={x} 
                                y={55} 
                                fill={color} 
                                textAnchor="middle" 
                                style={{ fontSize: '12px', fontWeight: '800', opacity: 0.8 }}
                              >
                                {percentStr}
                              </text>
                            )}
                          </g>
                        );
                      }}
                    />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <NoData />
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
