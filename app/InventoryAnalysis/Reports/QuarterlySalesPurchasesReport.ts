import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { buildComparisonExportRows } from './ReportExcelRows';
import { filterSuffix, ReportFilters, validateReportFilters } from './ReportFilters';
import { buildSalesPurchasesComparisonPivot } from './SalesPurchasesComparisonAggregation';

export async function generateQuarterlySalesPurchasesReport(filters: ReportFilters) {
  const validationError = validateReportFilters(filters);
  if (validationError) {
    alert(validationError);
    return;
  }

  const pivot = await buildSalesPurchasesComparisonPivot(filters, 'quarterly');
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
    `Inventory_Quarterly_Sales_vs_Purchases${filterSuffix(filters)}_${new Date().toISOString().split('T')[0]}`,
    {
      sheetName: 'Quarterly Sales vs Purchases',
      numericColumns,
    },
  );
}
