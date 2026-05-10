'use client';

export async function generateLpoPackingListPDF(order: any, items: any[], action: 'download' | 'print' = 'download') {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;
  const JsBarcodeModule = await import('jsbarcode');
  const JsBarcode = JsBarcodeModule.default || JsBarcodeModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `Packing_List_${order.ORDER_ID}` });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  
  // Header Background - Very Slim
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, 15, 'F');
  
  // Title - Centered
  doc.setFontSize(14);
  doc.setTextColor(212, 175, 55); // Gold
  doc.setFont('helvetica', 'bold');
  doc.text('PACKING LIST', pageWidth / 2, 10, { align: 'center' });

  let y = 25;

  // Row 1: Date, Order ID, User
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date(order.CREATED_AT).toLocaleDateString('en-GB')}`, margin, y);
  doc.text(`Order ID: ${order.ORDER_ID}`, pageWidth / 2, y, { align: 'center' });
  doc.text(`User: ${order.app_lpos_USERS?.NAME || 'N/A'}`, pageWidth - margin, y, { align: 'right' });

  y += 10;

  // Row 2: Customer Name
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"] || 'N/A', pageWidth / 2, y, { align: 'center' });
  
  y += 7;

  // High resolution barcode helper
  const getBarcodeDataURL = (text: string) => {
    if (!text) return null;
    const canvas = document.createElement('canvas');
    const scale = 4; 
    try {
      JsBarcode(canvas, text, {
        format: "CODE128",
        lineColor: "#000",
        width: 2 * scale,
        height: 50 * scale,
        displayValue: true,
        fontSize: 14 * scale,
        margin: 5 * scale,
        background: "#ffffff"
      });
      return canvas.toDataURL('image/png', 1.0);
    } catch (e) {
      return null;
    }
  };

  // Items Table
  const tableData = items.map((item, index) => {
    const productName = item.app_lpos_PRODUCTS?.["PRODUCT NAME"] || 'Unknown Product';
    const barcode = item.app_lpos_PRODUCTS?.["PRODUCT BARCODE"] || '';
    
    return [
      index + 1,
      { 
        content: `${productName}\n${barcode}`, 
        styles: { fontStyle: item.ITEMS_STATUS === 'Rejected' ? 'normal' : 'bold' } 
      },
      item.app_lpos_PRODUCTS?.["PRODUCT UNIT"] || item.app_lpos_PRODUCTS?.UNIT || 'PCS',
      barcode, 
      item.QTY_REQUEST,
      item.QTY_RECEIVED || '0',
      item.ITEMS_STATUS === 'Approved' ? 'OK' : item.ITEMS_STATUS === 'Rejected' ? 'REJECTED' : item.ITEMS_STATUS
    ];
  });

  const tableOptions: any = {
    startY: y,
    head: [['#', 'Item Description & Barcode', 'Unit', 'Barcode Scanner', 'Req.', 'Packed', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: [10, 10, 10], 
      textColor: [212, 175, 55], 
      fontStyle: 'bold', 
      halign: 'center',
      valign: 'middle',
      fontSize: 9
    },
    bodyStyles: { 
      halign: 'center',
      valign: 'middle',
      fontSize: 10, 
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'center' },
      2: { cellWidth: 15, halign: 'center' }, 
      3: { cellWidth: 55, minCellHeight: 22, halign: 'center', fontSize: 8 }, 
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 25, halign: 'center' }, // Explicitly center Status column
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data: any) => {
      if (data.row.section === 'body' && data.column.index === 3) {
        const barcodeText = items[data.row.index]?.app_lpos_PRODUCTS?.["PRODUCT BARCODE"];
        if (barcodeText) {
          const barcodeImg = getBarcodeDataURL(barcodeText);
          if (barcodeImg) {
            const padX = 2;
            const padY = 2;
            const imgWidth = data.cell.width - (padX * 2);
            const imgHeight = data.cell.height - (padY * 2);
            doc.addImage(barcodeImg, 'PNG', data.cell.x + padX, data.cell.y + padY, imgWidth, imgHeight, undefined, 'FAST');
          }
        }
      }
    },
    didParseCell: (data: any) => {
      if (data.row.section === 'body' && data.column.index === 6) {
        if (data.cell.raw?.toString().includes('REJECTED')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw?.toString().includes('OK')) {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.row.section === 'body' && (items[data.row.index]?.ITEMS_STATUS === 'Rejected')) {
        data.cell.styles.textColor = [150, 150, 150];
      }
    }
  };

  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions);

  let finalY = (doc as any).lastAutoTable.finalY + 10;

  // Notes
  if (order.NOTES) {
    if (finalY > 260) { doc.addPage(); finalY = 20; }
    doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'bold');
    doc.text('ADMIN NOTES:', margin, finalY);
    finalY += 5;
    doc.setFontSize(9); doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(order.NOTES, pageWidth - 2 * margin), margin, finalY);
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(`Document generated on ${new Date().toLocaleString('en-GB')} • Page 1 of 1`, pageWidth / 2, 285, { align: 'center' });

  // Summary Calculations
  const totalProducts = items.length;
  const totalRequested = items.reduce((sum, item) => sum + (parseFloat(item.QTY_REQUEST) || 0), 0);
  const totalApproved = items.reduce((sum, item) => sum + (parseFloat(item.QTY_RECEIVED) || 0), 0);
  const totalAmount = items.reduce((sum, item) => {
    if (item.ITEMS_STATUS === 'Rejected') return sum;
    return sum + ((parseFloat(item.PRICE) || 0) * (parseFloat(item.QTY_RECEIVED) || 0));
  }, 0);

  // Draw Summary Box
  if (finalY > 240) { doc.addPage(); finalY = 20; }
  else { finalY += 4; }

  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(margin, finalY, pageWidth - 2 * margin, 25, 3, 3, 'FD');

  const colWidth = (pageWidth - 2 * margin) / 4;
  const summaryY = finalY + 8;

  const drawMetric = (label: string, value: string, x: number) => {
    doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'bold');
    doc.text(label, x + colWidth / 2, summaryY, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
    doc.text(value, x + colWidth / 2, summaryY + 10, { align: 'center' });
  };

  drawMetric('TOTAL PRODUCTS', totalProducts.toString(), margin);
  drawMetric('QTY REQUESTED', totalRequested.toString(), margin + colWidth);
  drawMetric('QTY SENT', totalApproved.toString(), margin + colWidth * 2);
  drawMetric('TOTAL VALUE', `AED ${totalAmount.toFixed(2)}`, margin + colWidth * 3);

  if (action === 'print') {
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  } else {
    doc.save(`Packing_List_${order.ORDER_ID}.pdf`);
  }
}
