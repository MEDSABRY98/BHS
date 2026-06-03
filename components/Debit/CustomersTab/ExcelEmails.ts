import { InvoiceRow } from '@/types';
import { getInvoiceType } from './CstomersUtils';

export const generateSingleCustomerExcelBlob = async (customerName: string, invoices: InvoiceRow[]): Promise<Blob> => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Transactions');

  // Disable grid lines
  ws.views = [{ showGridLines: false }];

  // Define columns
  ws.columns = [
    { key: 'date', width: 20 },
    { key: 'type', width: 20 },
    { key: 'number', width: 33 }, // ~250 pixels
    { key: 'debit', width: 20 },
    { key: 'credit', width: 20 },
  ];

  // Helper for borders
  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
    left: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
    right: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } }
  };

  // Row 1: Merged Title (Customer Name)
  ws.mergeCells('A1:E1');
  const titleRow = ws.getRow(1);
  titleRow.height = 30;
  const titleCell = ws.getCell('A1');
  titleCell.value = customerName;
  titleCell.font = { name: 'Calibri', size: 12, bold: true };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F5F5' } // Light grey background
  };
  titleCell.border = thinBorder;

  // Apply border to merged cells B1:E1
  for (let col = 2; col <= 5; col++) {
    ws.getCell(1, col).border = thinBorder;
  }

  // Row 2: Headers
  const headers = ['Date', 'Type', 'Number', 'Debit', 'Credit'];
  const headerRow = ws.getRow(2);
  headerRow.height = 30;
  headerRow.values = headers;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF000000' } // Black background
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' } // White text
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  // Data Rows
  let currentRowNum = 3;
  invoices.forEach(inv => {
    const row = ws.getRow(currentRowNum);
    row.height = 30;
    
    row.getCell(1).value = inv.date;
    const invType = getInvoiceType(inv);
    const numUpper = (inv.number || '').toUpperCase();
    row.getCell(2).value = (numUpper.startsWith('JV') || numUpper.startsWith('BIL')) ? '-' : invType;
    row.getCell(3).value = (inv.number || '').split(' ')[0];
    
    const debitVal = inv.debit ? parseFloat(inv.debit.toString()) : 0;
    const creditVal = inv.credit ? parseFloat(inv.credit.toString()) : 0;
    
    row.getCell(4).value = debitVal;
    row.getCell(5).value = creditVal;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder;
      
      if (colNumber === 4 || colNumber === 5) {
        cell.numFmt = '#,##0.00';
      }
    });
    
    currentRowNum++;
  });

  // Footer Row 1: Total
  const totalRow = ws.getRow(currentRowNum);
  totalRow.height = 30;
  ws.mergeCells(`A${currentRowNum}:C${currentRowNum}`);
  
  const totalLabelCell = ws.getCell(`A${currentRowNum}`);
  totalLabelCell.value = 'Total';
  totalLabelCell.font = { name: 'Calibri', size: 11, bold: true };
  totalLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  
  for (let col = 1; col <= 3; col++) {
    const c = totalRow.getCell(col);
    c.border = thinBorder;
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9F9F9' }
    };
  }

  const debitTotalCell = totalRow.getCell(4);
  debitTotalCell.value = { formula: `=SUM(D3:D${currentRowNum - 1})` };
  debitTotalCell.font = { name: 'Calibri', size: 11, bold: true };
  debitTotalCell.alignment = { vertical: 'middle', horizontal: 'center' };
  debitTotalCell.numFmt = '#,##0.00';
  debitTotalCell.border = thinBorder;
  debitTotalCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9F9F9' }
  };

  const creditTotalCell = totalRow.getCell(5);
  creditTotalCell.value = { formula: `=SUM(E3:E${currentRowNum - 1})` };
  creditTotalCell.font = { name: 'Calibri', size: 11, bold: true };
  creditTotalCell.alignment = { vertical: 'middle', horizontal: 'center' };
  creditTotalCell.numFmt = '#,##0.00';
  creditTotalCell.border = thinBorder;
  creditTotalCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9F9F9' }
  };

  currentRowNum++;

  // Footer Row 2: Net (Debit - Credit)
  const netRow = ws.getRow(currentRowNum);
  netRow.height = 30;
  ws.mergeCells(`A${currentRowNum}:C${currentRowNum}`);
  
  const netLabelCell = ws.getCell(`A${currentRowNum}`);
  netLabelCell.value = 'Net Balance (Debit - Credit)';
  netLabelCell.font = { name: 'Calibri', size: 11, bold: true };
  netLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  
  for (let col = 1; col <= 3; col++) {
    const c = netRow.getCell(col);
    c.border = thinBorder;
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' }
    };
  }

  ws.mergeCells(`D${currentRowNum}:E${currentRowNum}`);
  const netValCell = netRow.getCell(4);
  netValCell.value = { formula: `=D${currentRowNum - 1}-E${currentRowNum - 1}` };
  netValCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF9C0006' } }; // Red text
  netValCell.alignment = { vertical: 'middle', horizontal: 'center' };
  netValCell.numFmt = '#,##0.00';
  netValCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFC7CE' } // Soft red
  };
  
  for (let col = 4; col <= 5; col++) {
    netRow.getCell(col).border = thinBorder;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
