import type { SupplierTransaction } from '../../Service/suppliers_service';

export interface SupplierStatementRow {
  date: string;
  number: string;
  reference: string;
  debit: number;   // payments / debit notes (positive residual)
  credit: number;  // invoices (negative residual)
  net: number;     // credit - debit  (amount payable to supplier)
  /** open items only: partly paid / partly applied — debit + credit show the full amounts, net = what is left */
  partial?: boolean;
  _residual?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const toNum = (v: unknown) => Number(String(v ?? 0).replace(/,/g, '')) || 0;

/** "Bil0/2026/09/0025 PP-SS-26-1489" → number "Bil0/2026/09/0025", reference "PP-SS-26-1489" (the rest of the text) */
function splitNumber(v: unknown): { number: string; reference: string } {
  const text = String(v ?? '').trim();
  const cut = text.search(/\s/);
  return cut < 0 ? { number: text, reference: '' } : { number: text.slice(0, cut), reference: text.slice(cut).trim() };
}

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
    const dbDebit = round2(toNum(t['DEBIT']));
    const dbCredit = round2(toNum(t['CREDIT']));

    if (filterType === 'open') {
      const base = {
        date: t.DATE ? String(t.DATE).split('T')[0] : '',
        number: splitNumber(t.NUMBER).number,
        reference: String(t.REFERENCE || (t as any).REF || '').trim() || splitNumber(t.NUMBER).reference,
        _residual: residual,
      };
      const original = round2(dbCredit - dbDebit); // + invoice, - payment / debit note
      const open = -residual;                       // what is still open, same sign
      const settled = round2(original - open);      // the part already paid / applied
      const isPartial =
        Math.abs(open) > 0.005 && Math.abs(settled) > 0.005 && Math.sign(original) === Math.sign(open) && Math.abs(open) < Math.abs(original);

      if (isPartial) {
        // partly paid invoice: credit = invoice, debit = paid part, net = left
        // partly applied payment: debit = payment, credit = applied part, net = left
        return original > 0
          ? { ...base, debit: settled, credit: original, net: open, partial: true }
          : { ...base, debit: -original, credit: -settled, net: open, partial: true };
      }
      return {
        ...base,
        debit: residual > 0 ? residual : 0,
        credit: residual < 0 ? -residual : 0,
        net: -residual,
      };
    } else {
      return {
        date: t.DATE ? String(t.DATE).split('T')[0] : '',
        number: splitNumber(t.NUMBER).number,
        reference: String(t.REFERENCE || (t as any).REF || '').trim() || splitNumber(t.NUMBER).reference,
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
