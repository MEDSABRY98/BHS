import { NextResponse } from 'next/server';
import { getMappingServer, applyMapping } from '@/lib/MappingCache';
import { getSalesDataServer } from '@/lib/SalesCache';

export async function POST(request: Request) {
  try {
    const { userId, filters, days, minAmount } = await request.json();

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

    const customerMap = new Map<string, any>();
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < globallyFilteredData.length; i++) {
      const item = globallyFilteredData[i];
      const key = item.customerId || item.customerName;
      let existing = customerMap.get(key);

      if (!existing) {
        existing = {
          customerId: key,
          customer: item.customerName,
          lastPurchaseDate: null,
          totalAmount: 0,
          invoiceNumbers: new Set<string>(),
        };
        customerMap.set(key, existing);
      }

      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.totalAmount += Number(item.amount) || 0;
        existing.invoiceNumbers.add(item.invoiceNumber);

        if (item.invoiceDate) {
          const date = new Date(item.invoiceDate);
          if (!isNaN(date.getTime())) {
            if (!existing.lastPurchaseDate || date > existing.lastPurchaseDate) {
              existing.lastPurchaseDate = date;
            }
          }
        }
      }
    }

    const result: any[] = [];
    const minD = parseInt(days) || 10;
    const minA = parseFloat(minAmount) || 0;

    customerMap.forEach(item => {
      if (!item.lastPurchaseDate) return;

      const daysSince = Math.floor((currentDate.getTime() - item.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince < minD) return;
      if (item.totalAmount < minA) return;

      const orderCount = item.invoiceNumbers.size;
      const averageOrderValue = orderCount > 0 ? item.totalAmount / orderCount : 0;

      let status = 'Lost';
      if (daysSince < 30) status = 'At Risk';
      else if (daysSince < 60) status = 'Inactive';

      result.push({
        customerId: item.customerId,
        customer: item.customer,
        lastPurchaseDate: item.lastPurchaseDate,
        daysSinceLastPurchase: daysSince,
        totalAmount: item.totalAmount,
        averageOrderValue,
        orderCount,
        status
      });
    });

    return NextResponse.json({ inactiveCustomersData: result });

  } catch (error: any) {
    console.error('API Error InactiveCustomers:', error);
    return NextResponse.json({ error: 'Failed to fetch inactive customers', details: error.message || error }, { status: 500 });
  }
}
