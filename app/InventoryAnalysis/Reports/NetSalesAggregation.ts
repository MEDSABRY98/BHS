import {
  fetchInventoryMovesInRange,
  getInventoryProductsForReports,
} from '../Service/inventory_service';
import type { CustomerMoveInRange, InventoryReportProduct } from '../Service/inventory_types';
import { ReportFilters } from './ReportFilters';

export type PeriodColumn = {
  key: string;
  label: string;
};

export type NetSalesProductRow = {
  productId: string;
  barcode: string;
  productName: string;
  monthlyValues: Record<string, number>;
  quarterlyValues: Record<string, number>;
};

export type NetSalesPivot = {
  products: NetSalesProductRow[];
  monthColumns: PeriodColumn[];
  quarterColumns: PeriodColumn[];
};

function formatMonthLabel(year: number, month: number): string {
  const mon = new Date(year, month, 1).toLocaleString('en-US', { month: 'short' });
  const yy = year.toString().slice(-2);
  return `${mon}-${yy}`;
}

function formatQuarterLabel(year: number, quarter: number): string {
  const yy = year.toString().slice(-2);
  return `Q${quarter}-${yy}`;
}

export function buildMonthColumns(fromDate: string, toDate: string): PeriodColumn[] {
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  const columns: PeriodColumn[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const key = `${year}-${month}`;
    columns.push({ key, label: formatMonthLabel(year, month) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return columns;
}

export function buildQuarterColumns(monthColumns: PeriodColumn[]): PeriodColumn[] {
  const seen = new Set<string>();
  const columns: PeriodColumn[] = [];

  monthColumns.forEach((col) => {
    const [yearStr, monthStr] = col.key.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const quarter = Math.floor(month / 3) + 1;
    const key = `${year}-Q${quarter}`;
    if (seen.has(key)) return;
    seen.add(key);
    columns.push({ key, label: formatQuarterLabel(year, quarter) });
  });

  return columns;
}

function getMonthKeyFromDate(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

function getQuarterKeyFromMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const quarter = Math.floor(month / 3) + 1;
  return `${year}-Q${quarter}`;
}

function aggregateMoves(
  products: InventoryReportProduct[],
  moves: CustomerMoveInRange[],
  monthColumns: PeriodColumn[],
  quarterColumns: PeriodColumn[],
): NetSalesProductRow[] {
  const monthKeys = new Set(monthColumns.map((c) => c.key));
  const monthlyTotals = new Map<string, Map<string, number>>();
  const quarterlyTotals = new Map<string, Map<string, number>>();

  moves.forEach((move) => {
    const monthKey = getMonthKeyFromDate(move.date);
    if (!monthKey || !monthKeys.has(monthKey)) return;

    const netDelta = move.isSale ? move.qty : -move.qty;
    const productMonths = monthlyTotals.get(move.productId) || new Map<string, number>();
    productMonths.set(monthKey, (productMonths.get(monthKey) || 0) + netDelta);
    monthlyTotals.set(move.productId, productMonths);

    const quarterKey = getQuarterKeyFromMonthKey(monthKey);
    const productQuarters = quarterlyTotals.get(move.productId) || new Map<string, number>();
    productQuarters.set(quarterKey, (productQuarters.get(quarterKey) || 0) + netDelta);
    quarterlyTotals.set(move.productId, productQuarters);
  });

  return products
    .map((product) => {
      const monthlyValues: Record<string, number> = {};
      monthColumns.forEach((col) => {
        monthlyValues[col.key] = monthlyTotals.get(product.id)?.get(col.key) || 0;
      });

      const quarterlyValues: Record<string, number> = {};
      quarterColumns.forEach((col) => {
        quarterlyValues[col.key] = quarterlyTotals.get(product.id)?.get(col.key) || 0;
      });

      return {
        productId: product.id,
        barcode: product.barcode,
        productName: product.name,
        monthlyValues,
        quarterlyValues,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

export async function buildNetSalesPivot(filters: ReportFilters): Promise<NetSalesPivot | null> {
  if (!filters.fromDate || !filters.toDate) return null;

  const [productsResult, movesResult] = await Promise.all([
    getInventoryProductsForReports(),
    fetchInventoryMovesInRange(filters.fromDate, filters.toDate),
  ]);

  if (!productsResult.success || !movesResult.success) return null;

  let products = productsResult.data;
  if (filters.category) {
    products = products.filter((p) => p.category === filters.category);
  }

  const monthColumns = buildMonthColumns(filters.fromDate, filters.toDate);
  const quarterColumns = buildQuarterColumns(monthColumns);
  const pivotProducts = aggregateMoves(products, movesResult.data, monthColumns, quarterColumns);

  return {
    products: pivotProducts,
    monthColumns,
    quarterColumns,
  };
}
