import { Product, PurchaseRecord } from '../page';

export type ReportFilters = {
  supplierId?: string;
  productId?: string;
  category?: string;
  productSupplierCount?: number;
  fromDate?: string;
  toDate?: string;
};

export function getProductSupplierCountMap(purchases: PurchaseRecord[]): Map<string, number> {
  const suppliersByProduct = new Map<string, Set<string>>();

  purchases.forEach((purchase) => {
    if (!suppliersByProduct.has(purchase.productId)) {
      suppliersByProduct.set(purchase.productId, new Set());
    }
    suppliersByProduct.get(purchase.productId)!.add(purchase.supplierId);
  });

  const counts = new Map<string, number>();
  suppliersByProduct.forEach((supplierIds, productId) => {
    counts.set(productId, supplierIds.size);
  });

  return counts;
}

export function getAvailableProductSupplierCounts(purchases: PurchaseRecord[]): number[] {
  const counts = new Set<number>();
  getProductSupplierCountMap(purchases).forEach((count) => counts.add(count));
  return Array.from(counts).sort((a, b) => a - b);
}

export function filterPurchases(
  purchases: PurchaseRecord[],
  filters: ReportFilters,
  products?: Product[],
): PurchaseRecord[] {
  let result = [...purchases];

  if (filters.fromDate) {
    result = result.filter(p => new Date(p.date) >= new Date(filters.fromDate!));
  }
  if (filters.toDate) {
    result = result.filter(p => new Date(p.date) <= new Date(filters.toDate!));
  }
  if (filters.productSupplierCount) {
    const countMap = getProductSupplierCountMap(result);
    const allowedProductIds = new Set(
      Array.from(countMap.entries())
        .filter(([, count]) => count === filters.productSupplierCount)
        .map(([productId]) => productId),
    );
    result = result.filter(p => allowedProductIds.has(p.productId));
  }
  if (filters.supplierId) {
    result = result.filter(p => p.supplierId === filters.supplierId);
  }
  if (filters.productId) {
    result = result.filter(p => p.productId === filters.productId);
  }
  if (filters.category && products) {
    const allowedProductIds = new Set(
      filterProductsByCategory(products, filters.category).map(p => p.id),
    );
    result = result.filter(p => allowedProductIds.has(p.productId));
  }

  return result;
}

export function filterProductsByCategory(products: Product[], category?: string): Product[] {
  if (!category) return products;
  return products.filter(p => (p.category || '') === category);
}

export function filterSuffix(filters: ReportFilters): string {
  const parts: string[] = [];
  if (filters.supplierId) parts.push('Supplier');
  if (filters.productId) parts.push('Product');
  if (filters.category) parts.push('Category');
  if (filters.productSupplierCount) parts.push('SupplierCount');
  if (filters.fromDate || filters.toDate) parts.push('Dated');
  return parts.length ? `_${parts.join('_')}` : '_All';
}
