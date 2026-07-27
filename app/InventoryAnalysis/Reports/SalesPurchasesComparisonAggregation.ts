import { buildNetPurchasesPivot } from './NetPurchasesAggregation';
import {
  buildNetSalesPivot,
  type NetSalesProductRow,
  type PeriodColumn,
} from './NetSalesAggregation';
import { ReportFilters } from './ReportFilters';

export type ComparisonProductRow = {
  productId: string;
  barcode: string;
  productName: string;
  salesValues: Record<string, number>;
  purchasesValues: Record<string, number>;
};

export type ComparisonPivot = {
  products: ComparisonProductRow[];
  periodColumns: PeriodColumn[];
};

type PeriodValuesKey = 'monthlyValues' | 'quarterlyValues';

function mergeComparisonProducts(
  salesProducts: NetSalesProductRow[],
  purchasesProducts: NetSalesProductRow[],
  valuesKey: PeriodValuesKey,
): ComparisonProductRow[] {
  const purchasesById = new Map(purchasesProducts.map((p) => [p.productId, p]));
  const seen = new Set<string>();

  const merged: ComparisonProductRow[] = salesProducts.map((sales) => {
    seen.add(sales.productId);
    const purchases = purchasesById.get(sales.productId);
    return {
      productId: sales.productId,
      barcode: sales.barcode,
      productName: sales.productName,
      salesValues: sales[valuesKey],
      purchasesValues: purchases?.[valuesKey] ?? {},
    };
  });

  purchasesProducts.forEach((purchases) => {
    if (seen.has(purchases.productId)) return;
    merged.push({
      productId: purchases.productId,
      barcode: purchases.barcode,
      productName: purchases.productName,
      salesValues: {},
      purchasesValues: purchases[valuesKey],
    });
  });

  return merged.sort((a, b) => a.productName.localeCompare(b.productName));
}

export async function buildSalesPurchasesComparisonPivot(
  filters: ReportFilters,
  mode: 'monthly' | 'quarterly',
): Promise<ComparisonPivot | null> {
  if (!filters.fromDate || !filters.toDate) return null;

  const [salesPivot, purchasesPivot] = await Promise.all([
    buildNetSalesPivot(filters),
    buildNetPurchasesPivot(filters),
  ]);

  if (!salesPivot || !purchasesPivot) return null;

  const periodColumns =
    mode === 'monthly' ? salesPivot.monthColumns : salesPivot.quarterColumns;
  const valuesKey: PeriodValuesKey =
    mode === 'monthly' ? 'monthlyValues' : 'quarterlyValues';

  const products = mergeComparisonProducts(
    salesPivot.products,
    purchasesPivot.products,
    valuesKey,
  );

  return { products, periodColumns };
}
