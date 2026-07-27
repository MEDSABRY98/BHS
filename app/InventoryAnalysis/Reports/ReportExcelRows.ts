import type { ComparisonProductRow } from './SalesPurchasesComparisonAggregation';
import type { NetSalesProductRow, PeriodColumn } from './NetSalesAggregation';

type PeriodValuesKey = 'monthlyValues' | 'quarterlyValues';

export function buildComparisonExportRows(
  products: ComparisonProductRow[],
  periodColumns: PeriodColumn[],
): { reportData: Record<string, string | number>[]; numericColumns: string[] } {
  const numericColumns: string[] = ['Total Sales', 'Total Purchases'];
  periodColumns.forEach((col) => {
    numericColumns.push(`${col.label} Sales`, `${col.label} Purchases`);
  });

  const reportData = products.map((row, index) => {
    let totalSales = 0;
    let totalPurchases = 0;

    periodColumns.forEach((col) => {
      totalSales += row.salesValues[col.key] ?? 0;
      totalPurchases += row.purchasesValues[col.key] ?? 0;
    });

    const record: Record<string, string | number> = {
      '#': index + 1,
      'Product ID': row.productId,
      Barcode: row.barcode || '-',
      'Product Name': row.productName,
      'Total Sales': totalSales,
      'Total Purchases': totalPurchases,
    };

    periodColumns.forEach((col) => {
      record[`${col.label} Sales`] = row.salesValues[col.key] ?? 0;
      record[`${col.label} Purchases`] = row.purchasesValues[col.key] ?? 0;
    });

    return record;
  });

  return { reportData, numericColumns };
}

export function buildPivotExportRows(
  products: NetSalesProductRow[],
  periodColumns: PeriodColumn[],
  valuesKey: PeriodValuesKey,
): { reportData: Record<string, string | number>[]; numericColumns: string[] } {
  const numericColumns = ['Total', ...periodColumns.map((col) => col.label)];

  const reportData = products.map((row, index) => {
    let total = 0;
    periodColumns.forEach((col) => {
      total += row[valuesKey][col.key] ?? 0;
    });

    const record: Record<string, string | number> = {
      '#': index + 1,
      'Product ID': row.productId,
      Barcode: row.barcode || '-',
      'Product Name': row.productName,
      Total: total,
    };

    periodColumns.forEach((col) => {
      record[col.label] = row[valuesKey][col.key] ?? 0;
    });

    return record;
  });

  return { reportData, numericColumns };
}
