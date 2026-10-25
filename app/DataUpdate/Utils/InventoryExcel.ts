'use client';

// Data Update — Inventory Excel: template (Product ID, Product Name, Qty) and reading the uploaded file.

import ExcelJS from 'exceljs';
import { saveTrackedAs } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { cleanText, round3, type InventoryLine } from './DataUpdateTypes';

const HEADER_FILL = 'FF000000';
const HEADER_TEXT = 'FFFFFFFF';
const GOLD_BORDER = 'FFC9A84C';
const QTY_FMT = '#,##0.###;-#,##0.###;"-"';

type Field = 'PRODUCT_ID' | 'PRODUCT_NAME' | 'QTY';
const HEADER_ALIASES: Record<Field, string[]> = {
  PRODUCT_ID: ['productid', 'id', 'itemid', 'code', 'productcode', 'itemcode', 'رقمالمنتج', 'كودالمنتج', 'الكود'],
  PRODUCT_NAME: ['productname', 'name', 'product', 'item', 'itemname', 'description', 'اسمالمنتج', 'المنتج', 'الصنف'],
  QTY: ['qty', 'quantity', 'stock', 'stockquantity', 'onhand', 'الكمية', 'كمية', 'المخزون', 'الرصيد'],
};
const headerKey = (v: unknown) => cleanText(v).toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');

export async function downloadInventoryTemplate(products: { id: string; name: string }[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BHS Analysis';
  const ws = wb.addWorksheet('Inventory', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws.columns = [
    { header: 'Product ID', key: 'id', width: 16 },
    { header: 'Product Name', key: 'name', width: 52 },
    { header: 'Qty', key: 'qty', width: 14 },
  ];
  products.forEach((p) => ws.addRow({ id: /^\d+$/.test(p.id) ? Number(p.id) : p.id, name: p.name, qty: null }));
  const header = ws.getRow(1);
  header.height = 25;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD_BORDER } } };
  });
  const last = Math.max(products.length + 1, 200);
  for (let r = 2; r <= last; r++) {
    const row = ws.getRow(r);
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(3).numFmt = QTY_FMT;
  }
  ws.autoFilter = { from: 'A1', to: 'C1' };
  const buffer = await wb.xlsx.writeBuffer();
  saveTrackedAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Inventory_Template.xlsx');
}

function plain(value: any): any {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) return plain(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((p: any) => p.text).join('');
    if ('text' in value) return value.text;
    if ('error' in value) return null;
  }
  return value;
}

function toQty(raw: any): number | null {
  const v = plain(raw);
  if (v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? round3(v) : null;
  const s = cleanText(v).replace(/,/g, '');
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? round3(n) : null;
}

/** Rows with a product id and a quantity; rows without a quantity are left out (= 0). */
export async function readInventoryFile(file: File): Promise<InventoryLine[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  for (const ws of wb.worksheets) {
    let headerRow = 0;
    let cols: Partial<Record<Field, number>> = {};
    for (let r = 1; r <= Math.min(ws.rowCount, 15) && !headerRow; r++) {
      const found: Partial<Record<Field, number>> = {};
      ws.getRow(r).eachCell((cell, col) => {
        const k = headerKey(plain(cell.value));
        (Object.keys(HEADER_ALIASES) as Field[]).forEach((f) => {
          if (found[f] === undefined && HEADER_ALIASES[f].includes(k)) found[f] = col;
        });
      });
      if (found.PRODUCT_ID && found.QTY) {
        headerRow = r;
        cols = found;
      }
    }
    if (!headerRow) continue;

    const lines: InventoryLine[] = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const id = cleanText(plain(row.getCell(cols.PRODUCT_ID!).value));
      const qty = toQty(row.getCell(cols.QTY!).value);
      if (!id || qty === null) continue;
      if (qty < 0) throw new Error(`Row ${r}: negative quantity`);
      lines.push({ ROW: r, PRODUCT_ID: id, PRODUCT_NAME: cols.PRODUCT_NAME ? cleanText(plain(row.getCell(cols.PRODUCT_NAME).value)) : '', QTY: qty });
    }
    return lines;
  }
  throw new Error('No sheet with the columns Product ID and Qty was found');
}
