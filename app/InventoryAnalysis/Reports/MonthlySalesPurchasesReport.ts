import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { buildComparisonExportRows } from './ReportExcelRows';
import { filterSuffix, ReportFilters, validateReportFilters } from './ReportFilters';
import { buildSalesPurchasesComparisonPivot } from './SalesPurchasesComparisonAggregation';

export async function generateMonthlySalesPurchasesReport(filters: ReportFilters) {
  const validationError = validateReportFilters(filters);
  if (validationError) {
    alert(validationError);
    return;
  }

  const pivot = await buildSalesPurchasesComparisonPivot(filters, 'monthly');
  if (!pivot || pivot.products.length === 0) {
    alert('No products found for the selected filters.');
    return;
  }

  const { reportData, numericColumns } = buildComparisonExportRows(
    pivot.products,
    pivot.periodColumns,
  );

  await exportStyledExcel(
    reportData,
    `Inventory_Monthly_Sales_vs_Purchases${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`,
    {
      sheetName: 'Monthly Sales vs Purchases',
      numericColumns,
    },
  );
}
