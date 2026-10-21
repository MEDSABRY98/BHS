'use client';

// Intercompany Reconciliation form — the analysis PDF (same look as the old Intercompany module).

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { formatAmount, formatDate, round2, type IntercompanyLine } from './IntercompanyTypes';

const COLORS = {
  gold: [184, 134, 11] as [number, number, number],
  goldLight: [244, 233, 216] as [number, number, number],
  black: [26, 26, 26] as [number, number, number],
  gray: [107, 107, 107] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [217, 217, 217] as [number, number, number],
  amber: [180, 83, 9] as [number, number, number],
  amberBg: [254, 243, 199] as [number, number, number],
  green: [4, 120, 87] as [number, number, number],
  red: [190, 18, 60] as [number, number, number],
};

export interface IntercompanyPdfOptions {
  dateFrom?: string;
  dateTo?: string;
}

function drawHeader(doc: any, rows: IntercompanyLine[], opts: IntercompanyPdfOptions, margin: number, pageWidth: number): number {
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.7);
  doc.line(margin, y, margin + contentWidth, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.black);
  doc.text('INTERCOMPANY RECONCILIATION', margin, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text('ALMARAI ALARABIA TRADING', margin, y);

  // Same row, right side: PERIOD …
  const dates = rows.map((r) => r.ENTRY_DATE).sort();
  const from = opts.dateFrom || dates[0] || '';
  const to = opts.dateTo || dates[dates.length - 1] || '';
  const parts: [string, string][] = [
    ['PERIOD', from || to ? `${formatDate(from)}  to  ${formatDate(to)}` : '-'],
  ];
  let x = margin + contentWidth;
  for (let k = parts.length - 1; k >= 0; k--) {
    const [label, value] = parts[k];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.black);
    doc.text(value, x, y, { align: 'right' });
    x -= doc.getTextWidth(value) + 2;
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.gray);
    doc.text(label, x, y, { align: 'right' });
    x -= doc.getTextWidth(label) + 8;
  }
  y += 6;

  // Totals
  let debit = 0;
  let credit = 0;
  for (const r of rows) {
    debit += r.DEBIT;
    credit += r.CREDIT;
  }
  const boxes: [string, string, [number, number, number]][] = [
    ['TOTAL DEBIT', formatAmount(round2(debit)), COLORS.green],
    ['TOTAL CREDIT', formatAmount(round2(credit)), COLORS.red],
    ['BALANCE', formatAmount(round2(debit - credit)), COLORS.black],
  ];
  const gap = 4;
  const boxW = (contentWidth - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach(([label, value, color], i) => {
    const x = margin + i * (boxW + gap);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.rect(x, y, boxW, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.gray);
    doc.text(label, x + 4, y + 5.5);
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(value, x + 4, y + 12);
  });
  return y + 15 + 6;
}

/** Approval signatures at the bottom of the last page (a new page when the table leaves no room). */
function drawSignatures(doc: any, pageWidth: number, margin: number) {
  const h = doc.internal.pageSize.getHeight();
  const lineY = h - 26;
  const finalY = doc.lastAutoTable?.finalY ?? 0;
  if (finalY > lineY - 24) doc.addPage();

  const labels = ['Accounts Department', 'CEO'];
  const colW = (pageWidth - margin * 2) / labels.length;

  doc.setFillColor(...COLORS.gold);
  doc.rect(margin, lineY - 17, 1.6, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  doc.text('Approvals', margin + 4, lineY - 13);

  labels.forEach((label, i) => {
    const cx = margin + colW * i + colW / 2;
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.3);
    doc.line(cx - 40, lineY, cx + 40, lineY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.black);
    doc.text(label, cx, lineY + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text('Name / Signature / Date', cx, lineY + 9.5, { align: 'center' });
  });
}

function addPageNumbers(doc: any, pageWidth: number, margin: number) {
  const total = doc.getNumberOfPages();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text(`Page ${i} of ${total}`, pageWidth - margin, h - 7, { align: 'right' });
  }
}

export async function exportIntercompanyPdf(rows: IntercompanyLine[], opts: IntercompanyPdfOptions = {}) {
  const jsPDF = (await import('jspdf')).default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('l', 'mm', 'a4');
  doc.setProperties({ title: 'Intercompany Reconciliation' });
  await addArabicFont(doc);

  const margin = 8;
  const pageWidth = doc.internal.pageSize.getWidth();
  const startY = drawHeader(doc, rows, opts, margin, pageWidth);

  const MISSING = 'MISSING';
  const body = rows.map((r, i) => [
    String(i + 1),
    formatDate(r.ENTRY_DATE),
    r.ACCOUNT_NAME || '-',
    r.AIN_ENTRY_NUMBER || MISSING,
    r.DUBAI_ENTRY_NUMBER || MISSING,
    r.LABEL || '-',
    r.DEBIT ? formatAmount(r.DEBIT) : '-',
    r.CREDIT ? formatAmount(r.CREDIT) : '-',
  ]);

  const totalDebit = round2(rows.reduce((s, r) => s + r.DEBIT, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.CREDIT, 0));

  const tableOptions = {
    startY,
    margin: { left: margin, right: margin, bottom: 14 },
    head: [['#', 'DATE', 'ACCOUNT', 'AL AIN ENTRY', 'DUBAI ENTRY', 'LABEL', 'DEBIT', 'CREDIT']],
    body,
    foot: [['', '', '', '', '', 'TOTAL', formatAmount(totalDebit), formatAmount(totalCredit)]],
    showFoot: 'lastPage',
    theme: 'plain' as const,
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      valign: 'middle',
      halign: 'center',
      cellPadding: 2.4,
      lineColor: COLORS.border,
      lineWidth: { top: 0.2, bottom: 0.2, left: 0, right: 0 },
      overflow: 'linebreak',
    },
    headStyles: { fillColor: COLORS.black, textColor: COLORS.gold, fontStyle: 'bold', fontSize: 8.5, lineWidth: 0 },
    footStyles: { fillColor: COLORS.black, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9, lineWidth: 0 },
    columnStyles: {
      0: { cellWidth: 10, textColor: COLORS.gray },
      1: { cellWidth: 22 },
      2: { cellWidth: 40, font: 'Amiri' },
      3: { cellWidth: 30, fontStyle: 'bold' },
      4: { cellWidth: 30, fontStyle: 'bold' },
      5: { font: 'Amiri' },
      6: { cellWidth: 28, textColor: COLORS.green, fontStyle: 'bold' },
      7: { cellWidth: 28, textColor: COLORS.red, fontStyle: 'bold' },
    },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      data.cell.styles.fillColor = data.row.index % 2 === 1 ? COLORS.lightGray : COLORS.white;
      if ((data.column.index === 3 || data.column.index === 4) && data.cell.raw === MISSING) {
        data.cell.styles.textColor = COLORS.amber;
        data.cell.styles.fontSize = 7;
      }
    },
  };

  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions as any);

  drawSignatures(doc, pageWidth, margin);
  addPageNumbers(doc, pageWidth, margin);
  saveTrackedPdf(doc, `Intercompany_Reconciliation_${new Date().toISOString().slice(0, 10)}.pdf`);
}
