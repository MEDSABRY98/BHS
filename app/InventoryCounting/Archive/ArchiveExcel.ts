'use client';

// Archive - one Excel file per closed count: Total, Users and Records sheets.

import type { ICSessionData } from '../Sessions/ICSessionsService';

const pad = (n: number) => String(n).padStart(2, '0');

function formatDateTime(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Cell = string | number;

function addSheet(workbook: any, name: string, headers: string[], rows: Cell[][], numeric: string[]) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(headers);
  rows.forEach((r) => sheet.addRow(r));

  const head = sheet.getRow(1);
  head.height = 24;
  head.eachCell((cell: any) => {
    cell.font = { bold: true, color: { argb: 'FFD4AF37' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F0F0F' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  headers.forEach((h, i) => {
    const col = sheet.getColumn(i + 1);
    const longest = rows.reduce((m, r) => Math.max(m, String(r[i] ?? '').length), h.length);
    col.width = Math.min(Math.max(longest + 3, 12), 48);
    if (numeric.includes(h)) {
      col.numFmt = '#,##0.##';
      col.alignment = { horizontal: 'center' };
    }
  });
  if (rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
}

export async function downloadArchiveExcel(data: ICSessionData): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const lotById = new Map(data.lots.map((l) => [l.lotId, l]));

  // 1) Total: expected vs counted per lot
  addSheet(
    workbook,
    'Total',
    ['Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', 'Expected', 'Counted', 'Variance'],
    data.lots.map((l) => [l.productId, l.barcode, l.productName, l.lotNumber, l.expiryDate, l.expected, l.counted, l.variance]),
    ['Expected', 'Counted', 'Variance'],
  );

  // 2) Users: what each user counted per lot, one row per lot and user
  const perLotUser = new Map<number, Map<string, number>>();
  for (const e of data.entries) {
    const m = perLotUser.get(e.lotId) ?? new Map<string, number>();
    m.set(e.userName, (m.get(e.userName) ?? 0) + e.qty);
    perLotUser.set(e.lotId, m);
  }
  const userRows: Cell[][] = [];
  for (const l of data.lots) {
    const m = perLotUser.get(l.lotId);
    if (!m) continue;
    Array.from(m.keys())
      .sort((a, b) => a.localeCompare(b))
      .forEach((u) => userRows.push([l.productId, l.barcode, l.productName, l.lotNumber, l.expiryDate, u, m.get(u) ?? 0]));
  }
  addSheet(workbook, 'Users', ['Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', 'User', 'Counted'], userRows, ['Counted']);

  // 3) Records: every saved count
  addSheet(
    workbook,
    'Records',
    ['Date', 'User', 'Product ID', 'Barcode', 'Product Name', 'Lot Number', 'Expiry Date', 'Count Details', 'Counted Qty'],
    data.entries.map((e) => {
      const l = lotById.get(e.lotId);
      return [
        formatDateTime(e.createdAt),
        e.userName,
        l?.productId ?? '',
        l?.barcode ?? '',
        l?.productName ?? '',
        l?.lotNumber ?? '',
        l?.expiryDate ?? '',
        e.details,
        e.qty,
      ];
    }),
    ['Counted Qty'],
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (data.session.name || `Session_${data.session.id}`).replace(/[\\/:*?"<>|]+/g, '_');
  a.href = url;
  a.download = `Archive_${safeName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
