'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { exportDebitExcelTable } from '@/app/Debit/Utils/ExcelExport';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { FileSpreadsheet, MapPin, ChevronDown, Search, Check, Loader2 } from 'lucide-react';
import { InvoiceRow } from '@/types';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { useDebouncedValue } from '../Hooks/useDebouncedValue';
import type {
  SummariesSalesOverlay,
  SummariesSalesSource,
} from '@/app/CustomersSummaries/Utils/SummariesTypes';
import { fetchSummariesSalesOverlayForYears } from '@/app/CustomersSummaries/Service/summaries_service';
import { applyCustomerSalesOverlay } from '@/app/CustomersSummaries/Utils/SalesSourceOverlay';

interface CustomersSummariesTabProps {
  data: InvoiceRow[];
  onRefresh?: () => void;
}

interface CustomerSummary {
  customerName: string;
  city: string;
  salesPrev: number;
  returnsPrev: number;
  salesCurrent: number;
  returnsCurrent: number;
  netSalesPrev: number;
  netSalesCurrent: number;
  growth: number | null;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
  totalAging: number;
}

const SALES_SOURCE_OPTIONS: { value: SummariesSalesSource; label: string }[] = [
  { value: 'debit', label: 'Debit Ledger' },
  { value: 'sales', label: 'Sales DB' },
];

const formatGrowth = (growth: number | null, netSalesCurrent: number, netSalesPrev: number) => {
  if (netSalesPrev <= 0 && netSalesCurrent > 0) return 'New';
  if (netSalesPrev <= 0 && netSalesCurrent <= 0) return '—';
  if (growth === null) return '—';
  const sign = growth > 0 ? '+' : '';
  return `${sign}${growth.toFixed(1)}%`;
};

const growthColorClass = (growth: number | null, netSalesCurrent: number, netSalesPrev: number) => {
  if (netSalesPrev <= 0 && netSalesCurrent > 0) return 'text-blue-600';
  if (growth === null || growth === 0) return 'text-slate-500';
  return growth > 0 ? 'text-emerald-600' : 'text-rose-600';
};

const formatNetSalesHeader = (year: number) => `N.S.${year}`;

const parseInvoiceDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (p3 > 1000) {
        const parsed = new Date(p3, p2 - 1, p1);
        if (!isNaN(parsed.getTime())) return parsed;
      } else if (p1 > 1000) {
        const parsed = new Date(p1, p2 - 1, p3);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
  }
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  return null;
};

function readUserId(): string {
  try {
    const saved = localStorage.getItem('currentUser');
    if (!saved) return '';
    const user = JSON.parse(saved);
    return String(user?.id || '').trim();
  } catch {
    return '';
  }
}

const columnHelper = createColumnHelper<CustomerSummary>();

export default function CustomersSummariesTab({ data, onRefresh }: CustomersSummariesTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const salesSourceDropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [hideNegative, setHideNegative] = useState(false);
  const [salesSource, setSalesSource] = useState<SummariesSalesSource>('debit');
  const [salesSourceOpen, setSalesSourceOpen] = useState(false);
  const [salesOverlay, setSalesOverlay] = useState<SummariesSalesOverlay | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  // dynamic years
  const { currentYear, previousYear } = useMemo(() => {
    let maxYear = new Date().getFullYear();
    if (data && data.length > 0) {
      const years = data
        .map(d => parseInvoiceDate(d.date)?.getFullYear())
        .filter((y): y is number => y !== undefined && !isNaN(y));
      if (years.length > 0) {
        maxYear = Math.max(...years);
      }
    }
    return { currentYear: maxYear, previousYear: maxYear - 1 };
  }, [data]);

  const debitSummaryData = useMemo(() => {
    const summaries: CustomerSummary[] = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const customerMap = new Map<string, InvoiceRow[]>();
    data.forEach((row) => {
      if (row.customerName && row.customerName.trim() !== '') {
        const existing = customerMap.get(row.customerName) || [];
        existing.push(row);
        customerMap.set(row.customerName, existing);
      }
    });

    customerMap.forEach((customerInvoices, customerName) => {
      let salesPrev = 0;
      let returnsPrev = 0;
      let salesCurrent = 0;
      let returnsCurrent = 0;
      const city =
        customerInvoices.find((inv) => inv.city?.trim())?.city?.trim() ||
        customerInvoices.find((inv) => inv.salesRep?.trim())?.salesRep?.trim() ||
        '';

      customerInvoices.forEach((inv) => {
        const date = parseInvoiceDate(inv.date);
        if (!date) return;

        // Fair comparison: Only include data up to today's month and day for any year
        const m = date.getMonth();
        const d = date.getDate();
        if (m > currentMonth || (m === currentMonth && d > currentDay)) return;

        const year = date.getFullYear();
        const number = inv.number ? inv.number.toUpperCase() : '';

        if (year === previousYear) {
          if (number.startsWith('SAL')) salesPrev += inv.debit;
          else if (number.startsWith('RSAL')) returnsPrev += inv.credit;
        } else if (year === currentYear) {
          if (number.startsWith('SAL')) salesCurrent += inv.debit;
          else if (number.startsWith('RSAL')) returnsCurrent += inv.credit;
        }
      });

      // Aging Logic
      let oneToThirty = 0, thirtyOneToSixty = 0, sixtyOneToNinety = 0, ninetyOneToOneTwenty = 0, older = 0;
      const matchingTotals = new Map<string, number>();
      const maxDebits = new Map<string, number>();
      const mainInvoiceIndices = new Map<string, number>();

      customerInvoices.forEach((inv, idx) => {
        if (inv.matching) {
          const net = inv.debit - inv.credit;
          matchingTotals.set(inv.matching, (matchingTotals.get(inv.matching) || 0) + net);
          const currentMax = maxDebits.get(inv.matching) ?? -1;
          if (inv.debit > currentMax) {
            maxDebits.set(inv.matching, inv.debit);
            mainInvoiceIndices.set(inv.matching, idx);
          } else if (!mainInvoiceIndices.has(inv.matching)) {
            maxDebits.set(inv.matching, inv.debit);
            mainInvoiceIndices.set(inv.matching, idx);
          }
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      customerInvoices.forEach((inv, idx) => {
        let amountToAge = 0;
        let shouldAge = false;
        if (!inv.matching) {
          const net = inv.debit - inv.credit;
          if (Math.abs(net) > 0.01) { amountToAge = net; shouldAge = true; }
        } else if (mainInvoiceIndices.get(inv.matching) === idx) {
          const residual = matchingTotals.get(inv.matching) || 0;
          if (Math.abs(residual) > 0.01) { amountToAge = residual; shouldAge = true; }
        }

        if (shouldAge) {
          let daysOverdue = 0;
          let targetDate = parseInvoiceDate(inv.dueDate) || parseInvoiceDate(inv.date);
          if (targetDate && !isNaN(targetDate.getTime())) {
            targetDate.setHours(0, 0, 0, 0);
            const diffTime = today.getTime() - targetDate.getTime();
            daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
          if (daysOverdue <= 30) oneToThirty += amountToAge;
          else if (daysOverdue <= 60) thirtyOneToSixty += amountToAge;
          else if (daysOverdue <= 90) sixtyOneToNinety += amountToAge;
          else if (daysOverdue <= 120) ninetyOneToOneTwenty += amountToAge;
          else older += amountToAge;
        }
      });

      const totalAging = oneToThirty + thirtyOneToSixty + sixtyOneToNinety + ninetyOneToOneTwenty + older;
      const netSalesPrev = salesPrev - returnsPrev;
      const netSalesCurrent = salesCurrent - returnsCurrent;
      const growth =
        netSalesPrev > 0 ? ((netSalesCurrent - netSalesPrev) / netSalesPrev) * 100 : null;

      if (salesPrev > 0 || returnsPrev > 0 || salesCurrent > 0 || returnsCurrent > 0 || Math.abs(totalAging) > 0.01) {
        summaries.push({
          customerName,
          city,
          salesPrev,
          returnsPrev,
          salesCurrent,
          returnsCurrent,
          netSalesPrev,
          netSalesCurrent,
          growth,
          oneToThirty,
          thirtyOneToSixty,
          sixtyOneToNinety,
          ninetyOneToOneTwenty,
          older,
          totalAging,
        });
      }
    });

    return summaries.sort((a, b) => b.totalAging - a.totalAging);
  }, [data, currentYear, previousYear]);

  useEffect(() => {
    if (salesSource !== 'sales') {
      setSalesOverlay(null);
      setSalesLoading(false);
      return;
    }

    const userId = readUserId();
    if (!userId) {
      setSalesOverlay(null);
      toast.error('Unable to load Sales DB: user not found.');
      return;
    }

    const now = new Date();
    let cancelled = false;
    setSalesLoading(true);

    void fetchSummariesSalesOverlayForYears({
      userId,
      currentYear,
      previousYear,
      fairMonth: now.getMonth(),
      fairDay: now.getDate(),
    })
      .then((overlay) => {
        if (!cancelled) setSalesOverlay(overlay);
      })
      .catch((error) => {
        console.error('Customers Summaries sales overlay failed:', error);
        if (!cancelled) {
          setSalesOverlay(null);
          toast.error('Failed to load Sales DB metrics.');
        }
      })
      .finally(() => {
        if (!cancelled) setSalesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [salesSource, currentYear, previousYear]);

  const summaryData = useMemo(() => {
    if (salesSource !== 'sales' || !salesOverlay) return debitSummaryData;
    return applyCustomerSalesOverlay(debitSummaryData, salesOverlay).sort(
      (a, b) => b.totalAging - a.totalAging
    );
  }, [debitSummaryData, salesOverlay, salesSource]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    summaryData.forEach((item) => {
      if (item.city) set.add(item.city);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [summaryData]);

  const filteredCitiesForDropdown = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((city) => city.toLowerCase().includes(q));
  }, [cities, citySearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setCityDropdownOpen(false);
        setCitySearch('');
      }
      if (
        salesSourceDropdownRef.current &&
        !salesSourceDropdownRef.current.contains(event.target as Node)
      ) {
        setSalesSourceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredData = useMemo(() => {
    let filtered = summaryData;

    if (hideNegative) {
      filtered = filtered.filter(item => item.totalAging >= -0.01);
    }

    if (selectedCity !== 'ALL') {
      filtered = filtered.filter((item) => item.city === selectedCity);
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter((customer) =>
        customer.customerName.toLowerCase().includes(query) ||
        customer.city.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [summaryData, debouncedSearch, hideNegative, selectedCity]);

  const exportToExcel = async () => {
    const headers = [
      'Customer Name',
      'City',
      formatNetSalesHeader(previousYear),
      formatNetSalesHeader(currentYear),
      'Growth %',
      '0 - 30',
      '31 - 60',
      '61 - 90',
      '91 - 120',
      'OLDER',
      'TOTAL',
    ];
    const rows = filteredData.map((item) => [
      item.customerName,
      item.city,
      item.netSalesPrev,
      item.netSalesCurrent,
      formatGrowth(item.growth, item.netSalesCurrent, item.netSalesPrev),
      item.oneToThirty,
      item.thirtyOneToSixty,
      item.sixtyOneToNinety,
      item.ninetyOneToOneTwenty,
      item.older,
      item.totalAging,
    ]);

    const totalNetPrev = filteredData.reduce((sum, item) => sum + item.netSalesPrev, 0);
    const totalNetCurrent = filteredData.reduce((sum, item) => sum + item.netSalesCurrent, 0);
    const totalGrowth =
      totalNetPrev > 0 ? ((totalNetCurrent - totalNetPrev) / totalNetPrev) * 100 : null;

    rows.push([
      'TOTAL',
      '',
      totalNetPrev,
      totalNetCurrent,
      formatGrowth(totalGrowth, totalNetCurrent, totalNetPrev),
      filteredData.reduce((sum, item) => sum + item.oneToThirty, 0),
      filteredData.reduce((sum, item) => sum + item.thirtyOneToSixty, 0),
      filteredData.reduce((sum, item) => sum + item.sixtyOneToNinety, 0),
      filteredData.reduce((sum, item) => sum + item.ninetyOneToOneTwenty, 0),
      filteredData.reduce((sum, item) => sum + item.older, 0),
      filteredData.reduce((sum, item) => sum + item.totalAging, 0),
    ]);

    await exportDebitExcelTable(
      headers,
      rows,
      `customers_summaries_${new Date().toISOString().split('T')[0]}`,
      {
        sheetName: 'Customers Summaries',
        numericColumns: headers.filter((h) => !['Customer Name', 'City', 'Growth %'].includes(h)),
        columnWidth: 14,
      }
    );
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', {
        header: 'Customer Name',
        cell: (info) => {
          const city = info.row.original.city;
          return (
            <div className="flex items-start justify-center gap-2 w-full">
              <span className="font-medium text-gray-900 whitespace-normal break-words leading-snug text-center min-w-0">
                {info.getValue()}
              </span>
              {city && (
                <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wide mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {city}
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('netSalesPrev', {
        header: formatNetSalesHeader(previousYear),
        cell: (info) => (
          <span className="text-emerald-700 font-medium">{info.getValue().toLocaleString('en-US')}</span>
        ),
      }),
      columnHelper.accessor('netSalesCurrent', {
        header: formatNetSalesHeader(currentYear),
        cell: (info) => (
          <span className="text-emerald-700 font-semibold">{info.getValue().toLocaleString('en-US')}</span>
        ),
      }),
      columnHelper.accessor('growth', {
        header: 'Growth',
        sortingFn: (rowA, rowB) => {
          const a = rowA.original;
          const b = rowB.original;
          const valA = a.netSalesPrev > 0 ? (a.growth ?? -Infinity) : a.netSalesCurrent > 0 ? Infinity : -Infinity;
          const valB = b.netSalesPrev > 0 ? (b.growth ?? -Infinity) : b.netSalesCurrent > 0 ? Infinity : -Infinity;
          return valA - valB;
        },
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className={`font-semibold ${growthColorClass(row.growth, row.netSalesCurrent, row.netSalesPrev)}`}>
              {formatGrowth(row.growth, row.netSalesCurrent, row.netSalesPrev)}
            </span>
          );
        },
      }),
      columnHelper.accessor('oneToThirty', {
        header: '0 - 30',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('thirtyOneToSixty', {
        header: '31 - 60',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('sixtyOneToNinety', {
        header: '61 - 90',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('ninetyOneToOneTwenty', {
        header: '91 - 120',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('older', {
        header: 'Older',
        cell: (info) => <span className="text-red-600 font-semibold">{info.getValue().toLocaleString('en-US')}</span>,
      }),
      columnHelper.accessor('totalAging', {
        header: 'Total',
        cell: (info) => (
          <span className={`font-bold ${info.getValue() > 0 ? 'text-gray-900' : 'text-green-600'}`}>
            {info.getValue().toLocaleString('en-US')}
          </span>
        ),
      }),
    ],
    [currentYear, previousYear]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  const selectedSalesSourceLabel =
    SALES_SOURCE_OPTIONS.find((opt) => opt.value === salesSource)?.label ?? 'Debit Ledger';

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto w-full">
      <div className="flex items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative gap-4">
        <div className="flex-1 flex justify-center items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by customer or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50 transition-all focus:bg-white text-center"
          />

          <div className="relative min-w-[200px] shrink-0" ref={salesSourceDropdownRef}>
            <button
              type="button"
              onClick={() => setSalesSourceOpen((open) => !open)}
              className="w-full whitespace-nowrap px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-slate-700 flex items-center justify-between gap-3 transition-all hover:bg-white hover:border-slate-300 shadow-sm"
            >
              <span className="text-sm truncate">{selectedSalesSourceLabel}</span>
              {salesLoading ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
              ) : (
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${salesSourceOpen ? 'rotate-180' : ''}`}
                />
              )}
            </button>
            {salesSourceOpen && (
              <div className="absolute z-30 mt-2 left-0 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="py-1">
                  {SALES_SOURCE_OPTIONS.map((opt) => {
                    const isSelected = opt.value === salesSource;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSalesSource(opt.value);
                          setSalesSourceOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative min-w-[220px] shrink-0" ref={cityDropdownRef}>
            <button
              type="button"
              onClick={() => setCityDropdownOpen((open) => !open)}
              className="w-full min-w-[220px] whitespace-nowrap px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-slate-700 flex items-center justify-between gap-3 transition-all hover:bg-white hover:border-slate-300 shadow-sm"
            >
              <span className="inline-flex items-center gap-2 flex-1 min-w-0">
                <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm truncate">
                  {selectedCity === 'ALL' ? 'All Cities' : selectedCity}
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${cityDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {cityDropdownOpen && (
              <div className="absolute z-30 mt-2 left-0 w-full min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2.5 border-b border-slate-100 bg-slate-50">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      placeholder="Search city..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCity('ALL');
                      setCityDropdownOpen(false);
                      setCitySearch('');
                    }}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors text-sm ${
                      selectedCity === 'ALL'
                        ? 'bg-blue-50 text-blue-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <MapPin className={`w-3.5 h-3.5 ${selectedCity === 'ALL' ? 'text-blue-500' : 'text-slate-400'}`} />
                      All Cities
                    </span>
                    {selectedCity === 'ALL' && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                  </button>

                  {filteredCitiesForDropdown.length === 0 ? (
                    <div className="px-4 py-5 text-center text-sm font-medium text-slate-500">
                      No cities found
                    </div>
                  ) : (
                    filteredCitiesForDropdown.map((city) => {
                      const isSelected = city === selectedCity;
                      return (
                        <button
                          key={city}
                          type="button"
                          onClick={() => {
                            setSelectedCity(city);
                            setCityDropdownOpen(false);
                            setCitySearch('');
                          }}
                          className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors text-sm whitespace-nowrap ${
                            isSelected
                              ? 'bg-blue-50 text-blue-900 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
                            <span>{city}</span>
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-xl border border-slate-200 shadow-inner">
            <span className="text-[10px] font-bold text-slate-500 ml-2 uppercase tracking-wider">Negatives</span>
            <button
              onClick={() => setHideNegative(!hideNegative)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-sm ${hideNegative ? 'bg-slate-300' : 'bg-emerald-500'
                }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md ${hideNegative ? 'translate-x-1' : 'translate-x-6'
                  }`}
              />
            </button>
            <span className={`text-[10px] font-bold mr-2 uppercase tracking-wider transition-colors ${hideNegative ? 'text-slate-400' : 'text-emerald-600'}`}>
              {hideNegative ? "Hidden" : "Shown"}
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center h-10 w-10 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {table.getRowModel().rows.length === 0 ? (
            <NoData />
          ) : (
            <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: '1100px' }}>
              <thead className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const id = header.column.id;
                      let width = '8%';
                      if (id === 'customerName') width = '26%';
                      if (id === 'growth') width = '7%';
                      return (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-center font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-700 transition-colors whitespace-nowrap select-none"
                          style={{ width }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span className="text-[10px] text-slate-400">
                              {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? null}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.map((row, idx) => (
                  <tr key={row.id} className={`border-b hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    {row.getVisibleCells().map((cell) => {
                      const id = cell.column.id;
                      let width = '8%';
                      if (id === 'customerName') width = '26%';
                      if (id === 'growth') width = '7%';
                      return (
                        <td
                          key={cell.id}
                          className={`px-4 py-3 align-top ${
                            id === 'customerName'
                              ? 'text-center whitespace-normal'
                              : 'text-center whitespace-nowrap'
                          }`}
                          style={{ width }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Grand Total Row */}
                {(() => {
                  const totalNetPrev = filteredData.reduce((sum, i) => sum + i.netSalesPrev, 0);
                  const totalNetCurrent = filteredData.reduce((sum, i) => sum + i.netSalesCurrent, 0);
                  const totalGrowth =
                    totalNetPrev > 0 ? ((totalNetCurrent - totalNetPrev) / totalNetPrev) * 100 : null;

                  return (
                <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-900">
                  <td className="px-4 py-4 text-center whitespace-normal align-top" style={{ width: '26%' }}>
                    TOTAL
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap text-emerald-400">
                    {totalNetPrev.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap text-emerald-400">
                    {totalNetCurrent.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap text-blue-200">
                    {formatGrowth(totalGrowth, totalNetCurrent, totalNetPrev)}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    {filteredData.reduce((sum, i) => sum + i.oneToThirty, 0).toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    {filteredData.reduce((sum, i) => sum + i.thirtyOneToSixty, 0).toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    {filteredData.reduce((sum, i) => sum + i.sixtyOneToNinety, 0).toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    {filteredData.reduce((sum, i) => sum + i.ninetyOneToOneTwenty, 0).toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap text-red-400">
                    {filteredData.reduce((sum, i) => sum + i.older, 0).toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap text-blue-200">
                    {filteredData.reduce((sum, i) => sum + i.totalAging, 0).toLocaleString('en-US')}
                  </td>
                </tr>
                  );
                })()}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
