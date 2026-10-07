import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { SupplierStatementRow, formatStatementDate, safeFileName } from './StatementData';

export async function generateSupplierStatementExcel(supplierName: string, rows: SupplierStatementRow[]) {
  if (rows.length === 0) return;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const data: Record<string, unknown>[] = rows.map(r => ({
    Date: formatStatementDate(r.date),
    Number: r.number,
    Reference: r.reference,
    Debit: r.debit,
    Credit: r.credit,
    'Net Balance': r.net,
  }));

  data.push({
    Date: '',
    Number: 'TOTAL',
    Reference: '',
    Debit: round2(rows.reduce((s, r) => s + r.debit, 0)),
    Credit: round2(rows.reduce((s, r) => s + r.credit, 0)),
    'Net Balance': round2(rows.reduce((s, r) => s + r.net, 0)),
  });

  await exportStyledExcel(data, `${safeFileName(supplierName)}_Statement`, {
    sheetName: 'Statement',
    columnWidth: 22,
    numericColumns: ['Debit', 'Credit', 'Net Balance'],
  });
}
