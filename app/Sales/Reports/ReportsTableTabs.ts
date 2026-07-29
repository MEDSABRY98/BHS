export const SALES_REPORTS_TABLE_TAB_DEFS = [
  { id: 'sales-invoices', label: 'Sales Invoices' },
  { id: 'return-invoices', label: 'Return Invoices' },
  { id: 'top-customers', label: 'Top Customers' },
  { id: 'top-return-customers', label: 'Return Customers' },
  { id: 'growing', label: 'Growing' },
  { id: 'declining', label: 'Declining' },
  { id: 'at-risk', label: 'At-Risk' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
] as const;

export type SalesReportsTableTabId = (typeof SALES_REPORTS_TABLE_TAB_DEFS)[number]['id'];

const ALL_IDS = SALES_REPORTS_TABLE_TAB_DEFS.map((t) => t.id);

/** Returns null when all report table tabs are allowed (manager / no restriction). */
export function getAllowedReportTableTabIds(
  roleStr: string | undefined,
  hasSalesDataAccess: boolean
): SalesReportsTableTabId[] | null {
  if (hasSalesDataAccess) return null;
  if (!roleStr || roleStr === 'Admin') return null;
  try {
    const perms = JSON.parse(roleStr);
    const key = 'sales-reports-tables';
    if (perms[key] && Array.isArray(perms[key])) {
      return perms[key].filter((id: string) => ALL_IDS.includes(id as SalesReportsTableTabId));
    }
  } catch {
    // fall through
  }
  return null;
}
