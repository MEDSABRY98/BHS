import { NextResponse } from 'next/server';
import { getFilteredSalesData } from '@/app/Sales/Utils/SalesMappingCache';

export async function POST(request: Request) {
  try {
    const { userId, filters } = await request.json();

    const augmentedData = await getFilteredSalesData(userId);

    // Find the absolute FIRST purchase date for each (Customer, Product) pair.
    // We apply non-date global filters FIRST (Area, Market, etc)
    let preFilteredData = augmentedData;
    if (filters) {
      const { area, market, merchandiser, salesRep, productTag } = filters;
      if (productTag) preFilteredData = preFilteredData.filter(i => i.productTag === productTag);
      if (area) preFilteredData = preFilteredData.filter(i => i.area === area);
      if (market) preFilteredData = preFilteredData.filter(i => i.market === market);
      if (merchandiser) preFilteredData = preFilteredData.filter(i => i.merchandiser === merchandiser);
      if (salesRep) preFilteredData = preFilteredData.filter(i => i.salesRep === salesRep);
    }

    // Step 1: Find first purchase date for each Customer+Product pair
    const firstPurchaseMap = new Map<string, { time: number, invoiceItem: any }>();

    for (const item of preFilteredData) {
      // ONLY consider SALES invoices
      if (!item.invoiceNumber || typeof item.invoiceNumber !== 'string') continue;

      const invNum = item.invoiceNumber;
      // Fast check for 'SAL' prefix (ignoring case, avoiding trim/toUpperCase for speed)
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

    // Step 2: Group by Month and apply date filters
    const monthlyListings: Record<string, any> = {};

    for (const [key, data] of firstPurchaseMap.entries()) {
      const { time, invoiceItem } = data;
      const date = new Date(time);

      // Apply date filters to the "First Purchase Event"
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
          customersMap: new Map() // to ensure unique customers
        };
      }

      monthlyListings[monthKey].products[productId].customersMap.set(customerId, customerName);
    }

    // Transform to Array
    const result: any[] = [];
    const sortedMonths = Object.keys(monthlyListings).sort().reverse(); // Newest first

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

      // Parse month name for UI convenience
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

    return NextResponse.json({ data: result });

  } catch (error: any) {
    console.error('API Error NewListings:', error);
    return NextResponse.json({ error: 'Failed to fetch new listings', details: error.message }, { status: 500 });
  }
}
