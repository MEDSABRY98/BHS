import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { getSalesDataServer } from '@/lib/SalesCache';

export async function POST(request: Request) {
  try {
    const { userId, forceRefresh } = await request.json();

    // 1. Fetch cached sales data from Vercel Memory (Super fast)
    const rawData = await getSalesDataServer(forceRefresh);

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Sales cache is empty' }, { status: 500 });
    }

    // 2. Fetch User Mapping from the database
    let mappingMap = new Map<string, any>();
    if (userId) {
      const { data: mappingData, error: mapErr } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .select('*')
        .eq('USER_ID', userId);

      if (!mapErr && mappingData) {
        mappingData.forEach(m => {
          mappingMap.set(m["CUSTOMER ID"], m);
        });
      }
    }

    // 3. Apply Mapping to extract unique values
    const areas = new Set<string>();
    const markets = new Set<string>();
    const merchandisers = new Set<string>();
    const salesReps = new Set<string>();
    const productTags = new Set<string>();
    const years = new Set<string>();
    
    let latestDate = 0;

    rawData.forEach(item => {
      const mapping = mappingMap.get(item.customerId);
      const area = mapping?.["AREA"] || item.area;
      const market = mapping?.["MARKET"] || item.market;
      const merchandiser = mapping?.["MERCHANDISER"] || item.merchandiser;
      const salesRep = mapping?.["SALES_REP"] || item.salesRep;
      
      if (area) areas.add(area);
      if (market) markets.add(market);
      if (merchandiser) merchandisers.add(merchandiser);
      if (salesRep) salesReps.add(salesRep);
      if (item.productTag) productTags.add(item.productTag);
      
      if (item.invoiceDate) {
        const d = new Date(item.invoiceDate);
        if (!isNaN(d.getTime())) {
          years.add(d.getFullYear().toString());
          if (d.getTime() > latestDate) latestDate = d.getTime();
        }
      }
    });

    const lastUpdated = latestDate > 0 
      ? new Date(latestDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : null;

    return NextResponse.json({
      uniqueValues: {
        areas: Array.from(areas).sort(),
        markets: Array.from(markets).sort(),
        merchandisers: Array.from(merchandisers).sort(),
        salesReps: Array.from(salesReps).sort(),
        productTags: Array.from(productTags).sort(),
        years: Array.from(years).sort((a, b) => b.localeCompare(a))
      },
      lastUpdated
    });

  } catch (error: any) {
    console.error('API Error Metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metadata', details: error.message || error },
      { status: 500 }
    );
  }
}
