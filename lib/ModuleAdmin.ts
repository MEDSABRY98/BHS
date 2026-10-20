// ─────────────────────────────────────────────────────────────
//  Module admins (Admin Control → Module Admins).
//  The admin can make any user an admin of ONE module: inside that module he is
//  treated exactly like the admin (sees everyone's data, all tabs ...), and the
//  admin decides if he may also EDIT and / or DELETE there.
//  Shared by the server (session user) and the browser (restored user).
// ─────────────────────────────────────────────────────────────

export type ModuleAdminRights = { edit: boolean; delete: boolean };
export type ModuleAdminMap = Record<string, ModuleAdminRights>; // module id -> rights

export type ModuleAdminAction = 'edit' | 'delete';

/** The user's rights as admin of this module, or null. */
export function moduleAdminOf(user: any, moduleId: string | undefined | null): ModuleAdminRights | null {
  if (!user || !moduleId) return null;
  const map = user.moduleAdmins as ModuleAdminMap | undefined;
  return (map && map[moduleId]) || null;
}

/** Module admin of this module (and allowed to do this action, when given). */
export function isModuleAdmin(user: any, moduleId: string | undefined | null, action?: ModuleAdminAction): boolean {
  const rights = moduleAdminOf(user, moduleId);
  if (!rights) return false;
  if (action === 'edit') return !!rights.edit;
  if (action === 'delete') return !!rights.delete;
  return true;
}

/** Module ids the user is admin of. */
export function moduleAdminIds(user: any): string[] {
  const map = user?.moduleAdmins as ModuleAdminMap | undefined;
  return map ? Object.keys(map) : [];
}
