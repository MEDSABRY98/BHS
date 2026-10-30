'use server';

// Which reports the current user can open.
// Admin Control → system 'reports', its sub-tabs are the report ids. Admin always has all of them.

import { getSessionUser, isAdminUser, UnauthorizedError } from '@/lib/session';
import { REPORT_META, REPORTS_SYSTEM_ID } from '../Utils/ReportsList';

export async function getAllowedReports(): Promise<string[]> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  const all = REPORT_META.map((r) => r.id);
  if (isAdminUser(user, REPORTS_SYSTEM_ID)) return all;

  const raw = String(user.role || '').trim();
  if (!raw) return all;
  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return all;
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(REPORTS_SYSTEM_ID)) return [];
  const list = perms[REPORTS_SYSTEM_ID];
  return Array.isArray(list) ? all.filter((id) => list.includes(id)) : all;
}
