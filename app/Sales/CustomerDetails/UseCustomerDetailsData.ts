'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { SalesInvoice } from '@/lib/supabase';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import { getCustomerDetailsData } from '@/app/Sales/Service/sales_customers_service';
import type {
  ChartDataRow,
  DashboardMetrics,
  GroupedInvoiceRow,
  MonthlySalesRow,
  ProductSalesRow,
  SubCustomerRow,
} from './Types';

interface UseCustomerDetailsDataArgs {
  customerName: string;
  customerId?: string;
  customerType: 'main' | 'sub';
  userId?: string;
  debouncedSearchQuery: string;
  invoiceTypeFilter: 'all' | 'sales' | 'returns';
}

export function useCustomerDetailsData({
  customerName,
  customerId,
  customerType,
  userId,
  debouncedSearchQuery,
  invoiceTypeFilter,
}: UseCustomerDetailsDataArgs) {
  const { commonFilters: filters } = useSalesModuleFilters();
  const [data, setData] = useState<SalesInvoice[]>([]);
  const [allData, setAllData] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchRequestId = useRef(0);

  // Fetch customer details when panel opens
  useEffect(() => {
    const requestId = ++fetchRequestId.current;

    const fetchCustomerDetails = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await getCustomerDetailsData(userId, filters, customerName, customerId || '', customerType);
        if (requestId !== fetchRequestId.current) return;
        setData(result.data || []);
        setAllData(result.allData || []);
      } catch (err) {
        if (requestId !== fetchRequestId.current) return;
        console.error('Error fetching Customer Details:', err);
      } finally {
        if (requestId === fetchRequestId.current) {
          setLoading(false);
        }
      }
    };

    fetchCustomerDetails();
    return () => {
      fetchRequestId.current += 1;
    };
  }, [userId, filters, customerName, customerId, customerType]);

  // Get unfiltered customer data (for lastInvoiceDate calculation)
  const unfilteredCustomerData = useMemo(() => {
    const targetId = customerId?.trim();
    const targetName = customerName?.trim();

    return data.filter(item => {
      const itemMainName = (item.customerMainName || (item as any).customermainname || item.customerName || (item as any).customername || 'Unknown').trim();
      const itemSubName = (item.customerName || (item as any).customername || itemMainName || 'Unknown').trim();
      const itemId = (item.customerId || (item as any).customerid || '').trim();

      if (customerType === 'main') {
        return itemMainName === targetName || itemSubName === targetName;
      }

      if (targetId && itemId) {
        return itemId.toUpperCase() === targetId.toUpperCase() || itemSubName === targetName;
      }

      return itemSubName === targetName;
    });
  }, [data, customerName, customerId, customerType]);

  // Filter data for this customer with search and date filters
  // Note: customerName is used for display, but we need to find by customerId if available
  const customerData = useMemo(() => {
    let filtered = [...unfilteredCustomerData];

    // Search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.product?.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query) ||
        item.merchandiser?.toLowerCase().includes(query) ||
        item.salesRep?.toLowerCase().includes(query) ||
        item.invoiceNumber?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [unfilteredCustomerData, debouncedSearchQuery]);

  // Monthly sales data
  const monthlySales = useMemo(() => {
    const monthMap = new Map<string, { month: string; monthKey: string; amount: number; qty: number; invoiceNumbers: Set<string> }>();

    customerData.forEach(item => {
      if (!item.invoiceDate) return;

      try {
        const date = new Date(item.invoiceDate);
        if (isNaN(date.getTime())) return;

        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[month]} ${String(year).slice(-2)}`;

        const existing = monthMap.get(monthKey) || {
          month: monthLabel,
          monthKey,
          amount: 0,
          qty: 0,
          invoiceNumbers: new Set<string>()
        };

        existing.amount += item.amount;
        existing.qty += item.qty;

        // Add invoice number for transaction count (only invoices starting with "SAL")
        if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
          existing.invoiceNumbers.add(item.invoiceNumber);
        }

        monthMap.set(monthKey, existing);
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Sort by date descending (newest first)
    const sorted = Array.from(monthMap.values()).map(item => ({
      month: item.month,
      monthKey: item.monthKey,
      amount: item.amount,
      qty: item.qty,
      count: item.invoiceNumbers.size
    })).sort((a, b) => {
      return b.monthKey.localeCompare(a.monthKey);
    });

    // Fill in missing months from first purchase month to current month
    if (sorted.length > 0) {
      // Find first month (oldest) and last month (newest)
      const firstMonthKey = sorted[sorted.length - 1].monthKey; // Oldest (last in descending order)
      const lastMonthKey = sorted[0].monthKey; // Newest (first in descending order)

      // Parse first month
      const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);

      // Get current date
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-based
      const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      // Use current month or last purchase month, whichever is newer
      const endMonthKey = currentMonthKey > lastMonthKey ? currentMonthKey : lastMonthKey;
      const [endYear, endMonth] = endMonthKey.split('-').map(Number);

      // Create a map for quick lookup
      const monthDataMap = new Map(sorted.map(item => [item.monthKey, item]));

      // Generate all months from first to end
      const allMonths: Array<{
        month: string;
        monthKey: string;
        amount: number;
        qty: number;
        count: number;
        isZeroMonth: boolean;
      }> = [];

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      let year = firstYear;
      let month = firstMonth;

      while (year < endYear || (year === endYear && month <= endMonth)) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const monthLabel = `${monthNames[month - 1]} ${String(year).slice(-2)}`;

        const existingData = monthDataMap.get(monthKey);

        if (existingData) {
          allMonths.push({
            ...existingData,
            isZeroMonth: false
          });
        } else {
          // Zero month - no purchases
          allMonths.push({
            month: monthLabel,
            monthKey,
            amount: 0,
            qty: 0,
            count: 0,
            isZeroMonth: true
          });
        }

        // Move to next month
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }

      // Sort by date descending (newest first)
      allMonths.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

      // Calculate amount change from previous month
      return allMonths.map((item, index) => {
        const previousAmount = index < allMonths.length - 1 ? allMonths[index + 1].amount : null;
        const amountChange = previousAmount !== null ? item.amount - previousAmount : null;

        return {
          ...item,
          amountChange
        };
      });
    }

    return [];
  }, [customerData]);

  // Products data
  const productsData = useMemo(() => {
    const productMap = new Map<string, {
      barcode: string;
      product: string;
      amount: number;
      qty: number;
      totalCost: number;
      totalPrice: number;
      costCount: number;
      priceCount: number;
      invoiceNumbers: Set<string>;
      lastInvoiceDate: string | null;
    }>();
    const productIdCount = new Map<string, number>();

    customerData.forEach(item => {
      const key = item.productId || item.barcode || item.product;
      const existing = productMap.get(key) || {
        barcode: item.barcode || '-',
        product: item.product || '-',
        amount: 0,
        qty: 0,
        totalCost: 0,
        totalPrice: 0,
        costCount: 0,
        priceCount: 0,
        invoiceNumbers: new Set<string>(),
        lastInvoiceDate: null
      };

      if (!existing.barcode || existing.barcode === '-') {
        existing.barcode = item.barcode || '-';
      }
      if (!existing.product || existing.product === '-') {
        existing.product = item.product || '-';
      }

      existing.amount += item.amount;
      existing.qty += item.qty;
      if (item.productCost) {
        existing.totalCost += item.productCost;
        existing.costCount += 1;
      }
      if (item.productPrice) {
        existing.totalPrice += item.productPrice;
        existing.priceCount += 1;
      }

      // Add invoice number if available (only invoices starting with "SAL")
      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.invoiceNumbers.add(item.invoiceNumber);
      }

      // Update last invoice date
      if (item.invoiceDate) {
        try {
          const itemDate = new Date(item.invoiceDate);
          if (!isNaN(itemDate.getTime())) {
            if (!existing.lastInvoiceDate) {
              existing.lastInvoiceDate = item.invoiceDate;
            } else {
              const existingDate = new Date(existing.lastInvoiceDate);
              if (itemDate > existingDate) {
                existing.lastInvoiceDate = item.invoiceDate;
              }
            }
          }
        } catch (e) {
          // Invalid date, skip
        }
      }

      productMap.set(key, existing);

      // Count productId occurrences for duplicate detection
      const productId = item.productId || item.barcode || item.product;
      productIdCount.set(productId, (productIdCount.get(productId) || 0) + 1);
    });

    // Sort by amount descending and mark duplicates
    const result = Array.from(productMap.values()).sort((a, b) => b.amount - a.amount);

    // Mark duplicates based on productId and format invoice numbers
    return result.map(item => {
      const productId = item.barcode || item.product;
      const invoiceNumbersArray = Array.from(item.invoiceNumbers).sort();
      const avgCost = item.costCount > 0 ? item.totalCost / item.costCount : 0;
      const avgPrice = item.priceCount > 0 ? item.totalPrice / item.priceCount : 0;
      return {
        ...item,
        isDuplicate: productId ? (productIdCount.get(productId) || 0) > 1 : false,
        invoiceCount: item.invoiceNumbers.size,
        invoiceNumbers: invoiceNumbersArray.join(', '),
        lastInvoiceDate: item.lastInvoiceDate,
        avgCost,
        avgPrice
      };
    });
  }, [customerData]);

  // Sub customers breakdown (for Main Customers view)
  const subCustomersData = useMemo(() => {
    if (customerType !== 'main') return [];

    const map = new Map<string, {
      customerId: string;
      subCustomerName: string;
      totalAmount: number;
      totalQty: number;
      products: Set<string>;
      invoices: Set<string>;
    }>();

    customerData.forEach(item => {
      const subName = (item.customerName || (item as any).customername || 'Unknown').trim();
      const subId = (item.customerId || (item as any).customerid || '').trim();
      const key = subId ? `${subId}::${subName}` : subName;

      const existing = map.get(key) || {
        customerId: subId,
        subCustomerName: subName,
        totalAmount: 0,
        totalQty: 0,
        products: new Set<string>(),
        invoices: new Set<string>(),
      };

      existing.totalAmount += item.amount || 0;
      existing.totalQty += item.qty || 0;

      const prodKey = item.productId || item.barcode || item.product;
      if (prodKey) existing.products.add(prodKey);

      if (item.invoiceNumber) existing.invoices.add(item.invoiceNumber);

      map.set(key, existing);
    });

    return Array.from(map.values()).map(item => ({
      customerId: item.customerId,
      subCustomerName: item.subCustomerName,
      totalAmount: item.totalAmount,
      totalQty: item.totalQty,
      productsCount: item.products.size,
      invoicesCount: item.invoices.size,
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [customerData, customerType]);

  // Invoices data - grouped by invoiceNumber
  const groupedInvoicesData = useMemo(() => {
    const invoiceMap = new Map<string, {
      invoiceDate: string;
      invoiceNumber: string;
      amount: number;
      qty: number;
      products: Set<string>;
      totalCost: number;
      totalPrice: number;
      costCount: number;
      priceCount: number;
      subCustomers: Set<string>;
      items: SalesInvoice[];
    }>();

    customerData.forEach(item => {
      if (!item.invoiceNumber) return;

      const existing = invoiceMap.get(item.invoiceNumber) || {
        invoiceDate: item.invoiceDate || '',
        invoiceNumber: item.invoiceNumber,
        amount: 0,
        qty: 0,
        products: new Set<string>(),
        totalCost: 0,
        totalPrice: 0,
        costCount: 0,
        priceCount: 0,
        subCustomers: new Set<string>(),
        items: [] as SalesInvoice[]
      };

      existing.items.push(item);
      existing.amount += item.amount;
      existing.qty += item.qty;

      // Add product to set
      const productKey = item.productId || item.barcode || item.product;
      existing.products.add(productKey);

      // Add sub-customer
      if (item.customerName) {
        existing.subCustomers.add(item.customerName);
      }

      // Add cost and price
      if (item.productCost) {
        existing.totalCost += item.productCost;
        existing.costCount += 1;
      }
      if (item.productPrice) {
        existing.totalPrice += item.productPrice;
        existing.priceCount += 1;
      }

      invoiceMap.set(item.invoiceNumber, existing);
    });

    // Convert to array and calculate averages
    const allInvoices = Array.from(invoiceMap.values()).map(invoice => {
      const avgCost = invoice.costCount > 0 ? invoice.totalCost / invoice.costCount : 0;
      const avgPrice = invoice.priceCount > 0 ? invoice.totalPrice / invoice.priceCount : 0;

      return {
        ...invoice,
        productCount: invoice.products.size,
        subCustomerNames: Array.from(invoice.subCustomers).join(', '),
        avgCost,
        avgPrice
      };
    });

    // Apply type filter
    const filteredByFilter = allInvoices.filter(inv => {
      if (invoiceTypeFilter === 'all') return true;
      const num = inv.invoiceNumber.trim().toUpperCase();
      if (invoiceTypeFilter === 'sales') return num.startsWith('SAL');
      if (invoiceTypeFilter === 'returns') return num.startsWith('RSAL');
      return true;
    });

    return filteredByFilter.sort((a, b) => {
      // Sort by date descending (newest first)
      const dateA = new Date(a.invoiceDate).getTime();
      const dateB = new Date(b.invoiceDate).getTime();
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      // If dates are equal, sort by invoice number
      return b.invoiceNumber.localeCompare(a.invoiceNumber);
    });
  }, [customerData, invoiceTypeFilter]);

  // Dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const totalAmount = customerData.reduce((sum, item) => sum + item.amount, 0);
    const totalQty = customerData.reduce((sum, item) => sum + item.qty, 0);
    const uniqueProducts = new Set(customerData.map(item => item.productId || item.barcode || item.product)).size;

    // Calculate months from first month to current month (not just active months)
    let totalMonths = 1;
    if (monthlySales.length > 0) {
      // Find earliest month from monthlySales
      const sortedMonths = [...monthlySales].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      const firstMonthKey = sortedMonths[0].monthKey;
      const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);

      // Get current date
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-based for comparison

      // Calculate months from first month to current month (inclusive)
      const firstDate = new Date(firstYear, firstMonth - 1, 1);
      const lastDate = new Date(currentYear, currentMonth - 1, 1);

      // Calculate difference in months
      const yearsDiff = lastDate.getFullYear() - firstDate.getFullYear();
      const monthsDiff = lastDate.getMonth() - firstDate.getMonth();
      totalMonths = (yearsDiff * 12) + monthsDiff + 1; // +1 to include both start and end months
    }

    const avgMonthlyAmount = totalMonths > 0 ? totalAmount / totalMonths : 0;
    const avgMonthlyQty = totalMonths > 0 ? totalQty / totalMonths : 0;

    // Count only months where customer actually made purchases (not zero months)
    const activeMonths = monthlySales.filter(month => !month.isZeroMonth && month.count > 0).length;

    // Calculate last invoice date and days since (from unfiltered data)
    let lastInvoiceDate: Date | null = null;
    let daysSinceLastInvoice: number | null = null;

    if (unfilteredCustomerData.length > 0) {
      const dates = unfilteredCustomerData
        .map(item => {
          if (!item.invoiceDate) return null;
          try {
            const date = new Date(item.invoiceDate);
            return isNaN(date.getTime()) ? null : date;
          } catch {
            return null;
          }
        })
        .filter((date): date is Date => date !== null);

      if (dates.length > 0) {
        lastInvoiceDate = new Date(Math.max(...dates.map(d => d.getTime())));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastInvoiceDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - lastInvoiceDate.getTime();
        daysSinceLastInvoice = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    return {
      totalAmount,
      totalQty,
      uniqueProducts,
      uniqueMonths: activeMonths, // Only months with actual purchases
      totalMonths, // Total months from start to now
      avgMonthlyAmount,
      avgMonthlyQty,
      lastInvoiceDate,
      daysSinceLastInvoice,
    };
  }, [customerData, monthlySales, unfilteredCustomerData]);

  // Get unfiltered customer data from ALL data (for comparison chart)
  const customerAllData = useMemo(() => {
    const source = allData.length > 0 ? allData : data;
    const targetId = customerId?.trim();
    const targetName = customerName?.trim();

    return source.filter(item => {
      const itemMainName = (item.customerMainName || (item as any).customermainname || item.customerName || (item as any).customername || 'Unknown').trim();
      const itemSubName = (item.customerName || (item as any).customername || itemMainName || 'Unknown').trim();
      const itemId = (item.customerId || (item as any).customerid || '').trim();

      if (customerType === 'main') {
        return itemMainName === targetName || itemSubName === targetName;
      }

      if (targetId && itemId) {
        return itemId.toUpperCase() === targetId.toUpperCase() || itemSubName === targetName;
      }

      return itemSubName === targetName;
    });
  }, [allData, data, customerName, customerId, customerType]);

  // Chart data for monthly sales - Jan-Dec comparison
  const chartData = useMemo(() => {
    if (customerAllData.length === 0) return [];

    const monthMap = new Map<string, { amount: number; qty: number }>();
    customerAllData.forEach(item => {
      if (!item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { amount: 0, qty: 0 };
      existing.amount += item.amount;
      existing.qty += item.qty;
      monthMap.set(key, existing);
    });

    // Determine target year (latest available in data)
    const allKeys = Array.from(monthMap.keys()).sort();
    const latestKey = allKeys[allKeys.length - 1];
    const targetYear = latestKey ? parseInt(latestKey.split('-')[0], 10) : new Date().getFullYear();

    const prevYear = targetYear - 1;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    const result = [];

    for (let m = 1; m <= 12; m++) {
      const currKey = `${targetYear}-${String(m).padStart(2, '0')}`;
      const prevKey = `${prevYear}-${String(m).padStart(2, '0')}`;

      const currData = monthMap.get(currKey) || { amount: 0, qty: 0 };
      const prevData = monthMap.get(prevKey) || { amount: 0, qty: 0 };

      const diff = currData.amount - prevData.amount;
      const percent = prevData.amount !== 0 ? (diff / Math.abs(prevData.amount)) * 100 : (currData.amount !== 0 ? 100 : 0);

      const isFuture = (targetYear > nowYear) || (targetYear === nowYear && m > nowMonth);

      result.push({
        month: monthNames[m - 1],
        year: String(targetYear).slice(-2),
        prevYear: String(prevYear).slice(-2),
        currentAmount: currData.amount,
        prevAmount: prevData.amount,
        diff,
        percent,
        isPositive: diff >= 0,
        isFuture,
        legendCurr: String(targetYear),
        legendPrev: String(prevYear)
      });
    }

    const maxAmount = Math.max(...result.map(r => Math.max(r.currentAmount, r.prevAmount)));
    result.forEach(r => {
      // @ts-ignore
      r.topBaseline = maxAmount * 1.25;
    });

    return result;
  }, [customerAllData]);
  return {
    loading,
    customerData,
    monthlySales,
    productsData,
    subCustomersData,
    groupedInvoicesData,
    dashboardMetrics,
    chartData,
  };
}
