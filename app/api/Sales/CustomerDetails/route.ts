import { NextResponse } from 'next/server';
import { getMappingServer, applyMapping } from '@/app/Sales/Utils/SalesMappingCache';
import { getSalesDataServer } from '@/app/Sales/Utils/SalesCache';

export async function POST(request: Request) {
  try {
    const { userId, filters, customerName, customerId, customerType } = await request.json();

    const rawData = await getSalesDataServer();
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Sales cache is empty' }, { status: 500 });
    }

    // Mapping (memory cache — no DB call after first request)
    const mappingMap = userId ? await getMappingServer(userId) : new Map();
    const augmentedData = mappingMap.size > 0
      ? rawData.map((item: any) => applyMapping(item, mappingMap))
      : rawData;

    // First filter down to just THIS CUSTOMER to save loop operations!
    let customerRawData = augmentedData.filter(item => {
      if (customerType === 'main') {
        return (item.customerMainName || item.customerName || 'Unknown') === customerName;
      } else {
        if (customerId) return item.customerId === customerId;
        return item.customerName === customerName;
      }
    });

    // Apply Global Filters (except date) -> to get `allData`
    let allData = customerRawData;
    if (filters) {
      const { invoiceType, area, market, merchandiser, salesRep, productTag } = filters;

      if (invoiceType && invoiceType !== 'all') {
        allData = allData.filter(item => {
          const num = item.invoiceNumber?.trim().toUpperCase() || '';
          if (invoiceType === 'sales') return num.startsWith('SAL');
          if (invoiceType === 'returns') return num.startsWith('RSAL');
          return true;
        });
      }
      if (productTag) allData = allData.filter(i => i.productTag === productTag);
      if (area) allData = allData.filter(i => i.area === area);
      if (market) allData = allData.filter(i => i.market === market);
      if (merchandiser) allData = allData.filter(i => i.merchandiser === merchandiser);
      if (salesRep) allData = allData.filter(i => i.salesRep === salesRep);
    }

    // Apply Date Filters -> to get `data`
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

    return NextResponse.json({ data, allData });

  } catch (error: any) {
    console.error('API Error CustomerDetails:', error);
    return NextResponse.json({ error: 'Failed to fetch customer details', details: error.message || error }, { status: 500 });
  }
}
