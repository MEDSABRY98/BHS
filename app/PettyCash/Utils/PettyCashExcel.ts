'use client';

import { saveTrackedAs } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { compareLines, formatDate, uaeDateOf, type PettyCash } from './PettyCashTypes';

// Same look as the other BHS Excel exports (app/Components/Export/ExcelExport.ts)
const HEADER_FILL = 'FF000000';
const HEADER_TEXT = 'FFFFFFFF';
const GOLD_BORDER = 'FFC9A84C';
const LIGHT_ROW_BORDER = 'FFEEEEEE';
const NUM_FMT = '#,##0.00;-#,##0.00;"-"';

const safe = (s: string) => (s || '').replace(/[^\w؀-ۿ -]+/g, '').trim().slice(0, 40);

/** All rows of the chosen petty cash (beneficiary, then invoice date) + a total row. */
export async function exportPettyCashExcel(items: PettyCash[], opts: { period?: string; showAccount?: boolean } = {}) {
  if (!items.length) throw new Error('Nothing to export');
  const single = items.length === 1 ? items[0] : null;
  const employees = Array.from(new Set(items.map((p) => p.EMPLOYEE_NAME || p.CREATED_BY).filter(Boolean)));

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Petty Cash', { views: [{ showGridLines: false }] });

  // Account column: admin exports only
  const withAccount = !!opts.showAccount && items.some((p) => p.LINES.some((l) => String(l.ACCOUNT || '').trim()));
  // Same column order as the PDF, then the extra Excel columns
  const headers = [
    '#',
    ...(single ? [] : ['Claim No.']),
    'Invoice Date',
    'Description',
    'Beneficiary',
    'Amount (AED)',
    'Has Invoice',
    'Employee',
    'Tax Invoice',
    ...(withAccount ? ['Account'] : []),
  ];
  const widths = [8, ...(single ? [] : [14]), 16, 42, 28, 18, 14, 22, 14, ...(withAccount ? [26] : [])];
  ws.columns = headers.map((h, i) => ({ header: h, width: widths[i] }));
  const lastCol = headers.length;
  const amountCol = headers.indexOf('Amount (AED)') + 1;

  const allRows = items.flatMap((p) => p.LINES.map((l) => ({ p, l }))).sort((a, b) => compareLines(a.l, b.l));
  allRows.forEach(({ p, l }, i) => {
    ws.addRow([
      i + 1,
      ...(single ? [] : [p.ID]),
      formatDate(l.INVOICE_DATE),
      l.DESCRIPTION,
      l.BENEFICIARY,
      l.AMOUNT,
      l.HAS_INVOICE ? 'Yes' : 'No',
      p.EMPLOYEE_NAME || p.CREATED_BY,
      l.IS_TAX_INVOICE ? 'Yes' : 'No',
      ...(withAccount ? [String(l.ACCOUNT || '').trim()] : []),
    ]);
  });
  const lastData = ws.lastRow!.number;
  const amountLetter = ws.getColumn(amountCol).letter;

  const total = ws.addRow([]);
  total.getCell(1).value = 'TOTAL';
  total.getCell(amountCol).value = { formula: `SUM(${amountLetter}2:${amountLetter}${lastData})` } as any;

  ws.eachRow((row, rowNumber) => {
    row.height = 25;
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      if (rowNumber === 1) {
        cell.font = { bold: true, color: { argb: HEADER_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
        cell.border = { bottom: { style: 'medium', color: { argb: GOLD_BORDER } } };
        continue;
      }
      if (c === amountCol) cell.numFmt = NUM_FMT;
      if (row.number === total.number) {
        cell.font = { bold: true };
        cell.border = { top: { style: 'medium', color: { argb: GOLD_BORDER } } };
      } else {
        cell.border = { bottom: { style: 'thin', color: { argb: LIGHT_ROW_BORDER } } };
      }
    }
  });

  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const fileName = single
    ? `${single.ID}_${safe(single.EMPLOYEE_NAME || single.CREATED_BY) || 'PettyCash'}.xlsx`
    : `PettyCash_Statement_${employees.length === 1 ? safe(employees[0]) + '_' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  saveTrackedAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  return fileName;
}
