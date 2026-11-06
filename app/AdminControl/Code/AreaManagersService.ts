'use server';

// Admin Control → Area Managers: which salespersons each area manager supervises (table web_AREA_MANAGERS).
// Only the admin can read or change it. A salesperson has ONE area manager. The rights apply within a minute.

import { requireAdmin } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { AREA_MANAGERS_TABLE, clearAreaManagersCache } from '@/lib/AreaManagers';

export type AreaUser = { id: string; name: string };
export type AreaLink = { managerId: string; salespersonId: string };

const notInstalled = (msg: string) => /does not exist|relation|schema cache|Could not find the table/i.test(msg);

export async function listAreaManagers(): Promise<{ links: AreaLink[]; users: AreaUser[] }> {
  await requireAdmin();
  const db = getSupabaseAdmin();
  const [links, users] = await Promise.all([
    db.from(AREA_MANAGERS_TABLE).select('MANAGER_ID, SALESPERSON_ID').limit(10000),
    db.from('bhs_USERS').select('ID, NAME').order('NAME'),
  ]);
  if (links.error) {
    if (notInstalled(links.error.message)) throw new Error(`The Area Managers table is not created yet (${AREA_MANAGERS_TABLE}). Run its SQL in Supabase once.`);
    throw new Error(links.error.message);
  }
  if (users.error) throw new Error(users.error.message);
  return {
    links: (links.data || []).map((r: any) => ({ managerId: String(r.MANAGER_ID), salespersonId: String(r.SALESPERSON_ID) })),
    users: (users.data || []).filter((u: any) => u.ID && u.NAME).map((u: any) => ({ id: String(u.ID), name: String(u.NAME).trim() })),
  };
}

/** Sets the salespersons of ONE area manager (replaces his list; a salesperson moves from his old manager). */
export async function saveAreaManager(input: { managerId: string; salespersonIds: string[] }): Promise<{ success: true }> {
  const admin = await requireAdmin();
  const managerId = String(input?.managerId || '').trim();
  if (!managerId) throw new Error('Pick the area manager');
  const reps = Array.from(new Set((Array.isArray(input?.salespersonIds) ? input.salespersonIds : []).map((x) => String(x).trim()).filter(Boolean))).filter((x) => x !== managerId);

  const db = getSupabaseAdmin();
  const { data: users, error: uErr } = await db.from('bhs_USERS').select('ID');
  if (uErr) throw new Error(uErr.message);
  const known = new Set((users || []).map((u: any) => String(u.ID)));
  if (!known.has(managerId)) throw new Error('This user no longer exists');
  const valid = reps.filter((r) => known.has(r));

  // a salesperson has one manager: take them from any other manager first
  if (valid.length) {
    const { error: mvErr } = await db.from(AREA_MANAGERS_TABLE).delete().in('SALESPERSON_ID', valid).neq('MANAGER_ID', managerId);
    if (mvErr) throw new Error(mvErr.message);
  }
  const { error: delErr } = await db.from(AREA_MANAGERS_TABLE).delete().eq('MANAGER_ID', managerId);
  if (delErr) throw new Error(delErr.message);
  if (valid.length) {
    const { error } = await db
      .from(AREA_MANAGERS_TABLE)
      .insert(valid.map((r) => ({ MANAGER_ID: managerId, SALESPERSON_ID: r, CREATED_BY: String(admin.id) })));
    if (error) throw new Error(error.message);
  }
  clearAreaManagersCache();
  return { success: true };
}
