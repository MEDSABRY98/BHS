'use client';

import { getInvoiceType } from '@/lib/InvoiceType';
import { addArabicFont, TYPE_BADGE_COLORS } from './shared';

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

  const doc = new jsPDF('l', 'mm', 'a4');
  await addArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPosition = 20;

  const tableWidth = 40 + 35 + 65 + 40 + 40 + 40;
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
    let invoiceNumber = inv.number || '';
    if (shortenInvoiceNumbers && invoiceNumber) {
      invoiceNumber = invoiceNumber.split(' ')[0];
    }
    return [
      dateStr,
      type,
      invoiceNumber,
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
        doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'F');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(text, x + width / 2, y + height / 2, { align: 'center', baseline: 'middle' });
      }
    }
  };

  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions as any);
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

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${totalPages}`, margin, doc.internal.pageSize.getHeight() - 10);
  }

  const fileName = `${customerName}.pdf`;
  if (returnBlob) return doc.output('blob');
  doc.save(fileName);
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
  }>,
  shortenInvoiceNumbers: boolean = true
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
    const startPage = doc.getNumberOfPages();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = 20;

    const tableWidth = 260;
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
      let invoiceNumber = inv.number || '';
      if (shortenInvoiceNumbers && invoiceNumber) {
        invoiceNumber = invoiceNumber.split(' ')[0];
      }
      return [
        dateStr,
        type,
        invoiceNumber,
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
      styles: { font: 'helvetica', fontStyle: 'normal', valign: 'middle' },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 10, halign: 'center', font: 'helvetica' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 40, halign: 'center', font: 'helvetica' },
        1: { cellWidth: 35, halign: 'center', font: 'helvetica' },
        2: { cellWidth: 65, halign: 'center', font: 'Amiri' },
        3: { cellWidth: 40, halign: 'center', font: 'helvetica' },
        4: { cellWidth: 40, halign: 'center', font: 'helvetica' },
        5: { cellWidth: 40, halign: 'center', font: 'helvetica' }
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
          doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
          doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'F');
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.text(text, x + width / 2, y + height / 2, { align: 'center', baseline: 'middle' });
        }
      }
    };

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableOptions);
    } else if (typeof autoTable === 'function') {
      autoTable(doc, tableOptions as any);
    }

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;
    const totalBoxWidth = 50;
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
    doc.text('TOTAL DUE', totalBoxX + totalBoxWidth / 2, totalBoxY + 6, { align: 'center' });
    doc.setFontSize(14);
    doc.text(totalNetDebt.toLocaleString('en-US'), totalBoxX + totalBoxWidth / 2, totalBoxY + 12, { align: 'center' });

    const endPage = doc.getNumberOfPages();
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

export async function generateMonthlySeparatedPDF(
  customerName: string,
  invoices: Array<{
    date: string;
    number: string;
    debit: number;
    credit: number;
    netDebt: number;
  }>,
  shortenInvoiceNumbers: boolean = true
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const invoicesByMonth: Record<string, typeof invoices> = {};
  invoices.forEach((inv) => {
    if (!inv.date) return;
    const date = new Date(inv.date);
    if (isNaN(date.getTime())) return;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    if (!invoicesByMonth[key]) invoicesByMonth[key] = [];
    invoicesByMonth[key].push(inv);
  });

  const sortedKeys = Object.keys(invoicesByMonth).sort();
  if (sortedKeys.length === 0) return;

  const doc = new jsPDF('l', 'mm', 'a4');
  await addArabicFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const monthInvoices = invoicesByMonth[key];
    const [yearStr, monthStr] = key.split('-');
    const dateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1);
    const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    if (i > 0) doc.addPage();
    const margin = 15;
    let yPosition = 20;

    const tableWidth = 260;
    const tableLeftMargin = (pageWidth - tableWidth) / 2;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Account Statement', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;

    doc.setFontSize(12);
    doc.setTextColor(0, 155, 77);
    doc.setFont('helvetica', 'bold');
    doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    doc.setFontSize(14);
    doc.setFont('Amiri', 'normal');
    doc.text(`Customer: ${customerName} (${monthLabel})`, margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const currentDate = `${now.getDate()}-${now.toLocaleDateString('en-US', { month: 'short' })}-${now.getFullYear()}`;
    doc.text(`Generated: ${currentDate}`, margin, yPosition);
    yPosition += 8;

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
      let invoiceNumber = inv.number || '';
      if (shortenInvoiceNumbers && invoiceNumber) {
        invoiceNumber = invoiceNumber.split(' ')[0];
      }
      return [dateStr, type, invoiceNumber, inv.debit.toLocaleString('en-US'), inv.credit.toLocaleString('en-US'), inv.netDebt.toLocaleString('en-US')];
    });

    const totalDebit = monthInvoices.reduce((sum, inv) => sum + inv.debit, 0);
    const totalCredit = monthInvoices.reduce((sum, inv) => sum + inv.credit, 0);
    const totalNetDebt = totalDebit - totalCredit;

    tableData.push(['', '', 'TOTAL', totalDebit.toLocaleString('en-US'), totalCredit.toLocaleString('en-US'), totalNetDebt.toLocaleString('en-US')]);

    const tableOptions = {
      startY: yPosition,
      margin: { left: tableLeftMargin, right: tableLeftMargin },
      head: [['Date', 'Type', 'Number', 'Debit', 'Credit', 'Net Debit']],
      body: tableData,
      theme: 'striped' as const,
      styles: { font: 'helvetica', fontStyle: 'normal', valign: 'middle' },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 10, halign: 'center', font: 'helvetica' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 40, halign: 'center', font: 'helvetica' },
        1: { cellWidth: 35, halign: 'center', font: 'helvetica' },
        2: { cellWidth: 65, halign: 'center', font: 'Amiri' },
        3: { cellWidth: 40, halign: 'center', font: 'helvetica' },
        4: { cellWidth: 40, halign: 'center', font: 'helvetica' },
        5: { cellWidth: 40, halign: 'center', font: 'helvetica' }
      },
      didParseCell: function (data: any) {
        if (data.section === 'head') {
          data.cell.styles.textColor = 255;
          return;
        }
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = 0;
          return;
        }
        const inv = monthInvoices[data.row.index];
        const isReturnPayment = inv && getInvoiceType(inv) === 'R-Payment';
        if (isReturnPayment && data.column.index !== 1) data.cell.styles.fillColor = [255, 235, 235];
        if (data.column.index === 1 && data.row.index < tableData.length - 1) {
          const type = getInvoiceType(monthInvoices[data.row.index]);
          const colors = TYPE_BADGE_COLORS[type] || TYPE_BADGE_COLORS['Invoice/Txn'];
          data.cell.styles.fillColor = isReturnPayment ? [254, 226, 226] : colors.fillColor;
          data.cell.styles.textColor = isReturnPayment ? [185, 28, 28] : colors.textColor;
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 5 && data.row.index < tableData.length - 1) {
          const netDebt = monthInvoices[data.row.index].netDebt;
          if (netDebt > 0) data.cell.styles.textColor = [204, 0, 0];
          else if (netDebt < 0) data.cell.styles.textColor = [0, 153, 0];
        }
      }
    };

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableOptions);
    } else if (typeof autoTable === 'function') {
      autoTable(doc, tableOptions as any);
    }

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;
    const totalBoxWidth = 50;
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
    doc.text('MONTH TOTAL', totalBoxX + totalBoxWidth / 2, totalBoxY + 6, { align: 'center' });
    doc.setFontSize(14);
    doc.text(totalNetDebt.toLocaleString('en-US'), totalBoxX + totalBoxWidth / 2, totalBoxY + 12, { align: 'center' });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  }
  doc.save(`${customerName}.pdf`);
}
