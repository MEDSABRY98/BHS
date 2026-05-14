'use client';

export async function generateLpoPackingListPDF(
  order: any, 
  items: any[], 
  action: 'download' | 'print' = 'download',
  prepStaff: any[] = [],
  deliveryData: any = null
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;
  const JsBarcodeModule = await import('jsbarcode');
  const JsBarcode = JsBarcodeModule.default || JsBarcodeModule;
  const QRCode = (await import('qrcode')).default;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `Packing_List_${order.ORDER_ID}` });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  // High resolution barcode helper
  const getBarcodeDataURL = (text: string, options: { lineWidth?: number, displayValue?: boolean, fontSize?: number } = {}) => {
    if (!text) return null;
    const canvas = document.createElement('canvas');
    const scale = 4; 
    
    const lineWidth = options.lineWidth || (text.length > 25 ? 1 : 2);
    const displayValue = options.displayValue ?? false;
    const fontSize = options.fontSize || 14;
    
    try {
      JsBarcode(canvas, text, {
        format: "CODE128",
        lineColor: "#000",
        width: lineWidth * scale,
        height: 50 * scale,
        displayValue: displayValue,
        fontSize: fontSize * scale,
        margin: 5 * scale,
        background: "#ffffff"
      });
      return canvas.toDataURL('image/png', 1.0);
    } catch (e) {
      return null;
    }
  };

  // QR Code helper for long text (Customer Name)
  const getQRCodeDataURL = async (text: string) => {
    if (!text) return null;
    try {
      return await QRCode.toDataURL(text, { 
        margin: 1, 
        width: 400,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (e) {
      return null;
    }
  };
  
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

  // Row 2: Customer Name + QR Code
  const customerName = order.app_lpos_CUSTOMERS?.["CUSTOMER NAME"] || 'N/A';
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(customerName, pageWidth / 2, y, { align: 'center' });
  
  // Use QR Code for customer name because it handles long text much better than 1D barcodes
  const customerQR = await getQRCodeDataURL(customerName);
  if (customerQR) {
    y += 2;
    const qrSize = 30; // 30mm
    doc.addImage(customerQR, 'PNG', (pageWidth - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 5;
  } else {
    y += 7;
  }

  // 1. Filter out rejected items
  const activeItems = items.filter(item => item.ITEMS_STATUS !== 'Rejected');

  // Items Table
  const tableData = activeItems.map((item, index) => {
    const productName = item.app_lpos_PRODUCTS?.["PRODUCT NAME"] || 'Unknown Product';
    const barcode = item.app_lpos_PRODUCTS?.["PRODUCT BARCODE"] || '';
    
    return [
      barcode, // Placeholder for Scanner Image (Index 0)
      { 
        content: `${productName}\n${barcode}`, 
        styles: { fontStyle: 'bold' } 
      },
      item.UNIT || item.app_lpos_PRODUCTS?.["PRODUCT UNIT"] || 'PCS',
      item.QTY_RECEIVED || '0',
      item.PRICE || '0',
      item.ITEMS_STATUS === 'Approved' ? 'OK' : item.ITEMS_STATUS
    ];
  });

  const tableOptions: any = {
    startY: y,
    head: [['Barcode Scanner', 'Item Description & Barcode', 'Unit', 'Qty', 'Price', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: [10, 10, 10], 
      textColor: [212, 175, 55], 
      fontStyle: 'bold', 
      halign: 'center',
      valign: 'middle',
      fontSize: 8
    },
    bodyStyles: { 
      halign: 'center',
      valign: 'middle',
      fontSize: 9, 
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 45, minCellHeight: 18, halign: 'center' }, 
      1: { cellWidth: 'auto', halign: 'center' },
      2: { cellWidth: 15, halign: 'center' }, 
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' }, 
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data: any) => {
      if (data.row.section === 'body' && data.column.index === 0) {
        const barcodeText = activeItems[data.row.index]?.app_lpos_PRODUCTS?.["PRODUCT BARCODE"];
        if (barcodeText) {
          const barcodeImg = getBarcodeDataURL(barcodeText, { displayValue: true, fontSize: 10 });
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
      if (data.row.section === 'body' && data.column.index === 5) {
        if (data.cell.raw?.toString().includes('OK')) {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        }
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
  const totalProducts = activeItems.length;
  const totalApproved = activeItems.reduce((sum, item) => sum + (parseFloat(item.QTY_RECEIVED) || 0), 0);
  const totalAmount = activeItems.reduce((sum, item) => {
    return sum + ((parseFloat(item.PRICE) || 0) * (parseFloat(item.QTY_RECEIVED) || 0));
  }, 0);

  // Summary Calculations Block - Keep relative to content
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(margin, finalY, pageWidth - 2 * margin, 25, 3, 3, 'FD');

  const colWidth = (pageWidth - 2 * margin) / 3;
  const summaryY = finalY + 8;

  const drawMetric = (label: string, value: string, x: number) => {
    doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'bold');
    doc.text(label, x + colWidth / 2, summaryY, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
    doc.text(value, x + colWidth / 2, summaryY + 10, { align: 'center' });
  };

  drawMetric('TOTAL PRODUCTS', totalProducts.toString(), margin);
  drawMetric('QTY SENT', totalApproved.toString(), margin + colWidth);
  drawMetric('TOTAL VALUE', `AED ${totalAmount.toFixed(2)}`, margin + colWidth * 2);

  // Personnel / Logistics Section - ABSOLUTE BOTTOM OF LAST PAGE
  if (prepStaff.length > 0 || deliveryData) {
    const pageHeight = doc.internal.pageSize.getHeight();
    let personnelY = pageHeight - 35; // Positioned above footer

    // Line 1: Preparation Staff
    doc.setFontSize(8); 
    doc.setTextColor(120, 120, 120); 
    doc.setFont('helvetica', 'bold');
    const prepTitle = 'PREPARED BY: ';
    const prepNames = prepStaff.map(s => s.PREPARATION_NAME).join(', ') || 'N/A';
    doc.text(`${prepTitle}${prepNames}`, pageWidth / 2, personnelY, { align: 'center' });
    
    personnelY += 6;

    // Line 2: Driver & Assistant
    const driverName = deliveryData?.DRIVERS_NAME || 'N/A';
    const assistantName = deliveryData?.ASSISTANT_NAME || 'N/A';
    doc.text(`DRIVER: ${driverName}   |   ASSISTANT: ${assistantName}`, pageWidth / 2, personnelY, { align: 'center' });
  }

  if (action === 'print') {
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  } else {
    doc.save(`Packing_List_${order.ORDER_ID}.pdf`);
  }
}
