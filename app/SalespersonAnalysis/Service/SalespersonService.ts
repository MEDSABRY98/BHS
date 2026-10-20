'use server';

// ════════════════════════════════════════════════════════════════
//  Salesperson Analysis — server side
//  • listSalespersons: who can be picked (admins / full data access: everyone;
//    other users: only themselves)
//  • getSalespersonData: the salesperson's sales lines + his share of the
//    customers' ledger (same rules as everywhere else: sales invoice → sub
//    customer's SALES_REP, payments follow MATCHING, the rest split equally)
// ════════════════════════════════════════════════════════════════

import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSheetData } from '@/lib/supabase';
import { getSalesDataServer } from '@/app/Sales/Cache/SalesCache';
import {
  applyDebitScope,
  buildDebitScopeFor,
  hasFullDebitAccess,
} from '@/app/CustomersAnalysis/Service/debit_scope';
import { getInvoiceType } from '@/app/CustomersAnalysis/Utils/InvoiceType';
import type { InvoiceRow } from '@/types';
import type {
  LedgerRow,
  Period,
  SalesCustomerInfo,
  SalesLine,
  SalesProductInfo,
  SalespersonData,
  SalespersonOption,
} from '../Utils/Types';
import type { DailySalesLine, DailySalesReportData } from '../Utils/DailyTypes';

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();
const dayOf = (v: unknown) => String(v ?? '').split('T')[0].trim();
const pad = (n: number) => String(n).padStart(2, '0');
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function shiftYear(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y + years, m, 0).getDate();
  return `${y + years}-${pad(m)}-${pad(Math.min(d, last))}`;
}

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (!hasModuleAccess(user)) throw new UnauthorizedError("You don't have access to Salesperson Analysis.");
  return user;
}

/** Admin Control → 'salesperson-analysis' must be enabled for the user (admins always). */
function hasModuleAccess(user: SessionUserRecord): boolean {
  if (isAdminUser(user, 'salesperson-analysis')) return true;
  try {
    const roleStr = String(user.role || '').trim();
    if (!roleStr || roleStr === 'Admin') return true;
    const perms = JSON.parse(roleStr);
    if (Array.isArray(perms.systems)) return perms.systems.includes('salesperson-analysis');
  } catch {
    // no permissions JSON: open (same default as the other modules)
  }
  return true;
}

/** Same rule as the Sales module: admins always; FULL DATA ACCESS alone does not unlock costs. */
function canSeeCosts(user: SessionUserRecord): boolean {
  if (isAdminUser(user, 'salesperson-analysis')) return true;
  try {
    const roleStr = String(user.role || '').trim();
    if (!roleStr || roleStr === 'Admin') return true;
    const perms = JSON.parse(roleStr);
    if (perms['sales-actions'] !== undefined) {
      return Array.isArray(perms['sales-actions']) && perms['sales-actions'].includes('view-costs');
    }
  } catch {
    // default: visible
  }
  return true;
}

async function loadUsers() {
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

type CustomerRow = { id: string; subName: string; mainName: string; city: string; rep: string };

async function loadCustomers(): Promise<Map<string, CustomerRow>> {
  const map = new Map<string, CustomerRow>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await getSupabaseAdmin()
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER ID", "CUSTOMER SUB NAME", "CUSTOMER MAIN NAME", "CUSTOMER CITY", "SALES_REP"')
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
      });
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

/** Salespersons that can be picked by the logged-in user. */
export async function ListSalespersons(): Promise<{ canChoose: boolean; salespersons: SalespersonOption[] }> {
  const user = await requireUser();
  const [{ idByKey, nameById }, customers] = await Promise.all([loadUsers(), loadCustomers()]);

  if (!hasFullDebitAccess(user, 'salesperson-analysis')) {
    const id = idByKey.get(norm(user.id)) || norm(user.id);
    return { canChoose: false, salespersons: [{ id, name: nameById.get(id) || user.name }] };
  }

  const options = new Map<string, SalespersonOption>();
  customers.forEach((c) => {
    if (!c.rep) return;
    const id = idByKey.get(c.rep) || c.rep;
    if (!options.has(id)) options.set(id, { id, name: nameById.get(id) || c.rep });
  });
  return {
    canChoose: true,
    salespersons: Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Everything the module needs for one salesperson and one period. */
export async function GetSalespersonData(input: { salespersonId: string; period: Period }): Promise<SalespersonData> {
  const user = await requireUser();
  const { start, end } = input.period || ({} as Period);
  if (!ISO_DAY.test(String(start)) || !ISO_DAY.test(String(end)) || start > end) {
    throw new Error('Invalid period');
  }

  const [{ idByKey, nameById }, customers] = await Promise.all([loadUsers(), loadCustomers()]);
  const ownId = idByKey.get(norm(user.id)) || norm(user.id);
  const targetId = idByKey.get(norm(input.salespersonId)) || norm(input.salespersonId);
  if (!hasFullDebitAccess(user, 'salesperson-analysis') && targetId !== ownId) {
    throw new UnauthorizedError("You can only see your own analysis.");
  }
  const salesperson: SalespersonOption = { id: targetId, name: nameById.get(targetId) || input.salespersonId };
  const isTarget = (rep: string) => !!rep && (idByKey.get(rep) || rep) === targetId;

  const windowStart = shiftYear(start, -1);
  const showCosts = canSeeCosts(user);

  // ── sales lines of his customers (sub customer's SALES_REP) ──
  const salesAll = (await getSalesDataServer()) as any[];
  const sales: SalesLine[] = [];
  const customerInfo: Record<string, SalesCustomerInfo> = {};
  const productInfo: Record<string, SalesProductInfo> = {};
  for (const s of salesAll) {
    const cust = customers.get(norm(s.customerId));
    if (!cust || !isTarget(cust.rep)) continue;
    const date = dayOf(s.invoiceDate);
    if (!date) continue;

    const info =
      customerInfo[cust.id] ||
      (customerInfo[cust.id] = {
        id: cust.id,
        name: cust.subName,
        mainName: cust.mainName,
        city: cust.city,
        firstPurchase: date,
        lastPurchase: date,
      });
    const amount = Number(s.amount) || 0;
    if (amount > 0) {
      if (date < info.firstPurchase) info.firstPurchase = date;
      if (date > info.lastPurchase) info.lastPurchase = date;
    }

    if (date < windowStart || date > end) continue;
    const productId = String(s.productId ?? '').trim();
    if (productId && !productInfo[productId]) {
      productInfo[productId] = {
        id: productId,
        barcode: String(s.barcode || '').trim(),
        name: String(s.product || productId).trim(),
        category: String(s.productTag || 'Uncategorized').trim() || 'Uncategorized',
      };
    }
    sales.push({
      date,
      invoice: String(s.invoiceNumber ?? '').trim(),
      customerId: cust.id,
      productId,
      amount,
      qty: Number(s.qty) || 0,
      cost: showCosts ? Number(s.productCost) || 0 : 0,
    });
  }

  // ── his share of the ledger ──
  const sheet = (await getSheetData()) as InvoiceRow[];
  const scope = await buildDebitScopeFor(
    { id: salesperson.id, name: salesperson.name },
    { includeMerchandiser: false },
  );
  const mine = applyDebitScope(sheet, scope);

  // last payment per main customer (all history)
  const lastPaymentByCustomer: Record<string, string> = {};
  // closed matching groups entirely before the window don't change balances / aging.
  // A group is dropped only as a whole: dropping just its old rows would leave a fake
  // residual and make the Debit numbers depend on the selected period.
  const groupNet = new Map<string, number>();
  const groupLastDate = new Map<string, string>();
  for (const r of mine) {
    const key = String(r.matching || '').trim();
    if (key) {
      groupNet.set(key, (groupNet.get(key) || 0) + (Number(r.debit) || 0) - (Number(r.credit) || 0));
      const d = dayOf(r.date);
      if (d > (groupLastDate.get(key) || '')) groupLastDate.set(key, d);
    }
    if (getInvoiceType(r) === 'Payment') {
      const d = dayOf(r.date);
      const name = r.customerName || '';
      if (d && (!lastPaymentByCustomer[name] || d > lastPaymentByCustomer[name])) lastPaymentByCustomer[name] = d;
    }
  }

  const ledger: LedgerRow[] = [];
  for (const r of mine) {
    const date = dayOf(r.date);
    const key = String(r.matching || '').trim();
    const closedOldGroup =
      key && Math.abs(groupNet.get(key) || 0) < 0.01 && (groupLastDate.get(key) || '') < windowStart;
    if (closedOldGroup) continue;
    ledger.push({
      id: String(r.id),
      date,
      dueDate: dayOf(r.dueDate),
      number: r.number || '',
      customerId: r.customerId || '',
      customerName: r.customerName || '',
      city: r.city || '',
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
      matching: key,
      paymentTerm: r.paymentTerm,
      isCustomerVendor: r.isCustomerVendor,
    });
  }

  return {
    salesperson,
    period: { start, end },
    windowStart,
    showCosts,
    sales,
    customers: customerInfo,
    products: productInfo,
    ledger,
    lastPaymentByCustomer,
  };
}

// ════════════════════════════════════════════════════════════════
//  Daily sales report: every salesperson (or only himself) for a short period,
//  plus the totals of the period of the same length right before it.
// ════════════════════════════════════════════════════════════════
const UNASSIGNED = 'UNASSIGNED';
const MAX_REPORT_DAYS = 93;

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

export async function GetDailySalesReport(input: { start: string; end: string }): Promise<DailySalesReportData> {
  const user = await requireUser();
  const start = String(input?.start || '');
  const end = String(input?.end || '');
  if (!ISO_DAY.test(start) || !ISO_DAY.test(end) || start > end) throw new Error('Invalid period');
  const days = daysBetween(start, end) + 1;
  if (days > MAX_REPORT_DAYS) throw new Error(`Pick ${MAX_REPORT_DAYS} days at most`);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));

  const [{ idByKey, nameById }, customers] = await Promise.all([loadUsers(), loadCustomers()]);
  const allSalespersons = hasFullDebitAccess(user, 'salesperson-analysis');
  const ownId = idByKey.get(norm(user.id)) || norm(user.id);
  const showCosts = canSeeCosts(user);

  const salespersons: Record<string, string> = {};
  const customerInfo: DailySalesReportData['customers'] = {};
  const productInfo: DailySalesReportData['products'] = {};
  const lines: DailySalesLine[] = [];
  const prev = { gross: 0, returns: 0, net: 0, qty: 0, profit: 0, costedSales: 0, invoices: new Set<string>(), customers: new Set<string>() };
  const prevNetBySalesperson: Record<string, number> = {};

  const salesAll = (await getSalesDataServer()) as any[];
  for (const s of salesAll) {
    const date = dayOf(s.invoiceDate);
    if (!date || date < prevStart || date > end) continue;
    const cust = customers.get(norm(s.customerId));
    const spId = cust?.rep ? idByKey.get(cust.rep) || cust.rep : UNASSIGNED;
    if (!allSalespersons && spId !== ownId) continue;

    const amount = Number(s.amount) || 0;
    const qty = Number(s.qty) || 0;
    const unitCost = showCosts ? Number(s.productCost) || 0 : 0;
    const customerId = cust ? cust.id : String(s.customerId ?? '').trim();
    const invoice = String(s.invoiceNumber ?? '').trim();

    if (date < start) {
      // previous period: totals only (same rules as the Sales tab)
      const q = Math.abs(qty);
      prev.net += amount;
      if (amount > 0) {
        prev.gross += amount;
        prev.qty += q;
        if (invoice) prev.invoices.add(invoice);
        if (customerId) prev.customers.add(customerId);
        if (unitCost > 0) {
          prev.profit += amount - unitCost * q;
          prev.costedSales += amount;
        }
      } else if (amount < 0) {
        prev.returns += -amount;
        if (unitCost > 0) {
          prev.profit += amount + unitCost * q;
          prev.costedSales += amount;
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
    prevTotals: {
      gross: prev.gross,
      returns: prev.returns,
      net: prev.net,
      invoices: prev.invoices.size,
      customers: prev.customers.size,
      qty: prev.qty,
      profit: prev.profit,
      costedSales: prev.costedSales,
    },
    prevNetBySalesperson,
  };
}
