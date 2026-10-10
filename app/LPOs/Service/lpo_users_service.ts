'use server';

// LPO staff lookups — run on the server so passwords and signatures never reach the browser.

import { requireSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const HIDDEN = /PASS|SIGNATURE|SECRET|TOKEN/i;

function strip(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  Object.keys(row || {}).forEach((k) => {
    if (!HIDDEN.test(k)) out[k] = row[k];
  });
  return out;
}

/** All users (without password / signature), sorted by name. */
export async function listLpoUsers(): Promise<any[]> {
  await requireSession();
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await getSupabaseAdmin()
      .from('bhs_USERS')
      .select('*')
      .order('NAME', { ascending: true })
      .order('ID', { ascending: true })
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []).map(strip));
    if (!data || data.length < size) break;
  }
  return out;
}

/** One user by name (case/space-insensitive), without password / signature. */
export async function findLpoUserByName(name: string): Promise<any | null> {
  const clean = String(name || '').trim().toLowerCase();
  if (!clean) return null;
  const users = await listLpoUsers();
  return users.find((u) => String(u.NAME || '').trim().toLowerCase() === clean) || null;
}
