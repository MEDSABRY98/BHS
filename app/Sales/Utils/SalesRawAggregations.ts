const formatDate = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
};

const calculateMode = (numbers: number[]): number => {
  if (!numbers || numbers.length === 0) return 0;
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let mode = numbers[0];
  for (const n of numbers) {
    const val = parseFloat(n.toFixed(2));
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount) {
      maxCount = counts[val];
      mode = val;
    }
  }
  return mode;
};

export function buildDailySalesFromRaw(globallyFilteredData: any[], invoiceTypeFilter: string) {
  const invoiceMap = new Map<string, any>();
  globallyFilteredData.forEach((item: any) => {
    if (!item.invoiceNumber) return;

    const existing = invoiceMap.get(item.invoiceNumber) || {
      invoiceDate: item.invoiceDate || '',
      invoiceNumber: item.invoiceNumber,
      customerName: item.customerName || '',
      customerMainName: item.customerMainName || '',
      area: item.area || '',
      market: item.market || '',
      merchandiser: item.merchandiser || '',
      salesRep: item.salesRep || '',
      amount: 0,
      qty: 0,
      products: new Set<string>(),
      searchTerms: new Set<string>(),
      totalCost: 0,
      totalPrice: 0,
      costCount: 0,
      priceCount: 0,
      items: []
    };

    existing.items.push(item);
    existing.amount += Number(item.amount) || 0;
    existing.qty += Number(item.qty) || 0;

    if (item.product) existing.searchTerms.add(item.product.toLowerCase());
    if (item.barcode) existing.searchTerms.add(item.barcode.toLowerCase());
    if (item.productId) existing.searchTerms.add(item.productId.toLowerCase());

    const productKey = item.productId || item.barcode || item.product;
    if (productKey) existing.products.add(productKey);

    if (item.productCost) {
      existing.totalCost += Number(item.productCost);
      existing.costCount += 1;
    }
    if (item.productPrice) {
      existing.totalPrice += Number(item.productPrice);
      existing.priceCount += 1;
    }

    invoiceMap.set(item.invoiceNumber, existing);
  });

  const allInvoices = Array.from(invoiceMap.values()).map(invoice => {
    const avgCost = invoice.costCount > 0 ? invoice.totalCost / invoice.costCount : 0;
    const avgPrice = invoice.priceCount > 0 ? invoice.totalPrice / invoice.priceCount : 0;

    return {
      ...invoice,
      productsCount: invoice.products.size,
      searchTerms: Array.from(invoice.searchTerms),
      avgCost,
      avgPrice,
      products: undefined,
    };
  }).sort((a, b) => {
    const dateA = new Date(a.invoiceDate).getTime();
    const dateB = new Date(b.invoiceDate).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return b.invoiceNumber.localeCompare(a.invoiceNumber);
  });

  let filteredInvoices = allInvoices;
  if (invoiceTypeFilter && invoiceTypeFilter !== 'all') {
    filteredInvoices = allInvoices.filter(inv => {
      const num = inv.invoiceNumber.trim().toUpperCase();
      if (invoiceTypeFilter === 'sales') return num.startsWith('SAL');
      if (invoiceTypeFilter === 'returns') return num.startsWith('RSAL');
      return true;
    });
  }

  const dateMap = new Map<string, any>();
  globallyFilteredData.forEach((item: any) => {
    if (!item.invoiceDate) return;
    const dateKey = formatDate(item.invoiceDate);
    if (!dateKey) return;

    const existing = dateMap.get(dateKey) || {
      date: dateKey,
      amount: 0,
      qty: 0,
      invoiceNumbers: new Set<string>(),
      products: new Set<string>(),
      customers: new Set<string>(),
      salInvoiceNumbers: new Set<string>(),
      salProducts: new Set<string>(),
      salCustomers: new Set<string>()
    };

    existing.amount += Number(item.amount) || 0;
    existing.qty += Number(item.qty) || 0;

    if (item.invoiceNumber) {
      existing.invoiceNumbers.add(item.invoiceNumber);
      if (item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.salInvoiceNumbers.add(item.invoiceNumber);
        const pKey = item.productId || item.barcode || item.product;
        if (pKey) existing.salProducts.add(pKey);
        const cKey = item.customerId || item.customerName;
        if (cKey) existing.salCustomers.add(cKey);
      }
    }

    const pKey = item.productId || item.barcode || item.product;
    if (pKey) existing.products.add(pKey);
    const cKey = item.customerId || item.customerName;
    if (cKey) existing.customers.add(cKey);

    dateMap.set(dateKey, existing);
  });

  const salesByDayData = Array.from(dateMap.values()).map(item => ({
    date: item.date,
    amount: item.amount,
    qty: item.qty,
    invoicesCount: item.invoiceNumbers.size,
    productsCount: item.products.size,
    customersCount: item.customers.size,
    salInvoicesCount: item.salInvoiceNumbers.size,
    salProductsCount: item.salProducts.size,
    salCustomersCount: item.salCustomers.size
  })).sort((a, b) => {
    const dateA = new Date(a.date.split('/').reverse().join('-')).getTime();
    const dateB = new Date(b.date.split('/').reverse().join('-')).getTime();
    return dateB - dateA;
  });

  const monthMap = new Map<string, any>();
  salesByDayData.forEach((item: any) => {
    if (!item.date) return;
    const [day, month, year] = item.date.split('/');
    if (!day || !month || !year) return;

    const monthKey = `${year}-${month.padStart(2, '0')}`;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(month, 10) - 1] || month;
    const monthYear = `${monthName.toUpperCase()} ${year}`;

    const existing = monthMap.get(monthKey) || {
      monthKey,
      monthYear,
      totalAmount: 0,
      totalQty: 0,
      totalInvoices: 0,
      totalCustomers: 0,
      totalProducts: 0,
      daysCount: 0
    };

    existing.totalAmount += item.amount;
    existing.totalQty += item.qty;
    existing.totalInvoices += item.salInvoicesCount;
    existing.totalCustomers += item.salCustomersCount;
    existing.totalProducts += item.salProductsCount;
    existing.daysCount += 1;

    monthMap.set(monthKey, existing);
  });

  const avgSalesByDayData = Array.from(monthMap.values()).map(item => ({
    monthKey: item.monthKey,
    monthYear: item.monthYear,
    avgAmount: item.daysCount > 0 ? item.totalAmount / item.daysCount : 0,
    avgQty: item.daysCount > 0 ? item.totalQty / item.daysCount : 0,
    avgInvoices: item.daysCount > 0 ? item.totalInvoices / item.daysCount : 0,
    avgCustomers: item.daysCount > 0 ? item.totalCustomers / item.daysCount : 0,
    avgProducts: item.daysCount > 0 ? item.totalProducts / item.daysCount : 0
  })).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  return { dailySalesData: filteredInvoices, salesByDayData, avgSalesByDayData };
}

function calculateStatsForDimension(data: any[], dimensionKey: string) {
  const dimensionMap = new Map<string, { amount: number; qty: number; count: number }>();
  const dimensionCustomersMap = new Map<string, Set<string>>();
  const dimensionMonthsMap = new Map<string, Set<string>>();
  const monthlyData = new Map<string, Map<string, { amount: number; qty: number }>>();

  data.forEach((item: any) => {
    const dimValue = item[dimensionKey];
    if (!dimValue) return;

    const existing = dimensionMap.get(dimValue) || { amount: 0, qty: 0, count: 0 };
    dimensionMap.set(dimValue, {
      amount: existing.amount + (Number(item.amount) || 0),
      qty: existing.qty + (Number(item.qty) || 0),
      count: existing.count + 1
    });

    const customerKey = item.customerId || item.customerName;
    if (customerKey) {
      if (!dimensionCustomersMap.has(dimValue)) {
        dimensionCustomersMap.set(dimValue, new Set());
      }
      dimensionCustomersMap.get(dimValue)!.add(String(customerKey));
    }

    if (!item.invoiceDate) return;
    const date = new Date(item.invoiceDate);
    if (isNaN(date.getTime())) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!dimensionMonthsMap.has(dimValue)) {
      dimensionMonthsMap.set(dimValue, new Set());
    }
    dimensionMonthsMap.get(dimValue)!.add(monthKey);

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
      customerCount: dimensionCustomersMap.get(dim)?.size || 0,
      averageMonthly: averageMonthly,
      averageMonthlyGrowth: averageMonthlyGrowth,
      percentageOfTotal: totalAmountAll > 0 ? (values.amount / totalAmountAll) * 100 : 0
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount);

  const serializedMonthlyData: Record<string, any> = {};
  for (const [dim, monthsMap] of monthlyData.entries()) {
    serializedMonthlyData[dim] = Object.fromEntries(monthsMap);
  }

  return { stats, monthlyData: serializedMonthlyData };
}

export function buildStatisticsFromRaw(globallyFilteredData: any[]) {
  return {
    areaStats: calculateStatsForDimension(globallyFilteredData, 'area'),
    marketStats: calculateStatsForDimension(globallyFilteredData, 'market'),
    merchandiserStats: calculateStatsForDimension(globallyFilteredData, 'merchandiser'),
    salesRepStats: calculateStatsForDimension(globallyFilteredData, 'salesRep'),
  };
}

export function buildStockReportFromRaw(globallyFilteredData: any[]) {
  const sortedData = [...(globallyFilteredData || [])].sort((a, b) => {
    const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
    const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
    return dateB - dateA;
  });

  const customerMap = new Map<string, {
    customerId: string;
    latestName: string;
    allNames: Set<string>;
    products: Map<string, {
      barcode: string;
      product: string;
      prices: number[];
      cost: number;
      allNames: Set<string>;
      allBarcodes: Set<string>;
    }>;
  }>();

  const subCustomerMap = new Map<string, {
    customerId: string;
    latestName: string;
    allNames: Set<string>;
    products: Map<string, {
      barcode: string;
      product: string;
      prices: number[];
      cost: number;
      allNames: Set<string>;
      allBarcodes: Set<string>;
    }>;
  }>();

  const upsertCustomerProduct = (
    map: Map<string, any>,
    key: string,
    init: { customerId: string; latestName: string },
    item: any,
    pNum: number,
    productKey: string
  ) => {
    if (!map.has(key)) {
      map.set(key, {
        customerId: init.customerId,
        latestName: init.latestName,
        allNames: new Set<string>(),
        products: new Map(),
      });
    }
    const entry = map.get(key)!;
    if (item.customerMainName) entry.allNames.add(item.customerMainName.toLowerCase());
    if (item.customerName) entry.allNames.add(item.customerName.toLowerCase());

    if (!entry.products.has(productKey)) {
      entry.products.set(productKey, {
        barcode: item.barcode || '-',
        product: item.product || '-',
        prices: [],
        cost: item.productCost || 0,
        allNames: new Set<string>(),
        allBarcodes: new Set<string>(),
      });
    }
    const prodInCust = entry.products.get(productKey)!;
    if (item.product) prodInCust.allNames.add(item.product.toLowerCase());
    if (item.barcode) prodInCust.allBarcodes.add(item.barcode.toLowerCase());
    if (!isNaN(pNum) && pNum > 0) prodInCust.prices.push(pNum);
    if (item.productCost > 0) prodInCust.cost = Math.max(prodInCust.cost, item.productCost);
  };

  const finalizeCustomerEntries = (entries: Iterable<any>) =>
    Array.from(entries).map((entry: any) => ({
      customerId: entry.customerId,
      customer: entry.latestName,
      allNames: Array.from(entry.allNames),
      products: Array.from(entry.products.values()).map((p: any) => ({
        barcode: p.barcode,
        product: p.product,
        cost: p.cost,
        mostPrice: calculateMode(p.prices),
        lastPrice: p.prices[0] || 0,
        allNames: Array.from(p.allNames),
        allBarcodes: Array.from(p.allBarcodes),
      })).sort((a: any, b: any) => a.product.localeCompare(b.product)),
    })).sort((a, b) => a.customer.localeCompare(b.customer));

  const productMap = new Map<string, {
    productId: string;
    barcode: string;
    product: string;
    priceRange: { min: number, max: number };
    customers: Map<string, { prices: number[]; cost: number }>;
    allNames: Set<string>;
    allBarcodes: Set<string>;
  }>();

  sortedData.forEach(item => {
    const itemAny = item as any;
    let price = itemAny.productPrice || 0;
    if (!price && itemAny.amount && itemAny.qty) price = itemAny.amount / itemAny.qty;
    const pNum = parseFloat(price);

    const mainName = (item.customerMainName || item.customerName || 'Unknown').trim();
    const mainKey = mainName.toLowerCase();
    const subName = (item.customerName || '').trim() || item.customerMainName || 'Unknown';
    const subKey = item.customerId ? `${item.customerId}::${subName}` : subName;
    const productKey = item.productId || item.barcode || item.product || 'Unknown';

    upsertCustomerProduct(
      customerMap,
      mainKey,
      { customerId: item.customerId || '', latestName: mainName },
      item,
      pNum,
      productKey
    );

    upsertCustomerProduct(
      subCustomerMap,
      subKey,
      { customerId: item.customerId || '', latestName: subName },
      item,
      pNum,
      productKey
    );

    if (!productMap.has(productKey)) {
      productMap.set(productKey, {
        productId: item.productId || '',
        barcode: item.barcode || '-',
        product: item.product || '-',
        priceRange: { min: Infinity, max: -Infinity },
        customers: new Map(),
        allNames: new Set(),
        allBarcodes: new Set()
      });
    }
    const prodEntry = productMap.get(productKey)!;
    if (item.product) prodEntry.allNames.add(item.product.toLowerCase());
    if (item.barcode) prodEntry.allBarcodes.add(item.barcode.toLowerCase());

    if (!prodEntry.customers.has(mainName)) {
      prodEntry.customers.set(mainName, { prices: [], cost: item.productCost || 0 });
    }
    const custInProd = prodEntry.customers.get(mainName)!;
    if (!isNaN(pNum) && pNum > 0) {
      custInProd.prices.push(pNum);
      prodEntry.priceRange.min = Math.min(prodEntry.priceRange.min, pNum);
      prodEntry.priceRange.max = Math.max(prodEntry.priceRange.max, pNum);
    }
    if (item.productCost > 0) custInProd.cost = Math.max(custInProd.cost, item.productCost);
  });

  const customersData = finalizeCustomerEntries(customerMap.values());
  const subCustomersData = finalizeCustomerEntries(subCustomerMap.values());

  const productList = Array.from(productMap.values()).map(prod => {
    const customers = Array.from(prod.customers.entries()).map(([cName, stats]) => {
      return {
        customerName: cName,
        mostPrice: calculateMode(stats.prices),
        lastPrice: stats.prices[0] || 0,
        cost: stats.cost,
        pricesDistribution: stats.prices
      };
    });

    return {
      productId: prod.productId,
      barcode: prod.barcode,
      product: prod.product,
      priceRange: prod.priceRange,
      customers,
      allNames: Array.from(prod.allNames),
      allBarcodes: Array.from(prod.allBarcodes)
    };
  }).sort((a, b) => a.product.localeCompare(b.product));

  return { customersData, subCustomersData, productList };
}
