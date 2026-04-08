'use client';

import { addArabicFont } from './shared';

export async function generateWaterDeliveryNotePDF(
  data: {
    companyName: string;
    deliveryNoteNumber: string;
    date: string;
    lines: Array<{ itemName: string; quantity: number; unitType: 'Outer' }>;
    total: { outer: number; pcs: number };
    signatures?: string[];
  },
  returnBlob: boolean = false
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text('Water - Delivery Note', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;
  doc.setFontSize(14); doc.setTextColor(0, 155, 77); doc.text(data.companyName, pageWidth / 2, yPosition, { align: 'center' });
  doc.setTextColor(0, 0, 0); yPosition += 15;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Delivery Note No: ${data.deliveryNoteNumber || 'N/A'}`, margin, yPosition);
  const dateStr = `Date: ${data.date || new Date().toISOString().split('T')[0]}`;
  doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), yPosition);
  yPosition += 11;

  const tableData = data.lines.filter(l => l.itemName && l.quantity > 0).map(l => [l.itemName, l.quantity.toString(), l.unitType]);
  if (data.total.outer > 0) tableData.push(['TOTAL OUTER', data.total.outer.toString(), 'Outer']);
  if (data.total.pcs > 0) tableData.push(['TOTAL PCS', data.total.pcs.toString(), 'PCS']);

  const tableOptions: any = {
    startY: yPosition, head: [['Item Name', 'Quantity', 'Unit Type']], body: tableData, theme: 'striped',
    headStyles: { fillColor: [0, 155, 77], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    bodyStyles: { halign: 'center' }, columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 40 }, 2: { cellWidth: 40 } },
    styles: { fontSize: 10, cellPadding: 3 },
    didParseCell: (hookData: any) => {
      const totalRowsStart = tableData.length - (data.total.outer > 0 ? 1 : 0) - (data.total.pcs > 0 && data.total.outer > 0 ? 1 : 0);
      if (hookData.row.index >= totalRowsStart) { hookData.cell.styles.fontStyle = 'bold'; hookData.cell.styles.fillColor = [240, 240, 240]; }
    }
  };

  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions);

  const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;
  yPosition = finalY + 20; if (yPosition > 250) { doc.addPage(); yPosition = 20; }
  const sigNames = ['MONAI', 'OMAR', 'SALAM']; const sigWidth = (pageWidth - 2 * margin) / 3;
  sigNames.forEach((n, i) => {
    const x = margin + (i * sigWidth);
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.rect(x + 5, yPosition, sigWidth - 10, 30);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(n, x + (sigWidth / 2), yPosition + 8, { align: 'center' });
    doc.setLineWidth(0.3); doc.line(x + 15, yPosition + 20, x + sigWidth - 15, yPosition + 20);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text('Signature', x + (sigWidth / 2), yPosition + 26, { align: 'center' });
  });

  if (returnBlob) return doc.output('blob');
  doc.save(`Water_Delivery_Note_${data.deliveryNoteNumber || 'DN'}.pdf`);
}
