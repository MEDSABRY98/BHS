import {
  fetchInventoryMovesInRange,
  fetchInventoryVendorMovesInRange,
  getInventoryProductsForReports,
  getProductsBalanceReportData,
} from '../Service/inventory_service';
import type { CustomerMoveInRange, InventoryReportProduct, VendorMoveInRange } from '../Service/inventory_types';
import { ReportFilters } from './ReportFilters';

export type DeadStockStatus = 'Dead Stock' | 'Slow Mover';

export type DeadStockRow = {
  productId: string;
  barcode: string;
  productName: string;
  category: string;
  onHand: number;
  netSales: number;
  netPurchases: number;
  status: DeadStockStatus;
};

function sumNetSales(moves: CustomerMoveInRange[]): Map<string, number> {
  const totals = new Map<string, number>();
  moves.forEach((move) => {
    const delta = move.isSale ? move.qty : -move.qty;
    totals.set(move.productId, (totals.get(move.productId) || 0) + delta);
  });
  return totals;
}

function sumNetPurchases(moves: VendorMoveInRange[]): Map<string, number> {
  const totals = new Map<string, number>();
  moves.forEach((move) => {
    const delta = move.isPurchase ? move.qty : -move.qty;
    totals.set(move.productId, (totals.get(move.productId) || 0) + delta);
  });
  return totals;
}

function classifyStatus(netSales: number, netPurchases: number): DeadStockStatus {
  return netPurchases > 0 ? 'Slow Mover' : 'Dead Stock';
}

export async function buildDeadStockRows(filters: ReportFilters): Promise<DeadStockRow[] | null> {
  if (!filters.fromDate || !filters.toDate) return null;

  const [productsResult, salesResult, purchasesResult, balanceResult] = await Promise.all([
    getInventoryProductsForReports(),
    fetchInventoryMovesInRange(filters.fromDate, filters.toDate),
    fetchInventoryVendorMovesInRange(filters.fromDate, filters.toDate),
    getProductsBalanceReportData({ dateFrom: filters.fromDate, dateTo: filters.toDate }),
  ]);

  if (
    !productsResult.success ||
    !salesResult.success ||
    !purchasesResult.success ||
    !balanceResult.success
  ) {
    return null;
  }

  let products: InventoryReportProduct[] = productsResult.data;
  if (filters.category) {
    products = products.filter((p) => p.category === filters.category);
  }

  const salesByProduct = sumNetSales(salesResult.data);
  const purchasesByProduct = sumNetPurchases(purchasesResult.data);
  const onHandByProduct = new Map(
    (balanceResult.data || []).map((row) => [row.productId, row.endingStock]),
  );

  const rows: DeadStockRow[] = products
    .map((product) => {
      const netSales = salesByProduct.get(product.id) || 0;
      const netPurchases = purchasesByProduct.get(product.id) || 0;
      const onHand = onHandByProduct.get(product.id) ?? 0;

      return {
        productId: product.id,
        barcode: product.barcode,
        productName: product.name,
        category: product.category,
        onHand,
        netSales,
        netPurchases,
        status: classifyStatus(netSales, netPurchases),
      };
    })
    .filter((row) => row.netSales === 0 && row.onHand > 0)
    .sort((a, b) => {
      if (b.onHand !== a.onHand) return b.onHand - a.onHand;
      return a.productName.localeCompare(b.productName);
    });

  return rows;
}
