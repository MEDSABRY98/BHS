'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { InvoiceRow, CustomerAnalysis } from '@/types';
import NoData from '../../01-Unified/NoDataTab';
import CustomerDetailsTab from '../CustomerDetailsTab';
import {
  generateAccountStatementPDF,
  generateBulkDebitSummaryPDF,
  generateBulkCustomerStatementsPDF
} from '@/lib/pdf/PdfUtils';
import { FileSpreadsheet, FileText } from 'lucide-react';

// Sub-components
import DefaultView from './Views/DefaultView';
import SummaryView from './Views/SummaryView';
import YearlyView from './Views/YearlyView';
import FilterModal from './Modals/FilterModal';
import RatingBreakdownModal from './Modals/RatingBreakdownModal';
import CollectionStatsModal from './Modals/CollectionStatsModal';
import MonthlyBreakdownModal from './Modals/MonthlyBreakdownModal';
import EmailStatementModal from './Modals/EmailStatementModal';

// Logic & Utils
import { useCustomerData } from './CustomersData';
import {
  copyToClipboard,
  formatDmy,
  calculateCustomerMonthlyBreakdown,
  calculateDebtRating,
  buildInvoicesWithNetDebtForExport,
  exportToExcel,
  exportToPDF
} from './CstomersUtils';

interface CustomersTabProps {
  data: InvoiceRow[];
  mode?: 'DEBIT' | 'OB_POS' | 'OB_NEG' | 'CREDIT';
  onBack?: () => void;
  initialCustomer?: string;
  onCustomerToggle?: (isOpen: boolean) => void;
}

const columnHelper = createColumnHelper<CustomerAnalysis>();

export default function CustomersTab({
  data,
  mode = 'DEBIT',
  onBack,
  initialCustomer,
  onCustomerToggle,
}: CustomersTabProps) {
  // --- States ---
  const [sorting, setSorting] = useState<SortingState>([]);
  const [viewMode, setViewMode] = useState<'DEFAULT' | 'SUMMARY' | 'YEARLY'>('DEFAULT');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(initialCustomer || null);
  const [selectedCustomersForDownload, setSelectedCustomersForDownload] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedCollectionStats, setSelectedCollectionStats] = useState<any | null>(null);
  const [selectedRatingCustomer, setSelectedRatingCustomer] = useState<CustomerAnalysis | null>(null);
  const [ratingBreakdown, setRatingBreakdown] = useState<any | null>(null);
  const [selectedCustomerForMonths, setSelectedCustomerForMonths] = useState<string | null>(null);
  const [isEmailDateModalOpen, setIsEmailDateModalOpen] = useState(false);
  const [emailStatementDate, setEmailStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [yearlySorting, setYearlySorting] = useState<{ id: string; desc: boolean }>({ id: 'totalNetDebt', desc: true });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    filterYear: '',
    filterMonth: '',
    dateRangeFrom: '',
    dateRangeTo: '',
    invoiceTypeFilter: 'ALL' as 'ALL' | 'OB' | 'SAL',
    matchingFilter: 'ALL',
    selectedSalesRep: 'ALL',
    closedFilter: 'ALL' as 'ALL' | 'HIDE' | 'ONLY',
    semiClosedFilter: 'ALL' as 'ALL' | 'HIDE' | 'ONLY',
    debtOperator: 'GT',
    debtAmount: '',
    collectionRateOperator: 'GT',
    collectionRateValue: '',
    collectionRateTypes: new Set(['PAYMENT', 'RETURN', 'DISCOUNT']),
    lastPaymentValue: '',
    lastPaymentUnit: 'DAYS' as 'DAYS' | 'MONTHS',
    lastPaymentStatus: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    lastPaymentAmountOperator: 'GT',
    lastPaymentAmountValue: '',
    hasOB: false,
    overdueAmount: '',
    overdueAging: 'ALL',
    netSalesOperator: 'GT',
    minTotalDebit: '',
    noSalesValue: '',
    noSalesUnit: 'DAYS' as 'DAYS' | 'MONTHS',
    lastSalesStatus: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    lastSalesAmountOperator: 'GT',
    lastSalesAmountValue: '',
    dateRangeType: 'LAST_TRANSACTION' as 'LAST_TRANSACTION' | 'LAST_SALE' | 'LAST_PAYMENT',
    debtType: 'ALL' as 'ALL' | 'DEBTOR' | 'CREDITOR',
    selectedReps: [] as string[]
  });

  // --- Logic Hook ---
  const {
    customerAnalysis,
    filteredData,
    closedCustomers,
    semiClosedCustomers,
    spiData,
    customersWithEmails,
    yearlyPivotData,
    allSalesReps
  } = useCustomerData(data, filters, mode, yearlySorting);

  const totalNetDebt = useMemo(() => {
    return filteredData.reduce((sum, c) => sum + c.netDebt, 0);
  }, [filteredData]);

  // --- Handlers ---
  const toggleCustomerSelection = (customerName: string) => {
    setSelectedCustomersForDownload(prev => {
      const next = new Set(prev);
      if (next.has(customerName)) next.delete(customerName);
      else next.add(customerName);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCustomersForDownload.size === filteredData.length) {
      setSelectedCustomersForDownload(new Set());
    } else {
      setSelectedCustomersForDownload(new Set(filteredData.map(c => c.customerName)));
    }
  };

  const handleCustomerSelect = (name: string) => {
    setSelectedCustomer(name);
    if (onCustomerToggle) onCustomerToggle(true);
  };

  const handleYearlySort = (id: string) => {
    setYearlySorting(prev => ({
      id,
      desc: prev.id === id ? !prev.desc : true
    }));
  };

  const handleBulkDownload = async () => {
    if (selectedCustomersForDownload.size === 0) {
      alert('Please select customers to download');
      return;
    }
    setIsDownloading(true);
    try {
      const customersToDehydrate = filteredData.filter(c => selectedCustomersForDownload.has(c.customerName));
      const pdfBlob = await generateBulkDebitSummaryPDF(customersToDehydrate);
      if (pdfBlob) {
        const { saveAs } = await import('file-saver');
        saveAs(pdfBlob as Blob, `Debit_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) {
      console.error('Error generating summary PDF:', error);
      alert('Error downloading file');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBulkZIPDownload = async () => {
    if (selectedCustomersForDownload.size === 0) {
      alert('Please select customers to download');
      return;
    }
    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();
      let count = 0;

      for (const customerName of selectedCustomersForDownload) {
        const customerInvoices = data.filter(row => row.customerName === customerName);
        if (customerInvoices.length === 0) continue;

        const invoicesWithNetDebt = buildInvoicesWithNetDebtForExport(customerInvoices);
        const netOnlyInvoices = invoicesWithNetDebt
          .filter(inv => !inv.matching || (inv.residual !== undefined && Math.abs(inv.residual) > 0.01))
          .map(inv => inv.matching && inv.residual !== undefined ? { ...inv, credit: inv.debit - inv.residual, netDebt: inv.residual } : inv);

        if (netOnlyInvoices.length === 0) continue;

        const pdfBlob = await generateAccountStatementPDF(customerName, netOnlyInvoices, true, 'All Months (Net Only)');
        if (pdfBlob) {
          const cleanName = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim();
          zip.file(`${cleanName}.pdf`, pdfBlob as Blob);
          count++;
        }
      }

      if (count > 0) {
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `Customer_Statements_${new Date().toISOString().split('T')[0]}.zip`);
        setSelectedCustomersForDownload(new Set());
      } else {
        alert('No files generated.');
      }
    } catch (error) {
      console.error('Error in bulk download:', error);
      alert('Error downloading ZIP.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBulkEmail = async (overrideDate?: string) => {
    if (selectedCustomersForDownload.size === 0) {
      alert('Please select customers to email');
      return;
    }

    if (!overrideDate && !isEmailDateModalOpen) {
      setIsEmailDateModalOpen(true);
      return;
    }

    const effectiveDate = overrideDate || emailStatementDate;
    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();
      let count = 0;

      for (const customerName of selectedCustomersForDownload) {
        const customerInvoices = data.filter(row => row.customerName === customerName);
        if (customerInvoices.length === 0) continue;

        const invoicesWithNetDebt = buildInvoicesWithNetDebtForExport(customerInvoices);
        const netOnlyInvoices = invoicesWithNetDebt
          .filter(inv => !inv.matching || (inv.residual !== undefined && Math.abs(inv.residual) > 0.01))
          .map(inv => inv.matching && inv.residual !== undefined ? { ...inv, credit: inv.debit - inv.residual, netDebt: inv.residual } : inv);

        if (netOnlyInvoices.length === 0) continue;

        const netDebt = netOnlyInvoices.reduce((sum, inv) => sum + (inv.netDebt || 0), 0);
        const dateLabel = effectiveDate ? `Up To ${formatDmy(new Date(effectiveDate))}` : 'All Months (Net Only)';
        const pdfBlob = await generateAccountStatementPDF(customerName, netOnlyInvoices, true, dateLabel);
        if (!pdfBlob) continue;

        const reader = new FileReader();
        const pdfBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(pdfBlob as Blob);
        });

        const cleanName = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim();
        const boundary = "----=_NextPart_000_0001_01C2A9A1.12345678";
        const subject = 'Statement of Account - Al Marai Al Arabia Trading Sole Proprietorship L.L.C';
        const htmlBody = `Dear Team,\n\nWe hope this message finds you well.\n\nYour current balance ${effectiveDate ? 'as of ' + formatDmy(new Date(effectiveDate)) : ''} is: ${netDebt.toLocaleString('en-US')} AED\n\nPlease find attached your account statement.`;

        const emlLines = [
          'From: accounting@marae.ae',
          'Subject: ' + subject,
          'X-Unsent: 1',
          'Content-Type: multipart/mixed; boundary="' + boundary + '"',
          '',
          '--' + boundary,
          'Content-Type: text/plain; charset="UTF-8"',
          '',
          htmlBody,
          '',
          '--' + boundary,
          `Content-Type: application/pdf; name="${cleanName}.pdf"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${cleanName}.pdf"`,
          '',
          pdfBase64,
          '',
          '--' + boundary + '--'
        ];

        zip.file(`${cleanName}.eml`, emlLines.join('\r\n'));
        count++;
      }

      if (count > 0) {
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `Customer_Emails_${new Date().toISOString().split('T')[0]}.zip`);
        setIsEmailDateModalOpen(false);
      }
    } catch (error) {
      console.error('Error in bulk email:', error);
      alert('Error generating emails.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBulkPrint = async () => {
    setIsDownloading(true);
    try {
      const customersToPrint = Array.from(selectedCustomersForDownload);
      if (customersToPrint.length === 0) return;

      const statements: Array<{ customerName: string; invoices: any[] }> = [];
      for (const custName of customersToPrint) {
        const customerRows = data.filter(r => r.customerName === custName);
        if (customerRows.length === 0) continue;

        const invoicesWithNetDebt = buildInvoicesWithNetDebtForExport(customerRows);
        const netOnlyInvoices = invoicesWithNetDebt
          .filter(inv => !inv.matching || (inv.residual !== undefined && Math.abs(inv.residual) > 0.01))
          .map(inv => inv.matching && inv.residual !== undefined ? { ...inv, credit: inv.debit - inv.residual, netDebt: inv.residual } : inv);

        if (netOnlyInvoices.length === 0) continue;
        statements.push({ customerName: custName, invoices: netOnlyInvoices });
      }

      const pdfBlob = await generateBulkCustomerStatementsPDF(statements);
      const url = URL.createObjectURL(pdfBlob as Blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error generating bulk print:', error);
      alert('Error generating print document.');
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Table Setup ---
  const columns = useMemo(() => [
    columnHelper.accessor('customerName', {
      header: () => (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filteredData.length > 0 && selectedCustomersForDownload.size === filteredData.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            title="Select All"
            onClick={(e) => e.stopPropagation()}
          />
          <span>Customer Name</span>
        </div>
      ),
      cell: (info) => {
        const name = info.getValue();
        return (
          <div className="flex items-center gap-2 w-full">
            <input
              type="checkbox"
              checked={selectedCustomersForDownload.has(name)}
              onChange={() => toggleCustomerSelection(name)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 shrink-0"
            />
            <button
              onClick={() => {
                setSelectedCustomer(name);
                if (onCustomerToggle) onCustomerToggle(true);
              }}
              className="font-bold text-gray-900 hover:text-blue-600 text-left transition-colors truncate"
            >
              {name}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(name);
              }}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              title="Copy"
            >
              <FileText size={14} />
            </button>
          </div>
        );
      }
    }),
    columnHelper.accessor('salesReps', {
      id: 'city',
      header: 'City',
      cell: (info) => {
        const val = info.getValue();
        if (val && val instanceof Set && val.size > 0) return Array.from(val).join(', ');
        if (Array.isArray(val) && val.length > 0) return val.join(', ');
        return '-';
      }
    }),
    columnHelper.accessor('netDebt', {
      header: 'Net Debit',
      cell: (info) => (
        <button
          onClick={() => setSelectedCustomerForMonths(info.row.original.customerName)}
          className={`font-bold ${info.getValue() > 0 ? 'text-red-600' : info.getValue() < 0 ? 'text-green-600' : 'text-gray-600'}`}
        >
          {info.getValue().toLocaleString('en-US')}
        </button>
      )
    }),
    columnHelper.display({
      id: 'collRate',
      header: mode === 'OB_POS' || mode === 'OB_NEG' ? 'Open OB Amount' : 'Collection Rate',
      cell: (info) => {
        const c = info.row.original;
        const rate = c.totalDebit > 0 ? (c.totalCredit / c.totalDebit * 100) : 0;
        return (
          <button
            onClick={() => {
              // Calculate ranks on the fly or pass pre-calculated
              const stats = customerAnalysis.map(ca => ({
                name: ca.customerName,
                collRate: ca.totalDebit > 0 ? (ca.totalCredit / ca.totalDebit * 100) : 0,
                payRate: ca.totalCredit > 0 ? (ca.creditPayments / ca.totalCredit * 100) : 0,
                returnRate: ca.totalCredit > 0 ? (ca.creditReturns / ca.totalCredit * 100) : 0,
                discountRate: ca.totalCredit > 0 ? (ca.creditDiscounts / ca.totalCredit * 100) : 0,
              }));
              const getRank = (metric: string) => [...stats].sort((a, b) => (b as any)[metric] - (a as any)[metric]).findIndex(s => s.name === c.customerName) + 1;
              setSelectedCollectionStats({
                customer: c,
                ranks: { collRank: getRank('collRate'), payRank: getRank('payRate'), returnRank: getRank('returnRate'), discountRank: getRank('discountRate'), totalCount: customerAnalysis.length },
                rates: { payRate: c.totalCredit > 0 ? (c.creditPayments / c.totalCredit * 100) : 0, returnRate: c.totalCredit > 0 ? (c.creditReturns / c.totalCredit * 100) : 0, discountRate: c.totalCredit > 0 ? (c.creditDiscounts / c.totalCredit * 100) : 0 }
              });
            }}
            className={`font-bold ${rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}
          >
            {rate.toFixed(1)}%
          </button>
        );
      }
    }),
    columnHelper.display({
      id: 'debtRating',
      header: 'Rating',
      cell: (info) => {
        const rating = calculateDebtRating(info.row.original, closedCustomers);
        return (
          <button
            onClick={() => {
              const breakdown = calculateDebtRating(info.row.original, closedCustomers, true);
              setSelectedRatingCustomer(info.row.original);
              setRatingBreakdown(breakdown);
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold border ${rating === 'Good' ? 'bg-green-50 text-green-600 border-green-200' : rating === 'Medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-red-50 text-red-600 border-red-200'}`}
          >
            {rating}
          </button>
        );
      }
    })
  ], [filteredData, selectedCustomersForDownload, customerAnalysis, closedCustomers]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const headerCount = useMemo(() => {
    if (viewMode === 'YEARLY') return yearlyPivotData.rows.length;
    return table.getRowModel().rows.length;
  }, [viewMode, table.getRowModel().rows, yearlyPivotData.rows]);

  const headerTotal = useMemo(() => {
    if (viewMode === 'YEARLY') return yearlyPivotData.rows.reduce((sum, r) => sum + r.totalNetDebt, 0);
    return table.getRowModel().rows.reduce((sum, r) => sum + r.original.netDebt, 0);
  }, [viewMode, table.getRowModel().rows, yearlyPivotData.rows]);

  // --- Render logic ---
  if (selectedCustomer) {
    return (
      <CustomerDetailsTab
        customerName={selectedCustomer}
        onBack={() => {
          setSelectedCustomer(null);
          if (onCustomerToggle) onCustomerToggle(false);
        }}
        invoices={data.filter(inv =>
          inv.customerName?.toString().toLowerCase().trim() === selectedCustomer.toLowerCase().trim()
        )}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header Toolbar */}
      <div className="p-2 bg-white border-b border-gray-200 flex items-center gap-3 sticky top-0 z-30 shadow-sm overflow-x-auto no-scrollbar">
        <div className="w-10 shrink-0">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-1 items-center justify-center gap-2">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-black shadow-sm" title="Total Customers">
            {headerCount}
          </span>
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-black shadow-sm" title="Total Net Debt">
            {Math.round(headerTotal).toLocaleString('en-US')}
          </span>

          <div className="relative group min-w-[480px]">
            <input
              type="text"
              placeholder="Search customers..."
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm py-2 px-4 pl-9 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-bold"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="h-6 w-px bg-gray-200 mx-1 shrink-0"></div>

          {/* View Mode Toggle */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center shrink-0">
            {(['DEFAULT', 'SUMMARY', 'YEARLY'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsFiltersOpen(true)}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:border-blue-400 text-gray-700 hover:text-blue-600 transition-all shadow-sm shrink-0"
            title="Advanced Filters"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>

          <div className="h-6 w-px bg-gray-200 mx-1 shrink-0"></div>

          <button onClick={() => exportToExcel(filteredData, 'Customers_Report', closedCustomers, data, yearlyPivotData)} className="p-2.5 bg-white border border-gray-200 rounded-xl hover:border-green-400 text-green-600 transition-all shadow-sm shrink-0" title="Export Excel">
            <FileSpreadsheet size={20} />
          </button>
          <button onClick={() => exportToPDF(filteredData, 'Customers_PDF_Report', closedCustomers)} className="p-2.5 bg-white border border-gray-200 rounded-xl hover:border-red-400 text-red-600 transition-all shadow-sm shrink-0" title="Export PDF">
            <FileText size={20} />
          </button>

          {selectedCustomersForDownload.size > 0 && (
            <div className="flex items-center gap-1 bg-blue-600 p-1 rounded-xl shadow-lg animate-in zoom-in-95 duration-200 shrink-0">
              <button onClick={handleBulkDownload} className="w-9 h-9 flex items-center justify-center hover:bg-white/20 rounded-lg text-white transition-colors font-black text-sm" title="Download Summary PDF">
                D
              </button>
              <button onClick={handleBulkZIPDownload} className="w-9 h-9 flex items-center justify-center hover:bg-white/20 rounded-lg text-white transition-colors font-black text-sm" title="Download ZIP Statements">
                AS
              </button>
              <button onClick={handleBulkPrint} className="w-9 h-9 flex items-center justify-center hover:bg-white/20 rounded-lg text-white transition-colors font-black text-sm" title="Bulk Print Statements">
                P
              </button>
              <button onClick={() => setIsEmailDateModalOpen(true)} className="w-9 h-9 flex items-center justify-center hover:bg-white/20 rounded-lg text-white transition-colors font-black text-sm" title="Generate ZIP for Email">
                E
              </button>
              <div className="w-px h-6 bg-white/20 mx-1"></div>
              <button onClick={() => setSelectedCustomersForDownload(new Set())} className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors" title="Clear selection">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="w-10 shrink-0"></div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 md:p-6">

        {viewMode === 'DEFAULT' && (
          <DefaultView
            table={table}
            selectedCustomersForDownload={selectedCustomersForDownload}
            toggleCustomerSelection={toggleCustomerSelection}
            setSelectedCustomer={handleCustomerSelect}
            setSelectedCustomerForMonths={setSelectedCustomerForMonths}
            setSelectedCollectionStats={setSelectedCollectionStats}
            setSelectedRatingCustomer={setSelectedRatingCustomer}
            setRatingBreakdown={setRatingBreakdown}
            closedCustomers={closedCustomers}
            mode={mode}
            customerAnalysis={customerAnalysis}
            filteredData={filteredData}
            isDateFilterActive={!!(filters.filterYear || filters.filterMonth || filters.dateRangeFrom || filters.dateRangeTo)}
          />
        )}

        {viewMode === 'SUMMARY' && (
          <SummaryView
            table={table}
            filteredData={filteredData}
            selectedCustomersForDownload={selectedCustomersForDownload}
            toggleCustomerSelection={toggleCustomerSelection}
            toggleSelectAll={toggleSelectAll}
            setSelectedCustomer={handleCustomerSelect}
            closedCustomers={closedCustomers}
          />
        )}

        {viewMode === 'YEARLY' && yearlyPivotData && (
          <YearlyView
            yearlyPivotData={yearlyPivotData}
            selectedCustomersForDownload={selectedCustomersForDownload}
            setSelectedCustomersForDownload={setSelectedCustomersForDownload}
            toggleCustomerSelection={toggleCustomerSelection}
            setSelectedCustomer={handleCustomerSelect}
            yearlySorting={yearlySorting}
            handleYearlySort={handleYearlySort}
          />
        )}

        {filteredData.length === 0 && <NoData />}
      </div>

      {/* Modals */}
      <FilterModal
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        setFilters={setFilters}
        allSalesReps={allSalesReps}
        filteredDataCount={filteredData.length}
      />

      <RatingBreakdownModal
        customer={selectedRatingCustomer}
        breakdown={ratingBreakdown}
        onClose={() => { setSelectedRatingCustomer(null); setRatingBreakdown(null); }}
      />

      <CollectionStatsModal
        stats={selectedCollectionStats}
        onClose={() => setSelectedCollectionStats(null)}
      />

      <MonthlyBreakdownModal
        customerName={selectedCustomerForMonths}
        monthlyData={selectedCustomerForMonths ? calculateCustomerMonthlyBreakdown(selectedCustomerForMonths, data) : null}
        onClose={() => setSelectedCustomerForMonths(null)}
      />

      <EmailStatementModal
        isOpen={isEmailDateModalOpen}
        onClose={() => setIsEmailDateModalOpen(false)}
        emailStatementDate={emailStatementDate}
        setEmailStatementDate={setEmailStatementDate}
        onConfirm={(date) => {
          setIsEmailDateModalOpen(false);
          handleBulkEmail(date);
        }}
        isProcessing={isDownloading}
      />
    </div>
  );
}
