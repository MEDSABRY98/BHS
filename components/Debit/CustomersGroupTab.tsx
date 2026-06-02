'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { Search, Plus, X, FileText, Printer, FileSpreadsheet, AlertCircle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { InvoiceRow } from '@/types';
import NoData from '../01-Unified/NoDataTab';
import FilterBar from './CustomerDetailsTab/FilterBar';
import { isPaymentTxn } from './CustomerDetailsTab/Utils';
import { getInvoiceType } from '@/lib/InvoiceType';

interface CustomersGroupTabProps {
  data: InvoiceRow[];
}

interface GroupOverdueRow {
  customerName: string;
  date: string;
  dueDate?: string;
  number: string;
  debit: number;
  credit: number;
  netDebt: number;
  difference: number;
  matching: string;
  daysOverdue: number;
}

const columnHelper = createColumnHelper<GroupOverdueRow>();

export default function CustomersGroupTab({ data }: CustomersGroupTabProps) {
  const [groupCustomers, setGroupCustomers] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'overdue' | 'all'>('overdue');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'date', desc: false }
  ]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const [selectedYearFilter, setSelectedYearFilter] = useState<string[]>([]);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string[]>([]);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [selectedOverdueMonthFilter, setSelectedOverdueMonthFilter] = useState<string[]>([]);
  const [isOverdueMonthDropdownOpen, setIsOverdueMonthDropdownOpen] = useState(false);
  const [selectedMatchingFilter, setSelectedMatchingFilter] = useState<string[]>([]);
  const [isMatchingDropdownOpen, setIsMatchingDropdownOpen] = useState(false);

  // Type checkboxes
  const [showOB, setShowOB] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [showJV, setShowJV] = useState(false);

  const MATCHING_FILTER_ALL_OPEN = 'All Open Matchings';
  const MATCHING_FILTER_ALL_UNMATCHED = 'All Unmatched';

  // Extract all unique customer names
  const allCustomers = useMemo(() => {
    const names = new Set<string>();
    data.forEach(item => {
      if (item.customerName) {
        names.add(item.customerName.trim());
      }
    });
    return Array.from(names).sort();
  }, [data]);

  // Extract unique sales rep names
  const allSalesReps = useMemo(() => {
    const reps = new Set<string>();
    data.forEach(item => {
      if (item.salesRep) {
        reps.add(item.salesRep.trim());
      }
    });
    return Array.from(reps).sort();
  }, [data]);

  // Filtered dropdown customers for multi-select
  const filteredDropdownCustomers = useMemo(() => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) return allCustomers;
    return allCustomers.filter(c => c.toLowerCase().includes(q));
  }, [allCustomers, customerSearchQuery]);

  // Close suggestions and customer dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleCustomer = (cust: string) => {
    setGroupCustomers(prev =>
      prev.includes(cust) ? prev.filter(c => c !== cust) : [...prev, cust]
    );
  };

  const handleSelectAll = (filteredCusts: string[]) => {
    const allSelected = filteredCusts.every(c => groupCustomers.includes(c));
    if (allSelected) {
      // Deselect all filtered
      setGroupCustomers(prev => prev.filter(c => !filteredCusts.includes(c)));
    } else {
      // Select all filtered
      setGroupCustomers(prev => {
        const newSelected = [...prev];
        filteredCusts.forEach(c => {
          if (!newSelected.includes(c)) {
            newSelected.push(c);
          }
        });
        return newSelected;
      });
    }
  };

  const handleRemoveCustomer = (name: string) => {
    setGroupCustomers(prev => prev.filter(c => c !== name));
  };

  // Compile overdue or all invoices for added customers
  const groupOverdueInvoices = useMemo(() => {
    const list: GroupOverdueRow[] = [];
    if (groupCustomers.length === 0) return list;

    groupCustomers.forEach(custName => {
      const invoices = data.filter(inv => 
        inv.customerName?.toString().toLowerCase().trim() === custName.toLowerCase().trim()
      );

      const invoicesWithNet = invoices.map((invoice, index) => {
        let residual: number | undefined = undefined;
        const parsedDate = invoice.date ? new Date(invoice.date) : null;
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

      const targetInvoices = viewMode === 'overdue'
        ? invoicesWithNet.filter(inv => {
            if (!inv.matching) return true;
            return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
          })
        : invoicesWithNet;

      const processed = targetInvoices.map(inv => {
        let difference = inv.netDebt;
        if (inv.matching) {
          if (inv.residual !== undefined) {
            difference = inv.residual;
          } else {
            difference = 0;
          }
        }

        let daysOverdue = 0;
        let targetDate = inv.dueDate ? new Date(inv.dueDate) : (inv.parsedDate || null);
        if (targetDate && !isNaN(targetDate.getTime()) && Math.abs(difference) > 0.01) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          targetDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - targetDate.getTime();
          daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const adjustedCredit = viewMode === 'overdue' ? (inv.debit - difference) : inv.credit;

        return {
          customerName: custName,
          date: inv.date || '',
          dueDate: inv.dueDate || '',
          number: inv.number || '',
          debit: inv.debit,
          credit: adjustedCredit,
          netDebt: difference,
          difference,
          matching: inv.matching || '',
          daysOverdue: Math.max(0, daysOverdue)
        };
      });
      list.push(...processed);
    });

    return list;
  }, [data, groupCustomers, viewMode]);

  // Get matchings with residual for filtering
  const availableMatchingsWithResidual = useMemo(() => {
    const matchings = new Set<string>();
    groupOverdueInvoices.forEach(inv => {
      if (inv.matching) {
        matchings.add(inv.matching);
      }
    });
    return Array.from(matchings).sort();
  }, [groupOverdueInvoices]);

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    let relevantInvoices = groupOverdueInvoices;

    if (selectedMatchingFilter.length > 0) {
      const wantsAllOpen = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_OPEN);
      const wantsUnmatched = selectedMatchingFilter.includes(MATCHING_FILTER_ALL_UNMATCHED);
      const selectedIds = selectedMatchingFilter.filter(
        (m) => m !== MATCHING_FILTER_ALL_OPEN && m !== MATCHING_FILTER_ALL_UNMATCHED
      );

      relevantInvoices = groupOverdueInvoices.filter((inv) => {
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
          const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          monthsSet.add(monthYear);
        }
      }
    });

    return Array.from(monthsSet).sort((a, b) => {
      const dateA = new Date(`1 ${a}`);
      const dateB = new Date(`1 ${b}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [groupOverdueInvoices, selectedMatchingFilter, availableMatchingsWithResidual]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    availableMonths.forEach(m => {
      const parts = m.split(' ');
      if (parts.length > 1) years.add(parts[1]);
    });
    return Array.from(years).sort().reverse();
  }, [availableMonths]);

  const availableOverdueMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    let relevantInvoices = groupOverdueInvoices;

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
      if (inv.date) {
        const date = new Date(inv.date);
        if (!isNaN(date.getTime())) {
          const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          monthsSet.add(monthYear);
        }
      }
    });

    return Array.from(monthsSet).sort((a, b) => {
      const dateA = new Date(`1 ${a}`);
      const dateB = new Date(`1 ${b}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [groupOverdueInvoices, selectedMatchingFilter]);

  // Apply filters to combined overdue invoices
  const filteredGroupInvoices = useMemo(() => {
    let filtered = [...groupOverdueInvoices];

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
        if (!inv.date) return false;
        const d = new Date(inv.date);
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
        inv.customerName?.toLowerCase().includes(query) ||
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
        if (showPayments) {
          const isNotPayment = num.startsWith('SAL') ||
            num.startsWith('RSAL') ||
            num.startsWith('BIL') ||
            num.startsWith('JV') ||
            num.startsWith('OB');
          if (!isNotPayment && inv.credit > 0) return true;
        }
        return false;
      });
    }

    return filtered.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });
  }, [
    groupOverdueInvoices,
    selectedYearFilter,
    selectedMonthFilter,
    selectedOverdueMonthFilter,
    selectedMatchingFilter,
    invoiceSearchQuery,
    showOB,
    showSales,
    showReturns,
    showPayments,
    showDiscounts,
    showJV,
    startDateFilter,
    endDateFilter,
    availableMatchingsWithResidual
  ]);

  // Calculate totals for each invoice type based on current filters (excluding type filters)
  const invoiceTypeTotals = useMemo(() => {
    let filtered = [...groupOverdueInvoices];

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
        if (!inv.date) return false;
        const d = new Date(inv.date);
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
        inv.customerName?.toLowerCase().includes(query) ||
        inv.number.toLowerCase().includes(query) ||
        inv.matching?.toLowerCase().includes(query) ||
        inv.date.toLowerCase().includes(query) ||
        inv.debit.toString().includes(query) ||
        inv.credit.toString().includes(query)
      );
    }

    // Calculate totals for each type
    let overdueTotal = 0;
    let obTotal = 0;
    let salesTotal = 0;
    let returnsTotal = 0;
    let paymentsTotal = 0;
    let discountsTotal = 0;
    let jvTotal = 0;

    filtered.forEach((inv) => {
      const num = (inv.number || '').trim().toUpperCase();
      const netDebt = inv.difference;

      overdueTotal += netDebt;

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
      } else {
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
      overdue: overdueTotal
    };
  }, [
    groupOverdueInvoices,
    selectedYearFilter,
    selectedMonthFilter,
    selectedOverdueMonthFilter,
    selectedMatchingFilter,
    invoiceSearchQuery,
    startDateFilter,
    endDateFilter,
    availableMatchingsWithResidual
  ]);

  // PDF / Print Export Handler
  const handlePDFExport = async (isPrint = false) => {
    if (filteredGroupInvoices.length === 0) {
      alert('No data to export');
      return;
    }

    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF('l', 'mm', 'a4');
    const statementTitle = viewMode === 'overdue' ? 'Group Overdue Statement' : 'Group Account Statement';
    doc.setProperties({ title: statementTitle });

    try {
      const { addArabicFont } = await import('@/lib/pdf/shared');
      await addArabicFont(doc);
    } catch (e) {
      console.error('Failed to load Arabic font:', e);
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(statementTitle, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;

    // Company Name
    doc.setFontSize(12);
    doc.setTextColor(0, 155, 77);
    doc.setFont('helvetica', 'bold');
    doc.text('Al Marai Al Arabia Trading Sole Proprietorship L.L.C', pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    // Selected Customers
    doc.setFontSize(11);
    doc.setFont('Amiri', 'normal');
    const customersListStr = groupCustomers.join(', ');
    const displayCustList = customersListStr.length > 100 ? customersListStr.substring(0, 100) + '...' : customersListStr;
    doc.text(`Customers Group: ${displayCustList}`, margin, yPosition);
    yPosition += 6;

    // Date Generated
    const now = new Date();
    const currentDate = `${now.getDate()}-${now.toLocaleDateString('en-US', { month: 'short' })}-${now.getFullYear()}`;
    doc.setFont('helvetica', 'normal');
    doc.text(`Date Generated: ${currentDate}`, margin, yPosition);
    yPosition += 8;

    // Sort by date (oldest first)
    const sortedInvoices = [...filteredGroupInvoices].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });

    // Prepare table data
    const tableData = sortedInvoices.map((inv) => {
      let dateStr = '';
      if (inv.date) {
        const date = new Date(inv.date);
        if (!isNaN(date.getTime())) {
          dateStr = `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
        }
      }
      const type = getInvoiceType({ number: inv.number, debit: inv.debit, credit: inv.credit } as any);
      
      return [
        inv.customerName || '',
        dateStr,
        type,
        (inv.number || '').split(' ')[0],
        inv.debit?.toLocaleString('en-US') || '0',
        inv.credit?.toLocaleString('en-US') || '0',
        inv.difference?.toLocaleString('en-US') || '0'
      ];
    });

    const totalDebit = filteredGroupInvoices.reduce((sum, inv) => sum + (inv.debit || 0), 0);
    const totalCredit = filteredGroupInvoices.reduce((sum, inv) => sum + (inv.credit || 0), 0);
    const totalDifference = totalDebit - totalCredit;

    const tableOptions = {
      startY: yPosition,
      margin: { left: margin, right: margin },
      head: [['Customer Name', 'Date', 'Type', 'Number', 'Debit', 'Credit', 'Net Debt']],
      body: tableData,
      theme: 'striped' as const,
      styles: { font: 'helvetica', fontStyle: 'normal', valign: 'middle', halign: 'center' },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center', font: 'helvetica' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 70, font: 'Amiri' },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 40, font: 'Amiri' },
        4: { cellWidth: 35 },
        5: { cellWidth: 35 },
        6: { cellWidth: 35 }
      },
      didParseCell: function (data: any) {
        if (data.section === 'head') return;
        if (data.column.index === 6) {
          const rowVal = sortedInvoices[data.row.index];
          const nd = rowVal ? rowVal.difference : 0;
          if (nd > 0) data.cell.styles.textColor = [204, 0, 0];
          else if (nd < 0) data.cell.styles.textColor = [0, 153, 0];
        }
      }
    };

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableOptions);
    } else if (typeof autoTable === 'function') {
      autoTable(doc, tableOptions as any);
    }

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;
    const totalBoxWidth = 50;
    const totalBoxHeight = 15;
    const totalBoxX = pageWidth - margin - totalBoxWidth;
    let totalBoxY = finalY + 5;

    if (totalBoxY + totalBoxHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      totalBoxY = 20;
    }

    doc.setFillColor(240, 240, 240);
    doc.rect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL DUE', totalBoxX + totalBoxWidth / 2, totalBoxY + 6, { align: 'center' });
    doc.setFontSize(14);
    doc.text(totalDifference.toLocaleString('en-US'), totalBoxX + totalBoxWidth / 2, totalBoxY + 12, { align: 'center' });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${totalPages}`, margin, doc.internal.pageSize.getHeight() - 10);
    }

    if (isPrint) {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
    } else {
      const fileName = viewMode === 'overdue' ? 'Group_Overdue_Statement' : 'Group_Account_Statement';
      doc.save(`${fileName}_${currentDate}.pdf`);
    }
  };

  // Excel Export Handler
  const handleExcelExport = () => {
    if (filteredGroupInvoices.length === 0) {
      alert('No data to export');
      return;
    }
    const headers = ['Customer Name', 'Date', 'Type', 'Number', 'Debit', 'Credit', 'Net Debt', 'Matching', 'Days Overdue'];
    
    // Sort by date (oldest first)
    const sortedExcelInvoices = [...filteredGroupInvoices].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });

    const rows = sortedExcelInvoices.map(inv => {
      let dateStr = '';
      if (inv.date) {
        const d = new Date(inv.date);
        if (!isNaN(d.getTime())) {
          dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        }
      }
      const type = getInvoiceType({ number: inv.number, debit: inv.debit, credit: inv.credit } as any);
      return [
        inv.customerName || '',
        dateStr,
        type,
        (inv.number || '').split(' ')[0],
        inv.debit || 0,
        inv.credit || 0,
        inv.difference || 0,
        inv.matching || '-',
        inv.daysOverdue || 0
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    const sheetName = viewMode === 'overdue' ? 'Group Overdue Statement' : 'Group Account Statement';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const colWidths = [30, 15, 12, 20, 12, 12, 12, 15, 15];
    worksheet['!cols'] = colWidths.map(w => ({ wch: w }));

    const currentDate = new Date().toISOString().split('T')[0];
    const fileName = viewMode === 'overdue' ? 'Group_Overdue_Statement' : 'Group_Account_Statement';
    XLSX.writeFile(workbook, `${fileName}_${currentDate}.xlsx`);
  };

  // Table Configuration using Tanstack React Table
  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', {
        header: 'Customer Name',
        cell: (info) => (
          <div className="font-bold text-gray-900 text-center mx-auto whitespace-normal break-words">
            {info.getValue()}
          </div>
        )
      }),
      columnHelper.accessor('date', {
        header: 'Date',
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) ? new Date(rowA.getValue(columnId) as string).getTime() : 0;
          const b = rowB.getValue(columnId) ? new Date(rowB.getValue(columnId) as string).getTime() : 0;
          return a - b;
        },
        cell: (info) => {
          const dateStr = info.getValue();
          if (!dateStr) return '';
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          return `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
        },
      }),
      columnHelper.display({
        id: 'type',
        header: 'Type',
        cell: (info) => {
          const inv = info.row.original;
          const type = getInvoiceType({ number: inv.number, debit: inv.debit, credit: inv.credit } as any);
          const color =
            type === 'Sales' ? 'bg-blue-100 text-blue-700' :
              type === 'Return' ? 'bg-orange-100 text-orange-700' :
                type === 'Payment' ? 'bg-green-100 text-green-700' :
                  type === 'Discount' ? 'bg-yellow-100 text-yellow-700' :
                    type === 'Our-Paid' ? 'bg-emerald-100 text-emerald-800' :
                      type === 'OB' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700';
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
              {type}
            </span>
          );
        }
      }),
      columnHelper.accessor('number', {
        header: 'Number',
        cell: (info) => (info.getValue() || '').split(' ')[0],
      }),
      columnHelper.accessor('debit', {
        header: 'Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('credit', {
        header: 'Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('difference', {
        header: 'Net Debt',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600 font-bold' : value < 0 ? 'text-green-600 font-bold' : ''}>
              {value.toLocaleString('en-US')}
            </span>
          );
        },
      }),
      columnHelper.accessor('matching', {
        header: 'Matching',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('daysOverdue', {
        header: 'Days Overdue',
        cell: (info) => {
          const value = info.getValue();
          if (value <= 0) return <span className="text-slate-400">-</span>;
          return (
            <span className="font-bold text-red-600">
              {value}
            </span>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredGroupInvoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  // Helper to get visible page numbers for pagination
  const getPageNumbers = () => {
    const pageCount = table.getPageCount();
    const pageIndex = table.getState().pagination.pageIndex;
    
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, i) => i);
    }
    
    const pages: (number | string)[] = [];
    pages.push(0);
    
    if (pageIndex > 2) {
      pages.push('...');
    }
    
    const start = Math.max(1, pageIndex - 1);
    const end = Math.min(pageCount - 2, pageIndex + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (pageIndex < pageCount - 3) {
      pages.push('...');
    }
    
    pages.push(pageCount - 1);
    return pages;
  };

  // Calculate Totals
  const totalDebit = filteredGroupInvoices.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = filteredGroupInvoices.reduce((sum, item) => sum + item.credit, 0);
  const totalNetDebt = totalDebit - totalCredit;

  return (
    <div className="p-6 space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 shadow-sm flex flex-col">
        {/* Search Input, Add Button, and Statement Type Toggle */}
        <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-end justify-center gap-6" ref={dropdownRef}>
          {/* Left: Customer Selection */}
          <div className="relative flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 text-center md:text-left">
              Select Customers Group
            </label>
            <div className="relative">
            <div
              onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
              className="w-full pl-4 pr-10 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-slate-700 shadow-sm flex items-center justify-between min-h-[46px] text-left hover:border-slate-400 transition-colors cursor-pointer"
            >
              <span className="truncate">
                {groupCustomers.length === 0
                  ? 'Select customers...'
                  : `${groupCustomers.length} customer${groupCustomers.length > 1 ? 's' : ''} selected`}
              </span>
              <div className="flex items-center gap-1.5 text-slate-400">
                {groupCustomers.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGroupCustomers([]);
                    }}
                    className="hover:text-red-500 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                    title="Clear all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <div className="w-[1px] h-4 bg-slate-200" />
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {isCustomerDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-80 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Search input in dropdown */}
                <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg focus:outline-none bg-slate-50/50 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {/* Select All / Clear All helper */}
                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Showing {filteredDropdownCustomers.length} of {allCustomers.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(filteredDropdownCustomers)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                    >
                      {filteredDropdownCustomers.every(c => groupCustomers.includes(c)) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                {/* Customer list with checkboxes */}
                <div className="overflow-y-auto flex-1 max-h-56 divide-y divide-slate-50">
                  {filteredDropdownCustomers.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-400 font-semibold italic text-center">
                      No matching customers
                    </div>
                  ) : (
                    filteredDropdownCustomers.map((cust) => {
                      const isSelected = groupCustomers.includes(cust);
                      return (
                        <label
                          key={cust}
                          className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-sm font-medium ${
                            isSelected ? 'bg-blue-50/30 text-blue-700' : 'text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCustomer(cust)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="truncate">{cust}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Right: Statement Type Toggle */}
          <div className="flex flex-col shrink-0 w-full md:w-auto">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 text-center md:text-left">
              Statement Type
            </label>
            <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-300 shadow-inner h-[46px] items-center">
              <button
                type="button"
                onClick={() => setViewMode('overdue')}
                className={`h-full px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'overdue'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Overdue Only
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`h-full px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'all'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Invoices
              </button>
            </div>
          </div>
        </div>

        {/* Selected Customer Tags Row */}
        {groupCustomers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 items-center justify-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Added Customers:</span>
            {groupCustomers.map(cust => (
              <div
                key={cust}
                className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm"
              >
                <span>{cust}</span>
                <button
                  onClick={() => handleRemoveCustomer(cust)}
                  className="text-slate-400 hover:text-red-500 hover:bg-slate-50 p-0.5 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Control Toolbar */}
      {groupCustomers.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          {/* Quick Stats */}
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {viewMode === 'overdue' ? 'Group Overdue Statement' : 'Group Account Statement'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">Combined statements for added customers</p>
            </div>
            <div className="w-[1px] h-8 bg-slate-200 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Group Total Net Due</span>
              <span className={`text-xl font-extrabold ${totalNetDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totalNetDebt.toLocaleString('en-US')}
              </span>
            </div>
          </div>

          {/* Export & Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePDFExport(false)}
              className="p-2.5 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 text-red-700 transition-all shadow-sm shrink-0 flex items-center justify-center"
              title="Export PDF"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => handlePDFExport(true)}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 transition-all shadow-sm shrink-0 flex items-center justify-center"
              title="Print"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={handleExcelExport}
              className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 text-emerald-700 transition-all shadow-sm shrink-0 flex items-center justify-center"
              title="Export Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Filter and Summary Bar */}
      {groupCustomers.length > 0 && (
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
          showOB={showOB}
          setShowOB={setShowOB}
          showSales={showSales}
          setShowSales={setShowSales}
          showReturns={showReturns}
          setShowReturns={setShowReturns}
          showPayments={showPayments}
          setShowPayments={setShowPayments}
          showDiscounts={showDiscounts}
          setShowDiscounts={setShowDiscounts}
          showJV={showJV}
          setShowJV={setShowJV}
          invoiceTypeTotals={invoiceTypeTotals}
        />
      )}

      {/* Main Overdue Table Grid */}
      {groupCustomers.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: '1200px' }}>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="bg-slate-50 border-b border-slate-200">
                    {headerGroup.headers.map((header) => {
                      const getWidth = () => {
                        const colId = header.column.id;
                        if (colId === 'customerName') return '22%';
                        if (colId === 'date') return '10%';
                        if (colId === 'type') return '8%';
                        if (colId === 'number') return '12%';
                        if (colId === 'debit' || colId === 'credit' || colId === 'difference') return '10%';
                        if (colId === 'matching') return '10%';
                        if (colId === 'daysOverdue') return '8%';
                        return '10%';
                      };
                      return (
                        <th
                          key={header.id}
                          style={{ width: getWidth() }}
                          onClick={header.column.getToggleSortingHandler()}
                          className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        >
                          <div className="flex items-center justify-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: ' ↑',
                              desc: ' ↓',
                            }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-200">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-12">
                      <NoData />
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/70 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      {row.getVisibleCells().map((cell) => {
                        return (
                          <td
                            key={cell.id}
                            className="px-4 py-3 text-center text-sm"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
                {/* Total Summary Row */}
                {filteredGroupInvoices.length > 0 && (
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <td className="px-4 py-4 text-center text-sm text-slate-900 font-extrabold uppercase">
                      TOTAL
                    </td>
                    <td colSpan={3}></td>
                    <td className="px-4 py-4 text-center text-sm text-slate-950 font-extrabold">
                      {totalDebit.toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-slate-950 font-extrabold">
                      {totalCredit.toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-extrabold text-red-700">
                      {totalNetDebt.toLocaleString('en-US')}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredGroupInvoices.length > 0 && (
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 font-medium">Show</span>
                  <select
                    value={table.getState().pagination.pageSize === 999999 ? 'all' : table.getState().pagination.pageSize}
                    onChange={(e) => {
                      const val = e.target.value;
                      table.setPageSize(val === 'all' ? 999999 : Number(val));
                    }}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">All</option>
                  </select>
                </div>
                
                <div className="text-sm text-slate-500 font-medium">
                  Showing{' '}
                  {table.getState().pagination.pageIndex * (table.getState().pagination.pageSize === 999999 ? filteredGroupInvoices.length : table.getState().pagination.pageSize) + 1}{' '}
                  to{' '}
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * (table.getState().pagination.pageSize === 999999 ? filteredGroupInvoices.length : table.getState().pagination.pageSize),
                    filteredGroupInvoices.length
                  )}{' '}
                  of {filteredGroupInvoices.length} results
                </div>
              </div>

              {/* Page Numbers */}
              {table.getState().pagination.pageSize !== 999999 && table.getPageCount() > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    title="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {getPageNumbers().map((page, idx) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2.5 py-1 text-slate-400 font-medium select-none">
                          ...
                        </span>
                      );
                    }
                    const isActive = table.getState().pagination.pageIndex === page;
                    return (
                      <button
                        key={`page-${page}`}
                        onClick={() => table.setPageIndex(page as number)}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        {(page as number) + 1}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    title="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <NoData title="NO CUSTOMERS ADDED" />
        </div>
      )}

    </div>
  );
}
