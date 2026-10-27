'use client';

// Purchase Planning — Excel with three sheets, the same as the page: All, No Parent, With Parent
// (grouped under each parent, names in red when 2+ products of a parent have the same unit).
// Same columns, order, box view and totals as the table.

import ExcelJS from 'exceljs';
import { saveTrackedAs } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import type { PlanningMonth, ProductPurchaseRow } from '../Context/PurchaseDataContext';

const DARK = 'FF0A0F1D';
const WHITE = 'FFFFFFFF';
const GROUP_FILL = 'FFF8FAFC';
const TOTAL_FILL = 'FFF1F5F9';
const LINE = 'FFE2E8F0';
const RED = 'FFDC2626';
const INDIGO = 'FF4F46E5';
const GREEN = 'FF16A34A';
const GRAY = 'FF64748B';

export type PlanningSheet = { name: string; rows: ProductPurchaseRow[]; grouped: boolean };

interface Options {
  sheets: PlanningSheet[];
  months: PlanningMonth[];
  showInBoxes: boolean;
  orderQuantities: Map<string, number>;
  /** product id -> name (the parent's name in the group rows) */
  nameOf: Map<string, string>;
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
const unitKey = (p: ProductPurchaseRow) => `${p.parentId}|${(p.unit || '').trim().toUpperCase()}`;

export async function exportPlanningExcel({ sheets, months, showInBoxes, orderQuantities, nameOf }: Options) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BHS Analysis';

  const headers = ['Barcode', 'Product Name', 'Unit', 'Qty in Box', 'Stock', ...months.map((m) => m.label), 'Average', 'Order Qty'];
  const colCount = headers.length;
  const stockCol = 5;
  const avgCol = 6 + months.length;
  const orderCol = avgCol + 1;

  const val = (p: ProductPurchaseRow, n: number, oneDecimal = false): number | string => {
    if (showInBoxes) return !p.qtyInBox || p.qtyInBox <= 0 ? 'N/A' : Number((n / p.qtyInBox).toFixed(1));
    return oneDecimal ? Number(n.toFixed(1)) : n;
  };

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name, { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
    ws.columns = headers.map((h, i) => ({
      header: h,
      width: i === 1 ? 46 : i === 0 ? 18 : i === 2 ? 10 : 13,
    }));

    const head = ws.getRow(1);
    head.height = 26;
    head.eachCell((c) => {
      c.font = { bold: true, color: { argb: WHITE }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // groups (With Parent) or one plain list
    let groups: { parentId: string; parentName: string; rows: ProductPurchaseRow[] }[];
    if (sheet.grouped) {
      const map = new Map<string, ProductPurchaseRow[]>();
      sheet.rows.forEach((p) => map.set(p.parentId, [...(map.get(p.parentId) || []), p]));
      groups = Array.from(map.entries())
        .map(([parentId, rows]) => ({ parentId, parentName: nameOf.get(parentId) || '', rows: [...rows].sort((a, b) => byName(a.name || '', b.name || '')) }))
        .sort((a, b) => byName(a.parentName || a.parentId, b.parentName || b.parentId));
    } else {
      groups = [{ parentId: '', parentName: '', rows: sheet.rows }];
    }

    // red names: 2+ products of the same parent with the same unit (With Parent only)
    const shared = new Set<string>();
    if (sheet.grouped) {
      const count = new Map<string, number>();
      sheet.rows.forEach((p) => p.parentId && count.set(unitKey(p), (count.get(unitKey(p)) || 0) + 1));
      count.forEach((n, k) => n > 1 && shared.add(k));
    }

    for (const g of groups) {
      if (sheet.grouped) {
        const gr = ws.addRow([`PARENT  ${g.parentId}${g.parentName ? `   ${g.parentName}` : ''}   (${g.rows.length})`]);
        ws.mergeCells(gr.number, 1, gr.number, colCount);
        gr.height = 20;
        const c = gr.getCell(1);
        c.font = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
        c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        for (let i = 1; i <= colCount; i++) {
          gr.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_FILL } };
          gr.getCell(i).border = { bottom: { style: 'thin', color: { argb: LINE } } };
        }
      }
      for (const p of g.rows) {
        const noBox = showInBoxes && (!p.qtyInBox || p.qtyInBox <= 0);
        const oq = orderQuantities.get(p.productId) || 0;
        const row = ws.addRow([
          p.barcode || '-',
          p.name,
          p.unit || '-',
          p.qtyInBox || '-',
          val(p, p.stockQuantity || 0),
          ...months.map((m) => val(p, p.monthlySales[m.key] || 0)),
          val(p, p.monthlyAverage || 0, true),
          oq ? val(p, oq) : '',
        ]);
        row.eachCell({ includeEmpty: true }, (c, col) => {
          c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: col === 2 };
          c.border = { bottom: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: 'FFF8FAFC' } } };
          if (noBox) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
          if (col >= stockCol && typeof c.value === 'number') c.numFmt = showInBoxes || col === avgCol ? '#,##0.0' : '#,##0';
        });
        row.getCell(1).font = { name: 'Consolas', size: 9 };
        row.getCell(2).font = { bold: true, color: { argb: shared.has(unitKey(p)) ? RED : 'FF111827' } };
        row.getCell(3).font = { bold: true, size: 9, color: { argb: GRAY } };
        row.getCell(4).font = { color: { argb: GRAY } };
        row.getCell(stockCol).font = { bold: true, color: { argb: noBox ? RED : INDIGO } };
        row.getCell(avgCol).font = { bold: true, color: { argb: noBox ? RED : GREEN } };
        row.getCell(orderCol).font = { bold: true };
      }
    }

    // totals (pieces; '-' in the box view, like the page)
    const sum = (f: (p: ProductPurchaseRow) => number) => sheet.rows.reduce((s, p) => s + f(p), 0);
    const total = ws.addRow([
      '',
      'TOTAL',
      '',
      '',
      showInBoxes ? '-' : sum((p) => p.stockQuantity || 0),
      ...months.map((m) => (showInBoxes ? '-' : sum((p) => p.monthlySales[m.key] || 0))),
      showInBoxes ? '-' : Number(sum((p) => p.monthlyAverage || 0).toFixed(1)),
      showInBoxes ? '-' : sum((p) => orderQuantities.get(p.productId) || 0),
    ]);
    total.height = 22;
    total.eachCell({ includeEmpty: true }, (c, col) => {
      c.font = { bold: true, color: { argb: col === stockCol ? INDIGO : col === avgCol ? GREEN : 'FF1E293B' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { top: { style: 'medium', color: { argb: 'FFCBD5E1' } } };
      if (typeof c.value === 'number') c.numFmt = col === avgCol ? '#,##0.0' : '#,##0';
    });

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colCount } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  saveTrackedAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Purchase_Planning_${new Date().toISOString().split('T')[0]}${showInBoxes ? '_Boxes' : ''}.xlsx`,
  );
}
