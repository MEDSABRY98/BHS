export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type DetailMode = 'none' | 'customer' | 'period';
export type PaymentTrackerSubTab = 'dashboard' | 'customer' | 'period' | 'area';

export interface PaymentEntry {
  date: string;
  number: string;
  customerName: string;
  type: string;
  credit: number;
  rawCredit: number;
  debit: number;
  rawDebit: number;
  amountSource: 'credit' | 'debit' | 'creditMinusDebit';
  salesRep?: string;
  matching?: string | number;
  parsedDate: Date | null;
  matchedOpeningBalance?: boolean;
}

export interface PaymentByCustomer {
  customerName: string;
  totalPayments: number;
  paymentCount: number;
  payments: PaymentEntry[];
  lastPayment: PaymentEntry | null;
  daysSinceLastPayment: number | null;
}

export interface PaymentByPeriod {
  period: string;
  periodKey: string;
  totalPayments: number;
  paymentCount: number;
  payments: PaymentEntry[];
}

export interface PdfExportSections {
  dashboard: boolean;
  summary: boolean;
  summaryPrevious: boolean;
  summaryLastYear: boolean;
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  customerList: boolean;
  gapAnalysis: boolean;
  salesRep: boolean;
}

export interface AreaStat {
  repName: string;
  totalCollected: number;
  paymentCount: number;
  avgPaymentAmount: number;
  avgCollectionDays: number;
}
