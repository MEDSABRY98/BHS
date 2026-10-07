import type { SupplierTransaction } from '../../Service/suppliers_service';

export interface SupplierStatementRow {
  date: string;
  number: string;
  reference: string;
  debit: number;   // payments / debit notes (positive residual)
  credit: number;  // invoices (negative residual)
  net: number;     // credit - debit  (amount payable to supplier)
  _residual?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Builds the open-items statement for a supplier based on RESIDUAL AMOUNT only.
 * In the raw Odoo export invoices are negative and payments are positive.
 */
export function buildSupplierStatement(
  supplierId: string,
  transactions: SupplierTransaction[],
  filterType: 'all' | 'open' | 'closed',
  targetYear?: string,
  targetMonth?: string
): SupplierStatementRow[] {
  const filteredTx = transactions.filter(t => t['SUPPLIER ID'] === supplierId);

  let rows = filteredTx.map(t => {
    const residual = round2(Number(t['RESIDUAL AMOUNT']) || 0);
    const dbDebit = round2(Number(t['DEBIT']) || 0);
    const dbCredit = round2(Number(t['CREDIT']) || 0);
    
    if (filterType === 'open') {
      return {
        date: t.DATE ? String(t.DATE).split('T')[0] : '',
        number: String(t.NUMBER || '').trim().split(/\s+/)[0] || '',
        reference: String(t.REFERENCE || t['REF' as any] || '').trim(),
        debit: residual > 0 ? residual : 0,
        credit: residual < 0 ? -residual : 0,
        net: -residual,
        _residual: residual
      };
    } else {
      return {
        date: t.DATE ? String(t.DATE).split('T')[0] : '',
        number: String(t.NUMBER || '').trim().split(/\s+/)[0] || '',
        reference: String(t.REFERENCE || t['REF' as any] || '').trim(),
        debit: dbDebit,
        credit: dbCredit,
        net: dbCredit - dbDebit,
        _residual: residual
      };
    }
  });

  if (filterType === 'open') {
    rows = rows.filter(r => r._residual !== 0);
  } else if (filterType === 'closed') {
    rows = rows.filter(r => r._residual === 0);
  }

  if (targetYear) {
    rows = rows.filter(r => r.date.startsWith(targetYear));
  }
  if (targetMonth) {
    const mm = targetMonth.padStart(2, '0');
    rows = rows.filter(r => {
      const pts = r.date.split('-');
      return pts.length >= 2 && pts[1] === mm;
    });
  }

  rows.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  return rows;
}

export function formatStatementDate(value: string | Date): string {
  if (!value) return '';
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else {
    const [y, m, day] = value.split('T')[0].split('-').map(Number);
    d = new Date(y, (m || 1) - 1, day || 1);
  }
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleDateString('en-US', { month: 'short' })}-${d.getFullYear()}`;
}

export function safeFileName(name: string): string {
  return (name || 'Supplier').replace(/[\\/:*?"<>|]+/g, '_').trim();
}
