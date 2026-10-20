import { isModuleAdmin, type ModuleAdminAction } from './ModuleAdmin';

/**
 * Admin = the ROLE column in bhs_USERS is "Admin" (userAdmin on the session user).
 * No names or IDs — renaming a user never changes his access.
 * With a module id: also true for an admin of that module (Admin Control → Module Admins),
 * and with an action ('edit' / 'delete') only when he was given that right.
 */
export function isAdminRole(user: any, moduleId?: string, action?: ModuleAdminAction): boolean {
  if (!user) return false;
  if (String(user.userAdmin || user.ROLE || '').trim().toLowerCase() === 'admin') return true;
  return isModuleAdmin(user, moduleId, action);
}
