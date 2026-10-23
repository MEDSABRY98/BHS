// ════════════════════════════════════════════════════════════════
//  Salesperson Analysis — all calculations (pure functions)
//  Sales  : the salesperson's sales lines (Sales DB)
//  Debit  : his share of the customers' ledger, aged with the same
//           Days / Months logic as Customers Analysis
//  Collections : payments in his share of the ledger
// ════════════════════════════════════════════════════════════════

import type { InvoiceRow } from '@/types';
import { computeCustomerAging, computeDaysOverdue } from '@/app/CustomersAnalysis/DebitInsightsTab/Utils/PortfolioAging';
import { getInvoiceType } from '@/app/CustomersAnalysis/Utils/InvoiceType';
import { getPaymentCategory } from '@/app/PaymentAnalysis/Utils/PaymentType';
import type { AgingMode, LedgerRow, Period, SalespersonData } from './Types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

export function ShiftYear(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(y + years, m, 0).getDate();
  return `${y + years}-${pad(m)}-${pad(Math.min(d, last))}`;
}

export function TodayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** Opens on the current month (1st of the month → today). */
export function DefaultPeriod(): Period {
  const t = new Date();
  return { start: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-01`, end: TodayIso() };
}

/** % change, null when there is nothing to compare with. */
export function Change(current: number, previous: number): number | null {
  return previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
}

export function DaysSince(iso: string): number | null {
  if (!iso) return null;
  const t = new Date(`${iso}T00:00:00`).getTime();
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
}

const inRange = (d: string, a: string, b: string) => !!d && d >= a && d <= b;

function periodMonths(period: Period) {
  const list: { key: string; prevKey: string; label: string }[] = [];
  const [sy, sm] = period.start.split('-').map(Number);
  const [ey, em] = period.end.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    list.push({
      key: `${y}-${pad(m)}`,
      prevKey: `${y - 1}-${pad(m)}`,
      label: sy === ey ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${String(y).slice(2)}`,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return list;
}

// ─────────────────────────────────────────────────────────────
//  SALES
// ─────────────────────────────────────────────────────────────
type SalesTotals = {
  netSales: number;
  grossSales: number;
  returns: number;
  invoices: number;
  customers: number;
  qty: number;
  profit: number;
  costedSales: number; // sales of lines that have a cost (for the margin %)
};

function salesTotals(lines: SalespersonData['sales']): SalesTotals {
  const t: SalesTotals = { netSales: 0, grossSales: 0, returns: 0, invoices: 0, customers: 0, qty: 0, profit: 0, costedSales: 0 };
  const invoices = new Set<string>();
  const customers = new Set<string>();
  for (const l of lines) {
    const qty = Math.abs(l.qty);
    t.netSales += l.amount;
    if (l.amount > 0) {
      t.grossSales += l.amount;
      t.qty += qty;
      if (l.invoice) invoices.add(l.invoice);
      customers.add(l.customerId);
      if (l.cost > 0) {
        t.profit += l.amount - l.cost * qty;
        t.costedSales += l.amount;
      }
    } else if (l.amount < 0) {
      t.returns += -l.amount;
      if (l.cost > 0) {
        t.profit += l.amount + l.cost * qty;
        t.costedSales += l.amount;
      }
    }
  }
  t.invoices = invoices.size;
  t.customers = customers.size;
  return t;
}

export function ComputeSales(data: SalespersonData) {
  const { period } = data;
  const prevEnd = ShiftYear(period.end, -1);
  const current = data.sales.filter((l) => inRange(l.date, period.start, period.end));
  const previous = data.sales.filter((l) => inRange(l.date, data.windowStart, prevEnd));
  const cur = salesTotals(current);
  const prev = salesTotals(previous);

  const byMonth = new Map<string, number>();
  for (const l of [...current, ...previous]) {
    const k = l.date.slice(0, 7);
    byMonth.set(k, (byMonth.get(k) || 0) + l.amount);
  }
  const monthly = periodMonths(period).map((m) => ({
    month: m.label,
    current: byMonth.get(m.key) || 0,
    previous: byMonth.get(m.prevKey) || 0,
  }));

  // categories
  const catMap = new Map<string, number>();
  for (const l of current) {
    const cat = data.products[l.productId]?.category || 'Uncategorized';
    catMap.set(cat, (catMap.get(cat) || 0) + l.amount);
  }
  const catPrev = new Map<string, number>();
  for (const l of previous) {
    const cat = data.products[l.productId]?.category || 'Uncategorized';
    catPrev.set(cat, (catPrev.get(cat) || 0) + l.amount);
  }
  const catProducts = new Map<string, Set<string>>();
  for (const l of current) {
    const cat = data.products[l.productId]?.category || 'Uncategorized';
    const set = catProducts.get(cat) || new Set<string>();
    if (l.amount > 0) set.add(l.productId);
    catProducts.set(cat, set);
  }
  const categories = Array.from(catMap.entries())
    .map(([category, net]) => {
      const previous = catPrev.get(category) || 0;
      return {
        category,
        net,
        share: cur.netSales ? (net / cur.netSales) * 100 : 0,
        products: catProducts.get(category)?.size || 0,
        previous,
        growth: Change(net, previous),
      };
    })
    .sort((a, b) => b.net - a.net);

  // cities
  const cityMap = new Map<string, { city: string; net: number; customers: Set<string>; invoices: Set<string> }>();
  for (const l of current) {
    const city = data.customers[l.customerId]?.city || 'Unknown';
    const e = cityMap.get(city) || { city, net: 0, customers: new Set<string>(), invoices: new Set<string>() };
    e.net += l.amount;
    if (l.amount > 0) {
      e.customers.add(l.customerId);
      if (l.invoice) e.invoices.add(l.invoice);
    }
    cityMap.set(city, e);
  }
  const cities = Array.from(cityMap.values())
    .map((c) => ({ city: c.city, net: c.net, customers: c.customers.size, invoices: c.invoices.size }))
    .sort((a, b) => b.net - a.net);

  // customers (current vs last year)
  const custCur = new Map<string, { net: number; invoices: Set<string> }>();
  for (const l of current) {
    const e = custCur.get(l.customerId) || { net: 0, invoices: new Set<string>() };
    e.net += l.amount;
    if (l.amount > 0 && l.invoice) e.invoices.add(l.invoice);
    custCur.set(l.customerId, e);
  }
  const custPrev = new Map<string, number>();
  for (const l of previous) custPrev.set(l.customerId, (custPrev.get(l.customerId) || 0) + l.amount);

  const topCustomers = Array.from(custCur.entries())
    .map(([id, e]) => {
      const info = data.customers[id];
      const prevNet = custPrev.get(id) || 0;
      return {
        id,
        name: info?.name || id,
        city: info?.city || '',
        net: e.net,
        invoices: e.invoices.size,
        previous: prevNet,
        growth: Change(e.net, prevNet),
      };
    })
    .sort((a, b) => b.net - a.net);

  const newCustomers = Object.values(data.customers)
    .filter((c) => inRange(c.firstPurchase, period.start, period.end))
    .map((c) => ({ ...c, net: custCur.get(c.id)?.net || 0 }))
    .sort((a, b) => b.net - a.net);

  // bought in the same period last year, nothing in this period
  const lostCustomers = Array.from(custPrev.entries())
    .filter(([id, prevNet]) => prevNet > 0 && !(custCur.get(id)?.invoices.size))
    .map(([id, prevNet]) => {
      const info = data.customers[id];
      return { id, name: info?.name || id, city: info?.city || '', previous: prevNet, lastPurchase: info?.lastPurchase || '' };
    })
    .sort((a, b) => b.previous - a.previous);

  // products
  const prodMap = new Map<string, { net: number; qty: number }>();
  for (const l of current) {
    const e = prodMap.get(l.productId) || { net: 0, qty: 0 };
    e.net += l.amount;
    e.qty += l.amount >= 0 ? Math.abs(l.qty) : -Math.abs(l.qty);
    prodMap.set(l.productId, e);
  }
  const prodPrev = new Map<string, number>();
  for (const l of previous) prodPrev.set(l.productId, (prodPrev.get(l.productId) || 0) + l.amount);

  const topProducts = Array.from(prodMap.entries())
    .map(([id, e]) => {
      const prevNet = prodPrev.get(id) || 0;
      return {
        id,
        barcode: data.products[id]?.barcode || '',
        name: data.products[id]?.name || id || 'Unknown',
        category: data.products[id]?.category || 'Uncategorized',
        net: e.net,
        qty: e.qty,
        share: cur.netSales ? (e.net / cur.netSales) * 100 : 0,
        previous: prevNet,
        growth: Change(e.net, prevNet),
      };
    })
    .sort((a, b) => b.net - a.net);

  return {
    cur,
    prev,
    avgInvoice: cur.invoices ? cur.grossSales / cur.invoices : 0,
    prevAvgInvoice: prev.invoices ? prev.grossSales / prev.invoices : 0,
    returnRate: cur.grossSales ? (cur.returns / cur.grossSales) * 100 : 0,
    marginPct: cur.costedSales ? (cur.profit / cur.costedSales) * 100 : null,
    prevMarginPct: prev.costedSales ? (prev.profit / prev.costedSales) * 100 : null,
    monthly,
    categories,
    cities,
    topCustomers,
    newCustomers,
    lostCustomers,
    topProducts,
  };
}

// ─────────────────────────────────────────────────────────────
//  CUSTOMERS — grouped by main customer or by sub customer
// ─────────────────────────────────────────────────────────────
export type CustomerLevel = 'main' | 'sub';

export function ComputeCustomers(data: SalespersonData, level: CustomerLevel) {
  const { period } = data;
  const prevEnd = ShiftYear(period.end, -1);
  const keyOf = (customerId: string) => {
    const info = data.customers[customerId];
    if (level === 'sub') return customerId;
    return (info?.mainName || info?.name || customerId).trim();
  };

  type Group = {
    id: string;
    name: string;
    cities: Map<string, number>;
    subs: Set<string>;
    firstPurchase: string;
    lastPurchase: string;
    net: number;
    previous: number;
    invoices: Set<string>;
    prevInvoices: number;
  };
  const groups = new Map<string, Group>();
  const groupOf = (customerId: string): Group => {
    const key = keyOf(customerId);
    let g = groups.get(key);
    if (!g) {
      const info = data.customers[customerId];
      g = {
        id: key,
        name: level === 'sub' ? info?.name || customerId : key,
        cities: new Map(),
        subs: new Set(),
        firstPurchase: '',
        lastPurchase: '',
        net: 0,
        previous: 0,
        invoices: new Set(),
        prevInvoices: 0,
      };
      groups.set(key, g);
    }
    return g;
  };

  // every customer of the salesperson (for first / last purchase over all history)
  for (const info of Object.values(data.customers)) {
    const g = groupOf(info.id);
    g.subs.add(info.id);
    if (info.firstPurchase && (!g.firstPurchase || info.firstPurchase < g.firstPurchase)) g.firstPurchase = info.firstPurchase;
    if (info.lastPurchase && info.lastPurchase > g.lastPurchase) g.lastPurchase = info.lastPurchase;
  }

  for (const l of data.sales) {
    const g = groupOf(l.customerId);
    const city = data.customers[l.customerId]?.city || '';
    if (inRange(l.date, period.start, period.end)) {
      g.net += l.amount;
      if (l.amount > 0 && l.invoice) g.invoices.add(l.invoice);
      if (city) g.cities.set(city, (g.cities.get(city) || 0) + l.amount);
    } else if (inRange(l.date, data.windowStart, prevEnd)) {
      g.previous += l.amount;
      if (l.amount > 0) g.prevInvoices++;
      if (city && !g.cities.has(city)) g.cities.set(city, 0);
    }
  }

  // main customer with branches in many cities → city with the biggest sales
  const cityOf = (g: Group) => {
    if (g.cities.size === 0) {
      const any = Array.from(g.subs).map((id) => data.customers[id]?.city).find(Boolean);
      return any || '';
    }
    return Array.from(g.cities.entries()).sort((a, b) => b[1] - a[1])[0][0];
  };

  const all = Array.from(groups.values()).map((g) => ({
    id: g.id,
    name: g.name,
    city: cityOf(g),
    subs: g.subs.size,
    firstPurchase: g.firstPurchase,
    lastPurchase: g.lastPurchase,
    net: g.net,
    invoices: g.invoices.size,
    previous: g.previous,
    growth: Change(g.net, g.previous),
  }));

  const topCustomers = all.filter((c) => c.invoices > 0 || c.net !== 0).sort((a, b) => b.net - a.net);
  const newCustomers = all.filter((c) => inRange(c.firstPurchase, period.start, period.end)).sort((a, b) => b.net - a.net);
  const lostCustomers = all.filter((c) => c.previous > 0 && c.invoices === 0).sort((a, b) => b.previous - a.previous);

  return { topCustomers, newCustomers, lostCustomers };
}

// ─────────────────────────────────────────────────────────────
//  DEBIT
// ─────────────────────────────────────────────────────────────
export const AGING_BUCKETS = [
  { key: 'atDate', label: 'Current' },
  { key: 'oneToThirty', label: '1-30' },
  { key: 'thirtyOneToSixty', label: '31-60' },
  { key: 'sixtyOneToNinety', label: '61-90' },
  { key: 'ninetyOneToOneTwenty', label: '91-120' },
  { key: 'older', label: '120+' },
] as const;

type BucketKey = (typeof AGING_BUCKETS)[number]['key'];

export function ComputeDebit(data: SalespersonData, mode: AgingMode) {
  const byCustomer = new Map<string, LedgerRow[]>();
  for (const r of data.ledger) {
    const list = byCustomer.get(r.customerName) || [];
    list.push(r);
    byCustomer.set(r.customerName, list);
  }

  const totals: Record<BucketKey, number> = {
    atDate: 0,
    oneToThirty: 0,
    thirtyOneToSixty: 0,
    sixtyOneToNinety: 0,
    ninetyOneToOneTwenty: 0,
    older: 0,
  };
  const customers: {
    name: string;
    city: string;
    balance: number;
    aging: Record<BucketKey, number>;
    overdue: number;
    lastPayment: string;
  }[] = [];
  const cityMap = new Map<string, { city: string; balance: number; customers: number }>();

  byCustomer.forEach((rows, name) => {
    const res = computeCustomerAging(rows as unknown as InvoiceRow[], new Date(), mode);
    if (res.netDebt <= 0.01) return;
    const aging = res.agingBreakdown as Record<BucketKey, number>;
    AGING_BUCKETS.forEach((b) => (totals[b.key] += aging[b.key] || 0));
    const overdue = res.netDebt - (aging.atDate || 0);
    const city = rows.find((r) => r.city)?.city || 'Unknown';
    customers.push({ name, city, balance: res.netDebt, aging, overdue, lastPayment: data.lastPaymentByCustomer[name] || '' });
    const c = cityMap.get(city) || { city, balance: 0, customers: 0 };
    c.balance += res.netDebt;
    c.customers += 1;
    cityMap.set(city, c);
  });

  customers.sort((a, b) => b.balance - a.balance);
  const openDebit = customers.reduce((s, c) => s + c.balance, 0);
  const overdue = openDebit - totals.atDate;
  const over90 = totals.ninetyOneToOneTwenty + totals.older;

  return {
    openDebit,
    overdue,
    overduePct: openDebit ? (overdue / openDebit) * 100 : 0,
    over90,
    over90Pct: openDebit ? (over90 / openDebit) * 100 : 0,
    customersCount: customers.length,
    buckets: AGING_BUCKETS.map((b) => ({ key: b.key, label: b.label, amount: totals[b.key] })),
    cities: Array.from(cityMap.values()).sort((a, b) => b.balance - a.balance),
    customers,
  };
}

/**
 * Only the open debit older than `days` days, as ledger rows (one row per open item, with its open amount).
 * Same open items and same day count as the aging: unmatched rows, and the residual of each matching group
 * (kept on the group's main invoice). Unapplied credits are left out: this is the old debit itself.
 */
export function LedgerOverdueAbove(data: SalespersonData, days: number, mode: AgingMode): LedgerRow[] {
  const out: LedgerRow[] = [];
  const byCustomer = new Map<string, LedgerRow[]>();
  for (const r of data.ledger) byCustomer.set(r.customerName, [...(byCustomer.get(r.customerName) || []), r]);
  const ref = new Date();
  ref.setHours(0, 0, 0, 0);

  byCustomer.forEach((rows) => {
    const groupNet = new Map<string, number>();
    const mainRow = new Map<string, LedgerRow>();
    for (const r of rows) {
      if (!r.matching) continue;
      groupNet.set(r.matching, (groupNet.get(r.matching) || 0) + r.debit - r.credit);
      const cur = mainRow.get(r.matching);
      if (!cur || r.debit > cur.debit) mainRow.set(r.matching, r);
    }
    for (const r of rows) {
      const amount = !r.matching ? r.debit - r.credit : mainRow.get(r.matching) === r ? groupNet.get(r.matching) || 0 : 0;
      if (amount <= 0.01) continue;
      if (computeDaysOverdue(r.dueDate, r.date, ref, r.paymentTerm, mode) > days) {
        out.push({ ...r, debit: amount, credit: 0, matching: '' });
      }
    }
  });
  return out;
}

// ─────────────────────────────────────────────────────────────
//  COLLECTIONS
// ─────────────────────────────────────────────────────────────
function paymentAmount(r: LedgerRow): number {
  const cat = getPaymentCategory(r);
  if (cat === 'Payment') return r.credit;
  if (cat === 'Refund') return -r.debit;
  return 0;
}

function isPaymentRow(r: LedgerRow) {
  const t = getInvoiceType(r);
  return (t === 'Payment' || t === 'R-Payment') && getPaymentCategory(r) !== 'Other';
}

function collectionTotals(rows: LedgerRow[]) {
  let net = 0;
  let payments = 0;
  let collected = 0;
  const customers = new Set<string>();
  for (const r of rows) {
    const amount = paymentAmount(r);
    net += amount;
    if (getPaymentCategory(r) === 'Payment') {
      payments += 1;
      collected += amount;
      customers.add(r.customerName);
    }
  }
  return { net, payments, collected, customers: customers.size, avgPayment: payments ? collected / payments : 0 };
}

/** Collections of the period by customer class (bhs_CUSTOMERS "CUSTOMER CLASS"), vs the same period last year. */
export function ComputeCollectionsByClass(data: SalespersonData) {
  const { period } = data;
  const prevEnd = ShiftYear(period.end, -1);
  const meta = data.customerMeta || {};
  const clsOf = (r: LedgerRow) => meta[String(r.customerId ?? '').trim().toUpperCase()]?.cls || 'No Class';
  const map = new Map<string, { cls: string; net: number; prev: number; payments: number; customers: Set<string> }>();
  const get = (cls: string) => map.get(cls) || (map.set(cls, { cls, net: 0, prev: 0, payments: 0, customers: new Set<string>() }), map.get(cls)!);
  for (const r of data.ledger) {
    if (!isPaymentRow(r)) continue;
    if (inRange(r.date, period.start, period.end)) {
      const e = get(clsOf(r));
      e.net += paymentAmount(r);
      if (getPaymentCategory(r) === 'Payment') {
        e.payments += 1;
        e.customers.add(r.customerName);
      }
    } else if (inRange(r.date, data.windowStart, prevEnd)) {
      get(clsOf(r)).prev += paymentAmount(r);
    }
  }
  const total = [...map.values()].reduce((s, e) => s + e.net, 0);
  return [...map.values()]
    .map((e) => ({ cls: e.cls, net: e.net, previous: e.prev, payments: e.payments, customers: e.customers.size, share: total ? (e.net / total) * 100 : 0 }))
    .filter((e) => Math.abs(e.net) > 0.01 || Math.abs(e.previous) > 0.01)
    .sort((a, b) => b.net - a.net);
}

export function ComputeCollections(data: SalespersonData) {
  const { period } = data;
  const prevEnd = ShiftYear(period.end, -1);
  const payRows = data.ledger.filter(isPaymentRow);
  const current = payRows.filter((r) => inRange(r.date, period.start, period.end));
  const previous = payRows.filter((r) => inRange(r.date, data.windowStart, prevEnd));
  const cur = collectionTotals(current);
  const prev = collectionTotals(previous);

  const months = periodMonths(period);
  const payByMonth = new Map<string, number>();
  for (const r of [...current, ...previous]) {
    const k = r.date.slice(0, 7);
    payByMonth.set(k, (payByMonth.get(k) || 0) + paymentAmount(r));
  }
  const salesByMonth = new Map<string, number>();
  for (const l of data.sales) {
    if (!inRange(l.date, period.start, period.end)) continue;
    const k = l.date.slice(0, 7);
    salesByMonth.set(k, (salesByMonth.get(k) || 0) + l.amount);
  }
  const monthly = months.map((m) => ({
    month: m.label,
    current: payByMonth.get(m.key) || 0,
    previous: payByMonth.get(m.prevKey) || 0,
    sales: salesByMonth.get(m.key) || 0,
  }));

  const netSales = data.sales
    .filter((l) => inRange(l.date, period.start, period.end))
    .reduce((s, l) => s + l.amount, 0);

  // per customer
  const custMap = new Map<string, { name: string; city: string; net: number; payments: number; last: string }>();
  for (const r of current) {
    const e = custMap.get(r.customerName) || { name: r.customerName, city: r.city, net: 0, payments: 0, last: '' };
    e.net += paymentAmount(r);
    if (getPaymentCategory(r) === 'Payment') {
      e.payments += 1;
      if (r.date > e.last) e.last = r.date;
    }
    custMap.set(r.customerName, e);
  }
  const customers = Array.from(custMap.values()).sort((a, b) => b.net - a.net);

  // balance and no payment in the period
  const paid = new Set(current.filter((r) => getPaymentCategory(r) === 'Payment').map((r) => r.customerName));
  const balances = new Map<string, { name: string; city: string; balance: number }>();
  for (const r of data.ledger) {
    const e = balances.get(r.customerName) || { name: r.customerName, city: r.city, balance: 0 };
    e.balance += r.debit - r.credit;
    balances.set(r.customerName, e);
  }
  const unpaid = Array.from(balances.values())
    .filter((c) => c.balance > 1 && !paid.has(c.name))
    .map((c) => ({ ...c, lastPayment: data.lastPaymentByCustomer[c.name] || '' }))
    .sort((a, b) => b.balance - a.balance);

  const recent = [...current]
    .filter((r) => getPaymentCategory(r) === 'Payment')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 15)
    .map((r) => ({ date: r.date, customer: r.customerName, number: r.number, amount: paymentAmount(r) }));

  return {
    cur,
    prev,
    collectionRate: netSales ? (cur.net / netSales) * 100 : null,
    monthly,
    customers,
    unpaid,
    recent,
  };
}

// ─────────────────────────────────────────────────────────────
//  COLLECTION QUALITY — when the money came in vs the due date
// ─────────────────────────────────────────────────────────────
export const LATENESS_BUCKETS = [
  { key: 'onTime', label: 'On Time' },
  { key: 'd1_30', label: '1-30' },
  { key: 'd31_60', label: '31-60' },
  { key: 'd61_90', label: '61-90' },
  { key: 'd91_120', label: '91-120' },
  { key: 'd120', label: '120+' },
] as const;
type LatenessKey = (typeof LATENESS_BUCKETS)[number]['key'];

const lateKey = (days: number): LatenessKey =>
  days <= 0 ? 'onTime' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : days <= 120 ? 'd91_120' : 'd120';

/**
 * Each payment matched to invoices (MATCHING) is split over the group's invoices,
 * oldest invoice first (earlier credits of the group are applied first), and every
 * part is aged on the payment date with the same rule as the debit aging:
 * 'months' (default) = invoice month + payment term, from the 1st of the next month;
 * 'days' = from the due date. Payments without matching = "unapplied".
 */
export function ComputeCollectionQuality(data: SalespersonData, mode: AgingMode = 'months') {
  const { period } = data;
  const prevEnd = ShiftYear(period.end, -1);

  type Part = { date: string; customer: string; amount: number; late: number };
  const parts: Part[] = []; // applied parts of the payments (both periods)
  let unapplied = 0;
  let unappliedPrev = 0;
  const unappliedByCustomer = new Map<string, number>();
  const paymentsByCustomer = new Map<string, number>();

  // matching groups
  const groups = new Map<string, LedgerRow[]>();
  for (const r of data.ledger) {
    if (!r.matching) continue;
    groups.set(r.matching, [...(groups.get(r.matching) || []), r]);
  }

  const isCurrent = (d: string) => inRange(d, period.start, period.end);
  const isPrev = (d: string) => inRange(d, data.windowStart, prevEnd);

  // unmatched payments
  for (const raw of data.ledger) {
    const r = raw.paymentDate ? { ...raw, date: raw.paymentDate } : raw;
    if (r.matching || !isPaymentRow(r) || getPaymentCategory(r) !== 'Payment') continue;
    const amount = paymentAmount(r);
    if (isCurrent(r.date)) {
      unapplied += amount;
      unappliedByCustomer.set(r.customerName, (unappliedByCustomer.get(r.customerName) || 0) + amount);
      paymentsByCustomer.set(r.customerName, (paymentsByCustomer.get(r.customerName) || 0) + 1);
    } else if (isPrev(r.date)) unappliedPrev += amount;
  }

  // matched payments: FIFO over the group's invoices
  groups.forEach((rows) => {
    const invoices = rows
      .filter((r) => r.debit > 0)
      .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date))
      .map((r) => ({ row: r, left: r.debit }));
    if (!invoices.length) return;
    // a payment counts on the day the money is collected (PAYMENT DATE, e.g. the cheque's due date), else its date
    const credits = rows
      .filter((r) => r.credit > 0)
      .map((r) => ({ ...r, date: r.paymentDate || r.date }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let i = 0;
    for (const cr of credits) {
      let left = cr.credit;
      const counts = isPaymentRow(cr) && getPaymentCategory(cr) === 'Payment' && (isCurrent(cr.date) || isPrev(cr.date));
      if (counts && isCurrent(cr.date)) paymentsByCustomer.set(cr.customerName, (paymentsByCustomer.get(cr.customerName) || 0) + 1);
      while (left > 0.005 && i < invoices.length) {
        const take = Math.min(left, invoices[i].left);
        if (counts && cr.date) {
          const inv = invoices[i].row;
          const late = computeDaysOverdue(inv.dueDate, inv.date, new Date(`${cr.date}T00:00:00`), inv.paymentTerm, mode);
          parts.push({ date: cr.date, customer: cr.customerName, amount: take, late });
        }
        invoices[i].left -= take;
        left -= take;
        if (invoices[i].left <= 0.005) i++;
      }
      // more paid than the group's invoices → the rest counts as unapplied
      if (counts && left > 0.005) {
        if (isCurrent(cr.date)) {
          unapplied += left;
          unappliedByCustomer.set(cr.customerName, (unappliedByCustomer.get(cr.customerName) || 0) + left);
        } else unappliedPrev += left;
      }
    }
  });

  const summarize = (list: Part[], unappl: number) => {
    const applied = list.reduce((s, p) => s + p.amount, 0);
    const buckets = Object.fromEntries(LATENESS_BUCKETS.map((b) => [b.key, 0])) as Record<LatenessKey, number>;
    let weighted = 0;
    for (const p of list) {
      buckets[lateKey(p.late)] += p.amount;
      weighted += Math.max(0, p.late) * p.amount;
    }
    const total = applied + unappl;
    return {
      applied,
      unapplied: unappl,
      total,
      avgDaysLate: applied ? weighted / applied : null,
      onTimePct: applied ? (buckets.onTime / applied) * 100 : null,
      unappliedPct: total ? (unappl / total) * 100 : null,
      buckets,
    };
  };

  const curParts = parts.filter((p) => isCurrent(p.date));
  const prevParts = parts.filter((p) => isPrev(p.date));
  const cur = summarize(curParts, unapplied);
  const prev = summarize(prevParts, unappliedPrev);

  // average days late per month (this period vs same months last year)
  const monthAvg = (list: Part[]) => {
    const m = new Map<string, { w: number; a: number }>();
    for (const p of list) {
      const k = p.date.slice(0, 7);
      const e = m.get(k) || { w: 0, a: 0 };
      e.w += Math.max(0, p.late) * p.amount;
      e.a += p.amount;
      m.set(k, e);
    }
    return m;
  };
  const curM = monthAvg(curParts);
  const prevM = monthAvg(prevParts);
  const monthly = periodMonths(period).map((mo) => {
    const c = curM.get(mo.key);
    const p = prevM.get(mo.prevKey);
    return {
      month: mo.label,
      current: c && c.a ? Math.round((c.w / c.a) * 10) / 10 : null,
      previous: p && p.a ? Math.round((p.w / p.a) * 10) / 10 : null,
    };
  });

  // per customer
  const custMap = new Map<string, { name: string; applied: number; weighted: number; onTime: number; unapplied: number; payments: number }>();
  const getC = (name: string) =>
    custMap.get(name) || (custMap.set(name, { name, applied: 0, weighted: 0, onTime: 0, unapplied: 0, payments: 0 }), custMap.get(name)!);
  for (const p of curParts) {
    const e = getC(p.customer);
    e.applied += p.amount;
    e.weighted += Math.max(0, p.late) * p.amount;
    if (p.late <= 0) e.onTime += p.amount;
  }
  unappliedByCustomer.forEach((v, name) => (getC(name).unapplied += v));
  paymentsByCustomer.forEach((v, name) => (getC(name).payments += v));
  const customers = [...custMap.values()]
    .map((e) => ({
      name: e.name,
      collected: e.applied + e.unapplied,
      applied: e.applied,
      unapplied: e.unapplied,
      payments: e.payments,
      avgDaysLate: e.applied ? e.weighted / e.applied : null,
      onTimePct: e.applied ? (e.onTime / e.applied) * 100 : null,
    }))
    .filter((c) => c.collected > 0.01)
    .sort((a, b) => b.collected - a.collected);

  return { cur, prev, monthly, customers };
}

// ─────────────────────────────────────────────────────────────
//  ONE CUSTOMER (popup): open debit by invoice month + collected per month
// ─────────────────────────────────────────────────────────────
/** 'YYYY-MM' of a date (ISO or DD/MM/YYYY), '' when unreadable. */
function monthKeyOf(v: string): string {
  const t = String(v || '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}`;
  return '';
}

export function CustomerMonthly(data: SalespersonData, customerName: string) {
  const rows = data.ledger.filter((r) => r.customerName === customerName);

  // open items: unmatched rows, and the residual of each matching group on its main invoice (same as the aging)
  const groupNet = new Map<string, number>();
  const mainRow = new Map<string, LedgerRow>();
  for (const r of rows) {
    if (!r.matching) continue;
    groupNet.set(r.matching, (groupNet.get(r.matching) || 0) + r.debit - r.credit);
    const cur = mainRow.get(r.matching);
    if (!cur || r.debit > cur.debit) mainRow.set(r.matching, r);
  }
  const openByMonth = new Map<string, number>();
  for (const r of rows) {
    const amount = !r.matching ? r.debit - r.credit : mainRow.get(r.matching) === r ? groupNet.get(r.matching) || 0 : 0;
    const k = monthKeyOf(r.date);
    if (Math.abs(amount) <= 0.01 || !k) continue;
    openByMonth.set(k, (openByMonth.get(k) || 0) + amount);
  }
  const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`;
  const open = [...openByMonth]
    .filter(([, v]) => Math.abs(v) > 0.01)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) // oldest → newest
    .map(([k, v]) => ({ key: k, month: monthLabel(k), amount: Math.round(v * 100) / 100 }));

  // collected per month in the period (payment date when there is one)
  const collected = periodMonths(data.period).map((m) => ({ key: m.key, month: m.label, amount: 0 }));
  for (const raw of rows) {
    const r = raw.paymentDate ? { ...raw, date: raw.paymentDate } : raw;
    if (!isPaymentRow(r) || !inRange(r.date, data.period.start, data.period.end)) continue;
    const e = collected.find((c) => c.key === r.date.slice(0, 7));
    if (e) e.amount += paymentAmount(r);
  }

  const balance = rows.reduce((s, r) => s + r.debit - r.credit, 0);
  return {
    balance,
    open,
    collected: collected.map(({ month, amount }) => ({ month, amount: Math.round(amount * 100) / 100 })),
    lastPayment: data.lastPaymentByCustomer[customerName] || '',
    city: rows.find((r) => r.city)?.city || '',
  };
}
