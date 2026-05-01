'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  PaginationState,
} from '@tanstack/react-table';
import { InvoiceRow } from '@/types';
import { Mail, FileText, Calendar, ArrowLeft, FileSpreadsheet, ListFilter, CheckSquare, BarChart3, Download, X, Settings2 } from 'lucide-react';
import { getInvoiceType } from '@/lib/InvoiceType';
import { useSearchParams } from 'next/navigation';
import NoData from '../../01-Unified/NoDataTab';
import { generateAnalyticalPDF as generateAnalyticalPDFUtil } from '@/lib/pdf/PdfUtils';

interface CustomerDetailsProps {
  customerName: string;
  invoices: InvoiceRow[];
  onBack: () => void;
  initialTab?: 'dashboard' | 'invoices' | 'ages' | 'notes' | 'overdue' | 'monthly';
}

import DashboardTab from './Tabs/DashboardTab';
import InvoicesTab from './Tabs/InvoicesTab';
import OverdueTab from './Tabs/OverdueTab';
import MonthlyTab from './Tabs/MonthlyTab';
import AgesTab from './Tabs/AgesTab';
import NotesTab from './Tabs/NotesTab';
import { SharedTabProps, InvoiceWithNetDebt, MonthlyDebt, AgingSummary, OverdueInvoice } from './Types';
import {
  normalizeCustomerKey,
  isPaymentTxn,
  getPaymentAmount,
  parseInvoiceDate,
  shortenInvoiceNumber,
  renderNoteWithLinks,
  autoResizeTextarea,
  NOTES_TEXTAREA_MAX_HEIGHT
} from './Utils';
import PaymentModal from './Modals/PaymentModal';
import CollectionModal from './Modals/CollectionModal';
import { ExportModal } from './Modals/ExportModal';
import InvoiceDetailModal from './Modals/InvoiceDetailModal';
import FilterBar from './FilterBar';
import TabsNav from './TabsNav';

const invoiceColumnHelper = createColumnHelper<InvoiceWithNetDebt>();
const overdueColumnHelper = createColumnHelper<OverdueInvoice>();

const buildInvoicesWithNetDebt = (invList: InvoiceRow[]): InvoiceWithNetDebt[] => {
  // 1. Calculate totals for each matching group
  const matchingTotals = new Map<string, number>();
  invList.forEach((invoice) => {
    if (invoice.matching) {
      const current = matchingTotals.get(invoice.matching) || 0;
      matchingTotals.set(invoice.matching, current + (invoice.debit - invoice.credit));
    }
  });

  // 2. Identify which invoice should display the residual per matching group (largest debit)
  const matchingTargetIndex = new Map<string, number>();
  invList.forEach((invoice, index) => {
    if (!invoice.matching) return;
    const existingTarget = matchingTargetIndex.get(invoice.matching);
    if (existingTarget === undefined) {
      matchingTargetIndex.set(invoice.matching, index);
      return;
    }
    const existingInvoice = invList[existingTarget];
    if ((invoice.debit || 0) > (existingInvoice?.debit || 0)) {
      matchingTargetIndex.set(invoice.matching, index);
    }
  });

  // 3. Map invoices preserving original order
  return invList.map((invoice, index) => {
    let residual: number | undefined = undefined;
    const parsedDate = parseInvoiceDate(invoice.date);

    if (invoice.matching) {
      const targetIndex = matchingTargetIndex.get(invoice.matching);
      if (targetIndex === index) {
        const total = matchingTotals.get(invoice.matching) || 0;
        if (Math.abs(total) > 0.01) {
          residual = total;
        }
      }
    }

    return {
      ...invoice,
      netDebt: invoice.debit - invoice.credit,
      residual,
      originalIndex: index,
      parsedDate,
    };
  });
};

const toNetOnlyOpenInvoices = (invList: InvoiceWithNetDebt[]): InvoiceWithNetDebt[] => {
  // Keep only unmatched invoices OR the single "residual holder" invoice for open matching groups
  return invList
    .filter((inv) => {
      if (!inv.matching) return true;
      return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
    })
    .map((inv) => {
      if (inv.matching && inv.residual !== undefined) {
        return {
          ...inv,
          credit: inv.debit - inv.residual,
          netDebt: inv.residual,
        };
      }
      return inv;
    });
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.readAsDataURL(blob);
  });

export default function CustomerDetails({ customerName, invoices, onBack, initialTab = 'dashboard' }: CustomerDetailsProps) {
  const MATCHING_FILTER_ALL_OPEN = 'All Open Matchings';
  const MATCHING_FILTER_ALL_UNMATCHED = 'All Unmatched';
  const searchParams = useSearchParams();
  const downloadAction = searchParams?.get('action');
  const hasDownloadedReport = useRef(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'ages' | 'notes' | 'overdue' | 'monthly'>(initialTab);
  const [invoiceSorting, setInvoiceSorting] = useState<SortingState>([]);
  const [overdueSorting, setOverdueSorting] = useState<SortingState>([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [overduePagination, setOverduePagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  const [selectedYearFilter, setSelectedYearFilter] = useState<string[]>([]);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string[]>([]);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [selectedOverdueMonthFilter, setSelectedOverdueMonthFilter] = useState<string[]>([]);
  const [isOverdueMonthDropdownOpen, setIsOverdueMonthDropdownOpen] = useState(false);
  const [selectedMatchingFilter, setSelectedMatchingFilter] = useState<string[]>([]);
  const [isMatchingDropdownOpen, setIsMatchingDropdownOpen] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Selected invoices for checkboxes (using originalIndex as unique identifier)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());
  const [selectedOverdueIds, setSelectedOverdueIds] = useState<Set<number>>(new Set());

  // Invoice Type Filters
  const [showOB, setShowOB] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [showJV, setShowJV] = useState(false);

  // PDF Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [pdfExportType, setPdfExportType] = useState<'all' | 'net'>('all');
  const [exportScope, setExportScope] = useState<'custom' | 'view' | 'selection'>('custom');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [shortenInvoiceNumbers, setShortenInvoiceNumbers] = useState(true);

  // Notes State
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');

  const [customerEmails, setCustomerEmails] = useState<string[]>([]);
  const [emailCustomers, setEmailCustomers] = useState<string[]>([]);

  // Notes textarea auto-resize (grow with content; only scroll after max height)
  const newNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const editNoteRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    autoResizeTextarea(newNoteRef.current);
  }, [newNote]);

  useEffect(() => {
    if (editingNoteId !== null) {
      autoResizeTextarea(editNoteRef.current);
    }
  }, [editingNoteId, editingNoteContent]);

  // Invoice Details Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithNetDebt | OverdueInvoice | null>(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (storedUser && storedUser.name) {
      setCurrentUserName(storedUser.name);
    }
  }, []);

  useEffect(() => {
    const fetchEmail = async () => {
      try {
        const res = await fetch(`/api/customer-email?customerName=${encodeURIComponent(customerName)}`);
        const data = await res.json();
        const emails = Array.isArray(data?.emails) ? data.emails.filter(Boolean) : (data?.email ? [data.email] : []);
        const customers = Array.isArray(data?.customers) ? data.customers.filter(Boolean) : [];
        setCustomerEmails(emails);
        setEmailCustomers(customers.length > 0 ? customers : [customerName]);
      } catch (error) {
        console.error('Error fetching customer email:', error);
      }
    };
    fetchEmail();
  }, [customerName]);

  // Fetch Closed Customers for Rating
  const [closedCustomers, setClosedCustomers] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fetchClosedCustomers = async () => {
      try {
        const response = await fetch('/api/closed-customers');
        if (response.ok) {
          const data = await response.json();
          const normalizedSet = new Set<string>();
          data.closedCustomers.forEach((name: string) => {
            normalizedSet.add(normalizeCustomerKey(name));
          });
          setClosedCustomers(normalizedSet);
        }
      } catch (error) {
        console.error('Failed to fetch closed customers:', error);
      }
    };
    fetchClosedCustomers();
  }, []);

  // Update activeTab when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleEmail = async () => {
    if (customerEmails.length === 0) return;

    try {
      const toEmails = customerEmails.join(', ');
      const ccEmails = '';

      // Determine which customers we should include (supports "A & B" grouping coming from the sheet resolver)
      const targets = (emailCustomers && emailCustomers.length > 0 ? emailCustomers : [customerName]).filter(Boolean);
      const uniqueTargets = Array.from(new Set(targets.map(t => t.trim()))).filter(Boolean);

      // We only fetch all sheet data if we need more than the current customer's invoices
      const invoicesByCustomer = new Map<string, InvoiceRow[]>();
      if (uniqueTargets.length <= 1) {
        invoicesByCustomer.set(customerName, invoices);
      } else {
        const res = await fetch('/api/sheets');
        const payload = await res.json();
        const allRows: InvoiceRow[] = Array.isArray(payload?.data) ? payload.data : [];

        uniqueTargets.forEach((cust) => {
          const key = normalizeCustomerKey(cust);
          const rows = allRows.filter(r => normalizeCustomerKey(r.customerName) === key);
          invoicesByCustomer.set(cust, rows);
        });
      }

      // Build PDFs + per-customer net debt lines
      const monthsLabel = 'All Months (Net Only)';
      const { generateAccountStatementPDF } = await import('@/lib/pdf/PdfUtils');

      const attachments: Array<{ fileName: string; base64: string }> = [];
      const debtByCustomer: Array<{ customer: string; netDebt: number }> = [];

      for (const cust of uniqueTargets) {
        const rows = invoicesByCustomer.get(cust) || [];
        const withNet = buildInvoicesWithNetDebt(rows);
        const finalInvoices = toNetOnlyOpenInvoices(withNet);

        const netDebt = finalInvoices.reduce((sum, inv) => sum + inv.netDebt, 0);
        debtByCustomer.push({ customer: cust, netDebt });

        if (finalInvoices.length === 0) {
          continue; // still list debt=0, but skip attachment
        }

        const pdfBlob = await generateAccountStatementPDF(cust, finalInvoices, true, monthsLabel);
        if (!pdfBlob) throw new Error('Failed to generate PDF blob');

        const pdfBase64 = await blobToBase64(pdfBlob as Blob);
        const pdfFileName = `${cust.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim()}.pdf`;
        attachments.push({ fileName: pdfFileName, base64: pdfBase64 });
      }

      const hasAnyAttachment = attachments.length > 0;
      if (!hasAnyAttachment) {
        alert('No open invoices to send.');
        return;
      }

      const boundary = "----=_NextPart_000_0001_01C2A9A1.12345678";
      const subject = 'Statement of Account - Al Marai Al Arabia Trading Sole Proprietorship L.L.C';

      const debtSectionHtml =
        uniqueTargets.length > 1
          ? `<p style="margin: 0 0 10px 0; line-height: 1.5;">Your current balance details:</p>
<ul style="margin: 0 0 10px 0; padding-left: 20px; line-height: 1.5;">
${debtByCustomer
            .map(
              (d) =>
                `<li style="line-height: 1.5; margin-bottom: 5px;"><b>${d.customer}</b>: <span style="color: blue; font-weight: bold; font-size: 16px;">${d.netDebt.toLocaleString(
                  'en-US',
                )} AED</span></li>`,
            )
            .join('')}
</ul>`
          : `<p style="margin: 0 0 10px 0; line-height: 1.5;">Please find attached your account statement.</p>
<ul style="margin: 0 0 10px 0; padding-left: 20px; line-height: 1.5;">
<li style="line-height: 1.5; margin-bottom: 5px;"><b>Your current balance is:</b> <span style="color: blue; font-weight: bold; font-size: 16px;">${debtByCustomer[0]?.netDebt.toLocaleString(
            'en-US',
          )} AED</span></li>
</ul>`;

      const htmlBody = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">
<p style="margin: 0 0 10px 0; line-height: 1.5;">Dear Team,</p>
<p style="margin: 0 0 10px 0; line-height: 1.5;">We hope this message finds you well.</p>
${debtSectionHtml}
<p style="margin: 0 0 10px 0; line-height: 1.5;">Kindly provide us with your statement of account and any discount invoices for reconciliation.</p>
<p style="margin: 0; line-height: 1.5;">Best regards,</p>
<p style="margin: 0; line-height: 1.5;">Accounts</p>
<p style="margin: 0; line-height: 1.5;">Al Marai Al Arabia Trading Sole Proprietorship L.L.C</p>
</body>
</html>`;
      const emlLines: string[] = [];
      emlLines.push('From: accounting@marae.ae');
      emlLines.push('To: ' + toEmails);
      emlLines.push('Cc: ' + ccEmails);
      emlLines.push('Subject: ' + subject);
      emlLines.push('X-Unsent: 1');
      emlLines.push('Content-Type: multipart/mixed; boundary="' + boundary + '"');
      emlLines.push('');

      // Body part
      emlLines.push('--' + boundary);
      emlLines.push('Content-Type: text/html; charset="UTF-8"');
      emlLines.push('Content-Transfer-Encoding: 7bit');
      emlLines.push('');
      emlLines.push(htmlBody);
      emlLines.push('');

      // Attachments
      attachments.forEach((att) => {
        emlLines.push('--' + boundary);
        emlLines.push(`Content-Type: application/pdf; name="${att.fileName}"`);
        emlLines.push('Content-Transfer-Encoding: base64');
        emlLines.push(`Content-Disposition: attachment; filename="${att.fileName}"`);
        emlLines.push('');
        emlLines.push(att.base64);
        emlLines.push('');
      });

      emlLines.push('--' + boundary + '--');

      const emlContent = emlLines.join('\r\n');

      // Download .eml file
      const blob = new Blob([emlContent], { type: 'message/rfc822' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Email_to_${customerName.replace(/\s+/g, '_')}.eml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Error in email flow:', error);
      alert('Error preparing email.');
    }
  };

  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const response = await fetch(`/api/notes?customerName=${encodeURIComponent(customerName)}`);
      const data = await response.json();
      if (data.notes) {
        setNotes(data.notes);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [customerName]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const user = currentUser.name || 'Unknown';

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user,
          customerName,
          content: newNote,
          isSolved: false
        }),
      });

      if (response.ok) {
        setNewNote('');
        // Shrink the textarea back after clearing (avoid keeping the expanded height)
        requestAnimationFrame(() => autoResizeTextarea(newNoteRef.current));
        fetchNotes();
      } else {
        alert('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Error adding note');
    }
  };

  const handleUpdateNote = async (rowIndex: number, content: string, isSolved: boolean) => {
    if (!content.trim()) return;

    try {
      const response = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex,
          content,
          isSolved
        }),
      });

      if (response.ok) {
        setEditingNoteId(null);
        setEditingNoteContent('');
        // Shrink edit textarea after saving
        requestAnimationFrame(() => autoResizeTextarea(editNoteRef.current));
        fetchNotes();
      } else {
        alert('Failed to update note');
      }
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Error updating note');
    }
  };

  const handleDeleteNote = async (rowIndex: number) => {
    try {
      const response = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex }),
      });

      if (response.ok) {
        fetchNotes();
      } else {
        alert('Failed to delete note');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Error deleting note');
    }
  };

  // SPI Data State
  const [spiData, setSpiData] = useState<{ number: string, matching: string }[]>([]);

  useEffect(() => {
    const fetchSpi = async () => {
      try {
        const res = await fetch('/api/spi');
        const json = await res.json();
        if (json.data) setSpiData(json.data);
      } catch (e) { console.error('Failed to fetch SPI', e); }
    };
    fetchSpi();
  }, []);

  // Prepare invoices data with Net Debt and Residual
  const invoicesWithNetDebt = useMemo(() => {
    // We now strictly rely on the 'residualAmount' from Google Sheets.
    // Legacy fallback calculations (matchingTotals, maxDebits) and SPI overrides have been fully removed 
    // to prevent any overlap or interference.

    return invoices.map((invoice, index) => {
      let residual: number | undefined = undefined;
      const parsedDate = parseInvoiceDate(invoice.date);

      if (invoice.matching && invoice.residualAmount !== undefined && Math.abs(invoice.residualAmount) > 0.01) {
        residual = invoice.residualAmount;
      }

      return {
        ...invoice,
        netDebt: invoice.debit - invoice.credit,
        residual,
        originalIndex: index,
        parsedDate
      };
    });
  }, [invoices]);

  // Get matchings with residual for filtering
  const availableMatchingsWithResidual = useMemo(() => {
    const matchings = new Set<string>();
    invoicesWithNetDebt.forEach(inv => {
      if (inv.matching && inv.residual !== undefined && Math.abs(inv.residual) > 0.01) {
        matchings.add(inv.matching);
      }
    });
    return Array.from(matchings).sort();
  }, [invoicesWithNetDebt]);

  // Get available months for filtering
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();

    // Filter invoices if a matching is selected
    let relevantInvoices = invoices;

    if (selectedMatchingFilter.length > 0) {
      const wantsAllOpen = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN);
      const wantsUnmatched = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED);
      const selectedIds = selectedMatchingFilter.filter(
        (m) => m !== MATCHING_FILTER_ALL_OPEN && m !== MATCHING_FILTER_ALL_UNMATCHED
      );

      relevantInvoices = invoices.filter((inv) => {
        if (!inv.matching) return wantsUnmatched;
        return (
          (wantsAllOpen && availableMatchingsWithResidual.includes(inv.matching)) ||
          (selectedIds.length > 0 && selectedIds.includes(inv.matching))
        );
      });
    }

    relevantInvoices.forEach(inv => {
      if (inv.date) {
        const date = new Date(inv.date);
        if (!isNaN(date.getTime())) {
          const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // e.g., January 2025
          monthsSet.add(monthYear);
        }
      }
    });
    // Convert to array and sort by date descending
    return Array.from(monthsSet).sort((a, b) => {
      const dateA = new Date(`1 ${a}`);
      const dateB = new Date(`1 ${b}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [invoices, selectedMatchingFilter, availableMatchingsWithResidual]);

  // Initialize selected months with all available months
  useEffect(() => {
    setSelectedMonths(availableMonths);
  }, [availableMonths]);

  // Reset selected months if they're no longer available in the filtered list
  useEffect(() => {
    const validMonths = selectedMonthFilter.filter(month => availableMonths.includes(month));
    if (validMonths.length !== selectedMonthFilter.length) {
      setSelectedMonthFilter(validMonths);
    }
  }, [availableMonths, selectedMonthFilter]);

  // Extract available years from available months
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    availableMonths.forEach(m => {
      const parts = m.split(' '); // "January 2025"
      if (parts.length > 1) years.add(parts[1]);
    });
    return Array.from(years).sort().reverse();
  }, [availableMonths]);

  const toggleYearSelection = (year: string) => {
    const monthsInYear = availableMonths.filter(m => m.endsWith(year));
    // Check if ALL months in this year are currently selected
    const allSelected = monthsInYear.every(m => selectedMonths.includes(m));

    if (allSelected) {
      // Deselect all months of this year
      setSelectedMonths(prev => prev.filter(m => !monthsInYear.includes(m)));
    } else {
      // Select all months of this year
      setSelectedMonths(prev => {
        const newSelection = new Set(prev);
        monthsInYear.forEach(m => newSelection.add(m));
        return Array.from(newSelection);
      });
    }
  };

  // Prepare Overdue Invoices
  const overdueInvoices = useMemo(() => {
    // 1. Filter Logic same as "Net Only" PDF Export
    // This keeps only unmatched invoices OR the single "residual holder" invoice for open matching groups
    return invoicesWithNetDebt.filter(inv => {
      // Keep if no matching ID (Unmatched)
      if (!inv.matching) return true;

      // Keep only if it carries the residual (which means it's the main open invoice of an open group)
      return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
    }).map(inv => {
      let difference = inv.netDebt;

      if (inv.matching && inv.residual !== undefined) {
        // It's a condensed open invoice
        // Difference is the residual
        difference = inv.residual;
      }

      // Calculate Days Overdue
      let daysOverdue = 0;
      // Try Due Date first, then Invoice Date
      let targetDate = parseInvoiceDate(inv.dueDate) || inv.parsedDate;

      if (targetDate && !isNaN(targetDate.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - targetDate.getTime();
        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Adjust Credit for display (Debit - Credit = Difference)
      const adjustedCredit = inv.debit - difference;

      return {
        ...inv,
        credit: adjustedCredit,
        netDebt: difference,
        difference,
        daysOverdue
      } as OverdueInvoice;
    });
  }, [invoicesWithNetDebt]);

  // Get available overdue months for filtering
  const availableOverdueMonths = useMemo(() => {
    const monthsSet = new Set<string>();

    let relevantInvoices = overdueInvoices;

    // Apply matching filters
    if (selectedMatchingFilter.length > 0) {
      const wantsAllOpen = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN);
      const wantsUnmatched = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED);
      const selectedIds = selectedMatchingFilter.filter(
        (m) => m !== MATCHING_FILTER_ALL_OPEN && m !== MATCHING_FILTER_ALL_UNMATCHED
      );

      relevantInvoices = relevantInvoices.filter((inv) => {
        if (!inv.matching) return wantsUnmatched;
        return (
          (wantsAllOpen && true) ||
          (selectedIds.length > 0 && selectedIds.includes(inv.matching))
        );
      });
    }

    relevantInvoices.forEach(inv => {
      // For overdue context, it's typically just months that are in this array
      if (inv.date) {
        const date = new Date(inv.date);
        if (!isNaN(date.getTime())) {
          const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          monthsSet.add(monthYear);
        }
      }
    });

    // Convert to array and sort by date descending
    return Array.from(monthsSet).sort((a, b) => {
      const dateA = new Date(`1 ${a}`);
      const dateB = new Date(`1 ${b}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [overdueInvoices, selectedMatchingFilter]);

  // Reset selected overdue months if they're no longer available in the filtered list
  useEffect(() => {
    const validMonths = selectedOverdueMonthFilter.filter(month => availableOverdueMonths.includes(month));
    if (validMonths.length !== selectedOverdueMonthFilter.length) {
      setSelectedOverdueMonthFilter(validMonths);
    }
  }, [availableOverdueMonths, selectedOverdueMonthFilter]);

  // Filter invoices based on selected month filter, matching filter, and search query
  const filteredInvoices = useMemo(() => {
    let filtered = invoicesWithNetDebt;

    // Year Filter
    if (selectedYearFilter.length > 0) {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        return selectedYearFilter.includes(date.getFullYear().toString());
      });
    }

    // Month Filter
    if (selectedMonthFilter.length > 0) {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return selectedMonthFilter.includes(monthYear);
      });
    }

    // Overdue Month Filter
    if (selectedOverdueMonthFilter.length > 0) {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return selectedOverdueMonthFilter.includes(monthYear);
      });
    }

    // Date Range Filter
    if (startDateFilter || endDateFilter) {
      filtered = filtered.filter((inv) => {
        const date = inv.parsedDate || (inv.date ? new Date(inv.date) : null);
        if (!date || isNaN(date.getTime())) return false;

        const d = new Date(date);
        d.setHours(0, 0, 0, 0);

        if (startDateFilter) {
          const start = new Date(startDateFilter);
          start.setHours(0, 0, 0, 0);
          if (d < start) return false;
        }
        if (endDateFilter) {
          const end = new Date(endDateFilter);
          end.setHours(0, 0, 0, 0);
          if (d > end) return false;
        }
        return true;
      });
    }

    // Matching Filter
    if (selectedMatchingFilter.length > 0) {
      const wantsAllOpen = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN);
      const wantsUnmatched = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED);
      const selectedIds = selectedMatchingFilter.filter(
        (m) => m !== MATCHING_FILTER_ALL_OPEN && m !== MATCHING_FILTER_ALL_UNMATCHED
      );

      filtered = filtered.filter((inv) => {
        if (!inv.matching) return wantsUnmatched;
        return (
          (wantsAllOpen && availableMatchingsWithResidual.includes(inv.matching)) ||
          (selectedIds.length > 0 && selectedIds.includes(inv.matching))
        );
      });
    }

    // Search Query
    if (invoiceSearchQuery.trim()) {
      const query = invoiceSearchQuery.toLowerCase();
      filtered = filtered.filter((inv) =>
        inv.number.toLowerCase().includes(query) ||
        inv.matching?.toLowerCase().includes(query) ||
        inv.date.toLowerCase().includes(query) ||
        inv.debit.toString().includes(query) ||
        inv.credit.toString().includes(query)
      );
    }

    // Invoice Type Filters
    const hasAnyFilter = showOB || showSales || showReturns || showPayments || showDiscounts || showJV;
    if (hasAnyFilter) {
      filtered = filtered.filter((inv) => {
        const num = (inv.number || '').trim().toUpperCase();

        if (showOB && num.startsWith('OB')) return true;
        if (showSales && num.startsWith('SAL') && inv.debit > 0) return true;
        if (showReturns && num.startsWith('RSAL') && inv.credit > 0) return true;
        if (showDiscounts && num.startsWith('BIL')) return true;
        if (showJV && num.startsWith('JV')) return true;
        if (showPayments && isPaymentTxn(inv)) {
          return true;
        }
        return false;
      });
    }

    // Keep the same row order as the exported PDF (which follows the original sheet order),
    // while still allowing interactive sorting via the table headers.
    return [...filtered].sort(
      (a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0),
    );
  }, [invoicesWithNetDebt, selectedYearFilter, selectedMonthFilter, selectedOverdueMonthFilter, selectedMatchingFilter, invoiceSearchQuery, showOB, showSales, showReturns, showPayments, showDiscounts, showJV, startDateFilter, endDateFilter]);



  // Filter overdue invoices based on selected month filter, matching filter, and search query
  const filteredOverdueInvoices = useMemo(() => {
    let filtered = overdueInvoices;

    // Year Filter
    if (selectedYearFilter.length > 0) {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        return selectedYearFilter.includes(date.getFullYear().toString());
      });
    }

    // Month Filter
    if (selectedMonthFilter.length > 0) {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return selectedMonthFilter.includes(monthYear);
      });
    }

    // Overdue Month Filter
    if (selectedOverdueMonthFilter.length > 0) {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return selectedOverdueMonthFilter.includes(monthYear);
      });
    }

    // Date Range Filter
    if (startDateFilter || endDateFilter) {
      filtered = filtered.filter((inv) => {
        const date = inv.parsedDate || (inv.date ? new Date(inv.date) : null);
        if (!date || isNaN(date.getTime())) return false;

        const d = new Date(date);
        d.setHours(0, 0, 0, 0);

        if (startDateFilter) {
          const start = new Date(startDateFilter);
          start.setHours(0, 0, 0, 0);
          if (d < start) return false;
        }
        if (endDateFilter) {
          const end = new Date(endDateFilter);
          end.setHours(0, 0, 0, 0);
          if (d > end) return false;
        }
        return true;
      });
    }

    // Matching Filter
    if (selectedMatchingFilter.length > 0) {
      const wantsAllOpen = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN);
      const wantsUnmatched = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED);
      const selectedIds = selectedMatchingFilter.filter(
        (m) => m !== MATCHING_FILTER_ALL_OPEN && m !== MATCHING_FILTER_ALL_UNMATCHED
      );

      filtered = filtered.filter((inv) => {
        if (!inv.matching) return wantsUnmatched;
        // For overdue list, matchings present are already "open", but keep same semantics as invoices tab
        return (
          (wantsAllOpen && true) ||
          (selectedIds.length > 0 && selectedIds.includes(inv.matching))
        );
      });
    }

    // Search Query
    if (invoiceSearchQuery.trim()) {
      const query = invoiceSearchQuery.toLowerCase();
      filtered = filtered.filter((inv) =>
        inv.number.toLowerCase().includes(query) ||
        inv.matching?.toLowerCase().includes(query) ||
        inv.date.toLowerCase().includes(query) ||
        inv.debit.toString().includes(query) ||
        inv.credit.toString().includes(query) ||
        inv.difference.toString().includes(query)
      );
    }

    // Invoice Type Filters
    const hasAnyFilter = showOB || showSales || showReturns || showPayments || showDiscounts || showJV;
    if (hasAnyFilter) {
      filtered = filtered.filter((inv) => {
        const num = (inv.number || '').trim().toUpperCase();

        if (showOB && num.startsWith('OB')) return true;
        if (showSales && num.startsWith('SAL') && inv.debit > 0) return true;
        if (showReturns && num.startsWith('RSAL') && inv.credit > 0) return true;
        if (showDiscounts && num.startsWith('BIL')) return true;
        if (showJV && num.startsWith('JV')) return true;
        if (showPayments && isPaymentTxn(inv)) {
          return true;
        }
        return false;
      });
    }

    // Keep the same row order as the exported PDF (original sheet order).
    return [...filtered].sort(
      (a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0),
    );
  }, [overdueInvoices, selectedYearFilter, selectedMonthFilter, selectedOverdueMonthFilter, selectedMatchingFilter, invoiceSearchQuery, showOB, showSales, showReturns, showPayments, showDiscounts, showJV, startDateFilter, endDateFilter]);

  // Prepare monthly debt data
  const monthlyDebt = useMemo(() => {
    const monthlyMap = new Map<string, MonthlyDebt>();

    filteredInvoices.forEach((invoice) => {
      if (!invoice.date) return;

      // Parse date to extract year and month
      const date = new Date(invoice.date);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear().toString();
      const month = date.toLocaleString('en-US', { month: 'long' });
      const key = `${year}-${month}`;

      const existing = monthlyMap.get(key) || {
        year,
        month,
        debit: 0,
        credit: 0,
        netDebt: 0,
        discounts: 0,
      };

      const num = invoice.number ? invoice.number.toUpperCase() : '';

      // 1. Calculate Net Sales (Debit)
      // Include SAL (Debit)
      if (num.startsWith('SAL')) {
        existing.debit += invoice.debit;
      }
      // Deduct RSAL (Credit) from Sales
      if (num.startsWith('RSAL')) {
        existing.debit -= invoice.credit;
      }

      // 2. Calculate Smart Payments (Credit)
      // Only count credits that are NOT SAL, RSAL, BIL, JV
      if (invoice.credit > 0.01) {
        const isNotPayment = num.startsWith('SAL') ||
          num.startsWith('RSAL') ||
          num.startsWith('BIL') ||
          num.startsWith('JV');

        if (!isNotPayment) {
          existing.credit += invoice.credit;
        }
      }

      // 3. Calculate Discounts (BIL & JV)
      if (num.startsWith('BIL') || num.startsWith('JV')) {
        // Typically discounts/adjustments are credit - debit
        existing.discounts += (invoice.credit - invoice.debit);
      }

      existing.netDebt = existing.debit - existing.credit;

      monthlyMap.set(key, existing);
    });

    return Array.from(monthlyMap.values()).sort((a, b) => {
      const dateA = new Date(`${a.month} 1, ${a.year}`);
      const dateB = new Date(`${b.month} 1, ${b.year}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredInvoices]);

  const last12MonthsBase = useMemo((): MonthlyDebt[] => {
    const last12Months: MonthlyDebt[] = [];
    const now = new Date();
    const monthFullNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const dataMap = new Map<string, MonthlyDebt>();
    monthlyDebt.forEach((item) => {
      const key = `${item.year}-${item.month}`;
      dataMap.set(key, item);
    });

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear().toString();
      const month = monthFullNames[date.getMonth()];
      const key = `${year}-${month}`;
      const existing = dataMap.get(key);
      if (existing) {
        last12Months.push(existing);
      } else {
        last12Months.push({
          year,
          month,
          debit: 0,
          credit: 0,
          netDebt: 0,
          discounts: 0,
        });
      }
    }

    return last12Months;
  }, [monthlyDebt]);

  const monthlyPaymentsTrendData = useMemo(() => {
    // Build a last-12-months series based on Payment-type transactions only,
    // and compute amount as (credit - debit) per user request.
    const monthShortNames: { [key: string]: string } = {
      January: 'JAN',
      February: 'FEB',
      March: 'MAR',
      April: 'APR',
      May: 'MAY',
      June: 'JUN',
      July: 'JUL',
      August: 'AUG',
      September: 'SEP',
      October: 'OCT',
      November: 'NOV',
      December: 'DEC',
    };

    const now = new Date();
    const months: Array<{ year: string; month: string; credit: number }> = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear().toString();
      const month = d.toLocaleString('en-US', { month: 'long' });
      months.push({ year, month, credit: 0 });
    }

    const indexByKey = new Map<string, number>();
    months.forEach((m, idx) => indexByKey.set(`${m.year}-${m.month}`, idx));

    filteredInvoices.forEach((inv) => {
      // Use the same standardized check as dashboard cards
      if (!isPaymentTxn(inv)) return;

      const date = inv.parsedDate || (inv.date ? new Date(inv.date) : null);
      if (!date || isNaN(date.getTime())) return;

      const year = date.getFullYear().toString();
      const month = date.toLocaleString('en-US', { month: 'long' });
      const idx = indexByKey.get(`${year}-${month}`);
      if (idx === undefined) return;

      // Use the same amount calculation: (Credit - Debit)
      const amount = getPaymentAmount(inv);
      // Allow negative amounts (reversals/adjustments) so the chart matches the Total Payments card
      if (Math.abs(amount) < 0.001) return;
      months[idx].credit += amount;
    });

    return months.map((item) => {
      const shortMonth = monthShortNames[item.month] || item.month.substring(0, 3).toUpperCase();
      const yearShort = item.year.substring(2);
      return {
        ...item,
        monthLabel: `${shortMonth}${yearShort}`,
      };
    });
  }, [filteredInvoices]);

  const paymentGradientOffset = useMemo(() => {
    const dataMax = Math.max(...monthlyPaymentsTrendData.map((i) => i.credit), 0);
    const dataMin = Math.min(...monthlyPaymentsTrendData.map((i) => i.credit), 0);

    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;

    return dataMax / (dataMax - dataMin);
  }, [monthlyPaymentsTrendData]);

  const monthlySalesTrendData = useMemo(() => {
    const monthShortNames: { [key: string]: string } = {
      January: 'JAN',
      February: 'FEB',
      March: 'MAR',
      April: 'APR',
      May: 'MAY',
      June: 'JUN',
      July: 'JUL',
      August: 'AUG',
      September: 'SEP',
      October: 'OCT',
      November: 'NOV',
      December: 'DEC',
    };

    return last12MonthsBase.map((item) => {
      let displayValue = item.debit;
      if (Math.abs(item.debit) > 0) {
        const minDisplayRatio = 0.25;
        const minDisplayValue = Math.abs(item.debit) * minDisplayRatio;

        if (Math.abs(item.debit) < minDisplayValue) {
          displayValue = item.debit >= 0 ? minDisplayValue : -minDisplayValue;
        } else {
          const currentRatio = Math.abs(displayValue) / Math.abs(item.debit);
          if (currentRatio < minDisplayRatio) {
            displayValue = item.debit >= 0
              ? Math.abs(item.debit) * minDisplayRatio
              : -Math.abs(item.debit) * minDisplayRatio;
          }
        }
      }

      const shortMonth = monthShortNames[item.month] || item.month.substring(0, 3).toUpperCase();
      const yearShort = item.year.substring(2);

      return {
        ...item,
        displayDebit: displayValue,
        originalDebit: item.debit,
        monthLabel: `${shortMonth}${yearShort}`,
      };
    });
  }, [last12MonthsBase]);

  const agingData = useMemo<AgingSummary>(() => {
    // Use filteredOverdueInvoices to ensure aging respects filters and includes credits
    const summary: AgingSummary = {
      atDate: 0,
      oneToThirty: 0,
      thirtyOneToSixty: 0,
      sixtyOneToNinety: 0,
      ninetyOneToOneTwenty: 0,
      older: 0,
      total: 0
    };

    filteredOverdueInvoices.forEach(inv => {
      // Use difference which represents the open balance (residual)
      const amount = inv.difference;
      if (Math.abs(amount) < 0.01) return;

      // Try Due Date first, then Invoice Date
      let targetDate = parseInvoiceDate(inv.dueDate) || inv.parsedDate;
      let daysOverdue = 0;

      if (targetDate && !isNaN(targetDate.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const refDate = new Date(targetDate);
        refDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - refDate.getTime();
        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      if (daysOverdue <= 0) {
        summary.atDate += amount;
      } else if (daysOverdue <= 30) {
        summary.oneToThirty += amount;
      } else if (daysOverdue <= 60) {
        summary.thirtyOneToSixty += amount;
      } else if (daysOverdue <= 90) {
        summary.sixtyOneToNinety += amount;
      } else if (daysOverdue <= 120) {
        summary.ninetyOneToOneTwenty += amount;
      } else {
        summary.older += amount;
      }

      summary.total += amount;
    });

    return summary;
  }, [filteredOverdueInvoices]);


  // Invoice columns - Order: CHECKBOX, DATE, NUMBER, DEBIT, CREDIT, Net Debt, Matching, Residual
  const invoiceColumns = useMemo(
    () => [
      invoiceColumnHelper.display({
        id: 'select',
        header: () => {
          const allSelected = filteredInvoices.length > 0 &&
            filteredInvoices.every(inv => selectedInvoiceIds.has(inv.originalIndex));
          const someSelected = filteredInvoices.some(inv => selectedInvoiceIds.has(inv.originalIndex));
          return (
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected && !allSelected;
              }}
              onChange={(e) => {
                if (e.target.checked) {
                  const newSelected = new Set(selectedInvoiceIds);
                  filteredInvoices.forEach(inv => newSelected.add(inv.originalIndex));
                  setSelectedInvoiceIds(newSelected);
                } else {
                  const newSelected = new Set(selectedInvoiceIds);
                  filteredInvoices.forEach(inv => newSelected.delete(inv.originalIndex));
                  setSelectedInvoiceIds(newSelected);
                }
              }}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          );
        },
        cell: (info) => {
          const inv = info.row.original;
          const isSelected = selectedInvoiceIds.has(inv.originalIndex);
          return (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                const newSelected = new Set(selectedInvoiceIds);
                if (e.target.checked) {
                  newSelected.add(inv.originalIndex);
                } else {
                  newSelected.delete(inv.originalIndex);
                }
                setSelectedInvoiceIds(newSelected);
              }}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          );
        },
      }),
      invoiceColumnHelper.accessor('date', {
        header: 'Date',
        cell: (info) => {
          const dateStr = info.getValue();
          if (!dateStr) return '';
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          return `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
        },
      }),
      invoiceColumnHelper.display({
        id: 'type',
        header: 'Type',
        cell: (info) => {
          const inv = info.row.original;
          const type = getInvoiceType(inv);
          const color =
            type === 'Sales' ? 'bg-blue-100 text-blue-700' :
              type === 'Return' ? 'bg-orange-100 text-orange-700' :
                type === 'Payment' ? 'bg-green-100 text-green-700' :
                  type === 'Discount' ? 'bg-yellow-100 text-yellow-700' :
                    type === 'Our-Paid' ? 'bg-emerald-100 text-emerald-800' :
                      type === 'OB' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700';
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>
              {type}
            </span>
          );
        }
      }),
      invoiceColumnHelper.accessor('number', {
        header: 'Number',
        cell: (info) => {
          const invoiceNumber = info.getValue() || '';
          const row = info.row.original;

          return (
            <button
              onClick={() => setSelectedInvoice(row)}
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              title={invoiceNumber}
            >
              {shortenInvoiceNumber(invoiceNumber)}
            </button>
          );
        },
      }),
      invoiceColumnHelper.accessor('debit', {
        header: 'Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      invoiceColumnHelper.accessor('credit', {
        header: 'Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      invoiceColumnHelper.accessor('netDebt', {
        header: 'Net Debit',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : ''}>
              {value.toLocaleString('en-US')}
            </span>
          );
        },
      }),
      invoiceColumnHelper.accessor('matching', {
        header: 'Matching',
        cell: (info) => info.getValue() || '-',
      }),
      invoiceColumnHelper.accessor('residual', {
        header: 'Residual',
        cell: (info) => {
          const value = info.getValue();
          // If residual is present and not zero (with small epsilon), show it
          if (value !== undefined && Math.abs(value) > 0.01) {
            return (
              <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-800 font-bold">
                {value.toLocaleString('en-US')}
              </span>
            );
          }
          return null;
        },
      }),
    ],
    [filteredInvoices, selectedInvoiceIds]
  );

  // Overdue columns
  const overdueColumns = useMemo(
    () => [
      overdueColumnHelper.display({
        id: 'select',
        header: () => {
          const allSelected = filteredOverdueInvoices.length > 0 &&
            filteredOverdueInvoices.every(inv => selectedOverdueIds.has(inv.originalIndex));
          const someSelected = filteredOverdueInvoices.some(inv => selectedOverdueIds.has(inv.originalIndex));
          return (
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected && !allSelected;
              }}
              onChange={(e) => {
                if (e.target.checked) {
                  const newSelected = new Set(selectedOverdueIds);
                  filteredOverdueInvoices.forEach(inv => newSelected.add(inv.originalIndex));
                  setSelectedOverdueIds(newSelected);
                } else {
                  const newSelected = new Set(selectedOverdueIds);
                  filteredOverdueInvoices.forEach(inv => newSelected.delete(inv.originalIndex));
                  setSelectedOverdueIds(newSelected);
                }
              }}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          );
        },
        cell: (info) => {
          const inv = info.row.original;
          const isSelected = selectedOverdueIds.has(inv.originalIndex);
          return (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                const newSelected = new Set(selectedOverdueIds);
                if (e.target.checked) {
                  newSelected.add(inv.originalIndex);
                } else {
                  newSelected.delete(inv.originalIndex);
                }
                setSelectedOverdueIds(newSelected);
              }}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          );
        },
      }),
      overdueColumnHelper.accessor('date', {
        header: 'Date',
        cell: (info) => {
          const dateStr = info.getValue();
          if (!dateStr) return '';
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          return `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
        },
      }),
      overdueColumnHelper.display({
        id: 'type',
        header: 'Type',
        cell: (info) => {
          const inv = info.row.original;
          const type = getInvoiceType(inv);
          const color =
            type === 'Sales' ? 'bg-blue-100 text-blue-700' :
              type === 'Return' ? 'bg-orange-100 text-orange-700' :
                type === 'Payment' ? 'bg-green-100 text-green-700' :
                  type === 'Discount' ? 'bg-yellow-100 text-yellow-700' :
                    type === 'Our-Paid' ? 'bg-emerald-100 text-emerald-800' :
                      type === 'OB' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700';
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>
              {type}
            </span>
          );
        }
      }),
      overdueColumnHelper.accessor('number', {
        header: 'Number',
        cell: (info) => {
          const invoiceNumber = info.getValue();
          const row = info.row.original;
          return (
            <button
              onClick={() => setSelectedInvoice(row)}
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              title={invoiceNumber}
            >
              {shortenInvoiceNumber(invoiceNumber)}
            </button>
          );
        },
      }),
      overdueColumnHelper.accessor('debit', {
        header: 'Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      overdueColumnHelper.accessor('credit', {
        header: 'Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      overdueColumnHelper.accessor('difference', {
        header: 'Net Debt',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : ''}>
              {value.toLocaleString('en-US')}
            </span>
          );
        },
      }),
      overdueColumnHelper.accessor('matching', {
        header: 'Matching',
        cell: (info) => info.getValue() || '-',
      }),
      overdueColumnHelper.accessor('daysOverdue', {
        header: 'Days Overdue',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
              {value}
            </span>
          );
        },
      }),
    ],
    [filteredOverdueInvoices, selectedOverdueIds]
  );

  const invoiceTable = useReactTable({
    data: filteredInvoices,
    columns: invoiceColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting: invoiceSorting,
      pagination,
    },
    onSortingChange: setInvoiceSorting,
    onPaginationChange: setPagination,
  });



  const overdueTable = useReactTable({
    data: filteredOverdueInvoices,
    columns: overdueColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting: overdueSorting, pagination: overduePagination },
    onSortingChange: setOverdueSorting,
    onPaginationChange: setOverduePagination,
  });

  // Calculate totals based on selected invoices, or all if none selected
  const selectedInvoices = filteredInvoices.filter(inv => selectedInvoiceIds.has(inv.originalIndex));
  const totalNetDebt = selectedInvoices.length > 0
    ? selectedInvoices.reduce((sum, inv) => sum + inv.netDebt, 0)
    : agingData.total;
  const totalDebit = (selectedInvoices.length > 0 ? selectedInvoices : filteredInvoices).reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = (selectedInvoices.length > 0 ? selectedInvoices : filteredInvoices).reduce((sum, inv) => sum + inv.credit, 0);

  // Calculate totals for overdue invoices based on selected, or all if none selected
  const selectedOverdueInvoices = filteredOverdueInvoices.filter(inv => selectedOverdueIds.has(inv.originalIndex));
  const overdueToSum = selectedOverdueInvoices.length > 0 ? selectedOverdueInvoices : filteredOverdueInvoices;
  const overdueTotalDebit = overdueToSum.reduce((sum, inv) => sum + inv.debit, 0);
  const overdueTotalCredit = overdueToSum.reduce((sum, inv) => sum + inv.credit, 0);
  const overdueTotalDifference = overdueToSum.reduce((sum, inv) => sum + inv.difference, 0);

  // Calculate totals for each invoice type based on current filters (excluding type filters)
  const invoiceTypeTotals = useMemo(() => {
    let filtered = invoicesWithNetDebt;

    // Apply same filters as filteredInvoices but without type filters
    // Year Filter
    if (selectedYearFilter.length > 0) {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        return selectedYearFilter.includes(date.getFullYear().toString());
      });
    }

    // Month Filter
    if (selectedMonthFilter.length > 0) {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return selectedMonthFilter.includes(monthYear);
      });
    }

    // Overdue Month Filter
    if (selectedOverdueMonthFilter.length > 0) {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return selectedOverdueMonthFilter.includes(monthYear);
      });
    }

    // Matching Filter
    if (selectedMatchingFilter.length > 0) {
      const wantsAllOpen = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN);
      const wantsUnmatched = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED);
      const selectedIds = selectedMatchingFilter.filter(
        (m) => m !== MATCHING_FILTER_ALL_OPEN && m !== MATCHING_FILTER_ALL_UNMATCHED
      );

      filtered = filtered.filter((inv) => {
        if (!inv.matching) return wantsUnmatched;
        return (
          (wantsAllOpen && availableMatchingsWithResidual.includes(inv.matching)) ||
          (selectedIds.length > 0 && selectedIds.includes(inv.matching))
        );
      });
    }

    // Search Query
    if (invoiceSearchQuery.trim()) {
      const query = invoiceSearchQuery.toLowerCase();
      filtered = filtered.filter((inv) =>
        inv.number.toLowerCase().includes(query) ||
        inv.matching?.toLowerCase().includes(query) ||
        inv.date.toLowerCase().includes(query) ||
        inv.debit.toString().includes(query) ||
        inv.credit.toString().includes(query)
      );
    }

    // Calculate totals for each type
    let obTotal = 0;
    let salesTotal = 0;
    let returnsTotal = 0;
    let paymentsTotal = 0;
    let discountsTotal = 0;
    let jvTotal = 0;

    filtered.forEach((inv) => {
      const num = (inv.number || '').trim().toUpperCase();
      const netDebt = inv.netDebt;

      if (num.startsWith('OB')) {
        obTotal += netDebt;
      } else if (num.startsWith('SAL') && inv.debit > 0) {
        salesTotal += netDebt;
      } else if (num.startsWith('RSAL') && inv.credit > 0) {
        returnsTotal += netDebt;
      } else if (num.startsWith('BIL')) {
        discountsTotal += netDebt;
      } else if (num.startsWith('JV')) {
        jvTotal += netDebt;
      } else if (isPaymentTxn(inv)) {
        paymentsTotal += netDebt;
      }
    });

    return {
      ob: obTotal,
      sales: salesTotal,
      returns: returnsTotal,
      payments: paymentsTotal,
      discounts: discountsTotal,
      jv: jvTotal,
      overdue: overdueTotalDifference
    };
  }, [invoicesWithNetDebt, selectedYearFilter, selectedMonthFilter, selectedOverdueMonthFilter, selectedMatchingFilter, invoiceSearchQuery, availableMatchingsWithResidual, startDateFilter, endDateFilter, overdueTotalDifference]);



  // Aging totals (initialized later after dashboardMetrics to avoid TDZ)

  const toggleMonthSelection = (month: string) => {
    setSelectedMonths(prev =>
      prev.includes(month)
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const toggleAllMonths = () => {
    if (selectedMonths.length === availableMonths.length) {
      setSelectedMonths([]);
    } else {
      setSelectedMonths(availableMonths);
    }
  };

  const handleDirectExport = async () => {
    try {
      // 1. Start with all invoices (Net Debt is already calculated in invoicesWithNetDebt)
      let finalInvoices = [...invoicesWithNetDebt];

      if (finalInvoices.length === 0) {
        alert('No invoices to export.');
        return;
      }

      // 2. Filter for "Net Only" using the condensed logic
      // This keeps only unmatched invoices OR the single "residual holder" invoice for open matching groups
      finalInvoices = finalInvoices.filter(inv => {
        // Keep if no matching ID (Unmatched)
        if (!inv.matching) return true;

        // Keep only if it carries the residual (which means it's the main open invoice of an open group)
        return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
      }).map(inv => {
        if (inv.matching && inv.residual !== undefined) {
          // It's a condensed open invoice
          // Calculate "Paid" amount to show in Credit
          // Credit = Debit - Residual
          return {
            ...inv,
            credit: inv.debit - inv.residual,
            netDebt: inv.residual
          };
        }
        return inv;
      });

      if (finalInvoices.length === 0) {
        alert('No open/unmatched invoices to export.');
        return;
      }

      const monthsLabel = 'All Months (Net Only)';

      const { generateAccountStatementPDF } = await import('@/lib/pdf/PdfUtils');
      await generateAccountStatementPDF(customerName, finalInvoices, false, monthsLabel, shortenInvoiceNumbers);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const exportToExcel = (invoicesToExport: any[], monthsLabel: string) => {
    const headers = ['Date', 'Type', 'Invoice Number', 'Debit', 'Credit', 'Net Debt'];

    const rows = invoicesToExport.map(inv => {
      const dateStr = inv.date ? (() => {
        const d = new Date(inv.date);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      })() : '';

      let type = getInvoiceType(inv);
      if (inv.date && (['Sales', 'Return', 'Discount', 'Payment', 'R-Payment', 'Our-Paid'].includes(type))) {
        const d = new Date(inv.date);
        if (!isNaN(d.getTime())) {
          const yy = d.getFullYear().toString().slice(-2);
          let base = type === 'Sales' ? 'Sale' : type;
          type = `${base} ${yy}`;
        }
      }

      let invoiceNumber = inv.number || '';
      if (shortenInvoiceNumbers && invoiceNumber) {
        invoiceNumber = invoiceNumber.split(' ')[0];
      }

      return [
        dateStr,
        type,
        invoiceNumber,
        inv.debit || 0,
        inv.credit || 0,
        inv.netDebt || 0
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Account Statement');

    // Auto-size columns
    const colWidths = [15, 15, 20, 12, 12, 12];
    worksheet['!cols'] = colWidths.map(w => ({ wch: w }));

    const safeName = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim();
    const fileName = `${safeName}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const handleExport = async () => {
    try {
      let finalInvoices = [];
      let monthsLabel = 'All Months';

      if (exportScope === 'view') {
        finalInvoices = filteredInvoices;
        monthsLabel = 'Filtered View';

        // If filtering by month, use that name
        if (selectedMonthFilter.length > 0) {
          if (selectedMonthFilter.length === 1) {
            monthsLabel = selectedMonthFilter[0];
          } else {
            monthsLabel = selectedMonthFilter.join(', ');
          }
        } else if (selectedMonths.length < availableMonths.length && selectedMonths.length > 0) {
          // If view was constructed differently but matches months logic
        }

        if (selectedMatchingFilter.length > 0) {
          if (selectedMatchingFilter.length === 1) {
            monthsLabel += ` - ${selectedMatchingFilter[0]}`;
          } else {
            monthsLabel += ` - ${selectedMatchingFilter.join(', ')}`;
          }
        }

        if (invoiceSearchQuery) {
          monthsLabel += ` (Search: ${invoiceSearchQuery})`;
        }
      } else if (exportScope === 'selection') {
        const isOverdueTab = activeTab === 'overdue';
        const selectedIds = isOverdueTab ? selectedOverdueIds : selectedInvoiceIds;
        const sourceList = isOverdueTab ? overdueInvoices : invoicesWithNetDebt;

        if (selectedIds.size === 0) {
          alert('Please select at least one transaction to export.');
          return;
        }

        finalInvoices = sourceList.filter(inv => selectedIds.has(inv.originalIndex));
        monthsLabel = 'Selected Transactions';

      } else {
        // Custom Selection Logic
        finalInvoices = invoicesWithNetDebt.filter(inv => {
          if (!inv.date) return false;
          const date = new Date(inv.date);
          if (isNaN(date.getTime())) return false;
          const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          return selectedMonths.includes(monthYear);
        });

        if (finalInvoices.length === 0) {
          alert('Please select at least one month to export.');
          return;
        }

        if (selectedMonths.length < availableMonths.length) {
          const sortedSelectedMonths = [...selectedMonths].sort((a, b) => {
            const dateA = new Date(`1 ${a}`);
            const dateB = new Date(`1 ${b}`);
            return dateB.getTime() - dateA.getTime();
          });
          monthsLabel = sortedSelectedMonths.join(', ');
        }
      }

      // Apply Net Only filter/transformation if selected
      if (pdfExportType === 'net') {
        finalInvoices = toNetOnlyOpenInvoices(finalInvoices);
        if (!monthsLabel.includes('(Net Only)')) {
          monthsLabel += ' (Net Only)';
        }
      }

      if (exportFormat === 'excel') {
        // Export to Excel
        exportToExcel(finalInvoices, monthsLabel);
      } else {
        // Export to PDF
        const { generateAccountStatementPDF } = await import('@/lib/pdf/PdfUtils');
        await generateAccountStatementPDF(customerName, finalInvoices, false, monthsLabel, shortenInvoiceNumbers);
      }

      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting:', error);
      alert(`Error exporting to ${exportFormat.toUpperCase()}. Please try again.`);
    }
  };

  const generateAnalyticalPDF = async () => {
    try {
      await generateAnalyticalPDFUtil({
        customerName,
        filteredInvoices,
        totalNetDebt,
        dashboardMetrics,
        monthlyPaymentsTrendData,
        monthlySalesTrendData,
        filteredOverdueInvoices
      });
    } catch (error) {
      console.error('Error generating analytical PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };
  const [isGeneratingAutoReport, setIsGeneratingAutoReport] = useState(!!downloadAction);

  // Trigger auto-download if requested via URL
  useEffect(() => {
    if (downloadAction === 'download_report' && !hasDownloadedReport.current && invoices.length > 0) {
      hasDownloadedReport.current = true;

      const performAutoDownload = async () => {
        // Wait a bit for everything to stabilize
        await new Promise(r => setTimeout(r, 1000));

        try {
          await generateAnalyticalPDF();

          // After successful download, attempt to close or go back
          setTimeout(() => {
            if (window.opener) {
              window.close();
            } else {
              window.history.back();
            }
          }, 500);
        } catch (e) {
          console.error("Auto download failed", e);
          setIsGeneratingAutoReport(false); // Show UI on error
        }
      };

      performAutoDownload();
    }
  }, [downloadAction, invoices]);

  // Calculate Dashboard Metrics
  const dashboardMetrics = useMemo(() => {
    const totalSales = filteredInvoices.reduce((acc, inv) => acc + inv.debit, 0);
    const totalPaid = filteredInvoices.reduce((acc, inv) => acc + inv.credit, 0);
    const collectionRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;

    // Breakdown for collection analysis
    const salesDebit = filteredInvoices.reduce((sum, inv) => {
      const num = inv.number.toUpperCase();
      return num.startsWith('SAL') ? sum + inv.debit : sum;
    }, 0);

    const returnsAmount = filteredInvoices.reduce((sum, inv) => {
      const num = inv.number.toUpperCase();
      return num.startsWith('RSAL') ? sum + inv.credit : sum;
    }, 0);

    const discountsAmount = filteredInvoices.reduce((sum, inv) => {
      const num = inv.number.toUpperCase();
      return num.startsWith('BIL') ? sum + inv.credit : sum;
    }, 0);

    const paymentsAmount = filteredInvoices.reduce((sum, inv) => {
      const num = inv.number.toUpperCase();
      // Strict Payment: Only 'BNK'
      if (!num.startsWith('BNK')) return sum;
      return sum + getPaymentAmount(inv);
    }, 0);

    const paymentsCoverage = salesDebit > 0 ? (paymentsAmount / salesDebit) * 100 : 0;
    const returnsImpact = salesDebit > 0 ? (returnsAmount / salesDebit) * 100 : 0;
    const discountsImpact = salesDebit > 0 ? (discountsAmount / salesDebit) * 100 : 0;

    const netBase = salesDebit - returnsAmount - discountsAmount;
    const paymentsNetCoverage = netBase > 0 ? (paymentsAmount / netBase) * 100 : 0;

    const dates = filteredInvoices
      .map(inv => inv.date ? new Date(inv.date).getTime() : 0)
      .filter(t => t > 0);
    const lastActivity = dates.length > 0 ? new Date(Math.max(...dates)) : null;

    const overdueAmount = filteredOverdueInvoices.reduce((acc, inv) => acc + inv.difference, 0);
    const overdueCount = filteredOverdueInvoices.length;

    // Calculate Last Payment
    // Filter out non-payment transaction types - Strict 'BNK' only
    const paymentInvoices = filteredInvoices.filter((inv) => inv.number.toUpperCase().startsWith('BNK'));

    let lastPaymentAmount = 0;
    let lastPaymentDate = null;

    let lastPaymentInvoice: any = null;
    if (paymentInvoices.length > 0) {
      // Sort by date descending (newest first)
      const sortedPayments = [...paymentInvoices].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
      lastPaymentInvoice = sortedPayments[0] || null;
      // User-requested: Last Payment amount should be Credit - Debit
      lastPaymentAmount = lastPaymentInvoice ? getPaymentAmount(lastPaymentInvoice) : 0;
      lastPaymentDate = lastPaymentInvoice ? new Date(lastPaymentInvoice.date) : null;
    }

    // Calculate Average Payment Interval using unique dates
    const uniquePaymentDates = new Set<string>();
    filteredInvoices.forEach(inv => {
      if (isPaymentTxn(inv)) {
        const date = inv.parsedDate || (inv.date ? new Date(inv.date) : null);
        if (date && !isNaN(date.getTime())) {
          uniquePaymentDates.add(date.toISOString().split('T')[0]);
        }
      }
    });

    let avgPaymentInterval = 0;
    if (uniquePaymentDates.size > 1) {
      const sortedDates = Array.from(uniquePaymentDates)
        .map(d => new Date(d))
        .sort((a, b) => a.getTime() - b.getTime());

      const firstDate = sortedDates[0];
      const lastDate = sortedDates[sortedDates.length - 1];
      const totalDays = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      avgPaymentInterval = totalDays / (sortedDates.length - 1);
    }

    // Calculate Total Payments
    const totalPayments = paymentInvoices.reduce((acc, inv) => acc + getPaymentAmount(inv), 0);

    // Calculate Average Monthly Sales
    // Logic: (Sum(SAL) - Sum(RSAL)) / Span in Months
    const salesInvoices = filteredInvoices.filter(inv => inv.number.toUpperCase().startsWith('SAL'));
    const returnInvoices = filteredInvoices.filter(inv => inv.number.toUpperCase().startsWith('RSAL'));

    const totalSalesAmount = salesInvoices.reduce((sum, inv) => sum + inv.debit, 0);
    const totalReturnsAmount = returnInvoices.reduce((sum, inv) => sum + inv.credit, 0);

    const netSales = totalSalesAmount - totalReturnsAmount;

    // Lifetime Smart Sales (SAL - RSAL)
    const lifetimeSmartSales = netSales;

    // Lifetime Smart Payments (Strict BNK)
    const smartPaymentInvoices = filteredInvoices.filter((inv) => inv.number.toUpperCase().startsWith('BNK'));
    const lifetimeSmartPayments = smartPaymentInvoices.reduce((sum, inv) => sum + getPaymentAmount(inv), 0);

    // Duration
    // Find earliest date and latest date among these specific transactions
    const allRelevantInvoices = [...salesInvoices, ...returnInvoices];
    let monthsDuration = 1;

    if (allRelevantInvoices.length > 0) {
      const dates = allRelevantInvoices.map(inv => inv.date ? new Date(inv.date).getTime() : 0).filter(t => t > 0);
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        // Difference in months (inclusive)
        monthsDuration = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + (maxDate.getMonth() - minDate.getMonth()) + 1;
        if (monthsDuration < 1) monthsDuration = 1;
      }
    }

    const averageMonthlySales = netSales / monthsDuration;

    // Aging Data for Chart
    const pieData = [
      { name: 'Current', value: agingData.atDate, color: '#10B981' }, // Green
      { name: '1-30 Days', value: agingData.oneToThirty, color: '#3B82F6' }, // Blue
      { name: '31-60 Days', value: agingData.thirtyOneToSixty, color: '#8B5CF6' }, // Purple
      { name: '61-90 Days', value: agingData.sixtyOneToNinety, color: '#F59E0B' }, // Yellow/Amber
      { name: '91-120 Days', value: agingData.ninetyOneToOneTwenty, color: '#F97316' }, // Orange
      { name: 'Older', value: agingData.older, color: '#EF4444' }, // Red
    ].filter(d => d.value > 0.01);

    // 90 Days Stats for Rating
    const now = new Date();
    const since90 = new Date();
    since90.setDate(now.getDate() - 90);
    const isInLast90 = (dateStr?: string | null) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= since90 && d <= now;
    };

    const salesInvoices90 = filteredInvoices.filter(inv => inv.number?.toUpperCase().startsWith('SAL') && isInLast90(inv.date));
    const sales3m = salesInvoices90.reduce((sum, inv) => sum + inv.debit, 0);
    const salesCount3m = salesInvoices90.length;

    const paymentInvoices90 = filteredInvoices.filter(inv => isPaymentTxn(inv) && isInLast90(inv.date));
    const payments3m = paymentInvoices90.reduce((s, inv) => s + getPaymentAmount(inv), 0);

    const paymentsCount3m = (() => {
      const creditCount = paymentInvoices90.filter(inv => (inv.credit || 0) > 0.01).length;
      const debitCount = paymentInvoices90.filter(inv => (inv.debit || 0) > 0.01).length;
      return creditCount - debitCount;
    })();

    return {
      totalSales,
      totalPaid,
      collectionRate,
      lastActivity,
      overdueAmount,
      overdueCount,
      totalPayments,
      lastPaymentAmount,
      lastPaymentDate,
      salesDebit,
      returnsAmount,
      discountsAmount,
      paymentsAmount,
      paymentsCoverage,
      returnsImpact,
      discountsImpact,
      paymentsNetCoverage,
      lastPaymentInvoice,
      averageMonthlySales,
      lifetimeSmartSales,
      lifetimeSmartPayments,
      totalSalesSum: totalSalesAmount,
      totalReturnsSum: totalReturnsAmount,
      netSalesSum: netSales,
      netBase,
      pieData,
      sales3m,
      salesCount3m,
      payments3m,
      paymentsCount3m,
      avgPaymentInterval
    };
  }, [filteredInvoices, filteredOverdueInvoices, agingData]);

  // Use the sum of pieData to keep chart and pills perfectly aligned
  const agingTotal = useMemo(
    () => dashboardMetrics.pieData.reduce((sum, item) => sum + item.value, 0),
    [dashboardMetrics.pieData],
  );

  const stackedAgingData = useMemo(() => {
    const row: Record<string, number | string> = { label: 'Aging' };
    dashboardMetrics.pieData.forEach((entry, idx) => {
      row[`bucket-${idx}`] = entry.value;
    });
    return [row];
  }, [dashboardMetrics.pieData]);

  const agingBuckets = useMemo(
    () =>
      dashboardMetrics.pieData.map((entry, idx) => {
        const percent = agingTotal > 0 ? (entry.value / agingTotal) * 100 : 0;
        return {
          ...entry,
          percent,
          dataKey: `bucket-${idx}`,
        };
      }),
    [dashboardMetrics.pieData, agingTotal],
  );

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const sharedProps = {
    customerName,
    invoices,
    filteredInvoices,
    overdueInvoices,
    filteredOverdueInvoices,
    monthlyDebt,
    last12MonthsBase,
    monthlyPaymentsTrendData,
    monthlySalesTrendData,
    paymentGradientOffset,
    agingData,
    notes,
    dashboardMetrics,
    totalNetDebt,
    totalDebit,
    totalCredit,
    invoiceTable,
    overdueTable,
    overdueTotalDebit,
    overdueTotalCredit,
    overdueTotalDifference,
    activeTab,
    setActiveTab,
    invoiceSorting,
    setInvoiceSorting,
    overdueSorting,
    setOverdueSorting,
    invoiceSearchQuery,
    setInvoiceSearchQuery,
    pagination,
    setPagination,
    overduePagination,
    setOverduePagination,
    showCollectionModal,
    setShowCollectionModal,
    selectedYearFilter,
    setSelectedYearFilter,
    isYearDropdownOpen,
    setIsYearDropdownOpen,
    selectedMonthFilter,
    setSelectedMonthFilter,
    isMonthDropdownOpen,
    setIsMonthDropdownOpen,
    selectedOverdueMonthFilter,
    setSelectedOverdueMonthFilter,
    isOverdueMonthDropdownOpen,
    setIsOverdueMonthDropdownOpen,
    selectedMatchingFilter,
    setSelectedMatchingFilter,
    isMatchingDropdownOpen,
    setIsMatchingDropdownOpen,
    startDateFilter,
    setStartDateFilter,
    endDateFilter,
    setEndDateFilter,
    selectedInvoiceIds,
    setSelectedInvoiceIds,
    selectedOverdueIds,
    setSelectedOverdueIds,
    showOB,
    setShowOB,
    showSales,
    setShowSales,
    showReturns,
    setShowReturns,
    showPayments,
    setShowPayments,
    showDiscounts,
    setShowDiscounts,
    showJV,
    setShowJV,
    showExportModal,
    setShowExportModal,
    selectedMonths,
    setSelectedMonths,
    pdfExportType,
    setPdfExportType,
    exportScope,
    setExportScope,
    exportFormat,
    setExportFormat,
    shortenInvoiceNumbers,
    setShortenInvoiceNumbers,
    loadingNotes,
    newNote,
    setNewNote,
    editingNoteId,
    setEditingNoteId,
    editingNoteContent,
    setEditingNoteContent,
    currentUserName: '',
    customerEmails: [],
    emailCustomers: [],
    closedCustomers: new Set<string>(),
    selectedInvoice,
    setSelectedInvoice,
    spiData: [],
    invoicesWithNetDebt,
    availableMatchingsWithResidual: [],
    availableMonths: [],
    availableYears: [],
    availableOverdueMonths: [],
    invoiceTypeTotals,
    handleEmail: () => { },
    handleAddNote,
    handleUpdateNote,
    handleDeleteNote,
    toggleYearSelection: () => { },
    newNoteRef,
    editNoteRef,
    MATCHING_FILTER_ALL_OPEN: 'ALL_OPEN',
    MATCHING_FILTER_ALL_UNMATCHED: 'ALL_UNMATCHED',
  } as any;
  return (
    <>
      {isGeneratingAutoReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800">Generating Analysis Report...</h2>
          <p className="text-gray-500 mt-2">Please wait while we prepare your download.</p>
        </div>
      )}
      <div className={`p-6 ${isGeneratingAutoReport ? 'opacity-0 h-0 overflow-hidden' : ''}`}>
        {/* Payment Details Modal */}
        <PaymentModal
          show={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          dashboardMetrics={dashboardMetrics}
        />

        <CollectionModal
          show={showCollectionModal}
          onClose={() => setShowCollectionModal(false)}
          dashboardMetrics={dashboardMetrics}
        />

        <InvoiceDetailModal
          selectedInvoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />

        <ExportModal
          show={showExportModal}
          onClose={() => setShowExportModal(false)}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          exportScope={exportScope}
          setExportScope={setExportScope}
          pdfExportType={pdfExportType}
          setPdfExportType={setPdfExportType}
          shortenInvoiceNumbers={shortenInvoiceNumbers}
          setShortenInvoiceNumbers={setShortenInvoiceNumbers}
          availableYears={availableYears}
          availableMonths={availableMonths}
          selectedMonths={selectedMonths}
          setSelectedMonths={setSelectedMonths}
          filteredInvoices={filteredInvoices}
          handleExport={handleExport}
          toggleAllMonths={toggleAllMonths}
          toggleMonthSelection={toggleMonthSelection}
          toggleYearSelection={toggleYearSelection}
        />

        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center" title="Back to Customers">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setShowExportModal(true)} className="h-10 w-10 flex items-center justify-center bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-sm group" title="Export Report (Combined)">
              <FileText className="h-5 w-5 transition-transform group-hover:scale-110" />
            </button>
            <button onClick={() => generateAnalyticalPDF()} className="h-10 w-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm group" title="Analytical PDF Report">
              <BarChart3 className="h-5 w-5 transition-transform group-hover:scale-110" />
            </button>
            {customerEmails.length > 0 && (
              <button onClick={handleEmail} className="h-10 w-10 flex items-center justify-center bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-sm group" title="Email Statement">
                <Mail className="h-5 w-5 transition-transform group-hover:scale-110" />
              </button>
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold mb-2">{customerName}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-gray-600">
              {(() => {
                const salesReps = new Set<string>();
                invoices.forEach(inv => { if (inv.salesRep && inv.salesRep.trim()) { salesReps.add(inv.salesRep.trim()); } });
                const salesRepsArray = Array.from(salesReps).sort();
                return <span>{salesRepsArray.length > 0 ? salesRepsArray.join(', ') : 'No Sales Rep'}</span>;
              })()}
            </div>
          </div>
        </div>

        <FilterBar
          invoiceSearchQuery={invoiceSearchQuery}
          setInvoiceSearchQuery={setInvoiceSearchQuery}
          startDateFilter={startDateFilter}
          setStartDateFilter={setStartDateFilter}
          endDateFilter={endDateFilter}
          setEndDateFilter={setEndDateFilter}
          availableYears={availableYears}
          selectedYearFilter={selectedYearFilter}
          setSelectedYearFilter={setSelectedYearFilter}
          isYearDropdownOpen={isYearDropdownOpen}
          setIsYearDropdownOpen={setIsYearDropdownOpen}
          availableMonths={availableMonths}
          selectedMonthFilter={selectedMonthFilter}
          setSelectedMonthFilter={setSelectedMonthFilter}
          isMonthDropdownOpen={isMonthDropdownOpen}
          setIsMonthDropdownOpen={setIsMonthDropdownOpen}
          availableOverdueMonths={availableOverdueMonths}
          selectedOverdueMonthFilter={selectedOverdueMonthFilter}
          setSelectedOverdueMonthFilter={setSelectedOverdueMonthFilter}
          isOverdueMonthDropdownOpen={isOverdueMonthDropdownOpen}
          setIsOverdueMonthDropdownOpen={setIsOverdueMonthDropdownOpen}
          availableMatchingsWithResidual={availableMatchingsWithResidual}
          selectedMatchingFilter={selectedMatchingFilter}
          setSelectedMatchingFilter={setSelectedMatchingFilter}
          isMatchingDropdownOpen={isMatchingDropdownOpen}
          setIsMatchingDropdownOpen={setIsMatchingDropdownOpen}
          MATCHING_FILTER_ALL_OPEN={MATCHING_FILTER_ALL_OPEN}
          MATCHING_FILTER_ALL_UNMATCHED={MATCHING_FILTER_ALL_UNMATCHED}
          showOB={showOB} setShowOB={setShowOB}
          showSales={showSales} setShowSales={setShowSales}
          showReturns={showReturns} setShowReturns={setShowReturns}
          showPayments={showPayments} setShowPayments={setShowPayments}
          showDiscounts={showDiscounts} setShowDiscounts={setShowDiscounts}
          showJV={showJV} setShowJV={setShowJV}
          invoiceTypeTotals={invoiceTypeTotals}
        />

        <TabsNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notesCount={notes.length}
        />


        {/* Tab Content: Dashboard */}
        {activeTab === 'dashboard' && <DashboardTab {...sharedProps} />}

        {/* Tab Content: Invoices */}
        {activeTab === 'invoices' && <InvoicesTab {...sharedProps} />}

        {/* Tab Content: Overdue */}
        {activeTab === 'overdue' && <OverdueTab {...sharedProps} />}

        {/* Tab Content: Monthly Debt */}
        {activeTab === 'monthly' && <MonthlyTab {...sharedProps} />}

        {/* Tab Content: Ages */}
        {activeTab === 'ages' && <AgesTab {...sharedProps} />}

        {/* Tab Content: Notes */}
        {activeTab === 'notes' && <NotesTab {...sharedProps} />}
      </div>
    </>
  );
}
