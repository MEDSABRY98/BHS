import { useMemo } from 'react';
import { InvoiceRow, CustomerAnalysis } from '@/types';
import { buildInvoicesByCustomer } from '../Utils/DebitIndexes';
import { GlobalDebitFilters, LuluEmailRecord } from '../Context/DebitDataContext';
import {
  parseDate,
  isPaymentTxn,
  getPaymentAmount,
  calculateDebtRating,
  generateCustomerAnalysis,
  buildInvoicesWithNetDebtForExport,
  toNetOnlyOpenInvoicesForExport
} from '../CustomersTab/CstomersUtils';

export function useGlobalDebitFilter(
  data: InvoiceRow[],
  globalFilters: GlobalDebitFilters,
  invoicesByCustomer: Map<string, InvoiceRow[]>,
  customersWithEmails: Map<string, string>,
  luluEmails: LuluEmailRecord[]
): InvoiceRow[] {
  const dateFilteredData = useMemo(() => {
    if (!globalFilters.dateTo && !globalFilters.dateFrom) return data;
    
    const toDate = globalFilters.dateTo ? new Date(globalFilters.dateTo) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const fromDate = globalFilters.dateFrom ? new Date(globalFilters.dateFrom) : null;
    if (fromDate) fromDate.setHours(0, 0, 0, 0);

    const openInvoices = toNetOnlyOpenInvoicesForExport(buildInvoicesWithNetDebtForExport(data));

    return openInvoices.filter(row => {
      if (!row.date) return true;
      const rowDate = new Date(row.date);
      
      if (toDate && rowDate > toDate) return false;
      if (fromDate && rowDate < fromDate) return false;
      
      return true;
    });
  }, [data, globalFilters.dateTo, globalFilters.dateFrom]);

  const effectiveInvoicesByCustomer = useMemo(() => {
    if (!globalFilters.dateTo && !globalFilters.dateFrom) return invoicesByCustomer;
    return buildInvoicesByCustomer(dateFilteredData);
  }, [dateFilteredData, invoicesByCustomer, globalFilters.dateTo, globalFilters.dateFrom]);

  // First, calculate CustomerAnalysis to know rating, sales reps, etc.
  const customerAnalysis = useMemo(() => {
    return generateCustomerAnalysis(dateFilteredData);
  }, [dateFilteredData]);

  const validCustomers = useMemo(() => {
    let result = customerAnalysis;
    const {
      selectedSalesRep,
      customerRating,
      emailFilter,
      overdueMonth,
      overdueYear,
      selectedCustomerTags,
      selectedCustomerClasses
    } = globalFilters;

    if (selectedSalesRep !== 'ALL') result = result.filter(c => c.cities && c.cities.has(selectedSalesRep));

    if (Array.isArray(selectedCustomerTags) && selectedCustomerTags.length > 0) {
      const tagSet = new Set(selectedCustomerTags);
      result = result.filter(
        (c) => c.customerTags && Array.from(c.customerTags).some((tag) => tagSet.has(tag))
      );
    }

    if (Array.isArray(selectedCustomerClasses) && selectedCustomerClasses.length > 0) {
      const classSet = new Set(selectedCustomerClasses);
      result = result.filter(
        (c) => c.customerClasses && Array.from(c.customerClasses).some((cls) => classSet.has(cls))
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
        const customerInvoices = effectiveInvoicesByCustomer.get(c.customerName) || [];
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
        const customerInvoices = effectiveInvoicesByCustomer.get(c.customerName) || [];
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

    if (globalFilters.hideZeroAndNegativeBalance) {
      result = result.filter(c => c.netDebt > 0.01);
    } else if (globalFilters.hideZeroBalanceOnly) {
      result = result.filter(c => Math.abs(c.netDebt) > 0.01);
    } else if (globalFilters.hideNegativeBalanceOnly) {
      result = result.filter(c => c.netDebt >= -0.01);
    }

    return new Set(result.map(c => c.customerName));
  }, [customerAnalysis, globalFilters, customersWithEmails, luluEmails, effectiveInvoicesByCustomer]);

  return useMemo(() => {
    // If no global filters are active that restrict customers, we can just return data to avoid a new array
    if (
      globalFilters.customerRating === 'ALL' &&
      globalFilters.selectedSalesRep === 'ALL' &&
      globalFilters.emailFilter === 'ALL' &&
      globalFilters.overdueMonth.length === 0 &&
      globalFilters.overdueYear.length === 0 &&
      globalFilters.selectedCustomerTags.length === 0 &&
      globalFilters.selectedCustomerClasses.length === 0 &&
      !globalFilters.dateTo &&
      !globalFilters.dateFrom &&
      !globalFilters.hideZeroAndNegativeBalance &&
      !globalFilters.hideZeroBalanceOnly &&
      !globalFilters.hideNegativeBalanceOnly
    ) {
      return data;
    }

    return dateFilteredData.filter(row => validCustomers.has(row.customerName));
  }, [data, dateFilteredData, validCustomers, globalFilters]);
}
