'use client';

// Helper function to load and add Arabic font to jsPDF
import { getInvoiceType } from '@/lib/invoiceType';

export async function generateBulkDebitSummaryPDF(
  customers: Array<{
    customerName: string;
    salesReps?: Set<string>;
    netDebt: number;
    lastPaymentDate?: Date | null;
    lastPaymentAmount?: number | null;
    lastSalesDate?: Date | null;
    lastSalesAmount?: number | null;
  }>
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;

  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('l', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let yPosition = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Debit Summary Report', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 7;

  // Company Name
  doc.setFontSize(12);
  doc.setTextColor(0, 155, 77);
  doc.setFont('helvetica', 'bold');
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPosition += 10;

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const currentDate = `${now.getDate()}-${now.toLocaleDateString('en-US', { month: 'short' })}-${now.getFullYear()}`;
  doc.text(`Date: ${currentDate}`, margin, yPosition);
  yPosition += 8;

  // Table data
  // Sort by city (sales rep) and then by net debt descending
  const sortedCustomers = [...customers].sort((a, b) => {
    const cityA = a.salesReps ? Array.from(a.salesReps).join(', ') : '';
    const cityB = b.salesReps ? Array.from(b.salesReps).join(', ') : '';

    // Primary sort: City
    if (cityA < cityB) return -1;
    if (cityA > cityB) return 1;

    // Secondary sort: Net Debt descending
    return b.netDebt - a.netDebt;
  });

  const formatDmy = (d?: Date | null) => {
    if (!d) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  };

  const tableData = sortedCustomers.map((c, index) => {
    const reps = c.salesReps ? Array.from(c.salesReps).join(', ') : '';

    // Payment Data
    let paymentDate = '-';
    let paymentAmount = '-';
    let paymentDays = '-';
    if (c.lastPaymentDate) {
      paymentDate = formatDmy(c.lastPaymentDate);
      paymentAmount = (c.lastPaymentAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const diffTime = Math.abs(now.getTime() - c.lastPaymentDate.getTime());
      paymentDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)).toString();
    }

    // Sales Data
    let salesDate = '-';
    let salesAmount = '-';
    let salesDays = '-';
    if (c.lastSalesDate) {
      salesDate = formatDmy(c.lastSalesDate);
      salesAmount = (c.lastSalesAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const diffTime = Math.abs(now.getTime() - c.lastSalesDate.getTime());
      salesDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)).toString();
    }

    return [
      (index + 1).toString(),
      c.customerName,
      reps,
      c.netDebt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      paymentDate,
      paymentAmount,
      paymentDays,
      salesDate,
      salesAmount,
      salesDays
    ];
  });

  const totalDebt = customers.reduce((sum, c) => sum + c.netDebt, 0);

  // Add total row
  tableData.push([
    '',
    'TOTAL',
    '',
    totalDebt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    '', '', '', '', '', ''
  ]);

  const tableOptions: any = {
    startY: yPosition,
    head: [
      [
        { content: '#', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Customer Name', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'City', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Balance', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Last Payment', colSpan: 3, styles: { halign: 'center', fillColor: [220, 252, 231], textColor: [21, 128, 61] } },
        { content: 'Last Sale', colSpan: 3, styles: { halign: 'center', fillColor: [219, 234, 254], textColor: [29, 78, 216] } },
      ],
      [
        { content: 'Date', styles: { halign: 'center', fillColor: [220, 252, 231], textColor: [21, 128, 61] } },
        { content: 'Amt', styles: { halign: 'center', fillColor: [220, 252, 231], textColor: [21, 128, 61] } },
        { content: 'Days', styles: { halign: 'center', fillColor: [220, 252, 231], textColor: [21, 128, 61] } },
        { content: 'Date', styles: { halign: 'center', fillColor: [219, 234, 254], textColor: [29, 78, 216] } },
        { content: 'Amt', styles: { halign: 'center', fillColor: [219, 234, 254], textColor: [29, 78, 216] } },
        { content: 'Days', styles: { halign: 'center', fillColor: [219, 234, 254], textColor: [29, 78, 216] } },
      ]
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 8,
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 10 }, // #
      1: { cellWidth: 80, halign: 'center', font: 'Amiri', textColor: [0, 0, 0] }, // Name (Wide)
      2: { cellWidth: 25, halign: 'center' }, // City
      3: { cellWidth: 30, fontStyle: 'bold' }, // Balance
      // Payment
      4: { cellWidth: 25 }, // Date
      5: { cellWidth: 25 }, // Amt
      6: { cellWidth: 15 }, // Days
      // Sales
      7: { cellWidth: 25 }, // Date
      8: { cellWidth: 25 }, // Amt
      9: { cellWidth: 15 }, // Days
    },
    margin: { left: 10, right: 10 },
    didParseCell: (data: any) => {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    }
  };

  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions);
  }

  // City Summary Logic - Add a new page if more than one city exists
  const cityStatsMap = new Map<string, { totalDebt: number; customerCount: number }>();
  customers.forEach(c => {
    const city = c.salesReps && c.salesReps.size > 0 ? Array.from(c.salesReps).join(', ') : 'Unknown City';
    const stats = cityStatsMap.get(city) || { totalDebt: 0, customerCount: 0 };
    stats.totalDebt += c.netDebt;
    stats.customerCount += 1;
    cityStatsMap.set(city, stats);
  });

  if (cityStatsMap.size > 1) {
    doc.addPage('a4', 'p');
    yPosition = 20;

    const portraitPageWidth = doc.internal.pageSize.getWidth();

    // Summary Page Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('City Summary Report', portraitPageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Company Name
    doc.setFontSize(12);
    doc.setTextColor(0, 155, 77);
    doc.setFont('helvetica', 'bold');
    doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', portraitPageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const nowSummary = new Date();
    const currentDateSummary = `${nowSummary.getDate()}-${nowSummary.toLocaleDateString('en-US', { month: 'short' })}-${nowSummary.getFullYear()}`;
    doc.text(`Date: ${currentDateSummary}`, margin, yPosition);
    yPosition += 8;

    const cityTableData = Array.from(cityStatsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([city, stats]) => [
        city,
        stats.totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        stats.customerCount.toString()
      ]);

    // Add Grand Total Row to Summary Table
    const grandTotalDebt = customers.reduce((sum, c) => sum + c.netDebt, 0);
    cityTableData.push([
      'GRAND TOTAL',
      grandTotalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      customers.length.toString()
    ]);

    const cityTableOptions: any = {
      startY: yPosition,
      head: [['City', 'Total Balance', 'Customers Count']],
      body: cityTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 10,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 100, halign: 'center' },
        1: { cellWidth: 50, halign: 'center' },
        2: { cellWidth: 40, halign: 'center' }
      },
      margin: { left: 10, right: 10 },
      didParseCell: (data: any) => {
        if (data.row.index === cityTableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    };

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(cityTableOptions);
    } else if (typeof autoTable === 'function') {
      autoTable(doc, cityTableOptions);
    }
  }

  return doc.output('blob');
}

const TYPE_BADGE_COLORS: Record<
  string,
  { fillColor: [number, number, number]; textColor: [number, number, number] }
> = {
  Sales: { fillColor: [219, 234, 254], textColor: [29, 78, 216] }, // bg-blue-100 / text-blue-700
  Return: { fillColor: [255, 237, 213], textColor: [194, 65, 12] }, // bg-orange-100 / text-orange-700
  Payment: { fillColor: [220, 252, 231], textColor: [21, 128, 61] }, // bg-green-100 / text-green-700
  'R-Payment': { fillColor: [254, 226, 226], textColor: [185, 28, 28] }, // bg-red-100 / text-red-700
  Discount: { fillColor: [254, 249, 195], textColor: [161, 98, 7] }, // bg-yellow-100 / text-yellow-700
  OB: { fillColor: [243, 232, 255], textColor: [126, 34, 206] }, // bg-purple-100 / text-purple-700
  'Our-Paid': { fillColor: [209, 250, 229], textColor: [6, 95, 70] }, // bg-emerald-100 / text-emerald-800
  'Invoice/Txn': { fillColor: [241, 245, 249], textColor: [51, 65, 85] }, // bg-slate-100 / text-slate-700
};

export async function addArabicFont(doc: any): Promise<void> {
  try {
    // Load Amiri Arabic font from GitHub raw content (reliable CORS-wise usually)
    const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf';

    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch Arabic font');
    }

    const fontArrayBuffer = await response.arrayBuffer();

    // Convert to Base64
    // In browser environment, we can use btoa with Uint8Array
    let binary = '';
    const bytes = new Uint8Array(fontArrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const fontBase64 = btoa(binary);

    // Add font to jsPDF
    doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');

    console.log('Arabic font (Amiri) loaded successfully');
  } catch (error) {
    console.warn('Failed to load Arabic font:', error);
  }
}

export async function generateBulkCustomerStatementsPDF(
  statements: Array<{
    customerName: string;
    invoices: Array<{
      date: string;
      number: string;
      debit: number;
      credit: number;
      netDebt: number;
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
    const { customerName, invoices } = statements[i];
    if (i > 0) doc.addPage();
    const startPage = doc.internal.getNumberOfPages();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = 20;

    // Calculate total table width
    const tableWidth = 40 + 35 + 65 + 40 + 40 + 40; // 260mm
    const tableLeftMargin = (pageWidth - tableWidth) / 2;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Account Statement', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;

    // Company Name
    doc.setFontSize(12);
    doc.setTextColor(0, 155, 77);
    doc.setFont('helvetica', 'bold');
    doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    // Customer Name
    doc.setFontSize(14);
    doc.setFont('Amiri', 'normal');
    doc.text(`Customer: ${customerName}`, margin, yPosition);
    yPosition += 8;

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const currentDate = `${now.getDate()}-${now.toLocaleDateString('en-US', { month: 'short' })}-${now.getFullYear()}`;
    doc.text(`Date: ${currentDate}`, margin, yPosition);
    yPosition += 8;

    // Prepare table data
    const tableData = invoices.map((inv) => {
      let dateStr = '';
      if (inv.date) {
        const date = new Date(inv.date);
        if (!isNaN(date.getTime())) {
          dateStr = `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
        }
      }
      let type = getInvoiceType(inv);
      if (inv.date && (type === 'Sales' || type === 'Return' || type === 'Discount' || type === 'Payment' || type === 'R-Payment' || type === 'Our-Paid')) {
        const d = new Date(inv.date);
        if (!isNaN(d.getTime())) {
          const yy = d.getFullYear().toString().slice(-2);
          type = `${type} ${yy}`;
        }
      }
      return [
        dateStr,
        type,
        inv.number || '',
        inv.debit.toLocaleString('en-US'),
        inv.credit.toLocaleString('en-US'),
        inv.netDebt.toLocaleString('en-US')
      ];
    });

    const totalDebit = invoices.reduce((sum, inv) => sum + inv.debit, 0);
    const totalCredit = invoices.reduce((sum, inv) => sum + inv.credit, 0);
    const totalNetDebt = totalDebit - totalCredit;

    const tableOptions = {
      startY: yPosition,
      margin: { left: tableLeftMargin, right: tableLeftMargin },
      head: [['Date', 'Type', 'Number', 'Debit', 'Credit', 'Net Debit']],
      body: tableData,
      theme: 'striped' as const,
      styles: {
        font: 'helvetica',
        fontStyle: 'normal',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center',
        font: 'helvetica'
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 40, halign: 'center', font: 'helvetica' }, // Date
        1: { cellWidth: 35, halign: 'center', font: 'helvetica' }, // Type
        2: { cellWidth: 65, halign: 'center', font: 'Amiri' }, // Number
        3: { cellWidth: 40, halign: 'center', font: 'helvetica' }, // Debit
        4: { cellWidth: 40, halign: 'center', font: 'helvetica' }, // Credit
        5: { cellWidth: 40, halign: 'center', font: 'helvetica' }  // Net Debt
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: 0,
        fontStyle: 'bold',
        fontSize: 10,
        font: 'helvetica'
      },
      didParseCell: function (data: any) {
        if (data.section === 'head') {
          data.cell.styles.textColor = 255;
          return;
        }
        const inv = invoices[data.row.index];
        const isReturnPayment = inv && getInvoiceType(inv) === 'R-Payment';
        if (isReturnPayment && data.column.index !== 1) {
          data.cell.styles.fillColor = [255, 235, 235];
        }
        if (data.column.index === 1 && data.row.index < tableData.length) {
          data.cell.styles.textColor = [255, 255, 255];
        }
        if (data.column.index === 5 && data.row.index < tableData.length) {
          const nd = invoices[data.row.index].netDebt;
          if (nd > 0) data.cell.styles.textColor = [204, 0, 0];
          else if (nd < 0) data.cell.styles.textColor = [0, 153, 0];
        }
      },
      didDrawCell: function (data: any) {
        if (data.section === 'body' && data.column.index === 1 && data.row.index < tableData.length) {
          const inv = invoices[data.row.index];
          if (!inv) return;
          const text = Array.isArray(data.cell.text) ? data.cell.text.join('') : data.cell.text;
          const type = getInvoiceType(inv);

          let colors = TYPE_BADGE_COLORS[type];
          if (!colors) {
            const baseType = type.split(' ')[0];
            colors = TYPE_BADGE_COLORS[baseType] || TYPE_BADGE_COLORS['Invoice/Txn'];
          }

          const isReturnPayment = inv && type === 'R-Payment';
          const fillColor = isReturnPayment ? [254, 226, 226] : colors.fillColor;
          const textColor = isReturnPayment ? [185, 28, 28] : colors.textColor;
          const { x, y, width, height } = data.cell;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          const textWidth = doc.getTextWidth(text);
          const badgeWidth = textWidth + 6;
          const badgeHeight = 5;
          const badgeX = x + (width - badgeWidth) / 2;
          const badgeY = y + (height - badgeHeight) / 2;
          doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
          doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'F');
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.text(text, x + width / 2, y + height / 2, { align: 'center', baseline: 'middle' });
        }
      }
    };

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableOptions);
    } else {
      if (typeof autoTable === 'function') {
        autoTable(doc, tableOptions as any);
      }
    }

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;
    const totalBoxWidth = 50;
    const totalBoxHeight = 15;
    const totalBoxX = tableLeftMargin + tableWidth - totalBoxWidth;
    let totalBoxY = finalY + 5;
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomMargin = 20;

    if (totalBoxY + totalBoxHeight > pageHeight - bottomMargin) {
      doc.addPage();
      totalBoxY = 20;
    }

    doc.setFillColor(240, 240, 240);
    doc.rect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL DUE', totalBoxX + totalBoxWidth / 2, totalBoxY + 6, { align: 'center' });
    doc.setFontSize(14);
    doc.text(totalNetDebt.toLocaleString('en-US'), totalBoxX + totalBoxWidth / 2, totalBoxY + 12, { align: 'center' });

    const endPage = doc.internal.getNumberOfPages();
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
    const startPage = doc.internal.getNumberOfPages();

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
      // Try verify date
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

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableOptions);
    } else {
      if (typeof autoTable === 'function') {
        autoTable(doc, tableOptions as any);
      }
    }

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;

    // Total Box
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
    doc.setTextColor(0, 0, 0);
    doc.text('NET BALANCE', totalBoxX + totalBoxWidth / 2, totalBoxY + 6, { align: 'center' });
    doc.setFontSize(14);
    doc.text(netBalance.toLocaleString('en-US'), totalBoxX + totalBoxWidth / 2, totalBoxY + 12, { align: 'center' });

    // Page Numbering
    const endPage = doc.internal.getNumberOfPages();
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

export async function generateAccountStatementPDF(
  customerName: string,
  invoices: Array<{
    date: string;
    number: string;
    debit: number;
    credit: number;
    netDebt: number;
  }>,
  returnBlob: boolean = false,
  monthsLabel: string = 'All Months'
) {
  // 1. Dynamic imports inside the function to ensure they run on the client side
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;

  // 2. Import autoTable module
  const autoTableModule = await import('jspdf-autotable');
  // Try to get the function from default export or the module itself
  const autoTable = autoTableModule.default || autoTableModule;

  // 3. Create document
  const doc = new jsPDF('l', 'mm', 'a4');

  // 3.5. Add Arabic font support
  await addArabicFont(doc);

  // 4. Explicitly apply the plugin if doc.autoTable is missing (Common issue fix)
  if (typeof (doc as any).autoTable !== 'function') {
    // Sometimes autotable needs to be registered manually if side-effect didn't work
    // In newer versions, we might just use autoTable(doc, options) directly
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPosition = 20;

  // Calculate total table width
  const tableWidth = 40 + 35 + 65 + 40 + 40 + 40; // Date + Type + Number + Debit + Credit + Net = 260mm
  // Calculate left margin to center the table
  const tableLeftMargin = (pageWidth - tableWidth) / 2;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold'); // Use Helvetica for English title
  doc.text('Account Statement', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 7;

  // Company Name
  doc.setFontSize(12);
  doc.setTextColor(0, 155, 77); // Green color
  doc.setFont('helvetica', 'bold'); // Use Helvetica for English company name
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
  doc.setTextColor(0, 0, 0); // Reset color to black
  yPosition += 10;

  // Customer Name
  doc.setFontSize(14);
  doc.setFont('Amiri', 'normal'); // Use Arabic font for customer name (likely has Arabic)
  doc.text(`Customer: ${customerName}`, margin, yPosition);
  yPosition += 8;

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal'); // Date uses English chars
  const now = new Date();
  const currentDate = `${now.getDate()}-${now.toLocaleDateString('en-US', { month: 'short' })}-${now.getFullYear()}`;
  doc.text(`Date: ${currentDate}`, margin, yPosition);
  yPosition += 8; // Reduced spacing by ~50%

  // Prepare table data
  const tableData = invoices.map((inv) => {
    let dateStr = '';
    if (inv.date) {
      const date = new Date(inv.date);
      if (!isNaN(date.getTime())) {
        dateStr = `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
      }
    }
    let type = getInvoiceType(inv);
    if (inv.date && (type === 'Sales' || type === 'Return' || type === 'Discount' || type === 'Payment' || type === 'R-Payment' || type === 'Our-Paid')) {
      const d = new Date(inv.date);
      if (!isNaN(d.getTime())) {
        const yy = d.getFullYear().toString().slice(-2);

        let base = type;
        // Logic for R-Payment is now handled by check in helper, so returns 'R-Payment'
        // Just append YY
        type = `${base} ${yy}`;
      }
    }
    return [
      dateStr,
      type,
      inv.number || '',
      inv.debit.toLocaleString('en-US'),
      inv.credit.toLocaleString('en-US'),
      inv.netDebt.toLocaleString('en-US')
    ];
  });

  // Calculate totals
  const totalDebit = invoices.reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = invoices.reduce((sum, inv) => sum + inv.credit, 0);
  // Calculate total net debt as difference between total debit and total credit to ensure consistency
  const totalNetDebt = totalDebit - totalCredit;

  // Define Table Options
  const tableOptions = {
    startY: yPosition,
    margin: { left: tableLeftMargin, right: tableLeftMargin }, // Center the table
    head: [['Date', 'Type', 'Number', 'Debit', 'Credit', 'Net Debit']],
    body: tableData,
    theme: 'striped' as const,
    styles: {
      font: 'helvetica', // Default to Helvetica for most cells
      fontStyle: 'normal',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [0, 0, 0], // Black background
      textColor: 255, // White text
      fontStyle: 'bold', // Bold looks better in Helvetica
      fontSize: 10,
      halign: 'center', // Center header text
      font: 'helvetica' // Headers are English
    },
    bodyStyles: {
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 40, halign: 'center', font: 'helvetica' }, // Date
      1: { cellWidth: 35, halign: 'center', font: 'helvetica' }, // Type
      2: { cellWidth: 65, halign: 'center', font: 'Amiri' }, // Number - Contains Arabic text
      3: { cellWidth: 40, halign: 'center', font: 'helvetica' }, // Debit
      4: { cellWidth: 40, halign: 'center', font: 'helvetica' }, // Credit
      5: { cellWidth: 40, halign: 'center', font: 'helvetica' }  // Net Debt
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: 10,
      font: 'helvetica' // Total row is English/Numbers
    },
    didParseCell: function (data: any) {
      // Ensure header text remains white
      if (data.section === 'head') {
        data.cell.styles.textColor = 255;
        return;
      }

      const inv = invoices[data.row.index];
      const isReturnPayment = inv && getInvoiceType(inv) === 'R-Payment';

      if (isReturnPayment && data.column.index !== 1) {
        data.cell.styles.fillColor = [255, 235, 235]; // Light red highlight
      }

      // Style Type column
      if (data.column.index === 1 && data.row.index < tableData.length) {
        // No longer full cell fill. Badge drawn in didDrawCell.
        // Make default text transparent/white so it doesn't show behind our custom drawn text
        data.cell.styles.textColor = [255, 255, 255];
      }

      // Color Net Debt column
      if (data.column.index === 5 && data.row.index < tableData.length) {
        const netDebt = invoices[data.row.index].netDebt;
        if (netDebt > 0) {
          data.cell.styles.textColor = [204, 0, 0]; // Red
        } else if (netDebt < 0) {
          data.cell.styles.textColor = [0, 153, 0]; // Green
        }
      }
    },
    didDrawCell: function (data: any) {
      // Draw condensed badge for Type column
      if (data.section === 'body' && data.column.index === 1 && data.row.index < tableData.length) {
        const inv = invoices[data.row.index];
        if (!inv) return;

        const text = Array.isArray(data.cell.text) ? data.cell.text.join('') : data.cell.text;
        const type = getInvoiceType(inv);

        const colors = TYPE_BADGE_COLORS[type] || TYPE_BADGE_COLORS['Invoice/Txn'];
        const isReturnPayment = inv && type === 'R-Payment';
        const fillColor = isReturnPayment ? [254, 226, 226] : colors.fillColor;
        const textColor = isReturnPayment ? [185, 28, 28] : colors.textColor;

        const { x, y, width, height } = data.cell;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        const textWidth = doc.getTextWidth(text);
        const badgeWidth = textWidth + 6;
        const badgeHeight = 5;

        const badgeX = x + (width - badgeWidth) / 2;
        const badgeY = y + (height - badgeHeight) / 2;

        // Draw Badge
        doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'F');

        // Draw Text
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(text, x + width / 2, y + height / 2, { align: 'center', baseline: 'middle' });
      }
    }
  };

  // Generate Table
  // Try using doc.autoTable if available (plugin style)
  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else {
    // Fallback: Use the imported function directly (module style)
    // Depending on version, it might be autoTable(doc, options)
    if (typeof autoTable === 'function') {
      // Cast tableOptions to any to avoid strict type checking issues with 'theme'
      autoTable(doc, tableOptions as any);
    } else {
      console.error('autoTable is not a function', autoTable);
      throw new Error('Failed to load autoTable plugin');
    }
  }

  // Get final Y position after table
  const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;

  // Add TOTAL DUE box on the right, aligned with table right edge
  const totalBoxWidth = 50;
  const totalBoxHeight = 15;
  const totalBoxX = tableLeftMargin + tableWidth - totalBoxWidth; // Aligned with table right edge

  // Check if we need a new page
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 20;
  let totalBoxY = finalY + 5;

  if (totalBoxY + totalBoxHeight > pageHeight - bottomMargin) {
    doc.addPage();
    totalBoxY = 20; // Start at top of new page
  }

  // Draw light gray box (without border)
  doc.setFillColor(240, 240, 240); // Light gray background
  doc.rect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight, 'F');

  // Add "TOTAL DUE" text
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0); // Black text
  doc.text('TOTAL DUE', totalBoxX + totalBoxWidth / 2, totalBoxY + 6, { align: 'center' });

  // Add total amount
  doc.setFontSize(14);
  doc.text(totalNetDebt.toLocaleString('en-US'), totalBoxX + totalBoxWidth / 2, totalBoxY + 12, { align: 'center' });

  // Add Page Numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${totalPages}`, margin, doc.internal.pageSize.getHeight() - 10);
  }

  // Save PDF
  const fileName = `${customerName}.pdf`;

  if (returnBlob) {
    return doc.output('blob');
  }

  doc.save(fileName);
}

export async function generateWaterDeliveryNotePDF(
  data: {
    companyName: string;
    deliveryNoteNumber: string;
    date: string;
    lines: Array<{ itemName: string; quantity: number; unitType: 'Outer' }>;
    total: { outer: number; pcs: number };
    signatures?: string[];
  },
  returnBlob: boolean = false
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;

  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Water - Delivery Note', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Company Name
  doc.setFontSize(14);
  doc.setTextColor(0, 155, 77);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName, pageWidth / 2, yPosition, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPosition += 15;

  // Delivery Note Number and Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const leftInfo = `Delivery Note No: ${data.deliveryNoteNumber || 'N/A'}`;
  const rightInfo = `Date: ${data.date || new Date().toISOString().split('T')[0]}`;
  doc.text(leftInfo, margin, yPosition);
  doc.text(rightInfo, pageWidth - margin - doc.getTextWidth(rightInfo), yPosition);
  yPosition += 11; // Reduced by 25% (from 15 to 11)

  // Table
  const tableData = data.lines
    .filter(line => line.itemName && line.quantity > 0)
    .map(line => [
      line.itemName,
      line.quantity.toString(),
      line.unitType
    ]);

  // Add total rows - one for Outer, one for PCS
  if (data.total.outer > 0) {
    tableData.push([
      'TOTAL OUTER',
      data.total.outer.toString(),
      'Outer'
    ]);
  }
  if (data.total.pcs > 0) {
    tableData.push([
      'TOTAL PCS',
      data.total.pcs.toString(),
      'PCS'
    ]);
  }

  const tableOptions: any = {
    startY: yPosition,
    head: [['Item Name', 'Quantity', 'Unit Type']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 155, 77],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 100 },
      1: { halign: 'center', cellWidth: 40 },
      2: { halign: 'center', cellWidth: 40 }
    },
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    didParseCell: (hookData: any) => {
      // Make total row bold
      const totalRowsStart = tableData.length - (data.total.outer > 0 ? 1 : 0);
      if (hookData.row.index >= totalRowsStart) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [240, 240, 240];
      }
    }
  };

  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions);
  }

  const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;

  // Signatures section
  yPosition = finalY + 20;
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  // Signature names
  const signatureNames = ['MONAI', 'OMAR', 'SALAM'];
  const signatureCount = signatureNames.length;
  const signatureBoxWidth = (pageWidth - 2 * margin) / signatureCount;
  const signatureBoxHeight = 30;
  const signatureY = yPosition;

  signatureNames.forEach((name, index) => {
    const xPos = margin + (index * signatureBoxWidth);

    // Draw box
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(xPos + 5, signatureY, signatureBoxWidth - 10, signatureBoxHeight);

    // Add name
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(name, xPos + (signatureBoxWidth / 2), signatureY + 8, { align: 'center' });

    // Add signature line
    doc.setLineWidth(0.3);
    doc.line(xPos + 15, signatureY + 20, xPos + signatureBoxWidth - 15, signatureY + 20);

    // Add "Signature" label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Signature', xPos + (signatureBoxWidth / 2), signatureY + 26, { align: 'center' });
  });

  const fileName = `Water_Delivery_Note_${data.deliveryNoteNumber || 'DN'}_${data.date || 'date'}.pdf`;

  if (returnBlob) {
    return doc.output('blob');
  }

  doc.save(fileName);
}

export async function generateMonthlySeparatedPDF(
  customerName: string,
  invoices: Array<{
    date: string;
    number: string;
    debit: number;
    credit: number;
    netDebt: number;
  }>
) {
  // 1. Dynamic imports
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;

  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  // 2. Group invoices by Month-Year (YYYY-MM)
  const invoicesByMonth: Record<string, typeof invoices> = {};

  invoices.forEach((inv) => {
    if (!inv.date) return;
    const date = new Date(inv.date);
    if (isNaN(date.getTime())) return;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;

    if (!invoicesByMonth[key]) {
      invoicesByMonth[key] = [];
    }
    invoicesByMonth[key].push(inv);
  });

  // 3. Sort keys Oldest to Newest
  const sortedKeys = Object.keys(invoicesByMonth).sort();

  if (sortedKeys.length === 0) {
    console.warn('No valid invoices to generate PDF');
    return;
  }

  // 4. Create Doc
  const doc = new jsPDF('l', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();

  // Loop through each month
  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const monthInvoices = invoicesByMonth[key];

    // Determine Month Label (e.g. "January 2025")
    const [yearStr, monthStr] = key.split('-');
    const dateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1);
    const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // Add new page for subsequent months
    if (i > 0) {
      doc.addPage();
    }

    const margin = 15;
    let yPosition = 20;

    // Calculate total table width
    const tableWidth = 40 + 35 + 65 + 40 + 40 + 40;
    const tableLeftMargin = (pageWidth - tableWidth) / 2;

    // --- HEADER ---
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Account Statement', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;

    // Company Name
    doc.setFontSize(12);
    doc.setTextColor(0, 155, 77);
    doc.setFont('helvetica', 'bold');
    doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    // Customer Name + Month Label
    doc.setFontSize(14);
    doc.setFont('Amiri', 'normal');
    // User requested: under customer name or with it, put month name in parentheses
    doc.text(`Customer: ${customerName} (${monthLabel})`, margin, yPosition);
    yPosition += 8;

    // Date (Current Date of generation)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const currentDate = `${now.getDate()}-${now.toLocaleDateString('en-US', { month: 'short' })}-${now.getFullYear()}`;
    doc.text(`Generated: ${currentDate}`, margin, yPosition);
    yPosition += 8;

    // --- TABLE DATA ---
    const tableData = monthInvoices.map((inv) => {
      let dateStr = '';
      if (inv.date) {
        const date = new Date(inv.date);
        if (!isNaN(date.getTime())) {
          dateStr = `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
        }
      }
      let type = getInvoiceType(inv);
      if (inv.date && (type === 'Sales' || type === 'Return' || type === 'Discount' || type === 'Payment' || type === 'R-Payment' || type === 'Our-Paid')) {
        const d = new Date(inv.date);
        if (!isNaN(d.getTime())) {
          const yy = d.getFullYear().toString().slice(-2);
          type = `${type} ${yy}`;
        }
      }
      return [
        dateStr,
        type,
        inv.number || '',
        inv.debit.toLocaleString('en-US'),
        inv.credit.toLocaleString('en-US'),
        inv.netDebt.toLocaleString('en-US')
      ];
    });

    // Calculate totals for this month
    const totalDebit = monthInvoices.reduce((sum, inv) => sum + inv.debit, 0);
    const totalCredit = monthInvoices.reduce((sum, inv) => sum + inv.credit, 0);
    // Calculate total net debt as difference between total debit and total credit
    const totalNetDebt = totalDebit - totalCredit;

    tableData.push([
      '',
      '',
      'TOTAL',
      totalDebit.toLocaleString('en-US'),
      totalCredit.toLocaleString('en-US'),
      totalNetDebt.toLocaleString('en-US')
    ]);

    // --- TABLE OPTIONS ---
    // --- TABLE OPTIONS ---
    const tableOptions = {
      startY: yPosition,
      margin: { left: tableLeftMargin, right: tableLeftMargin },
      head: [['Date', 'Type', 'Number', 'Debit', 'Credit', 'Net Debit']],
      body: tableData,
      theme: 'striped' as const,
      styles: {
        font: 'helvetica',
        fontStyle: 'normal',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [0, 0, 0], // Black background to match total statement
        textColor: 255, // White text
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center',
        font: 'helvetica'
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 40, halign: 'center', font: 'helvetica' },
        1: { cellWidth: 35, halign: 'center', font: 'helvetica' },
        2: { cellWidth: 65, halign: 'center', font: 'Amiri' },
        3: { cellWidth: 40, halign: 'center', font: 'helvetica' },
        4: { cellWidth: 40, halign: 'center', font: 'helvetica' },
        5: { cellWidth: 40, halign: 'center', font: 'helvetica' }
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: 0,
        fontStyle: 'bold',
        fontSize: 10,
        font: 'helvetica'
      },
      didParseCell: function (data: any) {
        if (data.section === 'head') {
          data.cell.styles.textColor = 255;
          return;
        }
        if (data.row.index === tableData.length - 1) {
          // Style for TOTAL row in table
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = 0;
          return;
        }

        const inv = monthInvoices[data.row.index];
        const isReturnPayment = inv && getInvoiceType(inv) === 'R-Payment';

        if (isReturnPayment && data.column.index !== 1) {
          data.cell.styles.fillColor = [255, 235, 235];
        }

        // Style Type column
        if (data.column.index === 1 && data.row.index < tableData.length - 1) {
          const type = getInvoiceType(monthInvoices[data.row.index]);
          const colors = TYPE_BADGE_COLORS[type] || TYPE_BADGE_COLORS['Invoice/Txn'];
          data.cell.styles.fillColor = isReturnPayment ? [254, 226, 226] : colors.fillColor;
          data.cell.styles.textColor = isReturnPayment ? [185, 28, 28] : colors.textColor;
          data.cell.styles.fontStyle = 'bold';
        }

        if (data.column.index === 5 && data.row.index < tableData.length - 1) {
          const netDebt = monthInvoices[data.row.index].netDebt;
          if (netDebt > 0) {
            data.cell.styles.textColor = [204, 0, 0];
          } else if (netDebt < 0) {
            data.cell.styles.textColor = [0, 153, 0];
          }
        }
      }
    };

    // Draw Table
    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableOptions);
    } else if (typeof autoTable === 'function') {
      autoTable(doc, tableOptions as any);
    }

    // --- TOTAL DUE BOX (Per Month) ---
    // Get final Y position after table
    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;

    const totalBoxWidth = 50;
    const totalBoxHeight = 15;
    const totalBoxX = tableLeftMargin + tableWidth - totalBoxWidth;

    // Check if we need a new page for the total box
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomMargin = 20;
    let totalBoxY = finalY + 5;

    if (totalBoxY + totalBoxHeight > pageHeight - bottomMargin) {
      doc.addPage();
      totalBoxY = 20;
    }

    // Draw light gray box
    doc.setFillColor(240, 240, 240);
    doc.rect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight, 'F');

    // Add "TOTAL DUE" text (using label appropriate for monthly total)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('MONTH TOTAL', totalBoxX + totalBoxWidth / 2, totalBoxY + 6, { align: 'center' });

    // Add total amount
    doc.setFontSize(14);
    doc.text(totalNetDebt.toLocaleString('en-US'), totalBoxX + totalBoxWidth / 2, totalBoxY + 12, { align: 'center' });

    // Add Page Numbers relative to document but might be good to keep simple
    const totalPages = doc.internal.getNumberOfPages();
    doc.setPage(doc.internal.getCurrentPageInfo().pageNumber);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    // Note: This adds page number to current page being processed in loop. 
    // Ideally page numbers are added at the end for whole doc, but here we do it per page if needed, 
    // or rely on a final pass. For simplicity, we'll skip complex page numbering logic inside the loop 
    // or just add it at the very end of the function if we want global numbering.
  }

  // Add Global Page Numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  }

  doc.save(`${customerName}_Detailed_Statement.pdf`);
}

export async function generateDownloadFormPDF(
  customerName: string,
  products: Array<{ barcode: string; product: string }>,
  returnBlob: boolean = false
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;

  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = 25;

  // Calculate table width first to know where it starts
  const tableWidth = 15 + 50 + 85 + 40; // # + Barcode + Product + Quantity
  const tableLeftMargin = (pageWidth - tableWidth) / 2; // Center the table

  // Company Name (top, centered, larger)
  doc.setFontSize(16);
  doc.setTextColor(0, 155, 77);
  doc.setFont('helvetica', 'bold');
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Customer Name Header (centered, bold, adjust size to fit on one line)
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  const maxWidth = pageWidth - 40; // Leave some margin
  let fontSize = 16;
  let textWidth = doc.getTextWidth(customerName);

  // Reduce font size if customer name is too long to fit on one line
  while (textWidth > maxWidth && fontSize > 10) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
    textWidth = doc.getTextWidth(customerName);
  }

  doc.setFontSize(fontSize);
  doc.text(customerName, pageWidth / 2, yPosition, { align: 'center', maxWidth: maxWidth });
  yPosition += 4.6875; // Increased by 25% (from 3.75 to 4.6875)

  // Date (aligned with table start, smaller)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(`Date: ${dateStr}`, tableLeftMargin, yPosition, { align: 'left' });
  yPosition += 3; // Reduced by 75% (from 12 to 3)

  // Table data
  const tableData = products.map((product, index) => [
    (index + 1).toString(),
    product.barcode || '-',
    product.product || '-',
    '' // Empty column for quantity
  ]);

  // Table options with centered table
  const tableOptions = {
    startY: yPosition,
    head: [['#', 'Barcode', 'Product', 'Quantity']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 155, 77],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' }, // #
      1: { cellWidth: 50, halign: 'center' }, // Barcode (centered)
      2: { cellWidth: 85, halign: 'center' }, // Product (centered)
      3: { cellWidth: 40, halign: 'center' }, // Quantity (empty, centered)
    },
    margin: { left: tableLeftMargin, right: tableLeftMargin },
    showHead: 'everyPage',
    styles: {
      font: 'helvetica',
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  };

  // Draw Table
  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions as any);
  }

  // File name
  const safeCustomerName = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
  const fileName = `Inventory_Form_${safeCustomerName}_${new Date().toISOString().split('T')[0]}.pdf`;

  if (returnBlob) {
    return doc.output('blob');
  }

  doc.save(fileName);
}

export async function generateAgesPDF(
  filteredData: Array<{
    customerName: string;
    salesReps: string[];
    atDate: number;
    oneToThirty: number;
    thirtyOneToSixty: number;
    sixtyOneToNinety: number;
    ninetyOneToOneTwenty: number;
    older: number;
    total: number;
  }>,
  filterDescription: string = 'All Customers'
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('l', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 5;

  // 1. Group Data by City (Sales Reps)
  // First, sort broadly by City then Total so the internal data is ordered
  const sortedData = [...filteredData].sort((a, b) => {
    const cityA = (a.salesReps.join(', ') || 'No City').toLowerCase();
    const cityB = (b.salesReps.join(', ') || 'No City').toLowerCase();

    if (cityA !== cityB) {
      return cityA.localeCompare(cityB);
    }
    return b.total - a.total;
  });

  const cityGroups = new Map<string, typeof filteredData>();
  sortedData.forEach(item => {
    const cityKey = item.salesReps.join(', ') || 'No City';
    const group = cityGroups.get(cityKey) || [];
    group.push(item);
    cityGroups.set(cityKey, group);
  });

  // 2. Iterate Groups and Generate Pages
  let isFirstPage = true;
  // Sort keys to print in alphabetical order
  const sortedCityKeys = Array.from(cityGroups.keys()).sort();

  for (const city of sortedCityKeys) {
    const cityData = cityGroups.get(city) || [];

    if (!isFirstPage) {
      doc.addPage('a4', 'l');
    }
    isFirstPage = false;

    let yPosition = 20;

    // --- Header ---
    // Title with City
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Aging Report | ${city}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;

    // Company Name
    doc.setFontSize(12);
    doc.setTextColor(0, 155, 77);
    doc.setFont('helvetica', 'bold');
    doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    // Date and Filter
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const currentDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

    let headerDetails = `Date: ${currentDate}`;
    if (filterDescription) {
      headerDetails += `   |   Filter: ${filterDescription}`;
    }
    doc.text(headerDetails, margin, yPosition);
    yPosition += 8;

    // --- Table Data ---
    const tableData = cityData.map((item, index) => [
      (index + 1).toString(),
      item.customerName,
      item.salesReps.join(', ') || '',
      item.total.toLocaleString('en-US'),
      item.atDate.toLocaleString('en-US'),
      item.oneToThirty.toLocaleString('en-US'),
      item.thirtyOneToSixty.toLocaleString('en-US'),
      item.sixtyOneToNinety.toLocaleString('en-US'),
      item.ninetyOneToOneTwenty.toLocaleString('en-US'),
      item.older.toLocaleString('en-US')
    ]);

    // Calculate Totals for this City
    const totals = cityData.reduce((acc, item) => ({
      total: acc.total + item.total,
      atDate: acc.atDate + item.atDate,
      oneToThirty: acc.oneToThirty + item.oneToThirty,
      thirtyOneToSixty: acc.thirtyOneToSixty + item.thirtyOneToSixty,
      sixtyOneToNinety: acc.sixtyOneToNinety + item.sixtyOneToNinety,
      ninetyOneToOneTwenty: acc.ninetyOneToOneTwenty + item.ninetyOneToOneTwenty,
      older: acc.older + item.older
    }), {
      total: 0, atDate: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, ninetyOneToOneTwenty: 0, older: 0
    });

    // Add Totals Row
    tableData.push([
      '',
      'TOTAL',
      '',
      totals.total.toLocaleString('en-US'),
      totals.atDate.toLocaleString('en-US'),
      totals.oneToThirty.toLocaleString('en-US'),
      totals.thirtyOneToSixty.toLocaleString('en-US'),
      totals.sixtyOneToNinety.toLocaleString('en-US'),
      totals.ninetyOneToOneTwenty.toLocaleString('en-US'),
      totals.older.toLocaleString('en-US')
    ]);

    const tableOptions = {
      startY: yPosition,
      head: [['#', 'Customer Name', 'City', 'Total', 'At Date', '1-30', '31-60', '61-90', '91-120', 'Older']],
      body: tableData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        halign: 'center', // Center content
        valign: 'middle'
      },
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center', // Center header
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 8 }, // #
        1: { font: 'Amiri', halign: 'center' }, // Name (Auto width)
        2: { cellWidth: 28 }, // City
        3: { cellWidth: 28, fontStyle: 'bold', fillColor: [230, 230, 230] }, // Total (Highlighted)
        // Buckets
        4: { cellWidth: 22, textColor: [21, 128, 61] }, // At Date (Greenish)
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 22 },
        8: { cellWidth: 22 },
        9: { cellWidth: 25, textColor: [185, 28, 28], fontStyle: 'bold' } // Older (Red)
      },
      margin: { left: 5, right: 5 },
      didParseCell: (data: any) => {
        // Style the Total Row
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    };

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableOptions);
    } else if (typeof autoTable === 'function') {
      autoTable(doc, tableOptions as any);
    }
  }

  return doc.output('blob');
}