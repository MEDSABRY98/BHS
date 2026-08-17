import { useMemo } from 'react';
import { InvoiceRow, CustomerAnalysis } from '@/types';
import { GlobalDebitFilters, LuluEmailRecord } from '../Context/DebitDataContext';
import {
  parseDate,
  isPaymentTxn,
  getPaymentAmount,
  calculateDebtRating,
  generateCustomerAnalysis
} from '../CustomersTab/CstomersUtils';

export function useGlobalDebitFilter(
  data: InvoiceRow[],
  globalFilters: GlobalDebitFilters,
  invoicesByCustomer: Map<string, InvoiceRow[]>,
  customersWithEmails: Map<string, string>,
  luluEmails: LuluEmailRecord[]
): InvoiceRow[] {
  // First, calculate CustomerAnalysis to know rating, sales reps, etc.
  const customerAnalysis = useMemo(() => {
    return generateCustomerAnalysis(data);
  }, [data]);

  const validCustomers = useMemo(() => {
    let result = customerAnalysis;
    const {
      selectedSalesRep,
      customerRating,
      emailFilter,
      overdueMonth,
      overdueYear,
      selectedCustomerTags
    } = globalFilters;

    if (selectedSalesRep !== 'ALL') result = result.filter(c => c.salesReps && c.salesReps.has(selectedSalesRep));

    if (Array.isArray(selectedCustomerTags) && selectedCustomerTags.length > 0) {
      const tagSet = new Set(selectedCustomerTags);
      result = result.filter(
        (c) => c.customerTags && Array.from(c.customerTags).some((tag) => tagSet.has(tag))
      );
    }

    if (customerRating && customerRating !== 'ALL') {
      result = result.filter(c => calculateDebtRating(c).toUpperCase() === customerRating.toUpperCase());
    }

    if (emailFilter && emailFilter !== 'ALL') {
      const normalize = (s: any) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const luluNames = new Set(luluEmails.map(l => normalize(l.customerId)).filter(Boolean));
      const luluNamesByName = new Set(luluEmails.map(l => normalize(l.customerCode)).filter(Boolean));
      
      if (emailFilter === 'EMAIL_NORMAL') {
        result = result.filter(c => 
          (customersWithEmails.has(normalize(c.customerId)) || customersWithEmails.has(normalize(c.customerName))) && 
          !(luluNames.has(normalize(c.customerId)) || luluNamesByName.has(normalize(c.customerName)))
        );
      } else if (emailFilter === 'EMAIL_LULU') {
        result = result.filter(c => luluNames.has(normalize(c.customerId)) || luluNamesByName.has(normalize(c.customerName)));
      }
    }

    if (overdueMonth && Array.isArray(overdueMonth) && overdueMonth.length > 0) {
      const formatMonthYearLocal = (date: Date) => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
      };

      result = result.filter(c => {
        const customerInvoices = invoicesByCustomer.get(c.customerName) || [];
        const matchingGroups = new Map<string, InvoiceRow[]>();
        customerInvoices.forEach(inv => {
          const key = inv.matching || 'UNMATCHED';
          const group = matchingGroups.get(key) || [];
          group.push(inv);
          matchingGroups.set(key, group);
        });

        let hasOverdueInMonth = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        matchingGroups.forEach((group, matchingKey) => {
          if (hasOverdueInMonth) return;
          const groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
          if (groupNetDebt <= 0.01) return;

          if (matchingKey === 'UNMATCHED') {
            group.forEach(inv => {
              if (hasOverdueInMonth) return;
              const invNetDebt = inv.debit - inv.credit;
              if (invNetDebt <= 0.01) return;
              const targetDate = inv.dueDate ? parseDate(inv.dueDate) : (inv.date ? parseDate(inv.date) : null);
              if (targetDate && targetDate < today) {
                if (overdueMonth.includes(formatMonthYearLocal(targetDate))) {
                  hasOverdueInMonth = true;
                }
              }
            });
          } else {
            let firstInv = group[0];
            let maxDebit = -1;
            group.forEach(inv => { if (inv.debit > maxDebit) { maxDebit = inv.debit; firstInv = inv; } });
            const targetDate = firstInv.dueDate ? parseDate(firstInv.dueDate) : (firstInv.date ? parseDate(firstInv.date) : null);
            if (targetDate && targetDate < today) {
              if (overdueMonth.includes(formatMonthYearLocal(targetDate))) {
                hasOverdueInMonth = true;
              }
            }
          }
        });

        return hasOverdueInMonth;
      });
    }

    if (overdueYear && Array.isArray(overdueYear) && overdueYear.length > 0) {
      result = result.filter(c => {
        const customerInvoices = invoicesByCustomer.get(c.customerName) || [];
        const matchingGroups = new Map<string, InvoiceRow[]>();
        customerInvoices.forEach(inv => {
          const key = inv.matching || 'UNMATCHED';
          const group = matchingGroups.get(key) || [];
          group.push(inv);
          matchingGroups.set(key, group);
        });

        let hasOverdueInYear = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        matchingGroups.forEach((group, matchingKey) => {
          if (hasOverdueInYear) return;
          const groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
          if (groupNetDebt <= 0.01) return;

          if (matchingKey === 'UNMATCHED') {
            group.forEach(inv => {
              if (hasOverdueInYear) return;
              const invNetDebt = inv.debit - inv.credit;
              if (invNetDebt <= 0.01) return;
              const targetDate = inv.dueDate ? parseDate(inv.dueDate) : (inv.date ? parseDate(inv.date) : null);
              if (targetDate && targetDate < today) {
                if (overdueYear.includes(targetDate.getFullYear().toString())) {
                  hasOverdueInYear = true;
                }
              }
            });
          } else {
            let firstInv = group[0];
            let maxDebit = -1;
            group.forEach(inv => { if (inv.debit > maxDebit) { maxDebit = inv.debit; firstInv = inv; } });
            const targetDate = firstInv.dueDate ? parseDate(firstInv.dueDate) : (firstInv.date ? parseDate(firstInv.date) : null);
            if (targetDate && targetDate < today) {
              if (overdueYear.includes(targetDate.getFullYear().toString())) {
                hasOverdueInYear = true;
              }
            }
          }
        });

        return hasOverdueInYear;
      });
    }

    return new Set(result.map(c => c.customerName));
  }, [customerAnalysis, globalFilters, customersWithEmails, luluEmails, invoicesByCustomer]);

  return useMemo(() => {
    // If no global filters are active that restrict customers, we can just return data to avoid a new array
    if (
      globalFilters.customerRating === 'ALL' &&
      globalFilters.selectedSalesRep === 'ALL' &&
      globalFilters.emailFilter === 'ALL' &&
      globalFilters.overdueMonth.length === 0 &&
      globalFilters.overdueYear.length === 0 &&
      globalFilters.selectedCustomerTags.length === 0
    ) {
      return data;
    }

    return data.filter(row => validCustomers.has(row.customerName));
  }, [data, validCustomers, globalFilters]);
}
