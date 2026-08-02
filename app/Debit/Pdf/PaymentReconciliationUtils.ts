'use client';

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { printPdfInSameTab } from '@/app/LPOs/Pdf/DeliveryUtils';

export interface PaymentReconciliationLine {
  customerName: string;
  date: string;
  number: string;
  totalAmount: number;
  appliedAmount: number;
  openAmount: number;
  matching?: string;
}

export interface PaymentReconciliationPdfInput {
  paymentAmount: number;
  paymentDate?: string;
  paymentReference?: string;
  customers: string[];
  lines: PaymentReconciliationLine[];
  totalApplied: number;
  remainder: number;
  remainderNote?: string;
  remainderNoteAlign?: 'left' | 'right';
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RECON_COLORS = {
  emerald: [5, 150, 105] as [number, number, number],
  emeraldDark: [4, 120, 87] as [number, number, number],
  emeraldHeader: [6, 95, 70] as [number, number, number],
  emeraldBg: [236, 253, 245] as [number, number, number],
  emeraldBorder: [167, 243, 208] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  amberBg: [255, 251, 235] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  redDark: [185, 28, 28] as [number, number, number],
  redBg: [254, 242, 242] as [number, number, number],
  slate: [51, 65, 85] as [number, number, number],
  slateDark: [30, 41, 59] as [number, number, number],
  indigo: [37, 99, 235] as [number, number, number],
  indigoBg: [239, 246, 255] as [number, number, number],
};

function getOpenAmountCellStyle(openAmount: number): {
  textColor: [number, number, number];
  fillColor: [number, number, number];
} {
  if (openAmount < -0.009) {
    return { textColor: RECON_COLORS.red, fillColor: RECON_COLORS.redBg };
  }
  if (openAmount > 0.009) {
    return { textColor: RECON_COLORS.amber, fillColor: RECON_COLORS.amberBg };
  }
  return { textColor: RECON_COLORS.emerald, fillColor: RECON_COLORS.emeraldBg };
}

function getRemainderStyle(remainder: number): {
  textColor: [number, number, number];
  suffix?: string;
} {
  if (remainder < -0.009) {
    return { textColor: RECON_COLORS.red, suffix: ' (over-allocated)' };
  }
  if (remainder > 0.009) {
    return { textColor: RECON_COLORS.emeraldDark };
  }
  return { textColor: RECON_COLORS.slate };
}

const LABEL_VALUE_GAP = 2;

function drawLabelValueRow(
  doc: {
    setFont: (font: string, style: string) => void;
    setTextColor: (...args: number[]) => void;
    text: (text: string, x: number, y: number) => void;
    getTextWidth: (text: string) => number;
  },
  label: string,
  value: string,
  x: number,
  y: number,
  valueColor: [number, number, number] = [0, 0, 0],
) {
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RECON_COLORS.slate);
  doc.text(label, x, y);
  const valueX = x + doc.getTextWidth(label) + LABEL_VALUE_GAP;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...valueColor);
  doc.text(value, valueX, y);
}

const PDF_FOOTER_RESERVE = 16;

function getContentBottom(doc: { internal: { pageSize: { getHeight: () => number } } }): number {
  return doc.internal.pageSize.getHeight() - PDF_FOOTER_RESERVE;
}

function ensurePdfSpace(
  doc: { addPage: () => void; internal: { pageSize: { getHeight: () => number } } },
  y: number,
  requiredHeight: number,
  topOnNewPage: number,
): number {
  if (y + requiredHeight <= getContentBottom(doc)) return y;
  doc.addPage();
  return topOnNewPage;
}

function drawRemainderNoteSection(
  doc: any,
  input: PaymentReconciliationPdfInput,
  startY: number,
  margin: number,
  usableWidth: number,
  pageWidth: number,
  topOnNewPage: number,
): number {
  const noteText = input.remainderNote?.trim();
  if (!noteText) return startY;

  doc.setFont('Amiri', 'normal');
  doc.setFontSize(9);
  const noteLines = doc.splitTextToSize(noteText, usableWidth - 8) as string[];
  const lineHeight = 5;
  const headerHeight = 8;
  const boxPadding = 4;

  let y = startY;
  let lineIndex = 0;
  let isFirstChunk = true;

  while (lineIndex < noteLines.length) {
    const minChunkHeight = headerHeight + lineHeight + boxPadding * 2;
    y = ensurePdfSpace(doc, y, minChunkHeight, topOnNewPage);

    const availableHeight = getContentBottom(doc) - y;
    const maxLines = Math.max(
      1,
      Math.floor((availableHeight - headerHeight - boxPadding * 2) / lineHeight),
    );
    const chunk = noteLines.slice(lineIndex, lineIndex + maxLines);
    const boxHeight = headerHeight + chunk.length * lineHeight + boxPadding * 2;

    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, usableWidth, boxHeight, 2, 2, 'FD');

    if (isFirstChunk) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...RECON_COLORS.amber);
      doc.text('Remainder Note:', margin + boxPadding, y + boxPadding + 3);
      isFirstChunk = false;
    }

    doc.setFont('Amiri', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(68, 64, 60);
    const alignRight = input.remainderNoteAlign === 'right';
    const textX = alignRight ? margin + usableWidth - boxPadding : margin + boxPadding;
    doc.text(chunk, textX, y + headerHeight + boxPadding, {
      align: alignRight ? 'right' : 'left',
    });

    lineIndex += chunk.length;
    y += boxHeight + 6;

    if (lineIndex < noteLines.length) {
      doc.addPage();
      y = topOnNewPage;
    }
  }

  return y;
}

function buildNoCustomerColumnStyles(tableWidth: number, isPortrait: boolean) {
  const rowNumShare = isPortrait ? 8 : tableWidth * 0.05;
  const invoiceShare = isPortrait ? Math.round(tableWidth * 0.32) : tableWidth * 0.28;
  const equalWidth = (tableWidth - rowNumShare - invoiceShare) / 5;

  return {
    0: { cellWidth: rowNumShare, halign: 'center' as const },
    1: { cellWidth: equalWidth, halign: 'center' as const },
    2: {
      cellWidth: invoiceShare,
      font: 'Amiri',
      halign: 'center' as const,
      overflow: 'linebreak' as const,
    },
    3: { cellWidth: equalWidth, halign: 'center' as const, fontStyle: 'bold' as const },
    4: { cellWidth: equalWidth, halign: 'center' as const, fontStyle: 'bold' as const },
    5: { cellWidth: equalWidth, halign: 'center' as const, fontStyle: 'bold' as const },
    6: {
      cellWidth: equalWidth,
      halign: 'center' as const,
      overflow: 'linebreak' as const,
    },
  };
}

export async function generatePaymentReconciliationPDF(
  input: PaymentReconciliationPdfInput,
  options?: { print?: boolean; download?: boolean },
): Promise<void> {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: 'Payment Reconciliation Memo' });

  try {
    await addArabicFont(doc);
  } catch (e) {
    console.error('Failed to load Arabic font:', e);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isPortrait = pageWidth < pageHeight;
  const margin = isPortrait ? 10 : 15;
  const tableMargin = isPortrait ? 5 : 12;
  const tableWidth = pageWidth - tableMargin * 2;
  let yPosition = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RECON_COLORS.slateDark);
  doc.text('Payment Reconciliation Memo', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;
  doc.setDrawColor(...RECON_COLORS.emeraldBorder);
  doc.setLineWidth(0.6);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 7;

  doc.setFontSize(12);
  doc.setTextColor(...RECON_COLORS.emeraldDark);
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, {
    align: 'center',
  });
  doc.setTextColor(0, 0, 0);
  yPosition += 10;

  doc.setFontSize(11);
  drawLabelValueRow(
    doc,
    'Payment Amount:',
    `${formatMoney(input.paymentAmount)} AED`,
    margin,
    yPosition,
    RECON_COLORS.emeraldDark,
  );
  yPosition += 6;

  if (input.paymentDate) {
    drawLabelValueRow(
      doc,
      'Reconcile Date:',
      formatDisplayDate(input.paymentDate),
      margin,
      yPosition,
    );
    yPosition += 6;
  }

  if (input.paymentReference?.trim()) {
    drawLabelValueRow(
      doc,
      'Reference:',
      input.paymentReference.trim(),
      margin,
      yPosition,
    );
    yPosition += 6;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RECON_COLORS.slate);
  doc.text(input.customers.length === 1 ? 'Customer:' : 'Customers:', margin, yPosition);
  yPosition += 6;

  doc.setFont('Amiri', 'normal');
  doc.setTextColor(0, 0, 0);
  const customersBlockWidth = pageWidth - margin * 2;
  const customerLineHeight = 5;

  if (input.customers.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('-', margin, yPosition);
    yPosition += customerLineHeight;
  } else {
    for (const customer of input.customers) {
      const name = (customer || '').trim();
      if (!name) continue;

      doc.setFont('Amiri', 'normal');
      const nameLines = doc.splitTextToSize(name, customersBlockWidth);
      doc.text(nameLines, margin, yPosition);
      yPosition += nameLines.length * customerLineHeight + 1;
    }
  }

  yPosition += 2;

  const usableWidth = pageWidth - margin * 2;
  const sectionTopOnNewPage = tableMargin + 10;

  const showCustomerColumn = input.customers.length > 1;

  const buildTableRow = (line: PaymentReconciliationLine, index: number) => {
    const row = [
      String(index + 1),
      formatDisplayDate(line.date),
      (line.number || '').split(' ')[0],
      line.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      line.appliedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      line.openAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      line.matching || '-',
    ];
    if (showCustomerColumn) {
      row.splice(1, 0, line.customerName);
    }
    return row;
  };

  const tableHead = showCustomerColumn
    ? ['#', 'Customer', 'Date', 'Invoice', 'Total Amount', 'Applied', 'Open Amount', 'Matching']
    : ['#', 'Date', 'Invoice', 'Total Amount', 'Applied', 'Open Amount', 'Matching'];

  const colTotal = showCustomerColumn ? 4 : 3;
  const colApplied = showCustomerColumn ? 5 : 4;
  const colOpen = showCustomerColumn ? 6 : 5;
  const colMatching = showCustomerColumn ? 7 : 6;

  const portraitFixedWidth = 7 + 50 + 24 + 38 + 21 + 21 + 21;

  const portraitColumnStyles = showCustomerColumn
    ? {
        0: { cellWidth: 7, halign: 'center' as const },
        1: { cellWidth: 50, font: 'Amiri', halign: 'center' as const, overflow: 'linebreak' as const },
        2: { cellWidth: 24, halign: 'center' as const },
        3: { cellWidth: 38, font: 'Amiri', halign: 'center' as const, overflow: 'linebreak' as const },
        4: { cellWidth: 21, halign: 'center' as const, fontStyle: 'bold' as const },
        5: { cellWidth: 21, halign: 'center' as const, fontStyle: 'bold' as const },
        6: { cellWidth: 21, halign: 'center' as const, fontStyle: 'bold' as const },
        7: {
          cellWidth: tableWidth - portraitFixedWidth,
          halign: 'center' as const,
          overflow: 'linebreak' as const,
        },
      }
    : buildNoCustomerColumnStyles(tableWidth, true);

  const landscapeColumnStyles = showCustomerColumn
    ? {
        0: { cellWidth: tableWidth * 0.04, halign: 'center' as const },
        1: { cellWidth: tableWidth * 0.24, font: 'Amiri', halign: 'center' as const, overflow: 'linebreak' as const },
        2: { cellWidth: tableWidth * 0.09, halign: 'center' as const },
        3: { cellWidth: tableWidth * 0.18, font: 'Amiri', halign: 'center' as const, overflow: 'linebreak' as const },
        4: { cellWidth: tableWidth * 0.11, halign: 'center' as const, fontStyle: 'bold' as const },
        5: { cellWidth: tableWidth * 0.11, halign: 'center' as const, fontStyle: 'bold' as const },
        6: { cellWidth: tableWidth * 0.11, halign: 'center' as const, fontStyle: 'bold' as const },
        7: { cellWidth: tableWidth * 0.12, halign: 'center' as const, overflow: 'linebreak' as const },
      }
    : buildNoCustomerColumnStyles(tableWidth, false);

  const sumTotalAmount = input.lines.reduce((sum, line) => sum + line.totalAmount, 0);
  const sumAppliedAmount = input.lines.reduce((sum, line) => sum + line.appliedAmount, 0);
  const sumOpenAmount = input.lines.reduce((sum, line) => sum + line.openAmount, 0);

  const tableData = input.lines.map((line, index) => buildTableRow(line, index));

  const tableFootRow = [
    '',
    'TOTAL',
    '',
    formatMoney(sumTotalAmount),
    formatMoney(sumAppliedAmount),
    formatMoney(sumOpenAmount),
    '',
  ];
  if (showCustomerColumn) {
    tableFootRow.splice(2, 0, '');
  }

  const tableFoot = [tableFootRow];

  const tableOptions = {
    startY: yPosition,
    tableWidth,
    margin: { left: tableMargin, right: tableMargin, bottom: PDF_FOOTER_RESERVE },
    head: [tableHead],
    body: tableData,
    foot: tableFoot,
    theme: 'plain' as const,
    styles: {
      font: 'helvetica',
      fontStyle: 'normal',
      valign: 'middle',
      halign: 'center',
      overflow: 'visible',
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      cellPadding: isPortrait ? 2.2 : 2,
    },
    headStyles: {
      fillColor: RECON_COLORS.emeraldHeader,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: isPortrait ? 8 : 9,
      halign: 'center',
      minCellHeight: isPortrait ? 8 : 7,
    },
    bodyStyles: {
      fontSize: isPortrait ? 8 : 8,
      halign: 'center',
      textColor: [30, 41, 59],
      minCellHeight: isPortrait ? 7.5 : 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      fontSize: isPortrait ? 8 : 9,
      halign: 'center',
      minCellHeight: isPortrait ? 8 : 7,
    },
    columnStyles: isPortrait ? portraitColumnStyles : landscapeColumnStyles,
    didParseCell: (data: {
      section: string;
      row: { index: number };
      column: { index: number };
      cell: { styles: Record<string, unknown>; text?: string | string[]; width?: number };
    }) => {
      if (data.section === 'head') {
        if (data.column.index === colApplied) {
          data.cell.styles.fillColor = [29, 78, 216];
        }
        if (data.column.index === colOpen) {
          data.cell.styles.fillColor = RECON_COLORS.emeraldDark;
        }
        if (data.column.index === colMatching) {
          data.cell.styles.overflow = 'visible';
          data.cell.styles.fontSize = isPortrait ? 7.5 : 8;
          data.cell.text = ['Matching'];
        }
        return;
      }

      if (data.section === 'body' && data.column.index === colMatching) {
        data.cell.styles.overflow = 'linebreak';
      }

      if (data.section === 'foot') {
        if (data.column.index === colTotal) {
          data.cell.styles.textColor = RECON_COLORS.slateDark;
        }
        if (data.column.index === colApplied) {
          data.cell.styles.textColor = RECON_COLORS.indigo;
          data.cell.styles.fillColor = RECON_COLORS.indigoBg;
        }
        if (data.column.index === colOpen) {
          const openStyle = getOpenAmountCellStyle(sumOpenAmount);
          data.cell.styles.textColor = openStyle.textColor;
          data.cell.styles.fillColor = openStyle.fillColor;
        }
        return;
      }

      if (data.section !== 'body') return;

      const line = input.lines[data.row.index];
      if (!line) return;

      if (data.column.index === colTotal) {
        data.cell.styles.textColor = RECON_COLORS.slateDark;
      }

      if (data.column.index === colApplied) {
        data.cell.styles.textColor = RECON_COLORS.indigo;
        data.cell.styles.fillColor = RECON_COLORS.indigoBg;
      }

      if (data.column.index === colOpen) {
        const openStyle = getOpenAmountCellStyle(line.openAmount);
        data.cell.styles.textColor = openStyle.textColor;
        data.cell.styles.fillColor = openStyle.fillColor;
      }
    },
  };

  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions as any);
  }

  let finalY = (doc as any).lastAutoTable?.finalY || yPosition + 40;
  finalY += 6;

  const summaryBoxHeight = isPortrait ? 32 : 20;
  finalY = ensurePdfSpace(doc, finalY, summaryBoxHeight + 6, sectionTopOnNewPage);

  doc.setFillColor(...RECON_COLORS.emeraldBg);
  doc.setDrawColor(...RECON_COLORS.emeraldBorder);
  doc.setLineWidth(0.4);
  doc.roundedRect(tableMargin, finalY, tableWidth, summaryBoxHeight, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RECON_COLORS.emeraldHeader);
  doc.text('Summary', tableMargin + 4, finalY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...RECON_COLORS.slateDark);
  doc.text(`Payment: ${formatMoney(input.paymentAmount)} AED`, tableMargin + 4, finalY + 13);

  doc.setTextColor(...RECON_COLORS.indigo);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Applied: ${formatMoney(input.totalApplied)} AED`,
    tableMargin + 4,
    finalY + (isPortrait ? 20 : 13),
  );

  const remainderStyle = getRemainderStyle(input.remainder);
  doc.setTextColor(...remainderStyle.textColor);
  const remainderLabel = `Remainder: ${formatMoney(input.remainder)} AED${remainderStyle.suffix || ''}`;
  if (isPortrait) {
    const remainderLines = doc.splitTextToSize(remainderLabel, tableWidth - 8) as string[];
    doc.text(remainderLines, tableMargin + 4, finalY + 27);
  } else {
    const remainderLines = doc.splitTextToSize(remainderLabel, tableWidth / 2 - 8) as string[];
    doc.text(remainderLines, tableMargin + 140, finalY + 13);
  }

  finalY += summaryBoxHeight + 6;

  finalY = drawRemainderNoteSection(
    doc,
    input,
    finalY,
    tableMargin,
    tableWidth,
    pageWidth,
    sectionTopOnNewPage,
  );

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Page ${i} of ${totalPages}`,
      margin,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  if (options?.print) {
    printPdfInSameTab(doc);
  } else {
    const dateLabel = new Date().toISOString().split('T')[0];
    doc.save(`Payment_Reconciliation_${dateLabel}.pdf`);
  }
}
