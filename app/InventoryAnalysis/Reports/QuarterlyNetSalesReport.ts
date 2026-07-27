import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { buildNetSalesPivot } from './NetSalesAggregation';
import { buildPivotExportRows } from './ReportExcelRows';
import { filterSuffix, ReportFilters, validateReportFilters } from './ReportFilters';

export async function generateQuarterlyNetSalesReport(filters: ReportFilters) {
  const validationError = validateReportFilters(filters);
  if (validationError) {
    alert(validationError);
    return;
  }

  const pivot = await buildNetSalesPivot(filters);
  if (!pivot || pivot.products.length === 0) {
    alert('No products found for the selected filters.');
    return;
  }

  const { reportData, numericColumns } = buildPivotExportRows(
    pivot.products,
    pivot.quarterColumns,
    'quarterlyValues',
  );

  await exportStyledExcel(reportData, `Inventory_Quarterly_Net_Sales${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`, {
    sheetName: 'Quarterly Net Sales',
    numericColumns,
  });
}
