'use client';

export async function generateDeliveredDriverInvoicesPDF(
  driverName: string,
  invoices: any[],
  action: 'download' | 'print' = 'download',
  fromDate?: string,
  toDate?: string
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `Delivered_Invoices_${driverName.replace(/\s+/g, '_')}` });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Total Summary stats
  const totalCount = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.AMOUNT) || 0), 0);

  // Table Data mapping
  const tableData = invoices.map((inv) => {
    const formattedDate = inv.ORDER_DATE
      ? new Date(inv.ORDER_DATE).toLocaleDateString('en-GB')
      : (inv.CREATED_AT ? new Date(inv.CREATED_AT).toLocaleDateString('en-GB') : '-');

    const driverRecord = inv.app_lpos_DRIVERS?.[0];
    const handoverDateStr = driverRecord?.OFFICE_HANDOVER_TIME;
    const formattedHandoverDate = handoverDateStr
      ? new Date(handoverDateStr).toLocaleDateString('en-GB')
      : '-';

    return [
      formattedDate,
      formattedHandoverDate,
      inv.INVOICE_ID || inv.ORDER_ID || '-',
      inv.app_lpos_CUSTOMERS?.['CUSTOMER NAME'] || 'Unknown Customer',
      `AED ${(parseFloat(inv.AMOUNT) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ];
  });

  const renderReportPage = (isCopy: boolean) => {
    // Watermark for COPY
    if (isCopy) {
      doc.setFontSize(80);
      doc.setTextColor(245, 245, 245);
      doc.setFont('helvetica', 'bold');
      doc.text('COPY', pageWidth / 2, pageHeight / 2 - 20, { align: 'center', angle: 45 });
    }

    // Header Background - Premium Slim Black Bar
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageWidth, 20, 'F');

    // Title - Centered Gold
    doc.setFontSize(14);
    doc.setTextColor(212, 175, 55); // Gold
    doc.setFont('helvetica', 'bold');
    const titleText = isCopy
      ? 'DELIVERED DRIVER INVOICES REPORT - COPY'
      : 'DELIVERED DRIVER INVOICES REPORT';
    doc.text(titleText, pageWidth / 2, 13, { align: 'center' });

    let y = 24;

    // Driver Metadata Box
    const hasDateFilter = !!(fromDate || toDate);
    const boxHeight = hasDateFilter ? 28 : 22;

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(230, 230, 230);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, boxHeight, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Driver Name:', margin + 8, y + 8);
    doc.text('Report Date:', margin + 8, y + 15);
    if (hasDateFilter) {
      doc.text('Date Filter:', margin + 8, y + 22);
    }

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(driverName, margin + 35, y + 8);
    doc.text(new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), margin + 35, y + 15);
    if (hasDateFilter) {
      let filterText = '';
      if (fromDate && toDate) {
        filterText = `${new Date(fromDate).toLocaleDateString('en-GB')} - ${new Date(toDate).toLocaleDateString('en-GB')}`;
      } else if (fromDate) {
        filterText = `From ${new Date(fromDate).toLocaleDateString('en-GB')}`;
      } else if (toDate) {
        filterText = `To ${new Date(toDate).toLocaleDateString('en-GB')}`;
      }
      doc.text(filterText, margin + 35, y + 22);
    }

    // Total Summary stats in metadata box
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

    y += boxHeight + 6;

    const tableOptions: any = {
      startY: y,
      head: [['Invoice Date', 'Handover Date', 'Invoice ID', 'Customer Name', 'Amount (AED)']],
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
        0: { cellWidth: 26, halign: 'center' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 32, halign: 'center' },
        3: { cellWidth: 'auto', halign: 'center' },
        4: { cellWidth: 32, fontStyle: 'bold', halign: 'center' }
      },
      margin: { left: margin, right: margin }
    };

    if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
    else if (typeof autoTable === 'function') autoTable(doc, tableOptions);

    const finalY = (doc as any).lastAutoTable.finalY || y;

    // Draw signatures
    let sigY = finalY + 15;
    if (sigY + 25 > pageHeight - 15) {
      doc.addPage();
      sigY = 20; // top of new page
    }

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);

    if (isCopy) {
      // Only Receiver's Signature
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text("Receiver's Signature:", margin + 10, sigY);
      doc.line(margin + 10, sigY + 12, margin + 80, sigY + 12);
    } else {
      // Both Receiver's and Driver's Signatures
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');

      // Receiver
      doc.text("Receiver's Signature:", margin + 10, sigY);
      doc.line(margin + 10, sigY + 12, margin + 80, sigY + 12);

      // Driver
      doc.text("Driver's Signature:", pageWidth - margin - 80, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(driverName, pageWidth - margin - 80, sigY + 5);
      doc.line(pageWidth - margin - 80, sigY + 12, pageWidth - margin - 10, sigY + 12);
    }
  };

  // Draw original report
  renderReportPage(false);

  // Add page break and draw copy report
  doc.addPage();
  renderReportPage(true);

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  if (action === 'print') {
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  } else {
    doc.save(`Delivered_Invoices_${driverName.replace(/\s+/g, '_')}.pdf`);
  }
}
