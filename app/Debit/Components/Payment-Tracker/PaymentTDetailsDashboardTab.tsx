import React, { useMemo } from 'react';
import NoData from '@/app/Components/NoDataTab';
import { InvoiceRow } from '@/types';
import { getInvoiceType } from '@/lib/InvoiceType';
import { parseDate } from './PaymentTUtilsTab';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';

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
      title: 'Current',
      range: `${formatDate(startDate as Date)} – ${formatDate(endDate as Date)} (${curDays} Days)`,
      amount: curMet.total,
    },
    {
      title: 'Previous',
      range: `${prevStartDate ? formatDate(prevStartDate) : ''} – ${prevEndDate ? formatDate(prevEndDate) : ''} (${prevDays} Days)`,
      amount: prevMet.total,
    },
    {
      title: 'Last Year',
      range: `${lyStartDate ? formatDate(lyStartDate) : ''} – ${lyEndDate ? formatDate(lyEndDate) : ''} (${lyDays} Days)`,
      amount: lyMet.total,
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
      title: 'Collections Growth',
      prevPct: revenueTrend,
      lyPct: revenueLyTrend,
      prevDiff: curMet.total - prevMet.total,
      lyDiff: curMet.total - lyMet.total,
      isCurrency: true,
    },
    {
      title: 'Customer Growth',
      prevPct: custTrend,
      lyPct: custLyTrend,
      prevDiff: curMet.uniqueCustomers - prevMet.uniqueCustomers,
      lyDiff: curMet.uniqueCustomers - lyMet.uniqueCustomers,
      isCurrency: false,
    },
    {
      title: 'Transaction Growth',
      prevPct: countTrend,
      lyPct: countLyTrend,
      prevDiff: curMet.count - prevMet.count,
      lyDiff: curMet.count - lyMet.count,
      isCurrency: false,
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {periods.map((p, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{p.title}</h3>
            <p className="text-xs text-gray-400 mt-1">{p.range}</p>
            <p className="text-2xl font-bold text-gray-900 mt-3">
              {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {growthCards.map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{card.title}</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className={`text-xl font-bold ${card.prevPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {card.prevPct >= 0 ? '+' : ''}{card.prevPct.toFixed(0)}%
                  <span className="text-sm font-medium text-gray-500 ml-1">
                    ({card.prevDiff >= 0 ? '+' : '-'}{formatDiff(card.prevDiff, card.isCurrency)})
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">vs previous</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="flex-1">
                <div className={`text-xl font-bold ${card.lyPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {card.lyPct >= 0 ? '+' : ''}{card.lyPct.toFixed(0)}%
                  <span className="text-sm font-medium text-gray-500 ml-1">
                    ({card.lyDiff >= 0 ? '+' : '-'}{formatDiff(card.lyDiff, card.isCurrency)})
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">vs last year</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 h-[460px]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Period Comparison</h3>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-700" />
              Current Period
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-400" />
              Previous Period
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-300" />
              Last Year
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barGap={8} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
            <YAxis hide domain={[0, 115]} />
            <Bar dataKey="current" name="Current Period" fill="#374151" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="current" content={(props: any) => <CustomLabel {...props} dataKey="current" />} />
            </Bar>
            <Bar dataKey="previous" name="Previous Period" fill="#9CA3AF" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="previous" content={(props: any) => <CustomLabel {...props} dataKey="previous" />} />
            </Bar>
            <Bar dataKey="lastYear" name="Last Year" fill="#D1D5DB" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="lastYear" content={(props: any) => <CustomLabel {...props} dataKey="lastYear" />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
