import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { buildDeadStockRows } from './DeadStockAggregation';
import { filterSuffix, ReportFilters, validateReportFilters } from './ReportFilters';

export async function generateDeadStockReport(filters: ReportFilters) {
  const validationError = validateReportFilters(filters);
  if (validationError) {
    alert(validationError);
    return;
  }

  const rows = await buildDeadStockRows(filters);
  if (!rows || rows.length === 0) {
    alert('No dead stock or slow mover products found for the selected filters.');
    return;
  }

  const numericColumns = ['On Hand', 'Net Sales', 'Net Purchases'];
  const reportData = rows.map((row, index) => ({
    '#': index + 1,
    'Product ID': row.productId,
    Barcode: row.barcode || '-',
    'Product Name': row.productName,
    Category: row.category,
    'On Hand': row.onHand,
    'Net Sales': row.netSales,
    'Net Purchases': row.netPurchases,
    Status: row.status,
  }));

  await exportStyledExcel(
    reportData,
    `Inventory_Dead_Stock_Slow_Movers${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`,
    {
      sheetName: 'Dead Stock & Slow Movers',
      numericColumns,
    },
  );
}
