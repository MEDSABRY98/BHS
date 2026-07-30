import { Product, PurchaseRecord } from '../page';

export type ReportFilters = {
  supplierId?: string;
  productId?: string;
  category?: string;
  fromDate?: string;
  toDate?: string;
};

export function filterPurchases(
  purchases: PurchaseRecord[],
  filters: ReportFilters,
  products?: Product[],
): PurchaseRecord[] {
  let result = [...purchases];

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
  if (filters.fromDate) {
    result = result.filter(p => new Date(p.date) >= new Date(filters.fromDate!));
  }
  if (filters.toDate) {
    result = result.filter(p => new Date(p.date) <= new Date(filters.toDate!));
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
  if (filters.fromDate || filters.toDate) parts.push('Dated');
  return parts.length ? `_${parts.join('_')}` : '_All';
}
