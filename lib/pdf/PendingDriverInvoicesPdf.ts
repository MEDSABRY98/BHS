'use client';

export async function generatePendingDriverInvoicesPDF(
  driverName: string,
  invoices: any[],
  action: 'download' | 'print' = 'download'
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `Pending_Invoices_${driverName.replace(/\s+/g, '_')}` });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Header Background - Premium Slim Black Bar
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, 20, 'F');

  // Title - Centered Gold
  doc.setFontSize(14);
  doc.setTextColor(212, 175, 55); // Gold
  doc.setFont('helvetica', 'bold');
  doc.text('PENDING DRIVER INVOICES REPORT', pageWidth / 2, 13, { align: 'center' });

  let y = 24;

  // Driver Metadata Box
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 22, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Driver Name:', margin + 8, y + 8);
  doc.text('Report Date:', margin + 8, y + 15);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(driverName, margin + 35, y + 8);
  doc.text(new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), margin + 35, y + 15);

  // Total Summary stats in metadata box
  const totalCount = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.AMOUNT) || 0), 0);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Invoices:', pageWidth - margin - 60, y + 8);
  doc.text('Total Value:', pageWidth - margin - 60, y + 15);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(totalCount.toString(), pageWidth - margin - 35, y + 8);
  doc.setTextColor(212, 175, 55); // Gold for the final value
  doc.text(`AED ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 35, y + 15);

  y += 28;

  // Table Data mapping
  const tableData = invoices.map((inv) => {
    const formattedDate = inv.ORDER_DATE 
      ? new Date(inv.ORDER_DATE).toLocaleDateString('en-GB')
      : (inv.CREATED_AT ? new Date(inv.CREATED_AT).toLocaleDateString('en-GB') : '-');

    return [
      formattedDate,
      inv.INVOICE_ID || inv.ORDER_ID || '-',
      inv.app_lpos_CUSTOMERS?.['CUSTOMER NAME'] || 'Unknown Customer',
      `AED ${(parseFloat(inv.AMOUNT) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ];
  });

  const tableOptions: any = {
    startY: y,
    head: [['Invoice Date', 'Invoice ID', 'Customer Name', 'Amount (AED)']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 10, 10],
      textColor: [212, 175, 55],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 9,
      cellPadding: 4
    },
    bodyStyles: {
      halign: 'center',
      valign: 'middle',
      fontSize: 9,
      cellPadding: 4.5
    },
    columnStyles: {
      0: { cellWidth: 32, halign: 'center' },
      1: { cellWidth: 48, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'center' },
      3: { cellWidth: 42, fontStyle: 'bold', halign: 'center' }
    },
    margin: { left: margin, right: margin }
  };

  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions);

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `BHS Logistics LPOS System • Page ${i} of ${totalPages} • Generated on ${new Date().toLocaleString()}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  if (action === 'print') {
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  } else {
    doc.save(`Pending_Invoices_${driverName.replace(/\s+/g, '_')}.pdf`);
  }
}
