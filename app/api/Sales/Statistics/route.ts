import { NextResponse } from 'next/server';
import { getFilteredSalesData } from '@/app/Sales/Utils/SalesMappingCache';

function calculateStatsForDimension(data: any[], dimensionKey: string) {
  const dimensionMap = new Map<string, { amount: number; qty: number; count: number }>();
  const dimensionMonthsMap = new Map<string, Set<string>>();
  const monthlyData = new Map<string, Map<string, { amount: number; qty: number }>>();

  data.forEach(item => {
    const dimValue = item[dimensionKey];
    if (!dimValue) return;

    // 1. Basic Stats
    const existing = dimensionMap.get(dimValue) || { amount: 0, qty: 0, count: 0 };
    dimensionMap.set(dimValue, {
      amount: existing.amount + (Number(item.amount) || 0),
      qty: existing.qty + (Number(item.qty) || 0),
      count: existing.count + 1
    });

    if (!item.invoiceDate) return;
    const date = new Date(item.invoiceDate);
    if (isNaN(date.getTime())) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // 2. Unique Months
    if (!dimensionMonthsMap.has(dimValue)) {
      dimensionMonthsMap.set(dimValue, new Set());
    }
    dimensionMonthsMap.get(dimValue)!.add(monthKey);

    // 3. Monthly Data
    if (!monthlyData.has(dimValue)) {
      monthlyData.set(dimValue, new Map());
    }
    const dimMonths = monthlyData.get(dimValue)!;

    if (!dimMonths.has(monthKey)) {
      dimMonths.set(monthKey, { amount: 0, qty: 0 });
    }
    const monthData = dimMonths.get(monthKey)!;
    monthData.amount += Number(item.amount) || 0;
    monthData.qty += Number(item.qty) || 0;
  });

  const totalAmountAll = Array.from(dimensionMap.values()).reduce((sum, v) => sum + v.amount, 0);

  const stats = Array.from(dimensionMap.entries()).map(([dim, values]) => {
    const monthsCount = dimensionMonthsMap.get(dim)?.size || 1;
    const averageMonthly = values.amount / monthsCount;

    const dimMonthlyData = monthlyData.get(dim);
    let averageMonthlyGrowth = 0;
    if (dimMonthlyData && dimMonthlyData.size > 1) {
      const sortedMonths = Array.from(dimMonthlyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      const growths: number[] = [];
      for (let i = 1; i < sortedMonths.length; i++) {
        const prevAmount = sortedMonths[i - 1][1].amount;
        const currAmount = sortedMonths[i][1].amount;
        growths.push(currAmount - prevAmount);
      }
      if (growths.length > 0) {
        averageMonthlyGrowth = growths.reduce((sum, g) => sum + g, 0) / growths.length;
      }
    }

    return {
      name: dim,
      totalAmount: values.amount,
      totalQty: values.qty,
      invoiceCount: values.count,
      averageMonthly: averageMonthly,
      averageMonthlyGrowth: averageMonthlyGrowth,
      percentageOfTotal: totalAmountAll > 0 ? (values.amount / totalAmountAll) * 100 : 0
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount);

  // Convert monthlyData Maps to plain objects for JSON serialization
  const serializedMonthlyData: Record<string, any> = {};
  for (const [dim, monthsMap] of monthlyData.entries()) {
    serializedMonthlyData[dim] = Object.fromEntries(monthsMap);
  }

  return { stats, monthlyData: serializedMonthlyData };
}

export async function POST(request: Request) {
  try {
    const { userId, filters } = await request.json();

    const augmentedData = await getFilteredSalesData(userId);

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

    const areaStats = calculateStatsForDimension(globallyFilteredData, 'area');
    const marketStats = calculateStatsForDimension(globallyFilteredData, 'market');
    const merchandiserStats = calculateStatsForDimension(globallyFilteredData, 'merchandiser');
    const salesRepStats = calculateStatsForDimension(globallyFilteredData, 'salesRep');

    return NextResponse.json({
      areaStats,
      marketStats,
      merchandiserStats,
      salesRepStats
    });

  } catch (error: any) {
    console.error('API Error Statistics:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics data', details: error.message || error }, { status: 500 });
  }
}
