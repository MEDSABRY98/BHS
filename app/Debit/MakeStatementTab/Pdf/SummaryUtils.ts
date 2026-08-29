'use client';

import { getInvoiceType } from '@/app/Debit/Utils/InvoiceType';
import { addArabicFont } from '@/app/Components/Pdf/shared';
import { sortInvoicesByDateThenNumber } from '@/app/Debit/CustomerDetailsTab/Utils';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';

// --- Colors ---
const COLORS = {
  gold: [184, 134, 11], // #B8860B
  goldLight: [244, 233, 216], // #F4E9D8
  black: [26, 26, 26], // #1A1A1A
  gray: [107, 107, 107], // #6B6B6B
  lightGray: [245, 245, 245], // #F5F5F5
  white: [255, 255, 255], // #FFFFFF
  borderGray: [217, 217, 217], // #D9D9D9
};

// --- Helper Functions ---
function drawStatementHeader(doc: any, customerName: string, invoices: any[], margin: number = 8, pageWidth: number = 210) {
  let yPosition = 15;
  const contentWidth = pageWidth - margin * 2;

  // 1. Top Bar
  doc.setDrawColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.setLineWidth(0.7);
  doc.line(margin, yPosition + 4, margin + contentWidth, yPosition + 4);
  
  yPosition += 15;

  // 2. Title & Subtitle
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text('STATEMENT OF ACCOUNT', margin, yPosition);
  yPosition += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.text('Al Marai Al Arabia Trading', margin, yPosition);
  
  const subtitleWidth = doc.getTextWidth('Al Marai Al Arabia Trading');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text('| Sole Proprietorship L.L.C', margin + subtitleWidth + 1.5, yPosition);
  yPosition += 3; // Reduced from 6 to bring customer card closer

  // 3. Info Panel
  const panelHeight = 25;
  const billToWidth = contentWidth * 0.68;
  
  // Bill To (Left)
  doc.setFillColor(COLORS.goldLight[0], COLORS.goldLight[1], COLORS.goldLight[2]);
  doc.rect(margin, yPosition, billToWidth, panelHeight, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text('CUSTOMER NAME', margin + 5, yPosition + 6);
  
  doc.setFontSize(14);
  doc.setFont('Amiri', 'bold');
  let fontSize = 14;
  const maxNameWidth = billToWidth - 10;
  while (doc.getTextWidth(customerName) > maxNameWidth && fontSize > 6) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }
  
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text(customerName, margin + 5, yPosition + 14);

  // Meta (Right)
  const metaX = margin + billToWidth + 5;
  
  const now = new Date();
  const currentDate = `${now.getDate().toString().padStart(2, '0')}-${now.toLocaleDateString('en-US', { month: 'short' })}-${now.getFullYear()}`;
  
  let balanceDateStr = currentDate;
  for (let i = invoices.length - 1; i >= 0; i--) {
    if (invoices[i].date) {
      const d = new Date(invoices[i].date);
      if (!isNaN(d.getTime())) {
        balanceDateStr = `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleDateString('en-US', { month: 'short' })}-${d.getFullYear()}`;
        break;
      }
    }
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  
  doc.text('STATEMENT DATE', metaX, yPosition + 8);
  doc.text('BALANCE AS OF', metaX, yPosition + 15);
  doc.text('CURRENCY', metaX, yPosition + 22);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text(currentDate, metaX + 35, yPosition + 8);
  doc.text(balanceDateStr, metaX + 35, yPosition + 15);
  doc.text('AED', metaX + 35, yPosition + 22);

  yPosition += panelHeight + 6; // Increased slightly from 4 to 6

  // 4. Section Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text('TRANSACTION DETAILS', margin, yPosition);
  yPosition += 4;

  return yPosition;
}

function drawStatementFooter(doc: any, transactionCount: number, totalNetDebt: number, startY: number, margin: number = 8, pageWidth: number = 210) {
  const contentWidth = pageWidth - margin * 2;
  const summaryLeftWidth = contentWidth * 0.65;
  const summaryRightWidth = contentWidth * 0.35;
  const panelHeight = 22;

  // Check if we need to add a page for the footer
  if (startY + panelHeight + 15 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    startY = 20;
  }

  let yPosition = startY + 5;

  // Summary Left
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text(`${transactionCount} transactions listed above`, margin, yPosition + 4);
  doc.text('For any queries regarding this statement, please contact:', margin, yPosition + 9);
  
  // Draw envelope icon
  doc.setDrawColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.setLineWidth(0.4);
  const iconX = margin;
  const iconY = yPosition + 13;
  doc.rect(iconX, iconY, 4, 3);
  doc.line(iconX, iconY, iconX + 2, iconY + 1.5);
  doc.line(iconX + 4, iconY, iconX + 2, iconY + 1.5);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text('accounting@marae.ae', margin + 6, yPosition + 16);

  // Summary Right (Total Due)
  const rightX = margin + summaryLeftWidth;
  doc.setFillColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.rect(rightX, yPosition, summaryRightWidth, panelHeight, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.text('TOTAL DUE (AED)', rightX + summaryRightWidth - 5, yPosition + 7, { align: 'right' });

  doc.setFontSize(16);
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.text(totalNetDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), rightX + summaryRightWidth - 5, yPosition + 16, { align: 'right' });

  // Page Footer Text
  yPosition += panelHeight + 15;
  doc.setDrawColor(COLORS.borderGray[0], COLORS.borderGray[1], COLORS.borderGray[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, yPosition, margin + contentWidth, yPosition);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text('This is a computer-generated statement and does not require a signature.', pageWidth / 2, yPosition + 5, { align: 'center' });
}

function generateTableData(invoices: any[], shortenInvoiceNumbers: boolean) {
  return invoices.map((inv) => {
    let dateStr = inv.date || '';
    const num = (inv.number || '').trim().toUpperCase();
    const isSpecialType = num.startsWith('BIL') || num.startsWith('JV');
    let type = isSpecialType ? '-' : getInvoiceType(inv);
    if (!isSpecialType && inv.date) {
      const yearMatch = inv.date.match(/\d{4}/);
      if (yearMatch) {
        const shortYear = yearMatch[0].slice(-2);
        type = `${type} ${shortYear}`;
      } else {
        const yearMatch2 = inv.date.match(/\b\d{2}\b$/);
        if (yearMatch2) {
           type = `${type} ${yearMatch2[0]}`;
        }
      }
    }
    
    let invoiceNumber = inv.number || '';
    if (shortenInvoiceNumbers && invoiceNumber) {
      if (invoiceNumber.startsWith('BHS-')) {
        const parts = invoiceNumber.split('-');
        if (parts.length >= 3) {
          invoiceNumber = parts[2].split(' ')[0];
        } else {
          invoiceNumber = invoiceNumber.split(' ')[0];
        }
      } else {
        invoiceNumber = invoiceNumber.split(' ')[0];
      }
    }
    return [
      dateStr,
      type,
      invoiceNumber,
      inv.debit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      inv.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      inv.netDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ];
  });
}

function getTableOptions(tableData: any[], invoices: any[], startY: number, margin: number = 8, pageWidth: number = 210) {
  // Using wider margins, let autotable figure out optimal distribution 
  // but hinting some columns for better visuals.
  return {
    startY: startY,
    margin: { left: margin, right: margin, bottom: 20 },
    head: [['DATE', 'TYPE', 'NUMBER', 'DEBIT', 'CREDIT', 'NET DEBIT']],
    body: tableData,
    theme: 'plain' as const,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      valign: 'middle',
      halign: 'center',
      cellPadding: 3,
      lineColor: COLORS.borderGray,
      lineWidth: { top: 0.3, bottom: 0.3, left: 0, right: 0 }
    },
    headStyles: {
      fillColor: COLORS.black,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      lineWidth: 0
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 26, textColor: COLORS.gray },
      2: { font: 'Amiri' }, // Takes remaining space
      3: { cellWidth: 30 },
      4: { cellWidth: 30, textColor: COLORS.gray },
      5: { cellWidth: 32, fontStyle: 'bold' }
    },
    didParseCell: function (data: any) {
      if (data.section === 'head') return;
      if (data.row.index % 2 === 1) {
        data.cell.styles.fillColor = COLORS.lightGray;
      } else {
        data.cell.styles.fillColor = COLORS.white;
      }
    }
  };
}

function addPageNumbers(doc: any, pageWidth: number, margin: number) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
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
  monthsLabel: string = 'All Months',
  shortenInvoiceNumbers: boolean = true
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `Statement_${customerName}` });
  await addArabicFont(doc);

  const margin = 8;
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const sortedInvoices = sortInvoicesByDateThenNumber(invoices);
  const tableData = generateTableData(sortedInvoices, shortenInvoiceNumbers);
  
  let yPosition = drawStatementHeader(doc, customerName, sortedInvoices, margin, pageWidth);
  const tableOptions = getTableOptions(tableData, sortedInvoices, yPosition, margin, pageWidth);

  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions as any);
  }

  const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 10;
  
  const totalDebit = sortedInvoices.reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = sortedInvoices.reduce((sum, inv) => sum + inv.credit, 0);
  const totalNetDebt = totalDebit - totalCredit;

  drawStatementFooter(doc, sortedInvoices.length, totalNetDebt, finalY, margin, pageWidth);

  addPageNumbers(doc, pageWidth, margin);

  const fileName = `${customerName}_Statement.pdf`;
  if (returnBlob) return doc.output('blob');
  saveTrackedPdf(doc, fileName);
}


export async function generateStatementPDF(
  customerName: string,
  rows: any[]
): Promise<Blob> {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `Statement_${customerName}` });
  await addArabicFont(doc);

  const margin = 8;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Map UploadedRow to the format expected by the drawing functions
  let runningBalance = 0;
  const invoices = rows.map(row => {
    runningBalance += (row.DEBIT || 0) - (row.CREDIT || 0);
    return {
      date: row.DATE,
      number: row.NUMBER,
      debit: row.DEBIT || 0,
      credit: row.CREDIT || 0,
      netDebt: runningBalance
    };
  });

  let yPosition = drawStatementHeader(doc, customerName, invoices, margin, pageWidth);
  
  const tableData = generateTableData(invoices, true);
  const tableOptions = getTableOptions(tableData, invoices, yPosition, margin, pageWidth);

  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions as any);
  }

  const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 10;
  
  const totalDebit = invoices.reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = invoices.reduce((sum, inv) => sum + inv.credit, 0);
  const totalNetDebt = totalDebit - totalCredit;

  drawStatementFooter(doc, invoices.length, totalNetDebt, finalY, margin, pageWidth);
  addPageNumbers(doc, pageWidth, margin);
  
  return doc.output('blob');
}
