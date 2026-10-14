/**
 * Admin = the ROLE column in bhs_USERS is "Admin" (userAdmin on the session user).
 * No names or IDs — renaming a user never changes his access.
 */
export function isAdminRole(user: any): boolean {
  if (!user) return false;
  return String(user.userAdmin || user.ROLE || '').trim().toLowerCase() === 'admin';
}
