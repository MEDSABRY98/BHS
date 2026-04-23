'use client';

import { addArabicFont } from './shared';

export async function generateDownloadFormPDF(
  customerName: string,
  products: Array<{
    barcode: string;
    product: string;
    price?: number;
    avgPrice?: number;
    costPrice?: number;
  }>,
  returnBlob: boolean = false,
  mode: 'order' | 'pricelist' | 'analysis' = 'order',
  pricingStrategy?: 'most' | 'last'
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 25;

  doc.setFontSize(16); doc.setTextColor(0, 155, 77); doc.setFont('helvetica', 'bold');
  doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  doc.setFontSize(12); doc.setTextColor(100, 100, 100); 
  const subtitle = mode === 'pricelist' 
    ? `Price List (${pricingStrategy === 'last' ? 'Last Price' : 'Most Price'})` 
    : mode === 'analysis'
      ? 'Pricing Analysis Report (Comparison & Margins)'
      : 'Order Form';
  doc.text(subtitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
  let fontSize = 16; let textWidth = doc.getTextWidth(customerName);
  while (textWidth > pageWidth - 40 && fontSize > 10) { fontSize -= 0.5; doc.setFontSize(fontSize); textWidth = doc.getTextWidth(customerName); }
  doc.setFontSize(fontSize); doc.text(customerName, pageWidth / 2, yPosition, { align: 'center', maxWidth: pageWidth - 40 });
  yPosition += 5;

  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, yPosition);
  yPosition += 3;

  let headers: string[][] = [];
  let body: any[][] = [];
  let columnStyles: any = {};
  let tableWidth = 0;

  if (mode === 'analysis') {
    headers = [['#', 'Barcode', 'Product', 'Most Price', 'Last Price', 'Cost', 'Diff', '%']];
    body = products.map((p, i) => {
      const freq = p.price || 0;
      const cost = p.costPrice || 0;
      const diff = freq - cost;
      const margin = freq > 0 ? (diff / freq) * 100 : 0;
      return [
        (i + 1).toString(),
        p.barcode || '-',
        p.product || '-',
        freq ? freq.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-',
        p.avgPrice ? p.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-',
        cost ? cost.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-',
        diff.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        `${margin.toFixed(1)}%`
      ];
    });
    tableWidth = 190;
    columnStyles = { 
      0: { cellWidth: 10, halign: 'center' }, 
      1: { cellWidth: 35, halign: 'center' }, 
      2: { cellWidth: 55, halign: 'center' }, 
      3: { cellWidth: 18, halign: 'center' }, 
      4: { cellWidth: 18, halign: 'center' }, 
      5: { cellWidth: 18, halign: 'center' }, 
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' }
    };
  } else {
    headers = [['#', 'Barcode', 'Product', mode === 'pricelist' ? 'Price' : 'Quantity']];
    body = products.map((p, i) => [
      (i + 1).toString(),
      p.barcode || '-',
      p.product || '-',
      mode === 'pricelist' ? (p.price !== undefined ? p.price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-') : ''
    ]);
    tableWidth = 190;
    columnStyles = { 
      0: { cellWidth: 15, halign: 'center' }, 
      1: { cellWidth: 50, halign: 'center' }, 
      2: { cellWidth: 85, halign: 'center' }, 
      3: { cellWidth: 40, halign: 'center' } 
    };
  }

  const tableLeftMargin = (pageWidth - tableWidth) / 2;

  const tableOptions = {
    startY: yPosition, head: headers,
    body: body, theme: 'grid' as const, headStyles: { fillColor: [0, 155, 77], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, halign: 'center' },
    bodyStyles: { fontSize: 8.5, cellPadding: 2, font: 'Amiri', halign: 'center' }, columnStyles: columnStyles,
    margin: { left: tableLeftMargin, right: tableLeftMargin }, styles: { font: 'Amiri' }, alternateRowStyles: { fillColor: [245, 245, 245] }
  };
  if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(tableOptions);
  else if (typeof autoTable === 'function') autoTable(doc, tableOptions as any);

  if (returnBlob) return doc.output('blob');
  doc.save(`${mode === 'pricelist' ? 'Price_List' : mode === 'analysis' ? 'Analysis' : 'Order_Form'}_${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

export async function generateSalesRepReportPDF(data: {
  repName: string;
  period: string;
  totalVisits: number;
  totalCollected: number;
  collectedVisits: number;
  noCollectionVisits: number;
  avgPerDay: string;
  chartData: any[];
  visits: any[];
  customerBalances?: Record<string, number>;
}) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  await addArabicFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 20; let y = 15;

  const colors = { black: [10, 10, 10], cyan: [0, 229, 255], red: [255, 23, 68], gray100: [245, 245, 245], gray200: [224, 224, 224], gray400: [158, 158, 158], white: [255, 255, 255] };

  doc.setFillColor(10, 10, 10); doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(28); doc.setTextColor(255, 255, 255);
  const title = `SALES REP REPORT`; doc.text(title, pageWidth / 2, 22, { align: 'center' });
  doc.setLineWidth(0.8); doc.setDrawColor(255, 23, 68); doc.line(pageWidth / 2 - 12, 26, pageWidth / 2, 26);
  doc.setDrawColor(0, 229, 255); doc.line(pageWidth / 2, 26, pageWidth / 2 + 12, 26);

  y = 54; doc.setFontSize(10); doc.setTextColor(158, 158, 158); doc.text('KEY METRICS', marginX, y);
  doc.setDrawColor(224, 224, 224); doc.line(marginX + 30, y - 1, pageWidth - marginX, y - 1);
  y += 15;

  const gridGap = 6; const cols = 3; const statW = (pageWidth - (marginX * 2) - (gridGap * (cols - 1))) / cols; const statH = 32;
  const dashboardStats = [
    { label: 'Customers', val: new Set(data.visits.map(v => v.customerName)).size.toString(), col: colors.cyan },
    { label: 'Total Visits', val: data.totalVisits.toString(), col: colors.black },
    { label: 'Total Collected', val: data.totalCollected.toLocaleString(), col: colors.cyan },
    { label: 'Success Rate', val: `${((data.collectedVisits / (data.totalVisits || 1)) * 100).toFixed(0)}%`, col: colors.red },
    { label: 'Collected', val: data.collectedVisits.toString(), col: colors.cyan },
    { label: 'No Collection', val: data.noCollectionVisits.toString(), col: colors.red },
    { label: 'Avg Daily', val: data.avgPerDay.toString(), col: colors.black }
  ];

  dashboardStats.forEach((s, idx) => {
    const cx = idx % 3; const rx = Math.floor(idx / 3); const cardX = marginX + (cx * (statW + gridGap)); const cardY = y + (rx * (statH + gridGap));
    doc.setFillColor(255, 255, 255); doc.setDrawColor(224, 224, 224); doc.roundedRect(cardX, cardY, statW, statH, 4, 4, 'FD');
    doc.setFillColor(s.col[0], s.col[1], s.col[2]); doc.rect(cardX, cardY, statW, 1.8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(10, 10, 10); doc.text(s.label.toUpperCase(), cardX + statW / 2, cardY + 11, { align: 'center' });
    doc.setFontSize(24); doc.setTextColor(s.col[0], s.col[1], s.col[2]); doc.text(s.val, cardX + statW / 2, cardY + 27, { align: 'center' });
    if (idx === dashboardStats.length - 1) y = cardY + statH + 15;
  });

  doc.setDrawColor(224, 224, 224); doc.roundedRect(marginX, y, pageWidth - (marginX * 2), 95, 6, 6, 'D');
  doc.setFontSize(13); doc.setTextColor(10, 10, 10); doc.text('PERFORMANCE LAST 7 DAYS', marginX + 10, y + 15);
  y += 25; const chartH = 45; const chartW = pageWidth - marginX * 2 - 15; const chartData = data.chartData.slice(0, 7);
  const maxVis = Math.max(...chartData.map(d => d.visits), 1); const maxAmt = Math.max(...chartData.map(d => d.amount), 1);
  const groupW = chartW / (chartData.length || 7); const barW = groupW * 0.22;
  chartData.forEach((d, i) => {
    const gx = marginX + 7.5 + (i * groupW);
    if (d.amount > 0) { doc.setFillColor(255, 23, 68); const h = (d.amount / maxAmt) * chartH; doc.roundedRect(gx, y + chartH - h, barW, h, 1, 1, 'F'); }
    if (d.visits > 0) { doc.setFillColor(10, 10, 10); const h = (d.visits / (maxVis * 2)) * chartH; doc.roundedRect(gx + barW + 3, y + chartH - h, barW, h, 1, 1, 'F'); }
    doc.setFontSize(8); doc.setTextColor(0, 0, 0); const tag = d.name || d.date; doc.text(String(tag), gx + barW, y + chartH + 8, { align: 'center' });
  });

  doc.addPage('a4', 'landscape'); const lw = doc.internal.pageSize.getWidth(); y = 20;
  doc.setFontSize(18); doc.setTextColor(15, 23, 42); doc.text('Customer Performance Summary', lw / 2, y, { align: 'center' }); y += 10;
  const customerMap = new Map(); data.visits.forEach(v => {
    const s = customerMap.get(v.customerName) || { name: v.customerName, city: v.city || v.area || '-', visits: 0, collections: 0, amount: 0, last: '0000-00-00' };
    s.visits++; if (v.collectMoney === 'Yes') { s.collections++; s.amount += v.howMuchCollectMoney || 0; } if (v.date > s.last) s.last = v.date; customerMap.set(v.customerName, s);
  });
  const summaryBody = Array.from(customerMap.values()).sort((a,b) => a.city.localeCompare(b.city, 'ar') || a.name.localeCompare(b.name, 'ar')).map(s => [s.name, s.city, data.customerBalances?.[s.name]?.toLocaleString() || '-', s.visits.toString(), s.collections.toString(), s.amount.toLocaleString(), s.last.split('-').reverse().join('-')]);
  autoTable(doc, { startY: y, head: [['Customer', 'City', 'Balance', 'Visits', 'Collected', 'Amount', 'Last Visit']], body: summaryBody, theme: 'grid', bodyStyles: { font: 'Amiri', fontSize: 9, halign: 'center' }, columnStyles: { 0: { cellWidth: 80 } } });

  doc.addPage('a4', 'portrait'); y = 20; doc.text('Daily Performance Summary', pageWidth / 2, y, { align: 'center' }); y += 10;
  const dailyMap = new Map(); data.visits.forEach(v => {
    const s = dailyMap.get(v.date) || { date: v.date, visits: 0, customers: new Set(), collections: 0, amount: 0 };
    s.visits++; s.customers.add(v.customerName); if (v.collectMoney === 'Yes') { s.collections++; s.amount += v.howMuchCollectMoney || 0; } dailyMap.set(v.date, s);
  });
  const dailyBody = Array.from(dailyMap.values()).sort((a,b) => b.date.localeCompare(a.date)).map(d => [d.date.split('-').reverse().join('-'), d.visits.toString(), d.customers.size.toString(), d.collections.toString(), d.amount.toLocaleString()]);
  autoTable(doc, { startY: y, head: [['Date', 'Visits', 'Customers', 'Collections', 'Amount']], body: dailyBody, theme: 'grid', bodyStyles: { halign: 'center' } });

  doc.addPage('a4', 'landscape'); y = 20; doc.text('Detailed Visit Logs', lw / 2, y, { align: 'center' }); y += 10;
  const logsBody = data.visits.map(v => [v.date.split('-').reverse().join('-'), v.customerName, v.city || v.area || '-', data.customerBalances?.[v.customerName]?.toLocaleString() || '-', v.collectMoney, v.howMuchCollectMoney > 0 ? v.howMuchCollectMoney.toLocaleString() : '-', v.notes || '-']);
  autoTable(doc, { startY: y, head: [['Date', 'Customer', 'City', 'Balance', 'Coll?', 'Amount', 'Notes']], body: logsBody, theme: 'striped', bodyStyles: { font: 'Amiri', fontSize: 9, halign: 'center' }, columnStyles: { 1: { cellWidth: 55 } } });

  return doc.output('blob');
}
