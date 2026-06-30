import { saveAs } from 'file-saver';
import type ExcelJS from 'exceljs';

export type StyledExcelExportOptions = {
  sheetName?: string;
  columnWidth?: number;
  numericColumns?: string[];
  highlightNegativeInColumns?: string[];
};

export type StyledExcelSheet = {
  name: string;
  data: Record<string, unknown>[];
  options?: Omit<StyledExcelExportOptions, 'sheetName'>;
};

const GOLD_BORDER = 'FFC9A84C';
const LIGHT_ROW_BORDER = 'FFEEEEEE';
const NEGATIVE_FILL = 'FFFEF2F2';
const NEGATIVE_TEXT = 'FFB91C1C';
const NUM_FMT = '#,##0.00';

function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/%/g, '').replace(/,/g, '').replace(/^\+/, '').trim();
    if (cleaned === '' || cleaned === '-') return null;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function shouldHighlightNegative(
  row: Record<string, unknown>,
  columns: string[] | undefined
): boolean {
  if (!columns?.length) return false;
  return columns.some((col) => {
    const num = parseNumericValue(row[col]);
    return num !== null && num < 0;
  });
}

export function recordsFromTable(
  headers: string[],
  rows: unknown[][]
): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
  );
}

function styleWorksheet(
  worksheet: ExcelJS.Worksheet,
  data: Record<string, unknown>[],
  options: StyledExcelExportOptions = {}
) {
  const keys = Object.keys(data[0] ?? {});
  const columnWidth = options.columnWidth ?? 20;
  const numericColumns = new Set(options.numericColumns ?? []);
  const highlightColumns = options.highlightNegativeInColumns ?? [];

  worksheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: columnWidth,
  }));

  worksheet.addRows(data);

  worksheet.eachRow((row, rowNumber) => {
    row.height = 25;

    const dataRow = rowNumber > 1 ? data[rowNumber - 2] : null;
    const isNegativeRow =
      dataRow !== null && shouldHighlightNegative(dataRow, highlightColumns);

    row.eachCell((cell, colNumber) => {
      const columnKey = keys[colNumber - 1];

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };

      if (rowNumber === 1) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF000000' },
        };
        cell.border = {
          bottom: { style: 'medium', color: { argb: GOLD_BORDER } },
        };
        return;
      }

      if (numericColumns.has(columnKey)) {
        const num = parseNumericValue(cell.value);
        if (num !== null) {
          cell.value = num;
          cell.numFmt = NUM_FMT;
        }
      }

      if (isNegativeRow) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: NEGATIVE_FILL },
        };
        cell.font = { color: { argb: NEGATIVE_TEXT } };
      }

      cell.border = {
        bottom: { style: 'thin', color: { argb: LIGHT_ROW_BORDER } },
      };
    });
  });
}

async function writeWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  saveAs(blob, safeName);
}

export async function exportStyledExcel(
  data: Record<string, unknown>[],
  fileName: string,
  options: StyledExcelExportOptions = {}
): Promise<void> {
  if (!data || data.length === 0) {
    console.warn('No data provided for export.');
    return;
  }

  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();
  const worksheet = workbook.addWorksheet(options.sheetName || 'Data', {
    views: [{ showGridLines: false }],
  });

  styleWorksheet(worksheet, data, options);
  await writeWorkbook(workbook, fileName);
}

export async function exportStyledExcelWorkbook(
  sheets: StyledExcelSheet[],
  fileName: string
): Promise<void> {
  const validSheets = sheets.filter((sheet) => sheet.data.length > 0);
  if (validSheets.length === 0) {
    console.warn('No data provided for export.');
    return;
  }

  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();

  validSheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(sheet.name, {
      views: [{ showGridLines: false }],
    });
    styleWorksheet(worksheet, sheet.data, sheet.options);
  });

  await writeWorkbook(workbook, fileName);
}

export async function exportStyledExcelTable(
  headers: string[],
  rows: unknown[][],
  fileName: string,
  options: StyledExcelExportOptions = {}
): Promise<void> {
  await exportStyledExcel(recordsFromTable(headers, rows), fileName, options);
}
