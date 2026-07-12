import { PurchaseRecord, Product, Supplier } from '../page';
import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';

export async function generateSupplierDependencyReport(
  purchases: PurchaseRecord[],
  products: Product[],
  suppliers: Supplier[],
  fromDate?: string,
  toDate?: string
) {
  let filteredPurchases = purchases;

  if (fromDate) {
    filteredPurchases = filteredPurchases.filter(p => new Date(p.date) >= new Date(fromDate));
  }
  if (toDate) {
    filteredPurchases = filteredPurchases.filter(p => new Date(p.date) <= new Date(toDate));
  }

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

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || id;

  const reportData: Record<string, unknown>[] = [];

  purchasesByProduct.forEach((list, productId) => {
    const supplierQty = new Map<string, number>();
    let totalQty = 0;

    list.forEach(p => {
      supplierQty.set(p.supplierId, (supplierQty.get(p.supplierId) || 0) + p.qty);
      totalQty += p.qty;
    });

    const suppliersArray = Array.from(supplierQty.entries()).map(([supId, qty]) => ({ supId, qty }));
    suppliersArray.sort((a, b) => b.qty - a.qty);

    const primarySupplier = suppliersArray[0];
    const dependencyPercent = totalQty > 0 ? (primarySupplier.qty / totalQty) * 100 : 0;
    
    let riskLevel = 'Low';
    if (dependencyPercent === 100) riskLevel = 'High (Monopoly)';
    else if (dependencyPercent >= 75) riskLevel = 'Medium (High Dependency)';

    const product = products.find(p => p.id === productId);
    const productName = product ? product.name : productId;
    const barcode = product?.barcode ? `[${product.barcode}] ` : '';

    const sortedPrices = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const oldestPrice = sortedPrices[0]?.unitPrice || 0;
    const latestPrice = sortedPrices[sortedPrices.length - 1]?.unitPrice || 0;

    let sumPrice = 0;
    list.forEach(p => sumPrice += p.unitPrice);
    const avgPrice = list.length > 0 ? sumPrice / list.length : 0;

    reportData.push({
      'Product Name': `${barcode}${productName}`,
      'Total Suppliers': suppliersArray.length,
      'Primary Supplier': getSupplierName(primarySupplier.supId),
      'Total Qty Bought': totalQty,
      'Qty From Primary': primarySupplier.qty,
      'Dependency (%)': Number(dependencyPercent.toFixed(2)),
      'Risk Level': riskLevel,
      'Oldest Price (AED)': oldestPrice,
      'Latest Price (AED)': latestPrice,
      'Average Price (AED)': Number(avgPrice.toFixed(2))
    });
  });

  // Sort by highest dependency first
  reportData.sort((a: any, b: any) => {
    if (b['Dependency (%)'] === a['Dependency (%)']) {
      return (b['Total Qty Bought'] as number) - (a['Total Qty Bought'] as number);
    }
    return (b['Dependency (%)'] as number) - (a['Dependency (%)'] as number);
  });

  const fileName = `Supplier_Dependency_Report_${new Date().toISOString().split('T')[0]}`;
  
  await exportStyledExcel(reportData, fileName, {
    sheetName: 'Dependency Risk',
    columnWidth: 22,
    numericColumns: ['Total Qty Bought', 'Qty From Primary', 'Dependency (%)', 'Oldest Price (AED)', 'Latest Price (AED)', 'Average Price (AED)']
  });
}
