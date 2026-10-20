'use client';

// Inventory Count report - PDF (cover page + grouped details + signatures) and Excel exports.

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf, saveTrackedAs } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import {
  type CountRow,
  type CoverInfo,
  TEMPLATE_HEADERS,
  formatCoverDate,
  fmtMoney,
  fmtQty,
  groupByCategory,
  sumTotals,
} from './ReportTypes';
import { exportInventoryCountingExcelTable } from '../Export/ExcelExport';

type RGB = [number, number, number];
const INK: RGB = [15, 23, 42];
const TEXT: RGB = [51, 65, 85];
const GOLD: RGB = [212, 175, 55];
const GOLD_SOFT: RGB = [253, 246, 220];
const GOLD_DARK: RGB = [184, 134, 11];
const MUTED: RGB = [100, 116, 139];
const GREEN: RGB = [5, 150, 105];
const RED: RGB = [220, 38, 38];
const SOFT: RGB = [248, 250, 252];
const LINE: RGB = [226, 232, 240];
const CAT_FILL: RGB = [226, 232, 240];

const AR = /[؀-ۿ]/;

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim();

export async function downloadTemplate() {
  await exportInventoryCountingExcelTable(
    TEMPLATE_HEADERS,
    [['6281000000000', 'Sample Product', 'Sample Category', 10, 100, 98, 980, -2, -20]],
    'Inventory_Count_Template.xlsx',
    { sheetName: 'Count', numericColumns: ['Product Cost', 'Available Qty', 'QTY Count', 'QTY Amount', 'Diff QTY', 'Diff Amount'] },
  );
}

export async function exportCountReportPdf(rows: CountRow[], cover: CoverInfo): Promise<void> {
  if (!rows.length) return;
  const jsPDF = (await import('jspdf')).default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  // page 1 (cover) is portrait; the details pages are landscape
  const doc: any = new jsPDF('p', 'mm', 'a4');
  let hasArabic = true;
  try {
    await addArabicFont(doc);
  } catch {
    hasArabic = false;
  }
  const shape = (t: string) => {
    if (!hasArabic || !AR.test(t)) return t;
    try {
      return typeof doc.processArabic === 'function' ? doc.processArabic(t) : t;
    } catch {
      return t;
    }
  };
  // text drawn with the right font for its script
  const put = (t: string, x: number, y: number, opts: any = {}, bold = false) => {
    if (hasArabic && AR.test(t)) {
      doc.setFont('Amiri', 'normal');
      doc.text(shape(t), x, y, opts);
    } else {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(t, x, y, opts);
    }
  };
  const cell = (t: string, extra: any = {}) => {
    if (hasArabic && AR.test(t)) return { content: shape(t), styles: { font: 'Amiri', fontStyle: 'normal', ...extra } };
    return { content: t, styles: extra };
  };

  let W = doc.internal.pageSize.getWidth();
  let H = doc.internal.pageSize.getHeight();
  const M = 12;
  const groups = groupByCategory(rows);
  const grand = sumTotals(rows);
  const members = cover.committee.filter((m) => m.name.trim() || m.role.trim());

  // ───────────── page 1: cover ─────────────
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 34, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 34, W, 1.4, 'F');
  doc.rect(0, 0, 3.4, 34, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('INVENTORY COUNT REPORT', M + 2, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Physical count results grouped by product category', M + 2, 25);

  // info cards
  const info: [string, string][] = [
    ['Count Date', formatCoverDate(cover.countDate) || '-'],
    ['Serial Number', cover.serialNo.trim() || '-'],
    ['Store', cover.store.trim() || '-'],
  ];
  const gap = 6;
  const cw = (W - M * 2 - gap * 2) / 3;
  info.forEach(([label, value], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, 46, cw, 24, 3, 3, 'FD');
    doc.setFillColor(...GOLD);
    doc.roundedRect(x, 46, cw, 1.6, 0.8, 0.8, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    put(label.toUpperCase(), x + 5, 55, {}, true);
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    put(value, x + 5, 64, {}, true);
  });

  // committee
  doc.setFillColor(...GOLD);
  doc.roundedRect(M, 80, 1.8, 6, 0.9, 0.9, 'F');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  put('Counting Committee', M + 5, 85, {}, true);

  autoTable(doc, {
    startY: 90,
    theme: 'plain',
    margin: { left: M, right: M, bottom: 16 },
    head: [['#', 'Name', 'Role']],
    body: members.length
      ? members.map((m, i) => [String(i + 1), cell(m.name || '-'), cell(m.role || '-')])
      : [['', cell('No committee members entered'), '']],
    styles: { fontSize: 10, cellPadding: 3, textColor: TEXT, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: SOFT },
    columnStyles: { 0: { cellWidth: 14 }, 1: { fontStyle: 'bold', textColor: INK } },
    didParseCell: (d: any) => {
      if (d.section === 'body') {
        d.cell.styles.lineWidth = { bottom: 0.15 };
        d.cell.styles.lineColor = LINE;
      }
    },
  });

  // summary strip
  const sy = Math.min(doc.lastAutoTable.finalY + 12, H - 40);
  const sum: [string, string, RGB][] = [
    ['Products', String(rows.length), INK],
    ['Counted Amount', fmtMoney(grand.qtyAmount), INK],
    ['Diff Qty', fmtQty(grand.diffQty), grand.diffQty < 0 ? RED : grand.diffQty > 0 ? GREEN : INK],
    ['Diff Amount', fmtMoney(grand.diffAmount), grand.diffAmount < 0 ? RED : grand.diffAmount > 0 ? GREEN : GOLD_DARK],
  ];
  const sw = (W - M * 2 - gap * 3) / 4;
  sum.forEach(([label, value, color], i) => {
    const x = M + i * (sw + gap);
    doc.setFillColor(...GOLD_SOFT);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, sy, sw, 20, 2.5, 2.5, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    put(label.toUpperCase(), x + 4, sy + 7, {}, true);
    doc.setFontSize(13);
    doc.setTextColor(...color);
    put(value, x + 4, sy + 15.5, {}, true);
  });

  // ───────────── details (landscape) ─────────────
  doc.addPage('a4', 'l');
  W = doc.internal.pageSize.getWidth();
  H = doc.internal.pageSize.getHeight();
  const body: any[] = [];
  const colorFor = (n: number): RGB | undefined => (n < 0 ? RED : n > 0 ? GREEN : undefined);
  groups.forEach((g) => {
    body.push([
      {
        content: shape(g.category),
        colSpan: 8,
        styles: {
          halign: 'center',
          fillColor: CAT_FILL,
          textColor: INK,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: { top: 2.6, bottom: 2.6, left: 4, right: 2 },
          ...(hasArabic && AR.test(g.category) ? { font: 'Amiri', fontStyle: 'normal' } : {}),
        },
      },
    ]);
    g.rows.forEach((r) => {
      body.push([
        cell(r.barcode || '-'),
        cell(r.product),
        fmtMoney(r.cost),
        fmtQty(r.available),
        fmtQty(r.counted),
        fmtMoney(r.qtyAmount),
        cell(fmtQty(r.diffQty), { fontStyle: 'bold', ...(colorFor(r.diffQty) ? { textColor: colorFor(r.diffQty) } : {}) }),
        cell(fmtMoney(r.diffAmount), { fontStyle: 'bold', ...(colorFor(r.diffAmount) ? { textColor: colorFor(r.diffAmount) } : {}) }),
      ]);
    });
    const t = g.totals;
    const sub = { fillColor: GOLD_SOFT, textColor: INK, fontStyle: 'bold' };
    body.push([
      { content: shape(`Subtotal - ${g.category}`), colSpan: 3, styles: { ...sub, halign: 'center', ...(hasArabic && AR.test(g.category) ? { font: 'Amiri', fontStyle: 'normal' } : {}) } },
      { content: fmtQty(t.available), styles: sub },
      { content: fmtQty(t.counted), styles: sub },
      { content: fmtMoney(t.qtyAmount), styles: sub },
      { content: fmtQty(t.diffQty), styles: { ...sub, ...(colorFor(t.diffQty) ? { textColor: colorFor(t.diffQty) } : {}) } },
      { content: fmtMoney(t.diffAmount), styles: { ...sub, ...(colorFor(t.diffAmount) ? { textColor: colorFor(t.diffAmount) } : {}) } },
    ]);
  });

  autoTable(doc, {
    startY: 30,
    theme: 'plain',
    margin: { left: M, right: M, top: 30, bottom: 16 },
    head: [['Barcode', 'Product Name', 'Cost', 'Available Qty', 'Qty Count', 'Qty Amount', 'Diff Qty', 'Diff Amount']],
    body,
    foot: [[
      { content: `Grand Total (${rows.length} products)`, colSpan: 3, styles: { halign: 'center' } },
      fmtQty(grand.available),
      fmtQty(grand.counted),
      fmtMoney(grand.qtyAmount),
      fmtQty(grand.diffQty),
      fmtMoney(grand.diffAmount),
    ]],
    showFoot: 'lastPage',
    showHead: 'everyPage',
    styles: { fontSize: 8, cellPadding: 2, textColor: TEXT, halign: 'center', valign: 'middle', lineWidth: 0 },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, cellPadding: 3 },
    footStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 82 },
      2: { cellWidth: 24 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 32 },
      6: { cellWidth: 24 },
    },
    didParseCell: (d: any) => {
      if (d.section === 'body') {
        d.cell.styles.lineWidth = { bottom: 0.15 };
        d.cell.styles.lineColor = LINE;
      }
    },
    didDrawPage: (data: any) => {
      // this hook belongs to the details table only, so every page it draws gets the header band
      doc.setFillColor(...INK);
      doc.rect(0, 0, W, 20, 'F');
      doc.setFillColor(...GOLD);
      doc.rect(0, 20, W, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('INVENTORY COUNT REPORT', M, 12.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      const sub = [formatCoverDate(cover.countDate), cover.serialNo.trim() && `Serial ${cover.serialNo.trim()}`, cover.store.trim()]
        .filter(Boolean)
        .join('   |   ');
      if (sub && !AR.test(sub)) doc.text(sub, W - M, 12.5, { align: 'right' });
    },
  });

  // ───────────── signatures (end of the report) ─────────────
  const signers: { name: string; role: string }[] = [
    ...members.map((m) => ({ name: m.name.trim(), role: m.role.trim() })),
    { name: cover.ceoName.trim(), role: 'CEO' },
  ];
  const perRow = 4;
  const rowH = 30;
  const rowsNeeded = Math.ceil(signers.length / perRow);
  const blockH = 14 + rowsNeeded * rowH;
  let y = doc.lastAutoTable.finalY + 14;
  if (y + blockH > H - 14) {
    doc.addPage();
    y = 30;
  }
  doc.setFillColor(...GOLD);
  doc.roundedRect(M, y - 5, 1.8, 6, 0.9, 0.9, 'F');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  put('Approvals', M + 5, y, {}, true);
  y += 10;

  const colW = (W - M * 2) / perRow;
  signers.forEach((s, i) => {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    // centre a short last row
    const inRow = Math.min(perRow, signers.length - r * perRow);
    const offset = ((perRow - inRow) * colW) / 2;
    const cx = M + offset + c * colW + colW / 2;
    const ly = y + r * rowH + 14;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(cx - colW / 2 + 8, ly, cx + colW / 2 - 8, ly);
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    put(s.name || ' ', cx, ly + 5.5, { align: 'center' }, true);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    put(s.role || ' ', cx, ly + 10, { align: 'center' });
  });

  // footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, ph - 9, pw - M, ph - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${p} of ${pages}`, pw - M, ph - 5, { align: 'right' });
  }

  const tag = [cover.serialNo.trim(), formatCoverDate(cover.countDate).replace(/\//g, '-')].filter(Boolean).join('_');
  saveTrackedPdf(doc, `${safeName(`Inventory_Count_Report${tag ? '_' + tag : ''}`)}.pdf`);
}

export async function exportCountReportExcel(rows: CountRow[], cover: CoverInfo): Promise<void> {
  if (!rows.length) return;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Count Report', { views: [{ showGridLines: false }] });
  const members = cover.committee.filter((m) => m.name.trim() || m.role.trim());
  const groups = groupByCategory(rows);
  const grand = sumTotals(rows);

  const NUM = '#,##0.00;-#,##0.00;"-"';
  const QTY = '#,##0.##;-#,##0.##;"-"';
  const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

  ws.columns = [
    { width: 20 }, { width: 44 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 },
  ];

  ws.mergeCells('A1:H1');
  const title = ws.getCell('A1');
  title.value = 'INVENTORY COUNT REPORT';
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  title.fill = fill('FF0F172A');
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  const meta: [string, string][] = [
    ['Count Date', formatCoverDate(cover.countDate) || '-'],
    ['Serial Number', cover.serialNo.trim() || '-'],
    ['Store', cover.store.trim() || '-'],
    ['Committee', members.map((m) => [m.name, m.role && `(${m.role})`].filter(Boolean).join(' ')).join('  |  ') || '-'],
  ];
  meta.forEach(([k, v], i) => {
    const r = 2 + i;
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { bold: true, color: { argb: 'FF475569' } };
    ws.mergeCells(`B${r}:H${r}`);
    ws.getCell(`B${r}`).value = v;
    ws.getCell(`B${r}`).alignment = { horizontal: 'left', wrapText: true };
  });

  let r = 2 + meta.length + 1;
  const head = ws.getRow(r);
  ['Barcode', 'Product Name', 'Product Cost', 'Available Qty', 'QTY Count', 'QTY Amount', 'Diff QTY', 'Diff Amount'].forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill('FF0F172A');
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { bottom: { style: 'medium', color: { argb: 'FFC9A84C' } } };
  });
  head.height = 24;
  ws.views = [{ state: 'frozen', ySplit: r, showGridLines: false }];
  r++;

  const diffColor = (n: number) => (n < 0 ? 'FFB91C1C' : n > 0 ? 'FF16A34A' : 'FF334155');
  const setNums = (row: any, vals: number[], bold = false) => {
    const fmts = [NUM, QTY, QTY, NUM, QTY, NUM];
    vals.forEach((v, i) => {
      const c = row.getCell(3 + i);
      c.value = v;
      c.numFmt = fmts[i];
      c.alignment = { horizontal: 'center' };
      c.font = { bold, color: { argb: i >= 4 ? diffColor(v) : 'FF334155' } };
    });
  };

  groups.forEach((g) => {
    ws.mergeCells(`A${r}:H${r}`);
    const gc = ws.getCell(`A${r}`);
    gc.value = g.category;
    gc.font = { bold: true, color: { argb: 'FF0F172A' } };
    gc.fill = fill('FFE2E8F0');
    gc.alignment = { horizontal: 'left', indent: 1 };
    r++;
    g.rows.forEach((x) => {
      const row = ws.getRow(r);
      row.getCell(1).value = x.barcode;
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).value = x.product;
      setNums(row, [x.cost, x.available, x.counted, x.qtyAmount, x.diffQty, x.diffAmount]);
      for (let c = 1; c <= 8; c++) row.getCell(c).border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } };
      r++;
    });
    const t = g.totals;
    const row = ws.getRow(r);
    ws.mergeCells(`A${r}:B${r}`);
    row.getCell(1).value = `Subtotal - ${g.category}`;
    row.getCell(1).alignment = { horizontal: 'right' };
    setNums(row, [0, t.available, t.counted, t.qtyAmount, t.diffQty, t.diffAmount], true);
    row.getCell(3).value = null;
    for (let c = 1; c <= 8; c++) {
      row.getCell(c).fill = fill('FFFDF6DC');
      row.getCell(c).font = { ...(row.getCell(c).font || {}), bold: true };
    }
    r += 2;
  });

  const tot = ws.getRow(r);
  ws.mergeCells(`A${r}:B${r}`);
  tot.getCell(1).value = `Grand Total (${rows.length} products)`;
  tot.getCell(1).alignment = { horizontal: 'right' };
  setNums(tot, [0, grand.available, grand.counted, grand.qtyAmount, grand.diffQty, grand.diffAmount], true);
  tot.getCell(3).value = null;
  for (let c = 1; c <= 8; c++) {
    tot.getCell(c).fill = fill('FF0F172A');
    tot.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  }
  tot.height = 24;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const tag = [cover.serialNo.trim(), formatCoverDate(cover.countDate).replace(/\//g, '-')].filter(Boolean).join('_');
  saveTrackedAs(blob, `${safeName(`Inventory_Count_Report${tag ? '_' + tag : ''}`)}.xlsx`);
}
