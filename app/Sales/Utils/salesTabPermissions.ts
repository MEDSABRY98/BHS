import { hasSalesDataAccess } from '@/lib/supabase';

export const ALL_SALES_TAB_IDS = [
  'sales-overview',
  'sales-top10',
  'sales-customers',
  'sales-customers-comparison',
  'sales-inactive-customers',
  'sales-statistics',
  'sales-reports',
  'sales-targets',
  'sales-daily-sales',
  'sales-categories',
  'sales-products',
  'sales-new-listings',
  'sales-download-form',
  'sales-my-customers',
] as const;

export type SalesTabId = (typeof ALL_SALES_TAB_IDS)[number];

type SalesUserLike = {
  role?: string;
  name?: string;
  userAdmin?: string;
  salesDataAccess?: unknown;
  isSalesManager?: unknown;
} | null | undefined;

/** Admin / super-user — unrestricted tab visibility within Sales. */
export function isUnrestrictedSalesUser(user: SalesUserLike): boolean {
  if (!user) return false;
  if (String(user.userAdmin || '').trim().toLowerCase() === 'admin') return true;
  if (String(user.name || '').trim().toLowerCase() === 'med sabry') return true;
  if (String(user.role || '').trim() === 'Admin') return true;
  return false;
}

/** Tab ids the user may open in Sales (sidebar + content guard). */
export function getAllowedSalesTabIds(user: SalesUserLike): SalesTabId[] {
  const dataAccess = hasSalesDataAccess(user);

  let tabs: SalesTabId[] = [...ALL_SALES_TAB_IDS];
  if (!dataAccess) {
    tabs = tabs.filter(
      (id) => id !== 'sales-my-customers' && id !== 'sales-targets',
    );
  }

  if (isUnrestrictedSalesUser(user)) {
    return tabs;
  }

  try {
    const roleStr = user?.role || '';
    if (!roleStr) return tabs;
    const perms = JSON.parse(roleStr);
    if (perms.sales && Array.isArray(perms.sales)) {
      return tabs.filter((id) => perms.sales.includes(id));
    }
  } catch {
    // fall through
  }

  return tabs;
}

export function isSalesTabAllowed(user: SalesUserLike, tabId: string): boolean {
  return getAllowedSalesTabIds(user).includes(tabId as SalesTabId);
}
