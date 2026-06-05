import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { getSalesDataServer } from '@/lib/SalesCache';

export async function POST(request: Request) {
  try {
    const { userId, filters } = await request.json();

    const rawData = await getSalesDataServer();
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Sales cache is empty' }, { status: 500 });
    }

    // Apply Mapping
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

    let augmentedData = rawData;
    if (mappingMap.size > 0) {
      augmentedData = rawData.map(item => {
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

    const categoriesData = Array.from(categoryMap.values()).map(item => ({
      category: item.category,
      amount: item.totalAmount,
      qty: item.totalQty,
      customers: item.customerIds.size,
      customerIds: Array.from(item.customerIds) // So the frontend can calculate unique customers across filtered categories
    }));

    return NextResponse.json({ categoriesData });

  } catch (error: any) {
    console.error('API Error Categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories data', details: error.message || error }, { status: 500 });
  }
}
