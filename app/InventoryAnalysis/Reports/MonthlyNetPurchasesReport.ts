import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { buildNetPurchasesPivot } from './NetPurchasesAggregation';
import { buildPivotExportRows } from './ReportExcelRows';
import { filterSuffix, ReportFilters, validateReportFilters } from './ReportFilters';

export async function generateMonthlyNetPurchasesReport(filters: ReportFilters) {
  const validationError = validateReportFilters(filters);
  if (validationError) {
    alert(validationError);
    return;
  }

  const pivot = await buildNetPurchasesPivot(filters);
  if (!pivot || pivot.products.length === 0) {
    alert('No products found for the selected filters.');
    return;
  }

  const { reportData, numericColumns } = buildPivotExportRows(
    pivot.products,
    pivot.monthColumns,
    'monthlyValues',
  );

  await exportStyledExcel(
    reportData,
    `Inventory_Monthly_Net_Purchases${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`,
    {
      sheetName: 'Monthly Net Purchases',
      numericColumns,
    },
  );
}
