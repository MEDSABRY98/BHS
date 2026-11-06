// ════════════════════════════════════════════════════════════════
//  Area managers (server only).
//  An area manager supervises some salespersons (table web_AREA_MANAGERS: MANAGER_ID ← SALESPERSON_ID).
//  He sees the data of those salespersons in Sales, Customers Analysis, Salesperson Analysis and
//  Payment Analysis (the same share of the ledger / sales each of them has).
//  Users with full data access still see everything — this only widens what a normal user sees.
//  No 'use server': these helpers must not be callable from the browser.
// ════════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const AREA_MANAGERS_TABLE = 'web_AREA_MANAGERS';
const TTL_MS = 60_000;

const up = (v: unknown) => String(v ?? '').trim().toUpperCase();

type Link = { manager: string; rep: string };
let cache: { at: number; links: Link[]; names: Map<string, string> } | null = null;

/** every link + user names (upper-case id → upper-case name), cached for a minute */
async function load(): Promise<{ links: Link[]; names: Map<string, string> }> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const db = getSupabaseAdmin();
  const [linkRes, userRes] = await Promise.all([
    db.from(AREA_MANAGERS_TABLE).select('MANAGER_ID, SALESPERSON_ID').limit(10000),
    db.from('bhs_USERS').select('ID, NAME'),
  ]);
  // the table is not created yet → nobody is an area manager (nothing changes for anyone)
  const links: Link[] = linkRes.error ? [] : (linkRes.data || []).map((r: any) => ({ manager: up(r.MANAGER_ID), rep: up(r.SALESPERSON_ID) }));
  const names = new Map<string, string>();
  for (const u of (userRes.data || []) as any[]) {
    const id = up(u.ID);
    if (id) names.set(id, up(u.NAME));
  }
  cache = { at: Date.now(), links, names };
  return cache;
}

export type ManagedReps = {
  /** upper-case ids of the supervised salespersons */
  ids: string[];
  /** their ids AND names (upper-case): a rep is stored by id or by name in some tables */
  keys: string[];
};

/** The salespersons supervised by this user ({ ids: [] } when he is not an area manager). */
export async function getManagedReps(managerId: string): Promise<ManagedReps> {
  const me = up(managerId);
  if (!me) return { ids: [], keys: [] };
  const { links, names } = await load();
  const ids = Array.from(new Set(links.filter((l) => l.manager === me && l.rep && l.rep !== me).map((l) => l.rep)));
  const keys = new Set<string>();
  for (const id of ids) {
    keys.add(id);
    const name = names.get(id);
    if (name) keys.add(name);
  }
  return { ids, keys: Array.from(keys) };
}

/** Call after the links change, so the new rights apply at once. */
export function clearAreaManagersCache() {
  cache = null;
}
