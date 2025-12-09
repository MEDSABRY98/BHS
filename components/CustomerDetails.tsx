'use client';

import { useMemo, useState, useEffect } from 'react';
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

interface CustomerDetailsProps {
  customerName: string;
  invoices: InvoiceRow[];
  onBack: () => void;
}

interface InvoiceWithNetDebt extends InvoiceRow {
  netDebt: number;
  residual?: number;
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
}

const invoiceColumnHelper = createColumnHelper<InvoiceWithNetDebt>();
const overdueColumnHelper = createColumnHelper<OverdueInvoice>();
const monthlyColumnHelper = createColumnHelper<MonthlyDebt>();

export default function CustomerDetails({ customerName, invoices, onBack }: CustomerDetailsProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'monthly' | 'ages' | 'notes' | 'overdue'>('dashboard');
  const [invoiceSorting, setInvoiceSorting] = useState<SortingState>([]);
  const [overdueSorting, setOverdueSorting] = useState<SortingState>([]);
  const [monthlySorting, setMonthlySorting] = useState<SortingState>([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('All Months');
  const [selectedMatchingFilter, setSelectedMatchingFilter] = useState<string>('All Matchings');
  
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

  // Notes State
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);

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
        if (data.email) {
          setCustomerEmail(data.email);
        }
      } catch (error) {
        console.error('Error fetching customer email:', error);
      }
    };
    fetchEmail();
  }, [customerName]);

  const handleEmail = async () => {
    if (!customerEmail) return;

    try {
      // 1. Generate PDF (Net Only)
      let finalInvoices = [...invoicesWithNetDebt];
      
      // Filter for "Net Only" using the condensed logic
      finalInvoices = finalInvoices.filter(inv => {
        // Keep if no matching ID (Unmatched)
        if (!inv.matching) return true;
        
        // Keep only if it carries the residual (which means it's the main open invoice of an open group)
        return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
      }).map(inv => {
          if (inv.matching && inv.residual !== undefined) {
             // It's a condensed open invoice
             return {
                 ...inv,
                 credit: inv.debit - inv.residual,
                 netDebt: inv.residual
             };
          }
          return inv;
      });

      if (finalInvoices.length === 0) {
         alert('No open invoices to send.');
         return;
      }

      // Calculate Total Net Debt for Body
      const currentNetDebt = finalInvoices.reduce((sum, inv) => sum + inv.netDebt, 0);

      const monthsLabel = 'All Months (Net Only)';
      const { generateAccountStatementPDF } = await import('@/lib/pdfUtils');
      
      // Generate PDF Blob
      const pdfBlob = await generateAccountStatementPDF(customerName, finalInvoices, true, monthsLabel);
      
      if (!pdfBlob) {
        throw new Error('Failed to generate PDF blob');
      }

      // Convert Blob to Base64
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob as Blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const pdfBase64 = base64data.split(',')[1]; // Remove "data:application/pdf;base64," prefix

        // 2. Create .eml file content
        const boundary = "----=_NextPart_000_0001_01C2A9A1.12345678";
        const subject = 'Statement of Account - Al Marai Al Arabia Trading Sole Proprietorship L.L.C';
        const htmlBody = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px;">
<p>Dear Customer,</p>
<p>We hope this email finds you well.</p>
<p>Please find attached your account statement.<br>
Your current net debt is: <span style="color: blue; font-weight: bold; font-size: 16px;">${currentNetDebt.toLocaleString('en-US')} AED</span></p>
<p>Kindly provide us with your statement of account and any discount invoices for reconciliation.</p>
<p>Best regards,</p>
</body>
</html>`;

        const pdfFileName = `${customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim()}.pdf`;

        const emlContent = [
          'To: ' + customerEmail,
          'Subject: ' + subject,
          'X-Unsent: 1', // Mark as unsent (opens in compose mode)
          'Content-Type: multipart/mixed; boundary="' + boundary + '"',
          '',
          '--' + boundary,
          'Content-Type: text/html; charset="UTF-8"',
          'Content-Transfer-Encoding: 7bit',
          '',
          htmlBody,
          '',
          '--' + boundary,
          `Content-Type: application/pdf; name="${pdfFileName}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${pdfFileName}"`,
          '',
          pdfBase64,
          '',
          '--' + boundary + '--'
        ].join('\r\n');

        // 3. Download .eml file
        const blob = new Blob([emlContent], { type: 'message/rfc822' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Email_to_${customerName.replace(/\s+/g, '_')}.eml`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      };

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
        residual
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

    if (selectedMatchingFilter === 'All Open Matchings') {
       relevantInvoices = invoices.filter(inv => inv.matching && availableMatchingsWithResidual.includes(inv.matching));
    } else if (selectedMatchingFilter !== 'All Matchings') {
      relevantInvoices = invoices.filter(inv => inv.matching === selectedMatchingFilter);
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

  // Reset selected month if it's no longer available in the filtered list
  useEffect(() => {
    if (selectedMonthFilter !== 'All Months' && !availableMonths.includes(selectedMonthFilter)) {
      setSelectedMonthFilter('All Months');
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
    if (selectedMonthFilter !== 'All Months') {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return monthYear === selectedMonthFilter;
      });
    }

    // Matching Filter
    if (selectedMatchingFilter !== 'All Matchings') {
      if (selectedMatchingFilter === 'All Open Matchings') {
        filtered = filtered.filter((inv) => inv.matching && availableMatchingsWithResidual.includes(inv.matching));
      } else {
        filtered = filtered.filter((inv) => inv.matching === selectedMatchingFilter);
      }
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
    
    return filtered;
  }, [invoicesWithNetDebt, selectedMonthFilter, selectedMatchingFilter, invoiceSearchQuery, showOB, showSales, showReturns, showPayments, showDiscounts]);

  // Filter overdue invoices based on selected month filter, matching filter, and search query
  const filteredOverdueInvoices = useMemo(() => {
    let filtered = overdueInvoices;
    
    // Month Filter
    if (selectedMonthFilter !== 'All Months') {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return monthYear === selectedMonthFilter;
      });
    }

    // Matching Filter
    if (selectedMatchingFilter !== 'All Matchings') {
      if (selectedMatchingFilter === 'All Open Matchings') {
        // For overdue, invoices are usually already filtered for openness, but we check if it belongs to a matching group
        filtered = filtered.filter((inv) => inv.matching);
      } else {
        filtered = filtered.filter((inv) => inv.matching === selectedMatchingFilter);
      }
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
    
    return filtered;
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


  // Invoice columns - Order: DATE, NUMBER, DEBIT, CREDIT, Net Debt, Matching, Residual
  const invoiceColumns = useMemo(
    () => [
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
      invoiceColumnHelper.accessor('number', {
        header: 'Number',
        cell: (info) => info.getValue(),
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
    []
  );

  // Overdue columns
  const overdueColumns = useMemo(
    () => [
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
      overdueColumnHelper.accessor('number', {
        header: 'Invoice Number',
        cell: (info) => info.getValue(),
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
    []
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
    state: { sorting: overdueSorting },
    onSortingChange: setOverdueSorting,
  });

  const totalNetDebt = filteredInvoices.reduce((sum, inv) => sum + inv.netDebt, 0);
  const totalDebit = filteredInvoices.reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = filteredInvoices.reduce((sum, inv) => sum + inv.credit, 0);

  const monthlyTotalNetDebt = monthlyDebt.reduce((sum, m) => sum + m.netDebt, 0);
  const monthlyTotalDebit = monthlyDebt.reduce((sum, m) => sum + m.debit, 0);
  const monthlyTotalCredit = monthlyDebt.reduce((sum, m) => sum + m.credit, 0);
  
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

  const handleExport = async () => {
    try {
      let finalInvoices = [];
      let monthsLabel = 'All Months';

      if (exportScope === 'view') {
        finalInvoices = filteredInvoices;
        monthsLabel = 'Filtered View';
        
        // If filtering by month, use that name
        if (selectedMonthFilter !== 'All Months') {
           monthsLabel = selectedMonthFilter;
        } else if (selectedMonths.length < availableMonths.length && selectedMonths.length > 0) {
           // If view was constructed differently but matches months logic
        }
        
        if (selectedMatchingFilter !== 'All Matchings') {
          monthsLabel += ` - ${selectedMatchingFilter}`;
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

      const { generateAccountStatementPDF, generateMonthlySeparatedPDF } = await import('@/lib/pdfUtils');
      
      if (exportMode === 'separated') {
        await generateMonthlySeparatedPDF(customerName, finalInvoices);
      } else {
        await generateAccountStatementPDF(customerName, finalInvoices, false, monthsLabel);
      }
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Calculate Dashboard Metrics
  const dashboardMetrics = useMemo(() => {
    const totalSales = filteredInvoices.reduce((acc, inv) => acc + inv.debit, 0);
    const totalPaid = filteredInvoices.reduce((acc, inv) => acc + inv.credit, 0);
    const collectionRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;
    
    const dates = filteredInvoices
      .map(inv => inv.date ? new Date(inv.date).getTime() : 0)
      .filter(t => t > 0);
    const lastActivity = dates.length > 0 ? new Date(Math.max(...dates)) : null;

    const overdueAmount = filteredOverdueInvoices.reduce((acc, inv) => acc + inv.difference, 0);
    const overdueCount = filteredOverdueInvoices.length;

    // Calculate Last Payment
    // Filter out non-payment transaction types
    const paymentInvoices = filteredInvoices.filter(inv => {
       if (inv.credit <= 0.01) return false;
       const num = inv.number.toUpperCase();
       return !num.startsWith('SAL') && 
              !num.startsWith('RSAL') && 
              !num.startsWith('BIL') && 
              !num.startsWith('JV');
    });

    let lastPaymentAmount = 0;
    let lastPaymentDate = null;

    if (paymentInvoices.length > 0) {
        // Sort by date descending (newest first)
        const sortedPayments = paymentInvoices.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
        });
        
        lastPaymentAmount = sortedPayments[0].credit;
        lastPaymentDate = new Date(sortedPayments[0].date);
    }

    // Calculate Total Payments (sum of all payment credits)
    const totalPayments = paymentInvoices.reduce((acc, inv) => acc + inv.credit, 0);

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
    const smartPaymentInvoices = filteredInvoices.filter(inv => {
       if (inv.credit <= 0.01) return false;
       const num = inv.number.toUpperCase();
       return !num.startsWith('SAL') && 
              !num.startsWith('RSAL') && 
              !num.startsWith('BIL') && 
              !num.startsWith('JV');
    });
    const lifetimeSmartPayments = smartPaymentInvoices.reduce((sum, inv) => sum + inv.credit, 0);
    
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
      lastPaymentInvoice: paymentInvoices.length > 0 ? paymentInvoices[0] : null,
      averageMonthlySales,
      lifetimeSmartSales,
      lifetimeSmartPayments,
      totalSalesSum: totalSalesAmount,
      totalReturnsSum: totalReturnsAmount,
      netSalesSum: netSales,
      pieData
    };
  }, [filteredInvoices, filteredOverdueInvoices, totalNetDebt, agingData]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  return (
    <div className="p-6">
      {/* Payment Details Modal */}
      {showPaymentModal && dashboardMetrics.lastPaymentInvoice && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-100 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
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
                  {dashboardMetrics.lastPaymentInvoice.credit.toLocaleString('en-US')}
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
                <div>
                  <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
                  <p className="font-semibold text-gray-800 font-mono">
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

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">{customerName}</h2>
          <p className="text-gray-600">Customer Details</p>
        </div>
        <div className="flex items-center gap-3">
          {currentUserName === 'Mahmoud Shaker' && (
             <span className="text-red-600 font-extrabold text-lg bg-yellow-100 px-3 py-1 rounded border border-red-200 animate-pulse">
               ⚠️ يا محمود اتاكد من ان رقم المديونية مطابق للسيستم دايما متنساش
             </span>
          )}
          {customerEmail && (
            <button
              onClick={handleEmail}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              📧 Email
            </button>
          )}
          <button
            onClick={() => {
              if (currentUserName === 'Mahmoud Shaker') {
                handleDirectExport();
              } else {
                setExportMode('combined');
                setShowExportModal(true);
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            📄 Export PDF
          </button>
          {currentUserName !== 'Mahmoud Shaker' && (
            <button
              onClick={() => {
                setExportMode('separated');
                setShowExportModal(true);
              }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
            >
              📑 Export Monthly PDF
            </button>
          )}
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Customers
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Export Options</h3>

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
                  ? 'Export Current View'
                  : (exportMode === 'separated' 
                      ? `Export Separate Sheets (${selectedMonths.length})`
                      : `Export PDF (${selectedMonths.length})`)
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Filters & Search */}
      <div className="mb-6 flex flex-col gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="flex justify-center gap-6">
          {/* Month Filter */}
          <div className="w-64">
            <label htmlFor="monthFilter" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
              Filter by Month
            </label>
            <select
              id="monthFilter"
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All Months">All Months</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          {/* Matching Filter */}
          <div className="w-64">
            <label htmlFor="matchingFilter" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
              Filter by Open Matching
            </label>
            <select
              id="matchingFilter"
              value={selectedMatchingFilter}
              onChange={(e) => setSelectedMatchingFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All Matchings">All Matchings</option>
              <option value="All Open Matchings">All Open Matchings</option>
              {availableMatchingsWithResidual.map((matching) => (
                <option key={matching} value={matching}>
                  {matching}
                </option>
              ))}
            </select>
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
          <div className="w-full max-w-2xl">
            <div className="flex flex-wrap gap-4 justify-center items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOB}
                  onChange={(e) => setShowOB(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">OB</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSales}
                  onChange={(e) => setShowSales(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">المبيعات (SAL)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showReturns}
                  onChange={(e) => setShowReturns(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">مرتجعات المبيعات (RSAL)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPayments}
                  onChange={(e) => setShowPayments(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">الدفعات</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDiscounts}
                  onChange={(e) => setShowDiscounts(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">الخصومات (JV/BIL)</span>
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
            
            {/* Section 1: Debt Overview */}
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">Debt Overview</h3>
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
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
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

              {/* Debt Aging Breakdown - Moved here */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Debt Aging Breakdown</h3>
                <div className="h-80 w-full flex items-center justify-center">
                  {dashboardMetrics.pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboardMetrics.pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {dashboardMetrics.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: number) => value.toLocaleString('en-US')}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Legend 
                          layout="horizontal" 
                          verticalAlign="bottom" 
                          align="center"
                          content={({ payload }) => (
                            <div className="flex flex-wrap justify-center gap-4 pt-4">
                              {payload?.map((entry: any, index: number) => {
                                const dataEntry = entry.payload;
                                if (!dataEntry) return null;
                                const percent = agingData.total > 0 
                                  ? ((dataEntry.value / agingData.total) * 100).toFixed(1)
                                  : '0.0';
                                return (
                                  <div key={`item-${index}`} className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                    <span className="text-base font-medium text-gray-700">{entry.value}</span>
                                    <span className="text-base text-gray-500">
                                      {dataEntry.value.toLocaleString('en-US')} ({percent}%)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-gray-400">
                      <p className="text-4xl mb-2">👍</p>
                      <p>No outstanding debt to analyze.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Payments Trend - Moved here */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Payments Trend</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthlyDebt.slice(0, 12).reverse()} // Show last 12 months
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
                        dataKey="month" 
                        tick={{fontSize: 12, fill: '#6B7280'}} 
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
                      <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                      <Area 
                        type="monotone" 
                        dataKey="credit" 
                        name="Payments" 
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
                    <AreaChart
                      data={monthlyDebt.slice(0, 12).reverse()} // Show last 12 months
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="month" 
                        tick={{fontSize: 12, fill: '#6B7280'}} 
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
                      <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                      <Area 
                        type="monotone" 
                        dataKey="debit" 
                        name="Sales" 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorSales)" 
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
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
                        <p className="text-gray-800 line-clamp-2">{note.content}</p>
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
                        if (columnId === 'date') return '15%';
                        if (columnId === 'number') return '15%';
                        if (columnId === 'debit') return '15%';
                        if (columnId === 'credit') return '15%';
                        if (columnId === 'netDebt') return '15%';
                        if (columnId === 'matching') return '15%';
                        if (columnId === 'residual') return '10%';
                        return '15%';
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
                        if (columnId === 'date') return '15%';
                        if (columnId === 'number') return '15%';
                        if (columnId === 'debit') return '15%';
                        if (columnId === 'credit') return '15%';
                        if (columnId === 'netDebt') return '15%';
                        if (columnId === 'matching') return '15%';
                        if (columnId === 'residual') return '10%';
                        return '15%';
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
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>Total</td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                    {totalDebit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                    {totalCredit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                    <span className={totalNetDebt > 0 ? 'text-red-600' : totalNetDebt < 0 ? 'text-green-600' : ''}>
                      {totalNetDebt.toLocaleString('en-US')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '10%' }}></td>
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
                          if (columnId === 'date') return '15%';
                          if (columnId === 'number') return '15%';
                          if (columnId === 'debit') return '15%';
                          if (columnId === 'credit') return '15%';
                          if (columnId === 'difference') return '20%';
                          if (columnId === 'daysOverdue') return '20%';
                          return '15%';
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
                       <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                         No overdue or open invoices found matching criteria.
                       </td>
                     </tr>
                  ) : (
                    overdueTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        {row.getVisibleCells().map((cell) => {
                          const getWidth = () => {
                            const columnId = cell.column.id;
                            if (columnId === 'date') return '15%';
                            if (columnId === 'number') return '15%';
                            if (columnId === 'debit') return '15%';
                            if (columnId === 'credit') return '15%';
                            if (columnId === 'difference') return '20%';
                            if (columnId === 'daysOverdue') return '20%';
                            return '15%';
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
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>Total</td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}></td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                        {filteredOverdueInvoices.reduce((sum, inv) => sum + inv.debit, 0).toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                        {filteredOverdueInvoices.reduce((sum, inv) => sum + inv.credit, 0).toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                        <span className={filteredOverdueInvoices.reduce((sum, inv) => sum + inv.difference, 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                          {filteredOverdueInvoices.reduce((sum, inv) => sum + inv.difference, 0).toLocaleString('en-US')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Type your note here..."
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
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
                            value={editingNoteContent}
                            onChange={(e) => setEditingNoteContent(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24 mb-2"
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
                                onClick={() => setEditingNoteId(null)}
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
                           <p className="text-gray-700 whitespace-pre-wrap text-lg flex-1">{note.content}</p>
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