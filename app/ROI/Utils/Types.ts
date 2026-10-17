// Shared types for the ROI module

/** One entry of web_ROI_ENTRIES: the support given to a customer for ONE month. */
export type SupportRecord = {
  id: string; // ROI-0001
  customerId: string; // sub customer id
  customerName: string; // sub name
  mainName: string;
  city: string;
  salespersonId: string;
  salespersonName: string;
  month: string; // YYYY-MM - the month this support belongs to
  amount: number; // AED
  notes: string;
};

/** What every analysis result is about: a customer (+ salesperson) over the months that have a support. */
export type RoiSubject = {
  id: string;
  customerId: string;
  customerName: string;
  mainName: string;
  city: string;
  salespersonId: string;
  salespersonName: string;
  monthlySupport: number; // average support per month in the result
  startMonth: string; // first / last month in the result
  endMonth: string;
  notes: string;
};

/** One sales line (compact). amount < 0 = return. */
export type RoiLine = {
  date: string; // YYYY-MM-DD
  invoice: string;
  customerId: string;
  productId: string;
  amount: number;
  qty: number;
  cost: number; // unit cost, 0 when costs are hidden for the user
};

export type RoiData = {
  supports: SupportRecord[];
  sales: RoiLine[];
  showCosts: boolean;
  /** the 3 sales months the server loaded (so the screen and the server always agree) */
  window: string[];
  /** last positive invoice date of each supported customer (all history) - explains empty months */
  lastSale?: Record<string, string>;
};

export type SalespersonOption = { id: string; name: string };

export type CustomerOption = { id: string; name: string; mainName: string; city: string; salespersonId: string };

export type SupportInput = {
  customerId: string;
  salespersonId: string;
  month: string; // YYYY-MM
  amount: number;
  notes?: string;
};

export type Tone = 'green' | 'amber' | 'red' | 'slate';

export type MonthRow = {
  month: string; // YYYY-MM
  /** the support entries of this month (to edit / delete them) */
  entries: SupportRecord[];
  support: number;
  gross: number;
  returns: number;
  net: number;
  invoices: number;
  returnDocs: number;
  avgInvoice: number;
  avgItems: number;
  returnRate: number | null;
  profit: number | null;
};

export type Assessment = { label: string; note: string; tone: Tone };

export type RoiResult = {
  support: RoiSubject;
  months: MonthRow[];
  monthsCount: number;
  /** the sales window (last 3 full months, never the current month) and its per-month figures */
  salesMonths: MonthRow[];
  totalSupport: number;
  gross: number;
  returns: number;
  net: number;
  avgGross: number;
  avgReturns: number;
  avgNet: number;
  returnRate: number | null;
  invoices: number;
  avgInvoicesPerMonth: number;
  avgInvoice: number;
  avgItems: number;
  supportPctOfNet: number | null; // monthly support / avg monthly net
  netPerSupport: number | null; // avg monthly net / monthly support
  profit: number | null; // gross profit after returns (null = costs hidden / unavailable)
  marginPct: number | null;
  netProfit: number | null; // profit - total support
  roiPct: number | null; // (profit - support) / support
  lastTransaction: string;
  assessment: Assessment;
};
