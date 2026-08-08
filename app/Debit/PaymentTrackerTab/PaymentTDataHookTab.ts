'use client';

import { useMemo, useState } from 'react';
import { InvoiceRow } from '@/types';
import { getInvoiceType } from '@/app/Debit/Utils/InvoiceType';
import { useDebouncedValue } from '../Hooks/useDebouncedValue';
import {
  PaymentEntry,
  PaymentByCustomer,
  PaymentByPeriod,
  PeriodType,
  DetailMode,
  PaymentTrackerSubTab,
  PdfExportSections
} from './PaymentTTypesTab';
import {
  parseDate,
  getDailyKey,
  getWeeklyKey,
  getMonthlyKey,
  getYearlyKey,
  formatPeriodLabel
} from './PaymentTUtilsTab';

export function usePaymentTDataTab(data: InvoiceRow[]) {
  // --- States ---
  const [activeSubTab, setActiveSubTab] = useState<PaymentTrackerSubTab>('dashboard');
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [chartPeriodType, setChartPeriodType] = useState<'weekly' | 'monthly'>('monthly');
  const [chartYear, setChartYear] = useState<string>('');
  const [chartMonth, setChartMonth] = useState<string>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<'customerName' | 'totalPayments' | 'paymentCount' | 'lastPayment' | 'daysSince'>('totalPayments');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // PDF Export State
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [pdfExportSections, setPdfExportSections] = useState<PdfExportSections>({
    summary: true,
    summaryPrevious: true,
    summaryLastYear: true,
    monthly: true,
    customerList: true,
    nonPayerList: true,
    gapAnalysis: true,
    salesRep: true
  });
  const [pdfSelectedCustomers, setPdfSelectedCustomers] = useState<Set<string>>(new Set());
  const [isCustomerSelectionOpen, setIsCustomerSelectionOpen] = useState(false);
  const [checklistSearch, setChecklistSearch] = useState('');
  const [isTagsPickerOpen, setIsTagsPickerOpen] = useState(false);
  const [selectedCustomerTags, setSelectedCustomerTags] = useState<string[]>([]);

  // Detail views state
  const [selectedCustomer, setSelectedCustomer] = useState<PaymentByCustomer | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PaymentByPeriod | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>('none');
  const [lastPeriodSelection, setLastPeriodSelection] = useState<
    Partial<Record<PeriodType, string>>
  >({});
  const [lastCustomerSelection, setLastCustomerSelection] = useState<string | null>(null);

  // --- Memos ---

  const salesReps = useMemo(() => {
    const reps = new Set<string>();
    data.forEach((row) => {
      if (row.salesRep && row.salesRep.trim()) {
        reps.add(row.salesRep.trim());
      }
    });
    return Array.from(reps).sort();
  }, [data]);

  const allCustomerTags = useMemo(() => {
    const tags = new Set<string>();
    data.forEach((row) => {
      const tag = row.customerTag?.trim();
      if (tag) tags.add(tag);
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const customerTagsByName = useMemo(() => {
    const map = new Map<string, Set<string>>();
    data.forEach((row) => {
      const name = row.customerName?.trim().toLowerCase();
      const tag = row.customerTag?.trim();
      if (!name || !tag) return;
      const existing = map.get(name) || new Set<string>();
      existing.add(tag);
      map.set(name, existing);
    });
    return map;
  }, [data]);

  // When tags are selected, scope ALL tracker views + export to matching customers
  const effectiveData = useMemo(() => {
    if (selectedCustomerTags.length === 0) return data;
    const tagSet = new Set(selectedCustomerTags);
    const allowedNames = new Set<string>();
    customerTagsByName.forEach((tags, name) => {
      if (Array.from(tags).some((tag) => tagSet.has(tag))) allowedNames.add(name);
    });
    return data.filter((row) => allowedNames.has(row.customerName?.trim().toLowerCase() || ''));
  }, [data, selectedCustomerTags, customerTagsByName]);

  const allCustomers = useMemo(() => {
    return Array.from(new Set(
      effectiveData
        .filter(row => {
          const t = getInvoiceType(row);
          return t === 'Payment' || t === 'R-Payment';
        })
        .map(p => p.customerName)
    )).sort();
  }, [effectiveData]);

  const filteredCustomerChecklist = useMemo(() => {
    return allCustomers.filter(c =>
      checklistSearch ? c.toLowerCase().includes(checklistSearch.toLowerCase()) : true
    );
  }, [allCustomers, checklistSearch]);

  const dateRange = useMemo(() => {
    let startDate: Date;
    let endDate: Date;
    const today = new Date();
    const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
    const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;

    if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
      const y = yearNum && !isNaN(yearNum) ? yearNum : today.getFullYear();
      if (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        startDate = new Date(y, monthNum - 1, 1);
        endDate = new Date(y, monthNum, 0);
      } else {
        startDate = new Date(y, 0, 1);
        endDate = new Date(y, 11, 31);
      }
      endDate.setHours(23, 59, 59, 999);
    } else if (dateFrom || dateTo) {
      let maxDataDate = new Date(0);
      let minDataDate = new Date(8640000000000000);
      let hasAnyData = false;
      effectiveData.forEach(row => {
        const d = parseDate(row.date);
        if (d) {
          if (d > maxDataDate) maxDataDate = d;
          if (d < minDataDate) minDataDate = d;
          hasAnyData = true;
        }
      });
      if (!hasAnyData) {
        minDataDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        maxDataDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      }

      if (dateFrom) {
        const fromDate = parseDate(dateFrom);
        startDate = fromDate || minDataDate;
        if (fromDate) startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = minDataDate;
      }
      if (dateTo) {
        const toDate = parseDate(dateTo);
        if (toDate) {
          endDate = new Date(toDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          endDate = new Date(maxDataDate);
          endDate.setHours(23, 59, 59, 999);
        }
      } else {
        endDate = new Date(maxDataDate);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      let maxDate = new Date(0);
      let minDate = new Date(8640000000000000);
      let hasDataData = false;
      effectiveData.forEach(row => {
        const d = parseDate(row.date);
        if (d) {
          if (d > maxDate) maxDate = d;
          if (d < minDate) minDate = d;
          hasDataData = true;
        }
      });
      if (!hasDataData) {
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      } else {
        endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
        startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      }
    }
    return { startDate, endDate };
  }, [effectiveData, chartYear, chartMonth, dateFrom, dateTo, selectedCustomerTags]);

  const dashboardData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const { startDate, endDate } = dateRange;
    const sTime = new Date(startDate).setHours(0, 0, 0, 0);
    const eTime = new Date(endDate).setHours(23, 59, 59, 999);

    const searchLower = debouncedSearch.toLowerCase().trim();
    let filteredData = searchLower
      ? effectiveData.filter(
          (row) =>
            row.customerName?.toLowerCase().includes(searchLower) ||
            row.number?.toLowerCase().includes(searchLower)
        )
      : effectiveData;
    if (selectedSalesRep) {
      filteredData = filteredData.filter((row) => row.salesRep?.trim() === selectedSalesRep);
    }

    // Cards: same simple range math as Details Dashboard
    let totalCollections = 0;
    let netPaymentCount = 0;

    const paymentYears = new Set<number>();
    filteredData.forEach((row) => {
      const t = getInvoiceType(row);
      if (t !== 'Payment' && t !== 'R-Payment') return;
      const d = parseDate(row.date);
      if (!d) return;
      paymentYears.add(d.getFullYear());

      const dTime = d.getTime();
      if (dTime >= sTime && dTime <= eTime) {
        const val = (row.credit || 0) - (row.debit || 0);
        if (val !== 0) {
          totalCollections += val;
          if (val > 0.001) netPaymentCount += 1;
        }
      }
    });

    const chartYearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : NaN;
    let currentYear =
      !Number.isNaN(chartYearNum) && chartYearNum > 1900
        ? chartYearNum
        : paymentYears.size > 0
          ? Math.max(...Array.from(paymentYears))
          : new Date().getFullYear();

    let previousYear = currentYear - 1;
    if (!paymentYears.has(previousYear)) {
      const earlier = Array.from(paymentYears)
        .filter((y) => y < currentYear)
        .sort((a, b) => b - a);
      if (earlier.length > 0) previousYear = earlier[0];
    }

    type MonthBucket = {
      periodLabel: string;
      monthIndex: number;
      collections: number;
      paymentCount: number;
      customerSet: Set<string>;
      lastYearCollections: number;
    };

    const buckets: MonthBucket[] = monthNames.map((label, monthIndex) => ({
      periodLabel: label,
      monthIndex,
      collections: 0,
      paymentCount: 0,
      customerSet: new Set<string>(),
      lastYearCollections: 0,
    }));

    filteredData.forEach((row) => {
      const d = parseDate(row.date);
      if (!d) return;
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      if (monthIndex < 0 || monthIndex > 11) return;

      const type = getInvoiceType(row);
      if (type !== 'Payment' && type !== 'R-Payment') return;

      const netAmount = (row.credit || 0) - (row.debit || 0);
      const bucket = buckets[monthIndex];

      if (year === currentYear) {
        bucket.collections += netAmount;
        if (netAmount > 0.001) {
          bucket.paymentCount += 1;
          if (row.customerName) bucket.customerSet.add(row.customerName.trim());
        }
      } else if (year === previousYear) {
        bucket.lastYearCollections += netAmount;
      }
    });

    const chartData = buckets.map((item) => ({
      periodLabel: item.periodLabel,
      monthIndex: item.monthIndex,
      collections: item.collections,
      displayCollections: Math.round(item.collections * 100) / 100,
      lastYearCollections: Math.round(item.lastYearCollections * 100) / 100,
      paymentCount: item.paymentCount,
      customerCount: item.customerSet.size,
    }));

    return {
      chartData,
      currentYear,
      previousYear,
      totals: {
        totalNetSalesMinusDiscounts: 0,
        totalCollections: Math.round(totalCollections * 100) / 100,
        difference: 0,
        netPaymentCount,
      },
    };
  }, [
    effectiveData,
    dateRange,
    debouncedSearch,
    selectedSalesRep,
    chartYear,
    selectedCustomerTags,
  ]);

  const averageCollections = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const sTime = new Date(startDate).setHours(0, 0, 0, 0);
    const eTime = new Date(endDate).setHours(23, 59, 59, 999);
    const searchLower = debouncedSearch.toLowerCase().trim();

    const monthlyTotals = new Map<string, number>();
    const weeklyTotals = new Map<string, number>();

    effectiveData.forEach((row) => {
      const t = getInvoiceType(row);
      if (t !== 'Payment' && t !== 'R-Payment') return;
      if (selectedSalesRep && row.salesRep?.trim() !== selectedSalesRep) return;
      if (
        searchLower &&
        !row.customerName?.toLowerCase().includes(searchLower) &&
        !row.number?.toLowerCase().includes(searchLower)
      ) {
        return;
      }

      const d = parseDate(row.date);
      if (!d || d.getTime() < sTime || d.getTime() > eTime) return;

      const amount = (row.credit || 0) - (row.debit || 0);
      if (amount === 0) return;

      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyTotals.set(yearMonth, (monthlyTotals.get(yearMonth) || 0) + amount);

      const year = d.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const days = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000);
      const week = Math.floor(days / 7);
      const weekKey = `${year}-W${String(week).padStart(2, '0')}`;
      weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + amount);
    });

    const totalMonthly = Array.from(monthlyTotals.values()).reduce((s, v) => s + v, 0);
    const totalWeekly = Array.from(weeklyTotals.values()).reduce((s, v) => s + v, 0);
    const monthsCount = Math.max(1, monthlyTotals.size);
    const weeksCount = Math.max(1, weeklyTotals.size);

    return {
      averageMonthly: totalMonthly / monthsCount,
      averageWeekly: totalWeekly / weeksCount,
      monthsCount,
      weeksCount,
    };
  }, [
    effectiveData,
    dateRange,
    selectedSalesRep,
    debouncedSearch,
    selectedCustomerTags,
  ]);



  const payments = useMemo<PaymentEntry[]>(() => {
    const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
    const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;
    const isYearValid = yearNum !== null && !isNaN(yearNum), isMonthValid = monthNum !== null && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12;
    const useYearMonthFilter = isYearValid || isMonthValid;
    let filterStartDate: Date | null = null, filterEndDate: Date | null = null;
    if (!useYearMonthFilter) {
      if (dateFrom) { const d = parseDate(dateFrom); if (d) { filterStartDate = new Date(d); filterStartDate.setHours(0, 0, 0, 0); } }
      if (dateTo) { const d = parseDate(dateTo); if (d) { filterEndDate = new Date(d); filterEndDate.setHours(23, 59, 59, 999); } }
    }
    return effectiveData.filter(row => { const t = getInvoiceType(row); return (t === 'Payment' || t === 'R-Payment') && (!selectedSalesRep || row.salesRep?.trim() === selectedSalesRep); })
      .map(row => ({ date: row.date, number: row.number, customerName: row.customerName, type: getInvoiceType(row), credit: (row.credit || 0) - (row.debit || 0), rawCredit: row.credit || 0, debit: row.debit || 0, rawDebit: row.debit || 0, amountSource: 'creditMinusDebit' as any, salesRep: row.salesRep, matching: row.matching, parsedDate: parseDate(row.date) }))
      .filter(p => {
        if (!p.parsedDate) return false;
        if (useYearMonthFilter) { if (isYearValid && p.parsedDate.getFullYear() !== yearNum) return false; if (isMonthValid && p.parsedDate.getMonth() !== (monthNum! - 1)) return false; return true; }
        if (filterStartDate && p.parsedDate < filterStartDate) return false;
        if (filterEndDate && p.parsedDate > filterEndDate) return false;
        return true;
      });
  }, [effectiveData, dateFrom, dateTo, selectedSalesRep, chartYear, chartMonth, selectedCustomerTags]);

  const visiblePayments = useMemo<PaymentEntry[]>(() => {
    const searchLower = debouncedSearch.trim().toLowerCase();
    if (!searchLower) return payments;
    return payments.filter(p => (p.customerName || '').toLowerCase().includes(searchLower) || (p.number || '').toLowerCase().includes(searchLower));
  }, [payments, debouncedSearch]);

  const paymentsByCustomer = useMemo<PaymentByCustomer[]>(() => {
    if (activeSubTab !== 'customer') return [];
    const grouped = new Map<string, PaymentEntry[]>();
    visiblePayments.forEach(p => { const k = p.customerName.trim().toLowerCase(); if (!grouped.has(k)) grouped.set(k, []); grouped.get(k)!.push(p); });
    return Array.from(grouped.entries()).map(([k, list]) => {
      const customerName = list[0].customerName, totalPayments = list.reduce((s, p) => s + p.credit, 0), paymentCount = list.filter(p => p.rawCredit > 0.01).length;
      const sorted = list.sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0));
      const lastPayment = sorted.find(p => p.rawCredit > 0.01) || null;
      let daysSinceLastPayment = null; if (lastPayment && lastPayment.parsedDate) { const today = new Date(); today.setHours(0, 0, 0, 0); const lpDate = new Date(lastPayment.parsedDate); lpDate.setHours(0, 0, 0, 0); daysSinceLastPayment = Math.floor((today.getTime() - lpDate.getTime()) / 86400000); }
      return { customerName, totalPayments, paymentCount, payments: sorted, lastPayment, daysSinceLastPayment };
    }).sort((a, b) => b.totalPayments - a.totalPayments);
  }, [visiblePayments, activeSubTab]);

  const paymentsByPeriod = useMemo<PaymentByPeriod[]>(() => {
    if (activeSubTab !== 'period') return [];
    const grouped = new Map<string, PaymentEntry[]>();
    visiblePayments.forEach(p => {
      if (!p.parsedDate) return;
      let key = periodType === 'daily' ? getDailyKey(p.parsedDate) : periodType === 'weekly' ? getWeeklyKey(p.parsedDate) : periodType === 'monthly' ? getMonthlyKey(p.parsedDate) : getYearlyKey(p.parsedDate);
      if (!grouped.has(key)) grouped.set(key, []); grouped.get(key)!.push(p);
    });
    return Array.from(grouped.entries()).map(([key, list]) => ({ period: formatPeriodLabel(key, periodType), periodKey: key, totalPayments: list.reduce((s, p) => s + p.credit, 0), paymentCount: list.filter(p => p.rawCredit > 0.01).length, payments: list.sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0)) }))
      .sort((a, b) => periodType === 'daily' ? (b.payments[0]?.parsedDate?.getTime() || 0) - (a.payments[0]?.parsedDate?.getTime() || 0) : b.periodKey.localeCompare(a.periodKey));
  }, [visiblePayments, periodType, activeSubTab]);

  const filteredByCustomer = useMemo(() => {
    let filtered = paymentsByCustomer;
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      filtered = filtered.filter((item) => item.customerName.toLowerCase().includes(s));
    }
    return [...filtered].sort((a, b) => {
      let av, bv;
      switch (sortColumn) {
        case 'customerName': av = a.customerName.toLowerCase(); bv = b.customerName.toLowerCase(); break;
        case 'totalPayments': av = a.totalPayments; bv = b.totalPayments; break;
        case 'paymentCount': av = a.paymentCount; bv = b.paymentCount; break;
        case 'lastPayment': av = a.lastPayment?.parsedDate?.getTime() || 0; bv = b.lastPayment?.parsedDate?.getTime() || 0; break;
        case 'daysSince': av = a.daysSinceLastPayment ?? Infinity; bv = b.daysSinceLastPayment ?? Infinity; break;
        default: return 0;
      }
      return (av < bv ? -1 : 1) * (sortDirection === 'asc' ? 1 : -1);
    });
  }, [paymentsByCustomer, debouncedSearch, sortColumn, sortDirection]);

  const customerTotals = useMemo(() => filteredByCustomer.reduce((acc, item) => ({ totalPayments: acc.totalPayments + item.totalPayments, paymentCount: acc.paymentCount + item.paymentCount }), { totalPayments: 0, paymentCount: 0 }), [filteredByCustomer]);
  const periodTotals = useMemo(() => (paymentsByPeriod).reduce((acc, item) => ({ totalPayments: acc.totalPayments + item.totalPayments, paymentCount: acc.paymentCount + item.paymentCount, customerCount: acc.customerCount + new Set(item.payments.map(p => p.customerName.trim().toLowerCase())).size }), { totalPayments: 0, paymentCount: 0, customerCount: 0 }), [paymentsByPeriod]);

  const customerDetailPayments = useMemo(() => (selectedCustomer ? visiblePayments.filter(p => p.customerName.trim().toLowerCase() === selectedCustomer.customerName.trim().toLowerCase()) : []), [visiblePayments, selectedCustomer]);
  const customerChartData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const empty = {
      chartData: monthNames.map((name, monthIndex) => ({
        name,
        monthIndex,
        amount: 0,
        lastYearAmount: 0,
        count: 0,
      })),
      currentYear: new Date().getFullYear(),
      previousYear: new Date().getFullYear() - 1,
    };

    if (!selectedCustomer) return empty;

    const customerKey = selectedCustomer.customerName.trim().toLowerCase();
    const searchLower = debouncedSearch.toLowerCase().trim();

    // Use full scoped ledger (not date-filtered) so YoY comparison has both years
    let rows = effectiveData.filter((row) => {
      const t = getInvoiceType(row);
      if (t !== 'Payment' && t !== 'R-Payment') return false;
      if (row.customerName?.trim().toLowerCase() !== customerKey) return false;
      if (selectedSalesRep && row.salesRep?.trim() !== selectedSalesRep) return false;
      if (
        searchLower &&
        !row.customerName?.toLowerCase().includes(searchLower) &&
        !row.number?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
      return true;
    });

    const parsedRows = rows
      .map((row) => ({
        date: parseDate(row.date),
        credit: (row.credit || 0) - (row.debit || 0),
        rawCredit: row.credit || 0,
      }))
      .filter((row) => row.date);

    const paymentYears = new Set<number>();
    parsedRows.forEach((p) => {
      if (p.date) paymentYears.add(p.date.getFullYear());
    });

    const chartYearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : NaN;
    let currentYear =
      !Number.isNaN(chartYearNum) && chartYearNum > 1900
        ? chartYearNum
        : paymentYears.size > 0
          ? Math.max(...Array.from(paymentYears))
          : new Date().getFullYear();

    let previousYear = currentYear - 1;
    if (!paymentYears.has(previousYear)) {
      const earlier = Array.from(paymentYears)
        .filter((y) => y < currentYear)
        .sort((a, b) => b - a);
      if (earlier.length > 0) previousYear = earlier[0];
    }

    const buckets = monthNames.map((name, monthIndex) => ({
      name,
      monthIndex,
      amount: 0,
      lastYearAmount: 0,
      count: 0,
    }));

    parsedRows.forEach((p) => {
      if (!p.date) return;
      const year = p.date.getFullYear();
      const monthIndex = p.date.getMonth();
      if (monthIndex < 0 || monthIndex > 11) return;
      const bucket = buckets[monthIndex];
      if (year === currentYear) {
        bucket.amount += p.credit || 0;
        if ((p.rawCredit || 0) > 0.01) bucket.count += 1;
      } else if (year === previousYear) {
        bucket.lastYearAmount += p.credit || 0;
      }
    });

    return {
      chartData: buckets.map((b) => ({
        ...b,
        amount: Math.round(b.amount * 100) / 100,
        lastYearAmount: Math.round(b.lastYearAmount * 100) / 100,
      })),
      currentYear,
      previousYear,
    };
  }, [selectedCustomer, effectiveData, selectedSalesRep, debouncedSearch, chartYear]);

  const customerAvgDays = useMemo(() => {
    if (!selectedCustomer || !customerDetailPayments.length) return 0;
    const sorted = [...customerDetailPayments].filter(p => p.parsedDate).sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());
    if (sorted.length < 2) return 0;
    const ints = []; for (let i = 1; i < sorted.length; i++) { const diff = (sorted[i].parsedDate!.getTime() - sorted[i - 1].parsedDate!.getTime()) / 86400000; if (diff > 0) ints.push(diff); }
    return ints.length === 0 ? 0 : ints.reduce((a, b) => a + b, 0) / ints.length;
  }, [selectedCustomer, customerDetailPayments]);

  const periodDetailPayments = useMemo(() => {
    if (!selectedPeriod) return [];
    return visiblePayments.filter(p => {
      if (!p.parsedDate) return false;
      const key = periodType === 'daily' ? getDailyKey(p.parsedDate) : periodType === 'weekly' ? getWeeklyKey(p.parsedDate) : periodType === 'monthly' ? getMonthlyKey(p.parsedDate) : getYearlyKey(p.parsedDate);
      return key === selectedPeriod.periodKey;
    }).sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0));
  }, [visiblePayments, selectedPeriod, periodType]);

  const areaStats = useMemo(() => {
    if (activeSubTab !== 'area') return [];
    const statsByRep = new Map<string, any>();
    visiblePayments.forEach(p => {
      const r = p.salesRep?.trim() || 'Unknown', net = p.credit;
      if (!statsByRep.has(r)) statsByRep.set(r, { repName: r, totalCollected: 0, paymentCount: 0, payments: [] });
      const s = statsByRep.get(r)!; s.totalCollected += net; s.paymentCount += 1; if (p.parsedDate) s.payments.push({ date: p.parsedDate });
    });
    return Array.from(statsByRep.values()).map(s => {
      const avgPaymentAmount = s.paymentCount > 0 ? s.totalCollected / s.paymentCount : 0;
      let avgCollectionDays = 0; if (s.payments.length > 1) { s.payments.sort((a: any, b: any) => a.date.getTime() - b.date.getTime()); let totalD = 0, countD = 0; for (let i = 1; i < s.payments.length; i++) { totalD += Math.ceil(Math.abs(s.payments[i].date.getTime() - s.payments[i - 1].date.getTime()) / 86400000); countD++; } avgCollectionDays = countD > 0 ? totalD / countD : 0; }
      return { ...s, avgPaymentAmount, avgCollectionDays };
    }).sort((a, b) => b.totalCollected - a.totalCollected);
  }, [visiblePayments, activeSubTab]);

  const totalFilteredPayments = useMemo(() => {
    const sLower = debouncedSearch.toLowerCase().trim();
    let relevant = sLower ? visiblePayments.filter(p => p.customerName.toLowerCase().includes(sLower) || (activeSubTab !== 'customer' && p.number.toLowerCase().includes(sLower))) : visiblePayments;
    return relevant.reduce((s, p) => s + (p.credit || 0), 0);
  }, [visiblePayments, debouncedSearch, activeSubTab]);

  return {
    // States
    activeSubTab, setActiveSubTab,
    periodType, setPeriodType,
    chartPeriodType, setChartPeriodType,
    chartYear, setChartYear,
    chartMonth, setChartMonth,
    search, setSearch,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    selectedSalesRep, setSelectedSalesRep,
    sortColumn, setSortColumn,
    sortDirection, setSortDirection,
    isPdfExportOpen, setIsPdfExportOpen,
    pdfExportSections, setPdfExportSections,
    pdfSelectedCustomers, setPdfSelectedCustomers,
    isCustomerSelectionOpen, setIsCustomerSelectionOpen,
    checklistSearch, setChecklistSearch,
    isTagsPickerOpen, setIsTagsPickerOpen,
    selectedCustomerTags, setSelectedCustomerTags,
    selectedCustomer, setSelectedCustomer,
    selectedPeriod, setSelectedPeriod,
    detailMode, setDetailMode,
    lastPeriodSelection, setLastPeriodSelection,
    lastCustomerSelection, setLastCustomerSelection,

    // Memos
    salesReps,
    allCustomers,
    allCustomerTags,
    effectiveData,
    filteredCustomerChecklist,
    dashboardData,
    averageCollections,

    visiblePayments,
    filteredByCustomer,
    paymentsByPeriod,
    customerTotals,
    periodTotals,
    customerDetailPayments,
    customerChartData,
    customerAvgDays,
    periodDetailPayments,
    areaStats,
    totalFilteredPayments,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  };
}
