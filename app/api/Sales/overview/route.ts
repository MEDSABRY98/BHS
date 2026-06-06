import { NextResponse } from 'next/server';
import { getSalesDataServer } from '@/lib/SalesCache';
import { getMappingServer, applyMapping } from '@/lib/MappingCache';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, filters } = body;

    // 1. Sales data (memory → storage → DB fallback)
    const rawData = await getSalesDataServer();
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Sales cache is empty' }, { status: 500 });
    }

    // 2. Mapping (memory cache — no DB call after first request)
    const mappingMap = userId ? await getMappingServer(userId) : new Map();

    // 3. Apply Mapping
    let augmentedData = mappingMap.size > 0
      ? rawData.map(item => applyMapping(item, mappingMap))
      : rawData;


    // 4. Pre-parse dates and Apply Global Filters
    // Parsing dates is slow, so we do it once and cache the parsed values.
    const augmentedWithDates = augmentedData.map(item => {
      let parsedDate = null;
      let time = NaN;
      let yr = NaN;
      let mn = NaN;
      if (item.invoiceDate) {
        parsedDate = new Date(item.invoiceDate);
        time = parsedDate.getTime();
        if (!isNaN(time)) {
          yr = parsedDate.getFullYear();
          mn = parsedDate.getMonth() + 1; // 1-indexed
        }
      }
      return { ...item, parsedDate, time, yr, mn };
    });

    let globallyFilteredData = augmentedWithDates;
    let geographyFilteredData = augmentedWithDates; // Used for "all months" chart ignoring time

    if (filters) {
      const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters;

      // Apply Invoice Type
      if (invoiceType && invoiceType !== 'all') {
        globallyFilteredData = globallyFilteredData.filter(item => {
          const num = item.invoiceNumber?.trim().toUpperCase() || '';
          if (invoiceType === 'sales') return num.startsWith('SAL');
          if (invoiceType === 'returns') return num.startsWith('RSAL');
          return true;
        });
      }

      geographyFilteredData = [...globallyFilteredData];

      // Apply Geo Filters to geographyFilteredData
      if (productTag) geographyFilteredData = geographyFilteredData.filter(i => i.productTag === productTag);
      if (area) geographyFilteredData = geographyFilteredData.filter(i => i.area === area);
      if (market) geographyFilteredData = geographyFilteredData.filter(i => i.market === market);
      if (merchandiser) geographyFilteredData = geographyFilteredData.filter(i => i.merchandiser === merchandiser);
      if (salesRep) geographyFilteredData = geographyFilteredData.filter(i => i.salesRep === salesRep);

      globallyFilteredData = [...geographyFilteredData];

      // Apply Time Filters to globallyFilteredData
      if (year) {
        const yearNum = parseInt(year, 10);
        globallyFilteredData = globallyFilteredData.filter(item => item.yr === yearNum);
      }

      if (month) {
        const monthNum = parseInt(month, 10);
        globallyFilteredData = globallyFilteredData.filter(item => item.mn === monthNum);
      }

      if (dateFrom || dateTo) {
        const fromTime = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
        const toTime = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Infinity;
        
        globallyFilteredData = globallyFilteredData.filter(item => {
          if (isNaN(item.time)) return false;
          if (item.time < fromTime) return false;
          if (item.time > toTime) return false;
          return true;
        });
      }
    }

    // 5. Calculate Metrics
    const totalAmount = globallyFilteredData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalQty = globallyFilteredData.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const totalCustomers = new Set(globallyFilteredData.map(item => item.customerId || item.customerName)).size;
    const totalProducts = new Set(globallyFilteredData.map(item => item.productId || item.product)).size;

    // Monthly Averages
    const monthsSet = new Set<string>();
    const monthlyDataMap = new Map<string, { amount: number; qty: number }>();
    globallyFilteredData.forEach(item => {
      if (!isNaN(item.time)) {
        const mKey = `${item.yr}-${String(item.mn).padStart(2, '0')}`;
        monthsSet.add(mKey);
        const ex = monthlyDataMap.get(mKey) || { amount: 0, qty: 0 };
        ex.amount += Number(item.amount) || 0;
        ex.qty += Number(item.qty) || 0;
        monthlyDataMap.set(mKey, ex);
      }
    });
    const totalMonthsCount = monthsSet.size || 1;
    const totalMonthlyAmount = Array.from(monthlyDataMap.values()).reduce((sum, m) => sum + m.amount, 0);
    const totalMonthlyQty = Array.from(monthlyDataMap.values()).reduce((sum, m) => sum + m.qty, 0);

    const metrics = {
      totalAmount,
      totalQty,
      totalCustomers,
      totalProducts,
      avgMonthlyAmount: totalMonthlyAmount / totalMonthsCount,
      avgMonthlyQty: totalMonthlyQty / totalMonthsCount,
    };

    // 6. Calculate Chart Data (Using geographyFilteredData so it ignores time filters)
    const monthMapChart = new Map<string, { amount: number; qty: number }>();
    geographyFilteredData.forEach(item => {
      if (isNaN(item.time)) return;
      const key = `${item.yr}-${String(item.mn).padStart(2, '0')}`;
      const ex = monthMapChart.get(key) || { amount: 0, qty: 0 };
      ex.amount += Number(item.amount) || 0;
      ex.qty += Number(item.qty) || 0;
      monthMapChart.set(key, ex);
    });

    let targetYear = filters?.year ? parseInt(filters.year, 10) : null;
    if (!targetYear) {
      const allKeys = Array.from(monthMapChart.keys()).sort();
      targetYear = allKeys.length > 0 ? parseInt(allKeys[allKeys.length - 1].split('-')[0], 10) : new Date().getFullYear();
    }
    const prevYear = targetYear - 1;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    const chartData = [];

    for (let m = 1; m <= 12; m++) {
      const currKey = `${targetYear}-${String(m).padStart(2, '0')}`;
      const prevKey = `${prevYear}-${String(m).padStart(2, '0')}`;
      const currData = monthMapChart.get(currKey) || { amount: 0, qty: 0 };
      const prevData = monthMapChart.get(prevKey) || { amount: 0, qty: 0 };
      const diff = currData.amount - prevData.amount;
      const percent = prevData.amount !== 0 ? (diff / Math.abs(prevData.amount)) * 100 : (currData.amount !== 0 ? 100 : 0);
      const isFuture = (targetYear > nowYear) || (targetYear === nowYear && m > nowMonth);

      chartData.push({
        month: monthNames[m - 1],
        year: String(targetYear).slice(-2),
        prevYear: String(prevYear).slice(-2),
        currentAmount: currData.amount,
        prevAmount: prevData.amount,
        diff,
        percent,
        isPositive: diff >= 0,
        isFuture,
        legendCurr: String(targetYear),
        legendPrev: String(prevYear)
      });
    }

    // 7. Calculate Yearly Table
    const yearMap = new Map<string, any>();
    globallyFilteredData.forEach(item => {
      if (isNaN(item.time)) return;
      const yr = item.yr.toString();
      const ex = yearMap.get(yr) || { year: yr, amount: 0, qty: 0, customerCount: new Set(), invoiceNumbers: new Set(), grvNumbers: new Set(), grossSales: 0, grvAmount: 0 };
      const amt = Number(item.amount) || 0;
      ex.amount += amt;
      ex.qty += Number(item.qty) || 0;
      ex.customerCount.add(item.customerId || item.customerName);
      const invId = item.invoiceNumber || `missing-${Math.random()}`;
      if (amt > 0) { ex.grossSales += amt; ex.invoiceNumbers.add(invId); }
      else if (amt < 0) { ex.grvAmount += Math.abs(amt); ex.grvNumbers.add(invId); }
      yearMap.set(yr, ex);
    });
    const sortedYears = Array.from(yearMap.values()).sort((a, b) => b.year.localeCompare(a.year));
    const yearlyTableData = sortedYears.map((item, index) => {
      const prev = index < sortedYears.length - 1 ? sortedYears[index + 1] : null;
      return {
        year: item.year,
        amount: item.amount,
        amountDiff: prev ? item.amount - prev.amount : 0,
        qty: item.qty,
        customerCount: item.customerCount.size,
        grossSales: item.grossSales,
        salesCount: item.invoiceNumbers.size,
        grvAmount: item.grvAmount,
        grvCount: item.grvNumbers.size,
      };
    });

    // 8. Calculate Monthly Table
    const monthMapTable = new Map<string, any>();
    globallyFilteredData.forEach(item => {
      if (isNaN(item.time)) return;
      const yr = item.yr;
      const mn = item.mn - 1; // 0-indexed for array
      const mKey = `${yr}-${String(mn + 1).padStart(2, '0')}`;
      const mLabel = `${monthNames[mn]} ${String(yr).slice(-2)}`;

      const ex = monthMapTable.get(mKey) || { month: mLabel, monthKey: mKey, amount: 0, qty: 0, customerCount: new Set(), invoiceNumbers: new Set(), grvNumbers: new Set(), grossSales: 0, grvAmount: 0 };
      const amt = Number(item.amount) || 0;
      ex.amount += amt;
      ex.qty += Number(item.qty) || 0;
      ex.customerCount.add(item.customerId || item.customerName);
      const invId = item.invoiceNumber || `missing-${Math.random()}`;
      if (amt > 0) { ex.grossSales += amt; ex.invoiceNumbers.add(invId); }
      else if (amt < 0) { ex.grvAmount += Math.abs(amt); ex.grvNumbers.add(invId); }
      monthMapTable.set(mKey, ex);
    });
    
    const sortedMonths = Array.from(monthMapTable.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    const monthlyTableData = sortedMonths.map((item, index) => {
      const prev = index < sortedMonths.length - 1 ? sortedMonths[index + 1] : null;
      return {
        month: item.month,
        monthKey: item.monthKey,
        amount: item.amount,
        qty: item.qty,
        grossSales: item.grossSales,
        grvAmount: item.grvAmount,
        customerCount: item.customerCount.size,
        salesCount: item.invoiceNumbers.size,
        grvCount: item.grvNumbers.size,
        amountDiff: prev ? item.amount - prev.amount : 0,
      };
    });

    // Return the incredibly small JSON
    return NextResponse.json({
      metrics,
      chartData,
      yearlyTableData,
      monthlyTableData
    });

  } catch (error: any) {
    console.error('API Error Overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overview data', details: error.message || error },
      { status: 500 }
    );
  }
}
