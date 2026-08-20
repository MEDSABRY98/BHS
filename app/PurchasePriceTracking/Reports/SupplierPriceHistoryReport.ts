import { PurchaseRecord, Product, Supplier } from '../page';
import { exportPurchasePriceTrackingExcel } from '../Export/ExcelExport';
import { SamePurchasePrice } from '../Utils/PriceFormat';
import { filterPurchases, filterSuffix, ReportFilters } from './ReportFilters';

export async function generateSupplierPriceHistoryReport(
  supplierName: string | null,
  purchases: PurchaseRecord[],
  products: Product[],
  suppliers: Supplier[],
  filters: ReportFilters
) {
  const supplierPurchases = filterPurchases(purchases, filters, products);
  
  const purchasesByKey = new Map<string, PurchaseRecord[]>();
  supplierPurchases.forEach(p => {
    const key = `${p.supplierId}::${p.productId}`;
    const list = purchasesByKey.get(key) || [];
    list.push(p);
    purchasesByKey.set(key, list);
  });

  const productPeriods = new Map<string, { periodStr: string, price: number }[]>();
  let maxPeriods = 0;

  purchasesByKey.forEach((productPurchasesList, key) => {
    const sorted = [...productPurchasesList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const periods: { startDate: string, endDate: string, price: number, periodStr: string }[] = [];
    let currentPeriod: any = null;

    sorted.forEach((p, idx) => {
      if (!currentPeriod) {
        currentPeriod = { startDate: p.date, endDate: p.date, price: p.unitPrice };
      } else {
        if (SamePurchasePrice(p.unitPrice, currentPeriod.price)) {
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

    productPeriods.set(key, formattedPeriods);
  });

  if (maxPeriods === 0) {
    alert("No purchases found.");
    return;
  }

  const reportData: Record<string, unknown>[] = [];
  const numericColumns: string[] = ['Latest Price (AED)'];

  for (let i = 1; i <= maxPeriods; i++) {
    numericColumns.push(`Price ${i} (AED)`);
  }

  productPeriods.forEach((periods, key) => {
    const [supplierId, productId] = key.split('::');
    const product = products.find(p => p.id === productId);
    const productName = product ? product.name : productId;
    const barcode = product?.barcode || '-';
    const supplier = suppliers.find(s => s.id === supplierId);
    const sName = supplier ? supplier.name : supplierId;

    const latestPrice = periods.length > 0 ? periods[periods.length - 1].price : '-';

    const rowData: Record<string, unknown> = {
      'Supplier': sName,
      'Product ID': productId,
      'Barcode': barcode,
      'Product Name': productName,
      'Latest Price (AED)': latestPrice
    };
    
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

  reportData.sort((a, b) => {
     const sCmp = String(a['Supplier']).localeCompare(String(b['Supplier']));
     if (sCmp !== 0) return sCmp;
     return String(a['Product Name']).localeCompare(String(b['Product Name']));
  });

  const fileName = `Price_History_${supplierName ? supplierName.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_') : 'All_Suppliers'}${filterSuffix(filters)}`;
  
  const finalReportData = reportData.map((row, index) => ({
    '#': index + 1,
    ...row
  }));

  await exportPurchasePriceTrackingExcel(finalReportData, fileName, {
    sheetName: 'Supplier Price History',
    columnWidth: 22,
    numericColumns
  });
}
