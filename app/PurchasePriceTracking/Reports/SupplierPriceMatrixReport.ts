import { PurchaseRecord, Product, Supplier } from '../page';
import { exportPurchasePriceTrackingExcel } from '../Export/ExcelExport';
import { filterPurchases, filterSuffix, ReportFilters } from './ReportFilters';

function buildLatestPriceMap(
  purchases: PurchaseRecord[]
): Map<string, number> {
  const latestByKey = new Map<string, PurchaseRecord>();

  purchases.forEach(p => {
    const key = `${p.productId}::${p.supplierId}`;
    const existing = latestByKey.get(key);
    if (!existing || new Date(p.date).getTime() > new Date(existing.date).getTime()) {
      latestByKey.set(key, p);
    }
  });

  const priceMap = new Map<string, number>();
  latestByKey.forEach((purchase, key) => {
    priceMap.set(key, purchase.unitPrice);
  });

  return priceMap;
}

export async function generateSupplierPriceMatrixReport(
  purchases: PurchaseRecord[],
  products: Product[],
  suppliers: Supplier[],
  filters: ReportFilters
) {
  const filteredPurchases = filterPurchases(purchases, filters, products);

  if (filteredPurchases.length === 0) {
    alert('No purchases found for the selected filters.');
    return;
  }

  const activeProductIds = [...new Set(filteredPurchases.map(p => p.productId))];

  const sortedProducts = activeProductIds
    .map(id => products.find(p => p.id === id))
    .filter((p): p is Product => p !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (sortedProducts.length === 0) {
    alert('No products found for the selected filters.');
    return;
  }

  const reportProductIds = new Set(sortedProducts.map(p => p.id));
  const reportPurchases = filteredPurchases.filter(p => reportProductIds.has(p.productId));

  const activeSupplierIds = [...new Set(reportPurchases.map(p => p.supplierId))];
  const sortedSuppliers = activeSupplierIds
    .map(id => suppliers.find(s => s.id === id) || { id, name: id })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (sortedSuppliers.length === 0) {
    alert('No suppliers found for the selected products.');
    return;
  }

  const latestPrices = buildLatestPriceMap(reportPurchases);
  const supplierColumnNames = sortedSuppliers.map(s => s.name);

  const reportData: Record<string, unknown>[] = sortedProducts.map(product => {
    const row: Record<string, unknown> = {
      Barcode: product.barcode || '-',
      'Product Name': product.name,
    };

    sortedSuppliers.forEach(supplier => {
      const price = latestPrices.get(`${product.id}::${supplier.id}`);
      row[supplier.name] = price !== undefined ? price : '-';
    });

    return row;
  });

  const fileName = `Supplier_Price_Matrix${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`;

  await exportPurchasePriceTrackingExcel(reportData, fileName, {
    sheetName: 'Supplier Price Matrix',
    columnWidth: 18,
    numericColumns: supplierColumnNames,
  });
}
