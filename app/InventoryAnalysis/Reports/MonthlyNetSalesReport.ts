import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { buildNetSalesPivot } from './NetSalesAggregation';
import { buildPivotExportRows } from './ReportExcelRows';
import { filterSuffix, ReportFilters, validateReportFilters } from './ReportFilters';

export async function generateMonthlyNetSalesReport(filters: ReportFilters) {
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
    pivot.monthColumns,
    'monthlyValues',
  );

  await exportStyledExcel(reportData, `Inventory_Monthly_Net_Sales${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`, {
    sheetName: 'Monthly Net Sales',
    numericColumns,
  });
}
