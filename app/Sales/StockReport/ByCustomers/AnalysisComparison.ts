'use client';

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';

export async function generateSalesAnalysisComparisonPDF(
  customerName: string,
  products: Array<{
    barcode: string;
    product: string;
    price?: number;
    avgPrice?: number;
    costPrice?: number;
  }>,
  returnBlob: boolean = false,
  selectedColumns?: {
    barcode: boolean;
    product: boolean;
    mostPrice: boolean;
    maxPrice: boolean;
    cost: boolean;
    diff: boolean;
    margin: boolean;
  }
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
  doc.text('Pricing Analysis Report (Comparison & Margins)', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
  let fontSize = 16; let textWidth = doc.getTextWidth(customerName);
  while (textWidth > pageWidth - 40 && fontSize > 10) { fontSize -= 0.5; doc.setFontSize(fontSize); textWidth = doc.getTextWidth(customerName); }
  doc.setFontSize(fontSize); doc.text(customerName, pageWidth / 2, yPosition, { align: 'center', maxWidth: pageWidth - 40 });
  yPosition += 5;

  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, yPosition);
  yPosition += 3;

  const defaultCols = { barcode: true, product: true, mostPrice: true, maxPrice: true, cost: true, diff: true, margin: true };
  const cols = selectedColumns || defaultCols;

  const headerRow = ['#'];
  if (cols.barcode) headerRow.push('Barcode');
  if (cols.product) headerRow.push('Product');
  if (cols.mostPrice) headerRow.push('Most Price');
  if (cols.maxPrice) headerRow.push('Max Price');
  if (cols.cost) headerRow.push('Cost');
  if (cols.diff) headerRow.push('Diff');
  if (cols.margin) headerRow.push('%');

  const headers = [headerRow];

  const body = products.map((p, i) => {
    const freq = p.price || 0;
    const cost = p.costPrice || 0;
    const diff = freq - cost;
    const margin = freq > 0 ? (diff / freq) * 100 : 0;
    
    const row = [(i + 1).toString()];
    if (cols.barcode) row.push(p.barcode || '-');
    if (cols.product) row.push(p.product || '-');
    if (cols.mostPrice) row.push(freq ? freq.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-');
    if (cols.maxPrice) row.push(p.avgPrice ? p.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-');
    if (cols.cost) row.push(cost ? cost.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-');
    if (cols.diff) row.push(diff.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
    if (cols.margin) row.push(`${margin.toFixed(1)}%`);
    
    return row;
  });

  const columnStyles: any = { 0: { cellWidth: 10, halign: 'center' } };
  let colIndex = 1;
  let usedWidth = 10;

  if (cols.barcode) {
    columnStyles[colIndex++] = { cellWidth: 35, halign: 'center' };
    usedWidth += 35;
  }

  let productColIndex = -1;
  if (cols.product) {
    productColIndex = colIndex++;
  }

  const numericColWidth = 18;

  if (cols.mostPrice) { columnStyles[colIndex++] = { cellWidth: numericColWidth, halign: 'center' }; usedWidth += numericColWidth; }
  if (cols.maxPrice) { columnStyles[colIndex++] = { cellWidth: numericColWidth, halign: 'center' }; usedWidth += numericColWidth; }
  if (cols.cost) { columnStyles[colIndex++] = { cellWidth: numericColWidth, halign: 'center' }; usedWidth += numericColWidth; }
  if (cols.diff) { columnStyles[colIndex++] = { cellWidth: numericColWidth, halign: 'center' }; usedWidth += numericColWidth; }
  if (cols.margin) { columnStyles[colIndex++] = { cellWidth: numericColWidth, halign: 'center' }; usedWidth += numericColWidth; }

  if (cols.product) {
    const remainingWidth = Math.max(30, 190 - usedWidth);
    columnStyles[productColIndex] = { cellWidth: remainingWidth, halign: 'center' };
  } else if (cols.barcode) {
    // If no product column, give remaining width to barcode
    const remainingWidth = Math.max(35, 190 - usedWidth + 35);
    columnStyles[1] = { cellWidth: remainingWidth, halign: 'center' };
  }

  const tableWidth = 190;
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
  saveTrackedPdf(doc, `Analysis_${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}
