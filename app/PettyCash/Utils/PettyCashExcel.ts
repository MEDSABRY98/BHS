'use client';

import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';
import { COMPANY_NAME, formatDate, uaeDateOf, type PettyCash } from './PettyCashTypes';

const BLACK = 'FF000000';
const GOLD = 'FFD4AF37';
const GOLD_BORDER = 'FFC9A84C';
const GOLD_SOFT = 'FFFBF8EE';
const ROW_BORDER = 'FFEEEEEE';
const GREEN = 'FF15803D';
const RED = 'FFB91C1C';
const NUM_FMT = '#,##0.00;-#,##0.00;"-"';

const safe = (s: string) => (s || '').replace(/[^\w؀-ۿ -]+/g, '').trim().slice(0, 40);

/**
 * One petty cash → its rows. Several → all rows with the claim number and employee.
 * Title rows + table + total row with SUM formulas.
 */
export async function exportPettyCashExcel(items: PettyCash[], opts: { period?: string } = {}) {
  if (!items.length) throw new Error('Nothing to export');
  const single = items.length === 1 ? items[0] : null;
  const employees = Array.from(new Set(items.map((p) => p.CREATED_BY).filter(Boolean)));

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Petty Cash', { views: [{ showGridLines: false, rightToLeft: false }] });

  const headers = [
    '#',
    ...(single ? [] : ['Claim No.', 'Employee', 'Submitted On']),
    'Invoice Date',
    'Description',
    'Beneficiary',
    'Tax Invoice',
    'Has Invoice',
    'Amount (AED)',
  ];
  const widths = [6, ...(single ? [] : [12, 20, 14]), 14, 42, 28, 13, 13, 16];
  ws.columns = widths.map((w) => ({ width: w }));
  const lastCol = headers.length;
  const amountCol = lastCol;

  // ── Title block ─────────────────────────────────────────
  const title = (text: string, size: number, color: string, bold = true) => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, lastCol);
    r.height = size + 10;
    r.getCell(1).font = { bold, size, color: { argb: color } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  };
  title(COMPANY_NAME, 14, BLACK);
  title(single ? `PETTY CASH CLAIM — ${single.ID}` : 'PETTY CASH STATEMENT', 12, 'FFA8861E');
  title(
    single
      ? `Employee: ${single.CREATED_BY}    ·    Submitted: ${formatDate(uaeDateOf(single.CREATED_AT))}${single.NOTES ? `    ·    Notes: ${single.NOTES}` : ''}`
      : `Employee: ${employees.length === 1 ? employees[0] : `${employees.length} employees`}    ·    Period: ${opts.period || 'All'}    ·    Claims: ${items.length}`,
    10,
    'FF475569',
    false,
  );
  ws.addRow([]);

  // ── Header ──────────────────────────────────────────────
  const headerRow = ws.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD_BORDER } } };
  });
  const firstData = headerRow.number + 1;

  // ── Rows ────────────────────────────────────────────────
  let n = 0;
  for (const p of items) {
    for (const l of p.LINES) {
      n++;
      const r = ws.addRow([
        n,
        ...(single ? [] : [p.ID, p.CREATED_BY, formatDate(uaeDateOf(p.CREATED_AT))]),
        formatDate(l.INVOICE_DATE),
        l.DESCRIPTION,
        l.BENEFICIARY,
        l.IS_TAX_INVOICE ? 'Yes' : 'No',
        l.HAS_INVOICE ? 'Yes' : 'No',
        l.AMOUNT,
      ]);
      r.height = 22;
      r.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.alignment = { vertical: 'middle', horizontal: col === amountCol ? 'right' : 'center', wrapText: true };
        cell.border = { bottom: { style: 'thin', color: { argb: ROW_BORDER } } };
      });
      r.getCell(amountCol).numFmt = NUM_FMT;
      r.getCell(amountCol).font = { bold: true };
      r.getCell(amountCol - 1).font = { bold: true, color: { argb: l.HAS_INVOICE ? GREEN : RED } };
      if (l.IS_TAX_INVOICE) r.getCell(amountCol - 2).font = { bold: true, color: { argb: 'FFA8861E' } };
    }
  }
  const lastData = ws.lastRow!.number;
  const colLetter = ws.getColumn(amountCol).letter;
  const taxLetter = ws.getColumn(amountCol - 2).letter;
  const invLetter = ws.getColumn(amountCol - 1).letter;

  // ── Totals ──────────────────────────────────────────────
  const totalRow = (text: string, formula: string, numFmt: string | null) => {
    const r = ws.addRow([]);
    ws.mergeCells(r.number, 1, r.number, amountCol - 1);
    r.getCell(1).value = text;
    r.getCell(amountCol).value = { formula } as any;
    if (numFmt) r.getCell(amountCol).numFmt = numFmt;
    r.height = 22;
    for (let c = 1; c <= lastCol; c++) {
      const cell = r.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD_SOFT } };
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'right' : c === amountCol ? 'right' : 'center' };
    }
    return r;
  };
  const tot = totalRow('Total', `SUM(${colLetter}${firstData}:${colLetter}${lastData})`, NUM_FMT);
  tot.getCell(amountCol).border = { top: { style: 'medium', color: { argb: GOLD } } };
  totalRow('Tax Invoices Total', `SUMIF(${taxLetter}${firstData}:${taxLetter}${lastData},"Yes",${colLetter}${firstData}:${colLetter}${lastData})`, NUM_FMT);
  totalRow('Rows Without Invoice', `COUNTIF(${invLetter}${firstData}:${invLetter}${lastData},"No")`, '0');

  ws.pageSetup = { paperSize: 9, orientation: single ? 'portrait' : 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const fileName = single
    ? `${single.ID}_${safe(single.CREATED_BY) || 'PettyCash'}.xlsx`
    : `PettyCash_Statement_${employees.length === 1 ? safe(employees[0]) + '_' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  saveTrackedAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  return fileName;
}
