import { PurchaseRecord, Product } from '../page';
import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { filterPurchases, filterSuffix, ReportFilters } from './ReportFilters';

export async function generateProductPriceSequenceReport(
  purchases: PurchaseRecord[],
  products: Product[],
  filters: ReportFilters
) {
  const filteredPurchases = filterPurchases(purchases, filters);

  const purchasesByProduct = new Map<string, PurchaseRecord[]>();
  filteredPurchases.forEach(p => {
    const list = purchasesByProduct.get(p.productId) || [];
    list.push(p);
    purchasesByProduct.set(p.productId, list);
  });

  const productPrices = new Map<string, number[]>();
  let maxPrices = 0;

  purchasesByProduct.forEach((list, productId) => {
    const sorted = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const prices: number[] = [];
    const seen = new Set<string>();
    sorted.forEach(p => {
      const key = p.unitPrice.toFixed(2);
      if (!seen.has(key)) {
        seen.add(key);
        prices.push(p.unitPrice);
      }
    });

    if (prices.length > maxPrices) maxPrices = prices.length;
    productPrices.set(productId, prices);
  });

  if (maxPrices === 0) {
    alert('No purchases found for the selected filters.');
    return;
  }

  const numericColumns: string[] = [];
  for (let i = 1; i <= maxPrices; i++) {
    numericColumns.push(`Price ${i} (AED)`);
  }

  const reportData: Record<string, unknown>[] = [];

  productPrices.forEach((prices, productId) => {
    const product = products.find(p => p.id === productId);
    const row: Record<string, unknown> = {
      Barcode: product?.barcode || '-',
      'Product Name': product ? product.name : productId,
    };

    for (let i = 0; i < maxPrices; i++) {
      row[`Price ${i + 1} (AED)`] = prices[i] !== undefined ? prices[i] : '-';
    }

    reportData.push(row);
  });

  reportData.sort((a, b) => String(a['Product Name']).localeCompare(String(b['Product Name'])));

  const fileName = `Product_Price_Sequence${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`;

  await exportStyledExcel(reportData, fileName, {
    sheetName: 'Price Sequence',
    columnWidth: 18,
    numericColumns,
  });
}
