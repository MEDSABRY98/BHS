'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { InvoiceRow, CustomerAnalysis } from '@/types';
import CustomerDetails from './CustomerDetails';
import { generateAccountStatementPDF, generateBulkDebitSummaryPDF, generateBulkCustomerStatementsPDF } from '@/lib/pdfUtils';
import * as XLSX from 'xlsx';

interface CustomersTabProps {
  data: InvoiceRow[];
  mode?: 'DEBIT' | 'OB_POS' | 'OB_NEG';
  onBack?: () => void;
  initialCustomer?: string;
}

const columnHelper = createColumnHelper<CustomerAnalysis>();

// Helper function to copy text to clipboard (works in all browsers)
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Fallback for DD/MM/YYYY
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);
    // Assuming DD/MM/YYYY if first part > 12 or generally preferred
    if (p1 > 12 || (p3 > 31)) { // rudimentary check
      return new Date(p3, p2 - 1, p1);
    }
    // If ambiguous, maybe try standard MM/DD/YYYY? 
    // Let's stick to what new Date() couldn't parse.
  }
  return null;
}

const formatDmy = (date?: Date | null) => {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper functions for monthly breakdown
const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const formatMonthLabel = (key: string) => {
  const [year, month] = key.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = monthNames[monthIndex] || month;
  return `${monthName}${year.slice(-2)}`;
};

// Calculate monthly breakdown for a customer (similar to CustomersByMonthsTab)
const calculateCustomerMonthlyBreakdown = (customerName: string, invoices: InvoiceRow[]) => {
  const customerInvoices = invoices.filter(row => row.customerName === customerName);

  // 1) Prepare matching residuals
  const matchingTotals = new Map<string, number>();
  const maxDebits = new Map<string, number>();
  const mainInvoiceIndices = new Map<string, number>();

  customerInvoices.forEach((inv, idx) => {
    if (inv.matching) {
      const net = inv.debit - inv.credit;
      matchingTotals.set(inv.matching, (matchingTotals.get(inv.matching) || 0) + net);

      const currentMax = maxDebits.get(inv.matching) ?? -1;
      if (inv.debit > currentMax) {
        maxDebits.set(inv.matching, inv.debit);
        mainInvoiceIndices.set(inv.matching, idx);
      } else if (!mainInvoiceIndices.has(inv.matching)) {
        maxDebits.set(inv.matching, inv.debit);
        mainInvoiceIndices.set(inv.matching, idx);
      }
    }
  });

  // 2) Build open items (unmatched or residual holder)
  const openItems: { date: Date | null; amount: number }[] = [];

  customerInvoices.forEach((inv, idx) => {
    const netDebt = inv.debit - inv.credit;
    let residual: number | undefined;

    if (inv.matching && mainInvoiceIndices.get(inv.matching) === idx) {
      const total = matchingTotals.get(inv.matching) || 0;
      if (Math.abs(total) > 0.01) residual = total;
    }

    let amountToUse: number | null = null;
    if (!inv.matching && Math.abs(netDebt) > 0.01) {
      amountToUse = netDebt;
    } else if (residual !== undefined && Math.abs(residual) > 0.01) {
      amountToUse = residual;
    }

    if (amountToUse !== null) {
      const d = parseDate(inv.date);
      openItems.push({ date: d, amount: amountToUse });
    }
  });

  // 3) Aggregate by month using open amounts only
  const monthsMap = new Map<string, number>();
  let netTotal = 0;

  openItems.forEach(({ date, amount }) => {
    if (!date) return;
    const key = formatMonthKey(date);
    monthsMap.set(key, (monthsMap.get(key) || 0) + amount);
    netTotal += amount;
  });

  const monthEntries = Array.from(monthsMap.entries())
    .map(([key, amount]) => ({
      key,
      amount,
      label: `${formatMonthLabel(key)} (${Math.round(amount).toLocaleString('en-US')})`,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return { months: monthEntries, netTotal };
};

const calculateDebtRating = (customer: CustomerAnalysis, closedCustomersSet: Set<string>, returnBreakdown: boolean = false): 'Good' | 'Medium' | 'Bad' | any => {
  // 🎯 أولاً: التحقق من شيت CLOSED - عمل xlookup باسم العميل
  // لو لقيته في الشيت → Bad فوراً بدون أي حسابات أخرى
  // Normalize: lowercase, trim, and normalize whitespace only (exact match - keep punctuation, same as in getClosedCustomers)
  const customerNameNormalized = customer.customerName.toLowerCase().trim().replace(/\s+/g, ' ');

  // التحقق من وجود الاسم في القائمة (مقارنة دقيقة - exact match)
  const isClosed = closedCustomersSet.has(customerNameNormalized);

  // لو المحل مغلق، الدين سيء فوراً بدون أي حسابات أخرى
  if (isClosed) {
    if (returnBreakdown) {
      return {
        rating: 'Bad',
        reason: 'Closed',
        isClosed: true,
        breakdown: null
      };
    }
    return 'Bad';
  }

  // تعريف المتغيرات (LET function)
  const netDebt = customer.netDebt;
  const collRate = customer.totalDebit > 0 ? (customer.totalCredit / customer.totalDebit) : 0;
  const lastPay = customer.lastPaymentDate;
  const payCount = (customer as any).paymentsCount3m || 0;
  const payments90d = (customer as any).payments3m || 0; // قيمة المدفوعات آخر 90 يوم
  const sales90d = (customer as any).sales3m || 0; // صافي المبيعات آخر 90 يوم (SAL debits)
  const lastSale = customer.lastSalesDate;
  const salesCount = (customer as any).salesCount3m || 0;

  // 🎯 ثانياً: مؤشرات الخطر Risk Flags
  // riskFlag1: صافي المبيعات آخر 90 يوم سالب + عدد المدفوعات = 0
  const riskFlag1 = sales90d < 0 && payCount === 0 ? 1 : 0;

  // riskFlag2: مفيش دفع آخر 90 يوم + مفيش بيع آخر 90 يوم + عليه دين موجب
  const riskFlag2 = payCount === 0 && salesCount === 0 && netDebt > 0 ? 1 : 0;

  // 🎯 ثالثاً: نظام النقاط (5 مستويات × نقطتين)

  // score1 — تقييم صافي المديونية Net Debt
  let score1 = 0;
  if (netDebt < 0) {
    score1 = 2; // العميل ليه عندك فلوس
  } else if (netDebt <= 5000) {
    score1 = 2;
  } else if (netDebt <= 20000) {
    score1 = 1;
  } else {
    score1 = 0; // > 20000
  }

  // score2 — تقييم نسبة التحصيل Collection Rate %
  let score2 = 0;
  if (collRate >= 0.8) { // >= 80%
    score2 = 2;
  } else if (collRate >= 0.5) { // بين 50–79%
    score2 = 1;
  } else {
    score2 = 0; // < 50%
  }

  // score3 — تقييم آخر دفعة Last Payment Date
  let score3 = 0;
  if (lastPay) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastPayDate = new Date(lastPay);
    lastPayDate.setHours(0, 0, 0, 0);
    const daysSinceLastPay = Math.floor((today.getTime() - lastPayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastPay <= 30) {
      score3 = 2; // دفع خلال الشهر الأخير
    } else if (daysSinceLastPay <= 90) {
      score3 = 1; // دفع خلال آخر 90 يوم
    } else {
      score3 = 0; // أكتر من 90 يوم
    }
  } else {
    score3 = 0; // لو "-" → 0
  }

  // score4 — تقييم عدد المدفوعات آخر 90 يوم
  let score4 = 0;
  if (payCount >= 2) {
    score4 = 2; // مرتين أو أكتر
  } else if (payCount === 1) {
    score4 = 1; // مرة واحدة
  } else {
    score4 = 0; // صفر
  }

  // score5 — تقييم آخر عملية بيع Last Sale Date
  let score5 = 0;
  if (lastSale) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastSaleDate = new Date(lastSale);
    lastSaleDate.setHours(0, 0, 0, 0);
    const daysSinceLastSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastSale <= 30) {
      score5 = 2; // شراء خلال الشهر الأخير
    } else if (daysSinceLastSale <= 90) {
      score5 = 1; // شراء خلال 90 يوم
    } else {
      score5 = 0; // أكتر من 90 يوم
    }
  } else {
    score5 = 0; // لو "-" → 0
  }

  // score6 — تقييم قيمة المدفوعات آخر 90 يوم
  let score6 = 0;
  if (payments90d >= 10000) {
    score6 = 2;
  } else if (payments90d >= 2000) {
    score6 = 1;
  } else {
    score6 = 0;
  }

  // score7 — تقييم قيمة المبيعات آخر 90 يوم
  let score7 = 0;
  if (sales90d >= 10000) {
    score7 = 2;
  } else if (sales90d >= 2000) {
    score7 = 1;
  } else {
    score7 = 0;
  }

  // score8 — تقييم عدد المبيعات آخر 90 يوم
  let score8 = 0;
  if (salesCount >= 2) {
    score8 = 2;
  } else if (salesCount === 1) {
    score8 = 1;
  } else {
    score8 = 0;
  }

  const totalScore = score1 + score2 + score3 + score4 + score5 + score6 + score7 + score8;

  // 🎯 رابعاً: حساب التقييم النهائي
  let finalRating: 'Good' | 'Medium' | 'Bad';
  let reason = '';

  if (netDebt < 0) {
    finalRating = 'Good';
    reason = 'Account in Credit';
  }
  // 2️⃣ بعدها: لو أي RiskFlag = 1 → Bad
  else if (riskFlag1 === 1 || riskFlag2 === 1) {
    finalRating = 'Bad';
    if (riskFlag1 === 1) {
      reason = 'Risk Indicator 1: Negative sales & zero payments (90d)';
    } else {
      reason = 'Risk Indicator 2: No activity with outstanding debt (90d)';
    }
  }
  // 3️⃣ آخر خطوة: تقييم النقاط
  else {
    if (totalScore >= 11) {
      finalRating = 'Good'; // 11–16 → Good
      reason = '';
    } else if (totalScore >= 6) {
      finalRating = 'Medium'; // 6-10 → Medium
      reason = '';
    } else {
      finalRating = 'Bad'; // ≤5 → Bad
      reason = '';
    }
  }

  if (returnBreakdown) {
    return {
      rating: finalRating,
      reason,
      isClosed: false,
      breakdown: {
        netDebt,
        collRate: collRate * 100,
        lastPay: lastPay ? formatDmy(lastPay) : '-',
        payCount,
        payments90d,
        sales90d,
        lastSale: lastSale ? formatDmy(lastSale) : '-',
        salesCount,
        riskFlags: {
          riskFlag1,
          riskFlag2
        },
        scores: {
          score1,
          score2,
          score3,
          score4,
          score5,
          score6,
          score7,
          score8
        },
        totalScore,
        maxPossibleScore: 16
      }
    };
  }

  return finalRating;
};

// Helper to identify payment transactions consistently
const isPaymentTxn = (inv: { number?: string | null; credit?: number | null }): boolean => {
  const num = (inv.number?.toString() || '').toUpperCase();
  if (num.startsWith('BNK')) return true;
  // PBNK with Debit is 'Our-Paid' (excluded from payment stats), PBNK with Credit is 'Payment'
  if (num.startsWith('PBNK')) {
    return (inv.credit || 0) > 0.01;
  }

  if ((inv.credit || 0) <= 0.01) return false;
  return (
    !num.startsWith('SAL') &&
    !num.startsWith('RSAL') &&
    !num.startsWith('BIL') &&
    !num.startsWith('JV') &&
    !num.startsWith('OB')
  );
};

// Helper to calculate payment amount consistently (Credit - Debit)
const getPaymentAmount = (inv: { credit?: number | null; debit?: number | null }): number => {
  const credit = inv.credit || 0;
  const debit = inv.debit || 0;
  return credit - debit;
};

// Helper function to get overdue months for a customer
const getOverdueMonths = (customerName: string, invoices: InvoiceRow[]): string => {
  const customerInvoices = invoices.filter(row => row.customerName === customerName);

  // Group invoices by matching to calculate residuals
  const matchingGroups = new Map<string, InvoiceRow[]>();
  customerInvoices.forEach(inv => {
    const key = inv.matching || 'UNMATCHED';
    const group = matchingGroups.get(key) || [];
    group.push(inv);
    matchingGroups.set(key, group);
  });

  // Calculate residual for each matching group
  const matchingResiduals = new Map<string, { residual: number; residualHolderIndex: number }>();
  matchingGroups.forEach((group, matchingKey) => {
    if (matchingKey === 'UNMATCHED') return;

    let groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
    if (Math.abs(groupNetDebt) <= 0.01) return;

    let maxDebit = -1;
    let residualHolderIndex = 0;
    group.forEach((inv, idx) => {
      if (inv.debit > maxDebit) {
        maxDebit = inv.debit;
        residualHolderIndex = idx;
      }
    });

    matchingResiduals.set(matchingKey, {
      residual: groupNetDebt,
      residualHolderIndex
    });
  });

  // Collect overdue SAL invoices (unmatched or with residual)
  const overdueSalesInvoices: InvoiceRow[] = [];

  matchingGroups.forEach((group, matchingKey) => {
    if (matchingKey === 'UNMATCHED') {
      // Unmatched invoices - check if SAL and has net debt
      group.forEach(inv => {
        const num = inv.number?.toString().toUpperCase() || '';
        if (num.startsWith('SAL')) {
          const invNetDebt = inv.debit - inv.credit;
          if (Math.abs(invNetDebt) > 0.01) {
            overdueSalesInvoices.push(inv);
          }
        }
      });
    } else {
      // Matched group - check if has residual
      const residual = matchingResiduals.get(matchingKey);
      if (residual && Math.abs(residual.residual) > 0.01) {
        // Get the residual holder invoice
        const residualHolder = group[residual.residualHolderIndex];
        const num = residualHolder.number?.toString().toUpperCase() || '';
        if (num.startsWith('SAL')) {
          overdueSalesInvoices.push(residualHolder);
        }
      }
    }
  });

  // Extract unique months from overdue SAL invoices with dates for sorting
  const monthMap = new Map<string, Date>();
  overdueSalesInvoices.forEach(inv => {
    const d = parseDate(inv.date);
    if (d) {
      // Create a key for year-month combination
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${month}`;

      // Store the date (use first day of month for comparison)
      if (!monthMap.has(key)) {
        monthMap.set(key, new Date(year, month, 1));
      }
    }
  });

  // Sort by date (oldest to newest)
  const sortedMonths = Array.from(monthMap.entries())
    .sort((a, b) => a[1].getTime() - b[1].getTime());

  // Format months with first letter capitalized only
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedMonths = sortedMonths.map(([key, date]) => {
    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${monthName}${year}`;
  });

  return formattedMonths.join(', ');
};

// Helper function to build invoices with net debt and residual (extracted for reuse)
const buildInvoicesWithNetDebtForExport = (invList: InvoiceRow[], spiData: Array<{ number: string, matching: string }> = []) => {
  // 1. Calculate totals for each matching group
  const matchingTotals = new Map<string, number>();
  invList.forEach((invoice) => {
    if (invoice.matching) {
      const current = matchingTotals.get(invoice.matching) || 0;
      matchingTotals.set(invoice.matching, current + (invoice.debit - invoice.credit));
    }
  });

  // 2. Identify which invoice should display the residual per matching group
  const matchingTargetIndex = new Map<string, number>();
  const maxDebits = new Map<string, number>(); // Track max debit per group
  const overrideIndices = new Map<string, number>(); // Track SPI overrides

  // Pre-scan for SPI Overrides
  if (spiData.length > 0) {
    invList.forEach((inv, index) => {
      if (inv.matching && inv.number) {
        const invNum = inv.number.toString().trim().toLowerCase();
        const matchCode = inv.matching.toString().trim().toLowerCase();
        const isOverride = spiData.some(s =>
          s.number.toString().trim().toLowerCase() === invNum &&
          s.matching.toString().trim().toLowerCase() === matchCode
        );
        if (isOverride) {
          overrideIndices.set(inv.matching, index);
        }
      }
    });
  }

  invList.forEach((invoice, index) => {
    if (!invoice.matching) return;

    // A. Check for Override
    if (overrideIndices.has(invoice.matching)) {
      matchingTargetIndex.set(invoice.matching, overrideIndices.get(invoice.matching)!);
      return;
    }

    // B. Default Logic: Largest Debit
    // Only proceed if we haven't already locked this group with an override?
    // Actually, since we iterate all invoices, if we found an override, we set it.
    // But we need to make sure we don't overwrite the override with a "larger debit" invoice later in the loop.
    // The previous block sets it once.
    // Here we should check: if override exists for this matching group, DO NOTHING.

    // However, the cleanest way is to separate the "find target" logic completely or check the map.
    // Let's rely on the fact that if overrideIndices has it, we use it. 
    // BUT we need to iterate to fill matchingTargetIndex for groups WITHOUT overrides.

    // Determine max debit logic
    const currentMax = maxDebits.get(invoice.matching) ?? -1;
    if ((invoice.debit || 0) > currentMax) {
      maxDebits.set(invoice.matching, invoice.debit);
      // Only update target if NO override exists
      if (!overrideIndices.has(invoice.matching)) {
        matchingTargetIndex.set(invoice.matching, index);
      }
    } else if (!matchingTargetIndex.has(invoice.matching) && !overrideIndices.has(invoice.matching)) {
      // Initialize for group if needed
      maxDebits.set(invoice.matching, invoice.debit);
      matchingTargetIndex.set(invoice.matching, index);
    }
  });

  // 3. Map invoices preserving original order
  return invList.map((invoice, index) => {
    let residual: number | undefined = undefined;

    if (invoice.matching) {
      const targetIndex = matchingTargetIndex.get(invoice.matching);
      if (targetIndex === index) {
        const total = matchingTotals.get(invoice.matching) || 0;
        if (Math.abs(total) > 0.01) {
          residual = total;
        }
      }
    }

    return {
      ...invoice,
      netDebt: invoice.debit - invoice.credit,
      residual,
    };
  });
};

const exportToPDF = async (data: CustomerAnalysis[], filename: string = 'customers_report', closedCustomersSet: Set<string> = new Set()) => {
  try {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const JSZip = (await import('jszip')).default;

    // Helper to generate a PDF Blob from a subset of data
    const generatePDFBlob = (pdfData: CustomerAnalysis[]): Blob => {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // 1. Group Data by Sales Rep (first one if multiple)
      const groupedData: Record<string, CustomerAnalysis[]> = {};
      pdfData.forEach(customer => {
        let rep = 'Unassigned';
        if (customer.salesReps && customer.salesReps.size > 0) {
          const reps = Array.from(customer.salesReps).sort();
          rep = reps[0];
        }
        if (!groupedData[rep]) {
          groupedData[rep] = [];
        }
        groupedData[rep].push(customer);
      });

      // 2. Sort Reps
      const sortedReps = Object.keys(groupedData).sort();

      const tableColumn = [
        'Customer Name',
        'City / Rep',
        'Total Debt',
        'Last Pay Date',
        'Last Pay Amt',
        'Pay (90d)',
        '# Pay (90d)',
        'Coll Rate (Pay)',
        'Last Sale Date',
        'Last Sale Amt',
        'Sales (90d)',
        '# Sales (90d)',
        'Rating'
      ];

      let isFirstPage = true;
      const ratingOrder = ['Good', 'Medium', 'Bad'];

      // 3. Iterate and Generate Pages
      for (const rep of sortedReps) {
        const groupData = groupedData[rep];

        // Pre-calculate ratings and group by rating
        const byRating: Record<string, CustomerAnalysis[]> = {
          'Good': [],
          'Medium': [],
          'Bad': []
        };

        groupData.forEach(customer => {
          const ratingInfo = calculateDebtRating(customer, closedCustomersSet, true);
          const rating = typeof ratingInfo === 'string' ? ratingInfo : ratingInfo.rating;
          if (byRating[rating]) {
            byRating[rating].push(customer);
          } else {
            byRating['Bad'].push(customer);
          }
        });

        for (const ratingLabel of ratingOrder) {
          const customersInRating = byRating[ratingLabel];
          if (customersInRating.length === 0) continue;

          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;

          // Header
          doc.setFontSize(16);
          const totalDebt = customersInRating.reduce((sum, c) => sum + c.netDebt, 0);
          const formattedDebt = totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          doc.text(`Customers Analysis Report - ${rep} (${ratingLabel}) - ${customersInRating.length} Customers - Total Debt: ${formattedDebt}`, 14, 15);
          doc.setFontSize(10);
          doc.text(`Date: ${formatDmy(new Date())}`, 14, 22);
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text('Tip: Ctrl+Click (Cmd+Click) on customer names to open in a new tab', 14, 26);
          doc.setTextColor(0);

          const tableRows = customersInRating.map(customer => {
            const ratingInfo = calculateDebtRating(customer, closedCustomersSet, true);
            const rating = typeof ratingInfo === 'string' ? ratingInfo : ratingInfo.rating;

            const payments = customer.creditPayments || 0;
            const totalSales = customer.totalDebit || 0;
            const collRatePay = totalSales > 0 ? ((payments / totalSales) * 100).toFixed(1) + '%' : '0.0%';

            const salesReps = customer.salesReps ? Array.from(customer.salesReps).join(', ') : '';

            return [
              customer.customerName,
              salesReps,
              customer.netDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              customer.lastPaymentDate ? formatDmy(customer.lastPaymentDate) : '-',
              customer.lastPaymentAmount ? customer.lastPaymentAmount.toLocaleString('en-US') : '-',
              (customer.payments3m || 0).toLocaleString('en-US'),
              customer.paymentsCount3m || 0,
              collRatePay,
              customer.lastSalesDate ? formatDmy(customer.lastSalesDate) : '-',
              customer.lastSalesAmount ? customer.lastSalesAmount.toLocaleString('en-US') : '-',
              (customer.sales3m || 0).toLocaleString('en-US'),
              customer.salesCount3m || 0,
              rating
            ];
          });

          autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            styles: { fontSize: 7, cellPadding: 2, halign: 'center', textColor: 0, fontStyle: 'bold' },
            headStyles: { fillColor: [75, 85, 99], halign: 'center', valign: 'middle', textColor: 255 },
            alternateRowStyles: { fillColor: [229, 231, 235] },
            didParseCell: (data) => {
              if (data.section === 'head') {
                const index = data.column.index;
                if (index >= 3 && index <= 7) data.cell.styles.fillColor = [37, 99, 235];
                else if (index >= 8 && index <= 11) data.cell.styles.fillColor = [234, 88, 12];
                else if (index === 12) data.cell.styles.fillColor = [147, 51, 234];
                else data.cell.styles.fillColor = [22, 163, 74];
              }
            },
            didDrawCell: (data) => {
              if (data.section === 'body' && data.column.index === 0 && data.row.index < customersInRating.length) {
                const customer = customersInRating[data.row.index];
                if (customer && customer.customerName) {
                  const url = `${window.location.origin}/debit?customer=${encodeURIComponent(customer.customerName)}&action=download_report`;
                  doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
                }
              }
            }
          });
        }
      }
      return doc.output('blob');
    };

    const zip = new JSZip();

    // 1. Generate Combined PDF
    const combinedBlob = generatePDFBlob(data);
    zip.file(`${filename}_Combined.pdf`, combinedBlob);

    // 2. Generate Individual PDFs per Rep
    const groupedData: Record<string, CustomerAnalysis[]> = {};
    data.forEach(customer => {
      let rep = 'Unassigned';
      if (customer.salesReps && customer.salesReps.size > 0) {
        const reps = Array.from(customer.salesReps).sort();
        rep = reps[0];
      }
      if (!groupedData[rep]) {
        groupedData[rep] = [];
      }
      groupedData[rep].push(customer);
    });

    for (const rep of Object.keys(groupedData)) {
      const repData = groupedData[rep];
      const repBlob = generatePDFBlob(repData);
      // Clean filename
      const safeRepName = rep.replace(/[^a-z0-9]/gi, '_').trim();
      zip.file(`${safeRepName}.pdf`, repBlob);
    }

    // 3. Generate and Save Zip
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${filename}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF');
  }
};

const exportToExcel = (data: CustomerAnalysis[], filename: string = 'customers_export', closedCustomersSet: Set<string> = new Set(), invoices: InvoiceRow[] = []) => {
  // Sheet 1: Customer Summary
  const summaryHeaders = [
    'Customer Name',
    'Sales Rep',
    'Net Debit',
    'Debt Rating',
    'Open OB',
    'Overdue Amount',
    'Overdue Months',
    'Collection Rate %',
    'Payment Rate %',
    'Return Rate %',
    'Discount Rate %',
    'Last Payment Date',
    'Last Payment Closure',
    'Payments Last 90d',
    'Payments Count Last 90d',
    'Net Sales',
    'Last Sales Date',
    'Sales Last 90d',
    'Sales Count Last 90d',
  ];

  const summaryRows = data.map(customer => {
    const collectionRate = customer.totalDebit > 0
      ? ((customer.totalCredit / customer.totalDebit) * 100).toFixed(2) + '%'
      : '0.00%';

    // Breakdown rates relative to Total Credit (Share of Collection)
    const creditDenom = customer.totalCredit || 0;
    const payRate = creditDenom > 0 ? ((customer.creditPayments || 0) / creditDenom * 100).toFixed(0) + '%' : '0%';
    const returnRate = creditDenom > 0 ? ((customer.creditReturns || 0) / creditDenom * 100).toFixed(0) + '%' : '0%';
    const discountRate = creditDenom > 0 ? ((customer.creditDiscounts || 0) / creditDenom * 100).toFixed(0) + '%' : '0%';

    const salesRep = customer.salesReps && customer.salesReps.size > 0
      ? Array.from(customer.salesReps).join(', ')
      : '';

    const rating = calculateDebtRating(customer, closedCustomersSet);
    const overdueMonths = getOverdueMonths(customer.customerName, invoices);

    return [
      customer.customerName || '',
      salesRep,
      customer.netDebt.toFixed(2) || '0.00',
      rating,
      (customer.openOBAmount || 0).toFixed(2),
      (customer.overdueAmount || 0).toFixed(2),
      overdueMonths,
      collectionRate,
      payRate,
      returnRate,
      discountRate,
      customer.lastPaymentDate ? formatDmy(customer.lastPaymentDate) : '',
      customer.lastPaymentClosure || 'Still Open',
      (customer as any).payments3m?.toFixed(2) || '0.00',
      (customer as any).paymentsCount3m ?? 0,
      (customer.netSales || 0).toFixed(2),
      customer.lastSalesDate ? formatDmy(customer.lastSalesDate) : '',
      (customer as any).sales3m?.toFixed(2) || '0.00',
      (customer as any).salesCount3m ?? 0,
    ];
  });

  // Sheet 2: Net Only Invoice Details
  const netOnlyHeaders = [
    'Customer Name',
    'Date',
    'Type',
    'Invoice Number',
    'Debit',
    'Credit',
    'Net Debt'
  ];

  const netOnlyRows: any[] = [];

  // Process each customer to get Net Only invoices
  for (const customer of data) {
    const customerInvoices = invoices.filter(row => row.customerName === customer.customerName);

    if (customerInvoices.length === 0) {
      continue;
    }

    // Build invoices with net debt and residual
    const invoicesWithNetDebt = buildInvoicesWithNetDebtForExport(customerInvoices);

    // Apply Net Only filter: Keep only unmatched invoices OR the single "residual holder" invoice for open matching groups
    const netOnlyInvoices = invoicesWithNetDebt
      .filter(inv => {
        // Keep if no matching ID (Unmatched)
        if (!inv.matching) return true;

        // Keep only if it carries the residual (which means it's the main open invoice of an open group)
        return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
      })
      .map(inv => {
        if (inv.matching && inv.residual !== undefined) {
          // It's a condensed open invoice
          // Calculate "Paid" amount to show in Credit
          // Credit = Debit - Residual
          return {
            ...inv,
            credit: inv.debit - inv.residual,
            netDebt: inv.residual
          };
        }
        return inv;
      });

    // Add rows for this customer
    netOnlyInvoices.forEach(inv => {
      const date = formatDmy(parseDate(inv.date));
      const type = getInvoiceType(inv);

      netOnlyRows.push([
        customer.customerName,
        date,
        type,
        inv.number || '',
        (inv.debit || 0).toFixed(2),
        (inv.credit || 0).toFixed(2),
        (inv.netDebt || 0).toFixed(2)
      ]);
    });
  }

  // Create Excel workbook with multiple sheets
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Customer Summary
  const summaryData = [summaryHeaders, ...summaryRows];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Customer Summary');

  // Sheet 2: Net Only Details
  if (netOnlyRows.length > 0) {
    const netOnlyData = [netOnlyHeaders, ...netOnlyRows];
    const netOnlySheet = XLSX.utils.aoa_to_sheet(netOnlyData);
    XLSX.utils.book_append_sheet(workbook, netOnlySheet, 'Net Only Details');
  }

  // Write and download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// Helper function to get invoice type
const getInvoiceType = (inv: { number?: string | null; credit?: number | null; debit?: number | null }): string => {
  const num = (inv.number || '').toUpperCase();
  const credit = inv.credit ?? 0;
  const debit = inv.debit ?? 0;

  if (num.startsWith('OB')) {
    return 'Opening Balance';
  } else if (num.startsWith('BNK')) {
    return 'Payment';
  } else if (num.startsWith('PBNK')) {
    return debit > 0.01 ? 'Our-Paid' : 'Payment';
  } else if (num.startsWith('SAL')) {
    return 'Sale';
  } else if (num.startsWith('RSAL')) {
    return 'Return';
  } else if (num.startsWith('JV') || num.startsWith('BIL')) {
    return 'Discount';
  } else if (credit > 0.01) {
    return 'Payment';
  }
  return 'Invoice/Txn';
};

export default function CustomersTab({ data, mode = 'DEBIT', onBack, initialCustomer }: CustomersTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(initialCustomer || null);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string | null>(null);
  const [initialCustomerTab, setInitialCustomerTab] = useState<'dashboard' | 'invoices' | 'monthly' | 'ages' | 'notes' | 'overdue' | undefined>(undefined);
  const [selectedCustomerForMonths, setSelectedCustomerForMonths] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'DEFAULT' | 'SUMMARY'>('DEFAULT');

  // Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilterModalTab, setActiveFilterModalTab] = useState<'DATE' | 'DEBIT' | 'OVERDUE' | 'SALES'>('DATE');

  // Search for Last Payment tab
  const [lastPaymentSearchQuery, setLastPaymentSearchQuery] = useState('');
  const [lastPaymentDateFrom, setLastPaymentDateFrom] = useState<string>('');
  const [lastPaymentDateTo, setLastPaymentDateTo] = useState<string>('');

  // Filters State
  const [matchingFilter, setMatchingFilter] = useState('ALL');
  const [selectedSalesRep, setSelectedSalesRep] = useState('ALL');
  const [customersWithEmails, setCustomersWithEmails] = useState<Set<string>>(new Set());
  const [closedCustomers, setClosedCustomers] = useState<Set<string>>(new Set());
  const [semiClosedCustomers, setSemiClosedCustomers] = useState<Set<string>>(new Set());
  const [selectedRatingCustomer, setSelectedRatingCustomer] = useState<CustomerAnalysis | null>(null);
  const [ratingBreakdown, setRatingBreakdown] = useState<any>(null);
  const [selectedCollectionStats, setSelectedCollectionStats] = useState<any>(null);

  // Closed Status Filter
  // Closed Status Filter
  const [closedFilter, setClosedFilter] = useState<'ALL' | 'HIDE' | 'ONLY'>('ALL');
  const [semiClosedFilter, setSemiClosedFilter] = useState<'ALL' | 'HIDE' | 'ONLY'>('ALL');

  // Bulk download state
  const [selectedCustomersForDownload, setSelectedCustomersForDownload] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  // Advanced Filters
  const [debtOperator, setDebtOperator] = useState<'GT' | 'LT' | ''>('');
  const [debtAmount, setDebtAmount] = useState<string>('');
  const [debtType, setDebtType] = useState<'ALL' | 'DEBTOR' | 'CREDITOR'>('ALL'); // NEW: Debtor vs Creditor
  const [collectionRateOperator, setCollectionRateOperator] = useState<'GT' | 'LT' | ''>(''); // Collection Rate operator
  const [collectionRateValue, setCollectionRateValue] = useState<string>(''); // Collection Rate percentage
  const [netSalesOperator, setNetSalesOperator] = useState<'GT' | 'LT' | ''>(''); // Operator for Net Sales
  const [minTotalDebit, setMinTotalDebit] = useState<string>(''); // NEW: High volume customers

  const [lastPaymentValue, setLastPaymentValue] = useState<string>('');
  const [lastPaymentUnit, setLastPaymentUnit] = useState<'DAYS' | 'MONTHS'>('DAYS');
  const [lastPaymentStatus, setLastPaymentStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Last Payment Amount Filter
  const [lastPaymentAmountOperator, setLastPaymentAmountOperator] = useState<'GT' | 'LT' | ''>('');
  const [lastPaymentAmountValue, setLastPaymentAmountValue] = useState<string>('');

  // Last Sales Amount Filter
  const [lastSalesAmountOperator, setLastSalesAmountOperator] = useState<'GT' | 'LT' | ''>('');
  const [lastSalesAmountValue, setLastSalesAmountValue] = useState<string>('');

  const [noSalesValue, setNoSalesValue] = useState<string>('');
  const [noSalesUnit, setNoSalesUnit] = useState<'DAYS' | 'MONTHS'>('DAYS');
  const [lastSalesStatus, setLastSalesStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Date Range Filters
  const [dateRangeFrom, setDateRangeFrom] = useState<string>('');
  const [dateRangeTo, setDateRangeTo] = useState<string>('');
  const [dateRangeType, setDateRangeType] = useState<'LAST_TRANSACTION' | 'LAST_SALE' | 'LAST_PAYMENT'>('LAST_TRANSACTION');

  // Overdue Amount Filters
  const [overdueAmount, setOverdueAmount] = useState<string>('');
  const [overdueAging, setOverdueAging] = useState<string[]>([]); // ['AT_DATE', '1-30', '31-60', '61-90', '91-120', 'OLDER']

  // OB Filter
  const [hasOB, setHasOB] = useState(false);

  // Get unique Sales Reps
  const availableSalesReps = useMemo(() => {
    const reps = new Set<string>();
    data.forEach(row => {
      if (row.salesRep && row.salesRep.trim()) {
        reps.add(row.salesRep.trim());
      }
    });
    return Array.from(reps).sort();
  }, [data]);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const response = await fetch('/api/customer-emails-list');
        if (response.ok) {
          const data = await response.json();
          // Store lowercased names for case-insensitive comparison
          setCustomersWithEmails(new Set(data.customers.map((name: string) => name.toLowerCase().trim())));
        }
      } catch (error) {
        console.error('Failed to fetch customer emails:', error);
      }
    };
    fetchEmails();
  }, []);

  // SPI Data State
  const [spiData, setSpiData] = useState<{ number: string, matching: string }[]>([]);

  useEffect(() => {
    const fetchSpi = async () => {
      try {
        const res = await fetch('/api/spi');
        const json = await res.json();
        if (json.data) setSpiData(json.data);
      } catch (e) { console.error('Failed to fetch SPI', e); }
    };
    fetchSpi();
  }, []);

  // Fetch Closed Customers for Rating
  useEffect(() => {
    const fetchClosedCustomers = async () => {
      try {
        const response = await fetch('/api/closed-customers');
        if (response.ok) {
          const data = await response.json();
          // Normalize customer names when storing (same normalization as in calculateDebtRating)
          const normalizedSet = new Set<string>();
          data.closedCustomers.forEach((name: string) => {
            // Normalize: lowercase, trim, and normalize whitespace only (exact match - keep punctuation, same as in getClosedCustomers)
            const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
            normalizedSet.add(normalized);
          });
          setClosedCustomers(normalizedSet);
        }
      } catch (error) {
        console.error('Failed to fetch closed customers:', error);
      }
    };
    fetchClosedCustomers();
  }, []);

  useEffect(() => {
    const fetchSemiClosedCustomers = async () => {
      try {
        const response = await fetch('/api/semi-closed-customers');
        if (response.ok) {
          const data = await response.json();
          const normalizedSet = new Set<string>();
          data.semiClosedCustomers.forEach((name: string) => {
            const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
            normalizedSet.add(normalized);
          });
          setSemiClosedCustomers(normalizedSet);
        }
      } catch (error) {
        console.error('Failed to fetch semi-closed customers:', error);
      }
    };
    fetchSemiClosedCustomers();
  }, []);

  // New Date Filters State
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'ALL' | 'OB' | 'SAL'>('ALL'); // NEW: Invoice Type Filter
  const [collectionRateTypes, setCollectionRateTypes] = useState<Set<string>>(new Set(['PAYMENT', 'RETURN', 'DISCOUNT']));

  // 1. First, filter the Raw Data based on Date Range (Year, Month, From/To)
  // This ensures all subsequent calculations (Net Debt, Collection Rate, etc.)
  // are based ONLY on the transactions within the selected period.
  const filteredRawData = useMemo(() => {
    return data.filter(row => {
      const rowDate = parseDate(row.date);
      if (!rowDate) return false;

      // Filter by Year
      if (filterYear) {
        if (rowDate.getFullYear().toString() !== filterYear) return false;
      }

      // Filter by Month
      if (filterMonth) {
        // Month is 0-indexed in JS Date, so +1 matches user input (1-12)
        if ((rowDate.getMonth() + 1).toString() !== filterMonth) return false;
      }

      // Filter by Date Range (From/To)
      if (dateRangeFrom) {
        const fromDate = new Date(dateRangeFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (rowDate < fromDate) return false;
      }

      if (dateRangeTo) {
        const toDate = new Date(dateRangeTo);
        toDate.setHours(23, 59, 59, 999);
        if (rowDate > toDate) return false;
      }

      return true;
    });
  }, [data, filterYear, filterMonth, dateRangeFrom, dateRangeTo]);

  // Calculate customer analysis based on the FILTERED raw data
  const customerAnalysis = useMemo(() => {
    // Intermediate structure to track matchings per customer
    type CustomerData = CustomerAnalysis & {
      matchingsMap: Map<string, number>;
      lastPaymentMatching: string | null;
      lastPaymentAmount: number | null;
      lastSalesAmount: number | null;
      creditPayments: number;
      creditReturns: number;
      creditDiscounts: number;
      // 90-day metrics
      sales3m: number;
      salesCount3m: number;
      payments3m: number;
      paymentsCount3m: number;
    };
    const customerMap = new Map<string, CustomerData>();

    const now = new Date();
    const date90DaysAgo = new Date();
    date90DaysAgo.setDate(now.getDate() - 90);

    // Use filteredRawData instead of data
    filteredRawData.forEach((row) => {
      let existing = customerMap.get(row.customerName);

      if (!existing) {
        existing = {
          customerName: row.customerName,
          totalDebit: 0,
          totalCredit: 0,
          netDebt: 0,
          netSales: 0,
          transactionCount: 0,
          matchingsMap: new Map(),
          salesReps: new Set(),
          invoiceNumbers: new Set(),
          lastPaymentDate: null,
          lastPaymentMatching: null,
          lastPaymentAmount: null,
          lastSalesDate: null,
          lastSalesAmount: null,
          lastTransactionDate: null,
          creditPayments: 0,
          creditReturns: 0,
          creditDiscounts: 0,
          sales3m: 0,
          salesCount3m: 0,
          payments3m: 0,
          paymentsCount3m: 0,
        };
      }

      existing.totalDebit += row.debit;
      existing.totalCredit += row.credit;
      existing.netDebt = existing.totalDebit - existing.totalCredit;
      existing.transactionCount += 1;

      // Classification of Credits/Collections
      const n = (row.number || '').toUpperCase();
      let type = '';

      if (n.startsWith('BNK')) {
        type = 'Payment';
      } else if (n.startsWith('PBNK') && row.debit > 0.01) {
        type = 'Other';
      } else if (n.startsWith('SAL')) {
        type = 'Sales';
      } else if (n.startsWith('RSAL')) {
        type = 'Return';
      } else if (n.startsWith('JV') || n.startsWith('BIL')) {
        type = 'Discount';
      } else if (row.credit > 0.01) {
        if (!n.startsWith('PBNK')) {
          type = 'Payment';
        }
      }

      if (type === 'Payment') {
        existing.creditPayments += (row.credit - row.debit);
      } else if (type === 'Return') {
        existing.creditReturns += row.credit;
      } else if (type === 'Discount') {
        existing.creditDiscounts += row.credit;
      }

      const rowDate = parseDate(row.date);
      if (rowDate && rowDate >= date90DaysAgo) {
        if (type === 'Payment') {
          existing.payments3m += (row.credit - row.debit);
          existing.paymentsCount3m += 1;
        } else if (type === 'Sales') {
          existing.sales3m += (row.debit - row.credit);
          existing.salesCount3m += 1;
        }
      }

      // Calculate Net Sales (SAL debit - RSAL credit) - matching Dashboard logic
      const num = row.number?.toString().toUpperCase() || '';
      if (num.startsWith('SAL')) {
        existing.netSales = (existing.netSales || 0) + row.debit;
        existing.totalSalesDebit = (existing.totalSalesDebit || 0) + row.debit;
      } else if (num.startsWith('RSAL')) {
        existing.netSales = (existing.netSales || 0) - row.credit;
      }

      if (row.salesRep && row.salesRep.trim()) {
        existing.salesReps?.add(row.salesRep.trim());
      }

      if (row.number) {
        existing.invoiceNumbers?.add(row.number.toString());
      }

      if (row.matching) {
        const currentMatchTotal = existing.matchingsMap.get(row.matching) || 0;
        existing.matchingsMap.set(row.matching, currentMatchTotal + (row.debit - row.credit));
      }


      if (rowDate) {
        // Track Last Transaction of ANY type
        if (!existing.lastTransactionDate || rowDate > existing.lastTransactionDate) {
          existing.lastTransactionDate = rowDate;
        }

        // Last Payment: max date where matches payment logic AND credit > 0
        if (isPaymentTxn(row) && (row.credit || 0) > 0.01) {
          const amount = getPaymentAmount(row);
          if (!existing.lastPaymentDate || rowDate > existing.lastPaymentDate) {
            existing.lastPaymentDate = rowDate;
            existing.lastPaymentMatching = row.matching || 'UNMATCHED';
            // User-requested: Last Payment amount should be Credit - Debit
            existing.lastPaymentAmount = amount;
          } else if (existing.lastPaymentDate && rowDate.getTime() === existing.lastPaymentDate.getTime()) {
            // Same date - accumulate amount
            existing.lastPaymentAmount = (existing.lastPaymentAmount || 0) + amount;
          }
        }
        // Last Sale: max date where invoice number starts with SAL (matching Dashboard logic)
        const num = row.number?.toString().toUpperCase() || '';
        if (num.startsWith('SAL') && row.debit > 0) {
          if (!existing.lastSalesDate || rowDate > existing.lastSalesDate) {
            existing.lastSalesDate = rowDate;
            existing.lastSalesAmount = row.debit;
          } else if (existing.lastSalesDate && rowDate.getTime() === existing.lastSalesDate.getTime()) {
            // Same date - accumulate amount
            existing.lastSalesAmount = (existing.lastSalesAmount || 0) + row.debit;
          }
        }
      }

      customerMap.set(row.customerName, existing);
    });

    // Calculate aging breakdown for each customer
    const customerInvoicesMap = new Map<string, InvoiceRow[]>();
    data.forEach(row => {
      const invoices = customerInvoicesMap.get(row.customerName) || [];
      invoices.push(row);
      customerInvoicesMap.set(row.customerName, invoices);
    });


    const since90 = new Date();
    since90.setDate(now.getDate() - 90);
    const isInLast90 = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = parseDate(dateStr);
      if (!d) return false;
      return d >= since90 && d <= now;
    };

    return Array.from(customerMap.values()).map(c => {
      // Check for any open matching
      let hasOpen = false;
      for (const amount of c.matchingsMap.values()) {
        if (Math.abs(amount) > 0.01) {
          hasOpen = true;
          break;
        }
      }

      // Calculate aging breakdown (matching Dashboard AGES tab logic)
      const customerInvoices = customerInvoicesMap.get(c.customerName) || [];
      const agingBreakdown = {
        atDate: 0,
        oneToThirty: 0,
        thirtyOneToSixty: 0,
        sixtyOneToNinety: 0,
        ninetyOneToOneTwenty: 0,
        older: 0,
      };
      let totalOverdue = 0;

      // Group invoices by matching to calculate residuals
      const matchingGroups = new Map<string, InvoiceRow[]>();
      customerInvoices.forEach(inv => {
        const key = inv.matching || 'UNMATCHED';
        const group = matchingGroups.get(key) || [];
        group.push(inv);
        matchingGroups.set(key, group);
      });

      // Determine last payment closure status using matching groups
      let lastPaymentClosure = '';
      if (c.lastPaymentDate) {
        // If no matching code or explicitly unmatched, treat as still open
        if (!c.lastPaymentMatching || c.lastPaymentMatching === 'UNMATCHED') {
          lastPaymentClosure = 'Still Open';
        } else {
          const targetMatch = c.lastPaymentMatching || 'UNMATCHED';
          const group = matchingGroups.get(targetMatch);
          if (group && group.length > 0) {
            const groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
            const invoiceNumbers = Array.from(new Set(group.map(inv => inv.number?.toString() || '').filter(Boolean)));

            // If any SAL exists and fully closed, still keep month labeling
            const salesInvoices = group.filter(inv => (inv.number?.toString().toUpperCase() || '').startsWith('SAL'));

            if (Math.abs(groupNetDebt) <= 0.01) {
              if (salesInvoices.length > 0) {
                const monthLabels = Array.from(new Set(salesInvoices.map(inv => {
                  const d = parseDate(inv.date);
                  return d ? d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) : null;
                }).filter(Boolean) as string[]));
                lastPaymentClosure = monthLabels.length > 0
                  ? `Closed in ${monthLabels.join(', ')}`
                  : 'Closed';
              } else {
                // Fully closed via non-SAL documents – keep only matching ID
                lastPaymentClosure = `Closed via matching ${targetMatch}`;
              }
            } else {
              // Partially closed; report remaining and reference invoice numbers
              const remaining = groupNetDebt.toFixed(2);
              lastPaymentClosure = `Partially closed via matching ${targetMatch}; remaining ${remaining}`;
            }
          } else {
            lastPaymentClosure = 'Still Open';
          }
        }
      }

      matchingGroups.forEach((group, matchingKey) => {
        let groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);

        if (Math.abs(groupNetDebt) <= 0.01) return; // Skip closed groups

        // For matched groups, use the first invoice's date/dueDate
        // For unmatched, use each invoice individually
        if (matchingKey === 'UNMATCHED') {
          group.forEach(inv => {
            const invNetDebt = inv.debit - inv.credit;
            if (Math.abs(invNetDebt) <= 0.01) return;

            let daysOverdue = 0;
            let targetDate = inv.dueDate ? parseDate(inv.dueDate) : null;
            if (!targetDate && inv.date) {
              targetDate = parseDate(inv.date);
            }

            if (targetDate) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              targetDate.setHours(0, 0, 0, 0);
              const diffTime = today.getTime() - targetDate.getTime();
              daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            if (daysOverdue <= 0) {
              agingBreakdown.atDate += invNetDebt;
            } else if (daysOverdue <= 30) {
              agingBreakdown.oneToThirty += invNetDebt;
            } else if (daysOverdue <= 60) {
              agingBreakdown.thirtyOneToSixty += invNetDebt;
            } else if (daysOverdue <= 90) {
              agingBreakdown.sixtyOneToNinety += invNetDebt;
            } else if (daysOverdue <= 120) {
              agingBreakdown.ninetyOneToOneTwenty += invNetDebt;
            } else {
              agingBreakdown.older += invNetDebt;
            }
            totalOverdue += invNetDebt;
          });
        } else {
          // Matched group - use first invoice for date calculation
          const firstInv = group[0];
          let daysOverdue = 0;
          let targetDate = firstInv.dueDate ? parseDate(firstInv.dueDate) : null;
          if (!targetDate && firstInv.date) {
            targetDate = parseDate(firstInv.date);
          }

          if (targetDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            targetDate.setHours(0, 0, 0, 0);
            const diffTime = today.getTime() - targetDate.getTime();
            daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }

          if (daysOverdue <= 0) {
            agingBreakdown.atDate += groupNetDebt;
          } else if (daysOverdue <= 30) {
            agingBreakdown.oneToThirty += groupNetDebt;
          } else if (daysOverdue <= 60) {
            agingBreakdown.thirtyOneToSixty += groupNetDebt;
          } else if (daysOverdue <= 90) {
            agingBreakdown.sixtyOneToNinety += groupNetDebt;
          } else if (daysOverdue <= 120) {
            agingBreakdown.ninetyOneToOneTwenty += groupNetDebt;
          } else {
            agingBreakdown.older += groupNetDebt;
          }
          totalOverdue += groupNetDebt;
        }
      });

      // Calculate Open OB amount from overdue invoices (matching OVERDUE tab logic)
      // This uses the same logic as overdue tab: unmatched invoices OR matched invoices with residual
      let hasOB = false;
      let openOBAmount = 0;

      // Calculate residual for each matching group (same as CustomerDetails)
      const matchingResiduals = new Map<string, InvoiceRow>();
      matchingGroups.forEach((group, matchingKey) => {
        if (matchingKey === 'UNMATCHED') return; // Skip unmatched, handled separately

        let groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
        if (Math.abs(groupNetDebt) <= 0.01) return; // Skip closed groups

        let residualHolder = group[0];
        let foundOverride = false;

        // 1. Check for SPI Override
        if (spiData && spiData.length > 0) {
          const override = group.find(inv =>
            spiData.some(s =>
              s.matching.toString().trim().toLowerCase() === (inv.matching || '').toString().trim().toLowerCase() &&
              s.number.toString().trim().toLowerCase() === (inv.number || '').toString().trim().toLowerCase()
            )
          );
          if (override) {
            residualHolder = override;
            foundOverride = true;
          }
        }

        // 2. If no override, use Max Debit Rule (Original Logic)
        if (!foundOverride) {
          let maxDebit = -1;
          group.forEach((inv) => {
            if (inv.debit > maxDebit) {
              maxDebit = inv.debit;
              residualHolder = inv;
            }
          });
        }

        matchingResiduals.set(matchingKey, residualHolder);
      });

      matchingGroups.forEach((group, matchingKey) => {
        if (matchingKey === 'UNMATCHED') {
          group.forEach(inv => {
            const invNetDebt = inv.debit - inv.credit;
            if (Math.abs(invNetDebt) <= 0.01) return;

            const num = inv.number?.toString().toUpperCase() || '';
            // Check unmatched OB
            if (num.startsWith('OB')) {
              hasOB = true;
              openOBAmount += invNetDebt;
            }
          });
        } else {
          // Matched group - check if residual holder is OB
          const residualHolder = matchingResiduals.get(matchingKey);
          if (residualHolder) {
            // For matched groups, usage is the Group Net Debt (Residual)
            const groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
            if (Math.abs(groupNetDebt) > 0.01) {
              const num = residualHolder.number?.toString().toUpperCase() || '';
              if (num.startsWith('OB')) {
                hasOB = true;
                openOBAmount += groupNetDebt;
              }
            }
          }
        }
      });

      // Last 90 days sales and payments
      const sales3m = customerInvoices
        .filter(inv => {
          const num = inv.number?.toString().toUpperCase() || '';
          return (num.startsWith('SAL') || num.startsWith('RSAL')) && isInLast90(inv.date);
        })
        .reduce((s, inv) => {
          const num = inv.number?.toString().toUpperCase() || '';
          if (num.startsWith('SAL')) return s + inv.debit;
          if (num.startsWith('RSAL')) return s - inv.credit;
          return s;
        }, 0);
      const salesCount3m = customerInvoices
        .filter(inv => inv.number?.toString().toUpperCase().startsWith('SAL') && isInLast90(inv.date))
        .length;

      const payments3m = customerInvoices
        .filter(inv => isInLast90(inv.date))
        .filter(inv => isPaymentTxn(inv))
        .reduce((s, inv) => s + getPaymentAmount(inv), 0);

      const paymentsCount3m = (() => {
        const paymentInvoices = customerInvoices
          .filter(inv => isInLast90(inv.date))
          .filter(inv => isPaymentTxn(inv));

        const creditCount = paymentInvoices.filter(inv => (inv.credit || 0) > 0.01).length;
        const debitCount = paymentInvoices.filter(inv => (inv.debit || 0) > 0.01).length;

        return creditCount - debitCount;
      })();

      // Calculate Net Debt & Collection Rate based on Filters (if active)
      let calculatedNetDebt = c.netDebt;
      let calculatedTotalDebit = c.totalDebit;
      let calculatedTotalCredit = c.totalCredit;

      const isDateFilterActive = filterYear || filterMonth || dateRangeFrom || dateRangeTo;

      if (isDateFilterActive) {
        let specializedNetDebt = 0;
        let specializedTotalIssued = 0;
        let specializedTotalCredit = 0;

        // Reuse checking logic from filteredRawData
        const isRowInFilter = (row: InvoiceRow) => {
          const rowDate = parseDate(row.date);
          if (!rowDate) return false;

          if (filterYear && rowDate.getFullYear().toString() !== filterYear) return false;
          if (filterMonth && (rowDate.getMonth() + 1).toString() !== filterMonth) return false;

          if (dateRangeFrom) {
            const fromDate = new Date(dateRangeFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (rowDate < fromDate) return false;
          }
          if (dateRangeTo) {
            const toDate = new Date(dateRangeTo);
            toDate.setHours(23, 59, 59, 999);
            if (rowDate > toDate) return false;
          }
          return true;
        };

        // Helper to check credit type against active filters
        const checkCreditType = (inv: InvoiceRow) => {
          const n = (inv.number || '').toUpperCase();
          let type = 'Payment';

          if (n.startsWith('OB')) type = 'OB';
          else if (n.startsWith('BNK') || n.startsWith('PBNK')) type = 'Payment';
          else if (n.startsWith('SAL')) type = 'Sales';
          else if (n.startsWith('RSAL')) type = 'Return';
          else if (n.startsWith('JV') || n.startsWith('BIL')) type = 'Discount';

          if (type === 'Payment' && collectionRateTypes.has('PAYMENT')) return true;
          if (type === 'Return' && collectionRateTypes.has('RETURN')) return true;
          if (type === 'Discount' && collectionRateTypes.has('DISCOUNT')) return true;

          return false;
        };

        // Determine which types to include for ISSUED (Sales Only)
        const checkInvoiceType = (num: string) => {
          num = (num || '').toUpperCase();
          if (invoiceTypeFilter === 'ALL') {
            return num.startsWith('OB') || num.startsWith('SAL');
          } else if (invoiceTypeFilter === 'OB') {
            return num.startsWith('OB');
          } else if (invoiceTypeFilter === 'SAL') {
            return num.startsWith('SAL');
          }
          return false;
        };

        // Determine which types to include for NET DEBT (Matches Overdue Tab - All Types)
        const checkNetDebtType = (num: string) => {
          if (invoiceTypeFilter === 'ALL') return true;
          return checkInvoiceType(num);
        };

        // Iterate ALL groups (open and closed) to find Issued Amount in period
        matchingGroups.forEach((group, matchingKey) => {
          // For UNMATCHED, treat each invoice independently
          if (matchingKey === 'UNMATCHED') {
            group.forEach(inv => {
              if (isRowInFilter(inv)) {
                // Issued is restricted to OB/SAL
                if (checkInvoiceType(inv.number || '')) {
                  specializedTotalIssued += inv.debit;
                }
                // Net Debt includes ALL types (e.g. including payments/returns/debit notes if unmatched)
                if (checkNetDebtType(inv.number || '')) {
                  specializedNetDebt += (inv.debit - inv.credit);
                }
              }
            });
            return;
          }

          // For MATCHED groups:
          // 1. Calculate the Group's Current Residual (Net Debt)
          const groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
          const groupResidual = Math.abs(groupNetDebt) > 0.01 ? groupNetDebt : 0;

          // 2. Calculate Total Issued (Sales/OB) in the period
          // accumulated from ALL matching invoices in the group
          group.forEach(inv => {
            if (inv.debit > 0.01 && checkInvoiceType(inv.number || '')) {
              if (isRowInFilter(inv)) {
                specializedTotalIssued += inv.debit;
              }
            }
          });

          // 3. Calculate Net Debt based on Residual Holder (Overdue Tab Logic)
          // Only add residual if the "Residual Holder" (invoice with max debit) is in the filter period
          if (Math.abs(groupResidual) > 0.01) {
            let residualHolder: InvoiceRow | null = null;

            // A. Check for SPI Override first
            if (spiData && spiData.length > 0 && matchingKey !== 'UNMATCHED') {
              const override = group.find(inv =>
                spiData.some(s =>
                  s.matching.toString().trim().toLowerCase() === (inv.matching || '').toString().trim().toLowerCase() &&
                  s.number.toString().trim().toLowerCase() === (inv.number || '').toString().trim().toLowerCase()
                )
              );
              if (override) {
                residualHolder = override;
              }
            }

            // B. If no override found, use Max Debit Rule
            if (!residualHolder) {
              let maxDebit = -1;
              residualHolder = group[0];

              group.forEach((inv) => {
                if (inv.debit > maxDebit) {
                  maxDebit = inv.debit;
                  residualHolder = inv;
                }
              });
            }

            if (residualHolder && isRowInFilter(residualHolder)) {
              // Net Debt allows ALL types
              if (checkNetDebtType(residualHolder.number || '')) {
                specializedNetDebt += groupResidual;
              }
            }
          }
        });

        calculatedNetDebt = specializedNetDebt;
        calculatedTotalDebit = specializedTotalIssued;
        calculatedTotalCredit = specializedTotalIssued - specializedNetDebt; // Collected = Issued - Remaining
      }

      return {
        customerName: c.customerName,
        totalDebit: calculatedTotalDebit,
        totalCredit: calculatedTotalCredit,

        netDebt: calculatedNetDebt,
        netSales: c.netSales || 0,
        transactionCount: c.transactionCount,
        hasOpenMatchings: hasOpen,
        salesReps: c.salesReps,
        invoiceNumbers: c.invoiceNumbers,
        lastPaymentDate: c.lastPaymentDate,
        lastPaymentMatching: c.lastPaymentMatching,
        lastPaymentAmount: c.lastPaymentAmount,
        lastPaymentClosure,
        lastSalesDate: c.lastSalesDate,
        lastSalesAmount: c.lastSalesAmount,
        overdueAmount: totalOverdue,
        hasOB,
        openOBAmount,
        agingBreakdown,
        payments3m,
        paymentsCount3m,
        sales3m,
        salesCount3m,
        lastTransactionDate: c.lastTransactionDate,
        creditPayments: c.creditPayments,
        creditReturns: c.creditReturns,
        creditDiscounts: c.creditDiscounts,
        totalSalesDebit: c.totalSalesDebit,
      };
    }).sort((a, b) => b.netDebt - a.netDebt);
  }, [filteredRawData, filterYear, filterMonth, dateRangeFrom, dateRangeTo, invoiceTypeFilter, spiData]);



  const filteredData = useMemo(() => {
    let result = customerAnalysis;

    // Mode-based filtering
    if (mode === 'OB_POS') {
      result = result.filter(c => (c.openOBAmount || 0) > 0.01);
    } else if (mode === 'OB_NEG') {
      result = result.filter(c => (c.openOBAmount || 0) < -0.01);
    } else {
      // Default DEBIT: Filter out zero/negative net debt
      result = result.filter(c => c.netDebt > 0.01);
    }
    const now = new Date();

    // Date Range Filter
    if (dateRangeFrom || dateRangeTo) {
      const fromDate = dateRangeFrom ? new Date(dateRangeFrom) : null;
      if (fromDate) fromDate.setHours(0, 0, 0, 0);

      const toDate = dateRangeTo ? new Date(dateRangeTo) : null;
      if (toDate) toDate.setHours(23, 59, 59, 999);

      if (fromDate || toDate) {
        result = result.filter(c => {
          let targetDate: Date | null = null;

          switch (dateRangeType) {
            case 'LAST_TRANSACTION':
              // Use the most recent date of ANY transaction type
              targetDate = c.lastTransactionDate || null;
              break;
            case 'LAST_SALE':
              targetDate = c.lastSalesDate || null;
              break;
            case 'LAST_PAYMENT':
              targetDate = c.lastPaymentDate || null;
              break;
          }

          if (!targetDate) return false;

          if (fromDate && toDate) {
            return targetDate >= fromDate && targetDate <= toDate;
          } else if (fromDate) {
            return targetDate >= fromDate;
          } else if (toDate) {
            return targetDate <= toDate;
          }

          return true;
        });
      }
    }

    if (matchingFilter === 'OPEN') {
      // فقط العملاء اللي عندهم matchings مفتوحة
      result = result.filter(c => c.hasOpenMatchings);
    } else if (matchingFilter === 'WITH_EMAIL') {
      // العملاء اللي ليهم ايميل في شيت الإيميلات
      result = result.filter(c => customersWithEmails.has(c.customerName.toLowerCase().trim()));
    } else if (matchingFilter === 'RATING_GOOD') {
      // العملاء تقييمهم Good
      result = result.filter(c => calculateDebtRating(c, closedCustomers) === 'Good');
    } else if (matchingFilter === 'RATING_MEDIUM') {
      // العملاء تقييمهم Medium
      result = result.filter(c => calculateDebtRating(c, closedCustomers) === 'Medium');
    } else if (matchingFilter === 'RATING_BAD') {
      // العملاء تقييمهم Bad
      result = result.filter(c => calculateDebtRating(c, closedCustomers) === 'Bad');
    }

    // Closed Status Filter
    if (closedFilter === 'HIDE') {
      result = result.filter(c => !closedCustomers.has(c.customerName.toLowerCase().trim().replace(/\s+/g, ' ')));
    } else if (closedFilter === 'ONLY') {
      result = result.filter(c => closedCustomers.has(c.customerName.toLowerCase().trim().replace(/\s+/g, ' ')));
    }

    // Semi-Closed Status Filter
    if (semiClosedFilter === 'HIDE') {
      result = result.filter(c => !semiClosedCustomers.has(c.customerName.toLowerCase().trim().replace(/\s+/g, ' ')));
    } else if (semiClosedFilter === 'ONLY') {
      result = result.filter(c => semiClosedCustomers.has(c.customerName.toLowerCase().trim().replace(/\s+/g, ' ')));
    }

    if (selectedSalesRep !== 'ALL') {
      result = result.filter(c => c.salesReps && c.salesReps.has(selectedSalesRep));
    }

    // Debt Filters
    if (debtOperator && debtAmount) {
      const amount = parseFloat(debtAmount);
      if (!isNaN(amount)) {
        if (debtOperator === 'GT') {
          result = result.filter(c => c.netDebt > amount);
        } else if (debtOperator === 'LT') {
          result = result.filter(c => c.netDebt < amount);
        }
      }
    }

    if (debtType === 'DEBTOR') {
      result = result.filter(c => c.netDebt > 0);
    } else if (debtType === 'CREDITOR') {
      result = result.filter(c => c.netDebt < 0);
    }

    if (collectionRateOperator && collectionRateValue) {
      const rate = parseFloat(collectionRateValue);
      if (!isNaN(rate)) {
        result = result.filter(c => {
          if (c.totalDebit === 0) return false;

          // Calculate "Adjusted Credit" based on selected types
          let adjustedCredit = 0;
          // Note: accessing extended properties needs casting or updated type
          const cExt = c as any;
          if (collectionRateTypes.has('PAYMENT')) adjustedCredit += cExt.creditPayments || 0;
          if (collectionRateTypes.has('RETURN')) adjustedCredit += cExt.creditReturns || 0;
          if (collectionRateTypes.has('DISCOUNT')) adjustedCredit += cExt.creditDiscounts || 0;

          const collectionRate = (adjustedCredit / c.totalDebit) * 100;

          if (collectionRateOperator === 'GT') {
            return collectionRate > rate;
          } else if (collectionRateOperator === 'LT') {
            return collectionRate < rate;
          }
          return true;
        });
      }
    }

    // OB Filter (Has unpaid OB invoices)
    if (hasOB) {
      result = result.filter(c => c.hasOB === true);
    }

    // Net Sales Filter (SAL - RSAL, matching Dashboard logic)
    if (netSalesOperator && minTotalDebit) {
      const val = parseFloat(minTotalDebit);
      if (!isNaN(val)) {
        if (netSalesOperator === 'GT') {
          result = result.filter(c => (c.netSales || 0) > val);
        } else if (netSalesOperator === 'LT') {
          result = result.filter(c => (c.netSales || 0) < val);
        }
      }
    } else if (minTotalDebit) {
      const val = parseFloat(minTotalDebit);
      if (!isNaN(val)) result = result.filter(c => (c.netSales || 0) >= val);
    }

    // Overdue Amount Filter
    if (overdueAmount) {
      const val = parseFloat(overdueAmount);
      if (!isNaN(val)) {
        result = result.filter(c => (c.overdueAmount || 0) >= val);
      }
    }

    // Overdue Aging Filter
    if (overdueAging.length > 0) {
      result = result.filter(c => {
        if (!c.agingBreakdown) return false;
        const aging = c.agingBreakdown;

        // Check if customer has any amount in selected aging buckets (matching AGES tab order)
        return overdueAging.some(bucket => {
          switch (bucket) {
            case 'AT_DATE':
              return Math.abs(aging.atDate) > 0.01;
            case '1-30':
              return Math.abs(aging.oneToThirty) > 0.01;
            case '31-60':
              return Math.abs(aging.thirtyOneToSixty) > 0.01;
            case '61-90':
              return Math.abs(aging.sixtyOneToNinety) > 0.01;
            case '91-120':
              return Math.abs(aging.ninetyOneToOneTwenty) > 0.01;
            case 'OLDER':
              return Math.abs(aging.older) > 0.01;
            default:
              return false;
          }
        });
      });
    }

    // Last Payment Filter (Active/Inactive in last X days)
    if (lastPaymentValue) {
      const val = parseFloat(lastPaymentValue);
      if (!isNaN(val)) {
        const daysThreshold = lastPaymentUnit === 'MONTHS' ? val * 30 : val;
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

        result = result.filter(c => {
          if (!c.lastPaymentDate) {
            // No payment ever - consider as INACTIVE
            return lastPaymentStatus === 'INACTIVE';
          }

          // Check if last payment was within the threshold (ACTIVE) or before it (INACTIVE)
          const isActive = c.lastPaymentDate >= cutoffDate;
          return lastPaymentStatus === 'ACTIVE' ? isActive : !isActive;
        });
      }
    }

    // Last Payment Amount Filter
    if (lastPaymentAmountOperator && lastPaymentAmountValue) {
      const amount = parseFloat(lastPaymentAmountValue);
      if (!isNaN(amount)) {
        result = result.filter(c => {
          if (!c.lastPaymentAmount) return false; // Only include customers with payment history

          if (lastPaymentAmountOperator === 'GT') {
            return c.lastPaymentAmount > amount;
          } else if (lastPaymentAmountOperator === 'LT') {
            return c.lastPaymentAmount < amount;
          }
          return true;
        });
      }
    }

    // Last Sales Filter (Active/Inactive in last X days)
    if (noSalesValue) {
      const val = parseFloat(noSalesValue);
      if (!isNaN(val)) {
        const daysThreshold = noSalesUnit === 'MONTHS' ? val * 30 : val;
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

        result = result.filter(c => {
          if (!c.lastSalesDate) {
            // No sales ever - consider as INACTIVE
            return lastSalesStatus === 'INACTIVE';
          }

          // Check if last sale was within the threshold (ACTIVE) or before it (INACTIVE)
          const isActive = c.lastSalesDate >= cutoffDate;
          return lastSalesStatus === 'ACTIVE' ? isActive : !isActive;
        });
      }
    }

    // Last Sales Amount Filter
    if (lastSalesAmountOperator && lastSalesAmountValue) {
      const amount = parseFloat(lastSalesAmountValue);
      if (!isNaN(amount)) {
        result = result.filter(c => {
          if (!c.lastSalesAmount) return false; // Only include customers with sales history

          if (lastSalesAmountOperator === 'GT') {
            return c.lastSalesAmount > amount;
          } else if (lastSalesAmountOperator === 'LT') {
            return c.lastSalesAmount < amount;
          }
          return true;
        });
      }
    }

    if (!searchQuery.trim()) return result;

    const query = searchQuery.toLowerCase();
    return result.filter((customer) =>
      customer.customerName.toLowerCase().includes(query) ||
      Array.from((customer as any).invoiceNumbers || []).some((num: any) =>
        num.toString().toLowerCase().includes(query)
      )
    );
  }, [customerAnalysis, searchQuery, matchingFilter, selectedSalesRep, debtOperator, debtAmount, lastPaymentValue, lastPaymentUnit, lastPaymentStatus, lastPaymentAmountOperator, lastPaymentAmountValue, noSalesValue, noSalesUnit, lastSalesStatus, lastSalesAmountOperator, lastSalesAmountValue, customersWithEmails, debtType, minTotalDebit, netSalesOperator, collectionRateOperator, collectionRateValue, overdueAmount, overdueAging, dateRangeFrom, dateRangeTo, dateRangeType, hasOB, collectionRateTypes, closedFilter, closedCustomers, semiClosedFilter, semiClosedCustomers]);

  // Calculate unmatched payments for Last Payment tab - using same logic as Overdue tab
  interface UnmatchedPayment {
    customerName: string;
    date: Date;
    number: string;
    debit: number;
    credit: number;
    remainingAmount: number; // This is the difference (netDebt) from Overdue
  }

  const unmatchedPayments = useMemo(() => {
    // Group data by customer first (same as CustomerDetails logic)
    const customerGroups = new Map<string, InvoiceRow[]>();
    data.forEach(row => {
      const customer = row.customerName;
      if (!customerGroups.has(customer)) {
        customerGroups.set(customer, []);
      }
      customerGroups.get(customer)!.push(row);
    });

    const payments: UnmatchedPayment[] = [];

    // Process each customer separately (matching is per customer)
    customerGroups.forEach((customerInvoices, customerName) => {
      // 1. Calculate totals for each matching group and find residual (same as CustomerDetails)
      const matchingTotals = new Map<string, number>();

      customerInvoices.forEach(inv => {
        if (inv.matching) {
          const currentTotal = matchingTotals.get(inv.matching) || 0;
          matchingTotals.set(inv.matching, currentTotal + (inv.debit - inv.credit));
        }
      });

      // 2. Find the index of the row with the largest DEBIT for each matching code
      const targetResidualIndices = new Map<string, number>();
      const maxDebits = new Map<string, number>();

      customerInvoices.forEach((inv, index) => {
        if (inv.matching) {
          const currentMax = maxDebits.get(inv.matching) ?? -1;
          if (inv.debit > currentMax) {
            maxDebits.set(inv.matching, inv.debit);
            targetResidualIndices.set(inv.matching, index);
          } else if (!targetResidualIndices.has(inv.matching)) {
            maxDebits.set(inv.matching, inv.debit);
            targetResidualIndices.set(inv.matching, index);
          }
        }
      });

      // 3. Create invoicesWithNetDebt (same as CustomerDetails)
      const invoicesWithNetDebt = customerInvoices.map((invoice, index) => {
        let residual: number | undefined = undefined;

        if (invoice.matching) {
          const targetIndex = targetResidualIndices.get(invoice.matching);
          if (targetIndex === index) {
            const total = matchingTotals.get(invoice.matching) || 0;
            if (Math.abs(total) > 0.01) {
              residual = total;
            }
          }
        }

        return {
          ...invoice,
          netDebt: invoice.debit - invoice.credit,
          residual
        };
      });

      // 4. Filter for overdue invoices (same logic as Overdue tab)
      const overdueInvoices = invoicesWithNetDebt.filter(inv => {
        // Keep if no matching ID (Unmatched)
        if (!inv.matching) return true;

        // Keep only if it carries the residual (which means it's the main open invoice of an open group)
        return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
      }).map(inv => {
        let difference = inv.netDebt;

        if (inv.matching && inv.residual !== undefined) {
          // It's a condensed open invoice
          // Difference is the residual
          difference = inv.residual;
        }

        // Adjust Credit for display (Debit - Credit = Difference)
        const adjustedCredit = inv.debit - difference;

        return {
          ...inv,
          credit: adjustedCredit,
          difference
        };
      });

      // 5. Filter for payments only (credit > 0, excluding SAL, RSAL, BIL, JV, OB)
      overdueInvoices.forEach(inv => {
        if (inv.credit > 0.01) {
          const num = inv.number?.toString().toUpperCase() || '';
          if (!num.startsWith('SAL') &&
            !num.startsWith('RSAL') &&
            !num.startsWith('BIL') &&
            !num.startsWith('JV') &&
            !num.startsWith('OB')) {

            const rowDate = parseDate(inv.date);
            if (rowDate) {
              payments.push({
                customerName: customerName,
                date: rowDate,
                number: inv.number || '',
                debit: inv.debit,
                credit: inv.credit,
                remainingAmount: Math.abs(inv.difference) // This is the difference from Overdue
              });
            }
          }
        }
      });
    });

    // Sort by date descending (newest first)
    return payments.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data]);

  // Filter unmatched payments based on search query and date range
  const filteredUnmatchedPayments = useMemo(() => {
    let filtered = unmatchedPayments;

    // Date range filter
    if (lastPaymentDateFrom || lastPaymentDateTo) {
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.date);
        paymentDate.setHours(0, 0, 0, 0);

        if (lastPaymentDateFrom) {
          const fromDate = new Date(lastPaymentDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (paymentDate < fromDate) return false;
        }

        if (lastPaymentDateTo) {
          const toDate = new Date(lastPaymentDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (paymentDate > toDate) return false;
        }

        return true;
      });
    }

    // Search query filter
    if (lastPaymentSearchQuery.trim()) {
      const query = lastPaymentSearchQuery.toLowerCase();
      filtered = filtered.filter(payment => {
        return (
          payment.customerName.toLowerCase().includes(query) ||
          payment.number.toLowerCase().includes(query) ||
          payment.date.toLocaleDateString('en-US').toLowerCase().includes(query) ||
          payment.debit.toString().includes(query) ||
          payment.credit.toString().includes(query) ||
          payment.remainingAmount.toString().includes(query)
        );
      });
    }

    return filtered;
  }, [unmatchedPayments, lastPaymentSearchQuery, lastPaymentDateFrom, lastPaymentDateTo]);

  // Handle checkbox toggle
  const toggleCustomerSelection = (customerName: string) => {
    setSelectedCustomersForDownload(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerName)) {
        newSet.delete(customerName);
      } else {
        newSet.add(customerName);
      }
      return newSet;
    });
  };

  // Handle select all / deselect all
  const toggleSelectAll = () => {
    if (selectedCustomersForDownload.size === filteredData.length) {
      setSelectedCustomersForDownload(new Set());
    } else {
      setSelectedCustomersForDownload(new Set(filteredData.map(c => c.customerName)));
    }
  };

  // Helper function to build invoices with net debt and residual (same logic as CustomerDetails)
  const buildInvoicesWithNetDebt = (invList: InvoiceRow[]) => {
    // 1. Calculate totals for each matching group
    const matchingTotals = new Map<string, number>();
    invList.forEach((invoice) => {
      if (invoice.matching) {
        const current = matchingTotals.get(invoice.matching) || 0;
        matchingTotals.set(invoice.matching, current + (invoice.debit - invoice.credit));
      }
    });

    // 2. Identify which invoice should display the residual per matching group (largest debit)
    const matchingTargetIndex = new Map<string, number>();
    invList.forEach((invoice, index) => {
      if (!invoice.matching) return;
      const existingTarget = matchingTargetIndex.get(invoice.matching);
      if (existingTarget === undefined) {
        matchingTargetIndex.set(invoice.matching, index);
        return;
      }
      const existingInvoice = invList[existingTarget];
      if ((invoice.debit || 0) > (existingInvoice?.debit || 0)) {
        matchingTargetIndex.set(invoice.matching, index);
      }
    });

    // 3. Map invoices preserving original order
    return invList.map((invoice, index) => {
      let residual: number | undefined = undefined;

      if (invoice.matching) {
        const targetIndex = matchingTargetIndex.get(invoice.matching);
        if (targetIndex === index) {
          const total = matchingTotals.get(invoice.matching) || 0;
          if (Math.abs(total) > 0.01) {
            residual = total;
          }
        }
      }

      return {
        ...invoice,
        netDebt: invoice.debit - invoice.credit,
        residual,
      };
    });
  };

  // Bulk download function with Net Only filter
  const handleBulkDownload = async () => {
    if (selectedCustomersForDownload.size === 0) {
      alert('يرجى اختيار عملاء للتحميل');
      return;
    }

    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const { generateAccountStatementPDF, generateBulkDebitSummaryPDF } = await import('@/lib/pdfUtils');

      const customersToDehydrate = filteredData.filter(c => selectedCustomersForDownload.has(c.customerName));

      const pdfBlob = await generateBulkDebitSummaryPDF(customersToDehydrate);
      if (pdfBlob) {
        saveAs(pdfBlob, `Debit_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) {
      console.error('Error generating summary PDF:', error);
      alert('حدث خطأ أثناء تحميل الملف');
    } finally {
      setIsDownloading(false);
    }
  };

  // Bulk download function with Net Only filter
  const handleBulkZIPDownload = async () => {
    if (selectedCustomersForDownload.size === 0) {
      alert('يرجى اختيار عملاء للتحميل');
      return;
    }

    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const { generateAccountStatementPDF } = await import('@/lib/pdfUtils');

      const zip = new JSZip();
      let count = 0;

      // Process each customer
      for (const customerName of selectedCustomersForDownload) {
        // Get customer invoices
        const customerInvoices = data.filter(row => row.customerName === customerName);

        if (customerInvoices.length === 0) {
          console.warn(`No invoices found for customer: ${customerName}`);
          continue;
        }

        // Build invoices with net debt and residual
        const invoicesWithNetDebt = buildInvoicesWithNetDebtForExport(customerInvoices, spiData);

        // Apply Net Only filter: Keep only unmatched invoices OR the single "residual holder" invoice for open matching groups
        const netOnlyInvoices = invoicesWithNetDebt
          .filter(inv => {
            // Keep if no matching ID (Unmatched)
            if (!inv.matching) return true;

            // Keep only if it carries the residual (which means it's the main open invoice of an open group)
            return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
          })
          .map(inv => {
            if (inv.matching && inv.residual !== undefined) {
              // It's a condensed open invoice
              // Calculate "Paid" amount to show in Credit
              // Credit = Debit - Residual
              return {
                ...inv,
                credit: inv.debit - inv.residual,
                netDebt: inv.residual
              };
            }
            return inv;
          });

        if (netOnlyInvoices.length === 0) {
          console.warn(`No open/unmatched invoices found for customer: ${customerName}`);
          continue;
        }

        // Generate PDF Blob by passing true as the 3rd argument
        const pdfBlob = await generateAccountStatementPDF(customerName, netOnlyInvoices, true, 'All Months (Net Only)');

        if (pdfBlob) {
          const cleanName = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim();
          zip.file(`${cleanName}.pdf`, pdfBlob as Blob);
          count++;
        }
      }

      if (count > 0) {
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `Customer_Statements_${new Date().toISOString().split('T')[0]}.zip`);
        setSelectedCustomersForDownload(new Set());
      } else {
        alert('لم يتم إنشاء أي ملفات (قد لا توجد فواتير مفتوحة للعملاء المحددين).');
      }

    } catch (error) {
      console.error('Error in bulk download:', error);
      alert('حدث خطأ أثناء التحميل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsDownloading(false);
    }
  };

  const blobToBase64 = (blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Bulk Email function
  const handleBulkEmail = async () => {
    if (selectedCustomersForDownload.size === 0) {
      alert('Please select customers to email');
      return;
    }

    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const { generateAccountStatementPDF } = await import('@/lib/pdfUtils');

      const zip = new JSZip();
      let count = 0;

      // Process each customer
      for (const customerName of selectedCustomersForDownload) {
        // Get customer invoices
        const customerInvoices = data.filter(row => row.customerName === customerName);

        if (customerInvoices.length === 0) continue;

        // Fetch emails
        let customerEmails: string[] = [];
        try {
          const res = await fetch(`/api/customer-email?customerName=${encodeURIComponent(customerName)}`);
          if (res.ok) {
            const data = await res.json();
            customerEmails = Array.isArray(data?.emails) ? data.emails.filter(Boolean) : (data?.email ? [data.email] : []);
          }
        } catch (e) {
          console.error(`Error fetching email for ${customerName}`, e);
        }

        if (customerEmails.length === 0) {
          // If no email, we skip or maybe add a text file saying no email?
          // For now, let's just generate without To: (user can fill it) or skip?
          // User asked to "extract all emails", implying EML files. Better to generate it even without 'To'.
        }

        const toEmails = customerEmails.join(', ');
        const ccEmails = '';

        // Prepare invoices (Net Only)
        // Reuse logic from buildInvoicesWithNetDebtForExport which is available in file scope?
        // Wait, buildInvoicesWithNetDebtForExport is defined outside component (line 470). Yes.
        const invoicesWithNetDebt = buildInvoicesWithNetDebtForExport(customerInvoices, spiData);
        const netOnlyInvoices = invoicesWithNetDebt
          .filter(inv => {
            if (!inv.matching) return true;
            return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
          })
          .map(inv => {
            if (inv.matching && inv.residual !== undefined) {
              return {
                ...inv,
                credit: inv.debit - inv.residual,
                netDebt: inv.residual
              };
            }
            return inv;
          });

        if (netOnlyInvoices.length === 0) continue;

        const netDebt = netOnlyInvoices.reduce((sum, inv) => sum + inv.netDebt, 0);

        // Generate PDF
        const pdfBlob = await generateAccountStatementPDF(customerName, netOnlyInvoices, true, 'All Months (Net Only)');
        if (!pdfBlob) continue;

        const pdfBase64 = await blobToBase64(pdfBlob as Blob);
        const cleanName = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim();
        const pdfFileName = `${cleanName}.pdf`;

        // Generate EML
        const boundary = "----=_NextPart_000_0001_01C2A9A1.12345678";
        const subject = 'Statement of Account - Al Marai Al Arabia Trading Sole Proprietorship L.L.C';

        const debtSectionHtml = `<p style="margin: 0 0 10px 0; line-height: 1.5;">Please find attached your account statement.</p>
<ul style="margin: 0 0 10px 0; padding-left: 20px; line-height: 1.5;">
<li style="line-height: 1.5; margin-bottom: 5px;"><b>Your current balance is:</b> <span style="color: blue; font-weight: bold; font-size: 16px;">${netDebt.toLocaleString('en-US')} AED</span></li>
</ul>`;

        const htmlBody = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">
<p style="margin: 0 0 10px 0; line-height: 1.5;">Dear Team,</p>
<p style="margin: 0 0 10px 0; line-height: 1.5;">We hope this message finds you well.</p>
${debtSectionHtml}
<p style="margin: 0 0 10px 0; line-height: 1.5;">Kindly provide us with your statement of account and any discount invoices for reconciliation.</p>
<p style="margin: 0; line-height: 1.5;">Best regards,</p>
</body>
</html>`;

        const emlLines: string[] = [];
        emlLines.push('From: accounting@marae.ae');
        emlLines.push('To: ' + toEmails);
        emlLines.push('Cc: ' + ccEmails);
        emlLines.push('Subject: ' + subject);
        emlLines.push('X-Unsent: 1');
        emlLines.push('Content-Type: multipart/mixed; boundary="' + boundary + '"');
        emlLines.push('');
        emlLines.push('--' + boundary);
        emlLines.push('Content-Type: text/html; charset="UTF-8"');
        emlLines.push('Content-Transfer-Encoding: 7bit');
        emlLines.push('');
        emlLines.push(htmlBody);
        emlLines.push('');
        emlLines.push('--' + boundary);
        emlLines.push(`Content-Type: application/pdf; name="${pdfFileName}"`);
        emlLines.push('Content-Transfer-Encoding: base64');
        emlLines.push(`Content-Disposition: attachment; filename="${pdfFileName}"`);
        emlLines.push('');
        emlLines.push(pdfBase64);
        emlLines.push('');
        emlLines.push('--' + boundary + '--');

        const emlContent = emlLines.join('\r\n');

        // Add to zip
        zip.file(`${cleanName}.eml`, emlContent);
        count++;
      }

      if (count > 0) {
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `Customer_Emails_${new Date().toISOString().split('T')[0]}.zip`);
        setSelectedCustomersForDownload(new Set());
      } else {
        alert('No emails generated. Check if selected customers have open invoices.');
      }

    } catch (error) {
      console.error('Error in bulk email:', error);
      alert('Error generating emails.');
    } finally {
      setIsDownloading(false);
    }
  };


  const handleBulkPrint = async () => {
    setIsDownloading(true);
    try {
      const customersToPrint = Array.from(selectedCustomersForDownload);
      if (customersToPrint.length === 0) return;

      const statements: Array<{ customerName: string; invoices: any[] }> = [];

      for (const custName of customersToPrint) {
        const customerRows = data.filter(r => r.customerName === custName);
        if (customerRows.length === 0) continue;

        const invoicesWithNetDebt = buildInvoicesWithNetDebtForExport(customerRows, spiData);
        const netOnlyInvoices = invoicesWithNetDebt
          .filter(inv => {
            if (!inv.matching) return true;
            return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
          })
          .map(inv => {
            if (inv.matching && inv.residual !== undefined) {
              return {
                ...inv,
                credit: (inv.debit || 0) - (inv.residual || 0),
                netDebt: inv.residual
              };
            }
            return inv;
          });

        if (netOnlyInvoices.length === 0) continue;

        const mappedInvoices = netOnlyInvoices.map(inv => ({
          date: inv.date || '',
          number: inv.number || '',
          debit: inv.debit || 0,
          credit: inv.credit || 0,
          netDebt: inv.netDebt
        }));

        statements.push({
          customerName: custName,
          invoices: mappedInvoices
        });
      }

      if (statements.length === 0) {
        alert('No data found for selected customers.');
        return;
      }

      const pdfBlob = await generateBulkCustomerStatementsPDF(statements);
      const url = URL.createObjectURL(pdfBlob as Blob);
      window.open(url, '_blank');

    } catch (error) {
      console.error('Error generating bulk print:', error);
      alert('Error generating print document.');
    } finally {
      setIsDownloading(false);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', {
        header: () => (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filteredData.length > 0 && selectedCustomersForDownload.size === filteredData.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              title="تحديد الكل / إلغاء التحديد"
              onClick={(e) => e.stopPropagation()}
            />
            <span>Customer Name</span>
          </div>
        ),
        cell: (info) => {
          const customerName = info.getValue();
          const handleCopy = async (e: React.MouseEvent) => {
            e.stopPropagation();
            // Grab the element BEFORE awaiting (React may null out event fields after await)
            const buttonEl = (e.currentTarget as HTMLButtonElement | null);
            const originalTitle = buttonEl?.title || 'نسخ اسم العميل';
            const success = await copyToClipboard(customerName);
            if (success) {
              if (!buttonEl) return;
              buttonEl.title = 'تم النسخ!';
              setTimeout(() => {
                buttonEl.title = originalTitle;
              }, 2000);
            }
          };
          return (
            <div className="flex items-center gap-2 w-full">
              <input
                type="checkbox"
                checked={selectedCustomersForDownload.has(customerName)}
                onChange={() => toggleCustomerSelection(customerName)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 shrink-0"
              />
              <button
                onClick={() => setSelectedCustomer(customerName)}
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left flex-1 flex items-center gap-2"
              >
                {customerName}
                {info.row.original.hasOpenMatchings && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Has Open Matching"></span>
                )}
              </button>
              <button
                onClick={handleCopy}
                className="flex flex-col gap-0.5 p-1 hover:bg-gray-100 rounded transition-colors shrink-0"
                title="نسخ اسم العميل"
              >
                <div className="w-3 h-3 border border-gray-600 rounded-sm"></div>
                <div className="w-3 h-3 border border-gray-600 rounded-sm"></div>
              </button>
            </div>
          );
        },
      }),
      columnHelper.accessor(row => row.salesReps, {
        id: 'salesReps',
        header: 'City',
        cell: (info) => {
          const val = info.getValue() as Set<string> | undefined;
          if (val && val instanceof Set && val.size > 0) {
            return Array.from(val).join(', ');
          }
          if (Array.isArray(val) && (val as string[]).length > 0) {
            return (val as string[]).join(', ');
          }
          return '-';
        },
      }),
      columnHelper.accessor('netDebt', {
        header: 'Net Debit',
        cell: (info) => {
          const value = info.getValue();
          const customer = info.row.original;
          return (
            <button
              onClick={() => setSelectedCustomerForMonths(customer.customerName)}
              className={`hover:underline cursor-pointer transition-colors ${value > 0 ? 'text-red-600 hover:text-red-700' : value < 0 ? 'text-green-600 hover:text-green-700' : 'text-gray-600 hover:text-gray-700'}`}
              title="Click to view monthly debt breakdown"
            >
              {value.toLocaleString('en-US')}
            </button>
          );
        },
      }),
      ...(mode === 'OB_POS' || mode === 'OB_NEG' ? [
        columnHelper.accessor('openOBAmount', {
          header: 'OB Amount',
          cell: (info) => {
            const val = info.getValue() || 0;
            return (
              <span className={`font-bold ${val > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {val.toLocaleString('en-US')}
              </span>
            );
          },
        })
      ] : []),
      // Conditional Collection Rate (Visible only in DEBIT mode)
      ...(mode === 'DEBIT' ? [
        columnHelper.display({
          id: 'collectionRate',
          header: 'Collection Rate',
          cell: (info) => {
            const customer = info.row.original;
            // If net debt is negative (creditor), show "-"
            if (customer.netDebt < 0) {
              return <span className="text-gray-500">-</span>;
            }

            const totalDebit = customer.totalDebit;
            const collectionRate = totalDebit > 0
              ? ((customer.totalCredit / totalDebit) * 100)
              : 0;

            // Calculate breakdown relative to Total Credit (Share of Collection)
            const creditDenom = customer.totalCredit || 0;
            const payRate = creditDenom > 0 ? ((customer.creditPayments || 0) / creditDenom * 100) : 0;
            const returnRate = creditDenom > 0 ? ((customer.creditReturns || 0) / creditDenom * 100) : 0;
            const discountRate = creditDenom > 0 ? ((customer.creditDiscounts || 0) / creditDenom * 100) : 0;

            return (
              <button
                onClick={() => {
                  // Calculate rankings within the current filtered view
                  const stats = filteredData.map(c => {
                    const denom = c.totalCredit || 0;
                    return {
                      name: c.customerName,
                      collRate: c.totalDebit > 0 ? (c.totalCredit / c.totalDebit * 100) : 0,
                      payRate: denom > 0 ? ((c.creditPayments || 0) / denom * 100) : 0,
                      returnRate: denom > 0 ? ((c.creditReturns || 0) / denom * 100) : 0,
                      discountRate: denom > 0 ? ((c.creditDiscounts || 0) / denom * 100) : 0,
                    };
                  });

                  const getRank = (metric: keyof typeof stats[0], val: number) => {
                    // Sort descending
                    const sorted = [...stats].sort((a, b) => Number(b[metric]) - Number(a[metric]));
                    // Find index (1-based)
                    return sorted.findIndex(s => s.name === customer.customerName) + 1;
                  };

                  const collRank = getRank('collRate', collectionRate);
                  const payRank = getRank('payRate', payRate);
                  const returnRank = getRank('returnRate', returnRate);
                  const discountRank = getRank('discountRate', discountRate);

                  setSelectedCollectionStats({
                    customer,
                    ranks: {
                      collRank,
                      payRank,
                      returnRank,
                      discountRank,
                      totalCount: filteredData.length
                    },
                    rates: {
                      payRate,
                      returnRate,
                      discountRate
                    }
                  });
                }}
                className="flex flex-col items-start hover:bg-gray-50 p-1 rounded-lg transition-colors text-left group w-full"
              >
                <div className="flex items-center gap-1">
                  <span className={`font-bold ${collectionRate >= 80 ? 'text-green-600' : collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {collectionRate.toFixed(1)}%
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  ({payRate.toFixed(0)}%, {returnRate.toFixed(0)}%, {discountRate.toFixed(0)}%)
                </span>
              </button>
            );
          },
        })
      ] : []),

      columnHelper.display({
        id: 'debtRating',
        header: 'Debit Rating',
        cell: (info) => {
          const customer = info.row.original;
          const rating = calculateDebtRating(customer, closedCustomers);
          const colorClass = rating === 'Good' ? 'text-green-600' : rating === 'Medium' ? 'text-yellow-600' : 'text-red-600';
          const bgClass = rating === 'Good' ? 'bg-green-50' : rating === 'Medium' ? 'bg-yellow-50' : 'bg-red-50';
          return (
            <button
              onClick={() => {
                const breakdown = calculateDebtRating(customer, closedCustomers, true);
                setSelectedRatingCustomer(customer);
                setRatingBreakdown(breakdown);
              }}
              className={`px-3 py-1 rounded-full text-sm font-semibold ${colorClass} ${bgClass} border ${rating === 'Good' ? 'border-green-200' : rating === 'Medium' ? 'border-yellow-200' : 'border-red-200'} hover:shadow-md transition-all cursor-pointer`}
              title="Click to view rating details"
            >
              {rating}
            </button>
          );
        },
      }),
    ],
    [closedCustomers, selectedCustomersForDownload, filteredData, mode]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  const totalDebt = filteredData.reduce((sum, c) => sum + c.netDebt, 0);

  // Filter invoices for selected customer
  const selectedCustomerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return data.filter((row) => row.customerName === selectedCustomer);
  }, [selectedCustomer, data]);

  // If a customer is selected, show their details
  if (selectedCustomer) {
    return (
      <CustomerDetails
        customerName={selectedCustomer}
        invoices={selectedCustomerInvoices}
        onBack={() => {
          setSelectedCustomer(null);
          setInitialCustomerTab(undefined);
        }}
        initialTab={initialCustomerTab}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">

        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 px-4 py-3 rounded-xl shadow-sm border border-blue-100 mb-6 transition-all duration-300 relative">
          <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left Side - Total Net Debit */}
            <div className="flex items-center gap-3 shrink-0">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${totalDebt > 0
                ? 'bg-gradient-to-br from-red-500 to-red-600'
                : 'bg-gradient-to-br from-green-500 to-green-600'
                }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Net Debit</p>
                <p className="text-xl font-bold">
                  <span className={totalDebt > 0 ? 'text-red-600' : 'text-green-600'}>
                    {totalDebt.toLocaleString('en-US')}
                  </span>
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  <span className="font-medium">{filteredData.length}</span> customers
                </p>
              </div>
            </div>

            {/* Right Side - Search & Actions */}
            <div className="flex items-center justify-center gap-3 w-full lg:w-auto lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2">
              {/* Search Bar */}
              <div className="relative flex-grow min-w-[450px] max-w-2xl">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by customer name or invoice number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm"
                />
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm border ${debtOperator || lastPaymentValue || lastPaymentAmountOperator || noSalesValue || lastSalesAmountOperator || debtType !== 'ALL' || minTotalDebit || netSalesOperator || collectionRateOperator || overdueAmount || overdueAging.length > 0 || dateRangeFrom || dateRangeTo || hasOB || filterYear || filterMonth || collectionRateTypes.size !== 3
                  ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                title="Advanced Filters"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
              </button>
              {/* Red dot removed */}

              {/* View Mode Toggle */}
              <button
                onClick={() => setViewMode(prev => prev === 'DEFAULT' ? 'SUMMARY' : 'DEFAULT')}
                className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm border ${viewMode === 'SUMMARY'
                  ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                title={viewMode === 'DEFAULT' ? "Switch to Summary View" : "Switch to Default View"}
              >
                {viewMode === 'DEFAULT' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.414V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportToExcel(filteredData, `customers_export_${new Date().toISOString().split('T')[0]}`, closedCustomers, data)}
                  className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all shadow-sm border border-green-200 hover:border-green-300"
                  title="Export to Excel (Summary + Net Only Details)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                <button
                  onClick={() => exportToPDF(filteredData, `customers_report_${new Date().toISOString().split('T')[0]}`, closedCustomers)}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all shadow-sm border border-red-200 hover:border-red-300"
                  title="Export to PDF"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Bulk Download Button */}
                <div className="flex gap-1 items-center">
                  {selectedCustomersForDownload.size > 0 && (
                    <>
                      <button
                        onClick={handleBulkDownload}
                        disabled={isDownloading}
                        className="p-2 bg-red-600 text-white hover:bg-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all shadow-sm border border-red-200 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                        title={`Summary PDF para ${selectedCustomersForDownload.size} clientes`}
                      >
                        {isDownloading ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-bold bg-red-700 px-1.5 py-0.5 rounded-full">{selectedCustomersForDownload.size}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleBulkZIPDownload}
                        disabled={isDownloading}
                        className="p-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm border border-blue-200 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                        title={`Download ${selectedCustomersForDownload.size} account statements Zip`}
                      >
                        {isDownloading ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-bold bg-blue-700 px-1.5 py-0.5 rounded-full">{selectedCustomersForDownload.size}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleBulkPrint}
                        disabled={isDownloading}
                        className="p-2 bg-teal-600 text-white hover:bg-teal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-sm border border-teal-200 hover:border-teal-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                        title={`Print Statements for ${selectedCustomersForDownload.size} customers`}
                      >
                        {isDownloading ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span className="text-xs font-bold bg-teal-700 px-1.5 py-0.5 rounded-full">{selectedCustomersForDownload.size}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleBulkEmail}
                        disabled={isDownloading}
                        className="p-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-sm border border-purple-200 hover:border-purple-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                        title={`Generate Emails for ${selectedCustomersForDownload.size} customers`}
                      >
                        {isDownloading ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            <span className="text-xs font-bold bg-purple-700 px-1.5 py-0.5 rounded-full">{selectedCustomersForDownload.size}</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header with Sort Controls - Visible only in DEFAULT mode */}
      {viewMode === 'DEFAULT' && (
        <div className="mb-4 bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 p-4 rounded-xl border-2 border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {table.getHeaderGroups().map((headerGroup) => (
              <div key={headerGroup.id} className="contents">
                {headerGroup.headers.map((header, index) => {
                  const columnId = header.column.id;
                  const isSelectColumn = columnId === 'select';
                  return (
                    <div
                      key={header.id}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm uppercase tracking-wider text-gray-700 ${columnId === 'customerName' ? 'md:col-span-2' : ''
                        } ${isSelectColumn ? '' : 'hover:bg-white cursor-pointer'}`}
                    >
                      {isSelectColumn ? (
                        flexRender(header.column.columnDef.header, header.getContext())
                      ) : (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center justify-center gap-2 w-full"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-blue-600">
                            {{
                              asc: '↑',
                              desc: '↓',
                            }[header.column.getIsSorted() as string] ?? (
                                <span className="text-gray-300">↕</span>
                              )}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards Grid - Visible only in DEFAULT mode */}
      {viewMode === 'DEFAULT' && (
        <div className="space-y-3 mb-6">
          {table.getRowModel().rows.map((row) => {
            const customer = row.original;
            const netDebt = customer.netDebt;
            const totalDebit = customer.totalDebit;
            const collectionRate = totalDebit > 0
              ? ((customer.totalCredit / totalDebit) * 100)
              : 0;
            const creditDenom = customer.totalCredit || 0;
            const payRate = creditDenom > 0 ? ((customer.creditPayments || 0) / creditDenom * 100) : 0;
            const returnRate = creditDenom > 0 ? ((customer.creditReturns || 0) / creditDenom * 100) : 0;
            const discountRate = creditDenom > 0 ? ((customer.creditDiscounts || 0) / creditDenom * 100) : 0;
            const rating = calculateDebtRating(customer, closedCustomers);
            const ratingColor = rating === 'Good' ? 'from-emerald-500 to-green-600' : rating === 'Medium' ? 'from-amber-500 to-yellow-600' : 'from-red-500 to-rose-600';
            const ratingBg = rating === 'Good' ? 'bg-emerald-50 border-emerald-200' : rating === 'Medium' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
            const ratingText = rating === 'Good' ? 'text-emerald-700' : rating === 'Medium' ? 'text-amber-700' : 'text-red-700';

            return (
              <div
                key={row.id}
                className="bg-white rounded-xl border-2 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 hover:border-blue-300 overflow-hidden group"
              >
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    {/* Customer Name with Checkbox */}
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCustomersForDownload.has(customer.customerName)}
                          onChange={() => toggleCustomerSelection(customer.customerName)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                        <button
                          onClick={() => setSelectedCustomer(customer.customerName)}
                          className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors text-left flex-1 group-hover:underline"
                        >
                          {customer.customerName}
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Grab the element BEFORE awaiting (React may null out event fields after await)
                            const buttonEl = (e.currentTarget as HTMLButtonElement | null);
                            const originalTitle = buttonEl?.title || 'Copy customer name';
                            const success = await copyToClipboard(customer.customerName);
                            if (success) {
                              if (!buttonEl) return;
                              buttonEl.title = 'Copied!';
                              setTimeout(() => {
                                buttonEl.title = originalTitle;
                              }, 2000);
                            }
                          }}
                          className="flex flex-col gap-0.5 p-1 hover:bg-gray-100 rounded transition-colors shrink-0"
                          title="Copy customer name"
                        >
                          <div className="w-3 h-3 border border-gray-600 rounded-sm"></div>
                          <div className="w-3 h-3 border border-gray-600 rounded-sm"></div>
                        </button>
                      </div>
                    </div>

                    {/* City / Sales Reps */}
                    <div className="md:col-span-1 hidden md:flex items-center justify-center">
                      <span className="text-sm font-semibold text-gray-700 text-center">
                        {(() => {
                          const val = customer.salesReps;
                          if (val && val instanceof Set && val.size > 0) {
                            return Array.from(val).join(', ');
                          }
                          if (Array.isArray(val) && (val as string[]).length > 0) {
                            return (val as string[]).join(', ');
                          }
                          return '-';
                        })()}
                      </span>
                    </div>

                    {/* Net Debit */}
                    <div className="md:col-span-1">
                      <button
                        onClick={() => setSelectedCustomerForMonths(customer.customerName)}
                        className={`text-xl font-bold transition-colors w-full text-center ${netDebt > 0
                          ? 'text-red-600 hover:text-red-700'
                          : netDebt < 0
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-gray-600 hover:text-gray-700'
                          }`}
                        title="Click to view monthly debt breakdown"
                      >
                        {netDebt.toLocaleString('en-US')}
                      </button>
                    </div>

                    {/* OB Amount (Visible only in OB modes) */}
                    {(mode === 'OB_POS' || mode === 'OB_NEG') && (
                      <div className="md:col-span-1">
                        <div className="text-xl font-bold transition-colors w-full text-center">
                          <span className={`${(customer.openOBAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {(customer.openOBAmount || 0).toLocaleString('en-US')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Collection Rate (Visible only in DEBIT mode) */}
                    {mode === 'DEBIT' && (
                      <div className="md:col-span-1">
                        {customer.netDebt < 0 ? (
                          <div className="text-center">
                            <span className="text-gray-500 text-xl font-bold">-</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              // Disable popup if date filter is active
                              const isDateFilterActive = filterYear || filterMonth || dateRangeFrom || dateRangeTo;
                              if (isDateFilterActive) return;

                              // Calculate rankings within the current filtered view
                              const stats = filteredData.map(c => {
                                const denom = c.totalCredit || 0;
                                return {
                                  name: c.customerName,
                                  collRate: c.totalDebit > 0 ? (c.totalCredit / c.totalDebit * 100) : 0,
                                  payRate: denom > 0 ? ((c.creditPayments || 0) / denom * 100) : 0,
                                  returnRate: denom > 0 ? ((c.creditReturns || 0) / denom * 100) : 0,
                                  discountRate: denom > 0 ? ((c.creditDiscounts || 0) / denom * 100) : 0,
                                };
                              });

                              const getRank = (metric: keyof typeof stats[0], val: number) => {
                                // Sort descending
                                const sorted = [...stats].sort((a, b) => Number(b[metric]) - Number(a[metric]));
                                // Find index (1-based)
                                return sorted.findIndex(s => s.name === customer.customerName) + 1;
                              };

                              const collRank = getRank('collRate', collectionRate);
                              const payRank = getRank('payRate', payRate);
                              const returnRank = getRank('returnRate', returnRate);
                              const discountRank = getRank('discountRate', discountRate);

                              setSelectedCollectionStats({
                                customer,
                                ranks: {
                                  collRank,
                                  payRank,
                                  returnRank,
                                  discountRank,
                                  totalCount: filteredData.length
                                },
                                rates: {
                                  payRate,
                                  returnRate,
                                  discountRate
                                }
                              });
                            }}
                            className={`flex flex-col items-center gap-2 w-full rounded-lg p-1 transition-colors ${filterYear || filterMonth || dateRangeFrom || dateRangeTo
                              ? 'cursor-default'
                              : 'hover:bg-gray-50 group cursor-pointer'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-xl font-bold ${collectionRate >= 80
                                ? 'text-green-600'
                                : collectionRate >= 50
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                                }`}>
                                {collectionRate.toFixed(1)}%
                              </span>
                              {!(filterYear || filterMonth || dateRangeFrom || dateRangeTo) && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              {!(filterYear || filterMonth || dateRangeFrom || dateRangeTo) && (
                                <span className="text-xs text-gray-500">
                                  ({payRate.toFixed(0)}%, {returnRate.toFixed(0)}%, {discountRate.toFixed(0)}%)
                                </span>
                              )}
                            </div>
                            <div className="w-full max-w-[120px] h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${collectionRate >= 80
                                  ? 'bg-green-500'
                                  : collectionRate >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                  }`}
                                style={{ width: `${Math.min(collectionRate, 100)}%` }}
                              />
                            </div>
                          </button>
                        )}
                      </div>
                    )}



                    {/* Debit Rating */}
                    <div className="md:col-span-1">
                      <div className="flex justify-center">
                        <button
                          onClick={() => {
                            const breakdown = calculateDebtRating(customer, closedCustomers, true);
                            setSelectedRatingCustomer(customer);
                            setRatingBreakdown(breakdown);
                          }}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${ratingText} ${ratingBg} border-2 transition-all hover:shadow-lg hover:scale-105 cursor-pointer`}
                          title="اضغط لعرض تفاصيل التقييم"
                        >
                          <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${ratingColor}`}></div>
                          {rating}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUMMARY View */}
      {viewMode === 'SUMMARY' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border-collapse table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-1 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 w-10">
                    #
                  </th>
                  <th className="px-2 py-4 text-center text-xs font-bold text-white bg-green-600 uppercase tracking-wider border-r border-gray-200 w-48">
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="checkbox"
                        checked={filteredData.length > 0 && selectedCustomersForDownload.size === filteredData.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-white bg-green-700 border-green-500 rounded focus:ring-green-500"
                        title="Select All"
                      />
                      <span>Customer Name</span>
                    </div>
                  </th>
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-green-600 uppercase tracking-wider border-r border-gray-200 w-24">City / Rep</th>
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-green-600 uppercase tracking-wider border-r border-gray-200 w-28">Total Debt</th>

                  {/* Payment Group */}
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-blue-600 uppercase tracking-wider border-r border-blue-500 w-20">Last Pay Date</th>
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-blue-600 uppercase tracking-wider border-r border-blue-500 w-24">Last Pay Amt</th>
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-blue-600 uppercase tracking-wider border-r border-blue-500 w-24">Pay (90d)</th>
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-blue-600 uppercase tracking-wider border-r border-blue-500 w-16"># Pay (90d)</th>
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-blue-600 uppercase tracking-wider border-r border-gray-200 w-16">Coll Rate (Pay)</th>

                  {/* Sales Group */}
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-orange-600 uppercase tracking-wider border-r border-orange-500 w-20">Last Sale Date</th>
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-orange-600 uppercase tracking-wider border-r border-orange-500 w-24">Last Sale Amt</th>
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-orange-600 uppercase tracking-wider border-r border-orange-500 w-24">Sales (90d)</th>
                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-orange-600 uppercase tracking-wider border-r border-gray-200 w-16"># Sales (90d)</th>

                  <th className="px-1 py-4 text-center text-xs font-bold text-white bg-purple-600 uppercase tracking-wider w-16">Rating</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.map((row, index) => {
                  const customer = row.original;
                  const collRate = customer.totalDebit > 0 ? ((customer.creditPayments || 0) / customer.totalDebit * 100) : 0;
                  const rating = calculateDebtRating(customer, closedCustomers);

                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-1 py-2 text-center text-xs font-medium text-gray-500 border-r border-gray-100">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2 border-r border-gray-100 overflow-hidden text-ellipsis whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedCustomersForDownload.has(customer.customerName)}
                            onChange={() => toggleCustomerSelection(customer.customerName)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 shrink-0"
                          />
                          <button
                            onClick={() => setSelectedCustomer(customer.customerName)}
                            className="text-xs font-bold text-gray-900 hover:text-blue-600 hover:underline text-center w-full truncate"
                            title={customer.customerName}
                          >
                            {customer.customerName}
                          </button>
                        </div>
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100 truncate">
                        {(() => {
                          const val = customer.salesReps;
                          if (val && val instanceof Set && val.size > 0) return Array.from(val).join(', ');
                          if (Array.isArray(val) && val.length > 0) return val.join(', ');
                          return '-';
                        })()}
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                        {customer.netDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Payment Columns */}
                      <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100">
                        {customer.lastPaymentDate ? formatDmy(customer.lastPaymentDate) : '-'}
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                        {customer.lastPaymentDate ? (customer.lastPaymentAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0) : '-'}
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                        {(customer.payments3m || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100">
                        {customer.paymentsCount3m || 0}
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                        {collRate.toFixed(1)}%
                      </td>

                      {/* Sales Columns */}
                      <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100">
                        {customer.lastSalesDate ? formatDmy(customer.lastSalesDate) : '-'}
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                        {customer.lastSalesDate ? (customer.lastSalesAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0) : '-'}
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                        {(customer.sales3m || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100">
                        {customer.salesCount3m || 0}
                      </td>

                      <td className="px-1 py-2 text-center text-xs font-bold border-gray-100">
                        <span className={`px-2 py-0.5 rounded-full ${rating === 'Good' ? 'bg-green-100 text-green-800' : rating === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {rating}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-xs uppercase tracking-wider">Total</td>
                  <td className="px-1 py-4 text-center text-xs">
                    {filteredData.reduce((sum, c) => sum + c.netDebt, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td colSpan={10}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Total Summary Card */}
      < div className="bg-gray-50 rounded-lg border border-gray-200 p-4" >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <p className="text-sm font-semibold text-gray-700">Summary</p>
          </div>
          <div className="md:col-span-1">
            <p className={`text-xl font-bold text-center ${filteredData.reduce((sum, c) => sum + c.netDebt, 0) > 0
              ? 'text-red-600'
              : filteredData.reduce((sum, c) => sum + c.netDebt, 0) < 0
                ? 'text-green-600'
                : 'text-gray-600'
              }`}>
              {filteredData.reduce((sum, c) => sum + c.netDebt, 0).toLocaleString('en-US')}
            </p>
          </div>
          <div className="md:col-span-1">
            {(() => {
              const totalNetDebt = filteredData.reduce((sum, c) => sum + c.netDebt, 0);
              if (totalNetDebt < 0) {
                return <p className="text-gray-500 text-xl font-bold text-center">-</p>;
              }
              const totalDebit = filteredData.reduce((sum, c) => sum + c.totalDebit, 0);
              const totalCredit = filteredData.reduce((sum, c) => sum + c.totalCredit, 0);
              const avgCollectionRate = totalDebit > 0 ? ((totalCredit / totalDebit) * 100) : 0;
              const rateColor = avgCollectionRate >= 80 ? 'text-green-600' : avgCollectionRate >= 50 ? 'text-yellow-600' : 'text-red-600';
              return (
                <p className={`text-xl font-bold text-center ${rateColor}`}>
                  {avgCollectionRate.toFixed(1)}%
                </p>
              );
            })()}
          </div>
          <div className="md:col-span-1">
            <p className="text-xl font-bold text-blue-600 text-center">
              {filteredData.length}
            </p>
          </div>
        </div>
      </div >




      {/* Filter Modal */}
      {
        isFilterModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Advanced Filters</h3>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-blue-600">{filteredData.length}</span> results found
                  </p>
                </div>
                <button onClick={() => setIsFilterModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Modal Body - Split Layout */}
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-48 bg-gray-50 border-r border-gray-100 p-2 space-y-1 overflow-y-auto">
                  <button
                    onClick={() => setActiveFilterModalTab('DATE')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeFilterModalTab === 'DATE' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                  >
                    General Filters
                  </button>
                  <button
                    onClick={() => setActiveFilterModalTab('DEBIT')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeFilterModalTab === 'DEBIT' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                  >
                    Debit & Collection
                  </button>
                  <button
                    onClick={() => setActiveFilterModalTab('OVERDUE')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeFilterModalTab === 'OVERDUE' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                  >
                    Overdue
                  </button>
                  <button
                    onClick={() => setActiveFilterModalTab('SALES')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeFilterModalTab === 'SALES' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                  >
                    Sales Activity
                  </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 overflow-y-auto bg-white">
                  {activeFilterModalTab === 'DATE' && (
                    <div className="space-y-6 max-w-lg">
                      <h4 className="text-base font-semibold text-gray-800 border-b pb-2">General Filters</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Year</label>
                            <input
                              type="number"
                              placeholder="YYYY"
                              className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={filterYear}
                              onChange={(e) => setFilterYear(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Month</label>
                            <input
                              type="number"
                              placeholder="MM"
                              min="1"
                              max="12"
                              className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={filterMonth}
                              onChange={(e) => setFilterMonth(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">From Date</label>
                          <input
                            type="date"
                            className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            value={dateRangeFrom}
                            onChange={(e) => setDateRangeFrom(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">To Date</label>
                          <input
                            type="date"
                            className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            value={dateRangeTo}
                            onChange={(e) => setDateRangeTo(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Invoice Type</label>
                          <select
                            className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            value={invoiceTypeFilter}
                            onChange={(e) => setInvoiceTypeFilter(e.target.value as 'ALL' | 'OB' | 'SAL')}
                          >
                            <option value="ALL">All (OB & SAL)</option>
                            <option value="OB">Opening Balance (OB) Only</option>
                            <option value="SAL">Sales (SAL) Only</option>
                          </select>
                          <p className="text-xs text-gray-400 mt-1">Filters the specialized Net Debit calculation when date filters are active.</p>
                        </div>

                        {/* Moved Dropdowns */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Status</label>
                            <select
                              value={matchingFilter}
                              onChange={(e) => setMatchingFilter(e.target.value)}
                              className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="ALL">All Statuses</option>
                              <option value="WITH_EMAIL">Customers with Email</option>
                              <option value="RATING_GOOD">Rating: Good</option>
                              <option value="RATING_MEDIUM">Rating: Medium</option>
                              <option value="RATING_BAD">Rating: Bad</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Sales Rep</label>
                            <select
                              value={selectedSalesRep}
                              onChange={(e) => setSelectedSalesRep(e.target.value)}
                              className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="ALL">All Sales Reps</option>
                              {availableSalesReps.map(rep => (
                                <option key={rep} value={rep}>{rep}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Closed Status</label>
                            <select
                              value={closedFilter}
                              onChange={(e) => setClosedFilter(e.target.value as 'ALL' | 'HIDE' | 'ONLY')}
                              className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="ALL">Show Closed</option>
                              <option value="HIDE">Hide Closed</option>
                              <option value="ONLY">Only Closed</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Semi-Closed</label>
                            <select
                              value={semiClosedFilter}
                              onChange={(e) => setSemiClosedFilter(e.target.value as 'ALL' | 'HIDE' | 'ONLY')}
                              className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="ALL">Show Semi-Closed</option>
                              <option value="HIDE">Hide Semi-Closed</option>
                              <option value="ONLY">Only Semi-Closed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFilterModalTab === 'DEBIT' && (
                    <div className="space-y-6 max-w-lg">
                      <h4 className="text-base font-semibold text-gray-800 border-b pb-2">Debit & Collection Logic</h4>
                      <div className="space-y-4">
                        {/* Net Debit */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Net Debit</label>
                          <div className="flex gap-2">
                            <select
                              className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={debtOperator}
                              onChange={(e) => setDebtOperator(e.target.value as any)}
                            >
                              <option value="GT">&gt; More</option>
                              <option value="LT">&lt; Less</option>
                            </select>
                            <input
                              type="number"
                              placeholder="Amount"
                              className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={debtAmount}
                              onChange={(e) => setDebtAmount(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Collection Rate */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Collection Rate</label>
                          <div className="flex gap-2">
                            <select
                              className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={collectionRateOperator}
                              onChange={(e) => setCollectionRateOperator(e.target.value as any)}
                            >
                              <option value="GT">&gt; More</option>
                              <option value="LT">&lt; Less</option>
                            </select>
                            <div className="relative flex-1">
                              <input
                                type="number"
                                placeholder="Percentage"
                                className="w-full bg-white border text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                                value={collectionRateValue}
                                onChange={(e) => setCollectionRateValue(e.target.value)}
                              />
                              <span className="absolute right-3 top-2.5 text-gray-400 text-sm">%</span>
                            </div>
                          </div>
                        </div>

                        {/* Collection Rate Includes */}
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <span className="block text-xs font-semibold text-gray-500 mb-3 uppercase">Calculation Includes:</span>
                          <div className="grid grid-cols-3 gap-2">
                            {['PAYMENT', 'RETURN', 'DISCOUNT'].map(type => (
                              <button
                                key={type}
                                onClick={() => {
                                  const newSet = new Set(collectionRateTypes);
                                  if (newSet.has(type)) newSet.delete(type);
                                  else newSet.add(type);
                                  setCollectionRateTypes(newSet);
                                }}
                                className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${collectionRateTypes.has(type)
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                  }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${collectionRateTypes.has(type) ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Last Payment */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Last Payment Date</label>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="Value"
                                className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                value={lastPaymentValue}
                                onChange={(e) => setLastPaymentValue(e.target.value)}
                              />
                              <select
                                className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                value={lastPaymentUnit}
                                onChange={(e) => setLastPaymentUnit(e.target.value as any)}
                              >
                                <option value="DAYS">Days</option>
                                <option value="MONTHS">Months</option>
                              </select>
                            </div>
                            <select
                              className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={lastPaymentStatus}
                              onChange={(e) => setLastPaymentStatus(e.target.value as any)}
                            >
                              <option value="ACTIVE">Active (Paid recently)</option>
                              <option value="INACTIVE">Inactive (No Payment)</option>
                            </select>
                          </div>
                        </div>

                        {/* Last Payment Amount */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Last Payment Amount</label>
                          <div className="flex gap-2">
                            <select
                              className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={lastPaymentAmountOperator}
                              onChange={(e) => setLastPaymentAmountOperator(e.target.value as any)}
                            >
                              <option value="GT">&gt; More</option>
                              <option value="LT">&lt; Less</option>
                            </select>
                            <input
                              type="number"
                              placeholder="Amount"
                              className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={lastPaymentAmountValue}
                              onChange={(e) => setLastPaymentAmountValue(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* OB Checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer pt-2">
                          <input
                            type="checkbox"
                            checked={hasOB}
                            onChange={(e) => setHasOB(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Has Unpaid OB Invoices</span>
                        </label>

                      </div>
                    </div>
                  )}

                  {activeFilterModalTab === 'OVERDUE' && (
                    <div className="space-y-6 max-w-lg">
                      <h4 className="text-base font-semibold text-gray-800 border-b pb-2">Overdue Filtering</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Minimum Overdue Amount</label>
                          <input
                            type="number"
                            placeholder="Amount"
                            className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            value={overdueAmount}
                            onChange={(e) => setOverdueAmount(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-3 uppercase">Aging Buckets to Include</label>
                          <div className="grid grid-cols-2 gap-2">
                            {['AT_DATE', '1-30', '31-60', '61-90', '91-120', 'OLDER'].map(bucket => (
                              <button
                                key={bucket}
                                onClick={() => {
                                  if (overdueAging.includes(bucket)) {
                                    setOverdueAging(overdueAging.filter(b => b !== bucket));
                                  } else {
                                    setOverdueAging([...overdueAging, bucket]);
                                  }
                                }}
                                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${overdueAging.includes(bucket)
                                  ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                              >
                                <div className={`w-2.5 h-2.5 rounded-full ${overdueAging.includes(bucket) ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                                <span>{bucket}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFilterModalTab === 'SALES' && (
                    <div className="space-y-6 max-w-lg">
                      <h4 className="text-base font-semibold text-gray-800 border-b pb-2">Sales Activity</h4>
                      <div className="space-y-4">
                        {/* Net Sales */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Net Sales Volume</label>
                          <div className="flex gap-2">
                            <select
                              className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={netSalesOperator}
                              onChange={(e) => setNetSalesOperator(e.target.value as any)}
                            >
                              <option value="GT">&gt; More</option>
                              <option value="LT">&lt; Less</option>
                            </select>
                            <input
                              type="number"
                              placeholder="Amount"
                              className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={minTotalDebit}
                              onChange={(e) => setMinTotalDebit(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Last Sales Date */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Last Sales Date</label>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="Value"
                                className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                value={noSalesValue}
                                onChange={(e) => setNoSalesValue(e.target.value)}
                              />
                              <select
                                className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                value={noSalesUnit}
                                onChange={(e) => setNoSalesUnit(e.target.value as any)}
                              >
                                <option value="DAYS">Days</option>
                                <option value="MONTHS">Months</option>
                              </select>
                            </div>
                            <select
                              className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={lastSalesStatus}
                              onChange={(e) => setLastSalesStatus(e.target.value as any)}
                            >
                              <option value="ACTIVE">Active (Sold recently)</option>
                              <option value="INACTIVE">Inactive (No Sales)</option>
                            </select>
                          </div>
                        </div>

                        {/* Last Sales Amount */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Last Sales Amount</label>
                          <div className="flex gap-2">
                            <select
                              className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={lastSalesAmountOperator}
                              onChange={(e) => setLastSalesAmountOperator(e.target.value as any)}
                            >
                              <option value="GT">&gt; More</option>
                              <option value="LT">&lt; Less</option>
                            </select>
                            <input
                              type="number"
                              placeholder="Amount"
                              className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={lastSalesAmountValue}
                              onChange={(e) => setLastSalesAmountValue(e.target.value)}
                            />
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <button
                  onClick={() => {
                    setDebtOperator('');
                    setDebtAmount('');
                    setLastPaymentValue('');
                    setLastPaymentStatus('ACTIVE');
                    setLastPaymentAmountOperator('');
                    setLastPaymentAmountValue('');
                    setNoSalesValue('');
                    setLastSalesStatus('ACTIVE');
                    setLastSalesAmountOperator('');
                    setLastSalesAmountValue('');
                    setMatchingFilter('ALL');
                    setSelectedSalesRep('ALL');
                    setSearchQuery('');
                    setDebtType('ALL');
                    setMinTotalDebit('');
                    setNetSalesOperator('');
                    setCollectionRateOperator('');
                    setCollectionRateValue('');
                    setOverdueAmount('');
                    setOverdueAging([]);
                    setDateRangeFrom('');
                    setDateRangeTo('');
                    setDateRangeType('LAST_TRANSACTION');
                    setHasOB(false);
                    setFilterYear('');
                    setFilterMonth('');
                    setCollectionRateTypes(new Set(['PAYMENT', 'RETURN', 'DISCOUNT']));
                  }}
                  className="text-red-600 hover:text-red-700 text-sm font-semibold px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Reset All Filters
                </button>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all shadow-blue-200"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Rating Breakdown Modal */}
      {
        selectedRatingCustomer && ratingBreakdown && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 animate-in fade-in duration-200"
            onClick={() => {
              setSelectedRatingCustomer(null);
              setRatingBreakdown(null);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-8 py-5 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-md ${ratingBreakdown.rating === 'Good'
                    ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                    : ratingBreakdown.rating === 'Medium'
                      ? 'bg-gradient-to-br from-amber-500 to-yellow-600'
                      : 'bg-gradient-to-br from-red-500 to-rose-600'
                    }`}>
                    {ratingBreakdown.rating === 'Good' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : ratingBreakdown.rating === 'Medium' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedRatingCustomer.customerName}</h3>
                    <p className="text-sm text-gray-500 font-medium">Debit Rating Breakdown</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedRatingCustomer(null);
                    setRatingBreakdown(null);
                  }}
                  className="w-9 h-9 rounded-lg bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center shadow-sm border border-gray-200 hover:border-gray-300"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="px-8 py-6 overflow-y-auto bg-gray-50/50" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                {/* Final Rating */}
                <div className={`mb-8 p-6 rounded-2xl shadow-lg border-2 transition-all ${ratingBreakdown.rating === 'Good'
                  ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/50'
                  : ratingBreakdown.rating === 'Medium'
                    ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200/50'
                    : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/50'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ratingBreakdown.rating === 'Good'
                        ? 'bg-emerald-100 text-emerald-600'
                        : ratingBreakdown.rating === 'Medium'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-red-100 text-red-600'
                        }`}>
                        <span className="text-3xl font-bold">
                          {ratingBreakdown.rating === 'Good' ? '✓' : ratingBreakdown.rating === 'Medium' ? '!' : '✗'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">Final Rating</p>
                        <p className={`text-4xl font-bold tracking-tight ${ratingBreakdown.rating === 'Good'
                          ? 'text-emerald-600'
                          : ratingBreakdown.rating === 'Medium'
                            ? 'text-amber-600'
                            : 'text-red-600'
                          }`}>
                          {ratingBreakdown.rating}
                        </p>
                      </div>
                    </div>
                    <div className="text-right max-w-md">
                      <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Reason</p>
                      <p className="text-base font-medium text-gray-800 leading-relaxed">{ratingBreakdown.reason}</p>
                    </div>
                  </div>
                </div>

                {
                  ratingBreakdown.breakdown && (
                    <>
                      {/* Risk Flags */}
                      {(ratingBreakdown.breakdown.riskFlags.riskFlag1 === 1 || ratingBreakdown.breakdown.riskFlags.riskFlag2 === 1) && (
                        <div className="mb-8">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded-full"></div>
                            <h4 className="text-lg font-bold text-gray-800">Risk Indicators</h4>
                          </div>
                          <div className="space-y-3">
                            {ratingBreakdown.breakdown.riskFlags.riskFlag1 === 1 && (
                              <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl shadow-sm">
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-base font-bold text-red-800 mb-1">Risk Indicator 1</p>
                                    <p className="text-sm text-red-700">Net sales last 90 days negative + payment count = 0</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            {ratingBreakdown.breakdown.riskFlags.riskFlag2 === 1 && (
                              <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl shadow-sm">
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-base font-bold text-red-800 mb-1">Risk Indicator 2</p>
                                    <p className="text-sm text-red-700">No payment last 90 days + no sale last 90 days + positive debt</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Scores Breakdown */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                          <h4 className="text-lg font-bold text-gray-800">Score Details</h4>
                          <div className="ml-auto px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                            Total: {ratingBreakdown.breakdown.totalScore}/{ratingBreakdown.breakdown.maxPossibleScore || 16}
                          </div>
                        </div>
                        {/* First Row: 2 Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {/* Net Debit */}
                          <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Debit</p>
                              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ratingBreakdown.breakdown.scores.score1 === 2
                                ? 'bg-emerald-100 text-emerald-700'
                                : ratingBreakdown.breakdown.scores.score1 === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                {ratingBreakdown.breakdown.scores.score1}/2
                              </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{ratingBreakdown.breakdown.netDebt.toLocaleString('en-US')}</p>
                          </div>

                          {/* Collection Rate */}
                          <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Collection Rate</p>
                              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ratingBreakdown.breakdown.scores.score2 === 2
                                ? 'bg-emerald-100 text-emerald-700'
                                : ratingBreakdown.breakdown.scores.score2 === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                {ratingBreakdown.breakdown.scores.score2}/2
                              </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <p className="text-2xl font-bold text-gray-900">{ratingBreakdown.breakdown.collRate.toFixed(1)}%</p>
                              {(() => {
                                const creditDenom = selectedRatingCustomer.totalCredit || 0;
                                const payRate = creditDenom > 0 ? ((selectedRatingCustomer.creditPayments || 0) / creditDenom * 100) : 0;
                                const returnRate = creditDenom > 0 ? ((selectedRatingCustomer.creditReturns || 0) / creditDenom * 100) : 0;
                                const discountRate = creditDenom > 0 ? ((selectedRatingCustomer.creditDiscounts || 0) / creditDenom * 100) : 0;
                                return (
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    ({payRate.toFixed(0)}%, {returnRate.toFixed(0)}%, {discountRate.toFixed(0)}%)
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div >

                        {/* Second Row: 3 Cards - Payments */}
                        < div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4" >
                          {/* Last Payment */}
                          < div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow" >
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Payment</p>
                              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ratingBreakdown.breakdown.scores.score3 === 2
                                ? 'bg-emerald-100 text-emerald-700'
                                : ratingBreakdown.breakdown.scores.score3 === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                {ratingBreakdown.breakdown.scores.score3}/2
                              </div>
                            </div >
                            <p className="text-xl font-bold text-gray-900">{ratingBreakdown.breakdown.lastPay}</p>
                          </div >

                          {/* Payment Value */}
                          < div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow" >
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Value</p>
                              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ratingBreakdown.breakdown.scores.score6 === 2
                                ? 'bg-emerald-100 text-emerald-700'
                                : ratingBreakdown.breakdown.scores.score6 === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                {ratingBreakdown.breakdown.scores.score6}/2
                              </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{(ratingBreakdown.breakdown.payments90d || 0).toLocaleString('en-US')}</p>
                            <p className="text-sm text-gray-500 mt-1">Payments Last 90d</p>
                          </div >

                          {/* Payment Count */}
                          < div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow" >
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Count (90d)</p>
                              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ratingBreakdown.breakdown.scores.score4 === 2
                                ? 'bg-emerald-100 text-emerald-700'
                                : ratingBreakdown.breakdown.scores.score4 === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                {ratingBreakdown.breakdown.scores.score4}/2
                              </div>
                            </div >
                            <p className="text-3xl font-bold text-gray-900">{ratingBreakdown.breakdown.payCount}</p>
                          </div >
                        </div >

                        {/* Third Row: 3 Cards - Sales */}
                        < div className="grid grid-cols-1 md:grid-cols-3 gap-4" >
                          {/* Last Sale */}
                          < div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow" >
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Sale</p>
                              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ratingBreakdown.breakdown.scores.score5 === 2
                                ? 'bg-emerald-100 text-emerald-700'
                                : ratingBreakdown.breakdown.scores.score5 === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                {ratingBreakdown.breakdown.scores.score5}/2
                              </div>
                            </div >
                            <p className="text-xl font-bold text-gray-900">{ratingBreakdown.breakdown.lastSale}</p>
                          </div >

                          {/* Sales Value */}
                          < div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow" >
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales Value</p>
                              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ratingBreakdown.breakdown.scores.score7 === 2
                                ? 'bg-emerald-100 text-emerald-700'
                                : ratingBreakdown.breakdown.scores.score7 === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                {ratingBreakdown.breakdown.scores.score7}/2
                              </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{(ratingBreakdown.breakdown.sales90d || 0).toLocaleString('en-US')}</p>
                            <p className="text-sm text-gray-500 mt-1">Sales Last 90d</p>
                          </div >

                          {/* Sales Count */}
                          < div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow" >
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales Count (90d)</p>
                              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ratingBreakdown.breakdown.scores.score8 === 2
                                ? 'bg-emerald-100 text-emerald-700'
                                : ratingBreakdown.breakdown.scores.score8 === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                {ratingBreakdown.breakdown.scores.score8}/2
                              </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{ratingBreakdown.breakdown.salesCount}</p>
                          </div >
                        </div >
                      </div >
                    </>
                  )
                }
              </div >
            </div >
          </div >
        )
      }

      {/* Collection Analysis Rankings Modal */}
      {
        selectedCollectionStats && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 animate-in fade-in duration-200"
            onClick={() => setSelectedCollectionStats(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-8 py-5 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedCollectionStats.customer.customerName}</h3>
                    <p className="text-sm text-gray-500 font-medium">Collection Analysis Rankings</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCollectionStats(null)}
                  className="w-9 h-9 rounded-lg bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center shadow-sm border border-gray-200 hover:border-gray-300"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="px-8 py-6 overflow-y-auto bg-gray-50/50" style={{ maxHeight: 'calc(90vh - 120px)' }}>

                {/* Main Gauge Section - Collection Rate */}
                <div className="mb-8 p-6 rounded-2xl shadow-lg bg-white border border-blue-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -mr-16 -mt-16"></div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        {/* Ring */}
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            className="text-gray-100"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * Math.min(100, (selectedCollectionStats.customer.totalDebit > 0 ? (selectedCollectionStats.customer.totalCredit / selectedCollectionStats.customer.totalDebit * 100) : 0)) / 100)}
                            className={`transition-all duration-1000 ease-out ${(selectedCollectionStats.customer.totalDebit > 0 ? (selectedCollectionStats.customer.totalCredit / selectedCollectionStats.customer.totalDebit * 100) : 0) >= 80 ? 'text-green-500' :
                              (selectedCollectionStats.customer.totalDebit > 0 ? (selectedCollectionStats.customer.totalCredit / selectedCollectionStats.customer.totalDebit * 100) : 0) >= 50 ? 'text-yellow-500' : 'text-red-500'
                              }`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-gray-800">
                            {(selectedCollectionStats.customer.totalDebit > 0 ? (selectedCollectionStats.customer.totalCredit / selectedCollectionStats.customer.totalDebit * 100) : 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">Total Collection Rate</p>
                        <p className="text-3xl font-bold text-gray-900">{selectedCollectionStats.customer.totalCredit.toLocaleString('en-US')} <span className="text-sm font-normal text-gray-500">collected</span></p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full font-bold shadow-sm border border-blue-100">
                        <span className="text-xl">#{selectedCollectionStats.ranks.collRank}</span>
                        <span className="text-sm font-medium opacity-80">of {selectedCollectionStats.ranks.totalCount} customers</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Payments Card */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <span className="block text-2xl font-bold text-green-600">#{selectedCollectionStats.ranks.payRank}</span>
                          <span className="text-xs text-gray-400 font-medium">Rank</span>
                        </div>
                      </div>

                      <h4 className="text-gray-500 font-semibold text-sm uppercase tracking-wide mb-1">Payments Share</h4>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold text-gray-900">{selectedCollectionStats.rates.payRate.toFixed(0)}%</span>
                        <span className="text-sm text-gray-500 font-medium">of total collected</span>
                      </div>
                      <p className="text-sm font-medium text-gray-600 bg-gray-50 inline-block px-2 py-1 rounded border border-gray-100">
                        {(selectedCollectionStats.customer.creditPayments || 0).toLocaleString('en-US')} AED
                      </p>
                    </div>
                  </div>

                  {/* Returns Card */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    {selectedCustomersForDownload.size > 0 && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleBulkDownload}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          )}
                          Summary PDF
                        </button>
                        <button
                          onClick={handleBulkZIPDownload}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          )}
                          Download PDFs (ZIP)
                        </button>
                      </div>
                    )}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <span className="block text-2xl font-bold text-orange-600">#{selectedCollectionStats.ranks.returnRank}</span>
                          <span className="text-xs text-gray-400 font-medium">Rank</span>
                        </div>
                      </div>

                      <h4 className="text-gray-500 font-semibold text-sm uppercase tracking-wide mb-1">Returns Share</h4>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold text-gray-900">{selectedCollectionStats.rates.returnRate.toFixed(0)}%</span>
                        <span className="text-sm text-gray-500 font-medium">of total collected</span>
                      </div>
                      <p className="text-sm font-medium text-gray-600 bg-gray-50 inline-block px-2 py-1 rounded border border-gray-100">
                        {(selectedCollectionStats.customer.creditReturns || 0).toLocaleString('en-US')} AED
                      </p>
                    </div>
                  </div>

                  {/* Discounts Card */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <span className="block text-2xl font-bold text-purple-600">#{selectedCollectionStats.ranks.discountRank}</span>
                          <span className="text-xs text-gray-400 font-medium">Rank</span>
                        </div>
                      </div>

                      <h4 className="text-gray-500 font-semibold text-sm uppercase tracking-wide mb-1">Discounts Share</h4>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold text-gray-900">{selectedCollectionStats.rates.discountRate.toFixed(0)}%</span>
                        <span className="text-sm text-gray-500 font-medium">of total collected</span>
                      </div>
                      <p className="text-sm font-medium text-gray-600 bg-gray-50 inline-block px-2 py-1 rounded border border-gray-100">
                        {(selectedCollectionStats.customer.creditDiscounts || 0).toLocaleString('en-US')} AED
                      </p>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </div>
        )
      }

      {/* Monthly Breakdown Modal */}
      {
        selectedCustomerForMonths && (() => {
          const monthlyData = calculateCustomerMonthlyBreakdown(selectedCustomerForMonths, data);
          const debitMonths = monthlyData.months.filter((m) => m.amount > 0.01);
          const creditMonths = monthlyData.months.filter((m) => m.amount < -0.01);

          return (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 animate-in fade-in duration-200"
              onClick={() => setSelectedCustomerForMonths(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex justify-between items-center px-8 py-5 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{selectedCustomerForMonths}</h3>
                      <p className="text-sm text-gray-500 font-medium">Monthly Debt Breakdown</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCustomerForMonths(null)}
                    className="w-9 h-9 rounded-lg bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center shadow-sm border border-gray-200 hover:border-gray-300"
                    aria-label="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <div className="px-8 py-6 overflow-y-auto bg-gray-50/50" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                  {/* Net Total Summary */}
                  <div className={`mb-8 p-6 rounded-2xl shadow-lg border-2 transition-all ${monthlyData.netTotal > 0
                    ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/50'
                    : monthlyData.netTotal < 0
                      ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/50'
                      : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200/50'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${monthlyData.netTotal > 0
                          ? 'bg-red-100 text-red-600'
                          : monthlyData.netTotal < 0
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-gray-100 text-gray-600'
                          }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Net Total Debt</p>
                          <p className="text-xs text-gray-500 mt-0.5">All open items combined</p>
                        </div>
                      </div>
                      <span className={`text-4xl font-bold tracking-tight ${monthlyData.netTotal > 0
                        ? 'text-red-600'
                        : monthlyData.netTotal < 0
                          ? 'text-emerald-600'
                          : 'text-gray-600'
                        }`}>
                        {Math.round(monthlyData.netTotal).toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>

                  {/* Months Breakdown */}
                  <div className="space-y-6">
                    {/* Debit Months */}
                    {debitMonths.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded-full"></div>
                          <h4 className="text-lg font-bold text-gray-800">Debit Months</h4>
                          <span className="text-sm text-gray-500 font-medium">({debitMonths.length} {debitMonths.length === 1 ? 'month' : 'months'})</span>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                          <div className="grid grid-cols-5 gap-3">
                            {debitMonths.map((m, idx) => (
                              <div
                                key={m.key}
                                className={`w-full px-3 py-2.5 rounded-xl font-semibold text-base transition-all hover:scale-105 shadow-sm text-center ${idx % 2 === 0
                                  ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                                  : 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-orange-200'
                                  }`}
                              >
                                {m.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Credit Months */}
                    {creditMonths.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-green-600 rounded-full"></div>
                          <h4 className="text-lg font-bold text-gray-800">Credit Months</h4>
                          <span className="text-sm text-gray-500 font-medium">({creditMonths.length} {creditMonths.length === 1 ? 'month' : 'months'})</span>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                          <div className="grid grid-cols-5 gap-3">
                            {creditMonths.map((m, idx) => (
                              <div
                                key={m.key}
                                className={`w-full px-3 py-2.5 rounded-xl font-semibold text-base transition-all hover:scale-105 shadow-sm text-center ${idx % 2 === 0
                                  ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-emerald-200'
                                  : 'bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-teal-200'
                                  }`}
                              >
                                {m.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {debitMonths.length === 0 && creditMonths.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 font-medium">No monthly data available</p>
                      </div>
                    )}
                  </div>
                </div >
              </div >
            </div >
          );
        })()
      }
    </div >
  );
}

