import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { printPdfInSameTab } from './DeliveryUtils';

const DISCLAIMER_EN =
  'I, the warehouse responsible, confirm the cancellation of the invoice(s) listed above.';
const DISCLAIMER_AR =
  'أقر أنا مسؤول المستودع بإلغاء الفاتورة/الفواتير المذكورة أعلاه.';

export interface CancelInvoicePdfRow {
  invoiceId: string;
  customerName: string;
  amount: number;
  orderDate?: string;
}

export interface CancelInvoicePdfOptions {
  invoices: CancelInvoicePdfRow[];
  cancelDate?: string;
  notes?: string;
  printedBy?: string;
  action?: 'download' | 'print';
}

function formatDate(value?: string): string {
  if (!value) return new Date().toLocaleDateString('en-GB');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB');
}

function formatAmount(amount: number): string {
  return `AED ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function hasArabic(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

function drawNotesBox(
  doc: jsPDF,
  startY: number,
  margin: number,
  contentWidth: number,
  notes: string,
): number {
  const padding = 5;
  const innerWidth = contentWidth - padding * 2;
  const trimmed = notes.trim();
  const notesAreArabic = hasArabic(trimmed);

  doc.setFont('Amiri', 'normal');
  doc.setFontSize(9);
  const noteLines = doc.splitTextToSize(trimmed, innerWidth) as string[];
  const lineHeight = notesAreArabic ? 4.8 : 4.2;
  const boxHeight = padding + 5 + noteLines.length * lineHeight + padding;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(margin, startY, contentWidth, boxHeight, 2, 2, 'FD');

  let textY = startY + padding + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  const notesTitleWidth = doc.getTextWidth('Notes');
  doc.text('Notes', margin + padding, textY);
  doc.setFont('Amiri', 'normal');
  doc.text(' / ملاحظات', margin + padding + notesTitleWidth, textY);

  textY += 6;
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 55);

  if (notesAreArabic) {
    doc.text(noteLines, margin + contentWidth - padding, textY, { align: 'right', maxWidth: innerWidth });
  } else {
    doc.text(noteLines, margin + padding, textY);
  }

  return startY + boxHeight;
}

function drawDisclaimerBox(
  doc: jsPDF,
  startY: number,
  margin: number,
  contentWidth: number,
): number {
  const padding = 5;
  const innerWidth = contentWidth - padding * 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const enLines = doc.splitTextToSize(DISCLAIMER_EN, innerWidth) as string[];

  doc.setFont('Amiri', 'normal');
  doc.setFontSize(9);
  const arLines = doc.splitTextToSize(DISCLAIMER_AR, innerWidth) as string[];

  const boxHeight = padding + 5 + enLines.length * 4.2 + 3 + arLines.length * 4.8 + padding;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(margin, startY, contentWidth, boxHeight, 2, 2, 'FD');

  let textY = startY + padding + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  const disclaimerTitleWidth = doc.getTextWidth('Disclaimer');
  doc.text('Disclaimer', margin + padding, textY);
  doc.setFont('Amiri', 'normal');
  doc.text('إخلاء مسؤولية', margin + padding + disclaimerTitleWidth + 4, textY);

  textY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 55, 55);
  doc.text(enLines, margin + padding, textY);
  textY += enLines.length * 4.2 + 3;

  doc.setFont('Amiri', 'normal');
  doc.setFontSize(9);
  doc.text(arLines, margin + contentWidth - padding, textY, { align: 'right', maxWidth: innerWidth });

  return startY + boxHeight;
}

export async function generateCancelInvoicePDF({
  invoices,
  cancelDate,
  notes,
  printedBy,
  action = 'download',
}: CancelInvoicePdfOptions): Promise<void> {
  if (invoices.length === 0) {
    throw new Error('No invoices to include in cancellation form.');
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  await addArabicFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  doc.setProperties({
    title: `Invoice_Cancellation_${invoices[0].invoiceId || 'Form'}`,
  });

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  const tableData = invoices.map((inv, index) => [
    String(index + 1),
    inv.invoiceId || '-',
    inv.customerName || '-',
    formatAmount(inv.amount || 0),
  ]);

  // Header — soft red to indicate cancellation
  const headerRed: [number, number, number] = [232, 84, 84];
  doc.setFillColor(...headerRed);
  doc.rect(0, 0, pageWidth, 20, 'F');

  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  const headerTitle = 'INVOICE CANCELLATION FORM';
  doc.text(headerTitle, pageWidth / 2, 13, { align: 'center' });

  let y = 26;

  // Info bar
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 16, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Cancellation Date:', margin + 8, y + 7);
  doc.text('Total Invoices:', pageWidth - margin - 58, y + 7);
  doc.text('Total Value:', pageWidth - margin - 58, y + 13);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(cancelDate), margin + 38, y + 7);
  doc.text(String(invoices.length), pageWidth - margin - 30, y + 7);
  doc.setTextColor(185, 28, 28);
  doc.text(formatAmount(totalAmount), pageWidth - margin - 30, y + 13);

  y += 22;

  const tableOptions: any = {
    startY: y,
    head: [['#', 'Invoice No.', 'Customer Name', 'Amount']],
    body: tableData,
    foot: [['', '', 'Total', formatAmount(totalAmount)]],
    theme: 'grid',
    headStyles: {
      fillColor: headerRed,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 9,
      cellPadding: 4,
      font: 'helvetica',
    },
    bodyStyles: {
      halign: 'center',
      valign: 'middle',
      fontSize: 9,
      cellPadding: 4.5,
      font: 'helvetica',
    },
    footStyles: {
      fillColor: [245, 245, 245],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      font: 'helvetica',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 38, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 'auto', halign: 'center' },
      3: { cellWidth: 38, halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  };

  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions);

  const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
  const contentWidth = pageWidth - margin * 2;
  let sectionY = finalY + 8;

  if (notes?.trim()) {
    sectionY = drawNotesBox(doc, sectionY, margin, contentWidth, notes) + 8;
  }

  const disclaimerEndY = drawDisclaimerBox(doc, sectionY, margin, contentWidth);
  let sigY = disclaimerEndY + 14;

  const printedByName = printedBy?.trim() || '';
  const signatureBlockHeight = 34 + (printedByName ? 10 : 0);

  if (sigY + signatureBlockHeight > pageHeight - 10) {
    doc.addPage();
    sigY = 30;
  }

  const signatureWidth = 110;
  const signatureX = (pageWidth - signatureWidth) / 2;
  const signatureBoxHeight = 24;

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorized Signature', pageWidth / 2, sigY, { align: 'center' });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(signatureX, sigY + 6, signatureWidth, signatureBoxHeight, 2, 2, 'FD');

  if (printedByName) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(printedByName, pageWidth / 2, sigY + 6 + signatureBoxHeight + 8, { align: 'center' });
  }

  const filenameBase = invoices.length === 1
    ? `Cancel_Invoice_${(invoices[0].invoiceId || 'Invoice').replace(/\s+/g, '_')}`
    : `Cancel_Invoices_${formatDate(cancelDate).replace(/\//g, '-')}`;

  if (action === 'print') {
    printPdfInSameTab(doc);
  } else {
    doc.save(`${filenameBase}.pdf`);
  }
}
