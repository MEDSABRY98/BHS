// ════════════════════════════════════════════════════════════════
//  Salesperson Analysis — daily sales report data (server only).
//  Used by Scheduled Reports (ScheduledReports/Reports/DailySales.ts, emailed PDF);
//  loadUsers / loadCustomers are also used by the module. No 'use server' on purpose:
//  these functions must not be callable from the browser.
// ════════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSalesDataServer } from '@/app/Sales/Cache/SalesCache';
import type { CustomerStats, DailySalesLine, DailySalesReportData, DailyTotals } from '../Utils/DailyTypes';

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();
const dayOf = (v: unknown) => String(v ?? '').split('T')[0].trim();
const pad = (n: number) => String(n).padStart(2, '0');
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function loadUsers() {
  const { data, error } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME');
  if (error) throw error;
  const idByKey = new Map<string, string>(); // ID or NAME → ID
  const nameById = new Map<string, string>();
  for (const u of (data || []) as any[]) {
    const id = norm(u.ID);
    if (!id) continue;
    const name = String(u.NAME || '').trim();
    idByKey.set(id, id);
    if (name) idByKey.set(norm(name), id);
    nameById.set(id, name || id);
  }
  return { idByKey, nameById };
}

export type CustomerRow = { id: string; subName: string; mainName: string; city: string; rep: string; tag: string; cls: string };

export async function loadCustomers(): Promise<Map<string, CustomerRow>> {
  const map = new Map<string, CustomerRow>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await getSupabaseAdmin()
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER ID", "CUSTOMER SUB NAME", "CUSTOMER MAIN NAME", "CUSTOMER CITY", "SALES_REP", "CUSTOMER TAG", "CUSTOMER CLASS"')
      .order('CUSTOMER ID', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const r of rows as any[]) {
      const id = String(r['CUSTOMER ID'] ?? '').trim();
      if (!id) continue;
      map.set(norm(id), {
        id,
        subName: String(r['CUSTOMER SUB NAME'] || r['CUSTOMER MAIN NAME'] || id).trim(),
        mainName: String(r['CUSTOMER MAIN NAME'] || r['CUSTOMER SUB NAME'] || id).trim(),
        city: String(r['CUSTOMER CITY'] || '').trim(),
        rep: norm(r['SALES_REP']),
        tag: String(r['CUSTOMER TAG'] || '').trim(),
        cls: String(r['CUSTOMER CLASS'] || '').trim(),
      });
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return map;
}


const UNASSIGNED = 'UNASSIGNED';
const MAX_REPORT_DAYS = 93;
/** buying pattern window for the Missed Customers table */
const HISTORY_DAYS = 180;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * The daily sales report data for a period.
 * onlySalespersonId = null → every salesperson (+ Unassigned); otherwise only that salesperson.
 * No login check here: callers (the server action / the scheduled reports runner) decide who may see what.
 */
export async function buildDailySalesReportData(opts: {
  start: string;
  end: string;
  onlySalespersonId: string | null;
  showCosts: boolean;
}): Promise<DailySalesReportData> {
  const start = String(opts.start || '');
  const end = String(opts.end || '');
  if (!ISO_DAY.test(start) || !ISO_DAY.test(end) || start > end) throw new Error('Invalid period');
  const days = daysBetween(start, end) + 1;
  if (days > MAX_REPORT_DAYS) throw new Error(`Pick ${MAX_REPORT_DAYS} days at most`);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));

  const [{ idByKey, nameById }, customers] = await Promise.all([loadUsers(), loadCustomers()]);
  const allSalespersons = !opts.onlySalespersonId;
  const ownId = opts.onlySalespersonId ? idByKey.get(norm(opts.onlySalespersonId)) || norm(opts.onlySalespersonId) : '';
  const showCosts = !!opts.showCosts;

  const salespersons: Record<string, string> = {};
  const customerInfo: DailySalesReportData['customers'] = {};
  const productInfo: DailySalesReportData['products'] = {};
  const lines: DailySalesLine[] = [];
  type Acc = { gross: number; returns: number; net: number; qty: number; profit: number; costedSales: number; invoices: Set<string>; customers: Set<string> };
  const newAcc = (): Acc => ({ gross: 0, returns: 0, net: 0, qty: 0, profit: 0, costedSales: 0, invoices: new Set<string>(), customers: new Set<string>() });
  const prev = newAcc();
  const prevBySp = new Map<string, Acc>();
  const prevNetBySalesperson: Record<string, number> = {};
  // per customer: previous period net + purchase days / invoices of the last HISTORY_DAYS (up to the period end)
  const historyStart = addDays(end, -(HISTORY_DAYS - 1));
  type Hist = { spId: string; prevNet: number; days: Set<string>; invoices: Set<string>; gross: number };
  const hist = new Map<string, Hist>();

  const salesAll = (await getSalesDataServer()) as any[];
  for (const s of salesAll) {
    const date = dayOf(s.invoiceDate);
    if (!date || date > end || (date < prevStart && date < historyStart)) continue;
    const cust = customers.get(norm(s.customerId));
    const spId = cust?.rep ? idByKey.get(cust.rep) || cust.rep : UNASSIGNED;
    if (!allSalespersons && spId !== ownId) continue;

    // buying pattern (all lines from historyStart to the end)
    const histId = cust ? cust.id : String(s.customerId ?? '').trim();
    if (histId) {
      const h = hist.get(histId) || { spId, prevNet: 0, days: new Set<string>(), invoices: new Set<string>(), gross: 0 };
      const amt = Number(s.amount) || 0;
      if (date >= historyStart && amt > 0) {
        h.days.add(date);
        h.gross += amt;
        const inv = String(s.invoiceNumber ?? '').trim();
        if (inv) h.invoices.add(inv);
      }
      if (date >= prevStart && date <= prevEnd) h.prevNet += amt;
      hist.set(histId, h);
      if (!customerInfo[histId]) {
        customerInfo[histId] = {
          name: cust?.subName || String(s.customerName || histId).trim(),
          mainName: cust?.mainName || String(s.customerMainName || s.customerName || histId).trim(),
          city: cust?.city || '',
        };
      }
      if (!salespersons[spId]) salespersons[spId] = spId === UNASSIGNED ? 'Unassigned' : nameById.get(spId) || spId;
    }
    if (date < prevStart) continue; // history only

    const amount = Number(s.amount) || 0;
    const qty = Number(s.qty) || 0;
    // the cost is always loaded: the product Margin columns show for everyone; showCosts only hides the profit cards / columns
    const unitCost = Number(s.productCost) || 0;
    const customerId = cust ? cust.id : String(s.customerId ?? '').trim();
    const invoice = String(s.invoiceNumber ?? '').trim();

    if (date < start) {
      // previous period: totals only (same rules as the Sales tab), for the company and per salesperson
      const q = Math.abs(qty);
      if (!prevBySp.has(spId)) prevBySp.set(spId, newAcc());
      for (const acc of [prev, prevBySp.get(spId)!]) {
        acc.net += amount;
        if (amount > 0) {
          acc.gross += amount;
          acc.qty += q;
          if (invoice) acc.invoices.add(invoice);
          if (customerId) acc.customers.add(customerId);
          if (unitCost > 0) {
            acc.profit += amount - unitCost * q;
            acc.costedSales += amount;
          }
        } else if (amount < 0) {
          acc.returns += -amount;
          if (unitCost > 0) {
            acc.profit += amount + unitCost * q;
            acc.costedSales += amount;
          }
        }
      }
      prevNetBySalesperson[spId] = (prevNetBySalesperson[spId] || 0) + amount;
      continue;
    }

    if (!salespersons[spId]) salespersons[spId] = spId === UNASSIGNED ? 'Unassigned' : nameById.get(spId) || spId;
    if (customerId && !customerInfo[customerId]) {
      customerInfo[customerId] = {
        name: cust?.subName || String(s.customerName || customerId).trim(),
        mainName: cust?.mainName || String(s.customerMainName || s.customerName || customerId).trim(),
        city: cust?.city || '',
      };
    }
    const productId = String(s.productId ?? '').trim();
    if (productId && !productInfo[productId]) {
      productInfo[productId] = {
        barcode: String(s.barcode || '').trim(),
        name: String(s.product || productId).trim(),
        category: String(s.productTag || 'Uncategorized').trim() || 'Uncategorized',
      };
    }
    lines.push({ date, invoice, salespersonId: spId, customerId, productId, amount, qty, cost: unitCost });
  }

  return {
    period: { start, end },
    prevPeriod: { start: prevStart, end: prevEnd },
    allSalespersons,
    showCosts,
    salespersons,
    customers: customerInfo,
    products: productInfo,
    lines,
    prevTotals: totalsFrom(prev),
    prevNetBySalesperson,
    prevTotalsBySalesperson: Object.fromEntries([...prevBySp].map(([id, acc]) => [id, totalsFrom(acc)])),
    customerStats: Object.fromEntries(
      [...hist].map(([id, h]) => {
        const days = [...h.days].sort();
        const stats: CustomerStats = {
          salespersonId: h.spId,
          prevNet: h.prevNet,
          lastPurchase: days[days.length - 1] || '',
          purchaseDays: days.length,
          avgGapDays: days.length > 1 ? daysBetween(days[0], days[days.length - 1]) / (days.length - 1) : 0,
          avgOrder: h.invoices.size ? h.gross / h.invoices.size : 0,
        };
        return [id, stats];
      }),
    ),
  };
}

function totalsFrom(acc: { gross: number; returns: number; net: number; qty: number; profit: number; costedSales: number; invoices: Set<string>; customers: Set<string> }): DailyTotals {
  return {
    gross: acc.gross,
    returns: acc.returns,
    net: acc.net,
    invoices: acc.invoices.size,
    customers: acc.customers.size,
    qty: acc.qty,
    profit: acc.profit,
    costedSales: acc.costedSales,
  };
}

/** Every salesperson that has customers (id + name), A-Z. */
export async function listAllSalespersons(): Promise<{ id: string; name: string }[]> {
  const [{ idByKey, nameById }, customers] = await Promise.all([loadUsers(), loadCustomers()]);
  const out = new Map<string, string>();
  customers.forEach((c) => {
    if (!c.rep) return;
    const id = idByKey.get(c.rep) || c.rep;
    if (!out.has(id)) out.set(id, nameById.get(id) || c.rep);
  });
  return [...out].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
