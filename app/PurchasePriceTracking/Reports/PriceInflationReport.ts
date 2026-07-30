import { PurchaseRecord, Product } from '../page';
import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
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
    const sorted = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const oldestPurchase = sorted[0];
    const latestPurchase = sorted[sorted.length - 1];

    const oldestPrice = oldestPurchase.unitPrice;
    const latestPrice = latestPurchase.unitPrice;

    let variancePercent = 0;
    if (oldestPrice > 0) {
      variancePercent = ((latestPrice - oldestPrice) / oldestPrice) * 100;
    }

    let trend = 'No Change';
    if (variancePercent > 0) trend = 'Increased ↗';
    else if (variancePercent < 0) trend = 'Decreased ↘';

    const product = products.find(p => p.id === productId);
    const productName = product ? product.name : productId;
    const barcode = product?.barcode || '-';

    reportData.push({
      'Barcode': barcode,
      'Product Name': productName,
      'Oldest Date': oldestPurchase.date,
      'Oldest Price (AED)': oldestPrice,
      'Latest Date': latestPurchase.date,
      'Latest Price (AED)': latestPrice,
      'Variance (%)': Number(variancePercent.toFixed(2)),
      'Trend': trend
    });
  });

  // Sort by highest inflation first
  reportData.sort((a: any, b: any) => b['Variance (%)'] - a['Variance (%)']);

  const fileName = `Price_Inflation_Report${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`;
  
  await exportStyledExcel(reportData, fileName, {
    sheetName: 'Price Inflation',
    columnWidth: 20,
    numericColumns: ['Oldest Price (AED)', 'Latest Price (AED)', 'Variance (%)']
  });
}
