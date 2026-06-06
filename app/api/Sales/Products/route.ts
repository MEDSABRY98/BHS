import { NextResponse } from 'next/server';
import { getMappingServer, applyMapping } from '@/lib/SalesMappingCache';
import { getSalesDataServer } from '@/lib/SalesCache';

export async function POST(request: Request) {
  try {
    const { userId, filters } = await request.json();

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

    // Sort by date to get latest name/barcode easily
    globallyFilteredData.sort((a, b) => {
      const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
      const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
      return dateB - dateA; // Descending
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

    // Optionally sort by amount descending before returning
    productsData.sort((a, b) => b.amount - a.amount);

    return NextResponse.json({ productsData });

  } catch (error: any) {
    console.error('API Error Products:', error);
    return NextResponse.json({ error: 'Failed to fetch products data', details: error.message || error }, { status: 500 });
  }
}
