import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function generatePendingCustomerInvoicesPDF(
  customerSearchTerm: string,
  invoices: any[],
  drivers: any[],
  action: 'download' | 'print' = 'download',
  fromDate?: string,
  toDate?: string
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `Pending_Invoices_Search_${customerSearchTerm.replace(/\s+/g, '_')}` });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Group invoices by driver ID
  const groupedInvoices: Record<string, any[]> = {};
  invoices.forEach((inv) => {
    const driverId = inv.app_lpos_DRIVERS?.[0]?.DRIVERS_NAME || 'Unassigned';
    if (!groupedInvoices[driverId]) {
      groupedInvoices[driverId] = [];
    }
    groupedInvoices[driverId].push(inv);
  });

  const driverIds = Object.keys(groupedInvoices);

  if (driverIds.length === 0) {
    drawPageHeader(doc, customerSearchTerm, 'No Driver Assigned', [], pageHeight, pageWidth, margin, fromDate, toDate, null);
  } else {
    driverIds.forEach((driverId, idx) => {
      if (idx > 0) {
        doc.addPage();
      }

      const driverInvoices = groupedInvoices[driverId];
      // Sort invoices:
      // 1st: by Date from oldest
      // 2nd: by Invoice ID / Order ID
      const sortedDriverInvoices = [...driverInvoices].sort((a, b) => {
        const dateA = a.ORDER_DATE ? new Date(a.ORDER_DATE).getTime() : (a.CREATED_AT ? new Date(a.CREATED_AT).getTime() : 0);
        const dateB = b.ORDER_DATE ? new Date(b.ORDER_DATE).getTime() : (b.CREATED_AT ? new Date(b.CREATED_AT).getTime() : 0);

        if (dateA !== dateB) {
          return dateA - dateB;
        }

        const invA = a.INVOICE_ID || a.ORDER_ID || '';
        const invB = b.INVOICE_ID || b.ORDER_ID || '';
        return invA.localeCompare(invB);
      });

      // Find driver info
      const driver = drivers.find((d) => d.ID === driverId);
      const driverName = driver ? driver.NAME : driverId;
      const driverSignature = driver ? driver.SIGNATURE : null;

      drawPageHeader(doc, customerSearchTerm, driverName, sortedDriverInvoices, pageHeight, pageWidth, margin, fromDate, toDate, driverSignature);
    });
  }

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
    doc.save(`Pending_Invoices_Search_${customerSearchTerm.replace(/\s+/g, '_')}.pdf`);
  }
}

function drawPageHeader(
  doc: jsPDF,
  customerSearchTerm: string,
  driverName: string,
  invoices: any[],
  pageHeight: number,
  pageWidth: number,
  margin: number,
  fromDate?: string,
  toDate?: string,
  driverSignature?: string | null
) {
  // Header Background - Premium Slim Black Bar
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, 20, 'F');

  // Title - Centered Gold
  doc.setFontSize(13);
  doc.setTextColor(212, 175, 55); // Gold
  doc.setFont('helvetica', 'bold');
  doc.text('PENDING CUSTOMER INVOICES REPORT', pageWidth / 2, 13, { align: 'center' });

  let y = 24;

  // Metadata Box
  const hasDateFilter = !!(fromDate || toDate);
  const boxHeight = hasDateFilter ? 28 : 22;

  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, boxHeight, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Customer Filter:', margin + 8, y + 8);
  doc.text('Driver Name:', margin + 8, y + 15);
  if (hasDateFilter) {
    doc.text('Date Filter:', margin + 8, y + 22);
  }

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Matches: "${customerSearchTerm}"`, margin + 35, y + 8);
  doc.text(driverName, margin + 35, y + 15);
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
  doc.text('Total Invoices:', pageWidth - margin - 70, y + 8);
  doc.text('Total Value:', pageWidth - margin - 70, y + 15);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(totalCount.toString(), pageWidth - margin - 35, y + 8);
  doc.setTextColor(212, 175, 55); // Gold
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
      inv.LPO_ID || '-',
      inv.bhs_CUSTOMERS?.['CUSTOMER NAME'] || 'Unknown Customer',
      `AED ${(parseFloat(inv.AMOUNT) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ];
  });

  const tableOptions: any = {
    startY: y,
    head: [['Invoice Date', 'Invoice ID', 'LPO ID', 'Customer Name', 'Amount (AED)']],
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
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 'auto', halign: 'center' },
      4: { cellWidth: 35, fontStyle: 'bold', halign: 'center' }
    },
    margin: { left: margin, right: margin }
  };

  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions);

  const finalY = (doc as any).lastAutoTable?.finalY || y;
  let sigY = finalY + 15;

  if (sigY + 25 > pageHeight - 15) {
    doc.addPage();
    sigY = 25; // top of new page
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);

  // Driver Signature (Right)
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
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
}
