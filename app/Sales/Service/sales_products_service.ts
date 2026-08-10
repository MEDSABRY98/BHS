'use server';

import { getFilteredSalesData } from '@/app/Sales/Utils/SalesMappingCache';

// -------------------------------------------------------------
// 1. Products Data
// -------------------------------------------------------------
export async function getProductsData(userId: string, filters: any) {
  const augmentedData = await getFilteredSalesData(userId);

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag, customerTag, customerClass } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
    if (customerTag) globallyFilteredData = globallyFilteredData.filter(i => i.customerTag === customerTag);
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

  const productMap = new Map<string, any>();

  globallyFilteredData.forEach(item => {
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

  const productsData = Array.from(productMap.values()).map(item => ({
    productId: item.productId,
    barcode: item.barcode,
    product: item.product,
    amount: item.totalAmount,
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
    const { invoiceType, area, market, merchandiser, salesRep, productTag, customerTag, customerClass } = filters;
    if (invoiceType && invoiceType !== 'all') {
      allData = allData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) allData = allData.filter(i => i.productTag === productTag);
    if (customerTag) allData = allData.filter(i => i.customerTag === customerTag);
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
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag, customerTag, customerClass } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
    if (customerTag) globallyFilteredData = globallyFilteredData.filter(i => i.customerTag === customerTag);
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

  const categoryMap = new Map<string, {
    category: string;
    totalAmount: number;
    totalQty: number;
    customerIds: Set<string>;
  }>();

  globallyFilteredData.forEach(item => {
    const category = item.productTag || 'Uncategorized';
    let existing = categoryMap.get(category);

    if (!existing) {
      existing = {
        category: category,
        totalAmount: 0,
        totalQty: 0,
        customerIds: new Set<string>(),
      };
      categoryMap.set(category, existing);
    }

    existing.totalAmount += Number(item.amount) || 0;
    existing.totalQty += Number(item.qty) || 0;

    const customerKey = item.customerId || item.customerName;
    if (customerKey) {
      existing.customerIds.add(customerKey);
    }
  });

  return Array.from(categoryMap.values()).map(item => ({
    category: item.category,
    amount: item.totalAmount,
    qty: item.totalQty,
    customers: item.customerIds.size,
    customerIds: Array.from(item.customerIds) 
  }));
}

// -------------------------------------------------------------
// 4. New Listings Data
// -------------------------------------------------------------
export async function getNewListingsData(userId: string, filters: any) {
  const augmentedData = await getFilteredSalesData(userId);

  let preFilteredData = augmentedData;
  if (filters) {
    const { area, market, merchandiser, salesRep, productTag, customerTag, customerClass } = filters;
    if (productTag) preFilteredData = preFilteredData.filter(i => i.productTag === productTag);
    if (customerTag) preFilteredData = preFilteredData.filter(i => i.customerTag === customerTag);
    if (customerClass) preFilteredData = preFilteredData.filter(i => i.customerClass === customerClass);
    if (area) preFilteredData = preFilteredData.filter(i => i.area === area);
    if (market) preFilteredData = preFilteredData.filter(i => i.market === market);
    if (merchandiser) preFilteredData = preFilteredData.filter(i => i.merchandiser === merchandiser);
    if (salesRep) preFilteredData = preFilteredData.filter(i => i.salesRep === salesRep);
  }

  const firstPurchaseMap = new Map<string, { time: number, invoiceItem: any }>();

  for (const item of preFilteredData) {
    if (!item.invoiceNumber || typeof item.invoiceNumber !== 'string') continue;

    const invNum = item.invoiceNumber;
    if (!(invNum[0] === 'S' || invNum[0] === 's') || !(invNum[1] === 'A' || invNum[1] === 'a') || !(invNum[2] === 'L' || invNum[2] === 'l')) {
      continue;
    }

    if (!item.invoiceDate) continue;

    const customerId = item.customerId || item.customerName;
    const productId = item.productId || item.product;

    if (!customerId || !productId) continue;

    const key = `${customerId}|||${productId}`;
    const itemTime = Date.parse(item.invoiceDate);

    if (isNaN(itemTime)) continue;

    const existing = firstPurchaseMap.get(key);
    if (!existing || itemTime < existing.time) {
      firstPurchaseMap.set(key, { time: itemTime, invoiceItem: item });
    }
  }

  const monthlyListings: Record<string, any> = {};

  for (const [key, data] of firstPurchaseMap.entries()) {
    const { time, invoiceItem } = data;
    const date = new Date(time);

    if (filters) {
      const { year, month, dateFrom, dateTo } = filters;
      if (year && date.getFullYear() !== parseInt(year, 10)) continue;
      if (month && date.getMonth() + 1 !== parseInt(month, 10)) continue;
      if (dateFrom && time < Date.parse(dateFrom)) continue;
      if (dateTo) {
        const tDate = new Date(dateTo);
        tDate.setHours(23, 59, 59, 999);
        if (time > tDate.getTime()) continue;
      }
    }

    const yearStr = date.getFullYear();
    const monthStr = date.getMonth() + 1;
    const monthKey = `${yearStr}-${monthStr < 10 ? '0' : ''}${monthStr}`;

    if (!monthlyListings[monthKey]) {
      monthlyListings[monthKey] = {
        products: {}
      };
    }

    const productId = invoiceItem.productId || invoiceItem.product;
    const barcode = invoiceItem.barcode || '-';
    const productName = invoiceItem.product;
    const customerId = invoiceItem.customerId || invoiceItem.customerName;
    const customerName = invoiceItem.customerName || invoiceItem.customerMainName || 'Unknown';

    if (!monthlyListings[monthKey].products[productId]) {
      monthlyListings[monthKey].products[productId] = {
        barcode,
        productName,
        customersMap: new Map() 
      };
    }

    monthlyListings[monthKey].products[productId].customersMap.set(customerId, customerName);
  }

  const result: any[] = [];
  const sortedMonths = Object.keys(monthlyListings).sort().reverse(); 

  for (const monthKey of sortedMonths) {
    const productsData = monthlyListings[monthKey].products;
    const productsArr: any[] = [];
    const uniqueCustomersInMonth = new Set<string>();

    for (const [productId, pData] of Object.entries(productsData)) {
      const customersArr = Array.from((pData as any).customersMap.entries()).map(([id, name]: any) => {
        uniqueCustomersInMonth.add(id as string);
        return { id, name };
      }).sort((a: any, b: any) => a.name.localeCompare(b.name));

      productsArr.push({
        productId,
        barcode: (pData as any).barcode,
        productName: (pData as any).productName,
        customers: customersArr,
        customersCount: customersArr.length
      });
    }

    productsArr.sort((a, b) => {
      if (b.customersCount !== a.customersCount) {
        return b.customersCount - a.customersCount;
      }
      return (a.productName || '').localeCompare(b.productName || '');
    });

    const [y, m] = monthKey.split('-');
    const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'long' });

    result.push({
      monthKey,
      monthName: `${monthName} ${y}`,
      uniqueProductsCount: productsArr.length,
      uniqueCustomersCount: uniqueCustomersInMonth.size,
      products: productsArr
    });
  }

  return result;
}
