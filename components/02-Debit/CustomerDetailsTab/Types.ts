import { InvoiceRow } from '@/types';

export interface CustomerDetailsProps {
  customerName: string;
  invoices: InvoiceRow[];
  onBack: () => void;
  initialTab?: 'dashboard' | 'invoices' | 'ages' | 'notes' | 'overdue' | 'monthly';
}

export interface InvoiceWithNetDebt extends InvoiceRow {
  netDebt: number;
  residual?: number;
  originalIndex: number;
  parsedDate: Date | null;
}

export interface MonthlyDebt {
  year: string;
  month: string;
  debit: number;
  credit: number;
  netDebt: number;
  discounts: number;
}

export interface AgingSummary {
  atDate: number;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
  total: number;
}

export interface OverdueInvoice extends InvoiceRow {
  netDebt: number;
  residual?: number;
  daysOverdue: number;
  difference: number;
  originalIndex: number;
  parsedDate: Date | null;
}

// Shared props interface for all tabs
export interface SharedTabProps {
  customerName: string;
  invoices: InvoiceRow[];
  filteredInvoices: InvoiceWithNetDebt[];
  overdueInvoices: OverdueInvoice[];
  filteredOverdueInvoices: OverdueInvoice[];
  monthlyDebt: MonthlyDebt[];
  last12MonthsBase: MonthlyDebt[];
  monthlyPaymentsTrendData: any[];
  monthlySalesTrendData: any[];
  paymentGradientOffset: number;
  agingData: AgingSummary;
  notes: any[];
  dashboardMetrics: any;
  totalNetDebt: number;
  totalDebit: number;
  totalCredit: number;
  invoiceTable: any;
  overdueTable: any;
  overdueTotalDebit: number;
  overdueTotalCredit: number;
  overdueTotalDifference: number;
  
  // States
  activeTab: 'dashboard' | 'invoices' | 'ages' | 'notes' | 'overdue' | 'monthly';
  setActiveTab: (tab: 'dashboard' | 'invoices' | 'ages' | 'notes' | 'overdue' | 'monthly') => void;
  
  invoiceSorting: any;
  setInvoiceSorting: (s: any) => void;
  overdueSorting: any;
  setOverdueSorting: (s: any) => void;
  
  invoiceSearchQuery: string;
  setInvoiceSearchQuery: (s: string) => void;
  
  pagination: any;
  setPagination: (p: any) => void;
  overduePagination: any;
  setOverduePagination: (p: any) => void;
  
  showCollectionModal: boolean;
  setShowCollectionModal: (s: boolean) => void;
  
  selectedYearFilter: string[];
  setSelectedYearFilter: React.Dispatch<React.SetStateAction<string[]>>;
  isYearDropdownOpen: boolean;
  setIsYearDropdownOpen: (s: boolean) => void;
  
  selectedMonthFilter: string[];
  setSelectedMonthFilter: React.Dispatch<React.SetStateAction<string[]>>;
  isMonthDropdownOpen: boolean;
  setIsMonthDropdownOpen: (s: boolean) => void;
  
  selectedOverdueMonthFilter: string[];
  setSelectedOverdueMonthFilter: React.Dispatch<React.SetStateAction<string[]>>;
  isOverdueMonthDropdownOpen: boolean;
  setIsOverdueMonthDropdownOpen: (s: boolean) => void;
  
  selectedMatchingFilter: string[];
  setSelectedMatchingFilter: React.Dispatch<React.SetStateAction<string[]>>;
  isMatchingDropdownOpen: boolean;
  setIsMatchingDropdownOpen: (s: boolean) => void;
  
  startDateFilter: string;
  setStartDateFilter: (s: string) => void;
  endDateFilter: string;
  setEndDateFilter: (s: string) => void;
  
  selectedInvoiceIds: Set<number>;
  setSelectedInvoiceIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  selectedOverdueIds: Set<number>;
  setSelectedOverdueIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  
  showOB: boolean;
  setShowOB: (s: boolean) => void;
  showSales: boolean;
  setShowSales: (s: boolean) => void;
  showReturns: boolean;
  setShowReturns: (s: boolean) => void;
  showPayments: boolean;
  setShowPayments: (s: boolean) => void;
  showDiscounts: boolean;
  setShowDiscounts: (s: boolean) => void;
  showJV: boolean;
  setShowJV: (s: boolean) => void;
  
  showExportModal: boolean;
  setShowExportModal: (s: boolean) => void;
  selectedMonths: string[];
  setSelectedMonths: React.Dispatch<React.SetStateAction<string[]>>;
  pdfExportType: 'all' | 'net';
  setPdfExportType: (s: 'all' | 'net') => void;
  exportScope: 'custom' | 'view' | 'selection';
  setExportScope: (s: 'custom' | 'view' | 'selection') => void;
  exportFormat: 'pdf' | 'excel';
  setExportFormat: (s: 'pdf' | 'excel') => void;
  shortenInvoiceNumbers: boolean;
  setShortenInvoiceNumbers: (s: boolean) => void;
  
  loadingNotes: boolean;
  newNote: string;
  setNewNote: (s: string) => void;
  editingNoteId: number | null;
  setEditingNoteId: (s: number | null) => void;
  editingNoteContent: string;
  setEditingNoteContent: (s: string) => void;
  currentUserName: string;
  
  customerEmails: string[];
  emailCustomers: string[];
  closedCustomers: Set<string>;
  
  selectedInvoice: InvoiceWithNetDebt | OverdueInvoice | null;
  setSelectedInvoice: (i: InvoiceWithNetDebt | OverdueInvoice | null) => void;
  
  spiData: { number: string, matching: string }[];
  invoicesWithNetDebt: InvoiceWithNetDebt[];
  availableMatchingsWithResidual: string[];
  availableMonths: string[];
  availableYears: string[];
  availableOverdueMonths: string[];
  invoiceTypeTotals: any;
  
  // Handlers
  handleEmail: () => void;
  handleAddNote: () => void;
  handleUpdateNote: (rowIndex: number, content: string, isSolved: boolean) => void;
  handleDeleteNote: (rowIndex: number) => void;
  toggleYearSelection: (year: string) => void;
  
  // Refs
  newNoteRef: any;
  editNoteRef: any;
  
  // Constants
  MATCHING_FILTER_ALL_OPEN: string;
  MATCHING_FILTER_ALL_UNMATCHED: string;
}
