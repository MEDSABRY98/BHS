import { useMemo, useState } from 'react';
import { InvoiceRow, CustomerAnalysis } from '@/types';
import {
  parseDate,
  isPaymentTxn,
  getPaymentAmount,
  calculateDebtRating,
  generateCustomerAnalysis,
} from './CstomersUtils';
import { useDebitData } from '../Context/DebitDataContext';

interface UseCustomerDataProps {
  data: InvoiceRow[];
  filters: any;
  mode?: 'DEBIT' | 'OB_POS' | 'OB_NEG' | 'CREDIT';
  yearlySorting: { id: string; desc: boolean };
}

export const useCustomerData = (data: InvoiceRow[] = [], filters: any, mode: any, yearlySorting: any) => {
  const { customersWithEmails, luluEmails, invoicesByCustomer } = useDebitData();
  const customerAnalysis = useMemo(() => {
    return generateCustomerAnalysis(data);
  }, [data]);

  const baseFilteredData = useMemo(() => {
    let result = customerAnalysis;
    const {
      search, filterYear, filterMonth, dateRangeFrom, dateRangeTo, invoiceTypeFilter,
      matchingFilter, closedFilter,
      debtOperator, debtAmount, collectionRateOperator, collectionRateValue,
      collectionRateTypes, lastPaymentValue, lastPaymentUnit, lastPaymentStatus,
      lastPaymentAmountOperator, lastPaymentAmountValue, hasOB, overdueAmount,
      overdueAging, netSalesOperator, minTotalDebit, noSalesValue, noSalesUnit,
      lastSalesStatus, lastSalesAmountOperator, lastSalesAmountValue,
      dateRangeType, debtType
    } = filters;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        (c.invoiceNumbers && Array.from(c.invoiceNumbers).some(num => num.toLowerCase().includes(q)))
      );
    }

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
        if (!a) return false;
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

    if (matchingFilter !== 'ALL') {
      const normalize = (s: any) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const luluNames = new Set(luluEmails.map(l => normalize(l.customerId)).filter(Boolean));
      const luluNamesByName = new Set(luluEmails.map(l => normalize(l.customerCode)).filter(Boolean));

      if (matchingFilter === 'WITH_EMAIL') {
        result = result.filter(c => customersWithEmails.has(normalize(c.customerId)) || customersWithEmails.has(normalize(c.customerName)));
      } else if (matchingFilter === 'EMAIL_NORMAL') {
        // Normal customers with email are those in customersWithEmails but NOT specifically in luluEmails list
        result = result.filter(c => 
          (customersWithEmails.has(normalize(c.customerId)) || customersWithEmails.has(normalize(c.customerName))) && 
          !(luluNames.has(normalize(c.customerId)) || luluNamesByName.has(normalize(c.customerName)))
        );
      } else if (matchingFilter === 'EMAIL_LULU') {
        result = result.filter(c => luluNames.has(normalize(c.customerId)) || luluNamesByName.has(normalize(c.customerName)));
      } else if (matchingFilter === 'RATING_GOOD') {
        result = result.filter(c => calculateDebtRating(c) === 'Good');
      } else if (matchingFilter === 'RATING_MEDIUM') {
        result = result.filter(c => calculateDebtRating(c) === 'Medium');
      } else if (matchingFilter === 'RATING_BAD') {
        result = result.filter(c => calculateDebtRating(c) === 'Bad');
      }
    }

    return result;
  }, [customerAnalysis, filters, customersWithEmails, luluEmails, invoicesByCustomer]);

  const filteredData = useMemo(() => {
    let result = baseFilteredData;
    if (mode === 'OB_POS') result = result.filter(c => (c.openOBAmount || 0) > 0.01);
    else if (mode === 'OB_NEG') result = result.filter(c => (c.openOBAmount || 0) < -0.01);
    else if (mode === 'CREDIT') result = result.filter(c => c.netDebt < -0.01);
    else result = result.filter(c => c.netDebt > 0.01);
    return result;
  }, [baseFilteredData, mode]);

  const yearlyPivotData = useMemo(() => {
    const customerPivotMap = new Map<string, { customerName: string; region: string; totalNetDebt: number; yearlyAmounts: Record<string, number>; }>();
    const yearsSet = new Set<string>();

    // Determine the fixed set of years from all outstanding transactions across all customers
    data.forEach(row => {
      let amount = 0;
      if (!row.matching) amount = row.debit - row.credit;
      else if (row.residualAmount !== undefined && Math.abs(row.residualAmount) > 0.01) amount = row.residualAmount;
      if (Math.abs(amount) > 0.01) {
        const d = parseDate(row.date);
        let yr = d ? d.getFullYear().toString() : 'Unknown';
        if ((row.number?.toString().toUpperCase() || '').startsWith('OB')) {
          yr = 'OB';
        }
        if (yr !== 'Unknown') yearsSet.add(yr);
      }
    });

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
          const d = parseDate(inv.date);
          let yr = d ? d.getFullYear().toString() : 'Unknown';
          
          // Separate OB invoices from their year
          if ((inv.number?.toString().toUpperCase() || '').startsWith('OB')) {
            yr = 'OB';
          }
          
          customerTotal += amount;
          customerYearly[yr] = (customerYearly[yr] || 0) + amount;
          
          if (!customerPivotMap.has(customerName)) {
            customerPivotMap.set(customerName, { customerName, region: inv.salesRep || '-', totalNetDebt: 0, yearlyAmounts: {} });
          }
        }
      });
      if (customerPivotMap.has(customerName)) {
        const entry = customerPivotMap.get(customerName)!;
        entry.totalNetDebt = customerTotal; entry.yearlyAmounts = customerYearly;
      }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => {
      // Put OB at the beginning of the yearly list
      if (a === 'OB') return -1;
      if (b === 'OB') return 1;
      return a.localeCompare(b); // Years ascending (2024, 2025, 2026...)
    });
    const finalRows = Array.from(customerPivotMap.values()).filter(row => row.totalNetDebt > 0.01);
    finalRows.sort((a, b) => {
      let valA: any = 0; let valB: any = 0;
      if (yearlySorting.id === 'name') { valA = a.customerName; valB = b.customerName; }
      else if (yearlySorting.id === 'city') { valA = a.region; valB = b.region; }
      else if (yearlySorting.id === 'totalNetDebt') { valA = a.totalNetDebt; valB = b.totalNetDebt; }
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
    baseFilteredData,
        customersWithEmails,
    luluEmails,
    yearlyPivotData,
    allSalesReps
  };
};
