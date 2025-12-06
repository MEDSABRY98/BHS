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
  transactionCount: number;
  hasOpenMatchings?: boolean;
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
}