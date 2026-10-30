// The ready reports of the Reports module (plain data, also used by the server permission check).
// New report: 1) a folder next to ProductsCost/ with its component (the options shown in the pop-up + the Excel),
// 2) add it here, 3) add its icon + component in ReportsRegistry.ts,
// 4) add the same id to the 'reports' sub-tabs in Admin Control (AdminControlTab.tsx).

export interface ReportMeta {
  id: string;          // permission id (Admin Control → Reports)
  title: string;
}

export const REPORTS_SYSTEM_ID = 'reports';

export const REPORT_META: ReportMeta[] = [
  { id: 'products-cost', title: 'Products Cost' },
];
