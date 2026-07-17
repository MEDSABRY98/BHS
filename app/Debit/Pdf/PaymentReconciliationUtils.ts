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

export async function generatePaymentReconciliationPDF(
  input: PaymentReconciliationPdfInput,
  options?: { print?: boolean; download?: boolean },
): Promise<void> {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('l', 'mm', 'a4');
  doc.setProperties({ title: 'Payment Reconciliation Memo' });

  try {
    await addArabicFont(doc);
  } catch (e) {
    console.error('Failed to load Arabic font:', e);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
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
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RECON_COLORS.slate);
  doc.text('Payment Amount:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...RECON_COLORS.emeraldDark);
  doc.text(`${formatMoney(input.paymentAmount)} AED`, margin + 38, yPosition);
  yPosition += 6;

  if (input.paymentDate) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RECON_COLORS.slate);
    doc.text('Reconcile Date:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(formatDisplayDate(input.paymentDate), margin + 32, yPosition);
    yPosition += 6;
  }

  if (input.paymentReference?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RECON_COLORS.slate);
    doc.text('Reference:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(input.paymentReference.trim(), margin + 26, yPosition);
    yPosition += 6;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RECON_COLORS.slate);
  doc.text('Customers:', margin, yPosition);
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

  const now = new Date();
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${formatDisplayDate(now.toISOString())}`,
    margin,
    yPosition,
  );
  yPosition += 8;

  const usableWidth = pageWidth - margin * 2;

  const tableData = input.lines.map((line, index) => [
    String(index + 1),
    line.customerName,
    formatDisplayDate(line.date),
    (line.number || '').split(' ')[0],
    line.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    line.appliedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    line.openAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    line.matching || '-',
  ]);

  const tableOptions = {
    startY: yPosition,
    tableWidth: usableWidth,
    margin: { left: margin, right: margin },
    head: [['#', 'Customer', 'Date', 'Invoice', 'Total Amount', 'Applied', 'Open Amount', 'Matching']],
    body: tableData,
    theme: 'plain' as const,
    styles: { font: 'helvetica', fontStyle: 'normal', valign: 'middle', halign: 'center', overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: {
      fillColor: RECON_COLORS.emeraldHeader,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: { fontSize: 8, halign: 'center', textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: usableWidth * 0.04, halign: 'center' },
      1: { cellWidth: usableWidth * 0.24, font: 'Amiri', halign: 'center' },
      2: { cellWidth: usableWidth * 0.09, halign: 'center' },
      3: { cellWidth: usableWidth * 0.18, font: 'Amiri', halign: 'center' },
      4: { cellWidth: usableWidth * 0.11, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: usableWidth * 0.11, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: usableWidth * 0.11, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: usableWidth * 0.12, halign: 'center' },
    },
    didParseCell: (data: {
      section: string;
      row: { index: number };
      column: { index: number };
      cell: { styles: Record<string, unknown> };
    }) => {
      if (data.section === 'head') {
        if (data.column.index === 5) {
          data.cell.styles.fillColor = [29, 78, 216];
        }
        if (data.column.index === 6) {
          data.cell.styles.fillColor = RECON_COLORS.emeraldDark;
        }
        return;
      }

      if (data.section !== 'body') return;

      const line = input.lines[data.row.index];
      if (!line) return;

      if (data.column.index === 4) {
        data.cell.styles.textColor = RECON_COLORS.slateDark;
      }

      if (data.column.index === 5) {
        data.cell.styles.textColor = RECON_COLORS.indigo;
        data.cell.styles.fillColor = RECON_COLORS.indigoBg;
      }

      if (data.column.index === 6) {
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
  finalY += 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...RECON_COLORS.slate);
  doc.text('Open Amount:', margin, finalY);
  doc.setTextColor(...RECON_COLORS.emerald);
  doc.text('Closed', margin + 22, finalY);
  doc.setTextColor(...RECON_COLORS.amber);
  doc.text('| Partial', margin + 36, finalY);
  doc.setTextColor(...RECON_COLORS.red);
  doc.text('| Over-applied', margin + 52, finalY);
  finalY += 6;

  const summaryBoxHeight = input.remainderNote?.trim() ? 22 : 18;
  doc.setFillColor(...RECON_COLORS.emeraldBg);
  doc.setDrawColor(...RECON_COLORS.emeraldBorder);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, finalY, usableWidth, summaryBoxHeight, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RECON_COLORS.emeraldHeader);
  doc.text('Summary', margin + 4, finalY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...RECON_COLORS.slateDark);
  doc.text(`Payment: ${formatMoney(input.paymentAmount)} AED`, margin + 4, finalY + 12);

  doc.setTextColor(...RECON_COLORS.indigo);
  doc.setFont('helvetica', 'bold');
  doc.text(`Applied: ${formatMoney(input.totalApplied)} AED`, margin + 62, finalY + 12);

  const remainderStyle = getRemainderStyle(input.remainder);
  doc.setTextColor(...remainderStyle.textColor);
  doc.text(
    `Remainder: ${formatMoney(input.remainder)} AED${remainderStyle.suffix || ''}`,
    margin + 122,
    finalY + 12,
  );

  finalY += summaryBoxHeight + 6;

  if (input.remainderNote?.trim()) {
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    const noteText = input.remainderNote.trim();
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(noteText, pageWidth - margin * 2 - 8);
    const noteBoxHeight = noteLines.length * 5 + 10;
    doc.roundedRect(margin, finalY, usableWidth, noteBoxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...RECON_COLORS.amber);
    doc.text('Remainder Note:', margin + 4, finalY + 6);

    doc.setFont('Amiri', 'normal');
    doc.setTextColor(68, 64, 60);
    doc.text(noteLines, margin + 4, finalY + 12);
    finalY += noteBoxHeight + 4;
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${totalPages}`, margin, doc.internal.pageSize.getHeight() - 10);
  }

  if (options?.print) {
    printPdfInSameTab(doc);
  } else {
    const dateLabel = new Date().toISOString().split('T')[0];
    doc.save(`Payment_Reconciliation_${dateLabel}.pdf`);
  }
}
