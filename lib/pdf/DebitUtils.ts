'use client';

import { addArabicFont } from './shared';

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

  const sortedCustomers = [...customers].sort((a, b) => {
    const cityA = a.salesReps ? Array.from(a.salesReps).join(', ') : '';
    const cityB = b.salesReps ? Array.from(b.salesReps).join(', ') : '';
    if (cityA < cityB) return -1;
    if (cityA > cityB) return 1;
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
    let paymentDate = '-', paymentAmount = '-', paymentDays = '-';
    if (c.lastPaymentDate) {
      paymentDate = formatDmy(c.lastPaymentDate);
      paymentAmount = (c.lastPaymentAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      paymentDays = Math.floor(Math.abs(now.getTime() - c.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)).toString();
    }
    let salesDate = '-', salesAmount = '-', salesDays = '-';
    if (c.lastSalesDate) {
      salesDate = formatDmy(c.lastSalesDate);
      salesAmount = (c.lastSalesAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      salesDays = Math.floor(Math.abs(now.getTime() - c.lastSalesDate.getTime()) / (1000 * 60 * 60 * 24)).toString();
    }
    return [
      (index + 1).toString(),
      c.customerName,
      reps,
      c.netDebt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      paymentDate, paymentAmount, paymentDays,
      salesDate, salesAmount, salesDays
    ];
  });

  const totalDebt = customers.reduce((sum, c) => sum + c.netDebt, 0);
  tableData.push(['', 'TOTAL', '', totalDebt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }), '', '', '', '', '', '']);

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
    headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8, lineWidth: 0.1, lineColor: [200, 200, 200] },
    bodyStyles: { fontSize: 8, halign: 'center', valign: 'middle', cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 80, halign: 'center', font: 'Amiri' }, 2: { cellWidth: 25 }, 3: { cellWidth: 30, fontStyle: 'bold' } },
    margin: { left: 10, right: 10 },
    didParseCell: (data: any) => { if (data.row.index === tableData.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240]; } }
  };

  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions);

  const cityStatsMap = new Map<string, { totalDebt: number; customerCount: number }>();
  customers.forEach(c => {
    const city = c.salesReps && c.salesReps.size > 0 ? Array.from(c.salesReps).join(', ') : 'Unknown City';
    const stats = cityStatsMap.get(city) || { totalDebt: 0, customerCount: 0 };
    stats.totalDebt += c.netDebt; stats.customerCount += 1; cityStatsMap.set(city, stats);
  });

  if (cityStatsMap.size > 1) {
    doc.addPage('a4', 'p');
    yPosition = 20; const portraitPageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('City Summary Report', portraitPageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.setFontSize(12); doc.setTextColor(0, 155, 77); doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', portraitPageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0); yPosition += 10; doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${currentDate}`, margin, yPosition); yPosition += 8;
    const cityTableData = Array.from(cityStatsMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([city, stats]) => [city, stats.totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), stats.customerCount.toString()]);
    cityTableData.push(['GRAND TOTAL', customers.reduce((sum, c) => sum + c.netDebt, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), customers.length.toString()]);
    const cityTableOptions: any = {
      startY: yPosition, head: [['City', 'Total Balance', 'Customers Count']], body: cityTableData, theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 10, halign: 'center' }, columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 50 }, 2: { cellWidth: 40 } },
      margin: { left: 10, right: 10 }, didParseCell: (data: any) => { if (data.row.index === cityTableData.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240]; } }
    };
    if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(cityTableOptions);
    else if (typeof autoTable === 'function') autoTable(doc, cityTableOptions);
  }
  return doc.output('blob');
}

export async function generateAgesPDF(
  filteredData: Array<{
    customerName: string;
    salesReps: string[];
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

  const sortedData = [...filteredData].sort((a, b) => {
    const cityA = (a.salesReps.join(', ') || 'No City').toLowerCase();
    const cityB = (b.salesReps.join(', ') || 'No City').toLowerCase();
    if (cityA !== cityB) return cityA.localeCompare(cityB);
    return b.total - a.total;
  });

  const cityGroups = new Map<string, typeof filteredData>();
  sortedData.forEach(item => {
    const cityKey = item.salesReps.join(', ') || 'No City';
    const group = cityGroups.get(cityKey) || []; group.push(item); cityGroups.set(cityKey, group);
  });

  let isFirstPage = true;
  const sortedCityKeys = Array.from(cityGroups.keys()).sort();

  for (const city of sortedCityKeys) {
    const cityData = cityGroups.get(city) || [];
    if (!isFirstPage) doc.addPage('a4', 'l');
    isFirstPage = false;
    let yPosition = 20;

    doc.setFontSize(12); doc.setTextColor(0, 155, 77); doc.setFont('helvetica', 'bold');
    doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0); yPosition += 7;
    doc.setFontSize(18); doc.text(`Aging Report | ${city}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const now = new Date();
    const currentDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    let headerDetails = `Date: ${currentDate}`; if (filterDescription) headerDetails += `   |   Filter: ${filterDescription}`;
    doc.text(headerDetails, margin, yPosition); yPosition += 8;

    const tableData = cityData.map((item, index) => [
      (index + 1).toString(), item.customerName, item.salesReps.join(', ') || '', item.total.toLocaleString('en-US'),
      item.oneToThirty.toLocaleString('en-US'), item.thirtyOneToSixty.toLocaleString('en-US'),
      item.sixtyOneToNinety.toLocaleString('en-US'), item.ninetyOneToOneTwenty.toLocaleString('en-US'), item.older.toLocaleString('en-US')
    ]);

    const totals = cityData.reduce((acc, item) => ({
      total: acc.total + item.total, oneToThirty: acc.oneToThirty + item.oneToThirty,
      thirtyOneToSixty: acc.thirtyOneToSixty + item.thirtyOneToSixty, sixtyOneToNinety: acc.sixtyOneToNinety + item.sixtyOneToNinety,
      ninetyOneToOneTwenty: acc.ninetyOneToOneTwenty + item.ninetyOneToOneTwenty, older: acc.older + item.older
    }), { total: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, ninetyOneToOneTwenty: 0, older: 0 });

    tableData.push(['', 'TOTAL', '', totals.total.toLocaleString('en-US'), totals.oneToThirty.toLocaleString('en-US'),
      totals.thirtyOneToSixty.toLocaleString('en-US'), totals.sixtyOneToNinety.toLocaleString('en-US'),
      totals.ninetyOneToOneTwenty.toLocaleString('en-US'), totals.older.toLocaleString('en-US')]);

    const tableOptions = {
      startY: yPosition, head: [['#', 'Customer Name', 'City', 'Total', '0-30', '31-60', '61-90', '91-120', 'Older']],
      body: tableData, theme: 'grid', styles: { font: 'helvetica', fontSize: 9, halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 10 }, 1: { font: 'Amiri', halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 35 },
        3: { cellWidth: 35, fontStyle: 'bold', fillColor: [230, 230, 230] },
        4: { cellWidth: 25, fontStyle: 'bold' }, 5: { cellWidth: 25, fontStyle: 'bold' },
        6: { cellWidth: 25, fontStyle: 'bold' }, 7: { cellWidth: 25, fontStyle: 'bold' },
        8: { cellWidth: 28, textColor: [185, 28, 28], fontStyle: 'bold' }
      },
      margin: { left: 5, right: 5 }, didParseCell: (data: any) => { if (data.row.index === tableData.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240]; } }
    };

    if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
    else if (typeof autoTable === 'function') autoTable(doc, tableOptions as any);
  }
  return doc.output('blob');
}
