import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { printPdfInSameTab } from './DeliveryUtils';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { listSignatories } from '@/app/Components/Signatures/SignatureService';
import { drawSignatures } from '@/app/Components/Signatures/DrawSignatures';
import type { Signer } from '@/app/Components/Signatures/SignatureTypes';

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
  reason?: string;
  printedBy?: string;
  formId?: string;
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
  title = 'Notes',
  titleAr = ' / ملاحظات',
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
  const notesTitleWidth = doc.getTextWidth(title);
  doc.text(title, margin + padding, textY);
  doc.setFont('Amiri', 'normal');
  doc.text(titleAr, margin + padding + notesTitleWidth, textY);

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

/** Prepared by (who made the form) + Supply Chain Manager + Sales Operation Manager + CEO (names from Data Base → Signatories DB). */
async function buildSigners(preparedBy: string): Promise<Signer[]> {
  let list: { TITLE: string; NAME: string; IS_ACTIVE: boolean }[] = [];
  try {
    list = await listSignatories();
  } catch {
    // the names stay blank to write by hand
  }
  const find = (re: RegExp) => list.find((p) => p.IS_ACTIVE && re.test(p.TITLE))?.NAME || '';
  return [
    { title: 'Prepared By', name: preparedBy },
    { title: 'Supply Chain Manager', name: find(/supply\s*chain\s*manager/i) },
    { title: 'Sales Operation Manager', name: find(/sales\s*operations?\s*manager/i) },
    { title: 'CEO', name: find(/\bceo\b|chief\s+executive/i) },
  ];
}

export async function generateCancelInvoicePDF({
  invoices,
  cancelDate,
  notes,
  reason,
  printedBy,
  formId,
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
    title: `Invoice_Cancellation_${formId || invoices[0].invoiceId || 'Form'}`,
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
  if (formId) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`No. ${formId}`, pageWidth - margin, 13, { align: 'right' });
  }

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

  if (reason?.trim()) {
    sectionY = drawNotesBox(doc, sectionY, margin, contentWidth, reason, 'Reason for Cancellation', ' / سبب الإلغاء') + 8;
  }

  if (notes?.trim()) {
    sectionY = drawNotesBox(doc, sectionY, margin, contentWidth, notes) + 8;
  }

  const signers = await buildSigners(printedBy?.trim() || '');
  // signatures sit at the bottom of the page (a new page when the content leaves no room)
  drawSignatures(doc, signers, { y: sectionY, margin, bottom: true, footer: 18 });

  const filenameBase = invoices.length === 1
    ? `Cancel_Invoice_${(invoices[0].invoiceId || 'Invoice').replace(/\s+/g, '_')}`
    : `Cancel_Invoices_${formatDate(cancelDate).replace(/\//g, '-')}`;

  if (action === 'print') {
    printPdfInSameTab(doc);
  } else {
    saveTrackedPdf(doc, `${filenameBase}.pdf`);
  }
}
