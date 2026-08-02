import type { SalesInvoice } from '@/lib/supabase';

export type CustomerDetailsTabId =
  | 'summary'
  | 'dashboard'
  | 'subcustomers'
  | 'monthly'
  | 'categories'
  | 'products'
  | 'invoices';

export interface SalesCustomerDetailsProps {
  customerName: string;
  customerId?: string;
  customerType?: 'main' | 'sub';
  userId?: string;
  onBack: () => void;
  initialTab?: CustomerDetailsTabId;
  showCosts?: boolean;
  onOpenMainCustomer?: (mainCustomerName: string) => void;
}

export interface MonthlySalesRow {
  month: string;
  monthKey: string;
  amount: number;
  qty: number;
  count: number;
  isZeroMonth?: boolean;
  amountChange?: number | null;
}

export interface ProductSalesRow {
  barcode: string;
  product: string;
  amount: number;
  qty: number;
  avgCost: number;
  avgPrice: number;
  invoiceCount: number;
  invoiceNumbers: string;
  lastInvoiceDate: string | null;
  isDuplicate: boolean;
}

export interface SubCustomerRow {
  customerId: string;
  subCustomerName: string;
  totalAmount: number;
  totalQty: number;
  productsCount: number;
  invoicesCount: number;
}

export interface GroupedInvoiceRow {
  invoiceDate: string;
  invoiceNumber: string;
  amount: number;
  qty: number;
  productCount: number;
  subCustomerNames: string;
  avgCost: number;
  avgPrice: number;
  items: SalesInvoice[];
}

export interface DashboardMetrics {
  totalAmount: number;
  totalQty: number;
  uniqueProducts: number;
  uniqueMonths: number;
  totalMonths: number;
  avgMonthlyAmount: number;
  avgMonthlyQty: number;
  lastInvoiceDate: Date | null;
  daysSinceLastInvoice: number | null;
}

export interface ChartDataRow {
  month: string;
  year: string;
  prevYear: string;
  currentAmount: number;
  prevAmount: number;
  diff: number;
  percent: number;
  isPositive: boolean;
  isFuture: boolean;
  legendCurr: string;
  legendPrev: string;
  topBaseline?: number;
}

export interface SelectedInvoice {
  invoiceDate: string;
  invoiceNumber: string;
  amount: number;
  qty: number;
  customerName: string;
  items: SalesInvoice[];
}

export interface SubCustomerSummaryData {
  mainCustomerName: string | null;
  rank: number | null;
  totalSubCustomers: number;
  shareOfMainPercent: number | null;
  currentYear: number;
  prevYear: number;
  ytdEndMonth: number | null;
  ytdLabel: string;
  prevYtdAmount: number;
  currYtdAmount: number;
  ytdDiff: number;
  ytdPercent: number;
  siblingRanking: SubCustomerRow[];
}
