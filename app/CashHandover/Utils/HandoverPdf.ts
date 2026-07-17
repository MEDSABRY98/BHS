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
  note?: string;
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

  // Header
  const headerHeight = 28;
  const margin = 15;
  
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  let headerY = 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, headerY, { align: 'center' });

  headerY += 8;
  doc.setFontSize(12);
  doc.text('CASH HANDOVER', pageWidth / 2, headerY, { align: 'center' });

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.line(margin, headerHeight - 3, pageWidth - margin, headerHeight - 3);

  // Details Section
  let currentY = headerHeight + 8;

  const leftMargin = 15;
  const rightMargin = pageWidth - 15;

  // Handover ID + Date — centered together
  doc.setFontSize(11);
  const infoParts: { text: string; bold: boolean }[] = [
    { text: 'Handover ID: ', bold: false },
    { text: data.handoverId, bold: true },
    { text: '   Date: ', bold: false },
    { text: data.date, bold: true },
  ];

  doc.setFont('helvetica', 'normal');
  const totalInfoWidth = infoParts.reduce((sum, part) => {
    doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
    return sum + doc.getTextWidth(part.text);
  }, 0);

  let infoX = (pageWidth - totalInfoWidth) / 2;
  infoParts.forEach((part) => {
    doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
    doc.setTextColor(...(part.bold ? primaryColor : secondaryColor));
    doc.text(part.text, infoX, currentY);
    infoX += doc.getTextWidth(part.text);
  });

  doc.setFont('Amiri', 'normal');
  currentY += 6;

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

  currentY += 15;

  if (data.note) {
    currentY += 5;
    
    doc.setFontSize(14);
    doc.setFont('Amiri', 'bold');
    doc.text('Note', pageWidth / 2, currentY, { align: 'center' });
    
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(12);
    // Split text to fit width
    const splitNote = doc.splitTextToSize(data.note, rightMargin - leftMargin - 10);
    doc.text(splitNote, pageWidth / 2, currentY + 8, { align: 'center' });
    
    currentY += (splitNote.length * 6) + 20;
  } else {
    currentY += 25;
  }

  // Signatures
  const signatureY = currentY;
  
  doc.setFontSize(11);
  doc.setFont('Amiri', 'bold');

  // Received By
  doc.text('Received By:', leftMargin, signatureY);
  doc.setDrawColor(...primaryColor);
  doc.line(leftMargin, signatureY + 25, leftMargin + 60, signatureY + 25);
  
  doc.setFontSize(16);
  doc.setFont('Amiri', 'normal');
  doc.text(data.receivedBy, leftMargin + 30, signatureY + 33, { align: 'center' });

  // Save the PDF
  doc.save(`${filename}.pdf`);
};
