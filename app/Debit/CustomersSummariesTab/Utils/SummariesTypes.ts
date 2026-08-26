export type SummariesSalesSource = 'debit' | 'sales';

export interface CustomerSalesYearBreakdown {
  customerName: string;
  city: string;
  salesPrev: number;
  returnsPrev: number;
  salesCurrent: number;
  returnsCurrent: number;
  netSalesPrev: number;
  netSalesCurrent: number;
}

export interface SummariesSalesOverlay {
  byCustomer: CustomerSalesYearBreakdown[];
}

export interface SummariesSalesOverlayInput {
  userId: string;
  currentYear: number;
  previousYear: number;
  /** Fair YTD cut — only include month/day on or before this (local calendar). */
  fairMonth: number; // 0-11
  fairDay: number;
}
