import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { getSalesDataServer } from '@/lib/SalesCache';

export async function POST(request: Request) {
  try {
    const { userId, filters, currentYear, prevYear, selectedMonth } = await request.json();

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

    // Apply Global Filters (Except Year and Month - because we compare years and use selectedMonth locally)
    let globallyFilteredData = augmentedData;
    if (filters) {
      // Intentionally omitting year and month
      const { invoiceType, area, market, merchandiser, salesRep, productTag } = filters;

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
    }

    // Only SAL invoices
    const salesOnly = globallyFilteredData.filter(item =>
      item.invoiceNumber?.trim().toUpperCase().startsWith('SAL')
    );

    const targetMonth = selectedMonth ? parseInt(selectedMonth) : null;
    const today = new Date();

    // Map builders
    const processDataForType = (type: 'main' | 'sub') => {
      const mapPrev = new Map<string, { mainName: string; subName: string; amount: number }>();
      const mapCurr = new Map<string, { mainName: string; subName: string; amount: number }>();

      for (let i = 0; i < salesOnly.length; i++) {
        const item = salesOnly[i];
        if (!item.invoiceDate) continue;
        
        const d = new Date(item.invoiceDate);
        if (isNaN(d.getTime())) continue;

        const year = d.getFullYear();
        const month = d.getMonth() + 1;

        if (targetMonth && month !== targetMonth) continue;
        if (year === currentYear && d > today) continue; // For current year: only up to today

        const key = type === 'sub'
          ? (item.customerId?.trim() || item.customerName?.trim())
          : (item.customerMainName?.trim() || item.customerName?.trim());

        if (!key) continue;

        const mainName = item.customerMainName?.trim() || item.customerName?.trim() || '';
        const subName = item.customerName?.trim() || '';

        if (year === prevYear) {
          const existing = mapPrev.get(key) || { mainName, subName, amount: 0 };
          existing.amount += Number(item.amount) || 0;
          mapPrev.set(key, existing);
        } else if (year === currentYear) {
          const existing = mapCurr.get(key) || { mainName, subName, amount: 0 };
          existing.amount += Number(item.amount) || 0;
          mapCurr.set(key, existing);
        }
      }

      const allKeys = new Set([...mapPrev.keys(), ...mapCurr.keys()]);
      const result: any[] = [];

      for (const key of allKeys) {
        const prev = mapPrev.get(key);
        const curr = mapCurr.get(key);
        const prevAmt = prev?.amount ?? 0;
        const currAmt = curr?.amount ?? 0;
        const diff = currAmt - prevAmt;
        const pct = prevAmt > 0 ? (diff / prevAmt) * 100 : (currAmt > 0 ? 100 : 0);

        const mainName = (curr?.mainName || prev?.mainName) ?? '';
        const subName = type === 'sub' ? ((curr?.subName || prev?.subName) ?? '') : '';

        result.push({
          customerId: key,
          mainName,
          subName,
          prev: prevAmt,
          curr: currAmt,
          diff,
          pct,
        });
      }

      return result;
    };

    const mainComparison = processDataForType('main');
    const subComparison = processDataForType('sub');

    return NextResponse.json({ mainComparison, subComparison });

  } catch (error: any) {
    console.error('API Error CustomersComparison:', error);
    return NextResponse.json({ error: 'Failed to fetch customers comparison', details: error.message || error }, { status: 500 });
  }
}
