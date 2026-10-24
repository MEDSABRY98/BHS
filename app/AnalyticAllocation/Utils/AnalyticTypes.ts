// Shared (client + server safe) types and helpers for Analytic Allocation.

export const ANALYTIC_SYSTEM_ID = 'analytic-allocation';
export const COMPANY_NAME = 'ALMARAI ALARABIA TRADING';

export type AnalyticTabId = 'accounts' | 'people' | 'allocate' | 'archive';

export interface AnalyticPermissions {
  tabs: AnalyticTabId[];
  admin: boolean; // sees every user's archive, edits and deletes
}

/** One account in a split. PCT null = takes an equal share of what is left. */
export interface SplitItem {
  ACCOUNT: string;
  PCT: number | null;
}

export interface AnalyticAccount {
  ID: number;
  NAME: string;
  IS_ACTIVE: boolean;
}

export interface AnalyticPerson {
  ID: number;
  NAME: string;
  NOTES: string;
  ACCOUNTS: SplitItem[]; // default split
  IS_ACTIVE: boolean;
}

/** A person inside an allocation. PCT null = equal share of the amount. */
export interface AllocationPerson {
  NAME: string;
  PCT: number | null;
  SPLIT: SplitItem[];
}

export interface AllocationLine {
  PERSON: string;
  ACCOUNT: string;
  PCT: number;    // share of the person's amount
  AMOUNT: number;
}

export interface Allocation {
  ID: number;
  TITLE: string;
  ALLOC_DATE: string; // yyyy-mm-dd
  AMOUNT: number;
  NOTES: string;
  PEOPLE: AllocationPerson[];
  LINES: AllocationLine[];
  CREATED_BY: string;
  CREATED_BY_NAME?: string;
  CREATED_AT: string;
  UPDATED_AT?: string | null;
}

export type AllocationInput = {
  ID?: number; // set = edit
  TITLE: string;
  ALLOC_DATE: string;
  AMOUNT: number;
  NOTES?: string;
  PEOPLE: AllocationPerson[];
};

// ── Helpers ─────────────────────────────────────────────────────────────
export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const formatAmount = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatPct = (n: number) => `${(Number(n) || 0).toFixed(2)}%`;

export function formatDate(iso: string | null | undefined): string {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso || '');
}

export function uaeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' });

/**
 * Final percentages (2 decimals). Fixed values stay as typed; the rest of 100 is shared equally
 * by the null ones, and the last null one takes the rounding difference so the total is exactly 100.
 */
export function resolvePcts(items: { PCT: number | null }[]): { pcts: number[]; total: number } {
  if (!items.length) return { pcts: [], total: 0 };
  const fixedSum = items.reduce((s, i) => s + (i.PCT ?? 0), 0);
  const free = items.filter((i) => i.PCT === null).length;
  const share = free ? Math.max(0, 100 - fixedSum) / free : 0;
  const pcts = items.map((i) => round2(i.PCT ?? share));
  let total = round2(pcts.reduce((s, p) => s + p, 0));
  if (free && fixedSum <= 100) {
    const last = items.map((i) => i.PCT).lastIndexOf(null);
    pcts[last] = round2(pcts[last] + (100 - total));
    total = 100;
  }
  return { pcts, total };
}

export const isFull = (total: number) => Math.abs(total - 100) < 0.001;

/** Splits an amount by percentages (2 decimals); the last part takes the rounding difference. */
export function splitAmount(amount: number, pcts: number[]): number[] {
  const total = round2(amount);
  const parts = pcts.map((p) => round2((total * p) / 100));
  if (parts.length && isFull(pcts.reduce((s, p) => s + p, 0))) {
    const diff = round2(total - parts.reduce((s, p) => s + p, 0));
    parts[parts.length - 1] = round2(parts[parts.length - 1] + diff);
  }
  return parts;
}

/** Percentages rounded to 2 decimals that add up to exactly 100 (largest remainder). */
export function sharesOf(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 10000);
  const fl = raw.map(Math.floor);
  let left = 10000 - fl.reduce((s, v) => s + v, 0);
  raw
    .map((v, i) => [v - fl[i], i] as const)
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (left > 0) {
        fl[i]++;
        left--;
      }
    });
  return fl.map((v) => v / 100);
}

export type PersonResult = { NAME: string; PCT: number; AMOUNT: number; splitTotal: number };
export type AccountResult = { ACCOUNT: string; AMOUNT: number; PCT: number };

/** Full calculation of an allocation: people amounts, person × account lines and the summary by account. */
export function computeAllocation(amount: number, people: AllocationPerson[]) {
  const { pcts, total: peopleTotal } = resolvePcts(people);
  const amounts = splitAmount(amount, pcts);
  const persons: PersonResult[] = [];
  const lines: AllocationLine[] = [];
  people.forEach((p, i) => {
    const split = resolvePcts(p.SPLIT);
    const parts = splitAmount(amounts[i], split.pcts);
    persons.push({ NAME: p.NAME, PCT: pcts[i], AMOUNT: amounts[i], splitTotal: split.total });
    p.SPLIT.forEach((s, k) => lines.push({ PERSON: p.NAME, ACCOUNT: s.ACCOUNT, PCT: split.pcts[k], AMOUNT: parts[k] }));
  });
  const map = new Map<string, number>();
  lines.forEach((l) => map.set(l.ACCOUNT, round2((map.get(l.ACCOUNT) || 0) + l.AMOUNT)));
  const names = Array.from(map.keys()).sort(byName);
  const shares = sharesOf(names.map((n) => map.get(n) || 0));
  const accounts: AccountResult[] = names.map((n, i) => ({ ACCOUNT: n, AMOUNT: map.get(n) || 0, PCT: shares[i] }));
  const allocated = round2(lines.reduce((s, l) => s + l.AMOUNT, 0));
  const problems: string[] = [];
  if (people.length && !isFull(peopleTotal)) problems.push(`People shares add up to ${formatPct(peopleTotal)}, not 100%`);
  persons.forEach((p) => {
    if (!people.find((x) => x.NAME === p.NAME)?.SPLIT.length) problems.push(`${p.NAME}: no analytic accounts`);
    else if (!isFull(p.splitTotal)) problems.push(`${p.NAME}: accounts add up to ${formatPct(p.splitTotal)}, not 100%`);
  });
  return { persons, lines, accounts, allocated, peopleTotal, problems };
}

/** Keeps a split clean: known shape, no duplicates, sorted by account name, PCT 0–100 or null. */
export function cleanSplit(raw: unknown): SplitItem[] {
  const seen = new Set<string>();
  const out: SplitItem[] = [];
  (Array.isArray(raw) ? raw : []).forEach((s: any) => {
    const ACCOUNT = String(s?.ACCOUNT ?? '').trim();
    if (!ACCOUNT || seen.has(ACCOUNT.toLowerCase())) return;
    seen.add(ACCOUNT.toLowerCase());
    const n = s?.PCT === null || s?.PCT === undefined || s?.PCT === '' ? null : Number(s.PCT);
    out.push({ ACCOUNT, PCT: n === null || !Number.isFinite(n) ? null : Math.min(100, Math.max(0, round2(n))) });
  });
  return out.sort((a, b) => byName(a.ACCOUNT, b.ACCOUNT));
}
