export interface InvoiceRow {
  date: string;
  number: string;
  customerName: string;
  debit: number;
  credit: number;
  salesRep: string;
}

export interface CustomerAnalysis {
  customerName: string;
  totalDebit: number;
  totalCredit: number;
  netDebt: number;
  transactionCount: number;
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

