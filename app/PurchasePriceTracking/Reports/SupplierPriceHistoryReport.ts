import { PurchaseRecord, Product, Supplier } from '../page';
import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';

export async function generateSupplierPriceHistoryReport(
  supplierId: string,
  supplierName: string,
  purchases: PurchaseRecord[],
  products: Product[],
  fromDate?: string,
  toDate?: string
) {
  let supplierPurchases = purchases.filter(p => p.supplierId === supplierId);

  if (fromDate) {
    supplierPurchases = supplierPurchases.filter(p => new Date(p.date) >= new Date(fromDate));
  }
  if (toDate) {
    supplierPurchases = supplierPurchases.filter(p => new Date(p.date) <= new Date(toDate));
  }
  
  const purchasesByProduct = new Map<string, PurchaseRecord[]>();
  supplierPurchases.forEach(p => {
    const list = purchasesByProduct.get(p.productId) || [];
    list.push(p);
    purchasesByProduct.set(p.productId, list);
  });

  const productPeriods = new Map<string, { periodStr: string, price: number }[]>();
  let maxPeriods = 0;

  purchasesByProduct.forEach((productPurchasesList, productId) => {
    const sorted = [...productPurchasesList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const periods: { startDate: string, endDate: string, price: number, periodStr: string }[] = [];
    let currentPeriod: any = null;

    sorted.forEach((p, idx) => {
      if (!currentPeriod) {
        currentPeriod = { startDate: p.date, endDate: p.date, price: p.unitPrice };
      } else {
        if (p.unitPrice.toFixed(2) === currentPeriod.price.toFixed(2)) {
          currentPeriod.endDate = p.date;
        } else {
          periods.push({ ...currentPeriod });
          currentPeriod = { startDate: p.date, endDate: p.date, price: p.unitPrice };
        }
      }
      if (idx === sorted.length - 1 && currentPeriod) {
        periods.push({ ...currentPeriod });
      }
    });

    const formattedPeriods = periods.map(p => ({
      periodStr: p.startDate === p.endDate ? p.startDate : `${p.startDate} to ${p.endDate}`,
      price: p.price
    }));

    if (formattedPeriods.length > maxPeriods) {
      maxPeriods = formattedPeriods.length;
    }

    productPeriods.set(productId, formattedPeriods);
  });

  if (maxPeriods === 0) {
    alert("No purchases found for this supplier.");
    return;
  }

  const reportData: Record<string, unknown>[] = [];
  const numericColumns: string[] = [];

  for (let i = 1; i <= maxPeriods; i++) {
    numericColumns.push(`Price ${i} (AED)`);
  }

  productPeriods.forEach((periods, productId) => {
    const product = products.find(p => p.id === productId);
    const productName = product ? product.name : productId;

    const rowData: Record<string, unknown> = { 'Product Name': productName };
    
    periods.forEach((period, idx) => {
      rowData[`Period ${idx + 1}`] = period.periodStr;
      rowData[`Price ${idx + 1} (AED)`] = period.price;
    });

    // Fill missing periods with N/A
    for (let i = periods.length + 1; i <= maxPeriods; i++) {
      rowData[`Period ${i}`] = '-';
      rowData[`Price ${i} (AED)`] = '-';
    }

    reportData.push(rowData);
  });

  const fileName = `Price_History_${supplierName.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_')}`;
  
  await exportStyledExcel(reportData, fileName, {
    sheetName: 'Supplier Price History',
    columnWidth: 22,
    numericColumns
  });
}
