import { PurchaseRecord } from '../page';

export type ReportFilters = {
  supplierId?: string;
  productId?: string;
  fromDate?: string;
  toDate?: string;
};

export function filterPurchases(purchases: PurchaseRecord[], filters: ReportFilters): PurchaseRecord[] {
  let result = [...purchases];

  if (filters.supplierId) {
    result = result.filter(p => p.supplierId === filters.supplierId);
  }
  if (filters.productId) {
    result = result.filter(p => p.productId === filters.productId);
  }
  if (filters.fromDate) {
    result = result.filter(p => new Date(p.date) >= new Date(filters.fromDate!));
  }
  if (filters.toDate) {
    result = result.filter(p => new Date(p.date) <= new Date(filters.toDate!));
  }

  return result;
}

export function filterSuffix(filters: ReportFilters): string {
  const parts: string[] = [];
  if (filters.supplierId) parts.push('Supplier');
  if (filters.productId) parts.push('Product');
  if (filters.fromDate || filters.toDate) parts.push('Dated');
  return parts.length ? `_${parts.join('_')}` : '_All';
}
