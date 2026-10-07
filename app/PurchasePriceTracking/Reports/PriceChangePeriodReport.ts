import { PurchaseRecord, Product } from '../page';
import { exportPurchasePriceTrackingExcel } from '../Export/ExcelExport';

export type PriceChangeDirection = 'increased' | 'decreased' | 'unchanged';

export type PriceChangePeriodOptions = {
  fromDate: string;
  toDate: string;
  direction: PriceChangeDirection;
};

type ProductPriceChangeRow = {
  productId: string;
  barcode: string;
  productName: string;
  category: string;
  previousDate: string;
  previousPrice: number;
  latestDate: string;
  latestPrice: number;
  variance: number;
  direction: PriceChangeDirection;
};

function parseDate(value: string): number {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function classifyDirection(variance: number): PriceChangeDirection {
  if (variance > 0.0005) return 'increased';
  if (variance < -0.0005) return 'decreased';
  return 'unchanged';
}

function directionLabel(direction: PriceChangeDirection): string {
  if (direction === 'increased') return 'Increased';
  if (direction === 'decreased') return 'Decreased';
  return 'Unchanged';
}

/**
 * Compare baseline price (last purchase before fromDate, else first in range)
 * against the last purchase in [fromDate, toDate].
 */
export function buildPriceChangePeriodRows(
  purchases: PurchaseRecord[],
  products: Product[],
  options: PriceChangePeriodOptions,
): ProductPriceChangeRow[] {
  const fromTs = parseDate(options.fromDate);
  const toTs = parseDate(options.toDate);
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || fromTs > toTs) {
    return [];
  }

  const byProduct = new Map<string, PurchaseRecord[]>();
  purchases.forEach((p) => {
    const list = byProduct.get(p.productId) || [];
    list.push(p);
    byProduct.set(p.productId, list);
  });

  const rows: ProductPriceChangeRow[] = [];

  byProduct.forEach((list, productId) => {
    const sorted = [...list].sort((a, b) => {
      const dateDiff = parseDate(a.date) - parseDate(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });

    const inRange = sorted.filter((p) => {
      const ts = parseDate(p.date);
      return Number.isFinite(ts) && ts >= fromTs && ts <= toTs;
    });
    if (inRange.length === 0) return;

    const beforeRange = sorted.filter((p) => {
      const ts = parseDate(p.date);
      return Number.isFinite(ts) && ts < fromTs;
    });

    const baseline = beforeRange.length > 0 ? beforeRange[beforeRange.length - 1] : inRange[0];
    const latest = inRange[inRange.length - 1];

    const previousPrice = baseline.unitPrice;
    const latestPrice = latest.unitPrice;
    const variance = latestPrice - previousPrice;

    const direction = classifyDirection(variance);
    if (direction !== options.direction) return;

    const product = products.find((p) => p.id === productId);

    rows.push({
      productId,
      barcode: product?.barcode || '-',
      productName: product?.name || productId,
      category: product?.category || '-',
      previousDate: baseline.date,
      previousPrice,
      latestDate: latest.date,
      latestPrice,
      variance,
      direction,
    });
  });

  rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  return rows;
}

export async function generatePriceChangePeriodReport(
  purchases: PurchaseRecord[],
  products: Product[],
  options: PriceChangePeriodOptions,
) {
  if (!options.fromDate || !options.toDate) {
    alert('Please select both From and To dates.');
    return;
  }

  const fromTs = parseDate(options.fromDate);
  const toTs = parseDate(options.toDate);
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) {
    alert('Invalid date range.');
    return;
  }
  if (fromTs > toTs) {
    alert('From date must be before or equal to To date.');
    return;
  }

  const rows = buildPriceChangePeriodRows(purchases, products, options);
  if (rows.length === 0) {
    alert('No products matched the selected period and price change option.');
    return;
  }

  const reportData = rows.map((row, index) => ({
    '#': index + 1,
    'Product ID': row.productId,
    Barcode: row.barcode,
    'Product Name': row.productName,
    Category: row.category,
    'Previous Date': row.previousDate,
    'Previous Price (AED)': row.previousPrice,
    'Latest Date': row.latestDate,
    'Latest Price (AED)': row.latestPrice,
    Variance: row.variance,
    Trend: directionLabel(row.direction),
  }));

  const fileName = `Price_Change_${options.direction}_${options.fromDate}_to_${options.toDate}`;

  await exportPurchasePriceTrackingExcel(reportData, fileName, {
    sheetName: 'Price Change',
    columnWidth: 20,
    numericColumns: ['Previous Price (AED)', 'Latest Price (AED)', 'Variance'],
  });
}
