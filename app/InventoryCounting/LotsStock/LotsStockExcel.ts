'use client';

// Lots Stock - Excel template download and upload parsing.

import { exportInventoryCountingExcelTable } from '../Export/ExcelExport';
import type { LotStockUploadRow } from './LotsStockService';

export const LOT_STOCK_HEADERS = ['Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', 'Qty'];

type Field = 'productId' | 'barcode' | 'lot' | 'expiry' | 'qty';

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const HEADER_KEYS: Record<string, Field> = {
  productid: 'productId',
  barcode: 'barcode',
  productbarcode: 'barcode',
  lotnumber: 'lot',
  lotno: 'lot',
  lot: 'lot',
  expirydate: 'expiry',
  expiry: 'expiry',
  expdate: 'expiry',
  qty: 'qty',
  quantity: 'qty',
  stockqty: 'qty',
};

function cellValue(v: any): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return v.result;
    if ('text' in v) return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join('');
  }
  return v;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Excel date cell, serial number, yyyy-mm-dd or dd/mm/yyyy -> yyyy-mm-dd. Empty -> null. Bad -> undefined. */
function toIsoDate(v: unknown): string | null | undefined {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return undefined;
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return valid(+m[3], +m[2], +m[1]);
  return undefined;
}

function valid(y: number, mo: number, d: number): string | undefined {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return undefined;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Empty template: header row only. A product can be repeated on as many rows as it has lots. */
export async function downloadLotStockTemplate(): Promise<void> {
  const data: (string | number)[][] = [];
  await exportInventoryCountingExcelTable(LOT_STOCK_HEADERS, data, 'Lots_Stock_Template.xlsx', {
    sheetName: 'Lots Stock',
    numericColumns: ['Qty'],
    numericDecimalPlaces: 0,
  });
}

/**
 * Reads the first worksheet. Rows without lot number and quantity are skipped (empty template rows).
 * Throws an Error with a readable message (one line per bad row).
 */
export async function parseLotStockExcel(file: File): Promise<LotStockUploadRow[]> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The file has no worksheet.');

  let headerRow = 0;
  let colMap: Record<number, Field> = {};
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const map: Record<number, Field> = {};
    sheet.getRow(r).eachCell((cell, col) => {
      const key = HEADER_KEYS[norm(cellValue(cell.value))];
      if (key) map[col] = key;
    });
    const keys = new Set(Object.values(map));
    if (keys.has('lot') && keys.has('qty') && (keys.has('productId') || keys.has('barcode'))) {
      headerRow = r;
      colMap = map;
      break;
    }
  }
  if (!headerRow) {
    throw new Error('Could not find the columns. Expected: ' + LOT_STOCK_HEADERS.join(', '));
  }

  const rows: LotStockUploadRow[] = [];
  const errors: string[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const raw: Partial<Record<Field, unknown>> = {};
    Object.entries(colMap).forEach(([col, key]) => {
      raw[key] = cellValue(row.getCell(Number(col)).value);
    });

    const lotNumber = String(raw.lot ?? '').trim();
    const qtyText = String(raw.qty ?? '').trim();
    if (!lotNumber && !qtyText) continue; // empty template row

    const qty = toNumber(raw.qty);
    const expiry = toIsoDate(raw.expiry);
    if (!lotNumber) errors.push(`Row ${r}: lot number is empty`);
    else if (qty === null) errors.push(`Row ${r}: quantity is not a number`);
    else if (expiry === undefined) errors.push(`Row ${r}: expiry date "${String(raw.expiry)}" is not valid (use yyyy-mm-dd)`);
    else {
      rows.push({
        rowNumber: r,
        productId: String(raw.productId ?? '').trim(),
        barcode: String(raw.barcode ?? '').trim(),
        lotNumber,
        expiryDate: expiry,
        qty,
      });
    }
  }

  if (errors.length) throw new Error(errors.join('\n'));
  if (!rows.length) throw new Error('No lot rows were found in the file.');
  return rows;
}
