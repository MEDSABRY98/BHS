import { InvoiceRow, CustomerAnalysis } from '@/types';
import * as ExcelJS from 'exceljs';
import { exportToPDF as exportToPDFUtil } from '@/app/Debit/CustomersTab/Pdf/AnalysisAllCustomersUtils';
import {
  exportDebitExcelWorkbook,
  recordsFromTable,
} from '@/app/Debit/Utils/ExcelExport';

// Helper function to copy text to clipboard
export const copyToClipboard = async (text: string): Promise<boolean> => {
  const copyWithTextarea = (): boolean => {
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
    } catch {
      document.body.removeChild(textArea);
      return false;
    }
  };

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API failed, using fallback:', err);
  }

  try {
    return copyWithTextarea();
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

export const parseDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p3 > 1000) {
        const parsed = new Date(p3, p2 - 1, p1);
        if (!isNaN(parsed.getTime())) return parsed;
      } else if (p1 > 1000) {
        const parsed = new Date(p1, p2 - 1, p3);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
  }
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  return null;
};

export const formatDmy = (date?: Date | null) => {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const formatMonthLabel = (key: string) => {
  const [year, month] = key.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = monthNames[monthIndex] || month;
  return `${monthName}${year.slice(-2)}`;
};

export const calculateCustomerMonthlyBreakdown = (customerName: string, invoices: InvoiceRow[]) => {
  const customerInvoices = invoices.filter(row => row.customerName === customerName);
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

export const calculateDebtRating = (customer: CustomerAnalysis, returnBreakdown: boolean = false): 'Good' | 'Medium' | 'Bad' | any => {
  const customerNameNormalized = customer.customerName.toLowerCase().trim().replace(/\s+/g, ' ');


  const netDebt = customer.netDebt;
  const collRate = customer.totalDebit > 0 ? (customer.totalCredit / customer.totalDebit) : 0;
  const lastPay = customer.lastPaymentDate;
  const payCount = (customer as any).paymentsCount3m || 0;
  const payments90d = (customer as any).payments3m || 0;
  const sales90d = (customer as any).sales3m || 0;
  const lastSale = customer.lastSalesDate;
  const salesCount = (customer as any).salesCount3m || 0;

  const riskFlag1 = sales90d < 0 && payCount === 0 ? 1 : 0;
  const riskFlag2 = payCount === 0 && salesCount === 0 && netDebt > 0 ? 1 : 0;

  let score1 = 0;
  if (netDebt < 0) score1 = 2;
  else if (netDebt <= 5000) score1 = 2;
  else if (netDebt <= 20000) score1 = 1;
  else score1 = 0;

  let score2 = 0;
  if (collRate >= 0.8) score2 = 2;
  else if (collRate >= 0.5) score2 = 1;
  else score2 = 0;

  let score3 = 0;
  if (lastPay) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastPayDate = new Date(lastPay);
    lastPayDate.setHours(0, 0, 0, 0);
    const daysSinceLastPay = Math.floor((today.getTime() - lastPayDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastPay <= 30) score3 = 2;
    else if (daysSinceLastPay <= 90) score3 = 1;
    else score3 = 0;
  } else score3 = 0;

  let score4 = 0;
  if (payCount >= 2) score4 = 2;
  else if (payCount === 1) score4 = 1;
  else score4 = 0;

  let score5 = 0;
  if (lastSale) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastSaleDate = new Date(lastSale);
    lastSaleDate.setHours(0, 0, 0, 0);
    const daysSinceLastSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastSale <= 30) score5 = 2;
    else if (daysSinceLastSale <= 90) score5 = 1;
    else score5 = 0;
  } else score5 = 0;

  let score6 = 0;
  if (payments90d >= 10000) score6 = 2;
  else if (payments90d >= 2000) score6 = 1;
  else score6 = 0;

  let score7 = 0;
  if (sales90d >= 10000) score7 = 2;
  else if (sales90d >= 2000) score7 = 1;
  else score7 = 0;

  let score8 = 0;
  if (salesCount >= 2) score8 = 2;
  else if (salesCount === 1) score8 = 1;
  else score8 = 0;

  const totalScore = score1 + score2 + score3 + score4 + score5 + score6 + score7 + score8;
  let finalRating: 'Good' | 'Medium' | 'Bad';
  let reason = '';
  if (netDebt < 0) {
    finalRating = 'Good';
    reason = 'Account in Credit';
  } else if (riskFlag1 === 1 || riskFlag2 === 1) {
    finalRating = 'Bad';
    reason = riskFlag1 === 1 ? 'Risk Indicator 1: Negative sales & zero payments (90d)' : 'Risk Indicator 2: No activity with outstanding debt (90d)';
  } else {
    if (totalScore >= 11) finalRating = 'Good';
    else if (totalScore >= 6) finalRating = 'Medium';
    else finalRating = 'Bad';
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
        riskFlags: { riskFlag1, riskFlag2 },
        scores: { score1, score2, score3, score4, score5, score6, score7, score8 },
        totalScore,
        maxPossibleScore: 16
      }
    };
  }
  return finalRating;
};

export const isPaymentTxn = (inv: { number?: string | null; credit?: number | null }): boolean => {
  const num = (inv.number?.toString() || '').toUpperCase();
  if (num.startsWith('BNK')) return true;
  if (num.startsWith('PBNK')) return (inv.credit || 0) > 0.01;
  if ((inv.credit || 0) <= 0.01) return false;
  return (
    !num.startsWith('SAL') &&
    !num.startsWith('RSAL') &&
    !num.startsWith('BIL') &&
    !num.startsWith('JV') &&
    !num.startsWith('OB')
  );
};

export const getPaymentAmount = (inv: { credit?: number | null; debit?: number | null }): number => {
  return (inv.credit || 0) - (inv.debit || 0);
};

export const getOverdueMonths = (customerName: string, invoices: InvoiceRow[]): string => {
  const customerInvoices = invoices.filter(row => row.customerName === customerName);
  const matchingGroups = new Map<string, InvoiceRow[]>();
  customerInvoices.forEach(inv => {
    const key = inv.matching || 'UNMATCHED';
    const group = matchingGroups.get(key) || [];
    group.push(inv);
    matchingGroups.set(key, group);
  });
  const matchingResiduals = new Map<string, { residual: number; residualHolderIndex: number }>();
  matchingGroups.forEach((group, matchingKey) => {
    if (matchingKey === 'UNMATCHED') return;
    const sheetOverrideIndex = group.findIndex(inv => inv.residualAmount !== undefined && Math.abs(inv.residualAmount) > 0.01);
    if (sheetOverrideIndex !== -1) {
      matchingResiduals.set(matchingKey, {
        residual: group[sheetOverrideIndex].residualAmount!,
        residualHolderIndex: sheetOverrideIndex
      });
    }
  });
  const overdueSalesInvoices: InvoiceRow[] = [];
  matchingGroups.forEach((group, matchingKey) => {
    if (matchingKey === 'UNMATCHED') {
      group.forEach(inv => {
        const num = inv.number?.toString().toUpperCase() || '';
        if (num.startsWith('SAL')) {
          const invNetDebt = inv.debit - inv.credit;
          if (Math.abs(invNetDebt) > 0.01) overdueSalesInvoices.push(inv);
        }
      });
    } else {
      const residual = matchingResiduals.get(matchingKey);
      if (residual && Math.abs(residual.residual) > 0.01) {
        const residualHolder = group[residual.residualHolderIndex];
        const num = residualHolder.number?.toString().toUpperCase() || '';
        if (num.startsWith('SAL')) overdueSalesInvoices.push(residualHolder);
      }
    }
  });
  const monthMap = new Map<string, Date>();
  overdueSalesInvoices.forEach(inv => {
    const d = parseDate(inv.date);
    if (d) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthMap.has(key)) monthMap.set(key, new Date(d.getFullYear(), d.getMonth(), 1));
    }
  });
  const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[1].getTime() - b[1].getTime());
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return sortedMonths.map(([key, date]) => `${monthNames[date.getMonth()]}${date.getFullYear().toString().slice(-2)}`).join(', ');
};

export const getInvoiceType = (inv: { number?: string | null; credit?: number | null; debit?: number | null }): string => {
  const num = (inv.number || '').toUpperCase();
  const credit = inv.credit ?? 0;
  const debit = inv.debit ?? 0;
  if (num.startsWith('OB')) return 'Opening Balance';
  if (num.startsWith('BNK')) return 'Payment';
  if (num.startsWith('PBNK')) return debit > 0.01 ? 'Our-Paid' : 'Payment';
  if (num.startsWith('SAL')) return 'Sale';
  if (num.startsWith('RSAL')) return 'Return';
  if (num.startsWith('JV') || num.startsWith('BIL')) return 'Discount';
  if (credit > 0.01) return 'Payment';
  return 'Invoice/Txn';
};

export function generateCustomerAnalysis(data: InvoiceRow[]): CustomerAnalysis[] {
  type CustomerData = CustomerAnalysis & {
    customerId: string;
    matchingsMap: Map<string, number>;
    lastPaymentMatching: string | null;
    lastPaymentAmount: number | null;
    lastSalesAmount: number | null;
    creditPayments: number;
    creditReturns: number;
    creditDiscounts: number;
    sales3m: number;
    salesCount3m: number;
    payments3m: number;
    paymentsCount3m: number;
    paymentDates: Set<string>;
  };
  const customerMap = new Map<string, CustomerData>();
  const now = new Date();
  const date90DaysAgo = new Date();
  date90DaysAgo.setDate(now.getDate() - 90);

  data.forEach((row) => {
    let existing = customerMap.get(row.customerName);
    if (!existing) {
      existing = {
        customerId: row.customerId || '',
        customerName: row.customerName,
        creditLimit: row.creditLimit || 0,
        totalDebit: 0,
        totalCredit: 0,
        netDebt: 0,
        netSales: 0,
        transactionCount: 0,
        matchingsMap: new Map(),
        salesReps: new Set(),
        customerTags: new Set(),
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
        paymentDates: new Set(),
      };
    }

    const n = (row.number || '').toUpperCase();
    let type = '';
    if (n.startsWith('BNK')) type = 'Payment';
    else if (n.startsWith('PBNK') && row.debit > 0.01) type = 'Other';
    else if (n.startsWith('SAL')) type = 'Sales';
    else if (n.startsWith('RSAL')) type = 'Return';
    else if (n.startsWith('JV') || n.startsWith('BIL')) type = 'Discount';
    else if (row.credit > 0.01 && !n.startsWith('PBNK')) type = 'Payment';

    const netCollection = row.credit - row.debit;
    if (type === 'Payment') {
      existing.creditPayments += netCollection;
      existing.totalCredit += netCollection;
    } else if (type === 'Return') {
      existing.creditReturns += netCollection;
      existing.totalCredit += netCollection;
    } else if (type === 'Discount') {
      existing.creditDiscounts += netCollection;
      existing.totalCredit += netCollection;
    } else {
      existing.totalDebit += row.debit;
      existing.totalCredit += row.credit;
    }

    existing.netDebt = existing.totalDebit - existing.totalCredit;
    existing.transactionCount += 1;

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

    const num = row.number?.toString().toUpperCase() || '';
    if (num.startsWith('SAL')) {
      existing.netSales = (existing.netSales || 0) + row.debit;
      existing.totalSalesDebit = (existing.totalSalesDebit || 0) + row.debit;
    } else if (num.startsWith('RSAL')) {
      existing.netSales = (existing.netSales || 0) - row.credit;
    }

    if (row.salesRep && row.salesRep.trim()) existing.salesReps?.add(row.salesRep.trim());
    if (row.customerTag && row.customerTag.trim()) existing.customerTags?.add(row.customerTag.trim());
    if (row.number) existing.invoiceNumbers?.add(row.number.toString());
    if (row.matching) {
      const currentMatchTotal = existing.matchingsMap.get(row.matching) || 0;
      existing.matchingsMap.set(row.matching, currentMatchTotal + (row.debit - row.credit));
    }

    if (rowDate) {
      if (!existing.lastTransactionDate || rowDate > existing.lastTransactionDate) existing.lastTransactionDate = rowDate;
      if (isPaymentTxn(row) && (row.credit || 0) > 0.01) {
        const amount = getPaymentAmount(row);
        if (!existing.lastPaymentDate || rowDate > existing.lastPaymentDate) {
          existing.lastPaymentDate = rowDate;
          existing.lastPaymentMatching = row.matching || 'UNMATCHED';
          existing.lastPaymentAmount = amount;
        } else if (existing.lastPaymentDate && rowDate.getTime() === existing.lastPaymentDate.getTime()) {
          existing.lastPaymentAmount = (existing.lastPaymentAmount || 0) + amount;
        }
        const dKey = rowDate.toISOString().split('T')[0];
        existing.paymentDates.add(dKey);
      }
      const num = row.number?.toString().toUpperCase() || '';
      if (num.startsWith('SAL') && row.debit > 0) {
        if (!existing.lastSalesDate || rowDate > existing.lastSalesDate) {
          existing.lastSalesDate = rowDate;
          existing.lastSalesAmount = row.debit;
        } else if (existing.lastSalesDate && rowDate.getTime() === existing.lastSalesDate.getTime()) {
          existing.lastSalesAmount = (existing.lastSalesAmount || 0) + row.debit;
        }
      }
    }
    customerMap.set(row.customerName, existing);
  });

  const customerInvoicesMap = new Map<string, InvoiceRow[]>();
  data.forEach(row => {
    const invoices = customerInvoicesMap.get(row.customerName) || [];
    invoices.push(row);
    customerInvoicesMap.set(row.customerName, invoices);
  });

  return Array.from(customerMap.values()).map(c => {
    let hasOpen = false;
    for (const amount of c.matchingsMap.values()) {
      if (Math.abs(amount) > 0.01) {
        hasOpen = true;
        break;
      }
    }

    const pDates = Array.from(c.paymentDates).map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
    let avgInterval = 0;
    if (pDates.length > 1) {
      let totalDays = 0;
      for (let i = 1; i < pDates.length; i++) {
        totalDays += (pDates[i].getTime() - pDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      }
      avgInterval = totalDays / (pDates.length - 1);
    }

    const customerInvoices = customerInvoicesMap.get(c.customerName) || [];
    const agingBreakdown = { atDate: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, ninetyOneToOneTwenty: 0, older: 0 };
    let totalOverdue = 0;
    const matchingGroups = new Map<string, InvoiceRow[]>();
    customerInvoices.forEach(inv => {
      const key = inv.matching || 'UNMATCHED';
      const group = matchingGroups.get(key) || [];
      group.push(inv);
      matchingGroups.set(key, group);
    });

    const matchingResiduals = new Map<string, InvoiceRow>();
    matchingGroups.forEach((group, matchingKey) => {
      if (matchingKey === 'UNMATCHED') return;
      let groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
      if (Math.abs(groupNetDebt) <= 0.01) return;
      let residualHolder = group[0];
      let maxDebit = -1;
      group.forEach(inv => { if (inv.debit > maxDebit) { maxDebit = inv.debit; residualHolder = inv; } });
      matchingResiduals.set(matchingKey, residualHolder);
    });

    matchingGroups.forEach((group, matchingKey) => {
      const groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
      if (Math.abs(groupNetDebt) <= 0.01) return;
      if (matchingKey === 'UNMATCHED') {
        group.forEach(inv => {
          const invNetDebt = inv.debit - inv.credit;
          if (Math.abs(invNetDebt) <= 0.01) return;
          let daysOverdue = 0;
          let targetDate = inv.dueDate ? parseDate(inv.dueDate) : (inv.date ? parseDate(inv.date) : null);
          if (targetDate) {
            const today = new Date(); today.setHours(0, 0, 0, 0); targetDate.setHours(0, 0, 0, 0);
            daysOverdue = Math.ceil((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
          }
          if (daysOverdue <= 0) agingBreakdown.atDate += invNetDebt;
          else if (daysOverdue <= 30) agingBreakdown.oneToThirty += invNetDebt;
          else if (daysOverdue <= 60) agingBreakdown.thirtyOneToSixty += invNetDebt;
          else if (daysOverdue <= 90) agingBreakdown.sixtyOneToNinety += invNetDebt;
          else if (daysOverdue <= 120) agingBreakdown.ninetyOneToOneTwenty += invNetDebt;
          else agingBreakdown.older += invNetDebt;
          totalOverdue += invNetDebt;
        });
      } else {
        const firstInv = group[0];
        let daysOverdue = 0;
        let targetDate = firstInv.dueDate ? parseDate(firstInv.dueDate) : (firstInv.date ? parseDate(firstInv.date) : null);
        if (targetDate) {
          const today = new Date(); today.setHours(0, 0, 0, 0); targetDate.setHours(0, 0, 0, 0);
          daysOverdue = Math.ceil((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
        }
        if (daysOverdue <= 0) agingBreakdown.atDate += groupNetDebt;
        else if (daysOverdue <= 30) agingBreakdown.oneToThirty += groupNetDebt;
        else if (daysOverdue <= 60) agingBreakdown.thirtyOneToSixty += groupNetDebt;
        else if (daysOverdue <= 90) agingBreakdown.sixtyOneToNinety += groupNetDebt;
        else if (daysOverdue <= 120) agingBreakdown.ninetyOneToOneTwenty += groupNetDebt;
        else agingBreakdown.older += groupNetDebt;
        totalOverdue += groupNetDebt;
      }
    });

    let hasOBFlag = false;
    let openOBAmount = 0;
    matchingGroups.forEach((group, matchingKey) => {
      if (matchingKey === 'UNMATCHED') {
        group.forEach(inv => {
          const invNetDebt = inv.debit - inv.credit;
          if (Math.abs(invNetDebt) > 0.01 && (inv.number?.toString().toUpperCase() || '').startsWith('OB')) {
            hasOBFlag = true; openOBAmount += invNetDebt;
          }
        });
      } else {
        const residualHolder = matchingResiduals.get(matchingKey);
        if (residualHolder) {
          const groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
          if (Math.abs(groupNetDebt) > 0.01 && (residualHolder.number?.toString().toUpperCase() || '').startsWith('OB')) {
            hasOBFlag = true; openOBAmount += groupNetDebt;
          }
        }
      }
    });

    return {
      customerId: c.customerId, customerName: c.customerName, totalDebit: c.totalDebit, totalCredit: c.totalCredit, netDebt: c.netDebt,
      creditLimit: c.creditLimit,
      netSales: c.netSales || 0, transactionCount: c.transactionCount, hasOpenMatchings: hasOpen, salesReps: c.salesReps, customerTags: c.customerTags, invoiceNumbers: c.invoiceNumbers,
      lastPaymentDate: c.lastPaymentDate, lastPaymentMatching: c.lastPaymentMatching, lastPaymentAmount: c.lastPaymentAmount,
      lastSalesDate: c.lastSalesDate, lastSalesAmount: c.lastSalesAmount, overdueAmount: totalOverdue, hasOB: hasOBFlag, openOBAmount, agingBreakdown,
      payments3m: c.payments3m, paymentsCount3m: c.paymentsCount3m, sales3m: c.sales3m, salesCount3m: c.salesCount3m, lastTransactionDate: c.lastTransactionDate, creditPayments: c.creditPayments,
      creditReturns: c.creditReturns, creditDiscounts: c.creditDiscounts, totalSalesDebit: c.totalSalesDebit, avgPaymentInterval: avgInterval
    };
  }).sort((a, b) => b.netDebt - a.netDebt);
}

export const buildInvoicesWithNetDebtForExport = (invList: InvoiceRow[]) => {
  return invList.map((invoice) => {
    let residual: number | undefined = undefined;
    if (invoice.matching && invoice.residualAmount !== undefined && Math.abs(invoice.residualAmount) > 0.01) {
      residual = invoice.residualAmount;
    }
    return { ...invoice, netDebt: invoice.debit - invoice.credit, residual };
  });
};

/** Keep open invoices only; hide rows where net is exactly zero. */
export const toNetOnlyOpenInvoicesForExport = (
  invList: ReturnType<typeof buildInvoicesWithNetDebtForExport>,
) => {
  return invList
    .filter((inv) => {
      if (!inv.matching) return Math.abs(inv.netDebt) > 0.01;
      return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
    })
    .map((inv) => {
      if (inv.matching && inv.residual !== undefined) {
        return {
          ...inv,
          credit: inv.debit - inv.residual,
          netDebt: inv.residual,
        };
      }
      return inv;
    });
};

export const exportToPDF = async (data: CustomerAnalysis[], filename: string = 'customers_report') => {
  try {
    await exportToPDFUtil(data, filename);
  } catch (error) {
    console.error('Error in exportToPDF:', error);
    alert('Failed to generate PDF');
  }
};

export interface ExportExcelOptions {
  includeNetOnly?: boolean;
  includeDashboard?: boolean;
  includeSummary?: boolean;
  includeYearly?: boolean;
  includeMonthly?: boolean;
  includeAges?: boolean;
  groupByRegion?: boolean;
  includeNegativeBalances?: boolean;
}

export const exportToExcel = async (
  data: CustomerAnalysis[],
  filename: string = 'customers_export',
  invoices: InvoiceRow[] = [],
  yearlyData?: any,
  options?: ExportExcelOptions
) => {
  const opts = {
    includeNetOnly: true,
    includeDashboard: true,
    includeSummary: true,
    includeYearly: true,
    includeMonthly: true,
    includeAges: true,
    groupByRegion: false,
    includeNegativeBalances: true,
    ...options
  };

  if (opts.includeNegativeBalances === false) {
    data = data.filter(c => c.netDebt > 0.01);
  } else {
    data = data.filter(c => Math.abs(c.netDebt) > 0.01);
  }

  if (yearlyData && yearlyData.rows) {
    yearlyData.rows = yearlyData.rows.filter((row: any) => {
      const cInfo = data.find(c => c.customerName === row.customerName);
      return !!cInfo;
    });
  }

  const sheets: any[] = [];

  const getRepsString = (customer: CustomerAnalysis) => {
    if (customer.salesReps && customer.salesReps instanceof Set && customer.salesReps.size > 0) return Array.from(customer.salesReps).join(', ');
    else if (Array.isArray(customer.salesReps) && customer.salesReps.length > 0) return (customer.salesReps as string[]).join(', ');
    return '-';
  };

  const getTagsString = (customer: CustomerAnalysis | undefined | null) => {
    if (!customer?.customerTags) return '';
    if (customer.customerTags instanceof Set) {
      return Array.from(customer.customerTags).sort().join(', ');
    }
    if (Array.isArray(customer.customerTags)) {
      return (customer.customerTags as string[]).join(', ');
    }
    return '';
  };

  const getDaysSinceLastPayment = (customer: CustomerAnalysis | undefined | null) => {
    if (!customer?.lastPaymentDate) return '-';
    const lastPay = customer.lastPaymentDate instanceof Date
      ? customer.lastPaymentDate
      : new Date(customer.lastPaymentDate);
    if (Number.isNaN(lastPay.getTime())) return '-';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const payDay = new Date(lastPay);
    payDay.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - payDay.getTime()) / (1000 * 60 * 60 * 24));
  };

  const uniqueRegions = new Set<string>();
  if (opts.groupByRegion) {
    data.forEach(c => {
      const repStr = getRepsString(c);
      if (repStr !== '-') {
        repStr.split(',').forEach(r => uniqueRegions.add(r.trim()));
      } else {
        uniqueRegions.add('Unassigned');
      }
    });
  }

  // --- Net Only Details ---
  const netOnlyHeaders = ['Customer Name', 'Customer Tag', 'Date', 'Type', 'Invoice Number', 'Debit', 'Credit', 'Net Debt'];
  const buildNetOnlyRows = (dataset: CustomerAnalysis[]) => {
    const rows: any[] = [];
    for (const customer of dataset) {
      const customerInvoices = invoices.filter(row => row.customerName === customer.customerName);
      if (customerInvoices.length === 0) continue;
      const invoicesWithNetDebt = buildInvoicesWithNetDebtForExport(customerInvoices);
      const netOnlyInvoices = invoicesWithNetDebt
        .filter(inv => !inv.matching || (inv.residual !== undefined && Math.abs(inv.residual) > 0.01))
        .map(inv => inv.matching && inv.residual !== undefined ? { ...inv, credit: inv.debit - inv.residual, netDebt: inv.residual } : inv);
      const tag = getTagsString(customer);
      netOnlyInvoices.forEach(inv => {
        rows.push([customer.customerName, tag, formatDmy(parseDate(inv.date)), getInvoiceType(inv), inv.number || '', (inv.debit || 0).toFixed(2), (inv.credit || 0).toFixed(2), (inv.netDebt || 0).toFixed(2)]);
      });
    }
    return rows;
  };

  if (opts.includeNetOnly) {
    sheets.push({
      name: 'Net Only Details',
      data: recordsFromTable(netOnlyHeaders, buildNetOnlyRows(data)),
      options: { numericColumns: ['Debit', 'Credit', 'Net Debt'] },
    });
    if (opts.groupByRegion) {
      Array.from(uniqueRegions).forEach(region => {
        const filtered = data.filter(c => {
          const reps = getRepsString(c);
          if (region === 'Unassigned') return reps === '-';
          return reps.includes(region);
        });
        if (filtered.length > 0) {
          sheets.push({
            name: `Net Only - ${region}`.substring(0, 31),
            data: recordsFromTable(netOnlyHeaders, buildNetOnlyRows(filtered)),
            options: { numericColumns: ['Debit', 'Credit', 'Net Debt'] },
          });
        }
      });
    }
  }

  // --- Dashboard ---
  const dashboardHeaders = ['#', 'Customer Name', 'Customer Tag', 'City', 'Net Debit', 'Debt Rating', 'OB Amount', 'Overdue Amount', 'Collection Rate %', 'Payment Rate %', 'Return Rate %', 'Discount Rate %', 'Average Payment Interval (Days)', 'Last Payment Date', 'Payments Count 90d', 'Payments 90d Amt', 'Net Sales', 'Sales Count 90d', 'Sales 90d Amt'];
  const buildDashboardRows = (dataset: CustomerAnalysis[]) => dataset.map((customer, index) => {
    return [
      index + 1, customer.customerName || '', getTagsString(customer), getRepsString(customer), customer.netDebt.toFixed(2), calculateDebtRating(customer), (customer.openOBAmount || 0).toFixed(2), (customer.overdueAmount || 0).toFixed(2),
      customer.totalDebit > 0 ? ((customer.totalCredit / customer.totalDebit) * 100).toFixed(1) + '%' : '0.0%',
      (customer.totalCredit || 0) > 0 ? ((customer.creditPayments || 0) / customer.totalCredit * 100).toFixed(0) + '%' : '0%',
      (customer.totalCredit || 0) > 0 ? ((customer.creditReturns || 0) / customer.totalCredit * 100).toFixed(0) + '%' : '0%',
      (customer.totalCredit || 0) > 0 ? ((customer.creditDiscounts || 0) / customer.totalCredit * 100).toFixed(0) + '%' : '0%',
      customer.avgPaymentInterval ? customer.avgPaymentInterval.toFixed(1) : '-',
      customer.lastPaymentDate ? formatDmy(customer.lastPaymentDate) : '-',
      (customer as any).paymentsCount3m ?? 0, (customer as any).payments3m?.toFixed(2) || '0.00', (customer.netSales || 0).toFixed(2), (customer as any).salesCount3m ?? 0, (customer as any).sales3m?.toFixed(2) || '0.00'
    ];
  });

  if (opts.includeDashboard) {
    sheets.push({
      name: 'Customers Dashboard',
      data: recordsFromTable(dashboardHeaders, buildDashboardRows(data)),
      options: { numericColumns: ['Net Debit', 'OB Amount', 'Overdue Amount', 'Payments 90d Amt', 'Net Sales', 'Sales 90d Amt'] },
    });
    if (opts.groupByRegion) {
      Array.from(uniqueRegions).forEach(region => {
        const filtered = data.filter(c => {
          const reps = getRepsString(c);
          if (region === 'Unassigned') return reps === '-';
          return reps.includes(region);
        });
        if (filtered.length > 0) {
          sheets.push({
            name: `Dashboard - ${region}`.substring(0, 31),
            data: recordsFromTable(dashboardHeaders, buildDashboardRows(filtered)),
            options: { numericColumns: ['Net Debit', 'OB Amount', 'Overdue Amount', 'Payments 90d Amt', 'Net Sales', 'Sales 90d Amt'] },
          });
        }
      });
    }
  }

  // --- Summary View ---
  const summaryHeaders = ['#', 'Customer Name', 'Customer Tag', 'City / Rep', 'Total Debt', 'Last Pay Date', 'Last Pay Amt', 'Days Since', 'Pay (90d)', '# Pay (90d)', 'Last Sale Date', 'Last Sale Amt', 'Sales (90d)', '# Sales (90d)', 'Rating'];
  const buildSummaryRows = (dataset: CustomerAnalysis[]) => dataset.map((customer, index) => {
    return [
      index + 1, customer.customerName || '', getTagsString(customer), getRepsString(customer), customer.netDebt.toFixed(2), customer.lastPaymentDate ? formatDmy(customer.lastPaymentDate) : '-', (customer.lastPaymentAmount || 0).toFixed(2),
      getDaysSinceLastPayment(customer),
      (customer as any).payments3m?.toFixed(2) || '0.00', (customer as any).paymentsCount3m ?? 0,
      customer.lastSalesDate ? formatDmy(customer.lastSalesDate) : '-', (customer.lastSalesAmount || 0).toFixed(2), (customer as any).sales3m?.toFixed(2) || '0.00', (customer as any).salesCount3m ?? 0, calculateDebtRating(customer)
    ];
  });

  if (opts.includeSummary) {
    sheets.push({
      name: 'Summary View',
      data: recordsFromTable(summaryHeaders, buildSummaryRows(data)),
      options: { numericColumns: ['Total Debt', 'Last Pay Amt', 'Days Since', 'Pay (90d)', 'Last Sale Amt', 'Sales (90d)'] },
    });
    if (opts.groupByRegion) {
      Array.from(uniqueRegions).forEach(region => {
        const filtered = data.filter(c => {
          const reps = getRepsString(c);
          if (region === 'Unassigned') return reps === '-';
          return reps.includes(region);
        });
        if (filtered.length > 0) {
          sheets.push({
            name: `Summary - ${region}`.substring(0, 31),
            data: recordsFromTable(summaryHeaders, buildSummaryRows(filtered)),
            options: { numericColumns: ['Total Debt', 'Last Pay Amt', 'Days Since', 'Pay (90d)', 'Last Sale Amt', 'Sales (90d)'] },
          });
        }
      });
    }
  }

  // --- Yearly View ---
  if (opts.includeYearly && yearlyData && yearlyData.rows.length > 0) {
    const buildYearlySheet = (name: string, dataset: any[]) => {
      const activeYears = new Set<string>();
      dataset.forEach(row => {
        if (row.yearlyAmounts) {
          Object.entries(row.yearlyAmounts).forEach(([yr, amt]) => {
            if (typeof amt === 'number' && Math.abs(amt) > 0.01) {
              activeYears.add(yr);
            }
          });
        }
      });

      const sortedActiveYears = yearlyData.sortedYears.filter((yr: string) => activeYears.has(yr));
      const yearsWithSpaces = sortedActiveYears.map((yr: string) => yr === 'OB' ? yr : `${yr} `);
      
      const yearlyHeaders = ['#', 'Customer Name', 'Customer Tag', 'City', 'Last Payment Date', 'Last Payment Amount', 'Days Since', 'Net Debt', ...yearsWithSpaces];

      const rows = dataset.map((row: any, index: number) => {
        const customerInfo = data.find(c => c.customerName === row.customerName);
        const rowData = [
          index + 1, 
          row.customerName,
          getTagsString(customerInfo),
          row.region,
          customerInfo?.lastPaymentDate ? formatDmy(customerInfo.lastPaymentDate) : '-',
          (customerInfo?.lastPaymentAmount || 0).toFixed(2),
          getDaysSinceLastPayment(customerInfo),
          row.totalNetDebt.toFixed(2),
        ];
        sortedActiveYears.forEach((yr: string) => rowData.push((row.yearlyAmounts[yr] || 0).toFixed(2)));
        return rowData;
      });

      return {
        name,
        data: recordsFromTable(yearlyHeaders, rows),
        options: { numericColumns: ['Last Payment Amount', 'Days Since', 'Net Debt', ...yearsWithSpaces] }
      };
    };

    sheets.push(buildYearlySheet('Yearly View', yearlyData.rows));

    if (opts.groupByRegion) {
      Array.from(uniqueRegions).forEach(region => {
        const filtered = yearlyData.rows.filter((c: any) => {
          const reps = c.region || '-';
          if (region === 'Unassigned') return reps === '-';
          return reps.includes(region);
        });
        if (filtered.length > 0) {
          sheets.push(buildYearlySheet(`Yearly - ${region}`.substring(0, 31), filtered));
        }
      });
    }
  }

  // --- Monthly View ---
  if (opts.includeMonthly) {
    const customerBreakdowns = new Map<string, { netTotal: number; monthsMap: Map<string, number> }>();
    const allUniqueMonthKeys = new Set<string>();

    data.forEach(c => {
      const breakdown = calculateCustomerMonthlyBreakdown(c.customerName, invoices);
      const monthsMap = new Map<string, number>();
      breakdown.months.forEach(m => {
        monthsMap.set(m.key, m.amount);
        allUniqueMonthKeys.add(m.key);
      });
      customerBreakdowns.set(c.customerName, { netTotal: breakdown.netTotal, monthsMap });
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const buildMonthlySheet = (name: string, dataset: CustomerAnalysis[]) => {
      const activeMonthKeys = new Set<string>();
      dataset.forEach(c => {
        const breakdown = customerBreakdowns.get(c.customerName);
        if (breakdown) {
          breakdown.monthsMap.forEach((amt, key) => {
            if (Math.abs(amt) > 0.01) {
              activeMonthKeys.add(key);
            }
          });
        }
      });

      const sortedMonthKeys = Array.from(activeMonthKeys).sort((a, b) => a.localeCompare(b));
      
      const monthHeaders = sortedMonthKeys.map(k => {
        const [y, m] = k.split('-');
        return `${monthNames[parseInt(m, 10) - 1]}-${y.slice(-2)} `; 
      });

      const monthlyHeaders = ['#', 'Customer Name', 'Customer Tag', 'City', 'Last Payment Date', 'Last Payment Amount', 'Days Since', 'Net Debt', ...monthHeaders];

      const rows = dataset.map((c, idx) => {
        const breakdown = customerBreakdowns.get(c.customerName);
        const netTotal = breakdown?.netTotal || 0;
        
        const rowData = [
          idx + 1,
          c.customerName || '',
          getTagsString(c),
          getRepsString(c),
          c.lastPaymentDate ? formatDmy(c.lastPaymentDate) : '-',
          (c.lastPaymentAmount || 0).toFixed(2),
          getDaysSinceLastPayment(c),
          netTotal.toFixed(2),
        ];

        sortedMonthKeys.forEach(k => {
          const amt = breakdown?.monthsMap.get(k) || 0;
          rowData.push(amt.toFixed(2));
        });

        return rowData;
      });

      return {
        name,
        data: recordsFromTable(monthlyHeaders, rows),
        options: { numericColumns: ['Last Payment Amount', 'Days Since', 'Net Debt', ...monthHeaders] }
      };
    };

    sheets.push(buildMonthlySheet('Monthly View', data));

    if (opts.groupByRegion) {
      Array.from(uniqueRegions).forEach(region => {
        const filtered = data.filter(c => {
          const reps = getRepsString(c);
          if (region === 'Unassigned') return reps === '-';
          return reps.includes(region);
        });
        if (filtered.length > 0) {
          sheets.push(buildMonthlySheet(`Monthly - ${region}`.substring(0, 31), filtered));
        }
      });
    }
  }

  // --- Ages View ---
  if (opts.includeAges) {
    const ageHeaders = ['0 - 30', '31 - 60', '61 - 90', '91 - 120', 'OLDER'];

    const getAgeBuckets = (c: CustomerAnalysis) => {
      const a = c.agingBreakdown;
      return {
        zeroToThirty: (a?.atDate || 0) + (a?.oneToThirty || 0),
        thirtyOneToSixty: a?.thirtyOneToSixty || 0,
        sixtyOneToNinety: a?.sixtyOneToNinety || 0,
        ninetyOneToOneTwenty: a?.ninetyOneToOneTwenty || 0,
        older: a?.older || 0,
      };
    };

    const buildAgesSheet = (name: string, dataset: CustomerAnalysis[]) => {
      const agesHeaders = [
        '#',
        'Customer Name',
        'Customer Tag',
        'City',
        'Last Payment Date',
        'Last Payment Amount',
        'Days Since',
        'Net Debt',
        ...ageHeaders,
      ];

      const rows = dataset.map((c, idx) => {
        const buckets = getAgeBuckets(c);
        return [
          idx + 1,
          c.customerName || '',
          getTagsString(c),
          getRepsString(c),
          c.lastPaymentDate ? formatDmy(c.lastPaymentDate) : '-',
          (c.lastPaymentAmount || 0).toFixed(2),
          getDaysSinceLastPayment(c),
          (c.netDebt || 0).toFixed(2),
          buckets.zeroToThirty.toFixed(2),
          buckets.thirtyOneToSixty.toFixed(2),
          buckets.sixtyOneToNinety.toFixed(2),
          buckets.ninetyOneToOneTwenty.toFixed(2),
          buckets.older.toFixed(2),
        ];
      });

      return {
        name,
        data: recordsFromTable(agesHeaders, rows),
        options: {
          numericColumns: ['Last Payment Amount', 'Days Since', 'Net Debt', ...ageHeaders],
        },
      };
    };

    sheets.push(buildAgesSheet('Ages View', data));

    if (opts.groupByRegion) {
      Array.from(uniqueRegions).forEach(region => {
        const filtered = data.filter(c => {
          const reps = getRepsString(c);
          if (region === 'Unassigned') return reps === '-';
          return reps.includes(region);
        });
        if (filtered.length > 0) {
          sheets.push(buildAgesSheet(`Ages - ${region}`.substring(0, 31), filtered));
        }
      });
    }
  }

  await exportDebitExcelWorkbook(sheets, filename);
};


