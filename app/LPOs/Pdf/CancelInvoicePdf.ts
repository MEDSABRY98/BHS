import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { printPdfInSameTab } from './DeliveryUtils';

const DISCLAIMER_RETURN_EN =
  'I, the warehouse responsible, confirm that I received the goods for this invoice and request its cancellation.';
const DISCLAIMER_RETURN_AR =
  'أقر أنا مسؤول المستودع أنني استلمت البضاعة الخاصة بهذه الفاتورة وأرغب في إلغائها.';

const DISCLAIMER_AMENDMENT_EN =
  'I, the warehouse responsible, confirm that this invoice is cancelled for amendment and will be re-issued as a new amended invoice.';
const DISCLAIMER_AMENDMENT_AR =
  'أقر أنا مسؤول المستودع أن هذه الفاتورة ملغاة للتعديل عليها وسيتم إصدارها مرة أخرى كفاتورة جديدة معدلة.';

export type CancelInvoiceReason = 'return' | 'amendment';

function getCancelReasonLabel(reason: CancelInvoiceReason): string {
  return reason === 'amendment' ? 'Amendment & Re-issue' : 'Returned Goods';
}

function getDisclaimerText(reason: CancelInvoiceReason) {
  if (reason === 'amendment') {
    return { en: DISCLAIMER_AMENDMENT_EN, ar: DISCLAIMER_AMENDMENT_AR };
  }
  return { en: DISCLAIMER_RETURN_EN, ar: DISCLAIMER_RETURN_AR };
}

export interface CancelInvoicePdfRow {
  invoiceId: string;
  customerName: string;
  amount: number;
  orderDate?: string;
}

export interface CancelInvoicePdfOptions {
  invoices: CancelInvoicePdfRow[];
  cancelDate?: string;
  cancelReason?: CancelInvoiceReason;
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
  cancelReason: CancelInvoiceReason,
): number {
  const { en: disclaimerEn, ar: disclaimerAr } = getDisclaimerText(cancelReason);
  const padding = 5;
  const innerWidth = contentWidth - padding * 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const enLines = doc.splitTextToSize(disclaimerEn, innerWidth) as string[];

  doc.setFont('Amiri', 'normal');
  doc.setFontSize(9);
  const arLines = doc.splitTextToSize(disclaimerAr, innerWidth) as string[];

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
  cancelReason = 'return',
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
  const headerTitle = `INVOICE CANCELLATION FORM (${getCancelReasonLabel(cancelReason)})`;
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
  const disclaimerEndY = drawDisclaimerBox(doc, finalY + 8, margin, contentWidth, cancelReason);
  let sigY = disclaimerEndY + 14;

  if (sigY + 34 > pageHeight - 10) {
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

  const filenameBase = invoices.length === 1
    ? `Cancel_${cancelReason === 'amendment' ? 'Amend_' : 'Return_'}${(invoices[0].invoiceId || 'Invoice').replace(/\s+/g, '_')}`
    : `Cancel_Invoices_${cancelReason === 'amendment' ? 'Amend_' : 'Return_'}${formatDate(cancelDate).replace(/\//g, '-')}`;

  if (action === 'print') {
    printPdfInSameTab(doc);
  } else {
    doc.save(`${filenameBase}.pdf`);
  }
}
