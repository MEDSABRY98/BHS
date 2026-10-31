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
  /** optional project: the same account can be listed twice, with and without a project (like Odoo) */
  PROJECT?: string;
}

export interface AnalyticProject {
  ID: string; // uuid
  NAME: string;
  IS_ACTIVE: boolean;
}

export interface AnalyticAccount {
  ID: string; // uuid
  NAME: string;
  IS_ACTIVE: boolean;
}

export interface AnalyticPerson {
  ID: string; // uuid
  NAME: string;
  NOTES: string;
  ACCOUNTS: SplitItem[]; // default split
  IS_ACTIVE: boolean;
}

/**
 * A person inside an allocation. AMOUNT = his own amount (typed per person; the allocation total is their sum).
 * Old allocations have no AMOUNT: they split one total by PCT (null = equal share).
 */
export interface AllocationPerson {
  PERSON_ID?: string | null; // web_ANALYTIC_PEOPLE.ID (the link to the person; NAME is the name at save time, kept in step on rename)
  NAME: string;
  PCT: number | null;
  AMOUNT?: number | null;
  SPLIT: SplitItem[];
}

export interface AllocationLine {
  PERSON: string;
  ACCOUNT: string;
  PCT: number;    // share of the person's amount
  AMOUNT: number;
  PROJECT?: string;
}

export interface Allocation {
  ID: string; // uuid
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
  ID?: string; // set = edit
  TITLE: string;
  ALLOC_DATE: string;
  AMOUNT?: number; // old style only; with per-person amounts the total is their sum
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

/** one line of a split = an account, with or without a project */
export const splitKey = (s: { ACCOUNT: string; PROJECT?: string }) => `${s.ACCOUNT}\u0001${s.PROJECT || ''}`;
/** "Account" or "Account · Project" */
export const lineLabel = (account: string, project?: string) => (project ? `${account} · ${project}` : account);
/** account name, then the line without a project first, then the projects by name */
export const byAccountProject = (a: { ACCOUNT: string; PROJECT?: string }, b: { ACCOUNT: string; PROJECT?: string }) =>
  byName(a.ACCOUNT, b.ACCOUNT) || byName(a.PROJECT || '', b.PROJECT || '');
/** a split item (the key order stays the same so saved JSON compares equal) */
export const mkSplitItem = (ACCOUNT: string, PCT: number | null, PROJECT?: string): SplitItem => (PROJECT ? { ACCOUNT, PCT, PROJECT } : { ACCOUNT, PCT });

/** short reference of a uuid for the screen (first 8 characters) */
export const shortId = (id: string | null | undefined) => String(id || '').slice(0, 8).toUpperCase();

/** uuid or null */
export const toUuid = (v: unknown): string | null => {
  const s = String(v ?? '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ? s : null;
};

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
/** a beneficiary inside an analytic account: his amount and his % of that account (the people of an account = 100%) */
export type AccountPerson = { NAME: string; AMOUNT: number; PCT: number };
export type AccountResult = { ACCOUNT: string; PROJECT: string; AMOUNT: number; PCT: number; PEOPLE: AccountPerson[] };

/** Full calculation of an allocation: people amounts, person × account lines and the summary by account. */
/** true when the people carry their own amounts (new style) */
export const hasPersonAmounts = (people: AllocationPerson[]) => people.some((p) => p.AMOUNT !== undefined);

export function computeAllocation(amount: number, people: AllocationPerson[]) {
  const perPerson = hasPersonAmounts(people);
  let pcts: number[];
  let peopleTotal: number;
  let amounts: number[];
  if (perPerson) {
    amounts = people.map((p) => round2(Number(p.AMOUNT) || 0));
    pcts = sharesOf(amounts);
    peopleTotal = amounts.some((a) => a > 0) ? 100 : 0;
  } else {
    ({ pcts, total: peopleTotal } = resolvePcts(people));
    amounts = splitAmount(amount, pcts);
  }
  const persons: PersonResult[] = [];
  const lines: AllocationLine[] = [];
  people.forEach((p, i) => {
    const split = resolvePcts(p.SPLIT);
    const parts = splitAmount(amounts[i], split.pcts);
    persons.push({ NAME: p.NAME, PCT: pcts[i], AMOUNT: amounts[i], splitTotal: split.total });
    p.SPLIT.forEach((s, k) => lines.push({ PERSON: p.NAME, ACCOUNT: s.ACCOUNT, ...(s.PROJECT ? { PROJECT: s.PROJECT } : {}), PCT: split.pcts[k], AMOUNT: parts[k] }));
  });
  // one row per account + project (the same account with and without a project are two rows, like Odoo)
  const map = new Map<string, number>();
  const heads = new Map<string, { ACCOUNT: string; PROJECT: string }>();
  lines.forEach((l) => {
    const k = splitKey(l);
    map.set(k, round2((map.get(k) || 0) + l.AMOUNT));
    heads.set(k, { ACCOUNT: l.ACCOUNT, PROJECT: l.PROJECT || '' });
  });
  const names = Array.from(map.keys()).sort((a, b) => byAccountProject(heads.get(a)!, heads.get(b)!));
  const shares = sharesOf(names.map((n) => map.get(n) || 0));
  const accounts: AccountResult[] = names.map((n, i) => {
    // the people under the account: their amounts and their % OF THE ACCOUNT (each account = 100% on its own)
    const own = lines.filter((l) => splitKey(l) === n && l.AMOUNT !== 0);
    const byPerson = new Map<string, number>();
    own.forEach((l) => byPerson.set(l.PERSON, round2((byPerson.get(l.PERSON) || 0) + l.AMOUNT)));
    const people = Array.from(byPerson.keys()).sort(byName);
    const pcts = sharesOf(people.map((p) => byPerson.get(p) || 0)); // adds up to exactly 100
    return {
      ACCOUNT: heads.get(n)!.ACCOUNT,
      PROJECT: heads.get(n)!.PROJECT,
      AMOUNT: map.get(n) || 0,
      PCT: shares[i],
      PEOPLE: people.map((p, k) => ({ NAME: p, AMOUNT: byPerson.get(p) || 0, PCT: pcts[k] })),
    };
  });
  const allocated = round2(lines.reduce((s, l) => s + l.AMOUNT, 0));
  const problems: string[] = [];
  if (!perPerson && people.length && !isFull(peopleTotal)) problems.push(`People shares add up to ${formatPct(peopleTotal)}, not 100%`);
  persons.forEach((p) => {
    if (perPerson && !(p.AMOUNT > 0)) {
      problems.push(`${p.NAME}: enter the amount`);
      return;
    }
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
    const PROJECT = String(s?.PROJECT ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const key = splitKey({ ACCOUNT, PROJECT }).toLowerCase();
    if (!ACCOUNT || seen.has(key)) return;
    seen.add(key);
    const n = s?.PCT === null || s?.PCT === undefined || s?.PCT === '' ? null : Number(s.PCT);
    out.push(mkSplitItem(ACCOUNT, n === null || !Number.isFinite(n) ? null : Math.min(100, Math.max(0, round2(n))), PROJECT));
  });
  return out.sort(byAccountProject);
}
