'use client';

// Helper function to load and add Arabic font to jsPDF
async function addArabicFont(doc: any): Promise<void> {
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
  const tableWidth = 45 + 70 + 45 + 45 + 45; // Sum of all column widths = 250mm
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
  doc.text(`Date: ${currentDate} (${monthsLabel})`, margin, yPosition);
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
    return [
      dateStr,
      inv.number || '',
      inv.debit.toLocaleString('en-US'),
      inv.credit.toLocaleString('en-US'),
      inv.netDebt.toLocaleString('en-US')
    ];
  });

  // Calculate totals
  const totalDebit = invoices.reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = invoices.reduce((sum, inv) => sum + inv.credit, 0);
  const totalNetDebt = invoices.reduce((sum, inv) => sum + inv.netDebt, 0);

  // Add total row
  tableData.push([
    '',
    'TOTAL',
    totalDebit.toLocaleString('en-US'),
    totalCredit.toLocaleString('en-US'),
    totalNetDebt.toLocaleString('en-US')
  ]);

  // Define Table Options
  const tableOptions = {
    startY: yPosition,
    margin: { left: tableLeftMargin, right: tableLeftMargin }, // Center the table
    head: [['Date', 'Number', 'Debit', 'Credit', 'Net Debit']],
    body: tableData,
    theme: 'striped' as const,
    styles: {
      font: 'helvetica', // Default to Helvetica for most cells
      fontStyle: 'normal'
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: 'bold', // Bold looks better in Helvetica
      fontSize: 10,
      halign: 'center', // Center header text
      font: 'helvetica' // Headers are English
    },
    bodyStyles: {
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 45, halign: 'center', font: 'helvetica' }, // Date
      1: { cellWidth: 70, halign: 'center', font: 'Amiri' }, // Number - Contains Arabic text
      2: { cellWidth: 45, halign: 'center', font: 'helvetica' }, // Debit
      3: { cellWidth: 45, halign: 'center', font: 'helvetica' }, // Credit
      4: { cellWidth: 45, halign: 'center', font: 'helvetica' }  // Net Debt
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

      // Style total row
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [255, 245, 200]; // Light yellow to stand out
        data.cell.styles.fontStyle = 'bold'; // Make total bold
        data.cell.styles.textColor = 0; // Black text
      }
      // Color Net Debt column
      if (data.column.index === 4 && data.row.index < tableData.length - 1) {
        const netDebt = invoices[data.row.index].netDebt;
        if (netDebt > 0) {
          data.cell.styles.textColor = [204, 0, 0]; // Red
        } else if (netDebt < 0) {
          data.cell.styles.textColor = [0, 153, 0]; // Green
        }
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
        autoTable(doc, tableOptions);
    } else {
        console.error('autoTable is not a function', autoTable);
        throw new Error('Failed to load autoTable plugin');
    }
  }

  // Save PDF
  const fileName = `${customerName}.pdf`;
  
  if (returnBlob) {
    return doc.output('blob');
  }
  
  doc.save(fileName);
}
