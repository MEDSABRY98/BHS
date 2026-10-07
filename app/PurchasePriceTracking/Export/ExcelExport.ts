/**
 * PurchasePriceTracking Excel export entry point.
 */

import {
  exportStyledExcel as baseExportStyledExcel,
  exportStyledExcelWorkbook as baseExportStyledExcelWorkbook,
  exportStyledExcelTable as baseExportStyledExcelTable,
  recordsFromTable,
  type StyledExcelExportOptions,
  type StyledExcelSheet,
} from '@/app/Components/Export/ExcelExport';
import { PurchasePriceDecimals } from '../Utils/PriceFormat';

export type PurchasePriceTrackingExcelExportOptions = StyledExcelExportOptions;
export type PurchasePriceTrackingExcelSheet = StyledExcelSheet;

function withPurchasePriceDecimals(
  options: StyledExcelExportOptions = {},
): StyledExcelExportOptions {
  return {
    ...options,
    numericDecimalPlaces: options.numericDecimalPlaces ?? PurchasePriceDecimals,
  };
}

export async function exportPurchasePriceTrackingExcel(
  data: Record<string, unknown>[],
  fileName: string,
  options: StyledExcelExportOptions = {},
): Promise<void> {
  await baseExportStyledExcel(data, fileName, withPurchasePriceDecimals(options));
}

export async function exportPurchasePriceTrackingExcelWorkbook(
  sheets: StyledExcelSheet[],
  fileName: string,
): Promise<void> {
  await baseExportStyledExcelWorkbook(
    sheets.map((sheet) => ({
      ...sheet,
      options: withPurchasePriceDecimals(sheet.options),
    })),
    fileName,
  );
}

export async function exportPurchasePriceTrackingExcelTable(
  headers: string[],
  rows: unknown[][],
  fileName: string,
  options: StyledExcelExportOptions = {},
): Promise<void> {
  await baseExportStyledExcelTable(headers, rows, fileName, withPurchasePriceDecimals(options));
}

export { recordsFromTable };
