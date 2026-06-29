import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { printPdfInSameTab } from './DeliveryUtils';

const DISCLAIMER_EN =
  'I, the warehouse responsible, confirm that I received the goods for this invoice and request its cancellation.';
const DISCLAIMER_AR =
  'أقر أنا مسؤول المستودع أنني استلمت البضاعة الخاصة بهذه الفاتورة وأرغب في إلغائها.';

export interface CancelInvoicePdfRow {
  invoiceId: string;
  customerName: string;
  amount: number;
  orderDate?: string;
}

export interface CancelInvoicePdfOptions {
  invoices: CancelInvoicePdfRow[];
  cancelDate?: string;
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

  // Header
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, 20, 'F');

  doc.setFontSize(14);
  doc.setTextColor(212, 175, 55);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE CANCELLATION FORM', pageWidth / 2, 13, { align: 'center' });

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
  doc.setTextColor(212, 175, 55);
  doc.text(formatAmount(totalAmount), pageWidth - margin - 30, y + 13);

  y += 22;

  const tableOptions: any = {
    startY: y,
    head: [['#', 'Invoice No.', 'Customer Name', 'Amount']],
    body: tableData,
    foot: [['', '', 'Total', formatAmount(totalAmount)]],
    theme: 'grid',
    headStyles: {
      fillColor: [10, 10, 10],
      textColor: [212, 175, 55],
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
  const disclaimerEndY = drawDisclaimerBox(doc, finalY + 8, margin, contentWidth);
  let sigY = disclaimerEndY + 14;

  if (sigY + 44 > pageHeight - 10) {
    doc.addPage();
    sigY = 30;
  }

  const signatureWidth = 110;
  const signatureX = (pageWidth - signatureWidth) / 2;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorized Signature', pageWidth / 2, sigY, { align: 'center' });

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(signatureX, sigY + 8, signatureWidth, 22, 2, 2, 'FD');

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(signatureX + 8, sigY + 26, signatureX + signatureWidth - 8, sigY + 26);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Name:', signatureX, sigY + 36);
  doc.line(signatureX + 14, sigY + 36.5, signatureX + signatureWidth, sigY + 36.5);

  const filenameBase = invoices.length === 1
    ? `Cancel_${(invoices[0].invoiceId || 'Invoice').replace(/\s+/g, '_')}`
    : `Cancel_Invoices_${formatDate(cancelDate).replace(/\//g, '-')}`;

  if (action === 'print') {
    printPdfInSameTab(doc);
  } else {
    doc.save(`${filenameBase}.pdf`);
  }
}
