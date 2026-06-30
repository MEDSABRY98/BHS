'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import { SalesInvoice } from '@/lib/supabase';;
import { Search, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import { exportSalesExcelWorkbook, recordsFromTable } from '@/app/Sales/Export/SalesExcelExport';
import NoData from '@/app/Components/NoDataTab';
import SalesTabLoader from './SalesTabLoader';

interface Props {
  userId: string;
  refreshTrigger?: number;
}

const ITEMS_PER_PAGE = 50;

const MONTH_NAMES = [
  { value: '', label: 'Full Year' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

type SortField = 'name' | 'prev' | 'curr' | 'diff' | 'pct';

interface ComparisonRow {
  customerId: string;
  mainName: string;
  subName: string;
  prev: number;
  curr: number;
  diff: number;
  pct: number; // percentage change
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PctBadge = ({ pct }: { pct: number }) => {
  if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-gray-400 text-xs font-bold"><Minus className="w-3 h-3" /> 0%</span>;
  if (pct > 0) return <span className="inline-flex items-center gap-0.5 text-emerald-600 text-xs font-bold"><TrendingUp className="w-3 h-3" />+{pct.toFixed(1)}%</span>;
  return <span className="inline-flex items-center gap-0.5 text-red-500 text-xs font-bold"><TrendingDown className="w-3 h-3" />{pct.toFixed(1)}%</span>;
};

const CompRow = memo(({ row, rowNum, prevLabel, currLabel }: {
  row: ComparisonRow;
  rowNum: number;
  prevLabel: string;
  currLabel: string;
}) => {
  const diffPositive = row.diff >= 0;
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 text-center transition-colors">
      <td className="py-3 px-3 text-xs text-gray-500 font-medium">{rowNum}</td>
      <td className="py-3 px-3 text-sm text-gray-700 font-semibold text-left truncate max-w-[140px]" title={row.mainName}>{row.mainName}</td>
      <td className="py-3 px-3 text-sm text-gray-600 text-left truncate max-w-[160px]" title={row.subName}>{row.subName}</td>
      <td className="py-3 px-3 text-sm text-gray-700 font-medium">{fmt(row.prev)}</td>
      <td className="py-3 px-3 text-sm text-gray-700 font-medium">{fmt(row.curr)}</td>
      <td className={`py-3 px-3 text-sm font-bold ${diffPositive ? 'text-emerald-600' : 'text-red-500'}`}>
        {diffPositive ? '+' : ''}{fmt(row.diff)}
      </td>
      <td className="py-3 px-3">
        <PctBadge pct={row.pct} />
      </td>
    </tr>
  );
});
CompRow.displayName = 'CompRow';

export default function SalesCustomersComparisonTab({ userId, refreshTrigger }: Props) {
  const { commonFilters: filters } = useSalesModuleFilters();
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const currentYear = today.getFullYear();
  const prevYear = currentYear - 1;

  const [selectedMonth, setSelectedMonth] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('curr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [customerType, setCustomerType] = useState<'sub' | 'main'>('sub');

  const [mainComparisonData, setMainComparisonData] = useState<ComparisonRow[]>([]);
  const [subComparisonData, setSubComparisonData] = useState<ComparisonRow[]>([]);

  // Fetch from server
  useEffect(() => {
    const fetchComparison = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/Sales/CustomersComparison', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters, userId, currentYear, prevYear, selectedMonth })
        });
        if (!response.ok) throw new Error('Failed to fetch customers comparison');
        const result = await response.json();
        setMainComparisonData(result.mainComparison || []);
        setSubComparisonData(result.subComparison || []);
      } catch (error) {
        console.error('Error fetching customers comparison:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchComparison();
  }, [filters, userId, selectedMonth, currentYear, prevYear, refreshTrigger]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset page on filter changes
  useEffect(() => { setCurrentPage(1); }, [selectedMonth, customerType, sortField, sortDir]);

  // Column labels
  const prevLabel = useMemo(() => {
    if (!selectedMonth) return `${prevYear}`;
    const m = MONTH_NAMES.find(m => m.value === selectedMonth);
    return m ? `${m.label} ${prevYear}` : `${prevYear}`;
  }, [selectedMonth, prevYear]);

  const currLabel = useMemo(() => {
    if (!selectedMonth) return `${currentYear}`;
    const m = MONTH_NAMES.find(m => m.value === selectedMonth);
    return m ? `${m.label} ${currentYear}` : `${currentYear}`;
  }, [selectedMonth, currentYear]);

  // Build comparison data for the current view
  const comparisonData: ComparisonRow[] = useMemo(() => {
    return customerType === 'main' ? mainComparisonData : subComparisonData;
  }, [mainComparisonData, subComparisonData, customerType]);

  // Filter + sort
  const filtered = useMemo(() => {
    let rows = [...comparisonData];

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      rows = rows.filter(r =>
        r.mainName.toLowerCase().includes(q) ||
        r.subName.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortField === 'name') {
        av = customerType === 'main' ? a.mainName : a.subName;
        bv = customerType === 'main' ? b.mainName : b.subName;
      }
      else if (sortField === 'prev') { av = a.prev; bv = b.prev; }
      else if (sortField === 'curr') { av = a.curr; bv = b.curr; }
      else if (sortField === 'diff') { av = a.diff; bv = b.diff; }
      else if (sortField === 'pct') { av = a.pct; bv = b.pct; }

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [comparisonData, debouncedSearch, sortField, sortDir, customerType]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const totals = useMemo(() => {
    const prev = filtered.reduce((s, r) => s + r.prev, 0);
    const curr = filtered.reduce((s, r) => s + r.curr, 0);
    const diff = curr - prev;
    const pct = prev > 0 ? (diff / prev) * 100 : (curr > 0 ? 100 : 0);
    return { prev, curr, diff, pct };
  }, [filtered]);

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-25" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-green-600" />
      : <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-green-600" />;
  };

  const exportToExcel = async () => {
    // Generate and sort Main Customers
    let mainFiltered = [...mainComparisonData];
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      mainFiltered = mainFiltered.filter(r => r.mainName.toLowerCase().includes(q));
    }
    mainFiltered.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortField === 'name') { av = a.mainName; bv = b.mainName; }
      else if (sortField === 'prev') { av = a.prev; bv = b.prev; }
      else if (sortField === 'curr') { av = a.curr; bv = b.curr; }
      else if (sortField === 'diff') { av = a.diff; bv = b.diff; }
      else if (sortField === 'pct') { av = a.pct; bv = b.pct; }

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const mainHeaders = ['#', 'Main Customer', prevLabel, currLabel, 'Difference', '% Change'];
    const mainRows = mainFiltered.map((r, i) => [
      i + 1,
      r.mainName,
      r.prev,
      r.curr,
      r.diff,
      `${r.pct.toFixed(1)}%`,
    ]);
    const mainPrevTotal = mainFiltered.reduce((sum, r) => sum + r.prev, 0);
    const mainCurrTotal = mainFiltered.reduce((sum, r) => sum + r.curr, 0);
    const mainDiffTotal = mainCurrTotal - mainPrevTotal;
    const mainPctTotal = mainPrevTotal > 0 ? (mainDiffTotal / mainPrevTotal) * 100 : (mainCurrTotal > 0 ? 100 : 0);
    mainRows.push([
      'Totals',
      `${mainFiltered.length} customers`,
      mainPrevTotal,
      mainCurrTotal,
      mainDiffTotal,
      `${mainPctTotal.toFixed(1)}%`
    ]);

    // Generate and sort Sub Customers
    let subFiltered = [...subComparisonData];
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      subFiltered = subFiltered.filter(r => r.subName.toLowerCase().includes(q) || r.mainName.toLowerCase().includes(q));
    }
    subFiltered.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortField === 'name') { av = a.subName; bv = b.subName; }
      else if (sortField === 'prev') { av = a.prev; bv = b.prev; }
      else if (sortField === 'curr') { av = a.curr; bv = b.curr; }
      else if (sortField === 'diff') { av = a.diff; bv = b.diff; }
      else if (sortField === 'pct') { av = a.pct; bv = b.pct; }

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const subHeaders = ['#', 'Sub Customer', prevLabel, currLabel, 'Difference', '% Change'];
    const subRows = subFiltered.map((r, i) => [
      i + 1,
      r.subName,
      r.prev,
      r.curr,
      r.diff,
      `${r.pct.toFixed(1)}%`,
    ]);
    const subPrevTotal = subFiltered.reduce((sum, r) => sum + r.prev, 0);
    const subCurrTotal = subFiltered.reduce((sum, r) => sum + r.curr, 0);
    const subDiffTotal = subCurrTotal - subPrevTotal;
    const subPctTotal = subPrevTotal > 0 ? (subDiffTotal / subPrevTotal) * 100 : (subCurrTotal > 0 ? 100 : 0);
    subRows.push([
      'Totals',
      `${subFiltered.length} customers`,
      subPrevTotal,
      subCurrTotal,
      subDiffTotal,
      `${subPctTotal.toFixed(1)}%`
    ]);

    await exportSalesExcelWorkbook(
      [
        {
          name: 'Main Customers',
          data: recordsFromTable(mainHeaders, mainRows),
          options: {
            numericColumns: [prevLabel, currLabel, 'Difference'],
            highlightNegativeInColumns: ['Difference'],
          },
        },
        {
          name: 'Sub Customers',
          data: recordsFromTable(subHeaders, subRows),
          options: {
            numericColumns: [prevLabel, currLabel, 'Difference'],
            highlightNegativeInColumns: ['Difference'],
          },
        },
      ],
      `customers_comparison_${currentYear}_vs_${prevYear}.xlsx`
    );
  };

  if (loading) {
    return <SalesTabLoader />;
  } return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-medium text-slate-800">Customers Comparison</h1>

          {/* Year badge */}
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-xl px-3 py-1.5">
            <span className="text-xs font-bold text-green-700">{prevLabel}</span>
            <span className="text-gray-400 text-xs">vs</span>
            <span className="text-xs font-bold text-green-700">{currLabel}</span>
          </div>

          {/* Main / Sub toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setCustomerType('sub')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${customerType === 'sub' ? 'bg-white text-green-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >Sub Customers</button>
            <button
              onClick={() => setCustomerType('main')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${customerType === 'main' ? 'bg-white text-green-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >Main Customers</button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          {/* Month picker */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-green-400 transition-all shadow-sm"
          >
            {MONTH_NAMES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            <input
              type="text"
              placeholder="Search customer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:border-green-500 outline-none transition-all shadow-sm text-sm font-medium"
            />
          </div>

          {/* Export */}
          <button
            onClick={exportToExcel}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: prevLabel, value: totals.prev, color: 'blue' },
          { label: currLabel, value: totals.curr, color: 'green' },
          {
            label: 'Difference',
            value: totals.diff,
            color: totals.diff >= 0 ? 'emerald' : 'red',
            prefix: totals.diff >= 0 ? '+' : ''
          },
          {
            label: '% Change',
            raw: `${totals.pct >= 0 ? '+' : ''}${totals.pct.toFixed(1)}%`,
            color: totals.pct >= 0 ? 'emerald' : 'red'
          },
        ].map((c, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.color === 'blue' ? 'text-blue-600' : c.color === 'green' ? 'text-green-600' : c.color === 'emerald' ? 'text-emerald-600' : 'text-red-500'}`}>
              {c.raw ?? `${c.prefix ?? ''}${fmt(c.value!)}`}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="py-4 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-12">#</th>
                  {customerType === 'main' ? (
                    <th
                      className="py-4 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 min-w-[180px]"
                      onClick={() => handleSort('name')}
                    >Main Customer <SortIcon field="name" /></th>
                  ) : (
                    <th
                      className="py-4 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 min-w-[180px]"
                      onClick={() => handleSort('name')}
                    >Sub Customer <SortIcon field="name" /></th>
                  )}
                  <th
                    className="py-4 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 min-w-[100px]"
                    onClick={() => handleSort('prev')}
                  >{prevLabel} <SortIcon field="prev" /></th>
                  <th
                    className="py-4 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 min-w-[100px]"
                    onClick={() => handleSort('curr')}
                  >{currLabel} <SortIcon field="curr" /></th>
                  <th
                    className="py-4 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 min-w-[100px]"
                    onClick={() => handleSort('diff')}
                  >Diff <SortIcon field="diff" /></th>
                  <th
                    className="py-4 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 min-w-[100px]"
                    onClick={() => handleSort('pct')}
                  >% <SortIcon field="pct" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((row, idx) => (
                  <tr key={row.customerId} className="border-b border-gray-100 hover:bg-gray-50 text-center transition-colors">
                    <td className="py-3 px-3 text-xs text-gray-500 font-medium">{startIdx + idx + 1}</td>
                    <td className="py-3 px-3 text-sm text-gray-700 font-semibold text-center min-w-[180px] max-w-[180px] whitespace-normal break-words" title={customerType === 'main' ? row.mainName : row.subName}>
                      {customerType === 'main' ? row.mainName : row.subName}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-600">{fmt(row.prev)}</td>
                    <td className="py-3 px-3 text-sm text-gray-800 font-semibold">{fmt(row.curr)}</td>
                    <td className={`py-3 px-3 text-sm font-bold ${row.diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {row.diff >= 0 ? '+' : ''}{fmt(row.diff)}
                    </td>
                    <td className="py-3 px-3"><PctBadge pct={row.pct} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50/50 font-bold border-t border-gray-100">
                <tr className="text-center">
                  <td colSpan={2} className="py-4 px-3 text-xs text-gray-500 uppercase tracking-widest text-center">
                    Totals ({filtered.length} customers)
                  </td>
                  <td className="py-4 px-3 text-sm text-gray-700">{fmt(totals.prev)}</td>
                  <td className="py-4 px-3 text-sm text-gray-700">{fmt(totals.curr)}</td>
                  <td className={`py-4 px-3 text-sm font-bold ${totals.diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {totals.diff >= 0 ? '+' : ''}{fmt(totals.diff)}
                  </td>
                  <td className="py-4 px-3"><PctBadge pct={totals.pct} /></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">{filtered.length} results</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
                ><ChevronLeft className="w-4 h-4" /></button>
                <div className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 shadow-sm">
                  {currentPage} / {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
                ><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
