'use client';

import { addArabicFont } from '@/app/Components/Pdf/shared';

export type CustomerMarginProductRow = {
  barcode: string;
  product: string;
  cost: number;
  sellPrice: number;
};

export async function generateCustomerMarginProducts(
  customerName: string,
  products: CustomerMarginProductRow[]
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 25;

  doc.setFontSize(16);
  doc.setTextColor(0, 155, 77);
  doc.setFont('helvetica', 'bold');
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, {
    align: 'center',
  });
  yPosition += 8;

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text('Customer Margin — Product Breakdown', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  let fontSize = 16;
  let textWidth = doc.getTextWidth(customerName);
  while (textWidth > pageWidth - 40 && fontSize > 10) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
    textWidth = doc.getTextWidth(customerName);
  }
  doc.setFontSize(fontSize);
  doc.text(customerName, pageWidth / 2, yPosition, { align: 'center', maxWidth: pageWidth - 40 });
  yPosition += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    20,
    yPosition
  );
  yPosition += 3;

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const rowDiffs = products.map((p) => p.sellPrice - p.cost);

  const headers = [['#', 'Barcode', 'Product', 'Cost', 'Sell Price', 'Diff', 'Diff %']];
  const body = products.map((p, i) => {
    const diff = rowDiffs[i];
    const marginPct = p.sellPrice > 0 ? (diff / p.sellPrice) * 100 : 0;
    return [
      (i + 1).toString(),
      p.barcode || '-',
      p.product || '-',
      fmt(p.cost),
      fmt(p.sellPrice),
      fmt(diff),
      `${marginPct.toFixed(1)}%`,
    ];
  });

  const tableWidth = 190;
  const columnStyles = {
    0: { cellWidth: 10, halign: 'center' as const },
    1: { cellWidth: 32, halign: 'center' as const },
    2: { cellWidth: 62, halign: 'center' as const },
    3: { cellWidth: 22, halign: 'center' as const },
    4: { cellWidth: 22, halign: 'center' as const },
    5: { cellWidth: 20, halign: 'center' as const },
    6: { cellWidth: 22, halign: 'center' as const },
  };

  const tableLeftMargin = (pageWidth - tableWidth) / 2;
  const tableOptions = {
    startY: yPosition,
    head: headers,
    body,
    theme: 'grid' as const,
    headStyles: {
      fillColor: [0, 155, 77],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
    },
    bodyStyles: { fontSize: 8.5, cellPadding: 2, font: 'Amiri', halign: 'center' },
    columnStyles,
    margin: { left: tableLeftMargin, right: tableLeftMargin },
    styles: { font: 'Amiri' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didParseCell: (data: { section: string; row: { index: number }; cell: { styles: Record<string, unknown> } }) => {
      if (data.section !== 'body') return;
      const diff = rowDiffs[data.row.index];
      if (diff < 0) {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [185, 28, 28];
      }
    },
  };

  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions as any);

  doc.save(`Margin_Products_${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}
