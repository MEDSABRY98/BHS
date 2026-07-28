import {
  fetchInventoryVendorMovesInRange,
  getInventoryProductsForReports,
} from '../Service/inventory_service';
import type { InventoryReportProduct, VendorMoveInRange } from '../Service/inventory_types';
import {
  buildMonthColumns,
  buildQuarterColumns,
  type NetSalesProductRow,
  type NetSalesPivot,
  type PeriodColumn,
} from './NetSalesAggregation';
import { ReportFilters } from './ReportFilters';

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
  moves: VendorMoveInRange[],
  monthColumns: PeriodColumn[],
  quarterColumns: PeriodColumn[],
): NetSalesProductRow[] {
  const monthKeys = new Set(monthColumns.map((c) => c.key));
  const monthlyTotals = new Map<string, Map<string, number>>();
  const quarterlyTotals = new Map<string, Map<string, number>>();

  moves.forEach((move) => {
    const monthKey = getMonthKeyFromDate(move.date);
    if (!monthKey || !monthKeys.has(monthKey)) return;

    const netDelta = move.isPurchase ? move.qty : -move.qty;
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

export async function buildNetPurchasesPivot(filters: ReportFilters): Promise<NetSalesPivot | null> {
  if (!filters.fromDate || !filters.toDate) return null;

  const [productsResult, movesResult] = await Promise.all([
    getInventoryProductsForReports(),
    fetchInventoryVendorMovesInRange(filters.fromDate, filters.toDate),
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
