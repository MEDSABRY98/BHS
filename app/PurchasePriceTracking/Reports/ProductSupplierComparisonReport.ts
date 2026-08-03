import { PurchaseRecord, Product, Supplier } from '../page';
import { exportPurchasePriceTrackingExcel } from '../Export/ExcelExport';
import { RoundPurchasePrice } from '../Utils/PriceFormat';
import { filterPurchases, filterSuffix, ReportFilters } from './ReportFilters';

export async function generateProductSupplierComparisonReport(
  productName: string,
  purchases: PurchaseRecord[],
  suppliers: Supplier[],
  filters: ReportFilters,
  products: Product[],
) {
  const productPurchases = filterPurchases(purchases, filters, products);
  
  if (productPurchases.length === 0) {
    alert("No purchases found for this product.");
    return;
  }

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || id;

  const purchasesBySupplier = new Map<string, PurchaseRecord[]>();
  productPurchases.forEach(p => {
    const list = purchasesBySupplier.get(p.supplierId) || [];
    list.push(p);
    purchasesBySupplier.set(p.supplierId, list);
  });

  const reportData: Record<string, unknown>[] = [];

  purchasesBySupplier.forEach((list, supplierId) => {
    // Sort chronologically
    const sorted = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const latestPurchase = sorted[sorted.length - 1];
    
    // Previous prices
    const previousPurchases = sorted.slice(0, -1);
    let avgPreviousPrice = 0;
    if (previousPurchases.length > 0) {
      const sum = previousPurchases.reduce((acc, p) => acc + p.unitPrice, 0);
      avgPreviousPrice = sum / previousPurchases.length;
    }

    let minPrice = Infinity;
    let minDate = '';
    let maxPrice = -Infinity;
    let maxDate = '';

    sorted.forEach(p => {
      // Find min price (prefer oldest date if prices are equal, or just first encountered)
      if (p.unitPrice < minPrice) {
        minPrice = p.unitPrice;
        minDate = p.date;
      }
      // Find max price
      if (p.unitPrice > maxPrice) {
        maxPrice = p.unitPrice;
        maxDate = p.date;
      }
    });

    reportData.push({
      'Supplier Name': getSupplierName(supplierId),
      'Latest Purchase Date': latestPurchase.date,
      'Latest Price (AED)': latestPurchase.unitPrice,
      'Avg Previous Price (AED)': previousPurchases.length > 0 ? RoundPurchasePrice(avgPreviousPrice) : 'N/A',
      'Lowest Price (AED)': minPrice !== Infinity ? minPrice : 'N/A',
      'Lowest Price Date': minDate || 'N/A',
      'Highest Price (AED)': maxPrice !== -Infinity ? maxPrice : 'N/A',
      'Highest Price Date': maxDate || 'N/A'
    });
  });

  // Sort by latest price ascending (best supplier first)
  reportData.sort((a: any, b: any) => a['Latest Price (AED)'] - b['Latest Price (AED)']);

  const fileName = `Supplier_Comparison_${productName.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_')}`;
  
  await exportPurchasePriceTrackingExcel(reportData, fileName, {
    sheetName: 'Supplier Comparison',
    columnWidth: 22,
    numericColumns: ['Latest Price (AED)', 'Avg Previous Price (AED)', 'Lowest Price (AED)', 'Highest Price (AED)']
  });
}
