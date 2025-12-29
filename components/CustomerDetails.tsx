'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
import { Mail, FileText, Calendar, ArrowLeft } from 'lucide-react';

interface CustomerDetailsProps {
  customerName: string;
  invoices: InvoiceRow[];
  onBack: () => void;
  initialTab?: 'dashboard' | 'invoices' | 'monthly' | 'ages' | 'notes' | 'overdue';
}

interface InvoiceWithNetDebt extends InvoiceRow {
  netDebt: number;
  residual?: number;
  originalIndex: number;
  parsedDate: Date | null;
}

interface MonthlyDebt {
  year: string;
  month: string;
  debit: number;
  credit: number;
  netDebt: number;
}

interface AgingSummary {
  atDate: number;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
  total: number;
}

interface OverdueInvoice extends InvoiceRow {
  netDebt: number;
  residual?: number;
  daysOverdue: number;
  difference: number;
  originalIndex: number;
  parsedDate: Date | null;
}

const invoiceColumnHelper = createColumnHelper<InvoiceWithNetDebt>();
const overdueColumnHelper = createColumnHelper<OverdueInvoice>();
const monthlyColumnHelper = createColumnHelper<MonthlyDebt>();

const normalizeCustomerKey = (name: string): string =>
  name.toString().toLowerCase().trim().replace(/\s+/g, ' ');

// Helper function to determine invoice type - matches logic from CustomersOpenMatchesTab
const getInvoiceTypeFromRow = (inv: { number?: string | null; credit?: number | null }): string => {
  const num = (inv.number || '').toUpperCase();
  const credit = inv.credit ?? 0;

  if (num.startsWith('OB')) {
    return 'OB';
  } else if (num.startsWith('BNK')) {
    // Bank transfers should be treated as payments
    return 'Payment';
  } else if (num.startsWith('SAL')) {
    return 'Sales';
  } else if (num.startsWith('RSAL')) {
    return 'Return';
  } else if (num.startsWith('JV') || num.startsWith('BIL')) {
    return 'Discount';
  } else if (credit > 0.01) {
    return 'Payment';
  }
  return 'Invoice/Txn';
};

// Helper to identify payment transactions consistently
const isPaymentTxn = (inv: { number?: string | null; credit?: number | null }): boolean => {
  const num = (inv.number || '').toUpperCase();
  if (num.startsWith('BNK')) return true;
  if ((inv.credit || 0) <= 0.01) return false;
  return (
    !num.startsWith('SAL') &&
    !num.startsWith('RSAL') &&
    !num.startsWith('BIL') &&
    !num.startsWith('JV') &&
    !num.startsWith('OB')
  );
};

// Helper to calculate payment amount consistently (Credit - Debit)
const getPaymentAmount = (inv: { credit?: number | null; debit?: number | null }): number => {
  const credit = inv.credit || 0;
  const debit = inv.debit || 0;
  return credit - debit;
};

// Parse dates from Google Sheets while preserving original order for invalid dates
const parseInvoiceDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;

  // Fallback for DD/MM/YYYY or DD-MM-YYYY
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts.map((p) => parseInt(p, 10));
    if (p1 > 12 || p3 > 31) {
      const parsed = new Date(p3, (p2 || 1) - 1, p1);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
};

// Helper function to shorten invoice numbers
const shortenInvoiceNumber = (invoiceNumber: string | undefined | null, maxLength: number = 18): string => {
  if (!invoiceNumber) return '';

  // Remove trailing parenthetical info like "(INVOICE NO.2004)"
  const cleaned = invoiceNumber.replace(/\s*\(.*?\)\s*$/, '').trim();
  const upper = cleaned.toUpperCase();

  // If it is a structured sales/returns/billing/journal number, keep it fully visible
  if (upper.startsWith('SAL') || upper.startsWith('RSAL') || upper.startsWith('BIL') || upper.startsWith('JV')) {
    // Strip any trailing descriptive text after the structured number (e.g., "JV/2025/09/0315 Transfer ...")
    const mainPart = cleaned.split(/\s+/)[0];
    return mainPart;
  }

  if (cleaned.length <= maxLength) return cleaned;
  
  // Try to keep prefix and suffix if it looks like a structured number
  // e.g., "ABC-2024-00123" -> "ABC...123"
  const parts = cleaned.split(/[-_]/);
  if (parts.length >= 2) {
    const prefix = parts[0];
    const suffix = parts[parts.length - 1];
    if (prefix.length + suffix.length + 3 <= maxLength) {
      return `${prefix}...${suffix}`;
    }
  }
  
  // Otherwise, keep a longer head/tail chunk
  const head = cleaned.substring(0, Math.max(6, maxLength - 10));
  const tail = cleaned.substring(cleaned.length - 6);
  return `${head}...${tail}`;
};

// Helper function to convert URLs in text to clickable links
const renderNoteWithLinks = (text: string) => {
  // Regular expression to match URLs (http, https, www, or plain domain)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
  
  const parts: (string | React.JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add the URL as a clickable link
    let url = match[0];
    // Add https:// if it starts with www.
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    // Add https:// if it doesn't start with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {match[0]}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
};

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'monthly' | 'ages' | 'notes' | 'overdue'>(initialTab);
  const [invoiceSorting, setInvoiceSorting] = useState<SortingState>([]);
  const [overdueSorting, setOverdueSorting] = useState<SortingState>([]);
  const [monthlySorting, setMonthlySorting] = useState<SortingState>([]);
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
  
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string[]>([]);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [selectedMatchingFilter, setSelectedMatchingFilter] = useState<string[]>([]);
  const [isMatchingDropdownOpen, setIsMatchingDropdownOpen] = useState(false);
  
  // Selected invoices for checkboxes (using originalIndex as unique identifier)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());
  const [selectedOverdueIds, setSelectedOverdueIds] = useState<Set<number>>(new Set());
  
  // Invoice Type Filters
  const [showOB, setShowOB] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showDiscounts, setShowDiscounts] = useState(false);

  // PDF Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'combined' | 'separated'>('combined');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [pdfExportType, setPdfExportType] = useState<'all' | 'net'>('all');
  const [exportScope, setExportScope] = useState<'custom' | 'view'>('custom');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');

  // Notes State
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  
  // Users with restricted access
  const restrictedUsers = ['Mahmoud Shaker', 'Mr. Shady'];
  const isRestrictedUser = restrictedUsers.includes(currentUserName);
  const [customerEmails, setCustomerEmails] = useState<string[]>([]);
  const [emailCustomers, setEmailCustomers] = useState<string[]>([]);

  // Notes textarea auto-resize (grow with content; only scroll after max height)
  const newNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const editNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const NOTES_TEXTAREA_MAX_HEIGHT = 360; // px

  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, NOTES_TEXTAREA_MAX_HEIGHT);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > NOTES_TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
  };

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
      const ccEmails = ['shady@aladraj.ae', 'altayfy@marae.ae'].join(', ');

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
      const { generateAccountStatementPDF } = await import('@/lib/pdfUtils');

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
</body>
</html>`;
      const emlLines: string[] = [];
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

  // Prepare invoices data with Net Debt and Residual
  const invoicesWithNetDebt = useMemo(() => {
    // 1. Calculate totals for each matching group
    const matchingTotals = new Map<string, number>();
    
    invoices.forEach(inv => {
      if (inv.matching) {
         const currentTotal = matchingTotals.get(inv.matching) || 0;
         matchingTotals.set(inv.matching, currentTotal + (inv.debit - inv.credit));
      }
    });

    // 2. Find the index of the row with the largest DEBIT for each matching code
    const targetResidualIndices = new Map<string, number>();
    const maxDebits = new Map<string, number>();

    invoices.forEach((inv, index) => {
      if (inv.matching) {
        const currentMax = maxDebits.get(inv.matching) ?? -1;
        // Update if we find a larger debit
        // If debits are equal, we keep the first one found (strict greater than)
        if (inv.debit > currentMax) {
          maxDebits.set(inv.matching, inv.debit);
          targetResidualIndices.set(inv.matching, index);
        } else if (!targetResidualIndices.has(inv.matching)) {
           // Ensure at least one index is set (e.g. if all debits are 0)
           maxDebits.set(inv.matching, inv.debit);
           targetResidualIndices.set(inv.matching, index);
        }
      }
    });

    // 3. Map invoices preserving original order from Google Sheets
    return invoices.map((invoice, index) => {
      let residual: number | undefined = undefined;
      const parsedDate = parseInvoiceDate(invoice.date);

      if (invoice.matching) {
        const targetIndex = targetResidualIndices.get(invoice.matching);
        // Show residual only on the invoice with the largest debit
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
          difference,
          daysOverdue
        } as OverdueInvoice;
      });
  }, [invoicesWithNetDebt]);

  // Filter invoices based on selected month filter, matching filter, and search query
  const filteredInvoices = useMemo(() => {
    let filtered = invoicesWithNetDebt;
    
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
    const hasAnyFilter = showOB || showSales || showReturns || showPayments || showDiscounts;
    if (hasAnyFilter) {
      filtered = filtered.filter((inv) => {
        const num = inv.number.toUpperCase();
        
        if (showOB && num.startsWith('OB')) return true;
        if (showSales && num.startsWith('SAL') && inv.debit > 0) return true;
        if (showReturns && num.startsWith('RSAL') && inv.credit > 0) return true;
        if (showDiscounts && (num.startsWith('JV') || num.startsWith('BIL'))) return true;
        if (showPayments) {
          // Treat BNK* as payments even if credit isn't populated as expected
          if (num.startsWith('BNK') && ((inv.credit || 0) > 0.01 || (inv.debit || 0) > 0.01)) return true;
          // Payments: credit transactions excluding SAL, RSAL, BIL, JV, OB
          if (inv.credit > 0.01 && 
              !num.startsWith('SAL') && 
              !num.startsWith('RSAL') && 
              !num.startsWith('BIL') && 
              !num.startsWith('JV') &&
              !num.startsWith('OB')) {
            return true;
          }
        }
        return false;
      });
    }
    
    // Keep the same row order as the exported PDF (which follows the original sheet order),
    // while still allowing interactive sorting via the table headers.
    return [...filtered].sort(
      (a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0),
    );
  }, [invoicesWithNetDebt, selectedMonthFilter, selectedMatchingFilter, invoiceSearchQuery, showOB, showSales, showReturns, showPayments, showDiscounts]);

  // Calculate totals for each invoice type based on current filters (excluding type filters)
  const invoiceTypeTotals = useMemo(() => {
    let filtered = invoicesWithNetDebt;
    
    // Apply same filters as filteredInvoices but without type filters
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

    filtered.forEach((inv) => {
      const num = inv.number.toUpperCase();
      const netDebt = inv.netDebt;
      const type = getInvoiceTypeFromRow(inv);

      if (num.startsWith('OB')) {
        obTotal += netDebt;
      } else if (num.startsWith('SAL') && inv.debit > 0) {
        salesTotal += netDebt;
      } else if (num.startsWith('RSAL') && inv.credit > 0) {
        returnsTotal += netDebt;
      } else if (num.startsWith('JV') || num.startsWith('BIL')) {
        discountsTotal += netDebt;
      } else if (isPaymentTxn(inv)) {
        // Payments checkbox total: Credit - Debit
        paymentsTotal += getPaymentAmount(inv);
      }
    });

    return {
      ob: obTotal,
      sales: salesTotal,
      returns: returnsTotal,
      payments: paymentsTotal,
      discounts: discountsTotal,
    };
  }, [invoicesWithNetDebt, selectedMonthFilter, selectedMatchingFilter, invoiceSearchQuery, availableMatchingsWithResidual]);

  // Filter overdue invoices based on selected month filter, matching filter, and search query
  const filteredOverdueInvoices = useMemo(() => {
    let filtered = overdueInvoices;
    
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
    const hasAnyFilter = showOB || showSales || showReturns || showPayments || showDiscounts;
    if (hasAnyFilter) {
      filtered = filtered.filter((inv) => {
        const num = inv.number.toUpperCase();
        
        if (showOB && num.startsWith('OB')) return true;
        if (showSales && num.startsWith('SAL') && inv.debit > 0) return true;
        if (showReturns && num.startsWith('RSAL') && inv.credit > 0) return true;
        if (showDiscounts && (num.startsWith('JV') || num.startsWith('BIL'))) return true;
        if (showPayments) {
          // Treat BNK* as payments even if credit isn't populated as expected
          if (num.startsWith('BNK') && ((inv.credit || 0) > 0.01 || (inv.debit || 0) > 0.01)) return true;
          // Payments: credit transactions excluding SAL, RSAL, BIL, JV, OB
          if (inv.credit > 0.01 && 
              !num.startsWith('SAL') && 
              !num.startsWith('RSAL') && 
              !num.startsWith('BIL') && 
              !num.startsWith('JV') &&
              !num.startsWith('OB')) {
            return true;
          }
        }
        return false;
      });
    }
    
    // Keep the same row order as the exported PDF (original sheet order).
    return [...filtered].sort(
      (a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0),
    );
  }, [overdueInvoices, selectedMonthFilter, selectedMatchingFilter, invoiceSearchQuery, showOB, showSales, showReturns, showPayments, showDiscounts]);

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
      
      existing.netDebt = existing.debit - existing.credit;

      monthlyMap.set(key, existing);
    });

    return Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      return new Date(`${a.month} 1, ${a.year}`).getTime() - new Date(`${b.month} 1, ${b.year}`).getTime();
    });
  }, [filteredInvoices]);

  // NOTE: Hooks must never be called inside JSX. These are used by dashboard charts but must be declared here
  // so hook order is stable across tab switches.
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

  // Prepare aging data
  const agingData = useMemo<AgingSummary>(() => {
    // 1. Filter for open invoices (Unmatched or Residual holders)
    const openInvoices = filteredInvoices.filter(inv => {
      // Keep if no matching ID (Unmatched) AND has balance
      if (!inv.matching) {
          return Math.abs(inv.netDebt) > 0.01;
      }
      
      // Keep only if it carries the residual (which means it's the main open invoice of an open group)
      return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
    });

    const summary: AgingSummary = {
      atDate: 0,
      oneToThirty: 0,
      thirtyOneToSixty: 0,
      sixtyOneToNinety: 0,
      ninetyOneToOneTwenty: 0,
      older: 0,
      total: 0
    };

    openInvoices.forEach(inv => {
      let amount = inv.netDebt;
      
      if (inv.matching && inv.residual !== undefined) {
         // It's a condensed open invoice, use residual as amount
         amount = inv.residual;
      }

      // Calculate days overdue
      let daysOverdue = 0;
      // Try Due Date first
      let targetDate = inv.dueDate ? new Date(inv.dueDate) : null;
      
      // If Due Date is invalid, fallback to Invoice Date
      if (!targetDate || isNaN(targetDate.getTime())) {
         if (inv.date) {
           targetDate = new Date(inv.date);
         }
      }

      if (targetDate && !isNaN(targetDate.getTime())) {
         const today = new Date();
         today.setHours(0, 0, 0, 0);
         targetDate.setHours(0, 0, 0, 0);
         const diffTime = today.getTime() - targetDate.getTime();
         daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Add to appropriate bucket
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
  }, [filteredInvoices]);


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
          const type = getInvoiceTypeFromRow(inv);
          const color =
            type === 'Sales' ? 'bg-blue-100 text-blue-700' :
            type === 'Return' ? 'bg-orange-100 text-orange-700' :
            type === 'Payment' ? 'bg-green-100 text-green-700' :
            type === 'Discount' ? 'bg-yellow-100 text-yellow-700' :
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
          const type = getInvoiceTypeFromRow(inv);
          const color =
            type === 'Sales' ? 'bg-blue-100 text-blue-700' :
            type === 'Return' ? 'bg-orange-100 text-orange-700' :
            type === 'Payment' ? 'bg-green-100 text-green-700' :
            type === 'Discount' ? 'bg-yellow-100 text-yellow-700' :
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
        header: 'Difference',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : ''}>
              {value.toLocaleString('en-US')}
            </span>
          );
        },
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

  // Monthly debt columns - Order: Year, Month, DEBIT, CREDIT, Net Debt
  const monthlyColumns = useMemo(
    () => [
      monthlyColumnHelper.accessor('year', {
        header: 'Year',
        cell: (info) => info.getValue(),
      }),
      monthlyColumnHelper.accessor('month', {
        header: 'Month',
        cell: (info) => info.getValue(),
      }),
      monthlyColumnHelper.accessor('debit', {
        header: 'Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      monthlyColumnHelper.accessor('credit', {
        header: 'Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      monthlyColumnHelper.accessor('netDebt', {
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
    ],
    []
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

  const monthlyTable = useReactTable({
    data: monthlyDebt,
    columns: monthlyColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: monthlySorting },
    onSortingChange: setMonthlySorting,
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
  const invoicesToSum = selectedInvoices.length > 0 ? selectedInvoices : filteredInvoices;
  const totalNetDebt = invoicesToSum.reduce((sum, inv) => sum + inv.netDebt, 0);
  const totalDebit = invoicesToSum.reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = invoicesToSum.reduce((sum, inv) => sum + inv.credit, 0);
  
  // Calculate totals for overdue invoices based on selected, or all if none selected
  const selectedOverdueInvoices = filteredOverdueInvoices.filter(inv => selectedOverdueIds.has(inv.originalIndex));
  const overdueToSum = selectedOverdueInvoices.length > 0 ? selectedOverdueInvoices : filteredOverdueInvoices;
  const overdueTotalDebit = overdueToSum.reduce((sum, inv) => sum + inv.debit, 0);
  const overdueTotalCredit = overdueToSum.reduce((sum, inv) => sum + inv.credit, 0);
  const overdueTotalDifference = overdueToSum.reduce((sum, inv) => sum + inv.difference, 0);

  const monthlyTotalNetDebt = monthlyDebt.reduce((sum, m) => sum + m.netDebt, 0);
  const monthlyTotalDebit = monthlyDebt.reduce((sum, m) => sum + m.debit, 0);
  const monthlyTotalCredit = monthlyDebt.reduce((sum, m) => sum + m.credit, 0);

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
      
      const { generateAccountStatementPDF } = await import('@/lib/pdfUtils');
      await generateAccountStatementPDF(customerName, finalInvoices, false, monthsLabel);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const exportToExcel = (invoices: any[], monthsLabel: string) => {
    const headers = ['Date', 'Type', 'Invoice Number', 'Debit', 'Credit', 'Net Debt'];
    
    const rows = invoices.map(inv => {
      const date = inv.date ? new Date(inv.date).toLocaleDateString('en-US') : '';
      const type = getInvoiceTypeFromRow(inv);
      return [
        date,
        type,
        inv.number || '',
        (inv.debit || 0).toFixed(2),
        (inv.credit || 0).toFixed(2),
        (inv.netDebt || 0).toFixed(2)
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Add BOM for UTF-8 to ensure Excel opens it correctly
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `${customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim()}_${monthsLabel.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '_')}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        
      } else {
        // Custom Selection Logic
        // Filter invoices based on selected months
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

        // Filter for "Net Only" (exclude fully closed matches)
        if (pdfExportType === 'net') {
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
        }
        
        // Determine months label for Custom
        if (selectedMonths.length < availableMonths.length) {
            // Sort selected months by date descending
            const sortedSelectedMonths = [...selectedMonths].sort((a, b) => {
              const dateA = new Date(`1 ${a}`);
              const dateB = new Date(`1 ${b}`);
              return dateB.getTime() - dateA.getTime();
            });
            monthsLabel = sortedSelectedMonths.join(', ');
        }
         // Append filter info to label if needed
        if (pdfExportType === 'net') {
           monthsLabel += ' (Net Only)';
        }
      }

      if (exportFormat === 'excel') {
        // Export to Excel
        exportToExcel(finalInvoices, monthsLabel);
      } else {
        // Export to PDF
        const { generateAccountStatementPDF, generateMonthlySeparatedPDF } = await import('@/lib/pdfUtils');
        
        if (exportMode === 'separated') {
          await generateMonthlySeparatedPDF(customerName, finalInvoices);
        } else {
          await generateAccountStatementPDF(customerName, finalInvoices, false, monthsLabel);
        }
      }
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting:', error);
      alert(`Error exporting to ${exportFormat.toUpperCase()}. Please try again.`);
    }
  };

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
      return (num.startsWith('JV') || num.startsWith('BIL')) ? sum + inv.credit : sum;
    }, 0);

    const paymentsAmount = filteredInvoices.reduce((sum, inv) => {
      if (!isPaymentTxn(inv)) return sum;
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
    // Filter out non-payment transaction types
    const paymentInvoices = filteredInvoices.filter((inv) => isPaymentTxn(inv));

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

    // Lifetime Smart Payments (Credit not SAL/RSAL/BIL/JV)
    const smartPaymentInvoices = filteredInvoices.filter((inv) => isPaymentTxn(inv));
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

    // Aging Data for Pie Chart
    const pieData = [
      { name: 'Current', value: agingData.atDate, color: '#10B981' }, // Green
      { name: '1-30 Days', value: agingData.oneToThirty, color: '#3B82F6' }, // Blue
      { name: '31-60 Days', value: agingData.thirtyOneToSixty, color: '#F59E0B' }, // Yellow
      { name: '61-90 Days', value: agingData.sixtyOneToNinety, color: '#F97316' }, // Orange
      { name: '> 90 Days', value: agingData.ninetyOneToOneTwenty + agingData.older, color: '#EF4444' }, // Red
    ].filter(d => d.value > 0.01);

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
      pieData
    };
  }, [filteredInvoices, filteredOverdueInvoices, totalNetDebt, agingData]);

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

  return (
    <div className="p-6">
      {/* Payment Details Modal */}
      {showPaymentModal && dashboardMetrics.lastPaymentInvoice && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-100 transform transition-all scale-100 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">💸</span> Payment Details
              </h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Payment Amount</p>
                <p className="text-3xl font-bold text-green-600">
                  {dashboardMetrics.lastPaymentAmount.toLocaleString('en-US')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Date</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(dashboardMetrics.lastPaymentInvoice.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
                  <p className="font-semibold text-gray-800 font-mono break-words overflow-wrap-anywhere text-sm">
                    {dashboardMetrics.lastPaymentInvoice.number}
                  </p>
                </div>
              </div>

              {dashboardMetrics.lastPaymentInvoice.matching && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Matching Reference</p>
                  <p className="font-medium text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded">
                    {dashboardMetrics.lastPaymentInvoice.matching}
                  </p>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collection Breakdown Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={() => setShowCollectionModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">📈</span> Collection Breakdown
              </h3>
              <button 
                onClick={() => setShowCollectionModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-gray-500 uppercase">Payments</p>
                  <p className="text-lg font-bold text-gray-900">{dashboardMetrics.paymentsAmount.toLocaleString('en-US')}</p>
                </div>
                <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-gray-500 uppercase">Returns (RSAL)</p>
                  <p className="text-lg font-bold text-gray-900">{dashboardMetrics.returnsAmount.toLocaleString('en-US')}</p>
                  <p className="text-xs text-gray-500">Impact: {dashboardMetrics.returnsImpact.toFixed(1)}%</p>
                </div>
                <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-gray-500 uppercase">Discounts (JV/BIL)</p>
                  <p className="text-lg font-bold text-gray-900">{dashboardMetrics.discountsAmount.toLocaleString('en-US')}</p>
                  <p className="text-xs text-gray-500">Impact: {dashboardMetrics.discountsImpact.toFixed(1)}%</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            title="Back to Customers"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (isRestrictedUser) {
                handleDirectExport();
              } else {
                setExportMode('combined');
                setShowExportModal(true);
              }
            }}
            className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
            title="Export"
          >
            <FileText className="w-5 h-5" />
          </button>
          {!isRestrictedUser && (
            <button
              onClick={() => {
                setExportMode('separated');
                setShowExportModal(true);
              }}
              className="p-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center"
              title="Export Monthly"
            >
              <Calendar className="w-5 h-5" />
            </button>
          )}
          {customerEmails.length > 0 && !isRestrictedUser && (
            <button
              onClick={handleEmail}
              className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center"
              title="Email"
            >
              <Mail className="w-5 h-5" />
            </button>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">{customerName}</h2>
          <p className="text-gray-600">
            {(() => {
              const salesReps = new Set<string>();
              invoices.forEach(inv => {
                if (inv.salesRep && inv.salesRep.trim()) {
                  salesReps.add(inv.salesRep.trim());
                }
              });
              const salesRepsArray = Array.from(salesReps).sort();
              return salesRepsArray.length > 0 ? salesRepsArray.join(', ') : 'No Sales Rep';
            })()}
          </p>
        </div>
        {currentUserName === 'Mahmoud Shaker' && (
          <span className="text-red-600 font-extrabold text-lg bg-yellow-100 px-3 py-1 rounded border border-red-200 animate-pulse ml-auto">
            ⚠️ يا محمود اتاكد من ان رقم المديونية مطابق للسيستم دايما متنساش
          </span>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Export Options</h3>

            {/* Format Selection */}
            <div className="mb-4 border-b border-gray-200 pb-4">
              <h4 className="font-semibold mb-2 text-gray-700">Export Format</h4>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportFormat"
                    checked={exportFormat === 'pdf'} 
                    onChange={() => setExportFormat('pdf')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">PDF</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportFormat"
                    checked={exportFormat === 'excel'} 
                    onChange={() => setExportFormat('excel')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Excel (CSV)</span>
                </label>
              </div>
            </div>

            {/* Scope Selection */}
            <div className="mb-4 border-b border-gray-200 pb-4">
              <h4 className="font-semibold mb-2 text-gray-700">Export Scope</h4>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportScope"
                    checked={exportScope === 'custom'} 
                    onChange={() => setExportScope('custom')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Custom Selection</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportScope"
                    checked={exportScope === 'view'} 
                    onChange={() => setExportScope('view')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Current Filtered View</span>
                </label>
              </div>
            </div>
            
            {exportScope === 'custom' && (
              <>
            <div className="mb-4 border-b border-gray-200 pb-4">
              <h4 className="font-semibold mb-2 text-gray-700">Export Type</h4>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportType"
                    checked={pdfExportType === 'all'} 
                    onChange={() => setPdfExportType('all')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">All Transactions</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportType"
                    checked={pdfExportType === 'net'} 
                    onChange={() => setPdfExportType('net')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Net Only (Unmatched & Open)</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer font-bold border-b border-gray-200 pb-2 mb-2">
                <input
                  type="checkbox"
                  checked={selectedMonths.length === availableMonths.length}
                  onChange={toggleAllMonths}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                Select All
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                {availableMonths.map((month) => (
                  <label key={month} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(month)}
                      onChange={() => toggleMonthSelection(month)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    {month}
                  </label>
                ))}
              </div>
            </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                {exportScope === 'view'
                  ? `Export Current View (${exportFormat.toUpperCase()})`
                  : (exportMode === 'separated' && exportFormat === 'pdf'
                      ? `Export Separate Sheets (${selectedMonths.length})`
                      : `Export ${exportFormat.toUpperCase()} (${selectedMonths.length})`)
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50" 
          onClick={() => setSelectedInvoice(null)}
        >
          <div 
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-100 transform transition-all scale-100" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-xl font-bold text-gray-800">Invoice Number</h3>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="py-6">
              <p className="text-lg font-bold text-gray-900 text-center break-all">
                {selectedInvoice.number || 'N/A'}
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Filters & Search */}
      <div className="mb-6 flex flex-col gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="flex justify-center gap-6">
          {/* Month Filter - Multi-Select Dropdown */}
          <div className="w-64 relative">
            <label htmlFor="monthFilter" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
              Filter by Month
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {selectedMonthFilter.length === 0 
                    ? 'All Months' 
                    : selectedMonthFilter.length === 1 
                    ? selectedMonthFilter[0]
                    : `${selectedMonthFilter.length} months selected`}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isMonthDropdownOpen ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isMonthDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsMonthDropdownOpen(false)}
                  ></div>
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    <div className="p-2 border-b border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedMonthFilter.length === availableMonths.length && availableMonths.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMonthFilter([...availableMonths]);
                            } else {
                              setSelectedMonthFilter([]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Select All</span>
                      </label>
                    </div>
                    <div className="p-2">
                      {availableMonths.map((month) => (
                        <label key={month} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedMonthFilter.includes(month)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMonthFilter([...selectedMonthFilter, month]);
                              } else {
                                setSelectedMonthFilter(selectedMonthFilter.filter(m => m !== month));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{month}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Matching Filter - Multi-Select Dropdown */}
          <div className="w-64 relative">
            <label htmlFor="matchingFilter" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
              Filter by Matching
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMatchingDropdownOpen(!isMatchingDropdownOpen)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {selectedMatchingFilter.length === 0 
                    ? 'All Matchings' 
                    : selectedMatchingFilter.length === 1 
                    ? selectedMatchingFilter[0]
                    : `${selectedMatchingFilter.length} matchings selected`}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isMatchingDropdownOpen ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isMatchingDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsMatchingDropdownOpen(false)}
                  ></div>
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    <div className="p-2 border-b border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={
                            selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN) && 
                            availableMatchingsWithResidual.every(m => selectedMatchingFilter.includes(m)) &&
                            (
                              selectedMatchingFilter.length === availableMatchingsWithResidual.length + 1 ||
                              (selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED) &&
                                selectedMatchingFilter.length === availableMatchingsWithResidual.length + 2)
                            )
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Preserve All Unmatched if it was already selected
                              if (selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED)) {
                                setSelectedMatchingFilter([MATCHING_FILTER_ALL_UNMATCHED, MATCHING_FILTER_ALL_OPEN, ...availableMatchingsWithResidual]);
                              } else {
                                setSelectedMatchingFilter([MATCHING_FILTER_ALL_OPEN, ...availableMatchingsWithResidual]);
                              }
                            } else {
                              setSelectedMatchingFilter([]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Select All</span>
                      </label>
                    </div>
                    <div className="p-2">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMatchingFilter([...selectedMatchingFilter, MATCHING_FILTER_ALL_UNMATCHED]);
                            } else {
                              setSelectedMatchingFilter(selectedMatchingFilter.filter(m => m !== MATCHING_FILTER_ALL_UNMATCHED));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">All Unmatched</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMatchingFilter([...selectedMatchingFilter, MATCHING_FILTER_ALL_OPEN]);
                            } else {
                              setSelectedMatchingFilter(selectedMatchingFilter.filter(m => m !== MATCHING_FILTER_ALL_OPEN));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">All Open Matchings</span>
                      </label>
                      {availableMatchingsWithResidual.map((matching) => (
                        <label key={matching} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedMatchingFilter.includes(matching)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMatchingFilter([...selectedMatchingFilter, matching]);
                              } else {
                                setSelectedMatchingFilter(selectedMatchingFilter.filter(m => m !== matching));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{matching}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search Box */}
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <input
              type="text"
              placeholder="Search across all data..."
              value={invoiceSearchQuery}
              onChange={(e) => setInvoiceSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
        </div>

        {/* Invoice Type Filters */}
        <div className="flex justify-center mt-4">
          <div className="w-full max-w-6xl">
            <div className="flex flex-nowrap gap-2 justify-center items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-white rounded-md border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all">
                <input
                  type="checkbox"
                  checked={showOB}
                  onChange={(e) => setShowOB(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-1 focus:ring-purple-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  OB
                </span>
                <span className="text-sm font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                  {invoiceTypeTotals.ob.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-white rounded-md border border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
                <input
                  type="checkbox"
                  checked={showSales}
                  onChange={(e) => setShowSales(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-1 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  المبيعات (SAL)
                </span>
                <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  {invoiceTypeTotals.sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-white rounded-md border border-orange-200 hover:border-orange-400 hover:bg-orange-50 transition-all">
                <input
                  type="checkbox"
                  checked={showReturns}
                  onChange={(e) => setShowReturns(e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-1 focus:ring-orange-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  مرتجعات المبيعات (RSAL)
                </span>
                <span className="text-sm font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
                  {invoiceTypeTotals.returns.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-white rounded-md border border-green-200 hover:border-green-400 hover:bg-green-50 transition-all">
                <input
                  type="checkbox"
                  checked={showPayments}
                  onChange={(e) => setShowPayments(e.target.checked)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-1 focus:ring-green-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  الدفعات
                </span>
                <span className="text-sm font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                  {invoiceTypeTotals.payments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-white rounded-md border border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all">
                <input
                  type="checkbox"
                  checked={showDiscounts}
                  onChange={(e) => setShowDiscounts(e.target.checked)}
                  className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-1 focus:ring-yellow-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  الخصومات (JV/BIL)
                </span>
                <span className="text-sm font-semibold text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded">
                  {invoiceTypeTotals.discounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}_
      <div className="mb-6 flex justify-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'dashboard'
              ? 'text-purple-600 border-purple-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'invoices'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('overdue')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'overdue'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Overdue
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'monthly'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Debit by Months
        </button>
        <button
          onClick={() => setActiveTab('ages')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'ages'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Ages
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'notes'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Notes <span className="text-red-600">({notes.length})</span>
        </button>
      </div>

        {/* Tab Content: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Section 1: Debit Overview */}
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">Debit Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Net Debt Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-6xl">💰</span>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Net Outstanding</h3>
                  <p className={`text-3xl font-bold mt-2 ${totalNetDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalNetDebt.toLocaleString('en-US')}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">Current Balance</p>
                </div>

                {/* Overdue Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-6xl">⚠️</span>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Overdue Amount</h3>
                  <p className="text-3xl font-bold mt-2 text-orange-600">
                    {dashboardMetrics.overdueAmount.toLocaleString('en-US')}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">{dashboardMetrics.overdueCount} Invoices Overdue</p>
                </div>

                {/* Total Payments Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-6xl">💰</span>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Payments</h3>
                  <p className="text-3xl font-bold mt-2 text-green-600">
                    {dashboardMetrics.totalPayments.toLocaleString('en-US')}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">All Time Payments</p>
                </div>

                {/* Last Payment Card */}
                <div 
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-blue-200 group"
                  onClick={() => dashboardMetrics.lastPaymentDate && setShowPaymentModal(true)}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span className="text-6xl">💸</span>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider group-hover:text-blue-600 transition-colors">Last Payment</h3>
                  {dashboardMetrics.lastPaymentDate ? (
                    <>
                      <p className="text-3xl font-bold mt-2 text-green-600">
                        {dashboardMetrics.lastPaymentAmount.toLocaleString('en-US')}
                      </p>
                      <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                        {dashboardMetrics.lastPaymentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">info</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold mt-2 text-gray-400">-</p>
                      <p className="text-sm text-gray-400 mt-1">No payment history</p>
                    </>
                  )}
                </div>

                {/* Collection Rate Card */}
                <div 
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-blue-200"
                  onClick={() => setShowCollectionModal(true)}
                  title="Click to view detailed collection breakdown"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-6xl">📈</span>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Collection Rate</h3>
                  <p className="text-3xl font-bold mt-2 text-blue-600">
                    {dashboardMetrics.collectionRate.toFixed(1)}%
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(dashboardMetrics.collectionRate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Debit Aging Breakdown - Modern Stacked Bar + Pills */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-lg font-bold text-gray-800">Debit Aging Breakdown</h3>
                  <div className="text-sm text-gray-600">
                    Total Outstanding:{' '}
                    <span className="font-semibold text-gray-900">
                      {agingTotal.toLocaleString('en-US')}
                    </span>
                  </div>
                </div>

                <div className="h-44 w-full mt-2">
                  {agingBuckets.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stackedAgingData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                        layout="vertical"
                        stackOffset="none"
                      >
                        <CartesianGrid horizontal={true} vertical={false} stroke="#E5E7EB" />
                        <XAxis
                          type="number"
                          tick={false}
                          axisLine={false}
                          tickLine={false}
                          domain={[0, agingTotal || 'auto']}
                        />
                        <YAxis type="category" dataKey="label" hide />
                        <RechartsTooltip
                          formatter={(value: number, name: string, props: any) => {
                            const percent = agingTotal > 0 ? ((value / agingTotal) * 100).toFixed(1) : '0.0';
                            const label = agingBuckets.find((b) => b.dataKey === name)?.name || 'Bucket';
                            return [`${value.toLocaleString('en-US')} (${percent}%)`, label];
                          }}
                          contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            padding: '12px',
                            backgroundColor: 'white',
                          }}
                          cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                        />
                        {agingBuckets.map((bucket) => (
                          <Bar
                            key={bucket.dataKey}
                            dataKey={bucket.dataKey}
                            stackId="aging"
                            fill={bucket.color}
                            radius={[0, 0, 0, 0]}
                          >
                            <LabelList
                              dataKey={bucket.dataKey}
                              position="inside"
                              formatter={(value: any) => {
                                const numValue = typeof value === 'number' ? value : 0;
                                const percent = agingTotal > 0 ? (numValue / agingTotal) * 100 : 0;
                                return percent >= 1 ? `${percent.toFixed(0)}%` : '';
                              }}
                              fill="#fff"
                              fontSize={15}
                              fontWeight={800}
                            />
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-gray-400 h-full flex flex-col items-center justify-center">
                      <p className="text-4xl mb-2">👍</p>
                      <p>No outstanding debit to analyze.</p>
                    </div>
                  )}
                </div>

                {/* Pills with value + percent */}
                {agingBuckets.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-2 text-center">
                    {agingBuckets.map((bucket) => (
                      <div
                        key={bucket.name}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white border border-gray-100 shadow-[0_8px_24px_rgba(0,0,0,0.06)] min-w-[200px]"
                      >
                        <div className="flex flex-col items-start flex-1 leading-tight text-left">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: bucket.color }}
                            ></span>
                            <span className="text-sm font-semibold text-gray-900">{bucket.name}</span>
                          </div>
                          <div className="text-sm text-gray-700 font-semibold mt-1">
                            {bucket.value.toLocaleString('en-US')}
                          </div>
                        </div>
                        <span
                          className="px-3 py-1.5 rounded-full text-sm font-bold"
                          style={{
                            color: bucket.color,
                            backgroundColor: `${bucket.color}1A`, // ~10% opacity
                          }}
                        >
                          {bucket.percent.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Monthly Payments Trend - Moved here */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Payments Trend</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthlyPaymentsTrendData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="monthLabel" 
                        tick={{fontSize: 14, fill: '#374151', fontWeight: 700}} 
                        axisLine={false}
                        tickLine={false}
                        interval={0} 
                      />
                      <YAxis 
                        tick={{fontSize: 12, fill: '#6B7280'}} 
                        tickFormatter={(value) => `${value / 1000}k`} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip 
                        formatter={(value: number) => value.toLocaleString('en-US')}
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          padding: '12px'
                        }}
                        cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '5 5' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="credit" 
                        name="" 
                        stroke="#10B981" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorPayments)" 
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Section 2: Sales & Performance */}
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">Sales & Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Sales Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-6xl">🛒</span>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Sales</h3>
                  <p className="text-2xl font-bold mt-2 text-blue-600">
                    {dashboardMetrics.totalSalesSum.toLocaleString('en-US')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Gross (SAL)</p>
                </div>

                {/* Total Returns Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-6xl">↩️</span>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Returns</h3>
                  <p className="text-2xl font-bold mt-2 text-red-500">
                    {dashboardMetrics.totalReturnsSum.toLocaleString('en-US')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Returns (RSAL)</p>
                </div>

                {/* Net Sales Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-6xl">💵</span>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Net Sales</h3>
                  <p className="text-2xl font-bold mt-2 text-indigo-600">
                    {dashboardMetrics.netSalesSum.toLocaleString('en-US')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Sales - Returns</p>
                </div>

                {/* Avg Monthly Sales Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-6xl">📅</span>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Avg. Monthly</h3>
                  <p className="text-2xl font-bold mt-2 text-purple-600">
                    {dashboardMetrics.averageMonthlySales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Net / Active Months</p>
                </div>
              </div>

              {/* Monthly Sales Trend - Moved here */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Sales Trend</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlySalesTrendData}
                      margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
                      barCategoryGap="12%"
                    >
                      <defs>
                        <linearGradient id="colorSalesPositive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
                          <stop offset="50%" stopColor="#34D399" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#6EE7B7" stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id="colorSalesNegative" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EC4899" stopOpacity={1}/>
                          <stop offset="50%" stopColor="#F472B6" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#F9A8D4" stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id="barGlowPositive" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.3"/>
                          <stop offset="50%" stopColor="#34D399" stopOpacity="0.5"/>
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0.3"/>
                        </linearGradient>
                        <linearGradient id="barGlowNegative" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#EC4899" stopOpacity="0.3"/>
                          <stop offset="50%" stopColor="#F472B6" stopOpacity="0.5"/>
                          <stop offset="100%" stopColor="#EC4899" stopOpacity="0.3"/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                      <XAxis 
                        dataKey="monthLabel" 
                        tick={{fontSize: 14, fill: '#374151', fontWeight: 700}} 
                        axisLine={false}
                        tickLine={false}
                        interval={0} 
                      />
                      <YAxis 
                        tick={{fontSize: 12, fill: '#6B7280'}} 
                        tickFormatter={(value) => `${value / 1000}k`} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip 
                        formatter={(value: number, name: string, props: any) => {
                          // Always show the original value in tooltip
                          const originalValue = props.payload?.originalDebit ?? value;
                          return originalValue.toLocaleString('en-US');
                        }}
                        labelFormatter={(label) => `Month: ${label}`}
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          padding: '12px',
                          backgroundColor: 'white'
                        }}
                        cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                      />
                      <Bar 
                        dataKey="displayDebit" 
                        name="Sales"
                        radius={[10, 10, 0, 0]}
                        barSize={58}
                      >
                        {monthlySalesTrendData.map((entry: any, index: number) => {
                          const isPositive = (entry.originalDebit ?? entry.debit ?? 0) >= 0;
                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={isPositive ? "url(#colorSalesPositive)" : "url(#colorSalesNegative)"}
                              stroke="none"
                            />
                          );
                        })}
                        <LabelList 
                          dataKey="originalDebit" 
                          position="top" 
                          formatter={(value: any) => typeof value === 'number' ? value.toLocaleString('en-US') : String(value)}
                          style={{ fontSize: '14px', fill: '#1F2937', fontWeight: 700 }}
                          offset={10}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Notes */}
            <div className="grid grid-cols-1 gap-6">
               {/* Recent Notes Preview */}
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex justify-between items-center">
                    Recent Notes
                    <button onClick={() => setActiveTab('notes')} className="text-sm text-blue-600 hover:underline">View All</button>
                  </h3>
                  <div className="space-y-4">
                    {notes.slice(0, 3).map((note, i) => (
                      <div key={i} className="border-l-4 border-blue-500 pl-4 py-1">
                        <p className="text-sm text-gray-500 mb-1 flex justify-between">
                          <span className="font-bold text-gray-700">{note.user}</span>
                          <span>{new Date(note.timestamp || '').toLocaleDateString()}</span>
                        </p>
                        <div className="text-gray-800 line-clamp-2">
                          {renderNoteWithLinks(note.content)}
                        </div>
                      </div>
                    ))}
                    {notes.length === 0 && <p className="text-gray-400 italic">No notes available.</p>}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* Tab Content: Invoices */}
      {activeTab === 'invoices' && (
        <div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
              <thead className="bg-gray-100">
                {invoiceTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const getWidth = () => {
                        const columnId = header.column.id;
                        if (columnId === 'select') return '5%';
                        if (columnId === 'date') return '13%';
                        if (columnId === 'type') return '10%';
                        if (columnId === 'number') return '13%';
                        if (columnId === 'debit') return '13%';
                        if (columnId === 'credit') return '13%';
                        if (columnId === 'netDebt') return '13%';
                        if (columnId === 'matching') return '13%';
                        if (columnId === 'residual') return '9%';
                        return '13%';
                      };
                      return (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-200"
                          style={{ width: getWidth() }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {invoiceTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => {
                      const getWidth = () => {
                        const columnId = cell.column.id;
                        if (columnId === 'select') return '5%';
                        if (columnId === 'date') return '13%';
                        if (columnId === 'type') return '10%';
                        if (columnId === 'number') return '13%';
                        if (columnId === 'debit') return '13%';
                        if (columnId === 'credit') return '13%';
                        if (columnId === 'netDebt') return '13%';
                        if (columnId === 'matching') return '13%';
                        if (columnId === 'residual') return '9%';
                        return '13%';
                      };
                      return (
                        <td key={cell.id} className="px-4 py-3 text-center text-lg" style={{ width: getWidth() }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '5%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}>Total</td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '10%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}>
                    {totalDebit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}>
                    {totalCredit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}>
                    <span className={totalNetDebt > 0 ? 'text-red-600' : totalNetDebt < 0 ? 'text-green-600' : ''}>
                      {totalNetDebt.toLocaleString('en-US')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '9%' }}></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 mt-2 rounded-lg shadow">
            <div className="flex justify-between flex-1 sm:hidden">
              <button
                onClick={() => invoiceTable.previousPage()}
                disabled={!invoiceTable.getCanPreviousPage()}
                className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => invoiceTable.nextPage()}
                disabled={!invoiceTable.getCanNextPage()}
                className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">
                  Page <span className="font-medium">{invoiceTable.getState().pagination.pageIndex + 1}</span> of{' '}
                  <span className="font-medium">{invoiceTable.getPageCount()}</span>
                </span>
                <select
                  value={invoiceTable.getState().pagination.pageSize}
                  onChange={e => {
                    invoiceTable.setPageSize(Number(e.target.value))
                  }}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  {[50, 100, 250, 500].map(pageSize => (
                    <option key={pageSize} value={pageSize}>
                      Show {pageSize}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => invoiceTable.setPageIndex(0)}
                    disabled={!invoiceTable.getCanPreviousPage()}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">First</span>
                    ⟪
                  </button>
                  <button
                    onClick={() => invoiceTable.previousPage()}
                    disabled={!invoiceTable.getCanPreviousPage()}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    ⟨
                  </button>
                  <button
                    onClick={() => invoiceTable.nextPage()}
                    disabled={!invoiceTable.getCanNextPage()}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    ⟩
                  </button>
                  <button
                    onClick={() => invoiceTable.setPageIndex(invoiceTable.getPageCount() - 1)}
                    disabled={!invoiceTable.getCanNextPage()}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Last</span>
                    ⟫
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab Content: Overdue */}
      {activeTab === 'overdue' && (
        <div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
                <thead className="bg-gray-100">
                  {overdueTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const getWidth = () => {
                          const columnId = header.column.id;
                          if (columnId === 'select') return '5%';
                          if (columnId === 'date') return '13%';
                          if (columnId === 'type') return '10%';
                          if (columnId === 'number') return '13%';
                          if (columnId === 'debit') return '13%';
                          if (columnId === 'credit') return '13%';
                          if (columnId === 'difference') return '16%';
                          if (columnId === 'daysOverdue') return '16%';
                          return '13%';
                        };
                        return (
                          <th
                            key={header.id}
                            className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-200"
                            style={{ width: getWidth() }}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: ' ↑',
                              desc: ' ↓',
                            }[header.column.getIsSorted() as string] ?? null}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {overdueTable.getRowModel().rows.length === 0 ? (
                     <tr>
                       <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                         No overdue or open invoices found matching criteria.
                       </td>
                     </tr>
                  ) : (
                    overdueTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        {row.getVisibleCells().map((cell) => {
                          const getWidth = () => {
                            const columnId = cell.column.id;
                            if (columnId === 'select') return '5%';
                            if (columnId === 'date') return '13%';
                            if (columnId === 'type') return '10%';
                            if (columnId === 'number') return '13%';
                            if (columnId === 'debit') return '13%';
                            if (columnId === 'credit') return '13%';
                            if (columnId === 'difference') return '16%';
                            if (columnId === 'daysOverdue') return '16%';
                            return '13%';
                          };
                          return (
                            <td key={cell.id} className="px-4 py-3 text-center text-lg" style={{ width: getWidth() }}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                  {overdueTable.getRowModel().rows.length > 0 && (
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '5%' }}></td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}>Total</td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '10%' }}></td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}></td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}>
                        {overdueTotalDebit.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '13%' }}>
                        {overdueTotalCredit.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '16%' }}>
                        <span className={overdueTotalDifference > 0 ? 'text-red-600' : 'text-green-600'}>
                          {overdueTotalDifference.toLocaleString('en-US')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '16%' }}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          {overdueTable.getRowModel().rows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 mt-2 rounded-lg shadow">
              <div className="flex justify-between flex-1 sm:hidden">
                <button
                  onClick={() => overdueTable.previousPage()}
                  disabled={!overdueTable.getCanPreviousPage()}
                  className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => overdueTable.nextPage()}
                  disabled={!overdueTable.getCanNextPage()}
                  className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">
                    Page <span className="font-medium">{overdueTable.getState().pagination.pageIndex + 1}</span> of{' '}
                    <span className="font-medium">{overdueTable.getPageCount()}</span>
                  </span>
                  <select
                    value={overdueTable.getState().pagination.pageSize}
                    onChange={e => {
                      overdueTable.setPageSize(Number(e.target.value))
                    }}
                    className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {[50, 100, 250, 500].map(pageSize => (
                      <option key={pageSize} value={pageSize}>
                        Show {pageSize}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => overdueTable.setPageIndex(0)}
                      disabled={!overdueTable.getCanPreviousPage()}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">First</span>
                      «
                    </button>
                    <button
                      onClick={() => overdueTable.previousPage()}
                      disabled={!overdueTable.getCanPreviousPage()}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Previous</span>
                      ‹
                    </button>
                    <button
                      onClick={() => overdueTable.nextPage()}
                      disabled={!overdueTable.getCanNextPage()}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Next</span>
                      ›
                    </button>
                    <button
                      onClick={() => overdueTable.setPageIndex(overdueTable.getPageCount() - 1)}
                      disabled={!overdueTable.getCanNextPage()}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="sr-only">Last</span>
                      »
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Tab Content: Monthly Debt */}
      {activeTab === 'monthly' && (
        <div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
              <thead className="bg-gray-100">
                {monthlyTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const getWidth = () => {
                        const columnId = header.column.id;
                        if (columnId === 'year') return '20%';
                        if (columnId === 'month') return '20%';
                        if (columnId === 'debit') return '20%';
                        if (columnId === 'credit') return '20%';
                        if (columnId === 'netDebt') return '20%';
                        return '20%';
                      };
                      return (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-200"
                          style={{ width: getWidth() }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {monthlyTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => {
                      const getWidth = () => {
                        const columnId = cell.column.id;
                        if (columnId === 'year') return '20%';
                        if (columnId === 'month') return '20%';
                        if (columnId === 'debit') return '20%';
                        if (columnId === 'credit') return '20%';
                        if (columnId === 'netDebt') return '20%';
                        return '20%';
                      };
                      return (
                        <td key={cell.id} className="px-4 py-3 text-center text-lg" style={{ width: getWidth() }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>Total</td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    {monthlyTotalDebit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    {monthlyTotalCredit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    <span className={monthlyTotalNetDebt > 0 ? 'text-red-600' : monthlyTotalNetDebt < 0 ? 'text-green-600' : ''}>
                      {monthlyTotalNetDebt.toLocaleString('en-US')}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Tab Content: Ages */}
      {activeTab === 'ages' && (
        <div>
          {agingData.total <= 0 ? (
            <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
              <p className="text-lg">No outstanding debt to display aging information.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>AT DATE</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>1 - 30</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>31 - 60</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>61 - 90</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>91 - 120</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>OLDER</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '16%' }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-4 py-4 text-center text-lg text-green-600 font-semibold">
                        {agingData.atDate.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.oneToThirty.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.thirtyOneToSixty.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.sixtyOneToNinety.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.ninetyOneToOneTwenty.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg text-red-600 font-semibold">
                        {agingData.older.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg font-bold bg-gray-50">
                        {agingData.total.toLocaleString('en-US')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Notes */}
      {activeTab === 'notes' && (
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4">Add New Note</h3>
            <div className="flex gap-4">
              <textarea
                ref={newNoteRef}
                value={newNote}
                onChange={(e) => {
                  setNewNote(e.target.value);
                  autoResizeTextarea(e.currentTarget);
                }}
                placeholder="Type your note here..."
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-24 max-h-[360px]"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                Add Note
              </button>
            </div>
          </div>

          {loadingNotes ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No notes found for this customer.</p>
              ) : (
                notes.map((note, index) => {
                  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                  // Robust comparison: check if names exist and match (ignoring case/whitespace)
                  // Permission Check: ONLY "MED Sabry" can edit/delete/mark solved
                  const canManageNotes = currentUser?.name?.trim().toLowerCase() === 'med sabry';

                  return (
                    <div key={index} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{note.user}</span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">User</span>
                          </div>
                          {note.timestamp && (
                            <span className="text-sm text-gray-500">
                              {new Date(note.timestamp).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                           {/* Solved Status */}
                           {note.isSolved ? (
                              <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-sm font-medium border border-green-200">
                                ✓ Solved
                              </span>
                           ) : (
                              <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded text-sm font-medium border border-yellow-200">
                                ⏳ Pending
                              </span>
                           )}

                        {canManageNotes && editingNoteId !== note.rowIndex && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingNoteId(note.rowIndex);
                                setEditingNoteContent(note.content);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.rowIndex)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                        </div>
                      </div>

                      {editingNoteId === note.rowIndex ? (
                        <div className="mt-2">
                          <textarea
                            ref={editNoteRef}
                            value={editingNoteContent}
                            onChange={(e) => {
                              setEditingNoteContent(e.target.value);
                              autoResizeTextarea(e.currentTarget);
                            }}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-24 max-h-[360px] mb-2"
                          />
                          <div className="flex justify-between items-center">
                            <label className="flex items-center gap-2 cursor-pointer text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded transition-colors border border-gray-200">
                              <input
                                type="checkbox"
                                checked={note.isSolved || false}
                                onChange={(e) => handleUpdateNote(note.rowIndex, editingNoteContent, e.target.checked)}
                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                              />
                              <span className="font-medium">Mark as Solved</span>
                            </label>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteContent('');
                                  requestAnimationFrame(() => autoResizeTextarea(editNoteRef.current));
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleUpdateNote(note.rowIndex, editingNoteContent, note.isSolved)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-4">
                           <div className="text-gray-700 whitespace-pre-wrap text-lg flex-1">
                             {renderNoteWithLinks(note.content)}
                           </div>
                           {/* Quick Toggle for Solved Status (even if not editing content) */}
                           {canManageNotes && (
                             <label className="flex items-center gap-2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity" title="Toggle Status">
                                <input
                                   type="checkbox"
                                   checked={note.isSolved || false}
                                   onChange={(e) => handleUpdateNote(note.rowIndex, note.content, e.target.checked)}
                                   className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                                />
                             </label>
                           )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}