function sumTargetsForMonth(
  targetMap: Map<string, number>,
  year: number,
  month: number,
  userIds?: string[] | null,
  targetType: string = 'sales_rep'
): number {
  let sum = 0;
  if (!userIds || userIds.length === 0) {
    for (const [key, val] of targetMap.entries()) {
      const parts = key.split('|');
      if (parts.length === 4) {
        if (Number(parts[1]) === year && Number(parts[2]) === month && parts[3] === targetType) {
          sum += val;
        }
      }
    }
    return sum;
  }
  for (const uid of userIds) {
    const key = `${uid}|${year}|${month}|${targetType}`;
    sum += targetMap.get(key) || 0;
  }
  return sum;
}
export function buildOverviewFromFilteredData(augmentedData: any[], filters: any, targetMap: Map<string, number> = new Map(), targetUserIds: string[] | null = null) {
  const augmentedWithDates = augmentedData.map((item) => {
    let parsedDate = null;
    let time = NaN;
    let yr = NaN;
    let mn = NaN;
    if (item.invoiceDate) {
      parsedDate = new Date(item.invoiceDate);
      time = parsedDate.getTime();
      if (!isNaN(time)) {
        yr = parsedDate.getFullYear();
        mn = parsedDate.getMonth() + 1;
      }
    }
    return { ...item, parsedDate, time, yr, mn };
  });

  let globallyFilteredData = augmentedWithDates;
  let geographyFilteredData = augmentedWithDates;

  if (filters) {
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag, product, customerMainName, customerSubName, customerTag, customerClass } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter((item) => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }

    geographyFilteredData = [...globallyFilteredData];

    if (productTag) geographyFilteredData = geographyFilteredData.filter((i) => i.productTag === productTag);
    if (product) geographyFilteredData = geographyFilteredData.filter((i) => i.product === product);
    if (customerMainName) {
      geographyFilteredData = geographyFilteredData.filter((i) => i.customerMainName === customerMainName);
    }
    if (customerSubName) {
      geographyFilteredData = geographyFilteredData.filter((i) => i.customerName === customerSubName);
    }
    if (customerTag) geographyFilteredData = geographyFilteredData.filter(i => i.customerTag === customerTag);
    if (customerClass) geographyFilteredData = geographyFilteredData.filter(i => i.customerClass === customerClass);
    if (area) geographyFilteredData = geographyFilteredData.filter((i) => i.area === area);
    if (market) geographyFilteredData = geographyFilteredData.filter((i) => i.market === market);
    if (merchandiser) geographyFilteredData = geographyFilteredData.filter((i) => i.merchandiser === merchandiser);
    if (salesRep) geographyFilteredData = geographyFilteredData.filter((i) => i.salesRep === salesRep);

    globallyFilteredData = [...geographyFilteredData];

    if (year) {
      const yearNum = parseInt(year, 10);
      globallyFilteredData = globallyFilteredData.filter((item) => item.yr === yearNum);
    }
    if (month) {
      const monthNum = parseInt(month, 10);
      globallyFilteredData = globallyFilteredData.filter((item) => item.mn === monthNum);
    }
    if (dateFrom || dateTo) {
      const fromTime = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const toTime = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Infinity;

      globallyFilteredData = globallyFilteredData.filter((item) => {
        if (isNaN(item.time)) return false;
        if (item.time < fromTime) return false;
        if (item.time > toTime) return false;
        return true;
      });
    }
  }

  const totalAmount = globallyFilteredData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalQty = globallyFilteredData.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const totalCustomers = new Set(globallyFilteredData.map((item) => item.customerId || item.customerName)).size;
  const totalProducts = new Set(globallyFilteredData.map((item) => item.productId || item.product)).size;

  const monthsSet = new Set<string>();
  const monthlyDataMap = new Map<string, { amount: number; qty: number }>();
  globallyFilteredData.forEach((item) => {
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

  let totalGrossSales = 0;
  let totalReturnsAmount = 0;
  const uniqueSalesInvoices = new Set();
  const uniqueReturnsInvoices = new Set();
  globallyFilteredData.forEach((item) => {
    const amt = Number(item.amount) || 0;
    const invId = item.invoiceNumber || ('missing-' + Math.random());
    if (amt > 0) { totalGrossSales += amt; uniqueSalesInvoices.add(invId); }
    else if (amt < 0) { totalReturnsAmount += Math.abs(amt); uniqueReturnsInvoices.add(invId); }
  });
  const salesCount = uniqueSalesInvoices.size;
  const returnsCount = uniqueReturnsInvoices.size;
  const avgInvoiceValue = salesCount > 0 ? totalGrossSales / salesCount : 0;
  const avgReturnValue = returnsCount > 0 ? totalReturnsAmount / returnsCount : 0;

  const metrics = {
    totalAmount,
    totalQty,
    totalCustomers,
    totalProducts,
    avgMonthlyAmount: totalMonthlyAmount / totalMonthsCount,
    avgMonthlyQty: totalMonthlyQty / totalMonthsCount,
    salesCount,
    avgInvoiceValue,
    returnsCount,
    avgReturnValue,
  };

  const monthMapChart = new Map<string, { amount: number; qty: number }>();
  geographyFilteredData.forEach((item) => {
    if (isNaN(item.time)) return;
    const key = `${item.yr}-${String(item.mn).padStart(2, '0')}`;
    const ex = monthMapChart.get(key) || { amount: 0, qty: 0 };
    ex.amount += Number(item.amount) || 0;
    ex.qty += Number(item.qty) || 0;
    monthMapChart.set(key, ex);
  });

  // Monthly invoice/return count map for invoice count chart
  const monthInvoiceMap = new Map();
  geographyFilteredData.forEach((item) => {
    if (isNaN(item.time)) return;
    const key = `${item.yr}-${String(item.mn).padStart(2, '0')}`;
    const ex = monthInvoiceMap.get(key) || { salesInvoices: new Set(), grossSales: 0, returnInvoices: new Set(), returnsAmt: 0 };
    const amt = Number(item.amount) || 0;
    const invId = item.invoiceNumber || ('missing-' + Math.random());
    if (amt > 0) { ex.salesInvoices.add(invId); ex.grossSales += amt; }
    else if (amt < 0) { ex.returnInvoices.add(invId); ex.returnsAmt += Math.abs(amt); }
    monthInvoiceMap.set(key, ex);
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
  
  const chartDataVsLastYear = [];
  const chartDataVsLastMonth = [];
  const chartDataVsTarget = [];

  for (let m = 1; m <= 12; m++) {
    const currKey = `${targetYear}-${String(m).padStart(2, '0')}`;
    const currData = monthMapChart.get(currKey) || { amount: 0, qty: 0 };
    
    // Last Year
    const prevYearKey = `${prevYear}-${String(m).padStart(2, '0')}`;
    const prevYearData = monthMapChart.get(prevYearKey) || { amount: 0, qty: 0 };
    const diffYear = currData.amount - prevYearData.amount;
    const percentYear = prevYearData.amount !== 0 ? (diffYear / Math.abs(prevYearData.amount)) * 100 : (currData.amount !== 0 ? 100 : 0);
    
    // Last Month
    let prevMonthM = m - 1;
    let prevMonthY = targetYear;
    if (prevMonthM === 0) {
      prevMonthM = 12;
      prevMonthY = targetYear - 1;
    }
    const prevMonthKey = `${prevMonthY}-${String(prevMonthM).padStart(2, '0')}`;
    const prevMonthData = monthMapChart.get(prevMonthKey) || { amount: 0, qty: 0 };
    const diffMonth = currData.amount - prevMonthData.amount;
    const percentMonth = prevMonthData.amount !== 0 ? (diffMonth / Math.abs(prevMonthData.amount)) * 100 : (currData.amount !== 0 ? 100 : 0);

    // Target
    const targetAmount = sumTargetsForMonth(targetMap, targetYear, m, targetUserIds);
    const diffTarget = currData.amount - targetAmount;
    const percentTarget = targetAmount !== 0 ? (diffTarget / Math.abs(targetAmount)) * 100 : (currData.amount !== 0 ? 100 : 0);

    const isFuture = (targetYear > nowYear) || (targetYear === nowYear && m > nowMonth);

    const baseObj = {
      month: monthNames[m - 1],
      year: String(targetYear).slice(-2),
      currentAmount: currData.amount,
      isFuture,
      legendCurr: String(targetYear),
    };

    chartDataVsLastYear.push({
      ...baseObj,
      prevAmount: prevYearData.amount,
      diff: diffYear,
      percent: percentYear,
      isPositive: diffYear >= 0,
      legendPrev: String(prevYear),
    });

    chartDataVsLastMonth.push({
      ...baseObj,
      prevAmount: prevMonthData.amount,
      diff: diffMonth,
      percent: percentMonth,
      isPositive: diffMonth >= 0,
      legendPrev: monthNames[prevMonthM - 1],
    });

    chartDataVsTarget.push({
      ...baseObj,
      prevAmount: targetAmount,
      diff: diffTarget,
      percent: percentTarget,
      isPositive: diffTarget >= 0,
      legendPrev: 'Target',
    });
  }

  // Invoice count charts
  const chartDataInvoices = [];
  const chartDataReturns = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${targetYear}-${String(m).padStart(2, '0')}`;
    const prevKey = `${prevYear}-${String(m).padStart(2, '0')}`;
    const inv = monthInvoiceMap.get(key) || { salesInvoices: new Set(), grossSales: 0, returnInvoices: new Set(), returnsAmt: 0 };
    const invPrev = monthInvoiceMap.get(prevKey) || { salesInvoices: new Set(), grossSales: 0, returnInvoices: new Set(), returnsAmt: 0 };
    const sc = inv.salesInvoices.size;
    const rc = inv.returnInvoices.size;
    const scPrev = invPrev.salesInvoices.size;
    const rcPrev = invPrev.returnInvoices.size;
    const avgInv = sc > 0 ? inv.grossSales / sc : 0;
    const avgRet = rc > 0 ? inv.returnsAmt / rc : 0;
    const avgInvPrev = scPrev > 0 ? invPrev.grossSales / scPrev : 0;
    const avgRetPrev = rcPrev > 0 ? invPrev.returnsAmt / rcPrev : 0;
    const isFut = (targetYear > nowYear) || (targetYear === nowYear && m > nowMonth);
    chartDataInvoices.push({ month: monthNames[m - 1], count: sc, avgValue: avgInv, prevCount: scPrev, prevAvgValue: avgInvPrev, isFuture: isFut, legendCurr: String(targetYear), legendPrev: String(prevYear) });
    chartDataReturns.push({ month: monthNames[m - 1], count: rc, avgValue: avgRet, prevCount: rcPrev, prevAvgValue: avgRetPrev, isFuture: isFut, legendCurr: String(targetYear), legendPrev: String(prevYear) });
  }

const yearMap = new Map<string, any>();
  globallyFilteredData.forEach((item) => {
    if (isNaN(item.time)) return;
    const yr = item.yr.toString();
    const ex = yearMap.get(yr) || {
      year: yr,
      amount: 0,
      qty: 0,
      customerCount: new Set(),
      invoiceNumbers: new Set(),
      grvNumbers: new Set(),
      grossSales: 0,
      grvAmount: 0,
    };
    const amt = Number(item.amount) || 0;
    ex.amount += amt;
    ex.qty += Number(item.qty) || 0;
    ex.customerCount.add(item.customerId || item.customerName);
    const invId = item.invoiceNumber || `missing-${Math.random()}`;
    if (amt > 0) {
      ex.grossSales += amt;
      ex.invoiceNumbers.add(invId);
    } else if (amt < 0) {
      ex.grvAmount += Math.abs(amt);
      ex.grvNumbers.add(invId);
    }
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

  const monthMapTable = new Map<string, any>();
  globallyFilteredData.forEach((item) => {
    if (isNaN(item.time)) return;
    const yr = item.yr;
    const mn = item.mn - 1;
    const mKey = `${yr}-${String(mn + 1).padStart(2, '0')}`;
    const mLabel = `${monthNames[mn]} ${String(yr).slice(-2)}`;

    const ex = monthMapTable.get(mKey) || {
      month: mLabel,
      monthKey: mKey,
      amount: 0,
      qty: 0,
      customerCount: new Set(),
      invoiceNumbers: new Set(),
      grvNumbers: new Set(),
      grossSales: 0,
      grvAmount: 0,
    };
    const amt = Number(item.amount) || 0;
    ex.amount += amt;
    ex.qty += Number(item.qty) || 0;
    ex.customerCount.add(item.customerId || item.customerName);
    const invId = item.invoiceNumber || `missing-${Math.random()}`;
    if (amt > 0) {
      ex.grossSales += amt;
      ex.invoiceNumbers.add(invId);
    } else if (amt < 0) {
      ex.grvAmount += Math.abs(amt);
      ex.grvNumbers.add(invId);
    }
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

  return { metrics, chartDataVsLastYear, chartDataVsLastMonth, chartDataVsTarget, chartDataInvoices, chartDataReturns, yearlyTableData, monthlyTableData };
}
