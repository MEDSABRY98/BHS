'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { exportDebitExcelWorkbook } from '@/app/CustomersAnalysis/Utils/ExcelExport';
import { useDebouncedValue } from '../Hooks/useDebouncedValue';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { FileSpreadsheet, FileText, MapPin, ChevronDown, Check, MinusCircle, Tag, Users, X, Loader2 } from 'lucide-react';
import { saveTrackedAs } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { InvoiceRow } from '@/types';
import { useDebitData } from '../Context/DebitDataContext';
import NoData from '@/app/Components/DataState/NoDataTab';

interface AgesTabProps {
  data: InvoiceRow[];
}

type AgesPdfExportMode = 'all' | 'by_city' | 'without_tags' | 'by_tags';

interface CustomerAgingSummary {
  customerName: string;
  cities: string[];
  customerTags: string[];
  /** the customer's payment term in days (most common among his invoices) */
  paymentTerm: number | null;
  atDate: number;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
  total: number;
}

const parseInvoiceDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;

  // Try to parse DD/MM/YYYY or DD-MM-YYYY explicitly first
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);

    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p3 > 1000) {
        // Format: DD/MM/YYYY
        const parsed = new Date(p3, p2 - 1, p1);
        if (!isNaN(parsed.getTime())) return parsed;
      } else if (p1 > 1000) {
        // Format: YYYY/MM/DD
        const parsed = new Date(p1, p2 - 1, p3);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
  }

  // Fallback to JS native parser
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;

  return null;
};

const columnHelper = createColumnHelper<CustomerAgingSummary>();

export default function AgesTab({ data }: AgesTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('all');
  const { globalFilters } = useDebitData();
  const agingMode = globalFilters.agingMode;

  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [isExcelExportOpen, setIsExcelExportOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);






  const agingData = useMemo(() => {
    // Group by customer first
    const customerMap = new Map<string, InvoiceRow[]>();
    data.forEach((row) => {
      const existing = customerMap.get(row.customerName) || [];
      existing.push(row);
      customerMap.set(row.customerName, existing);
    });

    const summaries: CustomerAgingSummary[] = [];

    customerMap.forEach((customerInvoices, customerName) => {
      const totalDebit = customerInvoices.reduce((sum, inv) => sum + inv.debit, 0);
      const totalCredit = customerInvoices.reduce((sum, inv) => sum + inv.credit, 0);
      const netDebt = totalDebit - totalCredit;

      // Collect unique sales reps + customer tags
      const citiesSet = new Set<string>();
      const tagsSet = new Set<string>();
      customerInvoices.forEach((inv) => {
        if (inv.salesRep && inv.salesRep.trim()) {
          citiesSet.add(inv.salesRep.trim());
        }
        const tag = inv.customerTag?.trim();
        if (tag) tagsSet.add(tag);
      });

      const termCount = new Map<number, number>();
      customerInvoices.forEach((inv) => {
        if (inv.paymentTerm !== undefined && inv.paymentTerm !== null && !Number.isNaN(Number(inv.paymentTerm))) {
          const t = Number(inv.paymentTerm);
          termCount.set(t, (termCount.get(t) || 0) + 1);
        }
      });
      const paymentTerm = Array.from(termCount.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null;

      const summary: CustomerAgingSummary = {
        customerName,
        cities: Array.from(citiesSet).sort(),
        customerTags: Array.from(tagsSet).sort(),
        paymentTerm,
        atDate: 0,
        oneToThirty: 0,
        thirtyOneToSixty: 0,
        sixtyOneToNinety: 0,
        ninetyOneToOneTwenty: 0,
        older: 0,
        total: netDebt
      };

      // Identify Open Items (Unmatched + Residuals)
      const matchingTotals = new Map<string, number>();
      const maxDebits = new Map<string, number>();
      const mainInvoiceIndices = new Map<string, number>();

      // Pass 1: Analyze Matchings
      customerInvoices.forEach((inv, idx) => {
        if (inv.matching) {
          const net = inv.debit - inv.credit;
          matchingTotals.set(inv.matching, (matchingTotals.get(inv.matching) || 0) + net);

          const currentMax = maxDebits.get(inv.matching) ?? -1;
          // Logic to pick main invoice (largest debit)
          if (inv.debit > currentMax) {
            maxDebits.set(inv.matching, inv.debit);
            mainInvoiceIndices.set(inv.matching, idx);
          } else if (!mainInvoiceIndices.has(inv.matching)) {
            maxDebits.set(inv.matching, inv.debit);
            mainInvoiceIndices.set(inv.matching, idx);
          }
        }
      });

      // Pass 2: Aging Calculation
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      customerInvoices.forEach((inv, idx) => {
        let amountToAge = 0;
        let shouldAge = false;

        if (!inv.matching) {
          const net = inv.debit - inv.credit;
          if (Math.abs(net) > 0.01) {
            amountToAge = net;
            shouldAge = true;
          }
        } else {
          // It is matched. Check if it is main invoice
          if (mainInvoiceIndices.get(inv.matching) === idx) {
            const residual = matchingTotals.get(inv.matching) || 0;
            if (Math.abs(residual) > 0.01) {
              amountToAge = residual;
              shouldAge = true;
            }
          }
        }

        if (shouldAge) {
          // Calculate days overdue
          let daysOverdue = 0;
          // Days: from the due date (already includes the payment term).
          // Months: invoice month + payment term (months), from the 1st of the next month —
          //         counted from the INVOICE date, same as Expected Collections.
          const useInvoiceDate = agingMode === 'months' && inv.paymentTerm !== undefined;
          let targetDate = useInvoiceDate
            ? parseInvoiceDate(inv.date) || parseInvoiceDate(inv.dueDate)
            : parseInvoiceDate(inv.dueDate) || parseInvoiceDate(inv.date);

          if (targetDate && !isNaN(targetDate.getTime())) {
            if (useInvoiceDate) {
              const monthsToAdd = Math.round((inv.paymentTerm || 0) / 30);
              targetDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + monthsToAdd + 1, 1);
            }
            targetDate.setHours(0, 0, 0, 0);
            const diffTime = today.getTime() - targetDate.getTime();
            daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }

          if (daysOverdue <= 0) {
            summary.oneToThirty += amountToAge; // not yet due is part of 0 - 30
          } else if (daysOverdue <= 30) {
            summary.oneToThirty += amountToAge;
          } else if (daysOverdue <= 60) {
            summary.thirtyOneToSixty += amountToAge;
          } else if (daysOverdue <= 90) {
            summary.sixtyOneToNinety += amountToAge;
          } else if (daysOverdue <= 120) {
            summary.ninetyOneToOneTwenty += amountToAge;
          } else {
            summary.older += amountToAge;
          }
        }
      });

      // Include in summary if there is significant debt or open items
      const hasValues = Math.abs(summary.total) > 0.01 ||
        Math.abs(summary.older) > 0.01 ||
        Math.abs(summary.atDate) > 0.01 ||
        Math.abs(summary.oneToThirty) > 0.01 ||
        Math.abs(summary.thirtyOneToSixty) > 0.01 ||
        Math.abs(summary.sixtyOneToNinety) > 0.01 ||
        Math.abs(summary.ninetyOneToOneTwenty) > 0.01;

      if (hasValues) {
        summaries.push(summary);
      }
    });

    return summaries.sort((a, b) => b.total - a.total);
  }, [data, agingMode]);

  // Get unique sales reps
  const cities = useMemo(() => {
    const repsSet = new Set<string>();
    agingData.forEach((customer) => {
      customer.cities.forEach((rep) => {
        if (rep && rep.trim()) {
          repsSet.add(rep.trim());
        }
      });
    });
    return Array.from(repsSet).sort();
  }, [agingData]);

  const filteredData = useMemo(() => {
    let filtered = agingData;

    // Filter by sales rep
    if (selectedSalesRep !== 'all') {
      filtered = filtered.filter((customer) =>
        customer.cities.includes(selectedSalesRep)
      );
    }

    // Filter by search query
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter((customer) =>
        customer.customerName.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [agingData, debouncedSearch, selectedSalesRep]);

  // same 4 reports as the PDF, every one sorted by debt (largest first)
  const exportToExcel = async (mode: AgesPdfExportMode) => {
    const data =
      mode === 'without_tags' ? filteredData.filter((item) => item.customerTags.length === 0) : mode === 'by_tags' ? filteredData.filter((item) => item.customerTags.length > 0) : filteredData;
    if (data.length === 0) {
      alert(mode === 'without_tags' ? 'No customers without tags in the current view.' : mode === 'by_tags' ? 'No customers with tags in the current view.' : 'No customers found in the current view.');
      return;
    }
    setIsExportingPdf(true);
    try {
      const numericColumns = ['NET DEBIT', '0 - 30', '31 - 60', '61 - 90', '91 - 120', 'OLDER'];
      const options = { numericColumns };
      const byDebt = (items: CustomerAgingSummary[]) => [...items].sort((a, b) => b.total - a.total);
      const sum = (items: CustomerAgingSummary[], f: (i: CustomerAgingSummary) => number) => items.reduce((t, i) => t + f(i), 0);

      const rowOf = (item: CustomerAgingSummary, index: number) => ({
        '#': index + 1,
        'Customer Name': item.customerName,
        'City': item.cities.join(', ') || '',
        'Payment Term': item.paymentTerm === null ? '' : `${item.paymentTerm} Days`,
        'NET DEBIT': item.total,
        '0 - 30': item.oneToThirty,
        '31 - 60': item.thirtyOneToSixty,
        '61 - 90': item.sixtyOneToNinety,
        '91 - 120': item.ninetyOneToOneTwenty,
        'OLDER': item.older,
      });
      const sheetRows = (items: CustomerAgingSummary[]) => {
        const rows: Record<string, unknown>[] = items.map((item, i) => rowOf(item, i));
        rows.push({
          '#': '',
          'Customer Name': 'TOTAL',
          'City': '',
          'Payment Term': '',
          'NET DEBIT': sum(items, (i) => i.total),
          '0 - 30': sum(items, (i) => i.oneToThirty),
          '31 - 60': sum(items, (i) => i.thirtyOneToSixty),
          '61 - 90': sum(items, (i) => i.sixtyOneToNinety),
          '91 - 120': sum(items, (i) => i.ninetyOneToOneTwenty),
          'OLDER': sum(items, (i) => i.older),
        });
        return rows;
      };

      const sheets: { name: string; data: any[]; options: typeof options }[] = [];
      const addSheet = (rawName: string, rows: Record<string, unknown>[]) => {
        const base = rawName.replace(/[\/\\:*?"<>|\[\]]/g, '_').substring(0, 31).trim() || 'Sheet';
        let name = base;
        for (let n = 1; sheets.some((x) => x.name.toLowerCase() === name.toLowerCase()); n++) name = `${base.substring(0, 28)}_${n}`;
        sheets.push({ name, data: rows, options });
      };

      if (mode === 'by_city') {
        addSheet('All Cities', sheetRows([...data].sort((a, b) => (a.cities.join(', ') || 'No City').localeCompare(b.cities.join(', ') || 'No City') || b.total - a.total)));
        const cityMap = new Map<string, CustomerAgingSummary[]>();
        data.forEach((item) => {
          const city = item.cities.join(', ') || 'No City';
          cityMap.set(city, [...(cityMap.get(city) || []), item]);
        });
        Array.from(cityMap.keys()).sort().forEach((city) => addSheet(city, sheetRows(byDebt(cityMap.get(city)!))));
      } else if (mode === 'by_tags') {
        const tagMap = new Map<string, CustomerAgingSummary[]>();
        data.forEach((item) => item.customerTags.forEach((tag) => tagMap.set(tag, [...(tagMap.get(tag) || []), item])));
        const tags = Array.from(tagMap.keys()).sort((a, b) => a.localeCompare(b));
        addSheet(
          'Summary',
          [
            ...tags.map((tag, i) => {
              const items = tagMap.get(tag)!;
              return {
                '#': i + 1,
                'Tag': tag,
                'Customers': items.length,
                'NET DEBIT': sum(items, (x) => x.total),
                '0 - 30': sum(items, (x) => x.oneToThirty),
                '31 - 60': sum(items, (x) => x.thirtyOneToSixty),
                '61 - 90': sum(items, (x) => x.sixtyOneToNinety),
                '91 - 120': sum(items, (x) => x.ninetyOneToOneTwenty),
                'OLDER': sum(items, (x) => x.older),
              };
            }),
          ],
        );
        sheets[0].options = { numericColumns: ['Customers', ...numericColumns] };
        tags.forEach((tag) => addSheet(tag, sheetRows(byDebt(tagMap.get(tag)!))));
      } else {
        addSheet(mode === 'without_tags' ? 'Without Tags' : 'All Customers', sheetRows(mode === 'without_tags' ? [...data].sort((a, b) => (a.cities.join(', ') || 'No City').localeCompare(b.cities.join(', ') || 'No City') || b.total - a.total) : byDebt(data)));
      }

      const fileKey = mode === 'by_city' ? 'by_city' : mode === 'by_tags' ? 'by_tag' : mode === 'without_tags' ? 'without_tags' : 'all_customers';
      await exportDebitExcelWorkbook(sheets, `ages_${fileKey}_${new Date().toISOString().split('T')[0]}`);
      setIsPdfExportOpen(false);
      setIsExcelExportOpen(false);
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Failed to generate Excel');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 4 reports, every one sorted by debt (largest first)
  const handleExportPDF = async (mode: AgesPdfExportMode) => {
    setIsExportingPdf(true);
    try {
      const agingLabel = agingMode === 'months' ? 'Calendar Months' : 'Exact Days';
      const { generateAgesPDF, generateSingleRegionAgesPDF, generateCombinedTagsAgesPDF } = await import('@/app/CustomersAnalysis/AgesTab/Pdf/AgesUtils');
      const dateStr = new Date().toISOString().split('T')[0];

      const data = mode === 'without_tags' ? filteredData.filter((item) => item.customerTags.length === 0) : mode === 'by_tags' ? filteredData.filter((item) => item.customerTags.length > 0) : filteredData;
      if (data.length === 0) {
        alert(mode === 'without_tags' ? 'No customers without tags in the current view.' : mode === 'by_tags' ? 'No customers with tags in the current view.' : 'No customers found in the current view.');
        return;
      }

      let blob: Blob;
      let fileName: string;
      if (mode === 'by_city') {
        blob = await generateAgesPDF(data, 'All Customers', agingLabel);
        fileName = `Aging_By_City_${dateStr}.pdf`;
      } else if (mode === 'by_tags') {
        blob = await generateCombinedTagsAgesPDF(data, 'Customers With Tags', agingLabel);
        fileName = `Aging_By_Tag_${dateStr}.pdf`;
      } else if (mode === 'without_tags') {
        blob = await generateSingleRegionAgesPDF('Without Customer Tags', data, 'Without Customer Tags', agingLabel, true);
        fileName = `Aging_Without_Tags_${dateStr}.pdf`;
      } else {
        blob = await generateSingleRegionAgesPDF('All Customers', data, 'All Customers', agingLabel);
        fileName = `Aging_All_Customers_${dateStr}.pdf`;
      }
      saveTrackedAs(blob, fileName);
      setIsPdfExportOpen(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'index',
        header: '#',
        cell: () => null, // Rendered manually in tbody
      }),
      columnHelper.accessor('customerName', {
        header: 'Customer Name',
        cell: (info) => (
          <div className="font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor('total', {
        header: 'NET DEBIT',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={`font-bold whitespace-nowrap ${value > 0 ? 'text-gray-900' : 'text-green-600'}`}>
              {value.toLocaleString('en-US')}
            </span>
          );
        },
      }),
      columnHelper.accessor('oneToThirty', {
        header: '0 - 30',
        cell: (info) => (
          <span className="whitespace-nowrap">
            {info.getValue().toLocaleString('en-US')}
          </span>
        ),
      }),
      columnHelper.accessor('thirtyOneToSixty', {
        header: '31 - 60',
        cell: (info) => (
          <span className="whitespace-nowrap">
            {info.getValue().toLocaleString('en-US')}
          </span>
        ),
      }),
      columnHelper.accessor('sixtyOneToNinety', {
        header: '61 - 90',
        cell: (info) => (
          <span className="whitespace-nowrap">
            {info.getValue().toLocaleString('en-US')}
          </span>
        ),
      }),
      columnHelper.accessor('ninetyOneToOneTwenty', {
        header: '91 - 120',
        cell: (info) => (
          <span className="whitespace-nowrap">
            {info.getValue().toLocaleString('en-US')}
          </span>
        ),
      }),
      columnHelper.accessor('older', {
        header: 'OLDER',
        cell: (info) => (
          <span className="text-red-600 font-semibold whitespace-nowrap">
            {info.getValue().toLocaleString('en-US')}
          </span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  // Calculate Totals
  const total1To30 = filteredData.reduce((sum, item) => sum + item.oneToThirty, 0);
  const total31To60 = filteredData.reduce((sum, item) => sum + item.thirtyOneToSixty, 0);
  const total61To90 = filteredData.reduce((sum, item) => sum + item.sixtyOneToNinety, 0);
  const total91To120 = filteredData.reduce((sum, item) => sum + item.ninetyOneToOneTwenty, 0);
  const totalOlder = filteredData.reduce((sum, item) => sum + item.older, 0);
  const grandTotal = filteredData.reduce((sum, item) => sum + item.total, 0);


  return (
    <div className="p-6">

      <div className="mb-4 flex justify-center items-center gap-3 flex-wrap">
        <div className="relative" ref={cityDropdownRef}>
          <button
            type="button"
            onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
            className={`h-11 min-w-[200px] flex items-center justify-between bg-white border border-gray-300 rounded-xl px-4 transition-all shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
              isCityDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{selectedSalesRep === 'all' ? 'All Cities' : selectedSalesRep}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isCityDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
          </button>

          {isCityDropdownOpen && (
            <div className="absolute left-0 mt-1.5 min-w-full z-50 bg-white border border-gray-200 shadow-xl rounded-xl p-1.5 max-h-60 overflow-y-auto space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedSalesRep('all');
                  setIsCityDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                  selectedSalesRep === 'all'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>All Cities</span>
                {selectedSalesRep === 'all' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              {cities.map((rep) => {
                const isSelected = selectedSalesRep === rep;
                return (
                  <button
                    key={rep}
                    type="button"
                    onClick={() => {
                      setSelectedSalesRep(rep);
                      setIsCityDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate">{rep}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        

        <input
          type="text"
          placeholder="Search by customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-center"
        />
        <button
          onClick={() => setIsExcelExportOpen(true)}
          disabled={isExportingPdf}
          className="flex items-center justify-center h-10 w-10 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors"
          title="Export to Excel"
        >
          <FileSpreadsheet className="h-5 w-5" />
        </button>
        <button
          onClick={() => setIsPdfExportOpen(true)}
          disabled={isExportingPdf}
          className="flex items-center justify-center h-10 w-10 bg-rose-600 text-white rounded-xl shadow-sm hover:bg-rose-700 transition-colors disabled:opacity-60"
          title="Export to PDF"
        >
          {isExportingPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
        </button>
      </div>

      {(isPdfExportOpen || isExcelExportOpen) &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close PDF export options"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all"
              onClick={() => !isExportingPdf && (setIsPdfExportOpen(false), setIsExcelExportOpen(false))}
            />
            <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Export Aging {isExcelExportOpen ? 'Excel' : 'PDF'}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Choose the report (all sorted by debt)</p>
                </div>
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => (setIsPdfExportOpen(false), setIsExcelExportOpen(false))}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 pt-2 space-y-2.5">
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => (isExcelExportOpen ? exportToExcel('all') : handleExportPDF('all'))}
                  className="group w-full flex items-center gap-4 p-3 rounded-2xl border border-transparent bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm text-left transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:text-rose-600 group-hover:scale-110 transition-all duration-300">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">All Customers</div>
                    <div className="text-[11px] font-medium text-slate-400">One list, sorted by debt (largest first)</div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => (isExcelExportOpen ? exportToExcel('by_city') : handleExportPDF('by_city'))}
                  className="group w-full flex items-center gap-4 p-3 rounded-2xl border border-transparent bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm text-left transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:text-emerald-600 group-hover:scale-110 transition-all duration-300">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">By City</div>
                    <div className="text-[11px] font-medium text-slate-400">Split by city, sorted by debt inside each city</div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => (isExcelExportOpen ? exportToExcel('without_tags') : handleExportPDF('without_tags'))}
                  className="group w-full flex items-center gap-4 p-3 rounded-2xl border border-transparent bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm text-left transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:text-amber-500 group-hover:scale-110 transition-all duration-300">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Without Tags</div>
                    <div className="text-[11px] font-medium text-slate-400">Customers with no tag, by city then debt</div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => (isExcelExportOpen ? exportToExcel('by_tags') : handleExportPDF('by_tags'))}
                  className="group w-full flex items-center gap-4 p-3 rounded-2xl border border-transparent bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm text-left transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:text-indigo-600 group-hover:scale-110 transition-all duration-300">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">By Customer Tag</div>
                    <div className="text-[11px] font-medium text-slate-400">Split by tag, sorted by debt inside each tag</div>
                  </div>
                </button>
              </div>

              {isExportingPdf && (
                <div className="px-5 pb-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating {isExcelExportOpen ? 'Excel' : 'PDF'}...
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {table.getRowModel().rows.length === 0 ? (
            <NoData />
          ) : (
            <table className="w-full" style={{ tableLayout: 'fixed', minWidth: '1200px' }}>
              <thead className="bg-black text-white">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const getWidth = () => {
                        const columnId = header.column.id;
                        if (columnId === 'index') return '5%';
                        if (columnId === 'customerName') return '25%';
                        // 6 numeric columns remaining = 70% / 6 ~ 11.6%
                        return '11.6%';
                      };
                      return (
                        <th
                          key={header.id}
                          className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider text-white cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
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
              <tbody className="divide-y divide-gray-200">
                {table.getRowModel().rows.map((row, idx) => (
                  <tr key={row.id} className={`border-b hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    {row.getVisibleCells().map((cell) => {
                      const getWidth = () => {
                        const columnId = cell.column.id;
                        if (columnId === 'index') return '5%';
                        if (columnId === 'customerName') return '25%';
                        return '11.6%';
                      };
                      return (
                        <td
                          key={cell.id}
                          className="px-6 py-4 text-center text-sm whitespace-nowrap"
                          style={{ width: getWidth() }}
                        >
                          {cell.column.id === 'index' ? (
                            <span className="text-gray-500 font-medium">{idx + 1}</span>
                          ) : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-gradient-to-r from-gray-100 to-gray-200 font-bold border-t-4 border-gray-300">
                  <td className="px-6 py-4" style={{ width: '5%' }}></td>
                  <td className="px-6 py-4 text-center text-lg text-gray-900 whitespace-nowrap" style={{ width: '25%' }}>
                    NET DEBIT
                  </td>
                  <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '11.6%' }}>
                    {grandTotal.toLocaleString('en-US')}
                  </td>
                  <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '11.6%' }}>
                    {total1To30.toLocaleString('en-US')}
                  </td>
                  <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '11.6%' }}>
                    {total31To60.toLocaleString('en-US')}
                  </td>
                  <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '11.6%' }}>
                    {total61To90.toLocaleString('en-US')}
                  </td>
                  <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '11.6%' }}>
                    {total91To120.toLocaleString('en-US')}
                  </td>
                  <td className="px-6 py-4 text-center text-lg text-red-700 whitespace-nowrap" style={{ width: '11.6%' }}>
                    {totalOlder.toLocaleString('en-US')}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
