export interface InvoiceRow {
  date: string;
  dueDate?: string;
  number: string;
  customerName: string;
  debit: number;
  credit: number;
  salesRep: string;
  matching?: string;
}

export interface CustomerAnalysis {
  customerName: string;
  totalDebit: number;
  totalCredit: number;
  netDebt: number;
  netSales?: number; // Net Sales = SAL debit - RSAL credit (matching Dashboard)
  transactionCount: number;
  hasOpenMatchings?: boolean;
  salesReps?: Set<string>;
  invoiceNumbers?: Set<string>;
  lastPaymentDate?: Date | null;
  lastPaymentMatching?: string | null; // Matching ID tied to last payment (if any)
  lastPaymentAmount?: number | null; // Amount of last payment
  lastPaymentClosure?: string; // Human label describing whether last payment is closed
  lastSalesDate?: Date | null;
  lastSalesAmount?: number | null; // Amount of last sale
  lastTransactionDate?: Date | null; // NEW: Date of valid transaction of any type
  overdueAmount?: number; // Total overdue amount
  hasOB?: boolean; // Has unpaid OB invoices (OB invoices with netDebt > 0)
  openOBAmount?: number; // Total netDebt of unpaid OB invoices
  agingBreakdown?: {
    atDate: number; // <= 0 days (Current)
    oneToThirty: number; // 1-30 days
    thirtyOneToSixty: number; // 31-60 days
    sixtyOneToNinety: number; // 61-90 days
    ninetyOneToOneTwenty: number; // 91-120 days
    older: number; // > 120 days
  };
  creditPayments?: number;
  creditReturns?: number;
  creditDiscounts?: number;
  totalSalesDebit?: number;
  sales3m?: number;
  salesCount3m?: number;
  payments3m?: number;
  paymentsCount3m?: number;
}

export interface SalesRepAnalysis {
  salesRep: string;
  totalDebit: number;
  totalCredit: number;
  netDebt: number;
  customerCount: number;
  transactionCount: number;
  collectionRate: number;
  goodCustomersCount: number;
  mediumCustomersCount: number;
  badCustomersCount: number;
}

export interface YearAnalysis {
  year: string;
  totalDebit: number;
  totalCredit: number;
  netDebt: number;
  transactionCount: number;
  collectionRate: number;
  goodCustomersCount: number;
  mediumCustomersCount: number;
  badCustomersCount: number;
}

export interface MonthAnalysis {
  month: string;
  year: string;
  totalDebit: number;
  totalCredit: number;
  netDebt: number;
  transactionCount: number;
  collectionRate: number;
  goodCustomersCount: number;
  mediumCustomersCount: number;
  badCustomersCount: number;
}

export interface Note {
  user: string;
  customerName: string;
  content: string;
  timestamp?: string;
  rowIndex?: number;
  isSolved?: boolean;
}

export interface DiscountTrackerEntry {
  customerName: string;
  /**
   * Normalized month keys in YYYY-MM format that have been reconciled manually
   * (e.g. '2025-01' for JAN25). Used to suppress alerts for those months.
   */
  reconciliationMonths: string[];
  monthlyRebate?: string;
  qRent?: string;
  bRent?: string;
}

export interface VisitCustomerEntry {
  date: string;
  customerName: string;
  city: string;
  salesRepName: string;
  collectMoney: string;
  howMuchCollectMoney: number;
  notes: string;
}