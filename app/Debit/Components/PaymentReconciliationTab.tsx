'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  PaginationState,
} from '@tanstack/react-table';
import {
  Search,
  X,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Printer,
  Wallet,
  ArrowDownWideNarrow,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlignLeft,
  AlignRight,
} from 'lucide-react';
import { InvoiceRow } from '@/types';
import NoData from '@/app/Components/DataState/NoDataTab';
import { useDebouncedValue } from '../Hooks/useDebouncedValue';
import { buildOpenInvoiceRows, getUniqueCustomerNames, OpenInvoiceRow } from '../Utils/openInvoiceRows';
import { exportDebitExcelTable } from '../Utils/ExcelExport';
import { generatePaymentReconciliationPDF } from '../Pdf/PaymentReconciliationUtils';

interface PaymentReconciliationTabProps {
  data: InvoiceRow[];
}

const columnHelper = createColumnHelper<OpenInvoiceRow>();

function parseAmount(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAppliedAmount(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatOpenAmount(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '-';
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ApplyAmountInput({
  applied,
  onCommit,
}: {
  applied?: number;
  onCommit: (raw: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = isEditing
    ? draft
    : applied === undefined
      ? ''
      : formatAppliedAmount(applied);

  return (
    <div className="flex justify-center">
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={() => {
          setIsEditing(true);
          setDraft(applied === undefined ? '' : String(applied));
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(draft);
          setIsEditing(false);
        }}
        className="w-32 px-2 py-1 text-sm border border-gray-300 rounded-md text-center font-mono tabular-nums"
      />
    </div>
  );
}

export default function PaymentReconciliationTab({ data = [] }: PaymentReconciliationTabProps) {
  const safeData = Array.isArray(data) ? data : [];

  const [groupCustomers, setGroupCustomers] = useState<string[]>([]);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const debouncedTableSearch = useDebouncedValue(tableSearchQuery);
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [selectedOverdueMonthFilter, setSelectedOverdueMonthFilter] = useState<string[]>([]);
  const [isOverdueMonthDropdownOpen, setIsOverdueMonthDropdownOpen] = useState(false);
  const [appliedByRow, setAppliedByRow] = useState<Map<string, number>>(new Map());
  const [remainderNote, setRemainderNote] = useState('');
  const [remainderNoteAlign, setRemainderNoteAlign] = useState<'left' | 'right'>('left');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });

  const dropdownRef = useRef<HTMLDivElement>(null);

  const allCustomers = useMemo(() => getUniqueCustomerNames(safeData), [safeData]);

  const filteredDropdownCustomers = useMemo(() => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) return allCustomers;
    return allCustomers.filter((c) => c.toLowerCase().includes(q));
  }, [allCustomers, customerSearchQuery]);

  const openRows = useMemo(
    () => buildOpenInvoiceRows(safeData, groupCustomers),
    [safeData, groupCustomers],
  );

  const availableOverdueMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    openRows.forEach((row) => {
      if (!row.date || row.daysOverdue <= 0) return;
      const date = new Date(row.date);
      if (Number.isNaN(date.getTime())) return;
      monthsSet.add(date.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
    });
    return Array.from(monthsSet).sort((a, b) => {
      const dateA = new Date(`1 ${a}`);
      const dateB = new Date(`1 ${b}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [openRows]);

  const filteredRows = useMemo(() => {
    let filtered = openRows;

    if (dateFromFilter || dateToFilter) {
      filtered = filtered.filter((row) => {
        if (!row.date) return false;
        const d = new Date(row.date);
        if (Number.isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);

        if (dateFromFilter) {
          const from = new Date(dateFromFilter);
          from.setHours(0, 0, 0, 0);
          if (d < from) return false;
        }
        if (dateToFilter) {
          const to = new Date(dateToFilter);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      });
    }

    if (selectedOverdueMonthFilter.length > 0) {
      filtered = filtered.filter((row) => {
        if (!row.date) return false;
        const date = new Date(row.date);
        if (Number.isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return selectedOverdueMonthFilter.includes(monthYear);
      });
    }

    if (debouncedTableSearch.trim()) {
      const q = debouncedTableSearch.toLowerCase();
      filtered = filtered.filter(
        (row) =>
          row.customerName.toLowerCase().includes(q) ||
          row.number.toLowerCase().includes(q) ||
          row.matching.toLowerCase().includes(q) ||
          row.date.toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [openRows, debouncedTableSearch, dateFromFilter, dateToFilter, selectedOverdueMonthFilter]);

  const paymentAmount = parseAmount(paymentAmountInput);

  const totalApplied = useMemo(() => {
    let sum = 0;
    appliedByRow.forEach((v) => {
      sum += v;
    });
    return sum;
  }, [appliedByRow]);

  const remainder = paymentAmount - totalApplied;
  const isOverAllocated = remainder < -0.009;
  const hasValidPayment = paymentAmount > 0.009;
  const appliedLines = useMemo(() => {
    return openRows
      .filter((row) => appliedByRow.has(row.rowKey))
      .map((row) => {
        const appliedAmount = appliedByRow.get(row.rowKey) || 0;
        return {
          customerName: row.customerName,
          date: row.date,
          number: row.number,
          totalAmount: row.openAmount,
          appliedAmount,
          openAmount: row.openAmount - appliedAmount,
          matching: row.matching,
        };
      });
  }, [openRows, appliedByRow]);

  const canExport = hasValidPayment && appliedLines.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setAppliedByRow(new Map());
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [groupCustomers]);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [debouncedTableSearch, dateFromFilter, dateToFilter, selectedOverdueMonthFilter]);

  const toggleCustomer = (cust: string) => {
    setGroupCustomers((prev) =>
      prev.includes(cust) ? prev.filter((c) => c !== cust) : [...prev, cust],
    );
  };

  const handleSelectAllCustomers = (filtered: string[]) => {
    const allSelected = filtered.every((c) => groupCustomers.includes(c));
    if (allSelected) {
      setGroupCustomers((prev) => prev.filter((c) => !filtered.includes(c)));
    } else {
      setGroupCustomers((prev) => {
        const next = [...prev];
        filtered.forEach((c) => {
          if (!next.includes(c)) next.push(c);
        });
        return next;
      });
    }
  };

  const toggleRowApplied = (row: OpenInvoiceRow, checked: boolean) => {
    setAppliedByRow((prev) => {
      const next = new Map(prev);
      if (checked) {
        const existing = prev.get(row.rowKey);
        if (existing !== undefined) {
          next.set(row.rowKey, existing);
        } else {
          next.set(row.rowKey, Math.abs(row.openAmount));
        }
      } else {
        next.delete(row.rowKey);
      }
      return next;
    });
  };

  const setRowAppliedAmount = useCallback((rowKey: string, raw: string) => {
    if (!raw.trim()) {
      setAppliedByRow((prev) => {
        const next = new Map(prev);
        next.delete(rowKey);
        return next;
      });
      return;
    }

    const value = parseAmount(raw);
    setAppliedByRow((prev) => {
      const next = new Map(prev);
      if (!Number.isFinite(value)) return prev;
      next.set(rowKey, value);
      return next;
    });
  }, []);

  const handleAutoFifo = () => {
    if (!hasValidPayment) return;
    const sorted = [...openRows].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db;
    });
    let left = paymentAmount;
    const next = new Map<string, number>();
    for (const row of sorted) {
      if (left <= 0.009) break;
      const apply = Math.min(Math.abs(row.openAmount), left);
      if (apply > 0.009) {
        next.set(row.rowKey, apply);
        left -= apply;
      }
    }
    setAppliedByRow(next);
  };

  const buildPdfInput = () => ({
    paymentAmount,
    paymentDate: paymentDate || undefined,
    paymentReference: paymentReference || undefined,
    customers: groupCustomers,
    lines: appliedLines,
    totalApplied,
    remainder,
    remainderNote: remainderNote || undefined,
    remainderNoteAlign,
  });

  const handlePdf = async (print: boolean) => {
    if (!canExport) {
      alert('Enter a valid payment amount and allocate at least one invoice before exporting.');
      return;
    }
    await generatePaymentReconciliationPDF(buildPdfInput(), { print, download: !print });
  };

  const handleExcel = async () => {
    if (!canExport) {
      alert('Enter a valid payment amount and allocate at least one invoice before exporting.');
      return;
    }
    const headers = ['Customer', 'Date', 'Invoice', 'Total Amount', 'Applied', 'Open Amount', 'Matching'];
    const rows = appliedLines.map((line) => [
      line.customerName,
      line.date,
      line.number,
      line.totalAmount,
      line.appliedAmount,
      line.openAmount,
      line.matching || '',
    ]);
    rows.push(['', '', 'TOTAL', '', totalApplied, '', '']);
    rows.push(['', '', 'REMAINDER', '', remainder, '', remainderNote || '']);

    await exportDebitExcelTable(
      headers,
      rows,
      `payment_reconciliation_${new Date().toISOString().split('T')[0]}`,
      {
        sheetName: 'Payment Reconciliation',
        numericColumns: ['Total Amount', 'Applied', 'Open Amount'],
      },
    );
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'rowNumber',
        header: '#',
        cell: ({ row }) => (
          <span className="font-bold text-slate-500 block text-center">
            {pagination.pageIndex * pagination.pageSize + row.index + 1}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'select',
        header: () => 'Apply',
        cell: ({ row }) => {
          const isChecked = appliedByRow.has(row.original.rowKey);
          return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => toggleRowApplied(row.original, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          );
        },
      }),
      columnHelper.accessor('customerName', { header: 'Customer' }),
      columnHelper.accessor('date', {
        header: 'Date',
        cell: (info) => {
          const d = info.getValue();
          if (!d) return '-';
          const parsed = new Date(d);
          return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString('en-GB');
        },
      }),
      columnHelper.accessor('number', { header: 'Invoice' }),
      columnHelper.accessor('openAmount', {
        id: 'totalAmount',
        header: 'Total Amount',
        cell: (info) => (
          <span className="font-mono tabular-nums text-slate-800 font-semibold block text-center">
            {formatOpenAmount(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'applied',
        header: 'Apply Amount',
        cell: ({ row }) => (
          <ApplyAmountInput
            applied={appliedByRow.get(row.original.rowKey)}
            onCommit={(raw) => setRowAppliedAmount(row.original.rowKey, raw)}
          />
        ),
      }),
      columnHelper.display({
        id: 'openAmount',
        header: 'Open Amount',
        cell: ({ row }) => {
          const applied = appliedByRow.get(row.original.rowKey);
          const remaining =
            applied !== undefined
              ? row.original.openAmount - applied
              : row.original.openAmount;

          return (
            <span
              className={`font-mono tabular-nums font-semibold block text-center ${
                applied !== undefined && remaining < -0.009
                  ? 'text-red-600'
                  : applied !== undefined && remaining > 0.009
                    ? 'text-amber-600'
                    : applied !== undefined
                      ? 'text-emerald-600'
                      : 'text-red-700'
              }`}
            >
              {formatAmount(remaining)}
            </span>
          );
        },
      }),
      columnHelper.accessor('matching', {
        header: 'Matching',
        cell: (info) => info.getValue() || '-',
      }),
    ],
    [appliedByRow, setRowAppliedAmount, pagination.pageIndex, pagination.pageSize],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination },
    onPaginationChange: setPagination,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Wallet className="w-6 h-6 text-emerald-600" />
          <h1 className="text-xl font-bold text-slate-800">Payment Reconciliation</h1>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
            <div ref={dropdownRef} className="relative xl:col-span-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Select Customers
              </label>
              <div
                onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                className="w-full pl-4 pr-10 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 shadow-sm flex items-center justify-between min-h-[46px] cursor-pointer hover:border-slate-400"
              >
                <span className="truncate">
                  {groupCustomers.length === 0
                    ? 'Select customers...'
                    : `${groupCustomers.length} customer${groupCustomers.length > 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isCustomerDropdownOpen ? 'rotate-180' : ''}`}
                />
              </div>

              {isCustomerDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-80 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search customers..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectAllCustomers(filteredDropdownCustomers);
                      }}
                      className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Toggle all visible
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-2">
                    {filteredDropdownCustomers.map((cust) => (
                      <label
                        key={cust}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={groupCustomers.includes(cust)}
                          onChange={() => toggleCustomer(cust)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span className="truncate">{cust}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="xl:col-span-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Payment Amount (AED)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={paymentAmountInput}
                onChange={(e) => setPaymentAmountInput(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold shadow-sm"
              />
            </div>
            <div className="xl:col-span-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Reconcile Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm shadow-sm"
              />
            </div>
            <div className="xl:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Reference
              </label>
              <input
                type="text"
                placeholder="Check / BNK / note"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm shadow-sm"
              />
            </div>
          </div>

          {groupCustomers.length > 0 && (
            <div className="flex flex-wrap gap-2 w-full pt-1">
              {groupCustomers.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 py-1 text-xs font-medium"
                >
                  {c}
                  <button type="button" onClick={() => toggleCustomer(c)} className="text-slate-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {groupCustomers.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                <strong>Payment:</strong> {formatAmount(paymentAmount)} AED
              </span>
              <span>
                <strong>Applied:</strong> {formatAmount(totalApplied)} AED
              </span>
              <span
                className={
                  isOverAllocated
                    ? 'text-red-600 font-bold'
                    : remainder > 0.009
                      ? 'text-emerald-700 font-semibold'
                      : 'text-slate-700 font-semibold'
                }
              >
                <strong>Remainder:</strong> {formatAmount(remainder)} AED
                {isOverAllocated && ' (over-allocated — explain in note)'}
                {!isOverAllocated && remainder <= 0.009 && hasValidPayment && totalApplied > 0.009 && ' (fully allocated)'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoFifo}
              disabled={!hasValidPayment || openRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              <ArrowDownWideNarrow className="w-4 h-4" />
              Auto-fill FIFO
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden px-2">
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 py-2 px-2 cursor-pointer w-[130px]"
                title="From date"
              />
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 py-2 px-2 cursor-pointer w-[130px]"
                title="To date"
              />
              {(dateFromFilter || dateToFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFromFilter('');
                    setDateToFilter('');
                  }}
                  className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg"
                  title="Clear dates"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-56">
              <button
                type="button"
                onClick={() => setIsOverdueMonthDropdownOpen(!isOverdueMonthDropdownOpen)}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-lg border font-medium text-sm transition-all ${
                  isOverdueMonthDropdownOpen || selectedOverdueMonthFilter.length > 0
                    ? 'bg-red-50 border-red-200 text-red-700 ring-2 ring-red-100'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {selectedOverdueMonthFilter.length === 0
                      ? 'All Overdue Months'
                      : selectedOverdueMonthFilter.length === 1
                        ? selectedOverdueMonthFilter[0]
                        : `${selectedOverdueMonthFilter.length} Selected`}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform ${isOverdueMonthDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOverdueMonthDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsOverdueMonthDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-80 overflow-y-auto">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 sticky top-0">
                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white">
                        <input
                          type="checkbox"
                          checked={
                            selectedOverdueMonthFilter.length === availableOverdueMonths.length &&
                            availableOverdueMonths.length > 0
                          }
                          onChange={(e) =>
                            setSelectedOverdueMonthFilter(
                              e.target.checked ? [...availableOverdueMonths] : [],
                            )
                          }
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm font-semibold text-gray-700">Select All</span>
                      </label>
                    </div>
                    <div className="p-2 space-y-1">
                      {availableOverdueMonths.length === 0 && (
                        <div className="text-center text-sm text-gray-500 py-2">No overdue months</div>
                      )}
                      {availableOverdueMonths.map((month) => (
                        <label
                          key={month}
                          className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedOverdueMonthFilter.includes(month)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOverdueMonthFilter([...selectedOverdueMonthFilter, month]);
                              } else {
                                setSelectedOverdueMonthFilter(
                                  selectedOverdueMonthFilter.filter((m) => m !== month),
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-gray-600">{month}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => handlePdf(false)}
              disabled={!canExport}
              className="p-2.5 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 text-red-700 transition-all shadow-sm shrink-0 flex items-center justify-center disabled:opacity-50"
              title="Download PDF"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handlePdf(true)}
              disabled={!canExport}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 transition-all shadow-sm shrink-0 flex items-center justify-center disabled:opacity-50"
              title="Print PDF"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => void handleExcel()}
              disabled={!canExport}
              className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 text-emerald-700 transition-all shadow-sm shrink-0 flex items-center justify-center disabled:opacity-50"
              title="Export Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {filteredRows.length === 0 ? (
              <NoData
                title={
                  openRows.length === 0
                    ? 'NO OPEN INVOICES FOUND'
                    : debouncedTableSearch.trim() ||
                        dateFromFilter ||
                        dateToFilter ||
                        selectedOverdueMonthFilter.length > 0
                      ? 'NO INVOICES MATCH YOUR FILTERS'
                      : undefined
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-center">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      {table.getHeaderGroups().map((hg) => (
                        <tr key={hg.id}>
                          {hg.headers.map((header) => (
                            <th
                              key={header.id}
                              className="px-4 py-3 text-center font-semibold text-slate-600"
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-2.5 text-center">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {table.getPageCount() > 1 && (
                  <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm">
                    <span>
                      Page {pagination.pageIndex + 1} of {table.getPageCount()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        title="Previous Page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        title="Next Page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                Remainder Note (optional)
              </label>
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                <button
                  type="button"
                  onClick={() => setRemainderNoteAlign('left')}
                  title="Left to right"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                    remainderNoteAlign === 'left'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/70'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  LTR
                </button>
                <button
                  type="button"
                  onClick={() => setRemainderNoteAlign('right')}
                  title="Right to left"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 ${
                    remainderNoteAlign === 'right'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/70'
                  }`}
                >
                  RTL
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <textarea
              rows={3}
              value={remainderNote}
              onChange={(e) => setRemainderNote(e.target.value)}
              placeholder="e.g. Partial allocation on INV-123 / over-applied 500 AED on SAL-456 — advance balance / remainder held on account"
              className={`w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-y ${
                remainderNoteAlign === 'right' ? 'text-right' : 'text-left'
              }`}
            />
          </div>
        </>
      )}

      {groupCustomers.length === 0 && (
        <NoData title="NO CUSTOMERS ADDED" />
      )}
    </div>
  );
}
