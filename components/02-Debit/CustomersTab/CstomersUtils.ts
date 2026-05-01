import { InvoiceRow, CustomerAnalysis } from '@/types';
import {
  exportToPDF as exportToPDFUtil,
} from '@/lib/pdf/PdfUtils';
import * as XLSX from 'xlsx';

// Helper function to copy text to clipboard
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
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

export const calculateDebtRating = (customer: CustomerAnalysis, closedCustomersSet: Set<string>, returnBreakdown: boolean = false): 'Good' | 'Medium' | 'Bad' | any => {
  const customerNameNormalized = customer.customerName.toLowerCase().trim().replace(/\s+/g, ' ');
  const isClosed = closedCustomersSet.has(customerNameNormalized);
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

export const buildInvoicesWithNetDebtForExport = (invList: InvoiceRow[]) => {
  return invList.map((invoice) => {
    let residual: number | undefined = undefined;
    if (invoice.matching && invoice.residualAmount !== undefined && Math.abs(invoice.residualAmount) > 0.01) {
      residual = invoice.residualAmount;
    }
    return { ...invoice, netDebt: invoice.debit - invoice.credit, residual };
  });
};

export const exportToPDF = async (data: CustomerAnalysis[], filename: string = 'customers_report', closedCustomersSet: Set<string> = new Set()) => {
  try {
    await exportToPDFUtil(data, filename, closedCustomersSet);
  } catch (error) {
    console.error('Error in exportToPDF:', error);
    alert('Failed to generate PDF');
  }
};

export const exportToExcel = (data: CustomerAnalysis[], filename: string = 'customers_export', closedCustomersSet: Set<string> = new Set(), invoices: InvoiceRow[] = [], yearlyData?: any) => {
  const netOnlyHeaders = ['Customer Name', 'Date', 'Type', 'Invoice Number', 'Debit', 'Credit', 'Net Debt'];
  const netOnlyRows: any[] = [];
  for (const customer of data) {
    const customerInvoices = invoices.filter(row => row.customerName === customer.customerName);
    if (customerInvoices.length === 0) continue;
    const invoicesWithNetDebt = buildInvoicesWithNetDebtForExport(customerInvoices);
    const netOnlyInvoices = invoicesWithNetDebt
      .filter(inv => !inv.matching || (inv.residual !== undefined && Math.abs(inv.residual) > 0.01))
      .map(inv => inv.matching && inv.residual !== undefined ? { ...inv, credit: inv.debit - inv.residual, netDebt: inv.residual } : inv);
    netOnlyInvoices.forEach(inv => {
      netOnlyRows.push([customer.customerName, formatDmy(parseDate(inv.date)), getInvoiceType(inv), inv.number || '', (inv.debit || 0).toFixed(2), (inv.credit || 0).toFixed(2), (inv.netDebt || 0).toFixed(2)]);
    });
  }

  const dashboardHeaders = ['#', 'Customer Name', 'City', 'Net Debit', 'Debt Rating', 'OB Amount', 'Overdue Amount', 'Collection Rate %', 'Payment Rate %', 'Return Rate %', 'Discount Rate %', 'Average Payment Interval (Days)', 'Last Payment Date', 'Payments Count 90d', 'Payments 90d Amt', 'Net Sales', 'Sales Count 90d', 'Sales 90d Amt'];
  const dashboardRows = data.map((customer, index) => {
    let reps = '-';
    if (customer.salesReps && customer.salesReps instanceof Set && customer.salesReps.size > 0) reps = Array.from(customer.salesReps).join(', ');
    else if (Array.isArray(customer.salesReps) && customer.salesReps.length > 0) reps = (customer.salesReps as string[]).join(', ');
    return [
      index + 1, customer.customerName || '', reps, customer.netDebt.toFixed(2), calculateDebtRating(customer, closedCustomersSet), (customer.openOBAmount || 0).toFixed(2), (customer.overdueAmount || 0).toFixed(2),
      customer.totalDebit > 0 ? ((customer.totalCredit / customer.totalDebit) * 100).toFixed(1) + '%' : '0.0%',
      (customer.totalCredit || 0) > 0 ? ((customer.creditPayments || 0) / customer.totalCredit * 100).toFixed(0) + '%' : '0%',
      (customer.totalCredit || 0) > 0 ? ((customer.creditReturns || 0) / customer.totalCredit * 100).toFixed(0) + '%' : '0%',
      (customer.totalCredit || 0) > 0 ? ((customer.creditDiscounts || 0) / customer.totalCredit * 100).toFixed(0) + '%' : '0%',
      customer.avgPaymentInterval ? customer.avgPaymentInterval.toFixed(1) : '-',
      customer.lastPaymentDate ? formatDmy(customer.lastPaymentDate) : '-',
      (customer as any).paymentsCount3m ?? 0, (customer as any).payments3m?.toFixed(2) || '0.00', (customer.netSales || 0).toFixed(2), (customer as any).salesCount3m ?? 0, (customer as any).sales3m?.toFixed(2) || '0.00'
    ];
  });

  const summaryHeaders = ['#', 'Customer Name', 'City / Rep', 'Total Debt', 'Last Pay Date', 'Last Pay Amt', 'Pay (90d)', '# Pay (90d)', 'Last Sale Date', 'Last Sale Amt', 'Sales (90d)', '# Sales (90d)', 'Rating'];
  const summaryRows = data.map((customer, index) => {
    let reps = '-';
    if (customer.salesReps && customer.salesReps instanceof Set && customer.salesReps.size > 0) reps = Array.from(customer.salesReps).join(', ');
    else if (Array.isArray(customer.salesReps) && customer.salesReps.length > 0) reps = (customer.salesReps as string[]).join(', ');
    return [
      index + 1, customer.customerName || '', reps, customer.netDebt.toFixed(2), customer.lastPaymentDate ? formatDmy(customer.lastPaymentDate) : '-', (customer.lastPaymentAmount || 0).toFixed(2),
      (customer as any).payments3m?.toFixed(2) || '0.00', (customer as any).paymentsCount3m ?? 0,
      customer.lastSalesDate ? formatDmy(customer.lastSalesDate) : '-', (customer.lastSalesAmount || 0).toFixed(2), (customer as any).sales3m?.toFixed(2) || '0.00', (customer as any).salesCount3m ?? 0, calculateDebtRating(customer, closedCustomersSet)
    ];
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([netOnlyHeaders, ...netOnlyRows]), 'Net Only Details');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([dashboardHeaders, ...dashboardRows]), 'Customers Dashboard');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]), 'Summary View');

  if (yearlyData && yearlyData.rows.length > 0) {
    const years = yearlyData.sortedYears;
    const yearlyHeaders = ['#', 'Customer Name', 'City', 'Net Debt', ...years];
    const yearlyRows = yearlyData.rows.map((row: any, index: number) => {
      const rowData = [index + 1, row.customerName, row.region, row.totalNetDebt.toFixed(2)];
      years.forEach((yr: string) => rowData.push((row.yearlyAmounts[yr] || 0).toFixed(2)));
      return rowData;
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([yearlyHeaders, ...yearlyRows]), 'Yearly View');
  }
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};
