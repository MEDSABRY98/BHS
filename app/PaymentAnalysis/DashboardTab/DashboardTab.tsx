import React, { useMemo } from 'react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { getPaymentCategory } from '../Utils/PaymentType';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { Wallet, TrendingUp, TrendingDown, CreditCard, Activity } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayOf = (v: unknown) => String(v ?? '').split('T')[0];
/** Same calendar day one year earlier (keeps 29 Feb valid). */
function shiftYear(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y + years, m, 0).getDate();
  return `${y + years}-${pad2(m)}-${pad2(Math.min(d, last))}`;
}

const CLASS_COLORS = ['#D4AF37', '#0F172A', '#059669', '#3B82F6', '#A855F7', '#F472B6', '#14B8A6', '#F97316'];
const NO_CLASS = 'No Class';
const classColor = (cls: string, i: number) => (cls === NO_CLASS ? '#CBD5E1' : CLASS_COLORS[i % CLASS_COLORS.length]);
const compactMoney = (val: number) =>
  Math.abs(val) >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : Math.abs(val) >= 1_000 ? `${(val / 1_000).toFixed(0)}K` : String(Math.round(val));
const fullMoney = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function DashboardTab() {
  const { paymentsData, paymentsAllDates, dateRange } = usePaymentAnalysis();

  // All-time totals for the cards (follow the date filter, like before)
  const stats = useMemo(() => {
    let collected = 0;
    let refunded = 0;
    paymentsData.forEach(row => {
      const category = getPaymentCategory(row);
      if (category === 'Other') return;
      const amount = category === 'Refund' ? -(Number(row.debit) || 0) : (Number(row.credit) || 0);
      if (amount > 0) collected += amount;
      else refunded += Math.abs(amount);
    });
    return { collected, refunded, net: collected - refunded };
  }, [paymentsData]);

  // Period vs same period last year. Uses the data WITHOUT the date filter, otherwise last year's
  // rows are filtered out as soon as a date range is selected and the comparison disappears.
  const { yoyData, currentYearTotal, previousYearYTD, isFiltered, curLabel, prevLabel, period } = useMemo(() => {
    const today = new Date();
    const isFiltered = !!(dateRange.start || dateRange.end);
    const start = dateRange.start || `${today.getFullYear()}-01-01`;
    const end = dateRange.end || isoDay(today);
    const pStart = shiftYear(start, -1);
    const pEnd = shiftYear(end, -1);
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);

    // chart months: whole calendar year when there is no filter, otherwise the months of the range
    const lastY = isFiltered ? ey : sy;
    const lastM = isFiltered ? em : 12;
    const monthKeys: { key: string; label: string }[] = [];
    const multiYear = lastY !== sy;
    for (let y = sy, m = isFiltered ? sm : 1; y < lastY || (y === lastY && m <= lastM); ) {
      monthKeys.push({
        key: `${y}-${pad2(m)}`,
        label: multiYear ? `${MONTHS[m - 1]} ${String(y).slice(2)}` : MONTHS[m - 1],
      });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }

    const curByMonth = new Map<string, number>();
    const prevByMonth = new Map<string, number>();
    let curTotal = 0;
    let prevTotal = 0;

    paymentsAllDates.forEach(row => {
      const category = getPaymentCategory(row);
      if (category === 'Other') return;
      const amount = category === 'Refund' ? -(Number(row.debit) || 0) : (Number(row.credit) || 0);
      const d = dayOf(row.date);
      if (!d) return;
      const key = d.slice(0, 7);

      if (d >= start && d <= end) {
        curTotal += amount;
        curByMonth.set(key, (curByMonth.get(key) || 0) + amount);
      }
      if (d >= pStart && d <= pEnd) {
        prevTotal += amount; // same dates last year (YTD when there is no filter)
      }
      // chart: last year's months — the full previous year when there is no filter
      const inPrevChart = isFiltered ? d >= pStart && d <= pEnd : d.slice(0, 4) === String(sy - 1);
      if (inPrevChart) prevByMonth.set(key, (prevByMonth.get(key) || 0) + amount);
    });

    const yoyData = monthKeys.map(({ key, label }) => {
      const [y, m] = key.split('-');
      return {
        month: label,
        current: curByMonth.get(key) || 0,
        previous: prevByMonth.get(`${Number(y) - 1}-${m}`) || 0,
      };
    });

    return {
      yoyData,
      currentYearTotal: curTotal,
      previousYearYTD: prevTotal,
      isFiltered,
      curLabel: multiYear ? 'This period' : String(sy),
      prevLabel: multiYear ? 'Last year' : String(sy - 1),
      period: { start, end, pStart, pEnd, monthKeys },
    };
  }, [paymentsAllDates, dateRange]);


  // Collections by customer class (same period / same filters as the rest of the page)
  const classInfo = useMemo(() => {
    const { start, end, pStart, pEnd, monthKeys } = period;
    const clsOf = (v?: string | null) => (v || '').trim() || NO_CLASS;
    const cur = new Map<string, number>();
    const prev = new Map<string, number>();
    const monthly = new Map<string, Map<string, number>>(); // 'YYYY-MM' -> class -> net

    paymentsAllDates.forEach(row => {
      const category = getPaymentCategory(row);
      if (category === 'Other') return;
      const amount = category === 'Refund' ? -(Number(row.debit) || 0) : (Number(row.credit) || 0);
      const d = dayOf(row.date);
      if (!d) return;
      const cls = clsOf(row.customerClass);
      if (d >= start && d <= end) {
        cur.set(cls, (cur.get(cls) || 0) + amount);
        const key = d.slice(0, 7);
        const m = monthly.get(key) || new Map<string, number>();
        m.set(cls, (m.get(cls) || 0) + amount);
        monthly.set(key, m);
      }
      if (d >= pStart && d <= pEnd) prev.set(cls, (prev.get(cls) || 0) + amount);
    });

    const classes = Array.from(new Set([...cur.keys(), ...prev.keys()])).sort((a, b) => {
      if (a === NO_CLASS) return 1;
      if (b === NO_CLASS) return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
    const positiveTotal = classes.reduce((s, c) => s + Math.max(cur.get(c) || 0, 0), 0);
    const rows = classes.map((cls, i) => ({
      cls,
      color: classColor(cls, i),
      current: cur.get(cls) || 0,
      previous: prev.get(cls) || 0,
      share: positiveTotal ? (Math.max(cur.get(cls) || 0, 0) / positiveTotal) * 100 : 0,
    }));
    const monthlyRows = monthKeys.map(({ key, label }) => {
      const row: Record<string, number | string> = { month: label };
      classes.forEach(c => {
        row[c] = monthly.get(key)?.get(c) || 0;
      });
      return row;
    });
    return { rows, monthlyRows, classes, positiveTotal };
  }, [paymentsAllDates, period]);

  // Growth vs the same period last year (null when there is nothing to compare with)
  const yearGrowth: number | null = previousYearYTD
    ? ((currentYearTotal - previousYearYTD) / Math.abs(previousYearYTD)) * 100
    : null;
  const growthText = yearGrowth === null ? 'N/A' : `${yearGrowth > 0 ? '+' : ''}${yearGrowth.toFixed(1)}%`;
  const growthUp = (yearGrowth ?? 0) >= 0;

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
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-xs">{isFiltered ? 'Collected (Period)' : 'Collected This Year'}</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="font-mono font-black text-3xl text-slate-800">
                {currentYearTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${growthUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {growthText}
              </span>
              <span className="text-xs font-medium text-slate-400">{isFiltered ? 'vs same period last year' : 'vs YTD Last Year'}</span>
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
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${growthUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {growthText} vs Last Year
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
                  name={prevLabel} 
                  fill="#CBD5E1" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={40}
                />
                <Bar 
                  dataKey="current" 
                  name={curLabel} 
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
      {/* Collections by customer class */}
      <div className="pt-2">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">Collections by Class</h3>
      </div>

      {classInfo.rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200/60 text-center text-slate-400 font-semibold">
          No class data for this period
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Share donut */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-800">Share of Collections</h3>
                <p className="text-sm text-slate-500 mt-1">Each class as a percentage of net collected</p>
              </div>
              <div className="h-80 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classInfo.rows.filter(r => r.current > 0)}
                      dataKey="current"
                      nameKey="cls"
                      innerRadius="58%"
                      outerRadius="85%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {classInfo.rows.filter(r => r.current > 0).map(r => (
                        <Cell key={r.cls} fill={r.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -4px rgba(0,0,0,0.1)' }}
                      formatter={(value: number, name: string) => [
                        `${fullMoney(value)} (${classInfo.positiveTotal ? ((value / classInfo.positiveTotal) * 100).toFixed(1) : '0.0'}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Collected</span>
                  <span className="font-mono font-black text-2xl text-slate-800">{compactMoney(classInfo.positiveTotal)}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 justify-center">
                {classInfo.rows.map(r => (
                  <div key={r.cls} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full" style={{ background: r.color }} />
                    <span className="font-bold text-slate-700">{r.cls}</span>
                    <span className="font-mono text-slate-500">{r.share.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* This period vs last year by class */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-800">Class vs Last Year</h3>
                <p className="text-sm text-slate-500 mt-1">Net collections per class, {curLabel} vs {prevLabel}</p>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classInfo.rows} margin={{ top: 24, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="cls" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 13, fontWeight: 700 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} tickFormatter={compactMoney} />
                    <Tooltip
                      cursor={{ fill: '#F1F5F9' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -4px rgba(0,0,0,0.1)' }}
                      formatter={(value: number, name: string) => [fullMoney(value), name]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px' }} />
                    <Bar dataKey="previous" name={prevLabel} fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={44}
                      label={{ position: 'top', fill: '#475569', fontSize: 12, fontWeight: 700, formatter: (v: any) => (v ? compactMoney(Number(v)) : '') }} />
                    <Bar dataKey="current" name={curLabel} fill="#D4AF37" radius={[4, 4, 0, 0]} maxBarSize={44}
                      label={{ position: 'top', fill: '#B8860B', fontSize: 12, fontWeight: 700, formatter: (v: any) => (v ? compactMoney(Number(v)) : '') }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Monthly stacked by class */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-800">Monthly Collections by Class</h3>
              <p className="text-sm text-slate-500 mt-1">How each class contributes to every month</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classInfo.monthlyRows} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} tickFormatter={compactMoney} />
                  <Tooltip
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -4px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => [fullMoney(value), name]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px' }} />
                  {classInfo.rows.map(r => (
                    <Bar key={r.cls} dataKey={r.cls} name={r.cls} stackId="classes" fill={r.color} maxBarSize={48} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
