import { InvoiceRow } from '@/types';
import { getInvoiceType } from '@/app/Debit/Utils/InvoiceType';
import type { PaymentPdfFilterContext } from './PaymentUtils';

type FilterContext = PaymentPdfFilterContext;

export interface PeriodMetric {
  label: string;
  start: Date;
  end: Date;
  current: number;
  previous: number;
  lastYear: number;
}

export interface PeriodMetrics {
  total: number;
  count: number;
  uniqueCustomers: number;
}

export interface GapBucket {
  count: number;
  totalAmount: number;
}

export interface PaymentExportPayload {
  startDate: Date;
  endDate: Date;
  prevStartDate: Date;
  prevEndDate: Date;
  lyStartDate: Date;
  lyEndDate: Date;
  curMet: PeriodMetrics;
  prevMet: PeriodMetrics;
  lyMet: PeriodMetrics;
  revenueTrend: number;
  countTrend: number;
  custTrend: number;
  revenueTrendLY: number;
  countTrendLY: number;
  custTrendLY: number;
  hasLYData: boolean;
  days: PeriodMetric[];
  weeks: PeriodMetric[];
  months: PeriodMetric[];
  paidCustomerRows: unknown[][];
  nonPayerRows: unknown[][];
  gapBuckets: Record<string, GapBucket>;
  gapBucketsPrev: Record<string, GapBucket>;
  gapBucketsLY: Record<string, GapBucket>;
  cityRows: unknown[][];
}

function getPaymentCity(row: InvoiceRow): string {
  return row.city?.trim() || row.salesRep?.trim() || 'Unknown City';
}

function matchesCustomerExportScope(
  inv: InvoiceRow,
  filters: FilterContext,
  options?: { ignoreCity?: boolean },
): boolean {
  if (filters.selectedCustomers && filters.selectedCustomers.size > 0) {
    if (!filters.selectedCustomers.has(inv.customerName.trim().toLowerCase())) return false;
  } else {
    if (filters.salesRep && filters.salesRep !== 'All Sales Reps' && inv.salesRep?.trim() !== filters.salesRep) {
      return false;
    }
    if (filters.searchQuery && !inv.customerName.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
      return false;
    }
  }

  if (!options?.ignoreCity && filters.cityFilter) {
    if (getPaymentCity(inv).toLowerCase() !== filters.cityFilter.trim().toLowerCase()) return false;
  }

  return true;
}

function matchesPaymentExportFilters(
  inv: InvoiceRow,
  filters: FilterContext,
  options?: { ignoreCity?: boolean },
): boolean {
  const t = getInvoiceType(inv);
  if (t !== 'Payment' && t !== 'R-Payment') return false;
  return matchesCustomerExportScope(inv, filters, options);
}

const parseDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
};

const formatDate = (date: Date | null): string => {
  if (!date) return '';
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const getBHSWeek = (date: Date) => {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - startOfYear.getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const week = Math.floor(diff / oneWeekMs) + 1;
  return { week, year: d.getFullYear() };
};

const getWeekDateRange = (year: number, week: number) => {
  const startOfYear = new Date(year, 0, 1);
  const start = new Date(startOfYear);
  start.setDate(startOfYear.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};

const preprocessAllocations = (rows: InvoiceRow[]) => {
  const allocMap = new Map<InvoiceRow, { date: Date; amount: number; type: string }[]>();
  const groups = new Map<string, InvoiceRow[]>();

  rows.forEach((r) => {
    if (r.matching && r.matching !== 'Unmatched') {
      const k = r.matching.toString().trim().toLowerCase();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
  });

  groups.forEach((group) => {
    const invoices = group.filter((r) => (r.debit || 0) > 0.01);
    const payments = group.filter((r) => (r.credit || 0) > 0.01);
    if (invoices.length === 0 || payments.length === 0) return;

    payments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let holderIdx = -1;
    let maxDeb = -1;
    invoices.forEach((inv, i) => {
      if (inv.debit > maxDeb) {
        maxDeb = inv.debit;
        holderIdx = i;
      }
    });

    const sortedInvoices = invoices.map((inv, i) => ({ inv, isHolder: i === holderIdx, originalIdx: i }));
    sortedInvoices.sort((a, b) => {
      if (a.isHolder && !b.isHolder) return 1;
      if (!a.isHolder && b.isHolder) return -1;
      return new Date(a.inv.date).getTime() - new Date(b.inv.date).getTime();
    });

    const paidSoFar = new Map<number, number>();

    payments.forEach((pay) => {
      let rem = (pay.credit || 0) - (pay.debit || 0);
      const rowAllocations: { date: Date; amount: number; type: string }[] = [];

      for (const item of sortedInvoices) {
        if (rem <= 0.001) break;
        const inv = item.inv;
        const already = paidSoFar.get(item.originalIdx) || 0;
        const capacity = inv.debit - already;

        if (capacity > 0.001 || item.isHolder) {
          let alloc = 0;
          if (item.isHolder) alloc = rem;
          else alloc = Math.min(rem, capacity);

          if (alloc > 0.001) {
            const d = parseDate(inv.date);
            if (d) {
              rowAllocations.push({ date: d, amount: alloc, type: getInvoiceType(inv) });
              paidSoFar.set(item.originalIdx, already + alloc);
              rem -= alloc;
            }
          }
        }
      }

      if (rem > 0.001) {
        const d = parseDate(pay.date);
        if (d) rowAllocations.push({ date: d, amount: rem, type: 'Unmatched' });
      }

      allocMap.set(pay, rowAllocations);
    });
  });

  return allocMap;
};

const emptyGapBuckets = (): Record<string, GapBucket> => ({
  '0-30 Days': { count: 0, totalAmount: 0 },
  '31-60 Days': { count: 0, totalAmount: 0 },
  '61-90 Days': { count: 0, totalAmount: 0 },
  '90+ Days': { count: 0, totalAmount: 0 },
  'No Payment Before': { count: 0, totalAmount: 0 },
});

export function computePaymentExportPayload(
  allData: InvoiceRow[],
  filters: FilterContext,
): PaymentExportPayload {
  const today = new Date();
  const baseData = allData.filter((inv) => matchesPaymentExportFilters(inv, filters));

  let startDate = filters.startDate;
  let endDate = filters.endDate;

  if (!startDate || !endDate) {
    let min = new Date(8640000000000000);
    let max = new Date(0);
    let hasData = false;
    baseData.forEach((p) => {
      const d = parseDate(p.date);
      if (d) {
        if (d < min) min = d;
        if (d > max) max = d;
        hasData = true;
      }
    });

    if (!hasData) {
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    } else {
      if (!startDate) startDate = min;
      if (!endDate) endDate = max;
    }
  }

  startDate!.setHours(0, 0, 0, 0);
  endDate!.setHours(23, 59, 59, 999);

  const allocationMap = preprocessAllocations(allData);

  const getFilteredAmount = (p: InvoiceRow) => {
    const val = (p.credit || 0) - (p.debit || 0);
    if (!filters.sourceFilters || filters.sourceFilters.size === 0) return val;

    const allocs = allocationMap.get(p);
    if (allocs && allocs.length > 0) {
      let total = 0;
      allocs.forEach((frag) => {
        let label = 'Unmatched';
        if (frag.type === 'OB') label = 'OB';
        else if (frag.type !== 'Unmatched') {
          const m = frag.date.toLocaleString('en-US', { month: 'short' });
          const y = frag.date.getFullYear().toString().slice(-2);
          label = `${m}${y}`;
        }
        if (filters.sourceFilters!.has(label)) total += frag.amount;
      });
      return total;
    }

    const matchId = (p.matching || '').toString().toLowerCase();
    let derivedLabel = 'Unmatched';
    if (matchId) {
      if (filters.obMatchingIds?.has(matchId)) derivedLabel = 'OB';
      else if (filters.matchIdToDateMap?.has(matchId)) {
        const dates = filters.matchIdToDateMap.get(matchId)!;
        if (dates.length > 0) {
          const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
          const d = sorted[0];
          derivedLabel = `${d.toLocaleString('en-US', { month: 'short' })}${d.getFullYear().toString().slice(-2)}`;
        }
      }
    }

    return filters.sourceFilters.has(derivedLabel) ? val : 0;
  };

  const sumRange = (start: Date, end: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);

    return baseData.reduce((sum, p) => {
      const d = parseDate(p.date);
      if (d && d >= s && d <= e) return sum + getFilteredAmount(p);
      return sum;
    }, 0);
  };

  const days: PeriodMetric[] = [];
  const dIter = new Date(startDate!.getTime());
  const dEnd = new Date(endDate!.getTime());
  let daySafety = 0;
  while (dIter <= dEnd && daySafety < 5000) {
    const dayStart = new Date(dIter);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dIter);
    dayEnd.setHours(23, 59, 59, 999);
    const prevDayStart = new Date(dayStart);
    prevDayStart.setMonth(prevDayStart.getMonth() - 1);
    const prevDayEnd = new Date(dayEnd);
    prevDayEnd.setMonth(prevDayEnd.getMonth() - 1);
    const lyDayStart = new Date(dayStart);
    lyDayStart.setFullYear(lyDayStart.getFullYear() - 1);
    const lyDayEnd = new Date(dayEnd);
    lyDayEnd.setFullYear(lyDayEnd.getFullYear() - 1);

    days.push({
      label: formatDate(dayStart),
      start: dayStart,
      end: dayEnd,
      current: sumRange(dayStart, dayEnd),
      previous: sumRange(prevDayStart, prevDayEnd),
      lastYear: sumRange(lyDayStart, lyDayEnd),
    });

    dIter.setDate(dIter.getDate() + 1);
    daySafety++;
  }

  const weeks: PeriodMetric[] = [];
  const startWeekInfo = getBHSWeek(startDate!);
  const endWeekInfo = getBHSWeek(endDate!);
  let iterYear = startWeekInfo.year;
  let iterWeek = startWeekInfo.week;
  let safety = 0;
  while (safety < 200) {
    const { start: wStart, end: wEnd } = getWeekDateRange(iterYear, iterWeek);
    if (wStart > endDate!) break;
    if (wEnd >= startDate! && wStart <= endDate!) {
      const prevStart = new Date(wStart);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(wEnd);
      prevEnd.setDate(prevEnd.getDate() - 7);
      const { start: lyStart, end: lyEnd } = getWeekDateRange(iterYear - 1, iterWeek);
      weeks.push({
        label: `Week ${iterWeek} / ${iterYear}`,
        start: wStart,
        end: wEnd,
        current: sumRange(wStart, wEnd),
        previous: sumRange(prevStart, prevEnd),
        lastYear: sumRange(lyStart, lyEnd),
      });
    }
    iterWeek++;
    const nextWStart = getWeekDateRange(iterYear, iterWeek).start;
    if (nextWStart.getFullYear() > iterYear) {
      iterYear++;
      iterWeek = 1;
    }
    safety++;
  }

  const months: PeriodMetric[] = [];
  const mIter = new Date(startDate!.getFullYear(), startDate!.getMonth(), 1);
  const mEndLimit = new Date(endDate!.getFullYear(), endDate!.getMonth() + 1, 0);
  while (mIter < mEndLimit) {
    const monthStart = new Date(mIter.getFullYear(), mIter.getMonth(), 1);
    const monthEnd = new Date(mIter.getFullYear(), mIter.getMonth() + 1, 0);
    if (monthEnd >= startDate! && monthStart <= endDate!) {
      const prevMonthStart = new Date(monthStart);
      prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
      const prevMonthEnd = new Date(monthStart);
      prevMonthEnd.setDate(0);
      const lyMonthStart = new Date(monthStart.getFullYear() - 1, monthStart.getMonth(), 1);
      const lyMonthEnd = new Date(monthStart.getFullYear() - 1, monthStart.getMonth() + 1, 0);
      months.push({
        label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        start: monthStart,
        end: monthEnd,
        current: sumRange(monthStart, monthEnd),
        previous: sumRange(prevMonthStart, prevMonthEnd),
        lastYear: sumRange(lyMonthStart, lyMonthEnd),
      });
    }
    mIter.setMonth(mIter.getMonth() + 1);
  }

  if (filters.searchQuery?.trim()) {
    const hasValue = (m: PeriodMetric) => m.current !== 0;
    for (let i = days.length - 1; i >= 0; i--) if (!hasValue(days[i])) days.splice(i, 1);
    for (let i = weeks.length - 1; i >= 0; i--) if (!hasValue(weeks[i])) weeks.splice(i, 1);
    for (let i = months.length - 1; i >= 0; i--) if (!hasValue(months[i])) months.splice(i, 1);
  }

  const durationMs = endDate!.getTime() - startDate!.getTime();
  const prevEndDate = new Date(startDate!.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);
  const lyStartDate = new Date(startDate!);
  lyStartDate.setFullYear(lyStartDate.getFullYear() - 1);
  const lyEndDate = new Date(endDate!);
  lyEndDate.setFullYear(lyEndDate.getFullYear() - 1);

  const getMetrics = (s: Date, e: Date): PeriodMetrics => {
    let total = 0;
    let count = 0;
    const customers = new Set<string>();
    const sTime = new Date(s).setHours(0, 0, 0, 0);
    const eTime = new Date(e).setHours(23, 59, 59, 999);

    baseData.forEach((p) => {
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

  const curMet = getMetrics(startDate!, endDate!);
  const prevMet = getMetrics(prevStartDate, prevEndDate);
  const lyMet = getMetrics(lyStartDate, lyEndDate);

  const revenueTrend = prevMet.total > 0 ? ((curMet.total - prevMet.total) / prevMet.total) * 100 : 0;
  const countTrend = prevMet.count > 0 ? ((curMet.count - prevMet.count) / prevMet.count) * 100 : 0;
  const custTrend = prevMet.uniqueCustomers > 0 ? ((curMet.uniqueCustomers - prevMet.uniqueCustomers) / prevMet.uniqueCustomers) * 100 : 0;
  const revenueTrendLY = lyMet.total > 0 ? ((curMet.total - lyMet.total) / lyMet.total) * 100 : 0;
  const countTrendLY = lyMet.count > 0 ? ((curMet.count - lyMet.count) / lyMet.count) * 100 : 0;
  const custTrendLY = lyMet.uniqueCustomers > 0 ? ((curMet.uniqueCustomers - lyMet.uniqueCustomers) / lyMet.uniqueCustomers) * 100 : 0;
  const hasLYData = lyMet.total > 0 || lyMet.count > 0;

  const historyMap = new Map<string, number[]>();
  baseData.forEach((p) => {
    const d = parseDate(p.date);
    if (d) {
      const list = historyMap.get(p.customerName) || [];
      list.push(d.getTime());
      historyMap.set(p.customerName, list);
    }
  });
  historyMap.forEach((list) => list.sort((a, b) => b - a));

  const fillGapBuckets = (
    buckets: Record<string, GapBucket>,
    rangeStart: Date,
    rangeEnd: Date,
  ) => {
    const customerTotals = new Map<string, number>();
    baseData.forEach((p) => {
      const d = parseDate(p.date);
      if (d && d >= rangeStart && d <= rangeEnd) {
        customerTotals.set(p.customerName, (customerTotals.get(p.customerName) || 0) + ((p.credit || 0) - (p.debit || 0)));
      }
    });

    customerTotals.forEach((totalAmt, name) => {
      const allHistory = historyMap.get(name);
      if (!allHistory) return;
      const paymentsInRange = allHistory
        .filter((t) => t >= rangeStart.getTime() && t <= rangeEnd.getTime())
        .sort((a, b) => a - b);
      if (paymentsInRange.length === 0) return;
      const latest = paymentsInRange[paymentsInRange.length - 1];
      const prevPayment = allHistory.find((t) => t < latest);
      let bucketKey = 'No Payment Before';
      if (prevPayment) {
        const diffDays = Math.floor((latest - prevPayment) / 86400000);
        if (diffDays <= 30) bucketKey = '0-30 Days';
        else if (diffDays <= 60) bucketKey = '31-60 Days';
        else if (diffDays <= 90) bucketKey = '61-90 Days';
        else bucketKey = '90+ Days';
      }
      buckets[bucketKey].count++;
      buckets[bucketKey].totalAmount += totalAmt;
    });
  };

  const customerMap = new Map<string, { total: number; count: number; dates: number[]; cityName: string }>();
  baseData.forEach((p) => {
    const d = parseDate(p.date);
    if (!d || d < startDate! || d > endDate!) return;

    const allocs = allocationMap.get(p);
    let totalForThisPayment = 0;
    if (allocs && allocs.length > 0) {
      allocs.forEach((frag) => {
        let label = 'Unmatched';
        if (frag.type === 'OB') label = 'OB';
        else if (frag.type !== 'Unmatched') {
          label = `${frag.date.toLocaleString('en-US', { month: 'short' })}${frag.date.getFullYear().toString().slice(-2)}`;
        }
        if (filters.sourceFilters && filters.sourceFilters.size > 0 && !filters.sourceFilters.has(label)) return;
        totalForThisPayment += frag.amount;
      });
    } else {
      const val = (p.credit || 0) - (p.debit || 0);
      if (val !== 0 && (!filters.sourceFilters || filters.sourceFilters.size === 0 || filters.sourceFilters.has('Unmatched'))) {
        totalForThisPayment = val;
      }
    }

    if (Math.abs(totalForThisPayment) <= 0.001) return;
    const curr = customerMap.get(p.customerName) || {
      total: 0,
      count: 0,
      dates: [],
      cityName: getPaymentCity(p),
    };
    curr.total += totalForThisPayment;
    curr.count += 1;
    curr.dates.push(d.getTime());
    customerMap.set(p.customerName, curr);
  });

  const gapBuckets = emptyGapBuckets();
  const gapBucketsPrev = emptyGapBuckets();
  const gapBucketsLY = emptyGapBuckets();

  if (filters.sections?.summaryPrevious !== false) {
    fillGapBuckets(gapBucketsPrev, prevStartDate, prevEndDate);
  }
  if (filters.sections?.summaryLastYear !== false && hasLYData) {
    fillGapBuckets(gapBucketsLY, lyStartDate, lyEndDate);
  }

  const cityTotals = new Map<string, number>();
  customerMap.forEach((stats) => {
    cityTotals.set(stats.cityName, (cityTotals.get(stats.cityName) || 0) + stats.total);
  });

  const paidCustomerRows = Array.from(customerMap.entries())
    .filter(([, stats]) => stats.total > 0.01)
    .sort((a, b) => {
      const cityTotalA = cityTotals.get(a[1].cityName) || 0;
      const cityTotalB = cityTotals.get(b[1].cityName) || 0;
      if (cityTotalB !== cityTotalA) return cityTotalB - cityTotalA;
      return b[1].total - a[1].total;
    })
    .map(([name, stats], index) => {
      const sortedPeriodDates = stats.dates.sort((a, b) => a - b);
      const earliestInPeriodMs = sortedPeriodDates[0];
      const latestInPeriodMs = sortedPeriodDates[sortedPeriodDates.length - 1];
      let gapStr = 'No Payment Before';
      const allHistory = historyMap.get(name);
      if (allHistory) {
        let prevMs: number | undefined;
        let anchorMs: number;
        if (filters.startDate) {
          anchorMs = earliestInPeriodMs;
          prevMs = allHistory.find((t) => t < filters.startDate!.getTime());
        } else {
          anchorMs = latestInPeriodMs;
          prevMs = allHistory.find((t) => t < anchorMs);
        }
        if (prevMs) {
          gapStr = `${Math.floor((anchorMs - prevMs) / 86400000)} Days`;
          let bucketKey = '90+ Days';
          const diffDays = Math.floor((anchorMs - prevMs) / 86400000);
          if (diffDays <= 30) bucketKey = '0-30 Days';
          else if (diffDays <= 60) bucketKey = '31-60 Days';
          else if (diffDays <= 90) bucketKey = '61-90 Days';
          gapBuckets[bucketKey].count++;
          gapBuckets[bucketKey].totalAmount += stats.total;
        } else {
          gapBuckets['No Payment Before'].count++;
          gapBuckets['No Payment Before'].totalAmount += stats.total;
        }
      }

      const uniqueDates = Array.from(new Set(sortedPeriodDates.map((ms) => formatDate(new Date(ms)))));
      return [
        index + 1,
        name,
        stats.cityName,
        stats.total,
        stats.count,
        uniqueDates.join(', '),
        gapStr,
      ];
    });

  const paidCustomerKeys = new Set(Array.from(customerMap.keys()).map((name) => name.trim().toLowerCase()));
  const scopedCustomerRows = new Map<string, InvoiceRow[]>();
  allData.forEach((row) => {
    if (!matchesCustomerExportScope(row, filters)) return;
    const key = row.customerName.trim();
    const list = scopedCustomerRows.get(key) || [];
    list.push(row);
    scopedCustomerRows.set(key, list);
  });

  const referenceDate = new Date(today);
  referenceDate.setHours(0, 0, 0, 0);
  const filterStartMs = startDate!.getTime();

  const nonPayerRows = Array.from(scopedCustomerRows.entries())
    .filter(([name]) => !paidCustomerKeys.has(name.trim().toLowerCase()))
    .map(([name, rows]) => {
      const balanceDue = rows.reduce((sum, row) => sum + (row.debit || 0) - (row.credit || 0), 0);
      const cityName = getPaymentCity(rows.find((row) => getPaymentCity(row) !== 'Unknown City') || rows[0]);
      const paymentsByDay = new Map<number, number>();
      rows.forEach((row) => {
        const t = getInvoiceType(row);
        if (t !== 'Payment' && t !== 'R-Payment') return;
        const d = parseDate(row.date);
        if (!d || d.getTime() >= filterStartMs) return;
        const net = (row.credit || 0) - (row.debit || 0);
        if (net <= 0.01) return;
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        const dayMs = day.getTime();
        paymentsByDay.set(dayMs, (paymentsByDay.get(dayMs) || 0) + net);
      });

      let lastPaymentMs: number | null = null;
      let lastPaymentAmount = 0;
      paymentsByDay.forEach((amount, dayMs) => {
        if (lastPaymentMs === null || dayMs > lastPaymentMs) {
          lastPaymentMs = dayMs;
          lastPaymentAmount = amount;
        }
      });

      return {
        name,
        cityName,
        balanceDue,
        lastPaymentStr: lastPaymentMs === null ? 'Never' : formatDate(new Date(lastPaymentMs)),
        lastPaymentAmount,
        daysSinceStr:
          lastPaymentMs === null
            ? '—'
            : `${Math.floor((referenceDate.getTime() - lastPaymentMs) / 86400000)} Days`,
      };
    })
    .filter((row) => row.balanceDue > 0.01)
    .sort((a, b) => (b.balanceDue !== a.balanceDue ? b.balanceDue - a.balanceDue : 0))
    .map((row, index) => [
      index + 1,
      row.name,
      row.cityName,
      row.balanceDue,
      row.lastPaymentStr,
      row.lastPaymentAmount,
      row.daysSinceStr,
    ]);

  const repMap = new Map<string, { total: number; count: number; customers: Set<string> }>();
  baseData.forEach((p) => {
    const d = parseDate(p.date);
    if (!d || d < startDate! || d > endDate!) return;
    const rep = getPaymentCity(p);
    const val = (p.credit || 0) - (p.debit || 0);
    if (!repMap.has(rep)) repMap.set(rep, { total: 0, count: 0, customers: new Set() });
    const stat = repMap.get(rep)!;
    stat.total += val;
    stat.count++;
    stat.customers.add(p.customerName);
  });

  const repData = Array.from(repMap.entries())
    .map(([name, s]) => ({
      name,
      total: s.total,
      count: s.count,
      uniqueCust: s.customers.size,
    }))
    .filter((d) => d.total > 0.1)
    .sort((a, b) => b.total - a.total);

  const grandTotalRep = repData.reduce((acc, curr) => acc + curr.total, 0);
  const cityRows = repData.map((r, i) => {
    const share = grandTotalRep > 0 ? (r.total / grandTotalRep) * 100 : 0;
    return [i + 1, r.name, r.total, r.count, r.uniqueCust, share];
  });

  if (cityRows.length > 0) {
    cityRows.push([
      '',
      'Total',
      grandTotalRep,
      repData.reduce((acc, curr) => acc + curr.count, 0),
      repData.reduce((acc, curr) => acc + curr.uniqueCust, 0),
      100,
    ]);
  }

  return {
    startDate: startDate!,
    endDate: endDate!,
    prevStartDate,
    prevEndDate,
    lyStartDate,
    lyEndDate,
    curMet,
    prevMet,
    lyMet,
    revenueTrend,
    countTrend,
    custTrend,
    revenueTrendLY,
    countTrendLY,
    custTrendLY,
    hasLYData,
    days,
    weeks,
    months,
    paidCustomerRows,
    nonPayerRows,
    gapBuckets,
    gapBucketsPrev,
    gapBucketsLY,
    cityRows,
  };
}
