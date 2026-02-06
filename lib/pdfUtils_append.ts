
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
    }>
) {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF('l', 'mm', 'a4');
    await addArabicFont(doc);

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Aging Report', pageWidth / 2, yPosition, { align: 'center' });
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
    const currentDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    doc.text(`Date: ${currentDate}`, margin, yPosition);
    yPosition += 8;

    // Sort Data: City ASC -> Total DESC
    const sortedData = [...filteredData].sort((a, b) => {
        const cityA = (a.salesReps.join(', ') || '').toLowerCase();
        const cityB = (b.salesReps.join(', ') || '').toLowerCase();

        if (cityA !== cityB) {
            return cityA.localeCompare(cityB);
        }
        return b.total - a.total;
    });

    // Prepare Table Data
    const tableData = sortedData.map((item, index) => [
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

    // Totals Row
    const totals = sortedData.reduce((acc, item) => ({
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
            0: { cellWidth: 10 }, // #
            1: { cellWidth: 60, font: 'Amiri', halign: 'center' }, // Name (might contain Arabic) - enforce center
            2: { cellWidth: 30 }, // City
            3: { cellWidth: 25, fontStyle: 'bold' }, // Total
            // Buckets
            4: { cellWidth: 25, textColor: [21, 128, 61] }, // At Date (Greenish)
            5: { cellWidth: 20 },
            6: { cellWidth: 20 },
            7: { cellWidth: 20 },
            8: { cellWidth: 20 },
            9: { cellWidth: 25, textColor: [185, 28, 28], fontStyle: 'bold' } // Older (Red)
        },
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

    return doc.output('blob');
}
