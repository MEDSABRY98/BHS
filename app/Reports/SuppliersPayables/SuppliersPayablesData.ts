// Suppliers Payables — data + calculation (no UI).
// Open amount owed to a supplier = −(sum of RESIDUAL AMOUNT) of its open lines (invoices are negative, payments positive),
// the same rule the Suppliers Analysis statement uses. The residual is today's figure, so the period only filters
// WHICH lines (by their date) are counted — it is not a historical snapshot.

import { fetchSuppliersList, fetchSupplierTransactions, type SupplierRecord, type SupplierTransaction } from '@/app/SuppliersAnalysis/Service/suppliers_service';

export type PayablesScope = 'upto' | 'only';

export interface PayablesRow {
  supplierId: string;
  name: string;
  termDays: number;
  open: number;
}

export interface PayablesPeriod {
  year: number;
  month: number;          // 1-12, 0 = the whole year
  scope: PayablesScope;   // upto = everything dated up to the end of the period · only = only the period
}

const pad = (n: number) => String(n).padStart(2, '0');
const round2 = (n: number) => Math.round(n * 100) / 100;

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function periodBounds(p: PayablesPeriod): { start: string; end: string } {
  const lastDay = p.month === 0 ? 31 : new Date(p.year, p.month, 0).getDate();
  const endMonth = p.month === 0 ? 12 : p.month;
  const startMonth = p.month === 0 ? 1 : p.month;
  return { start: p.scope === 'only' ? `${p.year}-${pad(startMonth)}-01` : '', end: `${p.year}-${pad(endMonth)}-${pad(lastDay)}` };
}

export function periodLabel(p: PayablesPeriod): string {
  const name = p.month === 0 ? `${p.year}` : `${MONTH_NAMES[p.month - 1]} ${p.year}`;
  return p.scope === 'only' ? `Invoices dated in ${name}` : `Open balance up to ${p.month === 0 ? `31 Dec ${p.year}` : name}`;
}

export function buildPayables(suppliers: SupplierRecord[], transactions: SupplierTransaction[], period: PayablesPeriod): PayablesRow[] {
  const { start, end } = periodBounds(period);
  const bySupplier = new Map(suppliers.map((s) => [String(s['SUPPLIER ID']).trim(), s]));
  const open = new Map<string, number>();

  for (const t of transactions) {
    const residual = Number(t['RESIDUAL AMOUNT']) || 0;
    if (residual === 0) continue;
    const date = t.DATE ? String(t.DATE).split('T')[0] : '';
    if (!date || date > end || (start && date < start)) continue;
    const id = String(t['SUPPLIER ID'] || '').trim();
    if (!id) continue;
    open.set(id, (open.get(id) || 0) - residual);
  }

  const rows: PayablesRow[] = [];
  open.forEach((amount, id) => {
    const value = round2(amount);
    if (value <= 0.005) return; // nothing owed (or the supplier owes us)
    const s = bySupplier.get(id);
    rows.push({ supplierId: id, name: String(s?.['SUPPLIER NAME'] || `Supplier ${id}`).trim(), termDays: Number(s?.['PAYMENT TERM']) || 0, open: value });
  });
  return rows.sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

export async function loadPayables(period: PayablesPeriod): Promise<PayablesRow[]> {
  const [suppliers, transactions] = await Promise.all([fetchSuppliersList(), fetchSupplierTransactions()]);
  return buildPayables(suppliers, transactions, period);
}

/** Several periods at once (one fetch): rows per period, same order as asked. */
export async function loadPayablesMany(periods: PayablesPeriod[]): Promise<{ period: PayablesPeriod; rows: PayablesRow[] }[]> {
  const [suppliers, transactions] = await Promise.all([fetchSuppliersList(), fetchSupplierTransactions()]);
  return periods.map((period) => ({ period, rows: buildPayables(suppliers, transactions, period) }));
}
