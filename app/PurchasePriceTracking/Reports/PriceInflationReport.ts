import { PurchaseRecord, Product } from '../page';
import { exportPurchasePriceTrackingExcel } from '../Export/ExcelExport';
import { filterPurchases, filterSuffix, ReportFilters } from './ReportFilters';

export async function generatePriceInflationReport(
  purchases: PurchaseRecord[],
  products: Product[],
  filters: ReportFilters
) {
  const filteredPurchases = filterPurchases(purchases, filters, products);

  if (filteredPurchases.length === 0) {
    alert("No purchases found for the selected date range.");
    return;
  }

  const purchasesByProduct = new Map<string, PurchaseRecord[]>();
  filteredPurchases.forEach(p => {
    const list = purchasesByProduct.get(p.productId) || [];
    list.push(p);
    purchasesByProduct.set(p.productId, list);
  });

  const reportData: Record<string, unknown>[] = [];

  purchasesByProduct.forEach((list, productId) => {
    const sorted = [...list].sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });

    const latestPurchase = sorted[sorted.length - 1];
    const previousPurchase = sorted.length >= 2 ? sorted[sorted.length - 2] : latestPurchase;

    const latestPrice = latestPurchase.unitPrice;
    const previousPrice = previousPurchase.unitPrice;
    const variance =
      sorted.length >= 2 ? latestPrice - previousPrice : 0;

    let trend = 'No Change';
    if (variance > 0) trend = 'Increased ↗';
    else if (variance < 0) trend = 'Decreased ↘';

    const product = products.find(p => p.id === productId);
    const productName = product ? product.name : productId;
    const barcode = product?.barcode || '-';

    reportData.push({
      'Barcode': barcode,
      'Product Name': productName,
      'Previous Date': previousPurchase.date,
      'Previous Price (AED)': previousPrice,
      'Latest Date': latestPurchase.date,
      'Latest Price (AED)': latestPrice,
      Variance: variance,
      'Trend': trend
    });
  });

  // Sort by highest inflation first
  reportData.sort((a: any, b: any) => b.Variance - a.Variance);

  const fileName = `Price_Inflation_Report${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`;
  
  await exportPurchasePriceTrackingExcel(reportData, fileName, {
    sheetName: 'Price Inflation',
    columnWidth: 20,
    numericColumns: ['Previous Price (AED)', 'Latest Price (AED)', 'Variance']
  });
}
