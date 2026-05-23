import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function generateDailyHandoverPDF(
  driverName: string,
  dateStr: string,
  invoices: any[],
  action: 'download' | 'print' = 'download',
  driverSignature?: string,
  adminSignature?: string
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const formattedHandoverDate = dateStr
    ? new Date(dateStr).toLocaleDateString('en-GB')
    : '-';
  
  doc.setProperties({ 
    title: `Daily_Handover_${driverName.replace(/\s+/g, '_')}_${dateStr.replace(/-/g, '_')}` 
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Total Summary stats
  const totalCount = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.AMOUNT) || 0), 0);

  // Table Data mapping
  const tableData = invoices.map((inv) => {
    const formattedOrderDate = inv.ORDER_DATE
      ? new Date(inv.ORDER_DATE).toLocaleDateString('en-GB')
      : (inv.CREATED_AT ? new Date(inv.CREATED_AT).toLocaleDateString('en-GB') : '-');

    return [
      formattedOrderDate,
      inv.INVOICE_ID || inv.ORDER_ID || '-',
      inv.bhs_CUSTOMERS?.['CUSTOMER NAME'] || 'Unknown Customer',
      `AED ${(parseFloat(inv.AMOUNT) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ];
  });

  // Header Background - Premium Slim Black Bar
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, 20, 'F');

  // Title - Centered Gold
  doc.setFontSize(14);
  doc.setTextColor(212, 175, 55); // Gold
  doc.setFont('helvetica', 'bold');
  doc.text('DAILY DRIVER HANDOVER REPORT', pageWidth / 2, 13, { align: 'center' });

  let y = 24;

  // Metadata Box
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 22, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Driver Name:', margin + 8, y + 8);
  doc.text('Handover Date:', margin + 8, y + 15);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(driverName, margin + 35, y + 8);
  doc.text(formattedHandoverDate, margin + 35, y + 15);

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
  doc.setTextColor(212, 175, 55); // Gold for final amount
  doc.text(`AED ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 35, y + 15);

  y += 28;

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
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'center' },
      3: { cellWidth: 35, fontStyle: 'bold', halign: 'center' }
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

  // Receiver Signature (Left)
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

  // Footer page numbers
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
    doc.save(`Daily_Handover_${driverName.replace(/\s+/g, '_')}_${dateStr}.pdf`);
  }
}
