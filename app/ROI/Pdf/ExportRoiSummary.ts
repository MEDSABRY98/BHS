'use client';

// ROI — one-page SUMMARY for a salesperson (all his customers in one table).

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';
import { PeriodLabel, bySalespersonThenCustomer } from '../Utils/RoiCalc';
import type { RoiResult } from '../Utils/Types';

type RGB = [number, number, number];
const INK: RGB = [15, 23, 42];
const TEXT: RGB = [51, 65, 85];
const GOLD: RGB = [212, 175, 55];
const GOLD_SOFT: RGB = [253, 246, 220];
const GOLD_DARK: RGB = [184, 134, 11];
const MUTED: RGB = [100, 116, 139];
const GREEN: RGB = [5, 150, 105];
const AMBER: RGB = [217, 119, 6];
const RED: RGB = [220, 38, 38];
const SOFT: RGB = [248, 250, 252];
const LINE: RGB = [226, 232, 240];

const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number | null) => (v === null || !Number.isFinite(v) ? '-' : `${v.toFixed(1)}%`);

export async function ExportRoiSummary(
  results: RoiResult[],
  opts: { title: string; subtitle?: string; fileName?: string },
): Promise<void> {
  if (!results.length) return;
  const jsPDF = (await import('jspdf')).default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc: any = new jsPDF('l', 'mm', 'a4');
  let hasArabic = true;
  try {
    await addArabicFont(doc);
  } catch {
    hasArabic = false;
  }
  const AR = /[؀-ۿ]/;
  const shape = (t: string) => {
    if (!hasArabic || !AR.test(t)) return t;
    try {
      return typeof doc.processArabic === 'function' ? doc.processArabic(t) : t;
    } catch {
      return t;
    }
  };

  const W = doc.internal.pageSize.getWidth();
  const M = 12;
  const rows = [...results].sort(bySalespersonThenCustomer);

  // header
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 24, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 24, W, 1.1, 'F');
  doc.rect(0, 0, 3.2, 24, 'F');
  if (hasArabic && AR.test(opts.title)) doc.setFont('Amiri', 'normal');
  else doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(shape(opts.title), M, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(opts.subtitle || 'ROI support summary', M, 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('ROI SUPPORT SUMMARY', W - M, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  const t = new Date();
  doc.text(`Generated ${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`, W - M, 19, { align: 'right' });

  const sum = (f: (r: RoiResult) => number) => rows.reduce((a, r) => a + f(r), 0);
  const gross = sum((r) => r.gross);
  const returns = sum((r) => r.returns);

  // ── three summary cards ──
  const cards: [string, string, RGB][] = [
    ['Customers', String(rows.length), INK],
    ['Total support (AED)', money(sum((r) => r.totalSupport)), GOLD_DARK],
    ['Net sales - last 3 months', money(sum((r) => r.net)), INK],
  ];
  const gap = 5;
  const cw = (W - M * 2 - gap * 2) / 3;
  cards.forEach(([label, value, color], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, 31, cw, 17, 2.5, 2.5, 'FD');
    doc.setFillColor(...(i === 1 ? GOLD : INK));
    doc.roundedRect(x, 31, cw, 1.5, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 4, 37.5);
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(value, x + 4, 44.5);
  });

  const body = rows.map((r, i) => [
    String(i + 1),
    shape(r.support.customerName),
    r.support.salespersonName,
    PeriodLabel(r.support),
    money(r.totalSupport),
    money(r.net),
    pct(r.returnRate),
  ]);

  autoTable(doc, {
    startY: 54,
    theme: 'plain',
    margin: { left: M, right: M, top: 30, bottom: 14 },
    head: [['#', 'Customer', 'Salesperson', 'Support Period', 'Support', 'Net Sales (3 mo)', 'Return %']],
    body,
    foot: [[
      '',
      `Total (${rows.length})`,
      '',
      '',
      money(sum((r) => r.totalSupport)),
      money(sum((r) => r.net)),
      pct(gross > 0 ? (returns / gross) * 100 : null),
    ]],
    showFoot: 'lastPage',
    styles: { fontSize: 8, cellPadding: 2, textColor: TEXT, halign: 'center', valign: 'middle', lineWidth: 0 },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 3 },
    alternateRowStyles: { fillColor: SOFT },
    footStyles: { fillColor: GOLD_SOFT, textColor: INK, fontStyle: 'bold', fontSize: 8.5, halign: 'center', cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { fontStyle: 'bold', textColor: INK, cellWidth: 80 },
      4: { fontStyle: 'bold', textColor: GOLD_DARK },
      5: { fontStyle: 'bold', textColor: INK },
    },
    didParseCell: (d: any) => {
      if (d.section === 'body') {
        d.cell.styles.lineWidth = { bottom: 0.15 };
        d.cell.styles.lineColor = LINE;
        const r = rows[d.row.index];
        if (d.column.index === 6 && r.returnRate !== null) {
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.textColor = r.returnRate >= 25 ? RED : r.returnRate >= 10 ? AMBER : GREEN;
        }
        if (d.column.index === 1 && hasArabic && AR.test(r.support.customerName)) d.cell.styles.font = 'Amiri';
        if (d.column.index === 2 && hasArabic && AR.test(r.support.salespersonName)) d.cell.styles.font = 'Amiri';
      }
    },
  });

  // signatures: sales manager, accounts department, CEO
  const H = doc.internal.pageSize.getHeight();
  // at the very bottom of the last page (a new page when the table leaves no room)
  let sy = H - 26;
  if (doc.lastAutoTable.finalY > sy - 18) {
    doc.addPage();
    sy = H - 26;
  }
  const labels = ['Sales Manager', 'Accounts Department', 'CEO'];
  const colW = (W - M * 2) / labels.length;
  doc.setFillColor(...GOLD);
  doc.roundedRect(M, sy - 13, 1.6, 5, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text('Approvals', M + 4, sy - 9);
  labels.forEach((label, i) => {
    const cx = M + colW * i + colW / 2;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(cx - 34, sy, cx + 34, sy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(label, cx, sy + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text('Name / Signature / Date', cx, sy + 9.5, { align: 'center' });
  });

  // page numbers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 5, { align: 'right' });
  }

  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim();
  saveTrackedPdf(doc, `${safe(opts.fileName || 'ROI_Summary')}.pdf`);
}
