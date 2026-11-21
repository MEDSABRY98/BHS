import type { AnalyticType, ReportLine } from './ReportTypes';

export type Cat = 'Revenue' | 'COGS' | 'Expenses';
export const catOf = (code: string): Cat => (code.startsWith('41') ? 'Revenue' : code.startsWith('3102') ? 'COGS' : 'Expenses');
const TOL = 0.035;

export interface TaggedLine extends ReportLine { cat: Cat; region: string; channel: string; pool: boolean }

/** Keeps only location accounts and flags "equal-split pool" expenses:
 *  same GL code + month, same amount (±0.035) on 3+ location accounts = a shared cost spread equally by the system. */
export function tagLocationLines(lines: ReportLine[], types: AnalyticType[]): TaggedLine[] {
  const T = new Map(types.filter((t) => t.kind === 'location').map((t) => [t.name, t]));
  const out: TaggedLine[] = [];
  for (const l of lines) {
    const t = T.get(l.analytic);
    if (t) out.push({ ...l, cat: catOf(l.code), region: t.region || t.name, channel: t.channel || '', pool: false });
  }
  const groups = new Map<string, TaggedLine[]>();
  for (const l of out) if (l.cat === 'Expenses') { const k = `${l.code}|${l.month}`; (groups.get(k) || groups.set(k, []).get(k)!).push(l); }
  for (const g of groups.values()) {
    g.sort((a, b) => a.amount - b.amount);
    let i = 0;
    while (i < g.length) {
      let j = i;
      while (j + 1 < g.length && Math.abs(g[j + 1].amount - g[i].amount) <= TOL) j++;
      if (j - i + 1 >= 3) for (let k = i; k <= j; k++) g[k].pool = true;
      i = j + 1;
    }
  }
  return out;
}

export interface RegionRow {
  region: string; revenue: number; cogs: number; gm: number; gmPct: number | null;
  direct: number; pool: number; expenses: number;
  netBooked: number;          // A: as booked
  contribution: number;       // B: before the equal-split pool
  poolShare: number;          // C: pool re-spread by revenue share
  netRespread: number;        // contribution - poolShare
  breakEven: number | null;   // expenses / GM%
}
export interface RegionResult { rows: RegionRow[]; total: RegionRow; months: string[]; poolTotal: number }

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export function regionAnalysis(lines: ReportLine[], types: AnalyticType[], months: string[]): RegionResult {
  const L = tagLocationLines(lines, types).filter((l) => months.includes(l.month));
  const regions = [...new Set(L.map((l) => l.region))];
  const pick = (r: string, f: (l: TaggedLine) => boolean) => sum(L.filter((l) => l.region === r && f(l)).map((l) => l.amount));
  const raw = regions.map((r) => {
    const revenue = pick(r, (l) => l.cat === 'Revenue');
    const cogs = pick(r, (l) => l.cat === 'COGS');
    const direct = pick(r, (l) => l.cat === 'Expenses' && !l.pool);
    const pool = pick(r, (l) => l.cat === 'Expenses' && l.pool);
    return { r, revenue, cogs, direct, pool };
  });
  const poolTotal = sum(raw.map((x) => x.pool));
  const revTotal = sum(raw.map((x) => x.revenue));
  const mk = (region: string, revenue: number, cogs: number, direct: number, pool: number, poolShare: number): RegionRow => {
    const gm = revenue + cogs;
    const expenses = direct + pool;
    return {
      region, revenue, cogs, gm, gmPct: revenue > 0 ? gm / revenue : null, direct, pool, expenses,
      netBooked: gm + expenses, contribution: gm + direct, poolShare, netRespread: gm + direct + poolShare,
      breakEven: gm > 0 && revenue > 0 ? Math.abs(expenses) / (gm / revenue) : null,
    };
  };
  const rows = raw
    .map((x) => mk(x.r, x.revenue, x.cogs, x.direct, x.pool, revTotal > 0 ? (poolTotal * x.revenue) / revTotal : poolTotal / raw.length))
    .sort((a, b) => b.revenue - a.revenue);
  const total = mk('Total', revTotal, sum(raw.map((x) => x.cogs)), sum(raw.map((x) => x.direct)), poolTotal, poolTotal);
  return { rows, total, months, poolTotal };
}

/** Month-by-month region view (net as booked) for the trend table. */
export function regionMonthly(lines: ReportLine[], types: AnalyticType[], months: string[]) {
  const L = tagLocationLines(lines, types);
  const regions = [...new Set(L.map((l) => l.region))];
  return regions.map((region) => ({
    region,
    byMonth: months.map((m) => {
      const x = L.filter((l) => l.region === region && l.month === m);
      const s = (c: Cat) => sum(x.filter((l) => l.cat === c).map((l) => l.amount));
      return { month: m, revenue: s('Revenue'), cogs: s('COGS'), expenses: s('Expenses'), net: sum(x.map((l) => l.amount)) };
    }),
  }));
}

/** Detail of a region: expenses per GL, with the pool share. */
export function regionExpenseDetail(lines: ReportLine[], types: AnalyticType[], months: string[], region: string) {
  const L = tagLocationLines(lines, types).filter((l) => l.region === region && l.cat === 'Expenses' && months.includes(l.month));
  const m = new Map<string, { code: string; name: string; direct: number; pool: number }>();
  for (const l of L) {
    const e = m.get(l.code) || m.set(l.code, { code: l.code, name: l.glName, direct: 0, pool: 0 }).get(l.code)!;
    if (l.pool) e.pool += l.amount; else e.direct += l.amount;
  }
  return [...m.values()].sort((a, b) => a.direct + a.pool - (b.direct + b.pool));
}

export interface HqRow { analytic: string; byMonth: number[]; total: number; revenue: number; costs: number; gl: { code: string; name: string; total: number }[] }
/** Non-location accounts (HQ / central / projects): net per month plus GL breakdown. */
export function hqAnalysis(lines: ReportLine[], types: AnalyticType[], months: string[]) {
  const loc = new Set(types.filter((t) => t.kind === 'location').map((t) => t.name));
  const names = [...new Set(lines.filter((l) => !loc.has(l.analytic)).map((l) => l.analytic))];
  const rows: HqRow[] = names.map((a) => {
    const x = lines.filter((l) => l.analytic === a && months.includes(l.month));
    const gl = new Map<string, { code: string; name: string; total: number }>();
    for (const l of x) (gl.get(l.code) || gl.set(l.code, { code: l.code, name: l.glName, total: 0 }).get(l.code)!).total += l.amount;
    return {
      analytic: a,
      byMonth: months.map((m) => sum(x.filter((l) => l.month === m).map((l) => l.amount))),
      total: sum(x.map((l) => l.amount)),
      revenue: sum(x.filter((l) => catOf(l.code) === 'Revenue').map((l) => l.amount)),
      costs: sum(x.filter((l) => catOf(l.code) !== 'Revenue').map((l) => l.amount)),
      gl: [...gl.values()].sort((p, q) => p.total - q.total),
    };
  }).sort((a, b) => a.total - b.total);
  return { rows, total: sum(rows.map((r) => r.total)), months };
}

/** Months considered closed by default: expenses booked ≥ 50% of the best month's expenses (location accounts). */
export function suggestClosedMonths(lines: ReportLine[], types: AnalyticType[], months: string[]): string[] {
  const L = tagLocationLines(lines, types).filter((l) => l.cat === 'Expenses');
  const per = months.map((m) => Math.abs(sum(L.filter((l) => l.month === m).map((l) => l.amount))));
  const mx = Math.max(...per, 0);
  return months.filter((_, i) => mx > 0 && per[i] >= mx * 0.5);
}
