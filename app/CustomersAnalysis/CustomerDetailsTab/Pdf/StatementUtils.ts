'use client';

import { addArabicFont } from '@/app/Components/Pdf/shared';
import { saveTrackedPdf } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { sortInvoicesByDateThenNumber } from '@/app/CustomersAnalysis/CustomerDetailsTab/Utils';
import {
  addPageNumbers,
  buildAccountStatementDoc,
  drawStatementFooter,
  drawStatementHeader,
  generateTableData,
  getTableOptions,
} from './StatementCore';

// The drawing lives in StatementCore.ts (also used on the server by Mail Center).

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
  _monthsLabel: string = 'All Months',
  shortenInvoiceNumbers: boolean = true
) {
  const doc = await buildAccountStatementDoc(customerName, invoices, shortenInvoiceNumbers, addArabicFont);
  if (returnBlob) return doc.output('blob');
  saveTrackedPdf(doc, `${customerName}_Statement.pdf`);
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
  shortenInvoiceNumbers: boolean = true,
  monthsLabel?: string
) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: 'Bulk_Statements' });
  await addArabicFont(doc);

  const margin = 8;
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 0; i < statements.length; i++) {
    const { customerName, invoices: rawInvoices } = statements[i];
    const sortedInvoices = sortInvoicesByDateThenNumber(rawInvoices);
    
    if (i > 0) doc.addPage();
    
    let yPosition = drawStatementHeader(doc, customerName, sortedInvoices, margin, pageWidth);
    
    const tableData = generateTableData(sortedInvoices, shortenInvoiceNumbers);
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
  }
  
  addPageNumbers(doc, pageWidth, margin);
  
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

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setProperties({ title: `Statement_${customerName}` });
  await addArabicFont(doc);

  const margin = 8;
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const monthInvoices = sortInvoicesByDateThenNumber(invoicesByMonth[key]);
    const [yearStr, monthStr] = key.split('-');
    const dateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1);
    const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    if (i > 0) doc.addPage();
    
    // Add month label to customer name for header
    const displayName = `${customerName} (${monthLabel})`;
    let yPosition = drawStatementHeader(doc, displayName, monthInvoices, margin, pageWidth);
    
    const tableData = generateTableData(monthInvoices, shortenInvoiceNumbers);
    const tableOptions = getTableOptions(tableData, monthInvoices, yPosition, margin, pageWidth);

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableOptions);
    } else if (typeof autoTable === 'function') {
      autoTable(doc, tableOptions as any);
    }

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 10;
    
    const totalDebit = monthInvoices.reduce((sum, inv) => sum + inv.debit, 0);
    const totalCredit = monthInvoices.reduce((sum, inv) => sum + inv.credit, 0);
    const totalNetDebt = totalDebit - totalCredit;

    drawStatementFooter(doc, monthInvoices.length, totalNetDebt, finalY, margin, pageWidth);
  }

  addPageNumbers(doc, pageWidth, margin);

  saveTrackedPdf(doc, `${customerName}_Monthly.pdf`);
}
