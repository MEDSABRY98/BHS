'use client';

import { useState, useMemo, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { ArrowLeft, DollarSign, Package, TrendingUp, BarChart3, Search, Calendar, Download, Percent, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SalesCustomerDetailsProps {
  customerName: string;
  customerType?: 'main' | 'sub';
  data: SalesInvoice[];
  onBack: () => void;
  initialTab?: 'dashboard' | 'monthly' | 'products' | 'invoices';
}

export default function SalesCustomerDetails({ customerName, customerType = 'sub', data, onBack, initialTab = 'dashboard' }: SalesCustomerDetailsProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monthly' | 'products' | 'invoices'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [invoicesData, setInvoicesData] = useState<Array<{ number: string; debit: number; credit: number; customerName: string; date: string }>>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showDiscountsModal, setShowDiscountsModal] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch invoices data for discounts calculation
  useEffect(() => {
    const fetchInvoices = async () => {
      setLoadingInvoices(true);
      try {
        const response = await fetch('/api/sheets');
        if (response.ok) {
          const result = await response.json();
          setInvoicesData(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching invoices:', error);
      } finally {
        setLoadingInvoices(false);
      }
    };
    fetchInvoices();
  }, []);

  // Get unfiltered customer data (for lastInvoiceDate calculation)
  const unfilteredCustomerData = useMemo(() => {
    if (customerType === 'main') {
      return data.filter(item => (item.customerMainName || item.customerName || 'Unknown') === customerName);
    }

    // First, find the customerId for this customerName (use first match)
    const firstMatch = data.find(item => item.customerName === customerName);
    const customerId = firstMatch?.customerId;

    // Filter by customerId if available, otherwise by customerName
    return customerId
      ? data.filter(item => item.customerId === customerId)
      : data.filter(item => item.customerName === customerName);
  }, [data, customerName, customerType]);

  // Filter data for this customer with search and date filters
  // Note: customerName is used for display, but we need to find by customerId if available
  const customerData = useMemo(() => {
    let filtered = [...unfilteredCustomerData];

    // Year filter
    if (filterYear.trim()) {
      const yearNum = parseInt(filterYear.trim(), 10);
      if (!isNaN(yearNum)) {
        filtered = filtered.filter(item => {
          if (!item.invoiceDate) return false;
          try {
            const date = new Date(item.invoiceDate);
            return !isNaN(date.getTime()) && date.getFullYear() === yearNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Month filter
    if (filterMonth.trim()) {
      const monthNum = parseInt(filterMonth.trim(), 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        filtered = filtered.filter(item => {
          if (!item.invoiceDate) return false;
          try {
            const date = new Date(item.invoiceDate);
            return !isNaN(date.getTime()) && date.getMonth() + 1 === monthNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Date filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(item => {
        if (!item.invoiceDate) return false;
        try {
          const itemDate = new Date(item.invoiceDate);
          if (isNaN(itemDate.getTime())) return false;

          if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (itemDate < fromDate) return false;
          }

          if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (itemDate > toDate) return false;
          }

          return true;
        } catch (e) {
          return false;
        }
      });
    }

    // Search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.product.toLowerCase().includes(query) ||
        item.barcode.toLowerCase().includes(query) ||
        item.merchandiser.toLowerCase().includes(query) ||
        item.salesRep.toLowerCase().includes(query) ||
        (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [unfilteredCustomerData, dateFrom, dateTo, filterYear, filterMonth, debouncedSearchQuery]);

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
        barcode: item.barcode,
        product: item.product,
        amount: 0,
        qty: 0,
        totalCost: 0,
        totalPrice: 0,
        costCount: 0,
        priceCount: 0,
        invoiceNumbers: new Set<string>(),
        lastInvoiceDate: null
      };

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
        subCustomers: new Set<string>()
      };

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
    return Array.from(invoiceMap.values()).map(invoice => {
      const avgCost = invoice.costCount > 0 ? invoice.totalCost / invoice.costCount : 0;
      const avgPrice = invoice.priceCount > 0 ? invoice.totalPrice / invoice.priceCount : 0;

      return {
        ...invoice,
        productCount: invoice.products.size,
        subCustomerNames: Array.from(invoice.subCustomers).join(', '),
        avgCost,
        avgPrice
      };
    }).sort((a, b) => {
      // Sort by date descending (newest first)
      const dateA = new Date(a.invoiceDate).getTime();
      const dateB = new Date(b.invoiceDate).getTime();
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      // If dates are equal, sort by invoice number
      return b.invoiceNumber.localeCompare(a.invoiceNumber);
    });
  }, [customerData]);

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

    // Calculate discounts based on sales ratio
    // 1. Get CUSTOMER MAIN NAME from customerData
    const customerMainName = customerData.length > 0 && customerData[0].customerMainName
      ? customerData[0].customerMainName
      : customerName; // Fallback to customerName if customerMainName not available

    // 2. Calculate total sales amount for sub-customer
    const subCustomerTotalAmount = customerData.reduce((sum, item) => sum + item.amount, 0);

    // 3. Calculate total sales amount for main customer (all sub-customers with same customerMainName)
    const normalizeCustomerName = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedMainName = normalizeCustomerName(customerMainName);

    const mainCustomerTotalAmount = data.reduce((sum, item) => {
      const itemMainName = item.customerMainName || item.customerName;
      const normalizedItemMainName = normalizeCustomerName(itemMainName);
      if (normalizedItemMainName === normalizedMainName) {
        return sum + item.amount;
      }
      return sum;
    }, 0);

    // 4. Calculate sales ratio
    const salesRatio = mainCustomerTotalAmount > 0
      ? subCustomerTotalAmount / mainCustomerTotalAmount
      : 0;

    // 5. Find the latest date in sales data
    let latestSalesDate: Date | null = null;
    if (data.length > 0) {
      const salesDates = data
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

      if (salesDates.length > 0) {
        latestSalesDate = new Date(Math.max(...salesDates.map(d => d.getTime())));
        // Set to end of day to include all invoices on that date
        latestSalesDate.setHours(23, 59, 59, 999);
      }
    }

    // 6. Calculate total discounts for main customer from Invoices sheet
    // Filter by customer name and date (only invoices up to latest sales date)
    const mainCustomerInvoices = invoicesData.filter(inv => {
      if (!inv.customerName) return false;
      const normalizedInvName = normalizeCustomerName(inv.customerName);
      if (normalizedInvName !== normalizedMainName) return false;

      // Filter by date: only include invoices up to latest sales date
      if (latestSalesDate && inv.date) {
        try {
          const invDate = new Date(inv.date);
          if (!isNaN(invDate.getTime())) {
            invDate.setHours(0, 0, 0, 0);
            const compareDate = new Date(latestSalesDate);
            compareDate.setHours(0, 0, 0, 0);
            if (invDate > compareDate) return false;
          }
        } catch {
          // If date parsing fails, exclude the invoice
          return false;
        }
      }

      return true;
    });

    const mainCustomerTotalDiscountsWithTax = mainCustomerInvoices.reduce((sum, inv) => {
      const num = (inv.number?.toString() || '').toUpperCase();
      if (num.startsWith('JV') || num.startsWith('BIL')) {
        // Calculate netDebt (debit - credit) for discounts, same as in invoiceTypeTotals
        const netDebt = (inv.debit || 0) - (inv.credit || 0);
        return sum + netDebt;
      }
      return sum;
    }, 0);

    // Remove 5% tax from discounts (discounts in invoices sheet include tax, but sales amounts are without tax)
    // If discount includes 5% tax: discount_with_tax = discount_without_tax * 1.05
    // Therefore: discount_without_tax = discount_with_tax / 1.05
    const mainCustomerTotalDiscounts = mainCustomerTotalDiscountsWithTax / 1.05;

    // 7. Distribute discount based on sales ratio
    const distributedDiscount = mainCustomerTotalDiscounts * salesRatio;

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
      discountsAmount: distributedDiscount,
      // Additional data for discounts explanation modal
      customerMainName,
      subCustomerTotalAmount,
      mainCustomerTotalAmount,
      salesRatio,
      mainCustomerTotalDiscountsWithTax,
      mainCustomerTotalDiscounts,
      latestSalesDate
    };
  }, [customerData, monthlySales, invoicesData, customerName, data]);

  // Chart data for monthly sales - show last 12 months only, reverse order for chart (oldest to newest for better visualization)
  const chartData = useMemo(() => {
    // Get last 12 months
    const last12Months = monthlySales.slice(0, 12);
    const data = last12Months.map(item => ({
      month: item.month,
      amount: item.amount,
      qty: item.qty,
      isNegativeAmount: item.amount < 0,
      isNegativeQty: item.qty < 0,
      isMaxMonth: false,
    }));
    // Reverse to show oldest to newest (left to right)
    const reversedData = [...data].reverse();

    // Find max month by amount (highest positive amount, or least negative if all negative)
    if (reversedData.length > 0) {
      const maxAmount = Math.max(...reversedData.map(d => d.amount));
      reversedData.forEach(item => {
        item.isMaxMonth = item.amount === maxAmount;
      });
    }

    return reversedData;
  }, [monthlySales]);


  const exportProductsToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const headers = ['#', 'Barcode', 'Product', 'Amount', 'Avg Cost', 'Avg Price', 'Quantity', 'Purchase Count', 'LID'];

    const rows = productsData.map((item: any, index: number) => [
      index + 1,
      item.barcode || '-',
      item.product,
      item.amount.toFixed(2),
      item.avgCost % 1 === 0 ? item.avgCost.toFixed(0) : item.avgCost.toFixed(2),
      item.avgPrice % 1 === 0 ? item.avgPrice.toFixed(0) : item.avgPrice.toFixed(2),
      item.qty.toFixed(0),
      item.invoiceCount || 0,
      item.lastInvoiceDate ? new Date(item.lastInvoiceDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) : '-',
    ]);

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Products');

    const safeCustomer = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
    const filename = `sales_customer_products_${safeCustomer}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const exportInvoicesToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const headers = customerType === 'main'
      ? ['Invoice Date', 'Sub Customer', 'Invoice Number', 'Amount', 'Quantity', 'Products Count']
      : ['Invoice Date', 'Invoice Number', 'Amount', 'Quantity', 'Products Count'];

    const rows = groupedInvoicesData.map((item: any) => {
      const row = [
        item.invoiceDate ? new Date(item.invoiceDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : '-',
      ];

      if (customerType === 'main') {
        row.push(item.subCustomerNames || '');
      }

      row.push(
        item.invoiceNumber,
        item.amount.toFixed(2),
        item.qty.toFixed(0),
        item.productCount
      );

      return row;
    });

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Invoices');

    const safeCustomer = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
    const filename = `sales_customer_invoices_${safeCustomer}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Back to Customers"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-800">{customerName}</h1>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex gap-4 flex-wrap">
          <div className="relative flex-[3] min-w-[200px]">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by product, barcode, merchandiser, sales rep, invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
            />
          </div>
          <div className="relative flex-1 min-w-[120px]">
            <input
              type="number"
              placeholder="Year (e.g., 2024)"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full px-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
              min="2000"
              max="2100"
            />
          </div>
          <div className="relative flex-1 min-w-[120px]">
            <input
              type="number"
              placeholder="Month (1-12)"
              value={filterMonth}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                  setFilterMonth(value);
                }
              }}
              className="w-full px-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
              min="1"
              max="12"
            />
          </div>
          <div className="relative flex-1 min-w-[150px]">
            <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
            />
          </div>
          <div className="relative flex-1 min-w-[150px]">
            <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
            />
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6 flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'dashboard'
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'monthly'
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
          >
            Sales by Month
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'products'
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'invoices'
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
          >
            Invoices / LPO
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Last Invoice Date Card */}
              <div className={`bg-white rounded-xl shadow-md p-6 ${dashboardMetrics.daysSinceLastInvoice !== null && dashboardMetrics.daysSinceLastInvoice > 5
                ? 'border-2 border-red-500 bg-red-50'
                : ''
                }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Last Invoice Date</h3>
                  <Calendar className={`w-6 h-6 ${dashboardMetrics.daysSinceLastInvoice !== null && dashboardMetrics.daysSinceLastInvoice > 5
                    ? 'text-red-600'
                    : 'text-gray-600'
                    }`} />
                </div>
                {dashboardMetrics.lastInvoiceDate ? (
                  <div>
                    <p className="text-xl font-bold text-gray-800 mb-1">
                      {dashboardMetrics.lastInvoiceDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <p className={`text-sm font-medium ${dashboardMetrics.daysSinceLastInvoice !== null && dashboardMetrics.daysSinceLastInvoice > 5
                      ? 'text-red-600 font-bold'
                      : 'text-gray-600'
                      }`}>
                      {dashboardMetrics.daysSinceLastInvoice !== null
                        ? `${dashboardMetrics.daysSinceLastInvoice} days ago`
                        : '-'}
                    </p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-gray-400">-</p>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Sales Amount</h3>
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboardMetrics.totalAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>

              <div
                className="bg-white rounded-xl shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setShowDiscountsModal(true)}
                title="Click to see calculation details"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Discounts</h3>
                  <Percent className="w-6 h-6 text-yellow-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingInvoices ? (
                    <span className="text-gray-400">Loading...</span>
                  ) : (
                    dashboardMetrics.discountsAmount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })
                  )}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Quantity</h3>
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboardMetrics.totalQty.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Avg Monthly Amount</h3>
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboardMetrics.avgMonthlyAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Avg Monthly Quantity</h3>
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboardMetrics.avgMonthlyQty.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Products</h3>
                  <Package className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">{dashboardMetrics.uniqueProducts}</p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Active Months</h3>
                  <BarChart3 className="w-6 h-6 text-teal-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">{dashboardMetrics.uniqueMonths}</p>
              </div>
            </div>

            {/* Monthly Sales Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Monthly Sales Trend</h2>
              {chartData.length > 0 ? (
                <div className="space-y-6">
                  {/* Amount Chart */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Amount</h3>
                    <div className="relative" style={{ height: '380px' }}>
                      {/* Top labels row with connecting lines */}
                      <div className="absolute top-0 left-0 right-0 h-12 z-10" style={{ paddingLeft: '40px', paddingRight: '30px' }}>
                        <div className="relative w-full h-full">
                          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                            {chartData.map((item, index) => {
                              const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                              return (
                                <line
                                  key={index}
                                  x1={`${xPercent}%`}
                                  y1="30"
                                  x2={`${xPercent}%`}
                                  y2="12"
                                  stroke="#d1d5db"
                                  strokeWidth="1"
                                  strokeDasharray="2,2"
                                />
                              );
                            })}
                          </svg>
                          <div className="relative w-full" style={{ height: '30px' }}>
                            {chartData.map((item, index) => {
                              const value = item.amount;
                              const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                              const isNegative = value < 0;
                              return (
                                <div
                                  key={index}
                                  className="absolute text-base font-bold text-center"
                                  style={{
                                    left: `${xPercent}%`,
                                    transform: 'translateX(-50%)',
                                    top: 0,
                                    color: isNegative ? '#ef4444' : '#374151'
                                  }}
                                >
                                  {value.toLocaleString('en-US', {
                                    minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
                                    maximumFractionDigits: 2
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart
                          data={chartData}
                          margin={{ top: 50, right: 30, left: 40, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                          <XAxis
                            dataKey="month"
                            stroke="#6b7280"
                            style={{ fontSize: '16px', fontWeight: 700 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="#9ca3af"
                            style={{ fontSize: '11px' }}
                            tickFormatter={() => ''}
                            tickLine={false}
                            axisLine={false}
                            domain={['auto', 'auto']}
                            hide={true}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                              padding: '12px'
                            }}
                            formatter={(value: number, name: string, props: any) => {
                              const isNegative = value < 0;
                              return [
                                <span key="value" style={{ color: isNegative ? '#ef4444' : '#374151' }}>
                                  {value.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </span>,
                                'Amount'
                              ];
                            }}
                            labelStyle={{
                              color: '#374151',
                              fontWeight: 600,
                              marginBottom: '8px'
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="amount"
                            stroke="#10b981"
                            strokeWidth={3}
                            style={{ filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.4))' }}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              const isNegative = payload?.isNegativeAmount;
                              const isMaxMonth = payload?.isMaxMonth;
                              const radius = isMaxMonth ? 8 : (isNegative ? 6 : 4);
                              return (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={radius}
                                  fill={isNegative ? "#ef4444" : (isMaxMonth ? "#fbbf24" : "#10b981")}
                                  stroke={isNegative ? "#dc2626" : (isMaxMonth ? "#f59e0b" : "#059669")}
                                  strokeWidth={isMaxMonth ? 3 : (isNegative ? 2 : 0)}
                                  style={{
                                    filter: isMaxMonth
                                      ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.9)) drop-shadow(0 2px 8px rgba(245, 158, 11, 0.6))'
                                      : (isNegative ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.5))')
                                  }}
                                />
                              );
                            }}
                            activeDot={{ r: 7, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Quantity Chart */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Quantity</h3>
                    <div className="relative" style={{ height: '380px' }}>
                      {/* Top labels row with connecting lines */}
                      <div className="absolute top-0 left-0 right-0 h-12 z-10" style={{ paddingLeft: '40px', paddingRight: '30px' }}>
                        <div className="relative w-full h-full">
                          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                            {chartData.map((item, index) => {
                              const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                              return (
                                <line
                                  key={index}
                                  x1={`${xPercent}%`}
                                  y1="30"
                                  x2={`${xPercent}%`}
                                  y2="12"
                                  stroke="#d1d5db"
                                  strokeWidth="1"
                                  strokeDasharray="2,2"
                                />
                              );
                            })}
                          </svg>
                          <div className="relative w-full" style={{ height: '30px' }}>
                            {chartData.map((item, index) => {
                              const value = item.qty;
                              const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                              const isNegative = value < 0;
                              return (
                                <div
                                  key={index}
                                  className="absolute text-base font-bold text-center"
                                  style={{
                                    left: `${xPercent}%`,
                                    transform: 'translateX(-50%)',
                                    top: 0,
                                    color: isNegative ? '#ef4444' : '#374151'
                                  }}
                                >
                                  {value.toLocaleString('en-US', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart
                          data={chartData}
                          margin={{ top: 50, right: 30, left: 40, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                          <XAxis
                            dataKey="month"
                            stroke="#6b7280"
                            style={{ fontSize: '16px', fontWeight: 700 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="#9ca3af"
                            style={{ fontSize: '11px' }}
                            tickFormatter={() => ''}
                            tickLine={false}
                            axisLine={false}
                            domain={['auto', 'auto']}
                            hide={true}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                              padding: '12px'
                            }}
                            formatter={(value: number, name: string, props: any) => {
                              const isNegative = value < 0;
                              return [
                                <span key="value" style={{ color: isNegative ? '#ef4444' : '#374151' }}>
                                  {value.toLocaleString('en-US', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                  })}
                                </span>,
                                'Quantity'
                              ];
                            }}
                            labelStyle={{
                              color: '#374151',
                              fontWeight: 600,
                              marginBottom: '8px'
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="qty"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4))' }}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              const isNegative = payload?.isNegativeQty;
                              const isMaxMonth = payload?.isMaxMonth;
                              const radius = isMaxMonth ? 8 : (isNegative ? 6 : 4);
                              return (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={radius}
                                  fill={isNegative ? "#ef4444" : (isMaxMonth ? "#fbbf24" : "#3b82f6")}
                                  stroke={isNegative ? "#dc2626" : (isMaxMonth ? "#f59e0b" : "#2563eb")}
                                  strokeWidth={isMaxMonth ? 3 : (isNegative ? 2 : 0)}
                                  style={{
                                    filter: isMaxMonth
                                      ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.9)) drop-shadow(0 2px 8px rgba(245, 158, 11, 0.6))'
                                      : (isNegative ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.5))')
                                  }}
                                />
                              );
                            }}
                            activeDot={{ r: 7, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  <p>No sales data available for chart</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Monthly Sales Tab */}
        {activeTab === 'monthly' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Sales by Month</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Month</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Change</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Quantity</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySales.map((item, index) => (
                    <tr
                      key={index}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${item.isZeroMonth ? 'bg-gray-50 opacity-60' : ''
                        }`}
                    >
                      <td className={`py-3 px-4 text-base font-medium text-center ${item.isZeroMonth ? 'text-gray-500 line-through' : 'text-gray-800'
                        }`}>
                        {item.month}
                      </td>
                      <td className={`py-3 px-4 text-base font-semibold text-center ${item.isZeroMonth ? 'text-gray-400 line-through' : 'text-gray-800'
                        }`}>
                        {item.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-base font-semibold text-center">
                        {item.amountChange !== null ? (
                          <span className={item.amountChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {item.amountChange >= 0 ? '+' : ''}
                            {item.amountChange.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-base font-semibold text-center ${item.isZeroMonth ? 'text-gray-400 line-through' : 'text-gray-800'
                        }`}>
                        {item.qty.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className={`py-3 px-4 text-base font-semibold text-center ${item.isZeroMonth ? 'text-gray-400 line-through' : 'text-gray-800'
                        }`}>
                        {item.count}
                      </td>
                    </tr>
                  ))}
                  {monthlySales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No monthly data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Products Sales</h2>
              <button
                onClick={exportProductsToExcel}
                className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
                title="Export Products to Excel"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">#</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Barcode</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Product</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Avg Cost</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Avg Price</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Quantity</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Purchase Count</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">LID</th>
                  </tr>
                </thead>
                <tbody>
                  {productsData.map((item, index) => (
                    <tr
                      key={index}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${item.isDuplicate ? 'bg-yellow-50 hover:bg-yellow-100' : ''
                        }`}
                    >
                      <td className="py-3 px-4 text-base text-gray-600 font-medium text-center">{index + 1}</td>
                      <td className={`py-3 px-4 text-base font-medium text-center ${item.isDuplicate ? 'text-red-600 font-bold' : 'text-gray-800'
                        }`}>
                        {item.barcode || '-'}
                      </td>
                      <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">{item.product}</td>
                      <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                        {item.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                        {item.avgCost % 1 === 0
                          ? item.avgCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                          : item.avgCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }
                      </td>
                      <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                        {item.avgPrice % 1 === 0
                          ? item.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                          : item.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }
                      </td>
                      <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                        {item.qty.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                        {item.invoiceCount || 0}
                      </td>
                      <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">
                        {item.lastInvoiceDate ? new Date(item.lastInvoiceDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : '-'}
                      </td>
                    </tr>
                  ))}
                  {productsData.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        No products data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invoices / LPO Tab */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Invoices / LPO</h2>
              <button
                onClick={exportInvoicesToExcel}
                className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
                title="Export Invoices to Excel"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Invoice Date</th>
                    {customerType === 'main' && (
                      <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Sub Customer</th>
                    )}
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Invoice Number</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Quantity</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Products Count</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedInvoicesData.map((item, index) => {
                    const isRSAL = item.invoiceNumber.trim().toUpperCase().startsWith('RSAL');
                    return (
                      <tr
                        key={index}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${isRSAL ? 'bg-red-50 hover:bg-red-100' : ''
                          }`}
                      >
                        <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">
                          {item.invoiceDate ? new Date(item.invoiceDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '-'}
                        </td>
                        {customerType === 'main' && (
                          <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center max-w-[200px] truncate" title={item.subCustomerNames}>
                            {item.subCustomerNames}
                          </td>
                        )}
                        <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">{item.invoiceNumber}</td>
                        <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                          {item.amount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </td>
                        <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                          {item.qty.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </td>
                        <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">{item.productCount}</td>
                      </tr>
                    );
                  })}
                  {groupedInvoicesData.length === 0 && (
                    <tr>
                      <td colSpan={customerType === 'main' ? 6 : 5} className="py-8 text-center text-gray-500">
                        No invoices data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Discounts Calculation Modal */}
        {showDiscountsModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full">
              <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Discounts Calculation Explanation</h2>
                <button
                  onClick={() => setShowDiscountsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h3 className="text-sm font-semibold text-blue-900 mb-1">Customer Information</h3>
                    <p className="text-xs text-gray-700"><span className="font-medium">Sub:</span> {customerName}</p>
                    <p className="text-xs text-gray-700"><span className="font-medium">Main:</span> {dashboardMetrics.customerMainName || customerName}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">Date Filter</h3>
                    <p className="text-xs text-gray-600">
                      {dashboardMetrics.latestSalesDate ? (
                        <>Up to: <span className="font-medium">{dashboardMetrics.latestSalesDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}</span></>
                      ) : (
                        'No date filter'
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 mb-1">Step 1: Sub-Customer Sales</h3>
                    <p className="text-xs text-gray-500 mb-1">Sum of AMOUNT from Sales sheet</p>
                    <p className="text-lg font-bold text-gray-800">
                      {dashboardMetrics.subCustomerTotalAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 mb-1">Step 2: Main Customer Total Sales</h3>
                    <p className="text-xs text-gray-500 mb-1">Sum of AMOUNT for all sub-customers</p>
                    <p className="text-lg font-bold text-gray-800">
                      {dashboardMetrics.mainCustomerTotalAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 mb-1">Step 3: Sales Ratio</h3>
                    <p className="text-xs text-gray-500 mb-1">
                      {dashboardMetrics.subCustomerTotalAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })} ÷ {dashboardMetrics.mainCustomerTotalAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                    </p>
                    <p className="text-lg font-bold text-gray-800">
                      {dashboardMetrics.mainCustomerTotalAmount > 0 ? (
                        <>{(dashboardMetrics.salesRatio * 100).toFixed(2)}%</>
                      ) : (
                        '0%'
                      )}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 mb-1">Step 4: Main Customer Discounts (with tax)</h3>
                    <p className="text-xs text-gray-500 mb-1">Sum of (DEBIT - CREDIT) for JV/BIL from Invoices sheet</p>
                    <p className="text-lg font-bold text-gray-800">
                      {((dashboardMetrics as any).mainCustomerTotalDiscountsWithTax || dashboardMetrics.mainCustomerTotalDiscounts * 1.05).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">(includes 5% tax)</p>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <h3 className="text-xs font-semibold text-yellow-900 mb-1">Step 5: Remove Tax</h3>
                  <p className="text-xs text-gray-600 mb-1">
                    Discounts in Invoices sheet include 5% tax, but Sales amounts are without tax
                  </p>
                  <p className="text-xs text-gray-600 mb-1">
                    {((dashboardMetrics as any).mainCustomerTotalDiscountsWithTax || dashboardMetrics.mainCustomerTotalDiscounts * 1.05).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} ÷ 1.05
                  </p>
                  <p className="text-lg font-bold text-yellow-800">
                    = {dashboardMetrics.mainCustomerTotalDiscounts.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>

                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-green-900 mb-2">Final: Distributed Discount</h3>
                  <p className="text-xs text-gray-600 mb-2">
                    {dashboardMetrics.mainCustomerTotalDiscounts.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} × {(dashboardMetrics.salesRatio * 100).toFixed(2)}%
                  </p>
                  <p className="text-2xl font-bold text-green-700">
                    = {dashboardMetrics.discountsAmount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 px-6 py-3 flex justify-end">
                <button
                  onClick={() => setShowDiscountsModal(false)}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

