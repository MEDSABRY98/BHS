import React, { useMemo } from 'react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { getPaymentCategory } from '../Utils/PaymentType';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { Wallet, TrendingUp, TrendingDown, CreditCard, Activity } from 'lucide-react';

export default function DashboardTab() {
  const { paymentsData } = usePaymentAnalysis();

  const { stats, yoyData, currentYearTotal, previousYearYTD } = useMemo(() => {
    let collected = 0;
    let refunded = 0;
    
    let currentTotal = 0;
    let prevYTD = 0;

    const today = new Date();
    const currentYear = today.getFullYear();
    const previousYear = currentYear - 1;
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    // Initialize monthly data for YoY chart
    const monthlyMap = new Map<number, { month: string, current: number, previous: number }>();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    months.forEach((m, i) => {
      monthlyMap.set(i, { month: m, current: 0, previous: 0 });
    });

    paymentsData.forEach(row => {
      const category = getPaymentCategory(row);
      if (category === 'Other') return; // Skip non-payments
      const isRefund = category === 'Refund';
      const amount = isRefund ? -(Number(row.debit) || 0) : (Number(row.credit) || 0);

      // Global Stats
      if (amount > 0) collected += amount;
      else refunded += Math.abs(amount);

      // YoY Data
      if (row.date) {
        const d = new Date(row.date);
        if (!isNaN(d.getTime())) {
          const m = d.getMonth();
          const y = d.getFullYear();
          
          if (y === currentYear) {
            const currentData = monthlyMap.get(m)!;
            currentData.current += amount; // net amount for the month
            currentTotal += amount;
          } else if (y === previousYear) {
            const currentData = monthlyMap.get(m)!;
            currentData.previous += amount;
            
            // Compare YTD up to today's date in previous year
            if (m < currentMonth || (m === currentMonth && d.getDate() <= currentDay)) {
              prevYTD += amount;
            }
          }
        }
      }
    });

    return {
      stats: {
        collected,
        refunded,
        net: collected - refunded
      },
      yoyData: Array.from(monthlyMap.values()),
      currentYearTotal: currentTotal,
      previousYearYTD: prevYTD
    };
  }, [paymentsData]);

  // Calculate year-to-date growth
  const yearGrowth = previousYearYTD ? ((currentYearTotal - previousYearYTD) / previousYearYTD) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Collections Overview</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Net Collected This Year */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="w-24 h-24 text-emerald-600" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-xs">Collected This Year</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="font-mono font-black text-3xl text-slate-800">
                {currentYearTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${yearGrowth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {yearGrowth > 0 ? '+' : ''}{yearGrowth.toFixed(1)}%
              </span>
              <span className="text-xs font-medium text-slate-400">vs YTD Last Year</span>
            </div>
          </div>
        </div>

        {/* Total Collected (Gross) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-24 h-24 text-slate-600" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-xs">Total Collected</h3>
            </div>
            <div className="font-mono font-black text-3xl text-slate-800">
              {stats.collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-2 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Gross All Time
            </p>
          </div>
        </div>

        {/* Total Refunded */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingDown className="w-24 h-24 text-red-600" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-xs">Total Refunded</h3>
            </div>
            <div className="font-mono font-black text-3xl text-slate-800">
              {stats.refunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs font-semibold text-red-600 mt-2 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Bounced & Returns
            </p>
          </div>
        </div>

        {/* Net Collection */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.2)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-24 h-24 text-[#D4AF37]" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 text-[#D4AF37] flex items-center justify-center backdrop-blur-md">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-300 uppercase tracking-wider text-xs">Net Collection</h3>
            </div>
            <div className="font-mono font-black text-3xl text-white">
              {stats.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs font-semibold text-[#D4AF37] mt-2 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Actual Cash All Time
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* YoY Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Year-Over-Year Comparison</h3>
              <p className="text-sm text-slate-500 mt-1">Comparing net collections per month</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${yearGrowth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {yearGrowth > 0 ? '+' : ''}{yearGrowth.toFixed(1)}% vs Last Year
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yoyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                  tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}
                />
                <Tooltip 
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -4px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [
                    value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                    'Net Collection'
                  ]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar 
                  dataKey="previous" 
                  name={`${new Date().getFullYear() - 1}`} 
                  fill="#CBD5E1" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={40}
                />
                <Bar 
                  dataKey="current" 
                  name={`${new Date().getFullYear()}`} 
                  fill="#0F172A" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cumulative Line Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Collection Trends</h3>
            <p className="text-sm text-slate-500 mt-1">Monthly performance tracking</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yoyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                  tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -4px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [
                    value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                    'Current Year'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="current" 
                  name="Current Year"
                  stroke="#D4AF37" 
                  strokeWidth={4}
                  dot={{ fill: '#D4AF37', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
