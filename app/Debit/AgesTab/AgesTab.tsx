'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { exportDebitExcelWorkbook } from '@/app/Debit/Utils/ExcelExport';
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
import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';
import { InvoiceRow } from '@/types';
import NoData from '@/app/Components/DataState/NoDataTab';

interface AgesTabProps {
  data: InvoiceRow[];
}

type AgesPdfExportMode = 'normal' | 'without_tags' | 'tags_only';

interface CustomerAgingSummary {
  customerName: string;
  cities: string[];
  customerTags: string[];
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
  const [showNegativeBalances, setShowNegativeBalances] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
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

      const summary: CustomerAgingSummary = {
        customerName,
        cities: Array.from(citiesSet).sort(),
        customerTags: Array.from(tagsSet).sort(),
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
          let targetDate = parseInvoiceDate(inv.dueDate) || parseInvoiceDate(inv.date);

          if (targetDate && !isNaN(targetDate.getTime())) {
            targetDate.setHours(0, 0, 0, 0);
            const diffTime = today.getTime() - targetDate.getTime();
            daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }

          if (daysOverdue <= 30) {
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
        Math.abs(summary.oneToThirty) > 0.01 ||
        Math.abs(summary.thirtyOneToSixty) > 0.01 ||
        Math.abs(summary.sixtyOneToNinety) > 0.01 ||
        Math.abs(summary.ninetyOneToOneTwenty) > 0.01;

      if (hasValues) {
        summaries.push(summary);
      }
    });

    return summaries.sort((a, b) => b.total - a.total);
  }, [data]);

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

    // Filter out negative balances if option is false
    if (!showNegativeBalances) {
      filtered = filtered.filter(customer => customer.total >= 0);
    }

    return filtered;
  }, [agingData, debouncedSearch, selectedSalesRep, showNegativeBalances]);

  const exportToExcel = async () => {
    // Sort for main sheet: City first, then Net Debit
    const sortedForExport = [...filteredData].sort((a, b) => {
      const cityA = a.cities.join(', ') || 'No City';
      const cityB = b.cities.join(', ') || 'No City';
      if (cityA < cityB) return -1;
      if (cityA > cityB) return 1;
      return b.total - a.total; // then by Net Debit descending
    });

    const numericColumns = ['NET DEBIT', '0 - 30', '31 - 60', '61 - 90', '91 - 120', 'OLDER'];
    const options = { numericColumns };

    const getRowData = (item: CustomerAgingSummary, index: number) => ({
      '#': index + 1,
      'Customer Name': item.customerName,
      'City': item.cities.join(', ') || '',
      'NET DEBIT': item.total,
      '0 - 30': item.oneToThirty,
      '31 - 60': item.thirtyOneToSixty,
      '61 - 90': item.sixtyOneToNinety,
      '91 - 120': item.ninetyOneToOneTwenty,
      'OLDER': item.older,
    });

    // Main sheet data
    const mainSheetData = sortedForExport.map((item, idx) => getRowData(item, idx));
    mainSheetData.push({
      '#': '',
      'Customer Name': 'TOTAL',
      'City': '',
      'NET DEBIT': grandTotal,
      '0 - 30': total1To30,
      '31 - 60': total31To60,
      '61 - 90': total61To90,
      '91 - 120': total91To120,
      'OLDER': totalOlder,
    } as any);

    const sheets = [
      {
        name: 'All Cities',
        data: mainSheetData,
        options,
      }
    ];

    // Group by City
    const cityMap = new Map<string, typeof sortedForExport>();
    sortedForExport.forEach(item => {
      const city = item.cities.join(', ') || 'No City';
      const group = cityMap.get(city) || [];
      group.push(item);
      cityMap.set(city, group);
    });

    // Sort city names alphabetically
    const sortedCities = Array.from(cityMap.keys()).sort();

    sortedCities.forEach(city => {
      const cityData = cityMap.get(city)!;
      const cityTotal = cityData.reduce((sum, item) => sum + item.total, 0);
      const city1To30 = cityData.reduce((sum, item) => sum + item.oneToThirty, 0);
      const city31To60 = cityData.reduce((sum, item) => sum + item.thirtyOneToSixty, 0);
      const city61To90 = cityData.reduce((sum, item) => sum + item.sixtyOneToNinety, 0);
      const city91To120 = cityData.reduce((sum, item) => sum + item.ninetyOneToOneTwenty, 0);
      const cityOlder = cityData.reduce((sum, item) => sum + item.older, 0);

      const sheetData = cityData.map((item, idx) => getRowData(item, idx));
      sheetData.push({
        '#': '',
        'Customer Name': 'TOTAL',
        'City': '',
        'NET DEBIT': cityTotal,
        '0 - 30': city1To30,
        '31 - 60': city31To60,
        '61 - 90': city61To90,
        '91 - 120': city91To120,
        'OLDER': cityOlder,
      } as any);

      // Safe sheet name for Excel (max 31 chars, no invalid chars)
      let safeSheetName = city.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 31).trim();
      if (!safeSheetName) safeSheetName = 'Sheet';

      // Ensure unique sheet name
      let finalSheetName = safeSheetName;
      let counter = 1;
      while (sheets.some(s => s.name.toLowerCase() === finalSheetName.toLowerCase())) {
        finalSheetName = `${safeSheetName.substring(0, 28)}_${counter}`;
        counter++;
      }

      sheets.push({
        name: finalSheetName,
        data: sheetData,
        options,
      });
    });

    await exportDebitExcelWorkbook(sheets, `ages_export_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = async (mode: AgesPdfExportMode) => {
    setIsExportingPdf(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { generateAgesPDF, generateSingleRegionAgesPDF } = await import('@/app/Debit/AgesTab/Pdf/AgesUtils');

      const dateStr = new Date().toISOString().split('T')[0];
      const zip = new JSZip();

      if (mode === 'tags_only') {
        const tagged = filteredData.filter((item) => item.customerTags.length > 0);
        if (tagged.length === 0) {
          alert('No customers with tags found in the current view.');
          return;
        }

        const tagMap = new Map<string, typeof filteredData>();
        tagged.forEach((item) => {
          item.customerTags.forEach((tag) => {
            const group = tagMap.get(tag) || [];
            group.push(item);
            tagMap.set(tag, group);
          });
        });

        const sortedTags = Array.from(tagMap.keys()).sort((a, b) => a.localeCompare(b));
        for (const tag of sortedTags) {
          const tagData = tagMap.get(tag) || [];
          const tagPdf = await generateSingleRegionAgesPDF(tag, tagData, `Customer Tag: ${tag}`);
          const safeTagName = tag.replace(/[\/\\:*?"<>|]/g, '_').trim() || 'Tag';
          zip.file(`Tag_${safeTagName}_Aging_${dateStr}.pdf`, tagPdf);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveTrackedAs(zipBlob, `Aging_By_Tags_${dateStr}.zip`);
        setIsPdfExportOpen(false);
        return;
      }

      const exportData =
        mode === 'without_tags'
          ? filteredData.filter((item) => item.customerTags.length === 0)
          : filteredData;

      if (exportData.length === 0) {
        alert(
          mode === 'without_tags'
            ? 'No untagged customers found in the current view.'
            : 'No customers found in the current view.'
        );
        return;
      }

      const filterDesc =
        mode === 'without_tags' ? 'Without Customer Tags' : 'All Customers';

      const fullPdfBlob = await generateAgesPDF(exportData, filterDesc);

      const regionMap = new Map<string, typeof exportData>();
      exportData.forEach((item) => {
        const regionKey = item.cities.join(', ') || 'No Region';
        const group = regionMap.get(regionKey) || [];
        group.push(item);
        regionMap.set(regionKey, group);
      });

      zip.file(`Aging_Report_${dateStr}.pdf`, fullPdfBlob);

      for (const [region, regionData] of regionMap) {
        const regionPdfBlob = await generateSingleRegionAgesPDF(region, regionData, filterDesc);
        const safeRegionName = region.replace(/[\/\\:*?"<>|]/g, '_');
        zip.file(`${safeRegionName}_Aging_${dateStr}.pdf`, regionPdfBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipName =
        mode === 'without_tags'
          ? `Aging_Report_NoTags_${dateStr}.zip`
          : `Aging_Report_${dateStr}.zip`;
      saveTrackedAs(zipBlob, zipName);
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

        <button
          type="button"
          onClick={() => setShowNegativeBalances(!showNegativeBalances)}
          className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all shadow-sm cursor-pointer relative ${
            showNegativeBalances
              ? 'bg-rose-50 border-rose-500 text-rose-600 ring-2 ring-rose-500/10'
              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
          }`}
          title="Toggle Negative Balances"
        >
          <MinusCircle className="w-5 h-5" />
          {showNegativeBalances && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          )}
        </button>



        <input
          type="text"
          placeholder="Search by customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-center"
        />
        <button
          onClick={exportToExcel}
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

      {isPdfExportOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close PDF export options"
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]"
              onClick={() => !isExportingPdf && setIsPdfExportOpen(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Export Aging PDF</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Choose how customer tags are included</p>
                </div>
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => setIsPdfExportOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-2">
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => handleExportPDF('normal')}
                  className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left transition-all disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">Normal Download</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Full aging report + one PDF per city (all customers)
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => handleExportPDF('without_tags')}
                  className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left transition-all disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">Without Customer Tags</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Same report layout, only customers with no tag
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => handleExportPDF('tags_only')}
                  className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-left transition-all disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-indigo-900">Customer Tags Only</div>
                    <div className="text-xs text-indigo-700/80 mt-0.5">
                      One separate PDF file for each customer tag
                    </div>
                  </div>
                </button>
              </div>

              {isExportingPdf && (
                <div className="px-5 pb-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating PDF...
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
