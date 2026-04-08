'use client';

import { addArabicFont } from './shared';

export async function generateBulkSupplierStatementsPDF(
  statements: Array<{
    supplierName: string;
    transactions: Array<{
      date: string;
      number: string;
      amount: number;
      type: 'Purchase' | 'Refund';
    }>
  }>
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('l', 'mm', 'a4');
  await addArabicFont(doc);

  for (let i = 0; i < statements.length; i++) {
    const { supplierName, transactions } = statements[i];
    if (i > 0) doc.addPage();
    const startPage = doc.getNumberOfPages();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = 20;

    const tableWidth = 260;
    const tableLeftMargin = (pageWidth - tableWidth) / 2;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Supplier Statement', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;

    // Company Name
    doc.setFontSize(12);
    doc.setTextColor(0, 155, 77);
    doc.setFont('helvetica', 'bold');
    doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    // Supplier Name
    doc.setFontSize(14);
    doc.setFont('Amiri', 'normal');
    doc.text(`Supplier: ${supplierName}`, margin, yPosition);
    yPosition += 8;

    const now = new Date();
    const currentDate = `${now.getDate()}-${now.toLocaleDateString('en-US', { month: 'short' })}-${now.getFullYear()}`;
    doc.text(`Date: ${currentDate}`, margin, yPosition);
    yPosition += 8;

    const tableData = transactions.map((tx) => {
      let dateStr = tx.date;
      const d = new Date(tx.date);
      if (!isNaN(d.getTime())) {
        dateStr = `${d.getDate()}-${d.toLocaleDateString('en-US', { month: 'short' })}-${d.getFullYear()}`;
      }
      const purchase = tx.type === 'Purchase' ? tx.amount : 0;
      const refund = tx.type === 'Refund' ? tx.amount : 0;
      return [
        dateStr,
        tx.type,
        tx.number,
        purchase ? purchase.toLocaleString('en-US') : '-',
        refund ? refund.toLocaleString('en-US') : '-'
      ];
    });

    const totalPurchase = transactions.reduce((sum, tx) => sum + (tx.type === 'Purchase' ? tx.amount : 0), 0);
    const totalRefund = transactions.reduce((sum, tx) => sum + (tx.type === 'Refund' ? tx.amount : 0), 0);
    const netBalance = totalPurchase - totalRefund;

    const tableOptions = {
      startY: yPosition,
      margin: { left: tableLeftMargin, right: tableLeftMargin },
      head: [['Date', 'Type', 'Number', 'Purchase', 'Refund']],
      body: tableData,
      theme: 'striped' as const,
      styles: { font: 'helvetica', fontStyle: 'normal', valign: 'middle' },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 40, halign: 'center' },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 60, halign: 'center' },
        3: { cellWidth: 60, halign: 'center' },
        4: { cellWidth: 60, halign: 'center' }
      }
    };

    if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
    else if (typeof autoTable === 'function') autoTable(doc, tableOptions as any);

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;
    const totalBoxWidth = 60;
    const totalBoxHeight = 15;
    const totalBoxX = tableLeftMargin + tableWidth - totalBoxWidth;
    let totalBoxY = finalY + 5;
    if (totalBoxY + totalBoxHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      totalBoxY = 20;
    }
    doc.setFillColor(240, 240, 240);
    doc.rect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NET BALANCE', totalBoxX + totalBoxWidth / 2, totalBoxY + 6, { align: 'center' });
    doc.setFontSize(14);
    doc.text(netBalance.toLocaleString('en-US'), totalBoxX + totalBoxWidth / 2, totalBoxY + 12, { align: 'center' });

    const endPage = doc.getNumberOfPages();
    for (let p = startPage; p <= endPage; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${p - startPage + 1} of ${endPage - startPage + 1}`, 15, doc.internal.pageSize.getHeight() - 10);
    }
    doc.setPage(endPage);
  }
  return doc.output('blob');
}
