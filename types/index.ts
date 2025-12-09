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
  lastSalesDate?: Date | null;
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
}

export interface SalesRepAnalysis {
  salesRep: string;
  totalDebit: number;
  totalCredit: number;
  netDebt: number;
  customerCount: number;
  transactionCount: number;
}

export interface YearAnalysis {
  year: string;
  totalDebit: number;
  totalCredit: number;
  netDebt: number;
  transactionCount: number;
}

export interface MonthAnalysis {
  month: string;
  year: string;
  totalDebit: number;
  totalCredit: number;
  netDebt: number;
  transactionCount: number;
}

export interface Note {
  user: string;
  customerName: string;
  content: string;
  timestamp?: string;
  rowIndex?: number;
  isSolved?: boolean;
}
