import React, { useMemo } from 'react';
import NoData from '@/app/Components/NoDataTab';
import { InvoiceRow } from '@/types';
import { getInvoiceType } from '@/lib/InvoiceType';
import { parseDate } from './PaymentTUtilsTab';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Cell, LabelList } from 'recharts';

interface PaymentTDetailsDashboardTabProps {
  data: InvoiceRow[];
  startDate: Date | null;
  endDate: Date | null;
  searchQuery: string;
  salesRep: string;
}

export default function PaymentTDetailsDashboardTab({
  data,
  startDate,
  endDate,
  searchQuery,
  salesRep
}: PaymentTDetailsDashboardTabProps) {
  const metrics = useMemo(() => {
    if (!startDate || !endDate) return null;

    const baseData = data.filter(inv => {
      const t = getInvoiceType(inv);
      if (t !== 'Payment' && t !== 'R-Payment') return false;
      if (salesRep && salesRep !== 'All Sales Reps' && inv.salesRep?.trim() !== salesRep) return false;
      if (searchQuery && !inv.customerName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    const getFilteredAmount = (p: InvoiceRow) => {
      return (p.credit || 0) - (p.debit || 0);
    };

    const getMetricsForRange = (s: Date, e: Date) => {
      let total = 0;
      let count = 0;
      const customers = new Set<string>();

      const sTime = new Date(s).setHours(0, 0, 0, 0);
      const eTime = new Date(e).setHours(23, 59, 59, 999);

      baseData.forEach(p => {
        const d = parseDate(p.date);
        if (d && d.getTime() >= sTime && d.getTime() <= eTime) {
          const val = getFilteredAmount(p);
          if (val !== 0) {
            total += val;
            if (val > 0.001) {
              count++;
              customers.add(p.customerName.trim());
            }
          }
        }
      });

      return { total, count, uniqueCustomers: customers.size };
    };

    const durationMs = endDate.getTime() - startDate.getTime();

    // Previous Period
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

    // Last Year
    const lyStartDate = new Date(startDate); lyStartDate.setFullYear(lyStartDate.getFullYear() - 1);
    const lyEndDate = new Date(endDate); lyEndDate.setFullYear(lyEndDate.getFullYear() - 1);

    const curMet = getMetricsForRange(startDate, endDate);
    const prevMet = getMetricsForRange(prevStartDate, prevEndDate);
    const lyMet = getMetricsForRange(lyStartDate, lyEndDate);

    const curDays = Math.ceil(durationMs / 86400000);
    const prevDays = Math.ceil((prevEndDate.getTime() - prevStartDate.getTime()) / 86400000);
    const lyDays = Math.ceil((lyEndDate.getTime() - lyStartDate.getTime()) / 86400000);

    const formatDate = (date: Date) => {
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    };

    return {
      curMet, prevMet, lyMet,
      startDate, endDate,
      prevStartDate, prevEndDate,
      lyStartDate, lyEndDate,
      curDays, prevDays, lyDays,
      formatDate
    };
  }, [data, startDate, endDate, searchQuery, salesRep]);

  if (!metrics) {
    return <NoData title="SELECT A VALID DATE RANGE" />;
  }

  const {
    curMet, prevMet, lyMet,
    prevStartDate, prevEndDate,
    lyStartDate, lyEndDate,
    curDays, prevDays, lyDays,
    formatDate
  } = metrics;

  const periods = [
    {
      title: 'CURRENT',
      range: `${formatDate(startDate as Date)} – ${formatDate(endDate as Date)} (${curDays} Days)`,
      amount: curMet.total,
      colors: {
        bg: 'bg-[#f0f6ff]',
        border: 'border-[#3a7fe8]',
        text: 'text-[#3a7fe8]',
        accent: 'bg-[#3a7fe8]'
      }
    },
    {
      title: 'PREVIOUS',
      range: `${prevStartDate ? formatDate(prevStartDate) : ''} – ${prevEndDate ? formatDate(prevEndDate) : ''} (${prevDays} Days)`,
      amount: prevMet.total,
      colors: {
        bg: 'bg-[#f7f7f7]',
        border: 'border-[#a1a1aa]',
        text: 'text-[#52525b]',
        accent: 'bg-[#a1a1aa]'
      }
    },
    {
      title: 'LAST YEAR',
      range: `${lyStartDate ? formatDate(lyStartDate) : ''} – ${lyEndDate ? formatDate(lyEndDate) : ''} (${lyDays} Days)`,
      amount: lyMet.total,
      colors: {
        bg: 'bg-[#f2fbec]',
        border: 'border-[#5aad2e]',
        text: 'text-[#5aad2e]',
        accent: 'bg-[#5aad2e]'
      }
    }
  ];

  const revenueTrend = prevMet.total > 0 ? ((curMet.total - prevMet.total) / prevMet.total) * 100 : 0;
  const countTrend = prevMet.count > 0 ? ((curMet.count - prevMet.count) / prevMet.count) * 100 : 0;
  const custTrend = prevMet.uniqueCustomers > 0 ? ((curMet.uniqueCustomers - prevMet.uniqueCustomers) / prevMet.uniqueCustomers) * 100 : 0;

  const revenueLyTrend = lyMet.total > 0 ? ((curMet.total - lyMet.total) / lyMet.total) * 100 : 0;
  const countLyTrend = lyMet.count > 0 ? ((curMet.count - lyMet.count) / lyMet.count) * 100 : 0;
  const custLyTrend = lyMet.uniqueCustomers > 0 ? ((curMet.uniqueCustomers - lyMet.uniqueCustomers) / lyMet.uniqueCustomers) * 100 : 0;

  const growthCards = [
    {
      title: 'COLLECTIONS GROWTH',
      prevPct: revenueTrend,
      lyPct: revenueLyTrend,
      prevDiff: curMet.total - prevMet.total,
      lyDiff: curMet.total - lyMet.total,
      isCurrency: true,
      colors: { bg: 'bg-[#f4f7fb]', text: 'text-[#3a7fe8]' }
    },
    {
      title: 'CUSTOMER GROWTH',
      prevPct: custTrend,
      lyPct: custLyTrend,
      prevDiff: curMet.uniqueCustomers - prevMet.uniqueCustomers,
      lyDiff: curMet.uniqueCustomers - lyMet.uniqueCustomers,
      isCurrency: false,
      colors: { bg: 'bg-[#f6faf3]', text: 'text-[#5aad2e]' }
    },
    {
      title: 'TRANSACTION GROWTH',
      prevPct: countTrend,
      lyPct: countLyTrend,
      prevDiff: curMet.count - prevMet.count,
      lyDiff: curMet.count - lyMet.count,
      isCurrency: false,
      colors: { bg: 'bg-[#fdf7f2]', text: 'text-[#e57d24]' }
    }
  ];

  const formatDiff = (val: number, isCurrency: boolean) => {
    const absVal = Math.abs(val);
    if (isCurrency && absVal >= 1000000) {
      return (absVal / 1000000).toFixed(2) + 'M';
    } else if (isCurrency && absVal >= 1000) {
      return (absVal / 1000).toFixed(1) + 'K';
    } else if (isCurrency) {
      return absVal.toFixed(0);
    }
    return absVal.toString();
  };

  // Prepare Chart Data
  const maxCollections = Math.max(curMet.total, prevMet.total, lyMet.total, 1);
  const maxCustomers = Math.max(curMet.uniqueCustomers, prevMet.uniqueCustomers, lyMet.uniqueCustomers, 1);
  const maxTxns = Math.max(curMet.count, prevMet.count, lyMet.count, 1);

  const normalize = (val: number, max: number) => (val / max) * 100;

  const chartData = [
    {
      name: 'Collections',
      current: normalize(curMet.total, maxCollections),
      previous: normalize(prevMet.total, maxCollections),
      lastYear: normalize(lyMet.total, maxCollections),
      currentOrig: curMet.total,
      previousOrig: prevMet.total,
      lastYearOrig: lyMet.total,
      isCurrency: true
    },
    {
      name: 'Customer Distribution',
      current: normalize(curMet.uniqueCustomers, maxCustomers),
      previous: normalize(prevMet.uniqueCustomers, maxCustomers),
      lastYear: normalize(lyMet.uniqueCustomers, maxCustomers),
      currentOrig: curMet.uniqueCustomers,
      previousOrig: prevMet.uniqueCustomers,
      lastYearOrig: lyMet.uniqueCustomers,
      isCurrency: false
    },
    {
      name: 'Transaction Volume',
      current: normalize(curMet.count, maxTxns),
      previous: normalize(prevMet.count, maxTxns),
      lastYear: normalize(lyMet.count, maxTxns),
      currentOrig: curMet.count,
      previousOrig: prevMet.count,
      lastYearOrig: lyMet.count,
      isCurrency: false
    }
  ];

  const CustomLabel = (props: any) => {
    const { x, y, width, index, dataKey } = props;

    if (index === undefined || !chartData[index]) return null;

    const origKey = dataKey + 'Orig';
    const originalValue = chartData[index][origKey as keyof typeof chartData[0]] as number | undefined;

    if (originalValue === undefined || originalValue === null || originalValue === 0) return null;

    const isCurrency = chartData[index].isCurrency;

    let displayValue = originalValue.toString();
    if (isCurrency && originalValue >= 1000000) {
      displayValue = (originalValue / 1000000).toFixed(1) + 'M';
    } else if (isCurrency && originalValue >= 1000) {
      displayValue = (originalValue / 1000).toFixed(1) + 'K';
    } else if (isCurrency) {
      displayValue = originalValue.toFixed(0);
    }

    return (
      <text x={x + width / 2} y={y - 10} fill="#111827" fontSize="20" fontWeight="bold" textAnchor="middle">
        {displayValue}
      </text>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Top Period Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {periods.map((p, i) => (
          <div key={i} className={`relative overflow-hidden rounded-[24px] border-2 ${p.colors.border} ${p.colors.bg} p-6 shadow-sm hover:shadow-md transition-shadow`}>
            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${p.colors.accent}`} />
            <div className="ml-3">
              <h3 className={`text-sm font-black tracking-widest ${p.colors.text}`}>{p.title}</h3>
              <p className="text-xs text-gray-500/80 mt-2 font-medium">{p.range}</p>
              <div className={`text-4xl font-extrabold mt-5 ${p.colors.text}`}>
                {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Growth Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {growthCards.map((card, i) => (
          <div key={i} className={`p-5 rounded-[20px] ${card.colors.bg} border border-black/[0.03] shadow-sm flex flex-col justify-center`}>
            <h3 className={`text-[10px] font-bold mb-4 tracking-widest ${card.colors.text}`}>
              {card.title}
            </h3>

            <div className="flex items-center">
              {/* vs Previous */}
              <div className="flex-1">
                <div className={`text-[28px] font-black ${card.prevPct >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'} flex items-baseline gap-2`}>
                  <span>{card.prevPct >= 0 ? '+' : ''}{card.prevPct.toFixed(0)}%</span>
                  <span className="text-sm font-bold opacity-75">
                    ({card.prevDiff >= 0 ? '+' : '-'}{formatDiff(card.prevDiff, card.isCurrency)})
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase">vs previous</div>
              </div>

              {/* Divider */}
              <div className="w-[1px] h-10 bg-gray-200 mx-3" />

              {/* vs Last Year */}
              <div className="flex-1 pl-3">
                <div className={`text-[28px] font-black ${card.lyPct >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'} flex items-baseline gap-2`}>
                  <span>{card.lyPct >= 0 ? '+' : ''}{card.lyPct.toFixed(0)}%</span>
                  <span className="text-sm font-bold opacity-75">
                    ({card.lyDiff >= 0 ? '+' : '-'}{formatDiff(card.lyDiff, card.isCurrency)})
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase">vs last year</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bar Chart Section */}
      <div className="bg-white/90 backdrop-blur-md p-8 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white mt-8 h-[500px]">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Period Comparison</h3>
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={chartData} margin={{ top: 30, right: 0, left: -20, bottom: 0 }} barGap={8} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }} dy={10} />
            <YAxis hide domain={[0, 115]} />
            <Legend
              verticalAlign="top"
              align="left"
              height={40}
              iconType="square"
              formatter={(value) => <span className="text-sm text-gray-600 font-semibold ml-1">{value}</span>}
              wrapperStyle={{ top: -20 }}
            />
            <Bar dataKey="current" name="Current Period" fill="#3b82f6" radius={[6, 6, 0, 0]}>
              <LabelList dataKey="current" content={(props: any) => <CustomLabel {...props} dataKey="current" />} />
            </Bar>
            <Bar dataKey="previous" name="Previous Period" fill="#bfdbfe" radius={[6, 6, 0, 0]}>
              <LabelList dataKey="previous" content={(props: any) => <CustomLabel {...props} dataKey="previous" />} />
            </Bar>
            <Bar dataKey="lastYear" name="Last Year" fill="#e2e8f0" radius={[6, 6, 0, 0]}>
              <LabelList dataKey="lastYear" content={(props: any) => <CustomLabel {...props} dataKey="lastYear" />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
