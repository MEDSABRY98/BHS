import { useMemo, useState, useEffect } from 'react';
import { InvoiceRow, CustomerAnalysis } from '@/types';
import {
  parseDate,
  isPaymentTxn,
  getPaymentAmount,
  calculateDebtRating,
} from './CstomersUtils';

interface UseCustomerDataProps {
  data: InvoiceRow[];
  filters: any;
  mode?: 'DEBIT' | 'OB_POS' | 'OB_NEG' | 'CREDIT';
  yearlySorting: { id: string; desc: boolean };
}

export const useCustomerData = (data: InvoiceRow[], filters: any, mode: any, yearlySorting: any) => {
  const [closedCustomers, setClosedCustomers] = useState<Set<string>>(new Set());
  const [semiClosedCustomers, setSemiClosedCustomers] = useState<Set<string>>(new Set());
  const [spiData, setSpiData] = useState<any[]>([]);
  const [customersWithEmails, setCustomersWithEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const [closedRes, semiRes, spiRes, emailsRes] = await Promise.all([
          fetch('/api/closed-customers'),
          fetch('/api/semi-closed-customers'),
          fetch('/api/spi'),
          fetch('/api/customer-emails-list')
        ]);

        if (closedRes.ok) {
          const d = await closedRes.json();
          setClosedCustomers(new Set(d.closedCustomers.map((n: string) => n.toLowerCase().trim().replace(/\s+/g, ' '))));
        }
        if (semiRes.ok) {
          const d = await semiRes.json();
          setSemiClosedCustomers(new Set(d.semiClosedCustomers.map((n: string) => n.toLowerCase().trim().replace(/\s+/g, ' '))));
        }
        if (spiRes.ok) {
          const d = await spiRes.json();
          setSpiData(d.data || []);
        }
        if (emailsRes.ok) {
          const d = await emailsRes.json();
          const emailSet = new Set<string>();
          (d.customers || []).forEach((e: any) => {
            if (e && e.customerName) {
              emailSet.add(e.customerName.toLowerCase().trim());
            }
          });
          setCustomersWithEmails(emailSet);
        }
      } catch (error) {
        console.error('Error fetching dependencies:', error);
      }
    };
    fetchDependencies();
  }, []);

  const customerAnalysis = useMemo(() => {
    type CustomerData = CustomerAnalysis & {
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
        let foundOverride = false;
        if (spiData && spiData.length > 0) {
          const override = group.find(inv => spiData.some(s => s.matching.toString().trim().toLowerCase() === (inv.matching || '').toString().trim().toLowerCase() && s.number.toString().trim().toLowerCase() === (inv.number || '').toString().trim().toLowerCase()));
          if (override) { residualHolder = override; foundOverride = true; }
        }
        if (!foundOverride) {
          let maxDebit = -1;
          group.forEach(inv => { if (inv.debit > maxDebit) { maxDebit = inv.debit; residualHolder = inv; } });
        }
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
        customerName: c.customerName, totalDebit: c.totalDebit, totalCredit: c.totalCredit, netDebt: c.netDebt,
        netSales: c.netSales || 0, transactionCount: c.transactionCount, hasOpenMatchings: hasOpen, salesReps: c.salesReps, invoiceNumbers: c.invoiceNumbers,
        lastPaymentDate: c.lastPaymentDate, lastPaymentMatching: c.lastPaymentMatching, lastPaymentAmount: c.lastPaymentAmount,
        lastSalesDate: c.lastSalesDate, lastSalesAmount: c.lastSalesAmount, overdueAmount: totalOverdue, hasOB: hasOBFlag, openOBAmount, agingBreakdown,
        payments3m: c.payments3m, paymentsCount3m: c.paymentsCount3m, sales3m: c.sales3m, salesCount3m: c.salesCount3m, lastTransactionDate: c.lastTransactionDate, creditPayments: c.creditPayments,
        creditReturns: c.creditReturns, creditDiscounts: c.creditDiscounts, totalSalesDebit: c.totalSalesDebit, avgPaymentInterval: c.avgPaymentInterval
      };
    }).sort((a, b) => b.netDebt - a.netDebt);
  }, [data, spiData]);

  const filteredData = useMemo(() => {
    let result = customerAnalysis;
    const {
      search, filterYear, filterMonth, dateRangeFrom, dateRangeTo, invoiceTypeFilter,
      matchingFilter, selectedSalesRep, closedFilter, semiClosedFilter,
      debtOperator, debtAmount, collectionRateOperator, collectionRateValue,
      collectionRateTypes, lastPaymentValue, lastPaymentUnit, lastPaymentStatus,
      lastPaymentAmountOperator, lastPaymentAmountValue, hasOB, overdueAmount,
      overdueAging, netSalesOperator, minTotalDebit, noSalesValue, noSalesUnit,
      lastSalesStatus, lastSalesAmountOperator, lastSalesAmountValue,
      dateRangeType, debtType
    } = filters;

    if (mode === 'OB_POS') result = result.filter(c => (c.openOBAmount || 0) > 0.01);
    else if (mode === 'OB_NEG') result = result.filter(c => (c.openOBAmount || 0) < -0.01);
    else if (mode === 'CREDIT') result = result.filter(c => c.netDebt < -0.01);
    else result = result.filter(c => c.netDebt > 0.01);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.customerName.toLowerCase().includes(q));
    }

    if (selectedSalesRep !== 'ALL') result = result.filter(c => c.salesReps && c.salesReps.has(selectedSalesRep));

    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    if (closedFilter === 'HIDE') result = result.filter(c => !closedCustomers.has(normalize(c.customerName)));
    else if (closedFilter === 'ONLY') result = result.filter(c => closedCustomers.has(normalize(c.customerName)));

    if (semiClosedFilter === 'HIDE') result = result.filter(c => !semiClosedCustomers.has(normalize(c.customerName)));
    else if (semiClosedFilter === 'ONLY') result = result.filter(c => semiClosedCustomers.has(normalize(c.customerName)));

    if (debtOperator && debtAmount) {
      const amount = parseFloat(debtAmount);
      if (!isNaN(amount)) {
        if (debtOperator === 'GT') result = result.filter(c => c.netDebt > amount);
        else if (debtOperator === 'LT') result = result.filter(c => c.netDebt < amount);
      }
    }

    if (collectionRateOperator && collectionRateValue) {
      const rate = parseFloat(collectionRateValue);
      if (!isNaN(rate)) {
        result = result.filter(c => {
          if (c.totalDebit === 0) return false;
          let adj = 0; const cx = c as any;
          if (collectionRateTypes.has('PAYMENT')) adj += cx.creditPayments || 0;
          if (collectionRateTypes.has('RETURN')) adj += cx.creditReturns || 0;
          if (collectionRateTypes.has('DISCOUNT')) adj += cx.creditDiscounts || 0;
          const r = (adj / c.totalDebit) * 100;
          return collectionRateOperator === 'GT' ? r > rate : r < rate;
        });
      }
    }

    if (hasOB) result = result.filter(c => c.hasOB);

    if (overdueAmount) {
      const val = parseFloat(overdueAmount);
      if (!isNaN(val)) result = result.filter(c => (c.overdueAmount || 0) >= val);
    }

    if (overdueAging !== 'ALL') {
      result = result.filter(c => {
        const a = c.agingBreakdown;
        switch (overdueAging) {
          case 'AT_DATE': return Math.abs(a.atDate) > 0.01;
          case '1-30': return Math.abs(a.oneToThirty) > 0.01;
          case '31-60': return Math.abs(a.thirtyOneToSixty) > 0.01;
          case '61-90': return Math.abs(a.sixtyOneToNinety) > 0.01;
          case '91-120': return Math.abs(a.ninetyOneToOneTwenty) > 0.01;
          case 'OLDER': return Math.abs(a.older) > 0.01;
          default: return false;
        }
      });
    }

    return result;
  }, [customerAnalysis, filters, closedCustomers, semiClosedCustomers, mode]);

  const yearlyPivotData = useMemo(() => {
    const customerPivotMap = new Map<string, { customerName: string; region: string; totalNetDebt: number; yearlyAmounts: Record<string, number>; }>();
    const yearsSet = new Set<string>();
    const validCustomers = new Set(filteredData.map(c => c.customerName));
    const customerTransactions = new Map<string, InvoiceRow[]>();
    data.forEach(row => {
      if (!validCustomers.has(row.customerName)) return;
      if (!customerTransactions.has(row.customerName)) customerTransactions.set(row.customerName, []);
      customerTransactions.get(row.customerName)!.push(row);
    });

    customerTransactions.forEach((invoices, customerName) => {
      let customerTotal = 0; const customerYearly: Record<string, number> = {};
      invoices.forEach(inv => {
        let amount = 0;
        if (!inv.matching) amount = inv.debit - inv.credit;
        else if (inv.residualAmount !== undefined && Math.abs(inv.residualAmount) > 0.01) amount = inv.residualAmount;
        if (Math.abs(amount) > 0.01) {
          const d = parseDate(inv.date); const yr = d ? d.getFullYear().toString() : 'Unknown';
          if (yr !== 'Unknown') yearsSet.add(yr);
          customerTotal += amount; customerYearly[yr] = (customerYearly[yr] || 0) + amount;
          if (!customerPivotMap.has(customerName)) customerPivotMap.set(customerName, { customerName, region: inv.salesRep || '-', totalNetDebt: 0, yearlyAmounts: {} });
        }
      });
      if (customerPivotMap.has(customerName)) {
        const entry = customerPivotMap.get(customerName)!;
        entry.totalNetDebt = customerTotal; entry.yearlyAmounts = customerYearly;
      }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    const finalRows = Array.from(customerPivotMap.values()).filter(row => row.totalNetDebt > 0.01);
    finalRows.sort((a, b) => {
      let valA: any = 0; let valB: any = 0;
      if (yearlySorting.id === 'name') { valA = a.customerName; valB = b.customerName; }
      else if (yearlySorting.id === 'city') { valA = a.region; valB = b.region; }
      else if (yearlySorting.id === 'netDebt') { valA = a.totalNetDebt; valB = b.totalNetDebt; }
      else { valA = a.yearlyAmounts[yearlySorting.id] || 0; valB = b.yearlyAmounts[yearlySorting.id] || 0; }
      if (typeof valA === 'string') return yearlySorting.desc ? (valB as string).localeCompare(valA as string) : (valA as string).localeCompare(valB as string);
      return yearlySorting.desc ? (valB as number) - (valA as number) : (valA as number) - (valB as number);
    });
    return { sortedYears, rows: finalRows };
  }, [data, filteredData, yearlySorting]);

  const allSalesReps = useMemo(() => {
    const reps = new Set<string>();
    data.forEach(row => { if (row.salesRep && row.salesRep.trim()) reps.add(row.salesRep.trim()); });
    return Array.from(reps).sort();
  }, [data]);

  return {
    customerAnalysis,
    filteredData,
    closedCustomers,
    semiClosedCustomers,
    spiData,
    customersWithEmails,
    yearlyPivotData,
    allSalesReps
  };
};
