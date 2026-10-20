'use server';

// Admin Control → Module Admins: who is admin of which module (table app_MODULE_ADMINS).
// Only the admin can read or change it. The rights apply on the user's next request.

import { requireAdmin, isAdminUser, toSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const TABLE = 'app_MODULE_ADMINS';
const MODULE_RE = /^[a-z0-9-]{2,60}$/;

export type ModuleAdminRow = { moduleId: string; userId: string; canEdit: boolean; canDelete: boolean };
export type ModuleAdminUser = { id: string; name: string; isAdmin: boolean };

export async function listModuleAdmins(): Promise<{ rows: ModuleAdminRow[]; users: ModuleAdminUser[] }> {
  await requireAdmin();
  const db = getSupabaseAdmin();
  const [admins, users] = await Promise.all([
    db.from(TABLE).select('MODULE_ID, USER_ID, CAN_EDIT, CAN_DELETE').order('MODULE_ID').limit(5000),
    db.from('bhs_USERS').select('ID, NAME, ROLE, AUTHORITY').order('NAME'),
  ]);
  if (admins.error) {
    if (/does not exist|relation/i.test(admins.error.message)) {
      throw new Error('The Module Admins table is not installed yet. Run bhs_module_admins.sql in Supabase (SQL Editor) once.');
    }
    throw new Error(admins.error.message);
  }
  if (users.error) throw new Error(users.error.message);
  return {
    rows: (admins.data || []).map((r: any) => ({
      moduleId: String(r.MODULE_ID),
      userId: String(r.USER_ID),
      canEdit: !!r.CAN_EDIT,
      canDelete: !!r.CAN_DELETE,
    })),
    users: (users.data || [])
      .filter((u: any) => u.ID && u.NAME)
      .map((u: any) => ({ id: String(u.ID), name: String(u.NAME).trim(), isAdmin: isAdminUser(toSessionUser(u)) })),
  };
}

/** Add a module admin, or change his edit / delete rights. */
export async function saveModuleAdmin(input: { moduleId: string; userId: string; canEdit: boolean; canDelete: boolean }): Promise<ModuleAdminRow> {
  const admin = await requireAdmin();
  const moduleId = String(input?.moduleId || '').trim();
  const userId = String(input?.userId || '').trim();
  if (!MODULE_RE.test(moduleId)) throw new Error('Invalid module');
  if (!userId) throw new Error('Pick a user');

  const db = getSupabaseAdmin();
  const { data: user, error: userErr } = await db.from('bhs_USERS').select('ID').eq('ID', userId).maybeSingle();
  if (userErr) throw new Error(userErr.message);
  if (!user) throw new Error('This user no longer exists');

  const { error } = await db.from(TABLE).upsert(
    {
      MODULE_ID: moduleId,
      USER_ID: userId,
      CAN_EDIT: !!input.canEdit,
      CAN_DELETE: !!input.canDelete,
      UPDATED_BY: String(admin.name || '').trim() || 'Admin',
      UPDATED_AT: new Date().toISOString(),
    },
    { onConflict: 'MODULE_ID,USER_ID' },
  );
  if (error) throw new Error(error.message);
  return { moduleId, userId, canEdit: !!input.canEdit, canDelete: !!input.canDelete };
}

export async function removeModuleAdmin(input: { moduleId: string; userId: string }): Promise<{ success: true }> {
  await requireAdmin();
  const moduleId = String(input?.moduleId || '').trim();
  const userId = String(input?.userId || '').trim();
  if (!MODULE_RE.test(moduleId) || !userId) throw new Error('Invalid module admin');
  const { error } = await getSupabaseAdmin().from(TABLE).delete().eq('MODULE_ID', moduleId).eq('USER_ID', userId);
  if (error) throw new Error(error.message);
  return { success: true };
}
