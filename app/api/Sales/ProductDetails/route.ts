import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { getSalesDataServer } from '@/lib/SalesCache';

export async function POST(request: Request) {
  try {
    const { userId, filters, productId } = await request.json();

    const rawData = await getSalesDataServer();
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Sales cache is empty' }, { status: 500 });
    }

    // First filter down to just THIS PRODUCT to save loop operations!
    let productRawData = rawData.filter(item => {
      return (item.productId || item.barcode || item.product) === productId;
    });

    // Apply Mapping for customer details (since product details show customers)
    let mappingMap = new Map<string, any>();
    if (userId) {
      const { data: mappingData, error: mapErr } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .select('*')
        .eq('USER_ID', userId);
      if (!mapErr && mappingData) {
        mappingData.forEach(m => mappingMap.set(m["CUSTOMER ID"], m));
      }
    }

    let augmentedData = productRawData;
    if (mappingMap.size > 0) {
      augmentedData = productRawData.map(item => {
        const mapping = mappingMap.get(item.customerId);
        if (mapping) {
          return {
            ...item,
            customerMainName: mapping["CUSTOMER MAIN NAME"] || item.customerMainName,
            customerName: mapping["CUSTOMER SUB NAME"] || item.customerName,
            area: mapping["AREA"] || item.area,
            market: mapping["MARKET"] || item.market,
            merchandiser: mapping["MERCHANDISER"] || item.merchandiser,
            salesRep: mapping["SALES_REP"] || item.salesRep,
          };
        }
        return item;
      });
    }

    // Apply Global Filters (except date) -> to get `allData`
    let allData = augmentedData;
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
    console.error('API Error ProductDetails:', error);
    return NextResponse.json({ error: 'Failed to fetch product details', details: error.message || error }, { status: 500 });
  }
}
