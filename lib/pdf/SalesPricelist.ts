'use client';

import { addArabicFont } from './shared';

export async function generateSalesPricelistPDF(
  customerName: string,
  products: Array<{
    barcode: string;
    product: string;
    price?: number;
  }>,
  returnBlob: boolean = false,
  pricingStrategy: 'most' | 'last' = 'most'
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 25;

  doc.setFontSize(16); doc.setTextColor(0, 155, 77); doc.setFont('helvetica', 'bold');
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  doc.setFontSize(12); doc.setTextColor(100, 100, 100); 
  const subtitle = `Price List (${pricingStrategy === 'last' ? 'Last Price' : 'Most Price'})`;
  doc.text(subtitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
  let fontSize = 16; let textWidth = doc.getTextWidth(customerName);
  while (textWidth > pageWidth - 40 && fontSize > 10) { fontSize -= 0.5; doc.setFontSize(fontSize); textWidth = doc.getTextWidth(customerName); }
  doc.setFontSize(fontSize); doc.text(customerName, pageWidth / 2, yPosition, { align: 'center', maxWidth: pageWidth - 40 });
  yPosition += 5;

  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, yPosition);
  yPosition += 3;

  const headers = [['#', 'Barcode', 'Product', 'Price']];
  const body = products.map((p, i) => [
    (i + 1).toString(),
    p.barcode || '-',
    p.product || '-',
    p.price !== undefined ? p.price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'
  ]);
  const tableWidth = 190;
  const columnStyles = { 
    0: { cellWidth: 15, halign: 'center' }, 
    1: { cellWidth: 50, halign: 'center' }, 
    2: { cellWidth: 85, halign: 'center' }, 
    3: { cellWidth: 40, halign: 'center' } 
  };

  const tableLeftMargin = (pageWidth - tableWidth) / 2;

  const tableOptions = {
    startY: yPosition, head: headers,
    body: body, theme: 'grid' as const, headStyles: { fillColor: [0, 155, 77], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, halign: 'center' },
    bodyStyles: { fontSize: 8.5, cellPadding: 2, font: 'Amiri', halign: 'center' }, columnStyles: columnStyles,
    margin: { left: tableLeftMargin, right: tableLeftMargin }, styles: { font: 'Amiri' }, alternateRowStyles: { fillColor: [245, 245, 245] }
  };
  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions as any);

  if (returnBlob) return doc.output('blob');
  doc.save(`Price_List_${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}
