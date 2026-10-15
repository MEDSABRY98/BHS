'use server';

import { getSessionUser, UnauthorizedError } from '@/lib/session';
import { formsOf } from './FormsPermissions';

/** Form ids the current user can open (for the Forms home page). */
export async function getAllowedForms(): Promise<string[]> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return formsOf(user);
}
