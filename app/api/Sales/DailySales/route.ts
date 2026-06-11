import { NextResponse } from 'next/server';
import { getMappingServer, applyMapping } from '@/app/Sales/Utils/SalesMappingCache';
import { getSalesDataServer } from '@/app/Sales/Utils/SalesCache';

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
};

export async function POST(request: Request) {
  try {
    const { userId, filters, invoiceTypeFilter } = await request.json();

    const rawData = await getSalesDataServer();
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Sales cache is empty' }, { status: 500 });
    }

    // Mapping (memory cache — no DB call after first request)
    const mappingMap = userId ? await getMappingServer(userId) : new Map();
    const augmentedData = mappingMap.size > 0
      ? rawData.map((item: any) => applyMapping(item, mappingMap))
      : rawData;

    // Apply Global Filters
    let globallyFilteredData = augmentedData;
    if (filters) {
      const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters;

      if (invoiceType && invoiceType !== 'all') {
        globallyFilteredData = globallyFilteredData.filter(item => {
          const num = item.invoiceNumber?.trim().toUpperCase() || '';
          if (invoiceType === 'sales') return num.startsWith('SAL');
          if (invoiceType === 'returns') return num.startsWith('RSAL');
          return true;
        });
      }
      if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
      if (area) globallyFilteredData = globallyFilteredData.filter(i => i.area === area);
      if (market) globallyFilteredData = globallyFilteredData.filter(i => i.market === market);
      if (merchandiser) globallyFilteredData = globallyFilteredData.filter(i => i.merchandiser === merchandiser);
      if (salesRep) globallyFilteredData = globallyFilteredData.filter(i => i.salesRep === salesRep);
      if (year) {
        const yearNum = parseInt(year, 10);
        globallyFilteredData = globallyFilteredData.filter(item => {
          if (!item.invoiceDate) return false;
          const d = new Date(item.invoiceDate);
          return !isNaN(d.getTime()) && d.getFullYear() === yearNum;
        });
      }
      if (month) {
        const monthNum = parseInt(month, 10);
        globallyFilteredData = globallyFilteredData.filter(item => {
          if (!item.invoiceDate) return false;
          const d = new Date(item.invoiceDate);
          return !isNaN(d.getTime()) && d.getMonth() + 1 === monthNum;
        });
      }
      if (dateFrom || dateTo) {
        globallyFilteredData = globallyFilteredData.filter(item => {
          if (!item.invoiceDate) return false;
          const itemDate = new Date(item.invoiceDate);
          if (isNaN(itemDate.getTime())) return false;
          if (dateFrom && itemDate < new Date(dateFrom)) return false;
          if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (itemDate > toDate) return false;
          }
          return true;
        });
      }
    }

    // 1. Daily Sales Data (grouped by invoiceNumber)
    const invoiceMap = new Map<string, any>();
    globallyFilteredData.forEach(item => {
      if (!item.invoiceNumber) return;

      const existing = invoiceMap.get(item.invoiceNumber) || {
        invoiceDate: item.invoiceDate || '',
        invoiceNumber: item.invoiceNumber,
        customerName: item.customerName || '',
        amount: 0,
        qty: 0,
        products: new Set<string>(),
        searchTerms: new Set<string>(),
        totalCost: 0,
        totalPrice: 0,
        costCount: 0,
        priceCount: 0,
        items: []
      };

      existing.items.push(item);
      existing.amount += Number(item.amount) || 0;
      existing.qty += Number(item.qty) || 0;

      if (item.product) existing.searchTerms.add(item.product.toLowerCase());
      if (item.barcode) existing.searchTerms.add(item.barcode.toLowerCase());
      if (item.productId) existing.searchTerms.add(item.productId.toLowerCase());

      const productKey = item.productId || item.barcode || item.product;
      if (productKey) existing.products.add(productKey);

      if (item.productCost) {
        existing.totalCost += Number(item.productCost);
        existing.costCount += 1;
      }
      if (item.productPrice) {
        existing.totalPrice += Number(item.productPrice);
        existing.priceCount += 1;
      }

      invoiceMap.set(item.invoiceNumber, existing);
    });

    const allInvoices = Array.from(invoiceMap.values()).map(invoice => {
      const avgCost = invoice.costCount > 0 ? invoice.totalCost / invoice.costCount : 0;
      const avgPrice = invoice.priceCount > 0 ? invoice.totalPrice / invoice.priceCount : 0;

      return {
        ...invoice,
        productsCount: invoice.products.size,
        searchTerms: Array.from(invoice.searchTerms),
        avgCost,
        avgPrice,
        products: undefined, // remove Set
      };
    }).sort((a, b) => {
      const dateA = new Date(a.invoiceDate).getTime();
      const dateB = new Date(b.invoiceDate).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return b.invoiceNumber.localeCompare(a.invoiceNumber);
    });

    let filteredInvoices = allInvoices;
    if (invoiceTypeFilter && invoiceTypeFilter !== 'all') {
      filteredInvoices = allInvoices.filter(inv => {
        const num = inv.invoiceNumber.trim().toUpperCase();
        if (invoiceTypeFilter === 'sales') return num.startsWith('SAL');
        if (invoiceTypeFilter === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }

    // 2. Sales by Day Data
    const dateMap = new Map<string, any>();
    globallyFilteredData.forEach(item => {
      if (!item.invoiceDate) return;
      const dateKey = formatDate(item.invoiceDate);
      if (!dateKey) return;

      const existing = dateMap.get(dateKey) || {
        date: dateKey,
        amount: 0,
        qty: 0,
        invoiceNumbers: new Set<string>(),
        products: new Set<string>(),
        customers: new Set<string>(),
        salInvoiceNumbers: new Set<string>(),
        salProducts: new Set<string>(),
        salCustomers: new Set<string>()
      };

      existing.amount += Number(item.amount) || 0;
      existing.qty += Number(item.qty) || 0;

      if (item.invoiceNumber) {
        existing.invoiceNumbers.add(item.invoiceNumber);
        if (item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
          existing.salInvoiceNumbers.add(item.invoiceNumber);
          const pKey = item.productId || item.barcode || item.product;
          if (pKey) existing.salProducts.add(pKey);
          const cKey = item.customerId || item.customerName;
          if (cKey) existing.salCustomers.add(cKey);
        }
      }

      const pKey = item.productId || item.barcode || item.product;
      if (pKey) existing.products.add(pKey);
      const cKey = item.customerId || item.customerName;
      if (cKey) existing.customers.add(cKey);

      dateMap.set(dateKey, existing);
    });

    const salesByDayData = Array.from(dateMap.values()).map(item => ({
      date: item.date,
      amount: item.amount,
      qty: item.qty,
      invoicesCount: item.invoiceNumbers.size,
      productsCount: item.products.size,
      customersCount: item.customers.size,
      salInvoicesCount: item.salInvoiceNumbers.size,
      salProductsCount: item.salProducts.size,
      salCustomersCount: item.salCustomers.size
    })).sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-')).getTime();
      const dateB = new Date(b.date.split('/').reverse().join('-')).getTime();
      return dateB - dateA;
    });

    // 3. Avg Sales by Day
    const monthMap = new Map<string, any>();
    salesByDayData.forEach(item => {
      if (!item.date) return;
      const [day, month, year] = item.date.split('/');
      if (!day || !month || !year) return;

      const monthKey = `${year}-${month.padStart(2, '0')}`;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[parseInt(month, 10) - 1] || month;
      const monthYear = `${monthName.toUpperCase()} ${year}`;

      const existing = monthMap.get(monthKey) || {
        monthKey,
        monthYear,
        totalAmount: 0,
        totalQty: 0,
        totalInvoices: 0,
        totalCustomers: 0,
        totalProducts: 0,
        daysCount: 0
      };

      existing.totalAmount += item.amount;
      existing.totalQty += item.qty;
      existing.totalInvoices += item.salInvoicesCount;
      existing.totalCustomers += item.salCustomersCount;
      existing.totalProducts += item.salProductsCount;
      existing.daysCount += 1;

      monthMap.set(monthKey, existing);
    });

    const avgSalesByDayData = Array.from(monthMap.values()).map(item => ({
      monthKey: item.monthKey,
      monthYear: item.monthYear,
      avgAmount: item.daysCount > 0 ? item.totalAmount / item.daysCount : 0,
      avgQty: item.daysCount > 0 ? item.totalQty / item.daysCount : 0,
      avgInvoices: item.daysCount > 0 ? item.totalInvoices / item.daysCount : 0,
      avgCustomers: item.daysCount > 0 ? item.totalCustomers / item.daysCount : 0,
      avgProducts: item.daysCount > 0 ? item.totalProducts / item.daysCount : 0
    })).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    return NextResponse.json({
      dailySalesData: filteredInvoices,
      salesByDayData,
      avgSalesByDayData
    });

  } catch (error: any) {
    console.error('API Error DailySales:', error);
    return NextResponse.json({ error: 'Failed to fetch daily sales data', details: error.message || error }, { status: 500 });
  }
}
