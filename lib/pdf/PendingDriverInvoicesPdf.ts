import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function generatePendingDriverInvoicesPDF(
  driverName: string,
  invoices: any[],
  action: 'download' | 'print' = 'download',
  fromDate?: string,
  toDate?: string,
  driverSignature?: string,
  adminSignature?: string
) {

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

  y += boxHeight + 6;

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

  // Group invoices by date and count them for page 2 summary
  const dateGroups: { [key: string]: { dateObj: Date; formattedDate: string; count: number } } = {};

  invoices.forEach((inv) => {
    const rawDate = inv.ORDER_DATE || inv.CREATED_AT;
    if (!rawDate) return;
    const dateObj = new Date(rawDate);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    if (!dateGroups[dateKey]) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthName = months[dateObj.getMonth()];
      const formattedDate = `${day}-${monthName}-${year}`;

      dateGroups[dateKey] = {
        dateObj,
        formattedDate,
        count: 0
      };
    }
    dateGroups[dateKey].count += 1;
  });

  // Sort by date from oldest to newest
  const sortedDateGroups = Object.values(dateGroups).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  if (sortedDateGroups.length > 0) {
    doc.addPage();

    // Header Background - Premium Slim Black Bar for Page 2
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageWidth, 20, 'F');

    // Title - Centered Gold
    doc.setFontSize(14);
    doc.setTextColor(212, 175, 55); // Gold
    doc.setFont('helvetica', 'bold');
    doc.text(`INVOICES SUMMARY BY DATE - ${driverName.toUpperCase()}`, pageWidth / 2, 13, { align: 'center' });

    const summaryTableData = sortedDateGroups.map(group => [
      group.formattedDate,
      group.count.toString()
    ]);

    const summaryTableOptions: any = {
      startY: 28,
      head: [['Invoice Date', 'Number of Invoices']],
      body: summaryTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [10, 10, 10],
        textColor: [212, 175, 55],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        fontSize: 10,
        cellPadding: 3
      },
      bodyStyles: {
        halign: 'center',
        valign: 'middle',
        fontSize: 10,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 80, halign: 'center' },
        1: { cellWidth: 80, halign: 'center' }
      },
      margin: { left: (pageWidth - 160) / 2, right: (pageWidth - 160) / 2 }
    };

    if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(summaryTableOptions);
    else if (typeof autoTable === 'function') autoTable(doc, summaryTableOptions);
  }

  // Draw Signatures section
  const lastPageNum = (doc as any).internal.getNumberOfPages();
  doc.setPage(lastPageNum);

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  let sigY = finalY + 15;

  if (sigY + 25 > pageHeight - 15) {
    doc.addPage();
    sigY = 25; // top of new page
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);

  // Receiver/Admin Signature (Left)
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text("Receiver's Signature:", margin + 10, sigY);
  
  if (adminSignature) {
    try {
      doc.addImage(adminSignature, 'PNG', margin + 15, sigY + 2, 55, 16);
    } catch (e) {
      console.error('Error adding admin signature image to PDF:', e);
    }
  }
  doc.line(margin + 10, sigY + 19, margin + 80, sigY + 19);

  // Driver Signature (Right)
  doc.text("Driver's Signature:", pageWidth - margin - 80, sigY);

  if (driverSignature) {
    try {
      doc.addImage(driverSignature, 'PNG', pageWidth - margin - 75, sigY + 2, 55, 16);
    } catch (e) {
      console.error('Error adding driver signature image to PDF:', e);
    }
  }
  doc.line(pageWidth - margin - 80, sigY + 19, pageWidth - margin - 10, sigY + 19);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Name: ${driverName}`, pageWidth - margin - 80, sigY + 23);

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
    doc.save(`Pending_Invoices_${driverName.replace(/\s+/g, '_')}.pdf`);
  }
}
