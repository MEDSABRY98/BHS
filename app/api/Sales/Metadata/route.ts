import { NextResponse } from 'next/server';
import { getFilteredSalesData, getMappingServer, invalidateMappingCache } from '@/app/Sales/Utils/SalesMappingCache';
import { buildAndSaveCache, invalidateMemoryCache } from '@/app/Sales/Utils/SalesCache';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { userId, forceRefresh } = await request.json();

    if (forceRefresh) {
      invalidateMemoryCache();
      invalidateMappingCache();
      await buildAndSaveCache();
    }

    // 1. Get filtered and mapped sales data & mappings for the user
    const augmentedData = await getFilteredSalesData(userId);
    const myMappings = await getMappingServer(userId);

    // 2. Extract unique values
    const areas = new Set<string>();
    const markets = new Set<string>();
    const merchandisers = new Set<string>();
    const salesReps = new Set<string>();
    const productTags = new Set<string>();
    const years = new Set<string>();

    // Populate filters from customer assignments (ensures they show up even without sales)
    myMappings.forEach(m => {
      if (m.area) areas.add(m.area);
      if (m.market) markets.add(m.market);
      if (m.merchandiser) merchandisers.add(m.merchandiser);
      if (m.salesRep) salesReps.add(m.salesRep);
    });

    let latestDate = 0;

    augmentedData.forEach(item => {
      if (item.area) areas.add(item.area);
      if (item.market) markets.add(item.market);
      if (item.merchandiser) merchandisers.add(item.merchandiser);
      if (item.salesRep) salesReps.add(item.salesRep);
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
