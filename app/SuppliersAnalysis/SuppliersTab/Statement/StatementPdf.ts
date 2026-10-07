'use client';

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';
import { SupplierStatementRow, formatStatementDate, safeFileName } from './StatementData';

// Same visual identity as the Debit (customers) statement
const COLORS = {
  gold: [184, 134, 11],
  goldLight: [244, 233, 216],
  black: [26, 26, 26],
  gray: [107, 107, 107],
  lightGray: [245, 245, 245],
  white: [255, 255, 255],
  borderGray: [217, 217, 217],
};

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function drawHeader(doc: any, supplierName: string, rows: SupplierStatementRow[], margin: number, pageWidth: number) {
  let y = 15;
  const contentWidth = pageWidth - margin * 2;

  doc.setDrawColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.setLineWidth(0.7);
  doc.line(margin, y + 4, margin + contentWidth, y + 4);
  y += 15;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text('STATEMENT OF ACCOUNT', margin, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.text('Al Marai Al Arabia Trading', margin, y);
  const subW = doc.getTextWidth('Al Marai Al Arabia Trading');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text('| Sole Proprietorship L.L.C', margin + subW + 1.5, y);
  y += 3;

  const panelHeight = 25;
  const leftWidth = contentWidth * 0.68;

  doc.setFillColor(COLORS.goldLight[0], COLORS.goldLight[1], COLORS.goldLight[2]);
  doc.rect(margin, y, leftWidth, panelHeight, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text('SUPPLIER NAME', margin + 5, y + 6);

  doc.setFont('Amiri', 'bold');
  let fontSize = 14;
  doc.setFontSize(fontSize);
  while (doc.getTextWidth(supplierName) > leftWidth - 10 && fontSize > 6) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text(supplierName, margin + 5, y + 14);

  const metaX = margin + leftWidth + 5;
  const today = formatStatementDate(new Date());
  const lastDated = [...rows].reverse().find(r => r.date);
  const balanceAsOf = lastDated ? formatStatementDate(lastDated.date) : today;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text('STATEMENT DATE', metaX, y + 8);
  doc.text('BALANCE AS OF', metaX, y + 15);
  doc.text('CURRENCY', metaX, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text(today, metaX + 35, y + 8);
  doc.text(balanceAsOf, metaX + 35, y + 15);
  doc.text('AED', metaX + 35, y + 22);

  y += panelHeight + 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text('TRANSACTION DETAILS', margin, y);
  y += 4;
  return y;
}

function drawFooter(doc: any, count: number, total: number, startY: number, margin: number, pageWidth: number) {
  const contentWidth = pageWidth - margin * 2;
  const leftWidth = contentWidth * 0.65;
  const rightWidth = contentWidth * 0.35;
  const panelHeight = 22;

  if (startY + panelHeight + 15 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    startY = 20;
  }
  let y = startY + 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text(`${count} transactions listed above`, margin, y + 4);
  doc.text('For any queries regarding this statement, please contact:', margin, y + 9);

  doc.setDrawColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.setLineWidth(0.4);
  const iconX = margin;
  const iconY = y + 13;
  doc.rect(iconX, iconY, 4, 3);
  doc.line(iconX, iconY, iconX + 2, iconY + 1.5);
  doc.line(iconX + 4, iconY, iconX + 2, iconY + 1.5);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text('accounting@marae.ae', margin + 6, y + 16);

  const rightX = margin + leftWidth;
  doc.setFillColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.rect(rightX, y, rightWidth, panelHeight, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.text('TOTAL BALANCE (AED)', rightX + rightWidth - 5, y + 7, { align: 'right' });

  doc.setFontSize(16);
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.text(fmt(total), rightX + rightWidth - 5, y + 16, { align: 'right' });

  y += panelHeight + 15;
  doc.setDrawColor(COLORS.borderGray[0], COLORS.borderGray[1], COLORS.borderGray[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text('This is a computer-generated statement and does not require a signature.', pageWidth / 2, y + 5, { align: 'center' });
}

function addPageNumbers(doc: any, pageWidth: number, margin: number) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    doc.text(`Page ${i} of ${total}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  }
}

export async function generateSupplierStatementPDF(supplierName: string, rows: SupplierStatementRow[]) {
  const jsPDF = (await import('jspdf')).default;
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `Statement_${supplierName}` });
  await addArabicFont(doc);

  const margin = 8;
  const pageWidth = doc.internal.pageSize.getWidth();

  const startY = drawHeader(doc, supplierName, rows, margin, pageWidth);

  const body = rows.map(r => [
    formatStatementDate(r.date),
    r.number,
    r.reference,
    fmt(r.debit),
    fmt(r.credit),
    fmt(r.net),
  ]);

  const tableOptions = {
    startY,
    margin: { left: margin, right: margin, bottom: 20 },
    head: [['DATE', 'NUMBER', 'REFERENCE', 'DEBIT', 'CREDIT', 'NET BALANCE']],
    body,
    theme: 'plain' as const,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      valign: 'middle',
      halign: 'center',
      cellPadding: 3,
      lineColor: COLORS.borderGray,
      lineWidth: { top: 0.3, bottom: 0.3, left: 0, right: 0 },
    },
    headStyles: {
      fillColor: COLORS.black,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { font: 'Amiri', cellWidth: 38 },
      2: { font: 'Amiri', cellWidth: 38 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 36, fontStyle: 'bold' },
    },
    didParseCell: (data: any) => {
      if (data.section === 'head') return;
      data.cell.styles.fillColor = data.row.index % 2 === 1 ? COLORS.lightGray : COLORS.white;
    },
  };

  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions as any);
  }

  const finalY = (doc as any).lastAutoTable?.finalY || startY + 10;
  const total = rows.reduce((s, r) => s + r.net, 0);

  drawFooter(doc, rows.length, total, finalY, margin, pageWidth);
  addPageNumbers(doc, pageWidth, margin);

  saveTrackedPdf(doc, `${safeFileName(supplierName)}_Statement.pdf`);
}
