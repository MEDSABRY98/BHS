'use client';

import { useMemo, useState } from 'react';
import { InvoiceRow } from '@/types';
import { getInvoiceType } from '@/lib/InvoiceType';
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
    daily: true,
    weekly: true,
    monthly: true,
    customerList: true,
    gapAnalysis: true,
    salesRep: true
  });
  const [pdfSelectedCustomers, setPdfSelectedCustomers] = useState<Set<string>>(new Set());
  const [isCustomerSelectionOpen, setIsCustomerSelectionOpen] = useState(false);
  const [checklistSearch, setChecklistSearch] = useState('');

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

  const allCustomers = useMemo(() => {
    return Array.from(new Set(
      data
        .filter(row => {
          const t = getInvoiceType(row);
          return t === 'Payment' || t === 'R-Payment';
        })
        .map(p => p.customerName)
    )).sort();
  }, [data]);

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
      data.forEach(row => {
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
      data.forEach(row => {
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
  }, [data, chartYear, chartMonth, dateFrom, dateTo]);

  const dashboardData = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
    const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;

    const periodStats = new Map<string, any>();
    const allTimeStats = new Map<string, number>();

    if (chartPeriodType === 'weekly') {
      const weekKeys = new Set<string>();
      let iterDate = new Date(startDate);
      while (iterDate <= endDate) {
        weekKeys.add(getWeeklyKey(iterDate));
        iterDate = new Date(iterDate);
        iterDate.setDate(iterDate.getDate() + 1);
      }
      Array.from(weekKeys).sort().forEach(key => {
        periodStats.set(key, { periodLabel: formatPeriodLabel(key, 'weekly'), periodKey: key, grossSales: 0, returns: 0, discounts: 0, collections: 0, paymentCount: 0, customerSet: new Set() });
      });
    } else {
      let iterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (iterDate <= endDate) {
        const key = getMonthlyKey(iterDate);
        periodStats.set(key, { 
          periodLabel: formatPeriodLabel(key, 'monthly'), 
          periodKey: key, 
          grossSales: 0, 
          returns: 0, 
          discounts: 0, 
          collections: 0, 
          paymentCount: 0, 
          customerSet: new Set() 
        });
        iterDate = new Date(iterDate);
        iterDate.setMonth(iterDate.getMonth() + 1);
      }
    }

    const searchLower = search.toLowerCase().trim();
    let filteredData = searchLower ? data.filter(row => row.customerName?.toLowerCase().includes(searchLower) || row.number?.toLowerCase().includes(searchLower)) : data;
    if (selectedSalesRep) filteredData = filteredData.filter(row => row.salesRep?.trim() === selectedSalesRep);

    filteredData.forEach(row => {
      const d = parseDate(row.date);
      if (!d) return;

      const key = chartPeriodType === 'weekly' ? getWeeklyKey(d) : getMonthlyKey(d);
      const type = getInvoiceType(row);
      const debit = row.debit || 0;
      const credit = row.credit || 0;

      if (type === 'Payment' || type === 'R-Payment') {
        const netAmount = credit - debit;
        allTimeStats.set(key, (allTimeStats.get(key) || 0) + netAmount);

        if (d >= startDate && d <= endDate) {
          const stats = periodStats.get(key);
          if (stats) {
            stats.collections += netAmount;
            if (netAmount > 0.001) {
              stats.paymentCount += 1;
              if (row.customerName) stats.customerSet.add(row.customerName.trim());
            }
          }
        }
      } else if (d >= startDate && d <= endDate) {
        const stats = periodStats.get(key);
        if (stats) {
          if (type === 'Sale') stats.grossSales += debit;
          else if (type === 'Return') { stats.returns += credit; if (debit < 0) stats.returns += Math.abs(debit); }
          else if (type === 'Discount') { stats.discounts += credit; if (debit < 0) stats.discounts += Math.abs(debit); }
        }
      }
    });

    const result = Array.from(periodStats.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey)).map(item => {
      const netSales = item.grossSales - item.returns;

      // Calculate last year key for comparison
      let lastYearKey = '';
      if (chartPeriodType === 'weekly') {
        const [y, w] = item.periodKey.split('-W');
        lastYearKey = `${parseInt(y) - 1}-W${w}`;
      } else {
        const [y, m] = item.periodKey.split('-');
        lastYearKey = `${parseInt(y) - 1}-${m}`;
      }
      const lastYearCollections = allTimeStats.get(lastYearKey) || 0;

      return {
        ...item,
        netSales,
        netSalesMinusDiscounts: netSales - item.discounts,
        displaySales: Math.round((netSales - item.discounts) * 100) / 100,
        displayCollections: Math.round(item.collections * 100) / 100,
        lastYearCollections: Math.round(lastYearCollections * 100) / 100,
        paymentCount: item.paymentCount,
        customerCount: item.customerSet.size
      };
    });

    return {
      chartData: result,
      totals: {
        totalNetSalesMinusDiscounts: result.reduce((sum, i) => sum + i.netSalesMinusDiscounts, 0),
        totalCollections: result.reduce((sum, i) => sum + i.collections, 0),
        difference: result.reduce((sum, i) => sum + i.netSalesMinusDiscounts, 0) - result.reduce((sum, i) => sum + i.collections, 0),
        netPaymentCount: result.reduce((sum, i) => sum + i.paymentCount, 0)
      }
    };
  }, [data, dateFrom, dateTo, search, selectedSalesRep, chartPeriodType, chartYear, chartMonth]);

  const averageCollections = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
    const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;
    let startDate, endDate;
    if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
      const y = yearNum && !isNaN(yearNum) ? yearNum : new Date().getFullYear();
      if (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) { startDate = new Date(y, monthNum - 1, 1); endDate = new Date(y, monthNum, 0); }
      else { startDate = new Date(y, 0, 1); endDate = new Date(y, 11, 31); }
      endDate.setHours(23, 59, 59, 999);
    } else if (dateFrom || dateTo) {
      const fromDate = dateFrom ? parseDate(dateFrom) : null;
      const toDate = dateTo ? parseDate(dateTo) : null;
      if (fromDate && toDate) { startDate = fromDate; startDate.setHours(0, 0, 0, 0); endDate = new Date(toDate); endDate.setHours(23, 59, 59, 999); }
      else if (fromDate) { startDate = fromDate; startDate.setHours(0, 0, 0, 0); endDate = new Date(); endDate.setHours(23, 59, 59, 999); }
      else if (toDate) { endDate = new Date(toDate); endDate.setHours(23, 59, 59, 999); startDate = new Date(0); }
      else { const today = new Date(); endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1); }
    } else {
      let maxDate = new Date(0);
      data.forEach(row => { if (getInvoiceType(row) === 'Payment' || getInvoiceType(row) === 'R-Payment') { const d = parseDate(row.date); if (d && d > maxDate) maxDate = d; } });
      if (maxDate.getTime() === 0) maxDate = new Date();
      endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0); startDate = new Date(maxDate.getFullYear(), maxDate.getMonth() - 11, 1);
    }

    let filteredPayments = data.filter((row) => {
      const t = getInvoiceType(row);
      if (t !== 'Payment' && t !== 'R-Payment') return false;
      if (selectedSalesRep && row.salesRep?.trim() !== selectedSalesRep) return false;
      const d = parseDate(row.date);
      if (!d || d < startDate || d > endDate) return false;
      if (searchLower && !row.customerName?.toLowerCase().includes(searchLower) && !row.number?.toLowerCase().includes(searchLower)) return false;
      return true;
    });

    const monthlyTotals = new Map<string, number>();
    const weeklyTotals = new Map<string, number>();
    filteredPayments.forEach((row) => {
      const d = parseDate(row.date);
      if (d) {
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const amount = (row.credit || 0) - (row.debit || 0);
        monthlyTotals.set(yearMonth, (monthlyTotals.get(yearMonth) || 0) + amount);
        const year = d.getFullYear(), startOfYear = new Date(year, 0, 1), days = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000), week = Math.floor(days / 7), weekKey = `${year}-W${String(week).padStart(2, '0')}`;
        weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + amount);
      }
    });

    const totalMonthly = Array.from(monthlyTotals.values()).reduce((s, v) => s + v, 0);
    const totalWeekly = Array.from(weeklyTotals.values()).reduce((s, v) => s + v, 0);
    const monthsCount = Math.max(1, monthlyTotals.size), weeksCount = Math.max(1, weeklyTotals.size);
    return { averageMonthly: totalMonthly / monthsCount, averageWeekly: totalWeekly / weeksCount, monthsCount, weeksCount };
  }, [data, selectedSalesRep, search, dateFrom, dateTo, chartYear, chartMonth]);

  const averageCollectionDays = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    let filteredPayments = data.filter((row) => {
      const t = getInvoiceType(row);
      if (t !== 'Payment' && t !== 'R-Payment') return false;
      if (selectedSalesRep && row.salesRep?.trim() !== selectedSalesRep) return false;
      const yearNum = chartYear.trim() ? parseInt(chartYear.trim(), 10) : null;
      const monthNum = chartMonth.trim() ? parseInt(chartMonth.trim(), 10) : null;
      const today = new Date();
      let startDate, endDate;
      if ((yearNum && !isNaN(yearNum)) || (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12)) {
        const y = yearNum && !isNaN(yearNum) ? yearNum : new Date().getFullYear();
        if (monthNum && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) { startDate = new Date(y, monthNum - 1, 1); endDate = new Date(y, monthNum, 0); }
        else { startDate = new Date(y, 0, 1); endDate = new Date(y, 11, 31); }
        endDate.setHours(23, 59, 59, 999);
      } else if (dateFrom || dateTo) {
        const fromDate = dateFrom ? parseDate(dateFrom) : null, toDate = dateTo ? parseDate(dateTo) : null;
        if (fromDate && toDate) { startDate = fromDate; startDate.setHours(0, 0, 0, 0); endDate = new Date(toDate); endDate.setHours(23, 59, 59, 999); }
        else if (fromDate) { startDate = fromDate; startDate.setHours(0, 0, 0, 0); endDate = new Date(); endDate.setHours(23, 59, 59, 999); }
        else if (toDate) { endDate = new Date(toDate); endDate.setHours(23, 59, 59, 999); startDate = new Date(0); }
        else { endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1); }
      } else { endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1); }
      const d = parseDate(row.date);
      if (!d || d < startDate || d > endDate) return false;
      if (searchLower && !row.customerName?.toLowerCase().includes(searchLower) && !row.number?.toLowerCase().includes(searchLower)) return false;
      return true;
    });

    const paymentsByCust = new Map<string, any[]>();
    filteredPayments.forEach((row) => {
      const d = parseDate(row.date);
      const cust = row.customerName?.trim() || '';
      if (!d || !cust) return;
      if (!paymentsByCust.has(cust)) paymentsByCust.set(cust, []);
      paymentsByCust.get(cust)!.push({ date: d, amount: (row.credit || 0) - (row.debit || 0) });
    });

    const customerAverages: number[] = [];
    paymentsByCust.forEach((payments) => {
      if (payments.length < 2) return;
      payments.sort((a, b) => a.date.getTime() - b.date.getTime());
      const intervals = [];
      for (let i = 1; i < payments.length; i++) {
        const diff = Math.floor((payments[i].date.getTime() - payments[i - 1].date.getTime()) / 86400000);
        if (diff > 0) intervals.push(diff);
      }
      if (intervals.length > 0) customerAverages.push(intervals.reduce((s, d) => s + d, 0) / intervals.length);
    });
    return { averageDays: customerAverages.length > 0 ? customerAverages.reduce((s, a) => s + a, 0) / customerAverages.length : 0, customersCount: customerAverages.length, totalPayments: filteredPayments.length };
  }, [data, dateFrom, dateTo, selectedSalesRep, search, chartYear, chartMonth]);

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
    return data.filter(row => { const t = getInvoiceType(row); return (t === 'Payment' || t === 'R-Payment') && (!selectedSalesRep || row.salesRep?.trim() === selectedSalesRep); })
      .map(row => ({ date: row.date, number: row.number, customerName: row.customerName, type: getInvoiceType(row), credit: (row.credit || 0) - (row.debit || 0), rawCredit: row.credit || 0, debit: row.debit || 0, rawDebit: row.debit || 0, amountSource: 'creditMinusDebit' as any, salesRep: row.salesRep, matching: row.matching, parsedDate: parseDate(row.date) }))
      .filter(p => {
        if (!p.parsedDate) return false;
        if (useYearMonthFilter) { if (isYearValid && p.parsedDate.getFullYear() !== yearNum) return false; if (isMonthValid && p.parsedDate.getMonth() !== (monthNum! - 1)) return false; return true; }
        if (filterStartDate && p.parsedDate < filterStartDate) return false;
        if (filterEndDate && p.parsedDate > filterEndDate) return false;
        return true;
      });
  }, [data, dateFrom, dateTo, selectedSalesRep, chartYear, chartMonth]);

  const visiblePayments = useMemo<PaymentEntry[]>(() => {
    const searchLower = search.trim().toLowerCase();
    if (!searchLower) return payments;
    return payments.filter(p => (p.customerName || '').toLowerCase().includes(searchLower) || (p.number || '').toLowerCase().includes(searchLower));
  }, [payments, search]);

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
    if (search) { const s = search.toLowerCase(); filtered = filtered.filter(item => item.customerName.toLowerCase().includes(s)); }
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
  }, [paymentsByCustomer, search, sortColumn, sortDirection]);

  const customerTotals = useMemo(() => filteredByCustomer.reduce((acc, item) => ({ totalPayments: acc.totalPayments + item.totalPayments, paymentCount: acc.paymentCount + item.paymentCount }), { totalPayments: 0, paymentCount: 0 }), [filteredByCustomer]);
  const periodTotals = useMemo(() => (paymentsByPeriod).reduce((acc, item) => ({ totalPayments: acc.totalPayments + item.totalPayments, paymentCount: acc.paymentCount + item.paymentCount, customerCount: acc.customerCount + new Set(item.payments.map(p => p.customerName.trim().toLowerCase())).size }), { totalPayments: 0, paymentCount: 0, customerCount: 0 }), [paymentsByPeriod]);

  const customerDetailPayments = useMemo(() => (selectedCustomer ? visiblePayments.filter(p => p.customerName.trim().toLowerCase() === selectedCustomer.customerName.trim().toLowerCase()) : []), [visiblePayments, selectedCustomer]);
  const customerChartData = useMemo(() => {
    if (!selectedCustomer) return []; const today = new Date(), res = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1), y = d.getFullYear(), m = d.getMonth(), label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const pinm = customerDetailPayments.filter(p => p.parsedDate?.getFullYear() === y && p.parsedDate?.getMonth() === m);
      res.push({ name: label, amount: pinm.reduce((s, p) => s + p.credit, 0), count: pinm.filter(p => p.rawCredit > 0.01).length });
    }
    return res;
  }, [selectedCustomer, customerDetailPayments]);

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
    const sLower = search.toLowerCase().trim();
    let relevant = sLower ? visiblePayments.filter(p => p.customerName.toLowerCase().includes(sLower) || (activeSubTab !== 'customer' && p.number.toLowerCase().includes(sLower))) : visiblePayments;
    return relevant.reduce((s, p) => s + (p.credit || 0), 0);
  }, [visiblePayments, search, activeSubTab]);

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
    selectedCustomer, setSelectedCustomer,
    selectedPeriod, setSelectedPeriod,
    detailMode, setDetailMode,
    lastPeriodSelection, setLastPeriodSelection,
    lastCustomerSelection, setLastCustomerSelection,

    // Memos
    salesReps,
    allCustomers,
    filteredCustomerChecklist,
    dashboardData,
    averageCollections,
    averageCollectionDays,
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
