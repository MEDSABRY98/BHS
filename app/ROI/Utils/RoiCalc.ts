// ROI calculations — same logic as the "Sales Support ROI" Excel analysis,
// plus gross profit / ROI when product costs are available.

import type { Assessment, MonthRow, RoiData, RoiLine, RoiResult, SupportRecord } from './Types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Default month of the add form: the last full month. */
export function DefaultMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Sales are always analysed over the last 3 FULL months (the current month is left out), whatever the support month is. */
export function SalesWindow(now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return out;
}

export const MonthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[(m || 1) - 1]} ${y}`;
};

export const FullMonthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[(m || 1) - 1]} ${y}`;
};

export function PeriodLabel(s: { startMonth: string; endMonth: string }) {
  return s.startMonth === s.endMonth ? MonthLabel(s.startMonth) : `${MonthLabel(s.startMonth)} - ${MonthLabel(s.endMonth)}`;
}

const safeDiv = (a: number, b: number) => (b ? a / b : 0);

type Bucket = {
  gross: number;
  returns: number;
  profit: number;
  costed: boolean;
  posInvoices: Map<string, Set<string>>;
  negInvoices: Set<string>;
};

const newBucket = (): Bucket => ({
  gross: 0,
  returns: 0,
  profit: 0,
  costed: false,
  posInvoices: new Map(),
  negInvoices: new Set(),
});

function addLine(b: Bucket, l: RoiLine) {
  const qty = Math.abs(l.qty);
  if (l.amount > 0) {
    b.gross += l.amount;
    const key = l.invoice || `${l.date}-${b.posInvoices.size}`;
    if (!b.posInvoices.has(key)) b.posInvoices.set(key, new Set());
    if (l.productId) b.posInvoices.get(key)!.add(l.productId);
    if (l.cost > 0) {
      b.profit += l.amount - l.cost * qty;
      b.costed = true;
    }
  } else if (l.amount < 0) {
    b.returns += -l.amount;
    b.negInvoices.add(l.invoice || l.date);
    if (l.cost > 0) {
      b.profit += l.amount + l.cost * qty;
      b.costed = true;
    }
  }
}

function avgItems(b: Bucket): number {
  if (!b.posInvoices.size) return 0;
  let total = 0;
  b.posInvoices.forEach((s) => (total += s.size));
  return total / b.posInvoices.size;
}

export function Assess(r: {
  net: number;
  returnRate: number | null;
  supportPctOfNet: number | null;
  roiPct: number | null;
}): Assessment {
  if (r.net <= 0) {
    return { label: 'No positive sales', note: 'Review before approval: no net sales recorded in the period.', tone: 'red' };
  }
  const rr = r.returnRate ?? 0;
  if (rr >= 25) {
    return { label: 'Urgent returns review', note: 'Review the returns urgently before approving the support.', tone: 'red' };
  }
  if (rr >= 10) {
    return { label: 'Conditional - returns', note: 'Support conditional on reviewing the returns.', tone: 'amber' };
  }
  if ((r.supportPctOfNet ?? 0) > 10) {
    return { label: 'Review support value', note: 'Support is high compared with sales - review its value.', tone: 'amber' };
  }
  return { label: 'Within limits', note: 'Returns and support level are within the limits.', tone: 'green' };
}

type PerMonth = Map<string, { support: number; entries: SupportRecord[] }>;

function computeResult(
  subject: { id: string; customerId: string; customerName: string; mainName: string; city: string; salespersonId: string; salespersonName: string; notes: string },
  perMonth: PerMonth,
  customerLines: RoiLine[],
  showCosts: boolean,
  windowKeys: string[],
  lastSale?: string,
): RoiResult {
  const monthKeys = Array.from(perMonth.keys()).sort(); // support months
  const byMonth = new Map<string, Bucket>(windowKeys.map((m) => [m, newBucket()]));
  const total = newBucket();
  let lastTransaction = '';
  for (const l of customerLines) {
    const b = byMonth.get(l.date.slice(0, 7));
    if (!b) continue;
    addLine(b, l);
    addLine(total, l);
    if (l.amount > 0 && l.date > lastTransaction) lastTransaction = l.date;
  }

  const hasCost = showCosts && total.costed;
  const supportMonths: MonthRow[] = monthKeys.map((m) => {
    const p = perMonth.get(m)!;
    return {
      month: m,
      entries: p.entries,
      support: p.support,
      gross: 0,
      returns: 0,
      net: 0,
      invoices: 0,
      returnDocs: 0,
      avgInvoice: 0,
      avgItems: 0,
      returnRate: null,
      profit: null,
    };
  });
  const supportTotal = supportMonths.reduce((a, m) => a + m.support, 0);
  const supportPerMonth = supportTotal / Math.max(monthKeys.length, 1);
  const salesMonths: MonthRow[] = windowKeys.map((m) => {
    const b = byMonth.get(m)!;
    const net = b.gross - b.returns;
    return {
      month: m,
      entries: [],
      support: supportPerMonth,
      gross: b.gross,
      returns: b.returns,
      net,
      invoices: b.posInvoices.size,
      returnDocs: b.negInvoices.size,
      avgInvoice: safeDiv(b.gross, b.posInvoices.size),
      avgItems: avgItems(b),
      returnRate: b.gross > 0 ? (b.returns / b.gross) * 100 : null,
      profit: hasCost ? b.profit : null,
    };
  });

  const months = supportMonths;
  const n = windowKeys.length; // averages are over the 3 sales months
  const totalSupport = supportTotal;
  const monthlySupport = supportPerMonth;
  const gross = total.gross;
  const returns = total.returns;
  const net = gross - returns;
  const avgNet = net / n;
  const profit = hasCost ? total.profit : null;
  const roiPct = profit !== null && totalSupport > 0 ? ((profit - totalSupport) / totalSupport) * 100 : null;
  const returnRate = gross > 0 ? (returns / gross) * 100 : null;
  const supportPctOfNet = avgNet > 0 ? (monthlySupport / avgNet) * 100 : null;

  const assessment = Assess({ net, returnRate, supportPctOfNet, roiPct });
  if (net <= 0) {
    const fmt = (iso: string) => iso.split('-').reverse().join('/');
    assessment.note = lastSale
      ? `No net sales in the last 3 full months. This customer's last purchase was on ${fmt(lastSale)}.`
      : 'No sales found at all for this customer id - please check the customer.';
  }

  return {
    support: {
      ...subject,
      monthlySupport,
      startMonth: monthKeys[0] || '',
      endMonth: monthKeys[monthKeys.length - 1] || '',
    },
    months,
    salesMonths,
    monthsCount: monthKeys.length,
    totalSupport,
    gross,
    returns,
    net,
    avgGross: gross / n,
    avgReturns: returns / n,
    avgNet,
    returnRate,
    invoices: total.posInvoices.size,
    avgInvoicesPerMonth: total.posInvoices.size / n,
    avgInvoice: safeDiv(gross, total.posInvoices.size),
    avgItems: avgItems(total),
    supportPctOfNet,
    netPerSupport: monthlySupport > 0 ? avgNet / monthlySupport : null,
    profit,
    marginPct: profit !== null && net > 0 ? (profit / net) * 100 : null,
    netProfit: profit !== null ? profit - totalSupport : null,
    roiPct,
    lastTransaction,
    assessment,
  };
}

/** sales lines grouped by customer (so each result only scans its own customer) */
function indexSales(data: RoiData): Map<string, RoiLine[]> {
  const map = new Map<string, RoiLine[]>();
  for (const l of data.sales) {
    const list = map.get(l.customerId);
    if (list) list.push(l);
    else map.set(l.customerId, [l]);
  }
  return map;
}

/** Groups the entries by `keyOf` and computes one result per group (its months = the months of its entries). */
function buildResults(data: RoiData, keyOf: (e: SupportRecord) => string): RoiResult[] {
  const index = indexSales(data);
  const groups = new Map<string, SupportRecord[]>();
  for (const e of data.supports) {
    const k = keyOf(e);
    const list = groups.get(k);
    if (list) list.push(e);
    else groups.set(k, [e]);
  }
  return Array.from(groups.entries()).map(([key, list]) => {
    const entries = [...list].sort((a, b) => a.month.localeCompare(b.month) || a.id.localeCompare(b.id));
    const latest = entries[entries.length - 1];
    const perMonth: PerMonth = new Map();
    for (const e of entries) {
      const cur = perMonth.get(e.month) || { support: 0, entries: [] };
      cur.support += e.amount;
      cur.entries.push(e);
      perMonth.set(e.month, cur);
    }
    return computeResult(
      {
        id: key,
        customerId: latest.customerId,
        customerName: latest.customerName,
        mainName: latest.mainName,
        city: latest.city,
        salespersonId: latest.salespersonId,
        salespersonName: latest.salespersonName,
        notes: Array.from(new Set(entries.map((e) => e.notes.trim()).filter(Boolean))).join('\n'),
      },
      perMonth,
      index.get(latest.customerId) || [],
      data.showCosts,
      data.window?.length ? data.window : SalesWindow(),
      data.lastSale?.[latest.customerId],
    );
  });
}

const byName = (a: RoiResult, b: RoiResult) => a.support.customerName.localeCompare(b.support.customerName);
export const bySalespersonThenCustomer = (a: RoiResult, b: RoiResult) =>
  a.support.salespersonName.localeCompare(b.support.salespersonName) || byName(a, b);

/** one result per customer over all his months (customers A-Z) */
export function ComputeAll(data: RoiData): RoiResult[] {
  return buildResults(data, (e) => e.customerId).sort(byName);
}

export type MonthGroup = { month: string; results: RoiResult[] };

/** one single-month result per customer (and salesperson) for every month that has a support. Newest month first. */
export function ComputeMonthly(data: RoiData): MonthGroup[] {
  const groups = new Map<string, RoiResult[]>();
  for (const r of buildResults(data, (e) => `${e.customerId}|${e.salespersonId}|${e.month}`)) {
    const list = groups.get(r.support.startMonth);
    if (list) list.push(r);
    else groups.set(r.support.startMonth, [r]);
  }
  return Array.from(groups.entries())
    .map(([month, results]) => ({ month, results: results.sort(bySalespersonThenCustomer) }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export type SalespersonGroup = { id: string; name: string; results: RoiResult[] };

/** salespersons A-Z, each with his customers (over all months) A-Z */
export function GroupBySalesperson(data: RoiData): SalespersonGroup[] {
  const map = new Map<string, SalespersonGroup>();
  for (const r of buildResults(data, (e) => `${e.customerId}|${e.salespersonId}`)) {
    const key = r.support.salespersonId || '-';
    const g = map.get(key) || { id: key, name: r.support.salespersonName || 'Unassigned', results: [] };
    g.results.push(r);
    map.set(key, g);
  }
  const out = Array.from(map.values());
  out.forEach((g) => g.results.sort(byName));
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function Summary(results: RoiResult[]) {
  const monthlySupport = results.reduce((a, r) => a + r.support.monthlySupport, 0);
  const totalSupport = results.reduce((a, r) => a + r.totalSupport, 0);
  const net = results.reduce((a, r) => a + r.net, 0);
  const gross = results.reduce((a, r) => a + r.gross, 0);
  const returns = results.reduce((a, r) => a + r.returns, 0);
  const costed = results.filter((r) => r.profit !== null);
  const profit = costed.length ? costed.reduce((a, r) => a + (r.profit as number), 0) : null;
  const costedSupport = costed.reduce((a, r) => a + r.totalSupport, 0);
  return {
    count: results.length,
    monthlySupport,
    totalSupport,
    gross,
    returns,
    net,
    returnRate: gross > 0 ? (returns / gross) * 100 : null,
    profit,
    roiPct: profit !== null && costedSupport > 0 ? ((profit - costedSupport) / costedSupport) * 100 : null,
  };
}
