import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { HandoverItem } from '../Service/cash_handover_service';

export interface HandoverPdfData {
  handoverId: string;
  date: string;
  items: HandoverItem[];
  totalAmount: number;
  receivedBy: string;
}

export const generateHandoverPdf = async ({ data, filename }: { data: HandoverPdfData; filename: string }) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  await addArabicFont(doc);
  doc.setFont('Amiri', 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [0, 0, 0];
  const secondaryColor: [number, number, number] = [100, 100, 100];

  // Header Title
  doc.setFontSize(24);
  doc.setFont('Amiri', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('CASH HANDOVER', pageWidth / 2, 25, { align: 'center' });

  // Details Section
  doc.setFontSize(11);
  doc.setFont('Amiri', 'normal');
  doc.setTextColor(...secondaryColor);

  const leftMargin = 15;
  const rightMargin = pageWidth - 15;
  let currentY = 40;

  // Ref / Date
  doc.text(`Handover ID: `, leftMargin, currentY);
  doc.setFont('Amiri', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(data.handoverId, leftMargin + 25, currentY);

  doc.setFont('Amiri', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.text(`Date: `, rightMargin - 40, currentY);
  doc.setFont('Amiri', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(data.date, rightMargin - 28, currentY);

  currentY += 15;

  // Table
  const tableData = data.items.map((item, index) => [
    (index + 1).toString(),
    item.customerName,
    item.receiptNumber,
    `${item.amount.toLocaleString()} AED`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Customer Name', 'Invoice ID', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      font: 'Amiri'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'center' },
      2: { halign: 'center', cellWidth: 40 },
      3: { halign: 'center', cellWidth: 40 },
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
      font: 'Amiri'
    },
    margin: { left: leftMargin, right: 15 },
    didDrawPage: (data) => {
      // Add footer if needed
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Total
  doc.setFontSize(14);
  doc.setFont('Amiri', 'bold');
  doc.text(`Total Handed Over: ${data.totalAmount.toLocaleString()} AED`, rightMargin, currentY, { align: 'right' });

  currentY += 40;

  // Signatures
  const signatureY = currentY;
  
  doc.setFontSize(11);
  doc.setFont('Amiri', 'bold');

  // Received By
  doc.text('Received By:', leftMargin, signatureY);
  doc.line(leftMargin, signatureY + 25, leftMargin + 60, signatureY + 25);
  
  doc.setFontSize(16);
  doc.setFont('Amiri', 'normal');
  doc.text(data.receivedBy, leftMargin + 30, signatureY + 33, { align: 'center' });

  // Save the PDF
  doc.save(`${filename}.pdf`);
};
