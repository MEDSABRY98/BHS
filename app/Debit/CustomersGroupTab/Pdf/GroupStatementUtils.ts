'use client';

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/Audit/Utils/TrackedDownload';
import { printPdfInSameTab } from '@/app/LPOs/Pdf/DeliveryUtils';
import { getInvoiceType } from '@/app/Debit/Utils/InvoiceType';
import { sortInvoicesByDateThenNumber } from '@/app/Debit/CustomerDetailsTab/Utils';

// --- Colors ---
const COLORS = {
  gold: [184, 134, 11],
  goldLight: [244, 233, 216],
  black: [26, 26, 26],
  gray: [107, 107, 107],
  lightGray: [245, 245, 245],
  white: [255, 255, 255],
  borderGray: [217, 217, 217],
};

function drawStatementHeader(doc: any, statementTitle: string, groupCustomers: string[], invoices: any[], margin: number = 8, pageWidth: number = 297) {
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
  doc.text(statementTitle.toUpperCase(), margin, yPosition);
  yPosition += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.text('Al Marai Al Arabia Trading', margin, yPosition);
  
  const subtitleWidth = doc.getTextWidth('Al Marai Al Arabia Trading');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text('| Sole Proprietorship L.L.C', margin + subtitleWidth + 1.5, yPosition);
  yPosition += 3;

  // 3. Info Panel
  const panelHeight = 25;
  const billToWidth = contentWidth * 0.72; // Adjusted for landscape
  
  // Bill To (Left)
  doc.setFillColor(COLORS.goldLight[0], COLORS.goldLight[1], COLORS.goldLight[2]);
  doc.rect(margin, yPosition, billToWidth, panelHeight, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  doc.text('CUSTOMERS GROUP', margin + 5, yPosition + 6);
  
  doc.setFontSize(11);
  doc.setFont('Amiri', 'bold');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  const customersListStr = groupCustomers.join(' • ');
  let displayCustList = customersListStr;
  const maxAllowedWidth = billToWidth - 10;
  
  if (doc.getTextWidth(displayCustList) > maxAllowedWidth) {
    while (displayCustList.length > 0 && doc.getTextWidth(displayCustList + '...') > maxAllowedWidth) {
      displayCustList = displayCustList.slice(0, -1);
    }
    displayCustList += '...';
  }

  doc.text(displayCustList, margin + 5, yPosition + 14);

  // Meta (Right)
  const metaX = margin + billToWidth + 5;
  
  const now = new Date();
  const currentDate = `${now.getDate().toString().padStart(2, '0')}-${now.toLocaleDateString('en-US', { month: 'short' })}-${now.getFullYear()}`;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
  
  doc.text('STATEMENT DATE', metaX, yPosition + 8);
  doc.text('CURRENCY', metaX, yPosition + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text(currentDate, metaX + 35, yPosition + 8);
  doc.text('AED', metaX + 35, yPosition + 15);

  yPosition += panelHeight + 6;

  // 4. Section Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.black[0], COLORS.black[1], COLORS.black[2]);
  doc.text('TRANSACTION DETAILS', margin, yPosition);
  yPosition += 4;

  return yPosition;
}

function drawStatementFooter(doc: any, transactionCount: number, totalNetDebt: number, startY: number, margin: number = 8, pageWidth: number = 297) {
  const contentWidth = pageWidth - margin * 2;
  const summaryLeftWidth = contentWidth * 0.72;
  const summaryRightWidth = contentWidth * 0.28;
  const panelHeight = 22;

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

export async function generateGroupStatementPDF(
  statementTitle: string,
  groupCustomers: string[],
  invoices: any[],
  isPrint: boolean = false
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  // Use landscape ('l')
  const doc = new jsPDF('l', 'mm', 'a4');
  doc.setProperties({ title: statementTitle });
  await addArabicFont(doc);

  const margin = 10; // slightly larger margin for landscape might be fine, but 10 is standard
  const pageWidth = doc.internal.pageSize.getWidth();

  const sortedInvoices = sortInvoicesByDateThenNumber(invoices);

  let yPosition = drawStatementHeader(doc, statementTitle, groupCustomers, sortedInvoices, margin, pageWidth);

  const tableData = sortedInvoices.map((inv) => {
    let dateStr = '';
    if (inv.date) {
      const date = new Date(inv.date);
      if (!isNaN(date.getTime())) {
        dateStr = `${date.getDate().toString().padStart(2, '0')}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
      }
    }
    const num = (inv.number || '').trim().toUpperCase();
    const isSpecialType = num.startsWith('BIL') || num.startsWith('JV');
    let type = isSpecialType ? '-' : getInvoiceType({ number: inv.number, debit: inv.debit, credit: inv.credit } as any);
    if (!isSpecialType && inv.date) {
      const year = new Date(inv.date).getFullYear();
      if (!isNaN(year)) {
        type = `${type} ${year}`;
      }
    }

    return [
      inv.customerName || '',
      dateStr,
      type,
      (inv.number || '').split(' ')[0],
      inv.debit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
      inv.credit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
      inv.difference?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'
    ];
  });

  const tableOptions = {
    startY: yPosition,
    margin: { left: margin, right: margin, bottom: 20 },
    head: [['CUSTOMER NAME', 'DATE', 'TYPE', 'NUMBER', 'DEBIT', 'CREDIT', 'NET DEBT']],
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
      0: { cellWidth: 70, font: 'Amiri', halign: 'center' as const },
      1: { cellWidth: 26 },
      2: { cellWidth: 26, textColor: COLORS.gray },
      3: { font: 'Amiri' },
      4: { cellWidth: 35 },
      5: { cellWidth: 35, textColor: COLORS.gray },
      6: { cellWidth: 35, fontStyle: 'bold' }
    },
    didParseCell: function (data: any) {
      if (data.section === 'head') return;
      if (data.row.index % 2 === 1) {
        data.cell.styles.fillColor = COLORS.lightGray;
      } else {
        data.cell.styles.fillColor = COLORS.white;
      }
      if (data.column.index === 6) {
        const rowVal = sortedInvoices[data.row.index];
        const nd = rowVal ? rowVal.difference : 0;
        if (nd > 0) data.cell.styles.textColor = [204, 0, 0];
        else if (nd < 0) data.cell.styles.textColor = [0, 153, 0];
      }
    }
  };

  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions as any);
  }

  const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 10;
  
  const totalDebit = sortedInvoices.reduce((sum, inv) => sum + (inv.debit || 0), 0);
  const totalCredit = sortedInvoices.reduce((sum, inv) => sum + (inv.credit || 0), 0);
  const totalDifference = totalDebit - totalCredit;

  drawStatementFooter(doc, sortedInvoices.length, totalDifference, finalY, margin, pageWidth);
  addPageNumbers(doc, pageWidth, margin);

  if (isPrint) {
    printPdfInSameTab(doc);
  } else {
    const fileName = statementTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    saveTrackedPdf(doc, `${fileName}_${currentDate}.pdf`);
  }
}
