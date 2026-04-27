'use client';

import { addArabicFont } from './shared';

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
