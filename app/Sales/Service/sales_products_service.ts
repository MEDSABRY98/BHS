'use server';

import { getFilteredSalesData } from '@/app/Sales/Utils/SalesMappingCache';

// -------------------------------------------------------------
// 1. Products Data
// -------------------------------------------------------------
export async function getProductsData(userId: string, filters: any) {
  const augmentedData = await getFilteredSalesData(userId);

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag, product, customerName, customerTag, customerClass } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
    if (product) globallyFilteredData = globallyFilteredData.filter(i => i.product === product);
    if (customerTag) globallyFilteredData = globallyFilteredData.filter(i => i.customerTag === customerTag);
    if (customerName) globallyFilteredData = globallyFilteredData.filter(i => i.customerName === customerName || i.customerMainName === customerName);
    if (customerClass) globallyFilteredData = globallyFilteredData.filter(i => i.customerClass === customerClass);
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

  globallyFilteredData.sort((a, b) => {
    const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
    const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
    return dateB - dateA;
  });

  const uniqueMonths = new Set<string>();

  const productMap = new Map<string, any>();

  globallyFilteredData.forEach(item => {
    if (item.invoiceDate) {
      const d = new Date(item.invoiceDate);
      if (!isNaN(d.getTime())) {
        uniqueMonths.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
      }
    }

    const key = item.productId || item.barcode || item.product;
    let existing = productMap.get(key);

    if (!existing) {
      existing = {
        productId: item.productId || '',
        barcode: item.barcode || '-',
        product: item.product || '-',
        totalAmount: 0,
        totalQty: 0,
        invoiceNumbers: new Set<string>(),
        allNames: new Set<string>(),
        allBarcodes: new Set<string>()
      };
      productMap.set(key, existing);
    }

    existing.totalAmount += Number(item.amount) || 0;
    existing.totalQty += Number(item.qty) || 0;

    if (item.product) existing.allNames.add(item.product.toLowerCase());
    if (item.barcode) existing.allBarcodes.add(item.barcode.toLowerCase());

    if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
      existing.invoiceNumbers.add(item.invoiceNumber);
    }
  });

  const monthsCount = uniqueMonths.size || 1;

  const productsData = Array.from(productMap.values()).map(item => ({
    productId: item.productId,
    barcode: item.barcode,
    product: item.product,
    amount: item.totalAmount,
    avgMonthly: item.totalAmount / monthsCount,
    qty: item.totalQty,
    transactions: item.invoiceNumbers.size,
    allNames: Array.from(item.allNames),
    allBarcodes: Array.from(item.allBarcodes)
  }));

  productsData.sort((a, b) => b.amount - a.amount);

  return productsData;
}

// -------------------------------------------------------------
// 2. Product Details Data
// -------------------------------------------------------------
export async function getProductDetailsData(userId: string, filters: any, productId: string) {
  const augmentedData = await getFilteredSalesData(userId);

  let productRawData = augmentedData.filter(item => {
    return (item.productId || item.barcode || item.product) === productId;
  });

  let allData = productRawData;
  if (filters) {
    const { invoiceType, area, market, merchandiser, salesRep, productTag, product, customerName, customerTag, customerClass } = filters;
    if (invoiceType && invoiceType !== 'all') {
      allData = allData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) allData = allData.filter(i => i.productTag === productTag);
    if (product) allData = allData.filter(i => i.product === product);
    if (customerTag) allData = allData.filter(i => i.customerTag === customerTag);
    if (customerName) allData = allData.filter(i => i.customerName === customerName || i.customerMainName === customerName);
    if (customerClass) allData = allData.filter(i => i.customerClass === customerClass);
    if (area) allData = allData.filter(i => i.area === area);
    if (market) allData = allData.filter(i => i.market === market);
    if (merchandiser) allData = allData.filter(i => i.merchandiser === merchandiser);
    if (salesRep) allData = allData.filter(i => i.salesRep === salesRep);
  }

  let data = allData;
  if (filters) {
    const { year, month, dateFrom, dateTo } = filters;
    if (year) {
      const yearNum = parseInt(year, 10);
      data = data.filter(item => {
        if (!item.invoiceDate) return false;
        const d = new Date(item.invoiceDate);
        return !isNaN(d.getTime()) && d.getFullYear() === yearNum;
      });
    }
    if (month) {
      const monthNum = parseInt(month, 10);
      data = data.filter(item => {
        if (!item.invoiceDate) return false;
        const d = new Date(item.invoiceDate);
        return !isNaN(d.getTime()) && d.getMonth() + 1 === monthNum;
      });
    }
    if (dateFrom || dateTo) {
      data = data.filter(item => {
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

  return { data, allData };
}

// -------------------------------------------------------------
// 3. Categories Data
// -------------------------------------------------------------
export async function getCategoriesData(userId: string, filters: any) {
  const augmentedData = await getFilteredSalesData(userId);

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag, product, customerName, customerTag, customerClass } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
    if (product) globallyFilteredData = globallyFilteredData.filter(i => i.product === product);
    if (customerTag) globallyFilteredData = globallyFilteredData.filter(i => i.customerTag === customerTag);
    if (customerName) globallyFilteredData = globallyFilteredData.filter(i => i.customerName === customerName || i.customerMainName === customerName);
    if (customerClass) globallyFilteredData = globallyFilteredData.filter(i => i.customerClass === customerClass);
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

  const uniqueMonths = new Set<string>();

  const categoryMap = new Map<string, {
    category: string;
    totalAmount: number;
    totalQty: number;
    customerIds: Set<string>;
    mainCustomerIds: Set<string>;
    productIds: Set<string>;
  }>();

  globallyFilteredData.forEach(item => {
    if (item.invoiceDate) {
      const d = new Date(item.invoiceDate);
      if (!isNaN(d.getTime())) {
        uniqueMonths.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
      }
    }
    const category = item.productTag || 'Uncategorized';
    let existing = categoryMap.get(category);

    if (!existing) {
      existing = {
        category: category,
        totalAmount: 0,
        totalQty: 0,
        customerIds: new Set<string>(),
        mainCustomerIds: new Set<string>(),
        productIds: new Set<string>(),
      };
      categoryMap.set(category, existing);
    }

    existing.totalAmount += Number(item.amount) || 0;
    existing.totalQty += Number(item.qty) || 0;

    const customerKey = item.customerId || item.customerName;
    if (customerKey) {
      existing.customerIds.add(customerKey);
    }

    const mainCustomerKey = item.customerMainName || item.customerName;
    if (mainCustomerKey) {
      existing.mainCustomerIds.add(mainCustomerKey);
    }

    const productKey = item.productId || item.barcode || item.product;
    if (productKey) {
      existing.productIds.add(productKey);
    }
  });

  const monthsCount = uniqueMonths.size || 1;

  return Array.from(categoryMap.values()).map(item => ({
    category: item.category,
    amount: item.totalAmount,
    avgMonthly: item.totalAmount / monthsCount,
    qty: item.totalQty,
    customers: item.customerIds.size,
    mainCustomers: item.mainCustomerIds.size,
    productsCount: item.productIds.size,
    customerIds: Array.from(item.customerIds),
    mainCustomerIds: Array.from(item.mainCustomerIds)
  }));
}

