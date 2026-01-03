'use client';

import { useMemo, useState } from 'react';
import { InvoiceRow } from '@/types';
import { getInvoiceType } from '@/lib/invoiceType';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface PaymentTrackerTabProps {
  data: InvoiceRow[];
}

interface PaymentEntry {
  date: string;
  number: string;
  customerName: string;
  type: string;
  credit: number;
  rawCredit: number;
  debit: number;
  rawDebit: number;
  amountSource: 'credit' | 'debit' | 'netDebt' | 'creditMinusDebit';
  salesRep: string;
  matching?: string;
  parsedDate: Date | null;
  matchedOpeningBalance: boolean;
}

interface PaymentByCustomer {
  customerName: string;
  totalPayments: number;
  paymentCount: number;
  payments: PaymentEntry[];
  lastPayment: PaymentEntry | null;
  daysSinceLastPayment: number | null;
}

interface PaymentByPeriod {
  period: string;
  periodKey: string;
  totalPayments: number;
  paymentCount: number;
  payments: PaymentEntry[];
}

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const candidate = new Date(y, m, d);
    if (!isNaN(candidate.getTime())) return candidate;
  }

  return null;
};

const formatDate = (date: Date | null): string => {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateInput = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDailyKey = (date: Date): string => {
  return formatDate(date);
};

const getWeeklyKey = (date: Date): string => {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(days / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
};

const getMonthlyKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getYearlyKey = (date: Date): string => {
  return String(date.getFullYear());
};

const formatPeriodLabel = (key: string, periodType: 'daily' | 'weekly' | 'monthly' | 'yearly'): string => {
  if (periodType === 'daily') {
    return key; // Already formatted as DD/MM/YYYY
  } else if (periodType === 'weekly') {
    const [year, week] = key.split('-W');
    return `Week ${week}, ${year}`;
  } else if (periodType === 'monthly') {
    const [year, month] = key.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    return `${monthNames[monthIndex] || month} ${year}`;
  } else {
    return key;
  }
};

export default function PaymentTrackerTab({ data }: PaymentTrackerTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'customer' | 'period' | 'area'>('dashboard');
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [chartPeriodType, setChartPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [chartYear, setChartYear] = useState<string>('');
  const [chartMonth, setChartMonth] = useState<string>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showOBClosedPayments, setShowOBClosedPayments] = useState(true);
  const [showOtherPayments, setShowOtherPayments] = useState(true);
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<'customerName' | 'totalPayments' | 'paymentCount' | 'lastPayment' | 'daysSince'>('totalPayments');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Get unique sales reps from data
  const salesReps = useMemo(() => {
    const reps = new Set<string>();
    data.forEach((row) => {
      if (row.salesRep && row.salesRep.trim()) {
        reps.add(row.salesRep.trim());
      }
    });
    return Array.from(reps).sort();
  }, [data]);

  // Pre-calc matching IDs that are tied to OB (opening balance) invoices
  const obMatchingIds = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      const num = (row.number || '').toUpperCase();
      const matchId = (row.matching || '').toString().toLowerCase();
      if (num.startsWith('OB') && matchId) {
        set.add(matchId);
      }
    });
    return set;
  }, [data]);

  // Pre-calc matching IDs that are tied to current year invoices (SAL)
  const currentYearMatchingIds = useMemo(() => {
    const set = new Set<string>();
    const currentYear = new Date().getFullYear();
    data.forEach((row) => {
      const num = (row.number || '').toUpperCase();
      const matchId = (row.matching || '').toString().toLowerCase();
      const d = parseDate(row.date);
      if (num.startsWith('SAL') && matchId && d && d.getFullYear() === currentYear) {
        set.add(matchId);
      }
    });
    return set;
  }, [data]);

  // Dashboard Data Calculation
  const dashboardData = useMemo(() => {
    // Apply date filters if set, otherwise use last 12 months
    let startDate: Date;
    let endDate: Date;

    // Check if year and month are specified for chart filtering
    const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
    const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;

    if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
      // Use specified year or month
      const y = yearNum && !isNaN(yearNum) ? yearNum : new Date().getFullYear();

      if (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        // Specific Month
        startDate = new Date(y, monthNum - 1, 1);
        endDate = new Date(y, monthNum, 0);
      } else {
        // Whole Year
        startDate = new Date(y, 0, 1);
        endDate = new Date(y, 11, 31);
      }
      // Ensure end of day
      endDate.setHours(23, 59, 59, 999);
    } else if (dateFrom || dateTo) {
      if (dateFrom) {
        const fromDate = parseDate(dateFrom);
        startDate = fromDate || new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
      } else {
        // If only dateTo is set, go back 12 months from dateTo
        const toDate = parseDate(dateTo);
        if (toDate) {
          endDate = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
          startDate = new Date(toDate.getFullYear(), toDate.getMonth() - 11, 1);
        } else {
          const today = new Date();
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        }
      }

      if (dateTo) {
        const toDate = parseDate(dateTo);
        if (toDate) {
          endDate = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
        } else {
          const today = new Date();
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
      } else {
        // If only dateFrom is set, use last 12 months from dateFrom
        const today = new Date();
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      }
    } else {
      // Default: ALL TIME (min date to max date from data)
      const today = new Date();
      let maxDate = new Date(0);
      let minDate = new Date(8640000000000000); // Max possible date

      // Find range in data
      let hasData = false;
      data.forEach(row => {
        const d = parseDate(row.date);
        if (d) {
          if (d > maxDate) maxDate = d;
          if (d < minDate) minDate = d;
          hasData = true;
        }
      });

      if (!hasData) {
        // Fallback if no data
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      } else {
        endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
        startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      }
    }

    // Adjust date range based on period type
    if (chartPeriodType === 'daily') {
      // لو محدد سنة وشهر، نستخدم نفس الشهر كما هو (يومي داخل نفس الشهر)
      if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
        startDate = new Date(startDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(endDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // لو مفيش سنة/شهر، نرجع للمنطق القديم (آخر 90 يوم أو المدى من الفلاتر)
        if (!dateFrom && !dateTo) {
          const today = new Date();
          endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 89);
          startDate.setHours(0, 0, 0, 0);
        } else {
          // Use the filtered date range, but ensure endDate includes the full day
          endDate = new Date(endDate);
          endDate.setHours(23, 59, 59, 999);
          startDate = new Date(startDate);
          startDate.setHours(0, 0, 0, 0);
        }
      }
    } else if (chartPeriodType === 'weekly') {
      // لو محدد سنة وشهر، نستخدم نفس الشهر كنطاق أسابيع (لا نرجع لـ 52 أسبوع تلقائيًا)
      if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
        startDate = new Date(startDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(endDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // بدون سنة/شهر -> منطق 52 أسبوع أو المدى من الفلاتر
        if (!dateFrom && !dateTo) {
          const today = new Date();
          endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - (52 * 7 - 1));
          startDate.setHours(0, 0, 0, 0);
        } else {
          endDate = new Date(endDate);
          endDate.setHours(23, 59, 59, 999);
          startDate = new Date(startDate);
          startDate.setHours(0, 0, 0, 0);
        }
      }
    } else {
      // Monthly view
      // If dateFrom is provided, respect it. Otherwise snap to 1st.
      if (!dateFrom) {
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      }
      // If dateTo is provided, respect it. Otherwise snap to end of month.
      if (dateTo) {
        endDate = new Date(endDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        endDate = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const periodStats = new Map<string, {
      periodLabel: string;
      periodKey: string;
      grossSales: number;
      returns: number;
      discounts: number;
      collections: number;
    }>();

    // Initialize periods based on chartPeriodType
    if (chartPeriodType === 'daily') {
      let iterDate = new Date(startDate);
      // Check if we're showing a single month (for shorter date format)
      const isSingleMonth = (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12);
      while (iterDate <= endDate) {
        const key = getDailyKey(iterDate);
        // Use shorter format (DD/MM) if showing single month, otherwise full format (DD/MM/YYYY)
        let label: string;
        if (isSingleMonth) {
          const day = String(iterDate.getDate()).padStart(2, '0');
          const month = String(iterDate.getMonth() + 1).padStart(2, '0');
          label = `${day}/${month}`;
        } else {
          label = formatPeriodLabel(key, 'daily');
        }

        periodStats.set(key, {
          periodLabel: label,
          periodKey: key,
          grossSales: 0,
          returns: 0,
          discounts: 0,
          collections: 0
        });

        iterDate = new Date(iterDate);
        iterDate.setDate(iterDate.getDate() + 1);
      }
    } else if (chartPeriodType === 'weekly') {
      // Collect all unique week keys in the date range
      const weekKeys = new Set<string>();
      let iterDate = new Date(startDate);
      while (iterDate <= endDate) {
        const key = getWeeklyKey(iterDate);
        weekKeys.add(key);
        iterDate = new Date(iterDate);
        iterDate.setDate(iterDate.getDate() + 1);
      }

      // Initialize all unique weeks
      Array.from(weekKeys).sort().forEach(key => {
        const label = formatPeriodLabel(key, 'weekly');
        periodStats.set(key, {
          periodLabel: label,
          periodKey: key,
          grossSales: 0,
          returns: 0,
          discounts: 0,
          collections: 0
        });
      });
    } else {
      // Monthly
      let iterDate = new Date(startDate);
      let safeguard = 0;
      while (iterDate <= endDate && safeguard < 24) {
        safeguard++;
        const key = getMonthlyKey(iterDate);
        const label = formatPeriodLabel(key, 'monthly');

        periodStats.set(key, {
          periodLabel: label,
          periodKey: key,
          grossSales: 0,
          returns: 0,
          discounts: 0,
          collections: 0
        });

        iterDate = new Date(iterDate);
        iterDate.setMonth(iterDate.getMonth() + 1);
      }
    }

    // Apply search filter if set
    const searchLower = search.toLowerCase().trim();
    let filteredData = searchLower
      ? data.filter((row) =>
        row.customerName?.toLowerCase().includes(searchLower) ||
        row.number?.toLowerCase().includes(searchLower)
      )
      : data;

    // Apply sales rep filter if set
    if (selectedSalesRep) {
      filteredData = filteredData.filter((row) =>
        row.salesRep?.trim() === selectedSalesRep
      );
    }

    // Apply OB / Other Payment filters
    // Note: This mainly affects Payment rows. Sales/Returns/Discounts are generally kept unless we want to filter them too?
    // User request: "let the two checkboxes OB Closed Payments and Other/Open Payments affect the dashboard tab"
    // Usually dashboard shows Collections. So we should filter Payments specifically.
    // If a row is NOT a payment, we keep it (Sales/Returns)? Or do we only care about Payments for the Collections chart?
    // The chart shows Collections, Sales, etc. If we filter Payments, Collections will change.
    filteredData = filteredData.filter(row => {
      if (getInvoiceType(row) !== 'Payment') return true; // Keep non-payments (Sales, etc.)

      const matchId = (row.matching || '').toString().toLowerCase();
      const isOBPayment = matchId && obMatchingIds.has(matchId);

      if (isOBPayment) {
        return showOBClosedPayments;
      } else {
        return showOtherPayments;
      }
    });

    // Count payments with positive net (credit - debit > 0)
    let netPaymentCount = 0;

    // Process data
    filteredData.forEach(row => {
      const d = parseDate(row.date);
      if (!d) return;
      if (d < startDate || d > endDate) return;

      let key: string;
      if (chartPeriodType === 'daily') {
        key = getDailyKey(d);
      } else if (chartPeriodType === 'weekly') {
        key = getWeeklyKey(d);
      } else {
        key = getMonthlyKey(d);
      }

      if (!periodStats.has(key)) return;

      const stats = periodStats.get(key)!;
      const type = getInvoiceType(row);
      const debit = row.debit || 0;
      const credit = row.credit || 0;

      if (type === 'Sale') {
        stats.grossSales += debit;
      } else if (type === 'Return') {
        stats.returns += credit;
        if (debit < 0) stats.returns += Math.abs(debit);
      } else if (type === 'Discount') {
        stats.discounts += credit;
        if (debit < 0) stats.discounts += Math.abs(debit);
      } else if (type === 'Payment') {
        stats.collections += (credit - debit);
        // Count payments with positive net (credit - debit > 0)
        if ((credit - debit) > 0) {
          netPaymentCount++;
        }
      }
    });

    const result = Array.from(periodStats.values())
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
      .map(item => {
        const netSales = item.grossSales - item.returns;
        const netSalesMinusDiscounts = netSales - item.discounts;
        return {
          ...item,
          netSales,
          netSalesMinusDiscounts,
          displaySales: Math.round(netSalesMinusDiscounts * 100) / 100,
          displayCollections: Math.round(item.collections * 100) / 100,
        };
      });

    const totalNetSalesMinusDiscounts = result.reduce((sum, item) => sum + item.netSalesMinusDiscounts, 0);
    const totalCollections = result.reduce((sum, item) => sum + item.collections, 0);
    const difference = totalNetSalesMinusDiscounts - totalCollections;

    return {
      chartData: result,
      totals: {
        totalNetSalesMinusDiscounts,
        totalCollections,
        difference,
        netPaymentCount
      }
    };
  }, [data, dateFrom, dateTo, search, selectedSalesRep, chartPeriodType, chartYear, chartMonth, showOBClosedPayments, showOtherPayments, obMatchingIds]);



  // Calculate payment closure statistics based on net payment amounts (Credit - Debit)
  const paymentClosureStats = useMemo(() => {
    // Apply filters
    const searchLower = search.toLowerCase().trim();
    let filteredPayments = data.filter((row) => {
      if (getInvoiceType(row) !== 'Payment') return false;

      // Apply sales rep filter
      if (selectedSalesRep && row.salesRep?.trim() !== selectedSalesRep) return false;

      // Apply date filters using same logic as dashboardData (year/month > date range > default)
      const d = parseDate(row.date);
      if (!d) return false;

      const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
      const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;
      let startDate: Date;
      let endDate: Date;

      if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
        const y = yearNum && !isNaN(yearNum) ? yearNum : new Date().getFullYear();
        if (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          startDate = new Date(y, monthNum - 1, 1);
          endDate = new Date(y, monthNum, 0);
        } else {
          startDate = new Date(y, 0, 1);
          endDate = new Date(y, 11, 31);
        }
        endDate.setHours(23, 59, 59, 999);
      } else if (dateFrom || dateTo) {
        const fromDate = dateFrom ? parseDate(dateFrom) : null;
        const toDate = dateTo ? parseDate(dateTo) : null;

        if (fromDate && toDate) {
          startDate = fromDate;
          endDate = new Date(toDate);
          endDate.setHours(23, 59, 59, 999);
        } else if (fromDate) {
          const today = new Date();
          startDate = fromDate;
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
        } else if (toDate) {
          endDate = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
          startDate = new Date(toDate.getFullYear(), toDate.getMonth() - 11, 1);
        } else {
          const today = new Date();
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        }
      } else {
        const today = new Date();
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      }

      if (d < startDate || d > endDate) return false;

      // Apply search filter
      if (searchLower) {
        if (!row.customerName?.toLowerCase().includes(searchLower) &&
          !row.number?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });

    let obOnlyAmount = 0;
    let currentYearOnlyAmount = 0;
    let mixedAmount = 0;
    let unmatchedAmount = 0;
    let obOnlyCount = 0;
    let currentYearOnlyCount = 0;
    let mixedCount = 0;
    let unmatchedCount = 0;

    filteredPayments.forEach((row) => {
      const netAmount = (row.credit || 0) - (row.debit || 0);
      const matchId = (row.matching || '').toString().toLowerCase();

      // Unmatched = only payments with NO matching ID at all (empty MATCHING column)
      if (!matchId || matchId.trim() === '') {
        unmatchedAmount += netAmount;
        unmatchedCount++;
        return;
      }

      // Payments with matching ID are categorized based on what they're matched to
      const isOB = obMatchingIds.has(matchId);
      const isCurrentYear = currentYearMatchingIds.has(matchId);

      if (isOB && isCurrentYear) {
        mixedAmount += netAmount;
        mixedCount++;
      } else if (isOB) {
        obOnlyAmount += netAmount;
        obOnlyCount++;
      } else if (isCurrentYear) {
        currentYearOnlyAmount += netAmount;
        currentYearOnlyCount++;
      }
      // Note: Payments with matching ID but not matched to OB or Current Year SAL
      // are excluded from all categories (they have a matching but it's to other invoice types)
    });

    const totalAmount = obOnlyAmount + currentYearOnlyAmount + mixedAmount + unmatchedAmount;
    const totalCount = filteredPayments.length;

    return {
      totalAmount,
      totalCount,
      obOnlyAmount,
      currentYearOnlyAmount,
      mixedAmount,
      unmatchedAmount,
      obOnlyCount,
      currentYearOnlyCount,
      mixedCount,
      unmatchedCount,
      obOnlyPercent: totalAmount !== 0 ? (obOnlyAmount / totalAmount) * 100 : 0,
      currentYearOnlyPercent: totalAmount !== 0 ? (currentYearOnlyAmount / totalAmount) * 100 : 0,
      mixedPercent: totalAmount !== 0 ? (mixedAmount / totalAmount) * 100 : 0,
      unmatchedPercent: totalAmount !== 0 ? (unmatchedAmount / totalAmount) * 100 : 0,
    };
  }, [data, obMatchingIds, currentYearMatchingIds, dateFrom, dateTo, selectedSalesRep, search, chartYear, chartMonth]);

  // Calculate average monthly and weekly collections - now respect same date range/year-month as dashboard
  const averageCollections = useMemo(() => {
    // Apply filters (sales rep + search first)
    const searchLower = search.toLowerCase().trim();
    const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
    const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;

    // Determine date range similar to dashboardData
    let startDate: Date;
    let endDate: Date;

    if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
      const y = yearNum && !isNaN(yearNum) ? yearNum : new Date().getFullYear();
      if (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        startDate = new Date(y, monthNum - 1, 1);
        endDate = new Date(y, monthNum, 0);
      } else {
        startDate = new Date(y, 0, 1);
        endDate = new Date(y, 11, 31);
      }
      endDate.setHours(23, 59, 59, 999);
    } else if (dateFrom || dateTo) {
      const fromDate = dateFrom ? parseDate(dateFrom) : null;
      const toDate = dateTo ? parseDate(dateTo) : null;

      if (fromDate && toDate) {
        startDate = fromDate;
        endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (fromDate) {
        const today = new Date();
        startDate = fromDate;
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (toDate) {
        endDate = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
        startDate = new Date(toDate.getFullYear(), toDate.getMonth() - 11, 1);
      } else {
        const today = new Date();
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      }
    } else {
      // Default: last 12 months from latest payment date
      let maxDate = new Date(0);
      data.forEach(row => {
        if (getInvoiceType(row) !== 'Payment') return;
        const d = parseDate(row.date);
        if (d && d > maxDate) maxDate = d;
      });
      if (maxDate.getTime() === 0) maxDate = new Date();
      endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
      startDate = new Date(maxDate.getFullYear(), maxDate.getMonth() - 11, 1);
    }

    // Apply filters within date range
    let filteredPayments = data.filter((row) => {
      if (getInvoiceType(row) !== 'Payment') return false;

      // Apply sales rep filter
      if (selectedSalesRep && row.salesRep?.trim() !== selectedSalesRep) return false;

      const d = parseDate(row.date);
      if (!d) return false;
      if (d < startDate || d > endDate) return false;

      // Apply search filter
      if (searchLower) {
        if (!row.customerName?.toLowerCase().includes(searchLower) &&
          !row.number?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });

    // Group by month
    const monthlyTotals = new Map<string, number>();
    filteredPayments.forEach((row) => {
      const d = parseDate(row.date);
      if (d) {
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const amount = (row.credit || 0) - (row.debit || 0);
        monthlyTotals.set(yearMonth, (monthlyTotals.get(yearMonth) || 0) + amount);
      }
    });

    // Group by week
    const weeklyTotals = new Map<string, number>();
    filteredPayments.forEach((row) => {
      const d = parseDate(row.date);
      if (d) {
        const year = d.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const days = Math.floor((d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
        const week = Math.floor(days / 7);
        const weekKey = `${year}-W${String(week).padStart(2, '0')}`;
        const amount = (row.credit || 0) - (row.debit || 0);
        weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + amount);
      }
    });

    const totalMonthly = Array.from(monthlyTotals.values()).reduce((sum, val) => sum + val, 0);
    const totalWeekly = Array.from(weeklyTotals.values()).reduce((sum, val) => sum + val, 0);

    // Use actual counts in range (at least 1 to avoid divide by zero)
    const monthsSet = new Set(monthlyTotals.keys());
    const weeksSet = new Set(weeklyTotals.keys());
    const totalMonthsInPeriod = Math.max(1, monthsSet.size);
    const totalWeeksInPeriod = Math.max(1, weeksSet.size);

    return {
      averageMonthly: totalMonthsInPeriod > 0 ? totalMonthly / totalMonthsInPeriod : 0,
      averageWeekly: totalWeeksInPeriod > 0 ? totalWeekly / totalWeeksInPeriod : 0,
      monthsCount: totalMonthsInPeriod,
      weeksCount: totalWeeksInPeriod,
    };
  }, [data, selectedSalesRep, search, dateFrom, dateTo, chartYear, chartMonth]);

  // Calculate average collection days (average days between payments per customer)
  const averageCollectionDays = useMemo(() => {
    // Apply filters
    const searchLower = search.toLowerCase().trim();
    let filteredPayments = data.filter((row) => {
      if (getInvoiceType(row) !== 'Payment') return false;

      // Apply sales rep filter
      if (selectedSalesRep && row.salesRep?.trim() !== selectedSalesRep) return false;

      // Apply date filters - same logic as dashboardData (year/month > date range > default)
      const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
      const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;
      const today = new Date();
      let startDate: Date;
      let endDate: Date;

      if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
        const y = yearNum && !isNaN(yearNum) ? yearNum : new Date().getFullYear();
        if (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          startDate = new Date(y, monthNum - 1, 1);
          endDate = new Date(y, monthNum, 0);
        } else {
          startDate = new Date(y, 0, 1);
          endDate = new Date(y, 11, 31);
        }
        endDate.setHours(23, 59, 59, 999);
      } else if (dateFrom || dateTo) {
        // Parse dates
        const fromDate = dateFrom ? parseDate(dateFrom) : null;
        const toDate = dateTo ? parseDate(dateTo) : null;

        if (fromDate && toDate) {
          // Both dates are set
          startDate = fromDate;
          endDate = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
        } else if (fromDate) {
          // Only dateFrom is set
          startDate = fromDate;
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (toDate) {
          // Only dateTo is set
          endDate = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
          startDate = new Date(toDate.getFullYear(), toDate.getMonth() - 11, 1);
        } else {
          // Invalid dates, use default
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        }
      } else {
        // Default: Last 12 months
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      }

      const d = parseDate(row.date);
      if (!d) return false;
      if (d < startDate || d > endDate) return false;

      // Apply search filter
      if (searchLower) {
        if (!row.customerName?.toLowerCase().includes(searchLower) &&
          !row.number?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });

    // Group payments by customer
    const paymentsByCustomer = new Map<string, Array<{ date: Date; amount: number }>>();

    filteredPayments.forEach((row) => {
      const d = parseDate(row.date);
      if (!d) return;

      const customerName = row.customerName?.trim() || '';
      if (!customerName) return;

      const netAmount = (row.credit || 0) - (row.debit || 0);

      if (!paymentsByCustomer.has(customerName)) {
        paymentsByCustomer.set(customerName, []);
      }

      paymentsByCustomer.get(customerName)!.push({ date: d, amount: netAmount });
    });

    // Calculate average days between payments for each customer
    const customerAverages: number[] = [];

    paymentsByCustomer.forEach((payments, customerName) => {
      if (payments.length < 2) return; // Need at least 2 payments to calculate interval

      // Sort payments by date
      payments.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calculate days between consecutive payments
      const intervals: number[] = [];
      for (let i = 1; i < payments.length; i++) {
        const daysDiff = Math.floor((payments[i].date.getTime() - payments[i - 1].date.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) {
          intervals.push(daysDiff);
        }
      }

      if (intervals.length > 0) {
        const avgDays = intervals.reduce((sum, days) => sum + days, 0) / intervals.length;
        customerAverages.push(avgDays);
      }
    });

    // Calculate overall average
    const overallAverage = customerAverages.length > 0
      ? customerAverages.reduce((sum, avg) => sum + avg, 0) / customerAverages.length
      : 0;

    return {
      averageDays: overallAverage,
      customersCount: customerAverages.length,
      totalPayments: filteredPayments.length,
    };
  }, [data, dateFrom, dateTo, selectedSalesRep, search, chartYear, chartMonth]);

  // Filter payments using the same TYPE logic as the Invoices tab (via shared getInvoiceType).
  const payments = useMemo<PaymentEntry[]>(() => {
    // Determine date range filters (Year/Month taking precedence over DateFrom/DateTo)
    const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
    const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;

    const isYearValid = yearNum !== null && !isNaN(yearNum);
    const isMonthValid = monthNum !== null && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12;
    const useYearMonthFilter = isYearValid || isMonthValid;

    let filterStartDate: Date | null = null;
    let filterEndDate: Date | null = null;

    if (!useYearMonthFilter) {
      if (dateFrom) {
        filterStartDate = parseDate(dateFrom);
      }
      if (dateTo) {
        const d = parseDate(dateTo);
        if (d) {
          filterEndDate = new Date(d);
          filterEndDate.setHours(23, 59, 59, 999);
        }
      }
    }

    return data
      .filter((row) => {
        // Filter by type
        if (getInvoiceType(row) !== 'Payment') return false;
        // Filter by sales rep if selected
        if (selectedSalesRep && row.salesRep?.trim() !== selectedSalesRep) return false;
        return true;
      })
      .map((row) => {
        const credit = row.credit || 0;
        const debit = row.debit || 0;
        // User-requested: payments amount = Credit - Debit
        const amountSource: 'creditMinusDebit' = 'creditMinusDebit';
        const amount = credit - debit;

        return {
          date: row.date,
          number: row.number,
          customerName: row.customerName,
          type: getInvoiceType(row),
          credit: amount,
          rawCredit: credit,
          debit: row.debit,
          rawDebit: debit,
          amountSource,
          salesRep: row.salesRep,
          matching: row.matching,
          parsedDate: parseDate(row.date),
          matchedOpeningBalance: row.matching
            ? obMatchingIds.has(row.matching.toString().toLowerCase())
            : false,
        };
      })
      .filter((payment) => {
        const paymentDate = payment.parsedDate;
        if (!paymentDate) return false;

        // Apply Year/Month filter if active
        if (useYearMonthFilter) {
          if (isYearValid && paymentDate.getFullYear() !== yearNum) return false;
          if (isMonthValid && paymentDate.getMonth() !== (monthNum! - 1)) return false;
          return true;
        }

        // Apply legacy DateFrom/DateTo filter
        if (filterStartDate && paymentDate < filterStartDate) return false;
        if (filterEndDate && paymentDate > filterEndDate) return false;

        return true;
      });
  }, [data, dateFrom, dateTo, obMatchingIds, selectedSalesRep, chartYear, chartMonth]);

  // Apply OB-closed / other payments toggles
  const visiblePayments = useMemo<PaymentEntry[]>(() => {
    if (showOBClosedPayments && showOtherPayments) return payments;

    return payments.filter((p) => {
      if (p.matchedOpeningBalance) {
        return showOBClosedPayments;
      }
      return showOtherPayments;
    });
  }, [payments, showOBClosedPayments, showOtherPayments]);

  // Group by customer
  const paymentsByCustomer = useMemo<PaymentByCustomer[]>(() => {
    const grouped = new Map<string, PaymentEntry[]>();

    visiblePayments.forEach((payment) => {
      const key = payment.customerName.trim().toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(payment);
    });

    return Array.from(grouped.entries())
      .map(([key, paymentList]) => {
        const customerName = paymentList[0].customerName;
        const totalPayments = paymentList.reduce((sum, p) => sum + p.credit, 0);
        // Only count actual payments (where Credit > 0.01) based on raw credit data
        // This excludes reversals or purely debit adjustments that might have been included in the list
        const paymentCount = paymentList.filter(p => p.rawCredit > 0.01).length;

        const sortedPayments = paymentList.sort((a, b) => {
          if (!a.parsedDate || !b.parsedDate) return 0;
          return b.parsedDate.getTime() - a.parsedDate.getTime();
        });

        // Get last payment (most recent)
        const lastPayment = sortedPayments.find(p => p.rawCredit > 0.01) || null;

        // Calculate days since last payment
        let daysSinceLastPayment: number | null = null;
        if (lastPayment && lastPayment.parsedDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const lastPaymentDate = new Date(lastPayment.parsedDate);
          lastPaymentDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - lastPaymentDate.getTime();
          daysSinceLastPayment = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
          customerName,
          totalPayments,
          paymentCount,
          payments: sortedPayments,
          lastPayment,
          daysSinceLastPayment,
        };
      })
      .sort((a, b) => b.totalPayments - a.totalPayments);
  }, [visiblePayments]);

  // Group by period (respecting search so main rows + popup are aligned)
  const paymentsByPeriod = useMemo<PaymentByPeriod[]>(() => {
    const grouped = new Map<string, PaymentEntry[]>();
    const searchLower = search.toLowerCase().trim();

    // If searching, restrict to payments that match customer name or number
    const basePayments = searchLower
      ? visiblePayments.filter(
        (p) =>
          p.customerName.toLowerCase().includes(searchLower) ||
          p.number.toLowerCase().includes(searchLower),
      )
      : visiblePayments;

    basePayments.forEach((payment) => {
      if (!payment.parsedDate) return;

      let key: string;
      if (periodType === 'daily') {
        key = getDailyKey(payment.parsedDate);
      } else if (periodType === 'weekly') {
        key = getWeeklyKey(payment.parsedDate);
      } else if (periodType === 'monthly') {
        key = getMonthlyKey(payment.parsedDate);
      } else {
        key = getYearlyKey(payment.parsedDate);
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(payment);
    });

    return Array.from(grouped.entries())
      .map(([key, paymentList]) => {
        const totalPayments = paymentList.reduce((sum, p) => sum + p.credit, 0);
        const sortedPayments = paymentList.sort((a, b) => {
          if (!a.parsedDate || !b.parsedDate) return 0;
          return b.parsedDate.getTime() - a.parsedDate.getTime();
        });

        // Only count actual payments (where Credit > 0.01) based on raw credit data
        const paymentCount = paymentList.filter(p => p.rawCredit > 0.01).length;

        return {
          period: formatPeriodLabel(key, periodType),
          periodKey: key,
          totalPayments,
          paymentCount,
          payments: sortedPayments,
        };
      })
      .sort((a, b) => {
        // For daily view, sort by latest payment date (newest first)
        if (periodType === 'daily') {
          const aTime = a.payments[0]?.parsedDate?.getTime() ?? 0;
          const bTime = b.payments[0]?.parsedDate?.getTime() ?? 0;
          return bTime - aTime;
        }
        // For other views, fall back to period key (chronological)
        return b.periodKey.localeCompare(a.periodKey);
      });
  }, [visiblePayments, periodType, search]);

  // Total collected amount respecting filters (date + search + tab)
  const totalFilteredPayments = useMemo(() => {
    const searchLower = search.toLowerCase().trim();

    let relevantPayments: PaymentEntry[];
    if (!searchLower) {
      relevantPayments = visiblePayments;
    } else if (activeSubTab === 'customer') {
      // Match by customer only
      relevantPayments = visiblePayments.filter((p) =>
        p.customerName.toLowerCase().includes(searchLower),
      );
    } else {
      // For period and dashboard views, match by customer or number
      relevantPayments = visiblePayments.filter(
        (p) =>
          p.customerName.toLowerCase().includes(searchLower) ||
          p.number.toLowerCase().includes(searchLower),
      );
    }

    return relevantPayments.reduce((sum, p) => sum + (p.credit || 0), 0);
  }, [visiblePayments, search, activeSubTab]);

  // Filter by search and sort
  const filteredByCustomer = useMemo(() => {
    let filtered = paymentsByCustomer;

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (item) => item.customerName.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'customerName':
          aValue = a.customerName.toLowerCase();
          bValue = b.customerName.toLowerCase();
          break;
        case 'totalPayments':
          aValue = a.totalPayments;
          bValue = b.totalPayments;
          break;
        case 'paymentCount':
          aValue = a.paymentCount;
          bValue = b.paymentCount;
          break;
        case 'lastPayment':
          aValue = a.lastPayment?.parsedDate?.getTime() || 0;
          bValue = b.lastPayment?.parsedDate?.getTime() || 0;
          break;
        case 'daysSince':
          aValue = a.daysSinceLastPayment ?? Infinity;
          bValue = b.daysSinceLastPayment ?? Infinity;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [paymentsByCustomer, search, sortColumn, sortDirection]);

  const filteredByPeriod = useMemo(() => paymentsByPeriod, [paymentsByPeriod]);

  // Calculate totals for Customer view
  const customerTotals = useMemo(() => {
    return filteredByCustomer.reduce(
      (acc, item) => ({
        totalPayments: acc.totalPayments + item.totalPayments,
        paymentCount: acc.paymentCount + item.paymentCount,
      }),
      { totalPayments: 0, paymentCount: 0 }
    );
  }, [filteredByCustomer]);

  // Calculate totals for Period view
  const periodTotals = useMemo(() => {
    return filteredByPeriod.reduce(
      (acc, item) => {
        const customerCount = new Set(
          item.payments.map((p) => p.customerName.trim().toLowerCase())
        ).size;
        return {
          totalPayments: acc.totalPayments + item.totalPayments,
          paymentCount: acc.paymentCount + item.paymentCount,
          customerCount: acc.customerCount + customerCount,
        };
      },
      { totalPayments: 0, paymentCount: 0, customerCount: 0 }
    );
  }, [filteredByPeriod]);

  const [selectedCustomer, setSelectedCustomer] = useState<PaymentByCustomer | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PaymentByPeriod | null>(null);
  const [detailMode, setDetailMode] = useState<'none' | 'customer' | 'period'>('none');
  const [lastPeriodSelection, setLastPeriodSelection] = useState<
    Partial<Record<'daily' | 'weekly' | 'monthly' | 'yearly', string>>
  >({});
  const [lastCustomerSelection, setLastCustomerSelection] = useState<string | null>(null);

  // Detail payments: show ALL payments for the selected customer/period (do not shrink by the main Search box),
  // so counts match the "Payment by Customer" summary.
  const customerDetailPayments = useMemo(() => {
    if (!selectedCustomer) return [];
    const nameKey = selectedCustomer.customerName.trim().toLowerCase();
    return visiblePayments.filter(
      (p) => p.customerName.trim().toLowerCase() === nameKey,
    );
  }, [visiblePayments, selectedCustomer]);

  // Calculate Chart Data for Selected Customer (Last 12 Months)
  const customerChartData = useMemo(() => {
    if (!selectedCustomer) return [];
    const today = new Date();
    const data = [];
    // Last 12 months including current
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-11
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      // Sum payments for this month
      // using customerDetailPayments which contains ALL payments for this customer (filtered by global settings)
      const paymentsInMonth = customerDetailPayments.filter(p => {
        const pd = p.parsedDate;
        if (!pd) return false;
        return pd.getFullYear() === year && pd.getMonth() === month;
      });

      const total = paymentsInMonth.reduce((sum, p) => sum + p.credit, 0);
      const count = paymentsInMonth.filter(p => p.rawCredit > 0.01).length;

      data.push({ name: label, amount: total, count });
    }
    return data;
  }, [selectedCustomer, customerDetailPayments]);

  // Calculate Average Days for Selected Customer
  const customerAvgDays = useMemo(() => {
    if (!selectedCustomer || !customerDetailPayments.length) return 0;

    // Sort ascending
    const sorted = [...customerDetailPayments]
      .filter(p => p.parsedDate)
      .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());

    if (sorted.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const t1 = sorted[i - 1].parsedDate!.getTime();
      const t2 = sorted[i].parsedDate!.getTime();
      const diff = (t2 - t1) / (1000 * 60 * 60 * 24);
      if (diff > 0) intervals.push(diff);
    }

    if (intervals.length === 0) return 0;
    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }, [selectedCustomer, customerDetailPayments]);

  const periodDetailPayments = useMemo(() => {
    if (!selectedPeriod) return [];

    // Rebuild base list from visiblePayments so that OB filters are always respected
    const base = visiblePayments.filter((p) => {
      if (!p.parsedDate) return false;

      let key: string;
      if (periodType === 'daily') {
        key = getDailyKey(p.parsedDate);
      } else if (periodType === 'weekly') {
        key = getWeeklyKey(p.parsedDate);
      } else if (periodType === 'monthly') {
        key = getMonthlyKey(p.parsedDate);
      } else {
        key = getYearlyKey(p.parsedDate);
      }

      return key === selectedPeriod.periodKey;
    });

    return base;
  }, [visiblePayments, selectedPeriod, periodType]);

  // Calculate statistics by Area (Sales Rep)
  const areaStats = useMemo(() => {
    // START: Reuse filter logic from averageCollectionDays
    // Apply filters
    const searchLower = search.toLowerCase().trim();
    let filteredPayments = data.filter((row) => {
      if (getInvoiceType(row) !== 'Payment') return false;

      // Apply sales rep filter (if specific rep selected, only show that rep in table)
      if (selectedSalesRep && row.salesRep?.trim() !== selectedSalesRep) return false;

      // Apply date filters - same logic as dashboardData
      const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
      const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;
      const today = new Date();
      let startDate: Date;
      let endDate: Date;

      if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
        const y = yearNum && !isNaN(yearNum) ? yearNum : new Date().getFullYear();
        if (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          startDate = new Date(y, monthNum - 1, 1);
          endDate = new Date(y, monthNum, 0);
        } else {
          startDate = new Date(y, 0, 1);
          endDate = new Date(y, 11, 31);
        }
        endDate.setHours(23, 59, 59, 999);
      } else if (dateFrom || dateTo) {
        const fromDate = dateFrom ? parseDate(dateFrom) : null;
        const toDate = dateTo ? parseDate(dateTo) : null;
        if (fromDate && toDate) {
          startDate = fromDate;
          endDate = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
        } else if (fromDate) {
          startDate = fromDate;
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (toDate) {
          endDate = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
          startDate = new Date(toDate.getFullYear(), toDate.getMonth() - 11, 1);
        } else {
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        }
      } else {
        // Default: ALL TIME (min date to max date from data)
        const today = new Date();
        let maxDate = new Date(0);
        let minDate = new Date(8640000000000000); // Max possible date

        // Find range in data
        let hasData = false;
        data.forEach(row => {
          const d = parseDate(row.date);
          if (d) {
            if (d > maxDate) maxDate = d;
            if (d < minDate) minDate = d;
            hasData = true;
          }
        });

        if (!hasData) {
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        } else {
          endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
          startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        }
        // Ensure end of day
        endDate.setHours(23, 59, 59, 999);
      }

      const d = parseDate(row.date);
      if (!d) return false;
      if (d < startDate || d > endDate) return false;

      // Apply search filter
      if (searchLower) {
        if (!row.customerName?.toLowerCase().includes(searchLower) &&
          !row.number?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Apply OB / Other Payment Checkbox filters
      // Same logic as dashboardData
      const matchId = (row.matching || '').toString().toLowerCase();
      const isOBPayment = matchId && obMatchingIds.has(matchId);

      if (isOBPayment) {
        if (!showOBClosedPayments) return false;
      } else {
        if (!showOtherPayments) return false;
      }

      return true;
    });
    // END: Reuse filter logic

    // Group by Sales Rep
    const statsByRep = new Map<string, {
      repName: string;
      totalCollected: number;
      paymentCount: number;
      avgPaymentAmount: number; // calculated later
      payments: { date: Date }[]; // store dates for avg interval calc
      avgCollectionDays: number; // calculated later
    }>();

    filteredPayments.forEach(row => {
      const repName = row.salesRep?.trim() || 'Unknown';
      const netAmount = (row.credit || 0) - (row.debit || 0);
      const d = parseDate(row.date);

      if (!statsByRep.has(repName)) {
        statsByRep.set(repName, {
          repName,
          totalCollected: 0,
          paymentCount: 0,
          avgPaymentAmount: 0,
          payments: [],
          avgCollectionDays: 0
        });
      }

      const stats = statsByRep.get(repName)!;
      stats.totalCollected += netAmount;
      stats.paymentCount += 1;
      if (d) stats.payments.push({ date: d });
    });

    // Calculate Averages
    return Array.from(statsByRep.values()).map(stats => {
      // Avg Payment Amount
      stats.avgPaymentAmount = stats.paymentCount > 0 ? stats.totalCollected / stats.paymentCount : 0;

      // Avg Collection Days
      // Logic: Calculate intervals between payments for this area globally (simplification)
      // Or: Group by customer within area, calc avg per customer, then avg of those averages?
      // Request says: "Average every how many days this area pays a payment".
      // Usually means: Sort ALL payments in area by date, get avg diff between consecutive payments.
      // E.g. Area pays on 1st, 5th, 10th. Intervals: 4, 5. Avg: 4.5 days.
      if (stats.payments.length > 1) {
        stats.payments.sort((a, b) => a.date.getTime() - b.date.getTime());
        let totalDaysDiff = 0;
        let diffCount = 0;
        for (let i = 1; i < stats.payments.length; i++) {
          const diffTime = Math.abs(stats.payments[i].date.getTime() - stats.payments[i - 1].date.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalDaysDiff += diffDays;
          diffCount++;
        }
        stats.avgCollectionDays = diffCount > 0 ? totalDaysDiff / diffCount : 0;
      } else {
        stats.avgCollectionDays = 0;
      }

      return stats;
    }).sort((a, b) => b.totalCollected - a.totalCollected); // Default sort by total collected

  }, [data, search, selectedSalesRep, chartYear, chartMonth, dateFrom, dateTo, showOBClosedPayments, showOtherPayments, obMatchingIds]);

  // (Customer detail restore is handled synchronously in the tab button click handler)

  return (
    <div className="p-6">

      {/* Search, Total and Date Filters - Above all tabs */}
      <div className="mb-3 flex flex-col lg:flex-row gap-4 items-center lg:items-end justify-between">
        <div className="w-full flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-sm font-semibold text-green-700 whitespace-nowrap shrink-0">
            Total Collected:{' '}
            {totalFilteredPayments.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

        </div>
        <div className="flex gap-2 w-full lg:w-auto justify-end">
          <select
            value={selectedSalesRep}
            onChange={(e) => setSelectedSalesRep(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Sales Reps</option>
            {salesReps.map((rep) => (
              <option key={rep} value={rep}>
                {rep}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Year"
            value={chartYear}
            onChange={(e) => setChartYear(e.target.value)}
            className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <input
            type="text"
            placeholder="Month"
            value={chartMonth}
            onChange={(e) => setChartMonth(e.target.value)}
            className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <input
            type="date"
            placeholder="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(search || selectedSalesRep || chartYear || chartMonth || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedSalesRep('');
                setChartYear('');
                setChartMonth('');
                setDateFrom('');
                setDateTo('');
              }}
              title="Clear Filters"
              className="p-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* OB matching filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-center text-sm text-gray-700">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOBClosedPayments}
            onChange={(e) => setShowOBClosedPayments(e.target.checked)}
            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
          />
          <span>OB Closed Payments</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOtherPayments}
            onChange={(e) => setShowOtherPayments(e.target.checked)}
            className="w-4 h-4 text-slate-600 border-gray-300 rounded focus:ring-slate-500"
          />
          <span>Other / Open Payments</span>
        </label>
      </div>

      {/* Sub-tabs */}
      <div className="mb-6 flex w-full border-b border-gray-200">
        <button
          onClick={() => {
            setActiveSubTab('dashboard');
            setDetailMode('none');
            setSelectedCustomer(null);
            setSelectedPeriod(null);
          }}
          className={`flex-1 py-3 font-semibold border-b-2 transition-colors text-center ${activeSubTab === 'dashboard'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => {
            setActiveSubTab('customer');

            if (lastCustomerSelection) {
              const match = paymentsByCustomer.find(
                (c) => c.customerName.trim().toLowerCase() === lastCustomerSelection,
              );
              if (match) {
                setSelectedCustomer(match);
                setDetailMode('customer');
                return;
              }
            }

            setDetailMode('none');
            setSelectedCustomer(null);
          }}
          className={`flex-1 py-3 font-semibold border-b-2 transition-colors text-center ${activeSubTab === 'customer'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Payment by Customer
        </button>
        <button
          onClick={() => {
            setActiveSubTab('period');
            setDetailMode('none');
            setSelectedPeriod(null);
          }}
          className={`flex-1 py-3 font-semibold border-b-2 transition-colors text-center ${activeSubTab === 'period'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Payment by Period
        </button>
        <button
          onClick={() => {
            setActiveSubTab('area');
            setDetailMode('none');
          }}
          className={`flex-1 py-3 font-semibold border-b-2 transition-colors text-center ${activeSubTab === 'area'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Payment by Area
        </button>
      </div>

      {/* Dashboard - Cards & Chart */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-4 animate-fadeIn">
          {/* First Row - 4 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 font-medium mb-2 text-sm">Total Collections</h3>
              <div className="text-2xl font-bold text-green-600">
                {dashboardData.totals.totalCollections.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-400 mt-1">Total payments collected</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 font-medium mb-2 text-sm">Net Payment Count</h3>
              <div className="text-2xl font-bold text-blue-600">
                {dashboardData.totals.netPaymentCount.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-gray-400 mt-1">Payments with Credit - Debit &gt; 0</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 font-medium mb-2 text-sm">OB Only</h3>
              <div className="text-2xl font-bold text-purple-600">
                {paymentClosureStats.obOnlyPercent.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {paymentClosureStats.obOnlyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({paymentClosureStats.obOnlyCount} payments)
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 font-medium mb-2 text-sm">Current Year Only</h3>
              <div className="text-2xl font-bold text-indigo-600">
                {paymentClosureStats.currentYearOnlyPercent.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {paymentClosureStats.currentYearOnlyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({paymentClosureStats.currentYearOnlyCount} payments)
              </p>
            </div>
          </div>

          {/* Second Row - 5 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 font-medium mb-2 text-sm">Mixed (OB + Current Year)</h3>
              <div className="text-2xl font-bold text-pink-600">
                {paymentClosureStats.mixedPercent.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {paymentClosureStats.mixedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({paymentClosureStats.mixedCount} payments)
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 font-medium mb-2 text-sm">Unmatched</h3>
              <div className="text-2xl font-bold text-gray-600">
                {paymentClosureStats.unmatchedPercent.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {paymentClosureStats.unmatchedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({paymentClosureStats.unmatchedCount} payments)
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 font-medium mb-2 text-sm">Avg Monthly Collections</h3>
              <div className="text-2xl font-bold text-teal-600">
                {averageCollections.averageMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Based on {averageCollections.monthsCount} month(s) in period
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 font-medium mb-2 text-sm">Avg Weekly Collections</h3>
              <div className="text-2xl font-bold text-cyan-600">
                {averageCollections.averageWeekly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Based on {averageCollections.weeksCount} week(s) in period
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-gray-500 font-medium mb-2 text-sm">Avg Collection Days</h3>
              <div className="text-2xl font-bold text-orange-600">
                {averageCollectionDays.averageDays > 0 ? averageCollectionDays.averageDays.toFixed(1) : '0.0'} days
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Based on {averageCollectionDays.customersCount} customer(s) with multiple payments
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-[720px]">
            <div className="flex flex-col items-center gap-3 mb-4">
              <h3 className="text-lg font-bold text-gray-800 text-center">
                Collections - {
                  chartPeriodType === 'daily' ? (dateFrom || dateTo || chartYear || chartMonth ? 'Daily Trend' : 'All Time Daily') :
                    chartPeriodType === 'weekly' ? (dateFrom || dateTo || chartYear || chartMonth ? 'Weekly Trend' : 'All Time Weekly') :
                      (dateFrom || dateTo || chartYear || chartMonth ? 'Monthly Trend' : 'All Time Monthly')
                }
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-semibold text-emerald-700 whitespace-nowrap">
                  Total Payments:{' '}
                  {dashboardData.totals.totalCollections.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  <span className="text-[10px] sm:text-xs text-emerald-600">
                    ({dashboardData.totals.netPaymentCount.toLocaleString('en-US')} payments)
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Year"
                  value={chartYear}
                  onChange={(e) => setChartYear(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-24 text-center"
                />
                <input
                  type="text"
                  placeholder="Month"
                  value={chartMonth}
                  onChange={(e) => setChartMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-24 text-center"
                />
                <button
                  onClick={() => setChartPeriodType('monthly')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${chartPeriodType === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setChartPeriodType('weekly')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${chartPeriodType === 'weekly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setChartPeriodType('daily')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${chartPeriodType === 'daily'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  Daily
                </button>
              </div>
            </div>
            {chartPeriodType === 'daily' ? (
              <div className="overflow-y-auto h-[600px] p-2">
                <div className="grid grid-cols-8 gap-3">
                  {(() => {
                    const sortedData = [...dashboardData.chartData].sort((a, b) => b.periodKey.localeCompare(a.periodKey));
                    const maxVal = Math.max(...sortedData.map(d => d.collections), 1);

                    return sortedData.map((row) => {
                      const isZero = row.collections === 0;

                      // Green intensity for non-zero, Red for zero
                      const intensity = isZero ? 0 : Math.min(Math.max((row.collections / maxVal), 0.1), 1);

                      const bgStyle = isZero
                        ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA' } // Red-50, Red-200
                        : { backgroundColor: `rgba(16, 185, 129, ${intensity * 0.2 + 0.05})`, borderColor: `rgba(16, 185, 129, ${intensity * 0.5})` };

                      return (
                        <div
                          key={row.periodKey}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border shadow-sm transition-transform hover:scale-105 ${isZero ? 'text-red-600' : 'text-gray-800'}`}
                          style={bgStyle}
                        >
                          <span className={`text-sm font-semibold mb-1 ${isZero ? 'text-red-400' : 'text-gray-500'}`}>{row.periodLabel}</span>
                          <span className={`text-xl font-bold ${isZero ? 'text-red-700' : 'text-gray-900'}`}>
                            {row.collections.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      );
                    });
                  })()}
                  {dashboardData.chartData.length === 0 && (
                    <div className="col-span-8 text-center text-gray-500 py-12">
                      No data available for the selected period
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={600}>
                <BarChart
                  data={dashboardData.chartData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: chartPeriodType === 'weekly' ? 70 : 50,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="periodLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 13, fontWeight: 'bold' }}
                    height={chartPeriodType === 'weekly' ? 70 : 60}
                    interval={0}
                    angle={0}
                    textAnchor="middle"
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)
                    }
                  />
                  <Tooltip
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) =>
                      new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
                    }
                  />
                  <Legend iconType="circle" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Bar
                    dataKey="displayCollections"
                    name="Net Collections"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    barSize={chartPeriodType === 'weekly' ? 25 : 30}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Period Type Selector (only for period tab) */}
      {activeSubTab === 'period' && (
        <div className="mb-6 flex w-full gap-2 justify-center">
          <button
            onClick={() => {
              setPeriodType('daily');
              setDetailMode('none');
              setSelectedPeriod(null);
            }}
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors text-center ${periodType === 'daily'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Daily
          </button>
          <button
            onClick={() => {
              setPeriodType('weekly');
              setDetailMode('none');
              setSelectedPeriod(null);
            }}
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors text-center ${periodType === 'weekly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Weekly
          </button>
          <button
            onClick={() => {
              setPeriodType('monthly');
              setDetailMode('none');
              setSelectedPeriod(null);
            }}
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors text-center ${periodType === 'monthly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Monthly
          </button>
          <button
            onClick={() => {
              setPeriodType('yearly');
              setDetailMode('none');
              setSelectedPeriod(null);
            }}
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors text-center ${periodType === 'yearly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Yearly
          </button>
        </div>
      )}

      {/* Payment by Customer - Main List */}
      {activeSubTab === 'customer' && detailMode === 'none' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th
                    className="px-5 py-3 text-left font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => {
                      if (sortColumn === 'customerName') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortColumn('customerName');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Customer Name
                      {sortColumn === 'customerName' && (
                        <span className="text-blue-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none w-40"
                    onClick={() => {
                      if (sortColumn === 'totalPayments') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortColumn('totalPayments');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Total Payments
                      {sortColumn === 'totalPayments' && (
                        <span className="text-blue-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none w-40"
                    onClick={() => {
                      if (sortColumn === 'paymentCount') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortColumn('paymentCount');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Payment Count
                      {sortColumn === 'paymentCount' && (
                        <span className="text-blue-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none w-40"
                    onClick={() => {
                      if (sortColumn === 'lastPayment') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortColumn('lastPayment');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Last Payment
                      {sortColumn === 'lastPayment' && (
                        <span className="text-blue-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none w-40"
                    onClick={() => {
                      if (sortColumn === 'daysSince') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortColumn('daysSince');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Days Since
                      {sortColumn === 'daysSince' && (
                        <span className="text-blue-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-5 py-3 text-center font-semibold w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredByCustomer.map((item, index) => (
                  <tr key={item.customerName} className="bg-white hover:bg-blue-50/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div className="font-semibold text-gray-900">{item.customerName}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-gray-900 w-40">
                      {item.totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 text-center w-40">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.paymentCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center w-40">
                      {item.lastPayment ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {item.lastPayment.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs text-gray-500">
                            {item.lastPayment.parsedDate ? item.lastPayment.parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : item.lastPayment.date}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center w-40">
                      {item.daysSinceLastPayment !== null ? (
                        <span className="text-sm font-semibold text-gray-900">
                          {item.daysSinceLastPayment} {item.daysSinceLastPayment === 1 ? 'day' : 'days'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center w-40">
                      <button
                        onClick={() => {
                          setSelectedCustomer(item);
                          setDetailMode('customer');
                          setLastCustomerSelection(item.customerName.trim().toLowerCase());
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredByCustomer.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No payments match your search.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
                <tr>
                  <td className="px-5 py-3 text-left">Total</td>
                  <td className="px-5 py-3 text-center w-40">
                    {customerTotals.totalPayments.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-3 text-center w-40">{customerTotals.paymentCount}</td>
                  <td className="px-5 py-3 text-center w-40">-</td>
                  <td className="px-5 py-3 text-center w-40">-</td>
                  <td className="px-5 py-3 text-center w-40"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Customer Details - Sub Page */}
      {activeSubTab === 'customer' && detailMode === 'customer' && selectedCustomer && (
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-right-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{selectedCustomer.customerName}</h3>
              <p className="text-sm text-gray-500 mt-1">Detailed payment history analysis</p>
            </div>
            <button
              onClick={() => {
                setDetailMode('none');
                setSelectedCustomer(null);
                setLastCustomerSelection(null);
              }}
              className="px-4 py-2 bg-white border border-gray-300 shadow-sm text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center gap-2"
            >
              <span>←</span> Back to list
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col items-center text-center">
                <span className="text-emerald-600 font-medium text-sm uppercase tracking-wider mb-1">Total Collected</span>
                <span className="text-3xl font-bold text-emerald-700">
                  {customerDetailPayments
                    .reduce((sum, p) => sum + (p.credit || 0), 0)
                    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="p-5 rounded-xl bg-cyan-50 border border-cyan-100 flex flex-col items-center text-center">
                <span className="text-cyan-600 font-medium text-sm uppercase tracking-wider mb-1">Avg. Payment Amount</span>
                <span className="text-3xl font-bold text-cyan-700">
                  {(() => {
                    const total = customerDetailPayments.reduce((sum, p) => sum + (p.credit || 0), 0);
                    const count = customerDetailPayments.filter(p => p.rawCredit > 0.01).length;
                    return (count > 0 ? total / count : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  })()}
                </span>
              </div>

              <div className="p-5 rounded-xl bg-blue-50 border border-blue-100 flex flex-col items-center text-center">
                <span className="text-blue-600 font-medium text-sm uppercase tracking-wider mb-1">Payment Count</span>
                <span className="text-3xl font-bold text-blue-700">
                  {customerDetailPayments.filter(p => p.rawCredit > 0.01).length}
                </span>
              </div>

              <div className="p-5 rounded-xl bg-purple-50 border border-purple-100 flex flex-col items-center text-center">
                <span className="text-purple-600 font-medium text-sm uppercase tracking-wider mb-1">Avg. Payment Days</span>
                <span className="text-3xl font-bold text-purple-700">
                  {Math.round(customerAvgDays)} <span className="text-lg font-normal text-purple-600">days</span>
                </span>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl p-4 h-80">
              <h4 className="text-xl font-bold text-gray-800 mb-4 px-2">Payments Last 12 Months</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPayment" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#374151', fontSize: 13, fontWeight: '600' }}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: '#EFF6FF', radius: 4 }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-xl shadow-xl border border-blue-100 text-sm">
                            <p className="font-bold text-gray-800 mb-1">{label}</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-blue-600">
                                {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(data.amount)}
                              </span>
                              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">AED</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-4">
                              <span className="text-gray-500 text-xs">Transactions</span>
                              <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                                {data.count}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    name="Amount"
                    fill="url(#colorPayment)"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                    activeBar={{ fill: '#1D4ED8' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-12">
              <div className="px-5 py-3 border-b bg-gray-50">
                <h4 className="font-semibold text-gray-800">Payment History</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-gray-600 text-center">
                      <th className="px-4 py-3 text-center">Date</th>
                      <th className="px-4 py-3 text-center">Number</th>
                      <th className="px-4 py-3 text-center">Paid</th>
                      <th className="px-4 py-3 text-center">Matching</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {customerDetailPayments.map((payment, idx) => (
                      <tr
                        key={`${payment.number}-${idx}`}
                        className={`hover:bg-gray-50 text-center ${payment.credit < 0
                          ? 'bg-red-50/60'
                          : payment.matchedOpeningBalance
                            ? 'bg-emerald-50/60'
                            : ''
                          }`}
                      >
                        <td className="px-4 py-2 text-gray-700 text-center">{formatDate(payment.parsedDate)}</td>
                        <td className="px-4 py-2 font-semibold text-gray-900 text-center">{payment.number}</td>
                        <td className={`px-4 py-2 font-semibold text-center text-base ${payment.credit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {payment.credit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-center">
                          {payment.matching || '—'}
                          {payment.matchedOpeningBalance && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              OB Closed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {customerDetailPayments.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400">No payments found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Payment by Period - Main List */}
      {activeSubTab === 'period' && detailMode === 'none' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Period</th>
                  <th className="px-5 py-3 text-center font-semibold">Total Payments</th>
                  <th className="px-5 py-3 text-center font-semibold">Payment Count</th>
                  <th className="px-5 py-3 text-center font-semibold">Customer Count</th>
                  <th className="px-5 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredByPeriod.map((item, index) => {
                  const customerCount = new Set(
                    item.payments.map((p) => p.customerName.trim().toLowerCase()),
                  ).size;
                  return (
                    <tr key={item.periodKey} className="bg-white hover:bg-blue-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div className="font-semibold text-gray-900">{item.period}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center font-semibold text-gray-900">
                        {item.totalPayments.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-green-50 text-green-700 border border-green-200">
                          {item.paymentCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {customerCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedPeriod(item);
                            setDetailMode('period');
                            setLastPeriodSelection((prev) => ({
                              ...prev,
                              [periodType]: item.periodKey,
                            }));
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredByPeriod.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No payments match your search.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
                <tr>
                  <td className="px-5 py-3 text-left">Total</td>
                  <td className="px-5 py-3 text-center">
                    {periodTotals.totalPayments.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-3 text-center">{periodTotals.paymentCount}</td>
                  <td className="px-5 py-3 text-center">{periodTotals.customerCount}</td>
                  <td className="px-5 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}



      {/* Period Details - Full Page inside tab */}
      {activeSubTab === 'period' && detailMode === 'period' && selectedPeriod && (
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{selectedPeriod.period}</h3>
              <p className="text-sm text-gray-500">
                Total Payments:{' '}
                {periodDetailPayments
                  .reduce((sum, p) => sum + (p.credit || 0), 0)
                  .toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                · Payment Count: {periodDetailPayments.filter(p => p.rawCredit > 0.01).length}
              </p>
            </div>
            <button
              onClick={() => {
                setDetailMode('none');
                setSelectedPeriod(null);
              }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              ← Back to list
            </button>
          </div>
          <div className="px-6 pb-6 pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-gray-600 text-center">
                  <th className="px-4 py-3 text-center">Date</th>
                  <th className="px-4 py-3 text-center">Customer Name</th>
                  <th className="px-4 py-3 text-center">Number</th>
                  <th className="px-4 py-3 text-center">Paid</th>
                  <th className="px-4 py-3 text-center">Matching</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {periodDetailPayments.map((payment, idx) => (
                  <tr
                    key={`${payment.number}-${idx}`}
                    className={`hover:bg-gray-50 text-center ${payment.credit < 0
                      ? 'bg-red-50/60'
                      : payment.matchedOpeningBalance
                        ? 'bg-emerald-50/60'
                        : ''
                      }`}
                  >
                    <td className="px-4 py-2 text-gray-700 text-center">{formatDate(payment.parsedDate)}</td>
                    <td className="px-4 py-2 text-gray-700 text-center">{payment.customerName}</td>
                    <td className="px-4 py-2 font-semibold text-gray-900 text-center">{payment.number}</td>
                    <td className={`px-4 py-2 font-semibold text-center text-base ${payment.credit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {payment.credit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-center">
                      {payment.matching || '—'}
                      {payment.matchedOpeningBalance && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          OB Closed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeSubTab === 'area' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-gray-600 uppercase tracking-wider">
                  Area Name
                </th>
                <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-gray-600 uppercase tracking-wider">
                  Total Collected
                </th>
                <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-gray-600 uppercase tracking-wider">
                  Payment Count
                </th>
                <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-blue-700 uppercase tracking-wider">
                  Avg Payment Amount
                </th>
                <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-orange-700 uppercase tracking-wider">
                  Avg Days Between Payments
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-base">
              {areaStats.map((area) => (
                <tr key={area.repName} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 text-center">
                    {area.repName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-emerald-600 text-center">
                    {area.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 text-center">
                    {area.paymentCount.toLocaleString('en-US')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600 text-center">
                    {area.avgPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-orange-600 text-center">
                    {area.avgCollectionDays.toFixed(1)} days
                  </td>
                </tr>
              ))}
              {areaStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No data available for the selected filters
                  </td>
                </tr>
              )}
            </tbody>
            {areaStats.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-bold text-base">
                <tr>
                  <td className="px-6 py-4 text-center text-gray-900">Total / Average</td>
                  <td className="px-6 py-4 text-center text-emerald-700">
                    {areaStats.reduce((acc, curr) => acc + curr.totalCollected, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-800">
                    {areaStats.reduce((acc, curr) => acc + curr.paymentCount, 0).toLocaleString('en-US')}
                  </td>
                  <td className="px-6 py-4 text-center text-blue-700">
                    {(areaStats.reduce((acc, curr) => acc + curr.totalCollected, 0) / areaStats.reduce((acc, curr) => acc + curr.paymentCount, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-center text-orange-700">
                    -
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

    </div>
  );
}

