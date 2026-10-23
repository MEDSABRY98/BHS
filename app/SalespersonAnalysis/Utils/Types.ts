// Shared types for the Salesperson Analysis module

export type SalespersonOption = { id: string; name: string };

export type Period = { start: string; end: string }; // YYYY-MM-DD

/** One sales line of the salesperson (compact). */
export type SalesLine = {
  date: string; // YYYY-MM-DD
  invoice: string;
  customerId: string; // sub customer
  productId: string;
  amount: number; // < 0 = return
  qty: number;
  cost: number; // unit cost, 0 when costs are hidden for the user
};

export type SalesCustomerInfo = {
  id: string;
  name: string; // sub name
  mainName: string;
  city: string;
  firstPurchase: string; // all history
  lastPurchase: string; // all history
};

export type SalesProductInfo = { id: string; barcode: string; name: string; category: string };

/** One ledger row (mix_DEBIT) — the salesperson's share. */
export type LedgerRow = {
  id: string;
  date: string;
  dueDate: string;
  /** payments: when the money is actually collected (cheque due date); '' = date */
  paymentDate?: string;
  number: string;
  customerId: string;
  customerName: string; // main customer name
  city: string;
  debit: number;
  credit: number;
  matching: string;
  paymentTerm?: number;
  isCustomerVendor?: boolean;
};

export type SalespersonData = {
  salesperson: SalespersonOption;
  period: Period;
  /** first day of the comparison window (same period last year) */
  windowStart: string;
  showCosts: boolean;
  sales: SalesLine[];
  customers: Record<string, SalesCustomerInfo>;
  products: Record<string, SalesProductInfo>;
  ledger: LedgerRow[];
  /** last payment date per main customer name (all history) */
  lastPaymentByCustomer: Record<string, string>;
  /** tags per main customer name (bhs_CUSTOMERS "CUSTOMER TAG" of its customers; none = no tags) */
  tagsByCustomer?: Record<string, string[]>;
  /** tag + class per customer id (upper-cased), for the Tag / Class filters */
  customerMeta?: Record<string, { tag: string; cls: string }>;
};

export type AgingMode = 'days' | 'months';
