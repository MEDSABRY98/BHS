'use client';

import { useMemo } from 'react';
import { SalesInvoice } from '@/lib/supabase';
import { DollarSign, Package, TrendingUp, BarChart3 } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

interface DashboardTabProps {
  productData: SalesInvoice[];
  monthlySales: any[];
  allData: SalesInvoice[];
  productId: string;
  filterYear?: string;
}

export default function DashboardTab({ productData, monthlySales, allData, productId, filterYear }: DashboardTabProps) {
  // Dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const totalAmount = productData.reduce((sum, item) => sum + item.amount, 0);
    const totalQty = productData.reduce((sum, item) => sum + item.qty, 0);
    
    // Count unique customers by customerId
    const uniqueCustomerIds = new Set(productData.map(item => item.customerId || item.customerName));
    const uniqueCustomers = uniqueCustomerIds.size;

    // Calculate months from first month to current month (not just active months)
    let totalMonths = 1;
    if (monthlySales.length > 0) {
      // Find earliest month from monthlySales
      const sortedMonths = [...monthlySales].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      const firstMonthKey = sortedMonths[0].monthKey;
      const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);

      // Get current date
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-based for comparison

      // Calculate months from first month to current month (inclusive)
      const firstDate = new Date(firstYear, firstMonth - 1, 1);
      const lastDate = new Date(currentYear, currentMonth - 1, 1);

      // Calculate difference in months
      const yearsDiff = lastDate.getFullYear() - firstDate.getFullYear();
      const monthsDiff = lastDate.getMonth() - firstDate.getMonth();
      totalMonths = (yearsDiff * 12) + monthsDiff + 1; // +1 to include both start and end months
    }

    const avgMonthlyAmount = totalMonths > 0 ? totalAmount / totalMonths : 0;
    const avgMonthlyQty = totalMonths > 0 ? totalQty / totalMonths : 0;

    // Count only months where product actually had sales (not zero months)
    const activeMonths = monthlySales.filter(month => !month.isZeroMonth && month.count > 0).length;

    return {
      totalAmount,
      totalQty,
      uniqueCustomers,
      uniqueMonths: activeMonths, // Only months with actual sales
      totalMonths, // Total months from start to now
      avgMonthlyAmount,
      avgMonthlyQty
    };
  }, [productData, monthlySales]);

  // Get all product data from unfiltered source (for comparison)
  const productAllData = useMemo(() => {
    const source = allData.length > 0 ? allData : productData;
    return source.filter(item => (item.productId || item.barcode || item.product) === productId);
  }, [allData, productData, productId]);

  // Chart data for monthly sales - Jan-Dec comparison
  const chartData = useMemo(() => {
    if (productAllData.length === 0) return [];

    const monthMap = new Map<string, { amount: number; qty: number }>();
    productAllData.forEach(item => {
      if (!item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { amount: 0, qty: 0 };
      existing.amount += item.amount;
      existing.qty += item.qty;
      monthMap.set(key, existing);
    });

    // Determine target year
    let targetYear: number;
    if (filterYear) {
      targetYear = parseInt(filterYear, 10);
    } else {
      const allKeys = Array.from(monthMap.keys()).sort();
      const latestKey = allKeys[allKeys.length - 1];
      targetYear = latestKey ? parseInt(latestKey.split('-')[0], 10) : new Date().getFullYear();
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

      const diffAmount = currData.amount - prevData.amount;
      const percentAmount = prevData.amount !== 0 ? (diffAmount / Math.abs(prevData.amount)) * 100 : (currData.amount !== 0 ? 100 : 0);

      const diffQty = currData.qty - prevData.qty;
      const percentQty = prevData.qty !== 0 ? (diffQty / Math.abs(prevData.qty)) * 100 : (currData.qty !== 0 ? 100 : 0);

      const isFuture = (targetYear > nowYear) || (targetYear === nowYear && m > nowMonth);

      result.push({
        month: monthNames[m - 1],
        currentAmount: currData.amount,
        prevAmount: prevData.amount,
        diffAmount,
        percentAmount,
        isPositiveAmount: diffAmount >= 0,
        currentQty: currData.qty,
        prevQty: prevData.qty,
        diffQty,
        percentQty,
        isPositiveQty: diffQty >= 0,
        isFuture,
        legendCurr: String(targetYear),
        legendPrev: String(prevYear)
      });
    }

    // Set baselines for indicators
    const maxAmount = Math.max(...result.map(r => Math.max(r.currentAmount, r.prevAmount)));
    const maxQty = Math.max(...result.map(r => Math.max(r.currentQty, r.prevQty)));

    result.forEach(r => {
      // @ts-ignore
      r.topBaselineAmount = maxAmount * 1.25;
      // @ts-ignore
      r.topBaselineQty = maxQty * 1.25;
    });

    return result;
  }, [productAllData, filterYear]);

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Total Sales Amount</h3>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-gray-800">
            {dashboardMetrics.totalAmount.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Total Quantity</h3>
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xl font-black text-gray-800">
            {dashboardMetrics.totalQty.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Avg Monthly Amount</h3>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-xl font-black text-gray-800">
            {dashboardMetrics.avgMonthlyAmount.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Avg Monthly Quantity</h3>
            <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-xl font-black text-gray-800">
            {dashboardMetrics.avgMonthlyQty.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Total Customers</h3>
            <Package className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-xl font-black text-gray-800">{dashboardMetrics.uniqueCustomers}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Active Months</h3>
            <BarChart3 className="w-5 h-5 text-teal-600" />
          </div>
          <p className="text-xl font-black text-gray-800">{dashboardMetrics.uniqueMonths}</p>
        </div>
      </div>

      {/* Monthly Sales Performance Comparison */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Monthly Sales Performance Comparison</h2>
        {chartData.length > 0 ? (
          <div className="space-y-12">
            {/* Amount Chart */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-700 mb-6 flex items-center gap-2 uppercase tracking-wider">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Sales Amount Comparison
              </h3>
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
                          const isPositive = data.isPositiveAmount;
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
                                  <span className="font-bold text-emerald-600">
                                    {data.currentAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 font-medium w-20 inline-block">Diff:</span>
                                  <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isPositive ? '+' : '-'}{Math.abs(data.diffAmount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 font-medium w-20 inline-block">Growth:</span>
                                  <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isPositive ? '+' : '-'}{data.percentAmount.toFixed(1)}%
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
                        <Cell key={`cell-amount-${index}`} fill={entry.isPositiveAmount ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>

                    {/* Performance Labels */}
                    <Line
                      type="monotone"
                      dataKey="topBaselineAmount"
                      stroke="none"
                      dot={false}
                      activeDot={false}
                      legendType="none"
                    >
                      <LabelList
                        dataKey="diffAmount"
                        content={(props: any) => {
                          const { x, index } = props;
                          const entry = chartData[index];
                          if (!entry) return null;

                          const isPositive = entry.isPositiveAmount;
                          const isFuture = entry.isFuture && entry.currentAmount === 0;
                          const color = isFuture ? '#94a3b8' : (isPositive ? '#059669' : '#e11d48');

                          const diffStr = isFuture ? '-' : ((isPositive ? '▲ +' : '▼ ') + Math.abs(entry.diffAmount).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }));
                          const percentStr = isFuture ? '' : (entry.percentAmount.toFixed(1) + '%');

                          return (
                            <g style={{ pointerEvents: 'none' }}>
                              <rect x={x - 45} y={10} width={90} height={55} rx={12} fill={isFuture ? '#f8fafc' : (isPositive ? '#f0fdf4' : '#fef2f2')} stroke={isFuture ? '#e2e8f0' : (isPositive ? '#bcf0da' : '#fecaca')} strokeWidth={1.5} className="shadow-sm" />
                              <text x={x} y={isFuture ? 42 : 35} fill={color} textAnchor="middle" style={{ fontSize: isFuture ? '20px' : '14px', fontWeight: '900' }}>{diffStr}</text>
                              {!isFuture && <text x={x} y={55} fill={color} textAnchor="middle" style={{ fontSize: '12px', fontWeight: '800', opacity: 0.8 }}>{percentStr}</text>}
                            </g>
                          );
                        }}
                      />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quantity Chart */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-700 mb-6 flex items-center gap-2 uppercase tracking-wider">
                <Package className="w-4 h-4 text-blue-600" />
                Sales Quantity Comparison
              </h3>
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
                          const isPositive = data.isPositiveQty;
                          return (
                            <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 min-w-[180px]">
                              <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{label}</p>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="text-gray-500 font-medium w-20 inline-block">{data.legendPrev}:</span>
                                  <span className="font-bold text-slate-700">
                                    {data.prevQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 font-medium w-20 inline-block">{data.legendCurr}:</span>
                                  <span className="font-bold text-blue-600">
                                    {data.currentQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 font-medium w-20 inline-block">Diff:</span>
                                  <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isPositive ? '+' : '-'}{Math.abs(data.diffQty).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 font-medium w-20 inline-block">Growth:</span>
                                  <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isPositive ? '+' : '-'}{data.percentQty.toFixed(1)}%
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
                      dataKey="prevQty"
                      name={chartData[0]?.legendPrev || "Last Year"}
                      fill="#cbd5e1"
                      radius={[4, 4, 0, 0]}
                      barSize={45}
                    >
                      <LabelList
                        dataKey="prevQty"
                        position="top"
                        formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                        style={{ fontSize: '13px', fontWeight: '900', fill: '#64748b' }}
                        offset={10}
                      />
                    </Bar>

                    {/* Current Year Bar */}
                    <Bar
                      dataKey="currentQty"
                      name={chartData[0]?.legendCurr || "Current Year"}
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      barSize={45}
                    >
                      <LabelList
                        dataKey="currentQty"
                        position="top"
                        formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                        style={{ fontSize: '13px', fontWeight: '900', fill: '#2563eb' }}
                        offset={10}
                      />

                      {chartData.map((entry, index) => (
                        <Cell key={`cell-qty-${index}`} fill={entry.isPositiveQty ? '#3b82f6' : '#f43f5e'} />
                      ))}
                    </Bar>

                    {/* Performance Labels */}
                    <Line
                      type="monotone"
                      dataKey="topBaselineQty"
                      stroke="none"
                      dot={false}
                      activeDot={false}
                      legendType="none"
                    >
                      <LabelList
                        dataKey="diffQty"
                        content={(props: any) => {
                          const { x, index } = props;
                          const entry = chartData[index];
                          if (!entry) return null;

                          const isPositive = entry.isPositiveQty;
                          const isFuture = entry.isFuture && entry.currentQty === 0;
                          const color = isFuture ? '#94a3b8' : (isPositive ? '#059669' : '#e11d48');

                          const diffStr = isFuture ? '-' : ((isPositive ? '▲ +' : '▼ ') + Math.abs(entry.diffQty).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }));
                          const percentStr = isFuture ? '' : (entry.percentQty.toFixed(1) + '%');

                          return (
                            <g style={{ pointerEvents: 'none' }}>
                              <rect x={x - 45} y={10} width={90} height={55} rx={12} fill={isFuture ? '#f8fafc' : (isPositive ? '#f0fdf4' : '#fef2f2')} stroke={isFuture ? '#e2e8f0' : (isPositive ? '#bcf0da' : '#fecaca')} strokeWidth={1.5} className="shadow-sm" />
                              <text x={x} y={isFuture ? 42 : 35} fill={color} textAnchor="middle" style={{ fontSize: isFuture ? '20px' : '14px', fontWeight: '900' }}>{diffStr}</text>
                              {!isFuture && <text x={x} y={55} fill={color} textAnchor="middle" style={{ fontSize: '12px', fontWeight: '800', opacity: 0.8 }}>{percentStr}</text>}
                            </g>
                          );
                        }}
                      />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-500">No Data Available</h3>
          </div>
        )}
      </div>
    </div>
  );
}
