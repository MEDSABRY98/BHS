import { NextResponse } from 'next/server';
import { getMappingServer, applyMapping } from '@/lib/MappingCache';
import { getSalesDataServer } from '@/lib/SalesCache';

const calculateMode = (numbers: number[]): number => {
  if (!numbers || numbers.length === 0) return 0;
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let mode = numbers[0];
  for (const n of numbers) {
    const val = parseFloat(n.toFixed(2));
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount) {
      maxCount = counts[val];
      mode = val;
    }
  }
  return mode;
};

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
      if (year && year !== 'All') globallyFilteredData = globallyFilteredData.filter(i => new Date(i.invoiceDate).getFullYear().toString() === year);
      if (month && month !== 'All') globallyFilteredData = globallyFilteredData.filter(i => (new Date(i.invoiceDate).getMonth() + 1).toString() === month);
      if (dateFrom) globallyFilteredData = globallyFilteredData.filter(i => new Date(i.invoiceDate) >= new Date(dateFrom));
      if (dateTo) globallyFilteredData = globallyFilteredData.filter(i => new Date(i.invoiceDate) <= new Date(dateTo));
      if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
      if (area) globallyFilteredData = globallyFilteredData.filter(i => i.area === area);
      if (market) globallyFilteredData = globallyFilteredData.filter(i => i.market === market);
      if (merchandiser) globallyFilteredData = globallyFilteredData.filter(i => i.merchandiser === merchandiser);
      if (salesRep) globallyFilteredData = globallyFilteredData.filter(i => i.salesRep === salesRep);
    }

    const sortedData = [...globallyFilteredData].sort((a, b) => {
      const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
      const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
      return dateB - dateA;
    });

    // 1. Process Customers Data
    const customerMap = new Map<string, {
      customerId: string;
      latestName: string;
      allNames: Set<string>;
      products: Map<string, { 
        barcode: string; 
        product: string; 
        prices: number[]; 
        cost: number;
        allNames: Set<string>;
        allBarcodes: Set<string>;
      }>;
    }>();

    // 2. Process Products Data
    const productMap = new Map<string, {
      productId: string;
      barcode: string;
      product: string;
      priceRange: { min: number, max: number };
      customers: Map<string, { prices: number[]; cost: number }>;
      allNames: Set<string>;
      allBarcodes: Set<string>;
    }>();

    sortedData.forEach(item => {
      const itemAny = item as any;
      let price = itemAny.price || itemAny.unitPrice || 0;
      if (!price && itemAny.amount && itemAny.qty) price = itemAny.amount / itemAny.qty;
      const pNum = parseFloat(price);
      
      const custId = item.customerId || item.customerMainName || item.customerName || 'Unknown';
      const custName = item.customerMainName || item.customerName || 'Unknown';
      const productKey = item.productId || item.barcode || item.product || 'Unknown';

      // --- Customers Map ---
      if (!customerMap.has(custId)) {
        customerMap.set(custId, {
          customerId: item.customerId || '',
          latestName: custName,
          allNames: new Set(),
          products: new Map()
        });
      }
      const custEntry = customerMap.get(custId)!;
      if (item.customerMainName) custEntry.allNames.add(item.customerMainName.toLowerCase());
      if (item.customerName) custEntry.allNames.add(item.customerName.toLowerCase());

      if (!custEntry.products.has(productKey)) {
        custEntry.products.set(productKey, {
          barcode: item.barcode || '-',
          product: item.product || '-',
          prices: [],
          cost: item.productCost || 0,
          allNames: new Set(),
          allBarcodes: new Set()
        });
      }
      const prodInCust = custEntry.products.get(productKey)!;
      if (item.product) prodInCust.allNames.add(item.product.toLowerCase());
      if (item.barcode) prodInCust.allBarcodes.add(item.barcode.toLowerCase());
      if (!isNaN(pNum) && pNum > 0) prodInCust.prices.push(pNum);
      if (item.productCost > 0) prodInCust.cost = item.productCost;

      // --- Products Map ---
      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          productId: item.productId || '',
          barcode: item.barcode || '-',
          product: item.product || '-',
          priceRange: { min: Infinity, max: -Infinity },
          customers: new Map(),
          allNames: new Set(),
          allBarcodes: new Set()
        });
      }
      const prodEntry = productMap.get(productKey)!;
      if (item.product) prodEntry.allNames.add(item.product.toLowerCase());
      if (item.barcode) prodEntry.allBarcodes.add(item.barcode.toLowerCase());

      if (!prodEntry.customers.has(custName)) {
        prodEntry.customers.set(custName, { prices: [], cost: item.productCost || 0 });
      }
      const custInProd = prodEntry.customers.get(custName)!;
      if (!isNaN(pNum) && pNum > 0) {
        custInProd.prices.push(pNum);
        prodEntry.priceRange.min = Math.min(prodEntry.priceRange.min, pNum);
        prodEntry.priceRange.max = Math.max(prodEntry.priceRange.max, pNum);
      }
      if (item.productCost > 0) custInProd.cost = item.productCost;
    });

    // Finalize Customers Data
    const customersData = Array.from(customerMap.values()).map(entry => ({
      customerId: entry.customerId,
      customer: entry.latestName,
      allNames: Array.from(entry.allNames),
      products: Array.from(entry.products.values()).map(p => ({
        barcode: p.barcode,
        product: p.product,
        cost: p.cost,
        mostPrice: calculateMode(p.prices),
        lastPrice: p.prices[0] || 0,
        allNames: Array.from(p.allNames),
        allBarcodes: Array.from(p.allBarcodes)
      })).sort((a, b) => a.product.localeCompare(b.product))
    })).sort((a, b) => a.customer.localeCompare(b.customer));

    // Finalize Products Data
    const productList = Array.from(productMap.values()).map(prod => {
      // Calculate distributions and precompute cust stats
      const customers = Array.from(prod.customers.entries()).map(([cName, stats]) => {
        return {
          customerName: cName,
          mostPrice: calculateMode(stats.prices),
          lastPrice: stats.prices[0] || 0,
          cost: stats.cost,
          pricesDistribution: stats.prices // Need this for the global product distribution chart
        };
      });

      return {
        productId: prod.productId,
        barcode: prod.barcode,
        product: prod.product,
        priceRange: prod.priceRange,
        customers,
        allNames: Array.from(prod.allNames),
        allBarcodes: Array.from(prod.allBarcodes)
      };
    }).sort((a, b) => a.product.localeCompare(b.product));

    return NextResponse.json({ customersData, productList });

  } catch (error: any) {
    console.error('API Error StockReport:', error);
    return NextResponse.json({ error: 'Failed to fetch stock report data', details: error.message || error }, { status: 500 });
  }
}
