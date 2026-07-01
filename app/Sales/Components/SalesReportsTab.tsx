'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  LabelList,
} from 'recharts';
import { FileSpreadsheet, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import { exportSalesExcelWorkbook } from '@/app/Sales/Export/SalesExcelExport';
import { generateSalesReportsZip } from '@/app/Sales/Export/SalesReportsExport';
import { saveAs } from 'file-saver';
import { toast } from '@/app/Components/Notification';
import SalesTabLoader from './SalesTabLoader';
import NoData from '@/app/Components/NoDataTab';
import ReportsDailyCalendar from './ReportsDailyCalendar';
import type { DailySalesCalendar } from '@/app/Sales/Utils/ReportsAggregation';
import {
  getAmountTableSubtitle,
  getChartActualLabel,
  getChartTitle,
  getCustomersTableTitle,
  getReturnCustomersTableTitle,
  getKpiLabel,
  getKpiCompareLabel,
  getVisibleKpiKeys,
  resolveReportingMode,
  shouldInvertReturnKpiChange,
  shouldShowTargetInChart,
  REPORTING_MODE_LABELS,
  type KpiConfigKey,
} from '@/app/Sales/Utils/ReportingMode';

type CompareMode = 'prevMonth' | 'sameMonthLastYear';
type CustomerView = 'main' | 'sub';

type ReportsTableTab =
  | 'sales-invoices'
  | 'return-invoices'
  | 'top-customers'
  | 'top-return-customers'
  | 'growing'
  | 'declining'
  | 'at-risk'
  | 'products'
  | 'categories';

type CustomerCompareBlock = {
  topCustomers: any[];
  topReturnCustomers: any[];
  topDeclining: any[];
  topGrowing: any[];
  atRisk: any[];
};

type ReportsPayload = {
  repDisplayName: string;
  periodLabel: string;
  reportingMode?: 'all' | 'sales' | 'returns';
  reportingModeLabel?: string;
  primaryAmountLabel?: string;
  compareModes: Record<CompareMode, { label: string }>;
  kpis: Record<string, any>;
  kpiViews?: Record<CompareMode, Record<string, any>>;
  monthlyComparison: { month: string; actual: number; target: number; lastYear: number; prevMonth: number }[];
  dailySalesCalendars?: DailySalesCalendar[];
  customerViews: Record<CustomerView, Record<CompareMode, CustomerCompareBlock>>;
  topProducts: any[];
  topCategories: any[];
  topSalesInvoices?: Array<{
    rank: number;
    date: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
  }>;
  topReturnInvoices?: Array<{
    rank: number;
    date: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
  }>;
};

interface SalesReportsTabProps {
  userId: string;
  refreshTrigger?: number;
}

const BORDER_COLORS: Record<string, string> = {
  green: 'border-t-emerald-500',
  blue: 'border-t-blue-500',
  navy: 'border-t-slate-800',
  emerald: 'border-t-emerald-400',
  purple: 'border-t-purple-500',
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
};

function getMonthDateRange(year: string, month: string): { from: string; to: string } {
  if (!year || !month) return { from: '', to: '' };
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${String(m).padStart(2, '0')}-01`,
    to: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function getDefaultMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${String(m).padStart(2, '0')}-01`,
    to: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function fmtBarLabel(val: unknown): string {
  const n = Number(val);
  if (!n) return '';
  return n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

function fmtNum(n: number) {
  return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtInt(n: number) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

function fmtPct(n: number | undefined | null) {
  return `${(Number(n) || 0).toFixed(1)}%`;
}

const KPI_COLORS: Record<KpiConfigKey, string> = {
  totalSales: 'green',
  targetAchievement: 'emerald',
  returnsRate: 'rose',
  invoices: 'blue',
  avgInvoiceValue: 'purple',
  returnInvoices: 'rose',
  avgReturnValue: 'rose',
  activeCustomers: 'navy',
  newCustomers: 'amber',
};

function getKpiDisplay(
  key: KpiConfigKey,
  kpi: Record<string, unknown>,
  totalSalesKpi?: Record<string, unknown>
): { displayValue: string; sub?: string; subInline?: boolean } {
  switch (key) {
    case 'totalSales':
      return { displayValue: fmtNum(Number(kpi.value) || 0) };
    case 'targetAchievement':
      return {
        displayValue: fmtPct(Number(kpi.value)),
        sub: fmtNum(Number(kpi.targetAmount) || 0),
        subInline: true,
      };
    case 'returnsRate': {
      const amount = Number(kpi.grvAmount ?? kpi.returnsAmount ?? totalSalesKpi?.returnsAmount ?? 0);
      return { displayValue: fmtNum(amount), sub: fmtPct(Number(kpi.value)), subInline: true };
    }
    case 'invoices':
    case 'returnInvoices':
    case 'activeCustomers':
    case 'newCustomers':
      return { displayValue: fmtInt(Number(kpi.value) || 0) };
    case 'avgInvoiceValue':
    case 'avgReturnValue':
      return { displayValue: fmtNum(Number(kpi.value) || 0) };
    default:
      return { displayValue: '—' };
  }
}

const SPARKLINE_COLORS: Record<string, string> = {
  green: '#10B981',
  emerald: '#34D399',
  rose: '#F43F5E',
  blue: '#3B82F6',
  purple: '#A855F7',
  navy: '#0F172A',
  amber: '#F59E0B',
};

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900 ring-amber-300/60 shadow-sm' :
    rank === 2 ? 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 ring-slate-300/50' :
    rank === 3 ? 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-900 ring-orange-300/50' :
    'bg-white text-slate-400 ring-slate-200/70';
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ring-1 ${cls}`}>
      {rank}
    </span>
  );
}

const MINI_TABLE = 'w-full text-sm border-separate border-spacing-0';
const MINI_TH = 'py-3.5 px-4 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-900/65 whitespace-nowrap';
const MINI_TD = 'py-3.5 px-4 text-center text-sm text-slate-600 leading-relaxed align-middle';
const MINI_TR = 'bg-white border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/50';
const REPORTS_THEAD_ROW = 'bg-gradient-to-b from-emerald-50 via-emerald-50/40 to-white border-b border-emerald-100/80';

function ReportsTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-emerald-100/70 bg-white shadow-[0_1px_4px_rgba(16,185,129,0.06)] ring-1 ring-slate-100/80">
      <table className={MINI_TABLE}>{children}</table>
    </div>
  );
}

function ReportsTableHead({ headers }: { headers: string[] }) {
  return (
    <thead>
      <tr className={REPORTS_THEAD_ROW}>
        {headers.map((h) => (
          <th key={h} className={MINI_TH}>{h}</th>
        ))}
      </tr>
    </thead>
  );
}

function ShareBar({ pct, color = 'emerald' }: { pct: number; color?: 'emerald' | 'purple' | 'rose' }) {
  const fill =
    color === 'purple'
      ? 'bg-gradient-to-r from-violet-400 to-purple-600'
      : color === 'rose'
        ? 'bg-gradient-to-r from-rose-400 to-red-600'
        : 'bg-gradient-to-r from-emerald-400 to-teal-600';
  const track =
    color === 'purple' ? 'bg-purple-100/70' : color === 'rose' ? 'bg-rose-100/70' : 'bg-emerald-100/70';
  return (
    <div className="flex items-center justify-center gap-2">
      <div className={`w-[4.5rem] h-1.5 ${track} rounded-full overflow-hidden`}>
        <div
          className={`h-full ${fill} rounded-full transition-[width] duration-300`}
          style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-500 tabular-nums">{fmtPct(pct)}</span>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-[60px] h-7 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({ label, color, kpi, displayValue, sub, subInline, invertChangeColor, compareLabel }: {
  label: string;
  color: string;
  kpi: any;
  displayValue: string;
  sub?: string;
  subInline?: boolean;
  invertChangeColor?: boolean;
  compareLabel: string;
}) {
  const change = kpi.changePct ?? kpi.changeAbs ?? 0;
  const isPct = kpi.changePct !== undefined;
  const up = change >= 0;
  const isGood = invertChangeColor ? !up : up;
  const sparkColor = SPARKLINE_COLORS[color] ?? '#0F172A';

  return (
    <div className={`bg-white border border-slate-200 rounded-[14px] p-4 shadow-sm border-t-[3px] ${BORDER_COLORS[color]} hover:shadow-md transition-shadow`}>
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</div>
      {sub && subInline ? (
        <div className="flex items-baseline justify-start gap-2 mb-1">
          <span className="text-2xl font-extrabold text-slate-900">{displayValue}</span>
          <span className="text-sm font-semibold text-slate-400">{sub}</span>
        </div>
      ) : (
        <>
          <div className="text-2xl font-extrabold text-slate-900 mb-1">{displayValue}</div>
          {sub && <div className="text-[10px] text-slate-400 mb-2">{sub}</div>}
        </>
      )}
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
          {up ? '▲' : '▼'} {isPct ? fmtPct(Math.abs(Number(change) || 0)) : Math.abs(Number(change) || 0)} {compareLabel}
        </span>
        {Array.isArray(kpi.sparkline) && kpi.sparkline.length > 0 && (
          <Sparkline data={kpi.sparkline} color={sparkColor} />
        )}
      </div>
    </div>
  );
}

function TopCustomersRankTable({
  rows,
  variant = 'sales',
}: {
  rows: Array<{
    rank: number;
    name: string;
    invoices: number;
    amount: number;
    comparePct?: number;
    sharePct?: number;
  }>;
  variant?: 'sales' | 'returns';
}) {
  const amountClass = variant === 'returns' ? 'text-rose-700' : 'text-emerald-700';
  const shareColor = variant === 'returns' ? 'rose' as const : 'emerald' as const;
  const invertCompare = variant === 'returns';

  return (
    <ReportsTable>
      <ReportsTableHead headers={['#', 'Customer', 'Invoices', 'Amount', 'vs Compare', 'Share']} />
      <tbody>
        {rows.map((r) => {
          const pct = r.comparePct ?? 0;
          const compareGood = invertCompare ? pct <= 0 : pct >= 0;
          return (
            <tr key={r.name} className={MINI_TR}>
              <td className={MINI_TD}><RankBadge rank={r.rank} /></td>
              <td className={`${MINI_TD} font-medium text-slate-800`}>{r.name}</td>
              <td className={`${MINI_TD} tabular-nums text-slate-600`}>{r.invoices}</td>
              <td className={`${MINI_TD} font-semibold tabular-nums ${amountClass}`}>{fmtNum(r.amount)}</td>
              <td className={`${MINI_TD} font-semibold tabular-nums ${compareGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                {pct >= 0 ? '+' : ''}{fmtPct(r.comparePct)}
              </td>
              <td className={MINI_TD}>
                <ShareBar pct={r.sharePct ?? 0} color={shareColor} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </ReportsTable>
  );
}

function InvoiceRankTable({
  rows,
  amountClassName = 'text-emerald-700',
}: {
  rows: Array<{ rank: number; date: string; invoiceNumber: string; customerName: string; amount: number }>;
  amountClassName?: string;
}) {
  if (!rows.length) {
    return <NoData title="NO INVOICE DATA" />;
  }
  return (
    <ReportsTable>
      <ReportsTableHead headers={['#', 'Date', 'Invoice No.', 'Customer', 'Amount']} />
      <tbody>
        {rows.map((r) => (
          <tr key={r.invoiceNumber} className={MINI_TR}>
            <td className={MINI_TD}><RankBadge rank={r.rank} /></td>
            <td className={`${MINI_TD} text-slate-500 whitespace-nowrap tabular-nums`}>{r.date}</td>
            <td className={`${MINI_TD} font-mono text-xs text-slate-400`}>{r.invoiceNumber}</td>
            <td className={`${MINI_TD} font-medium text-slate-800`}>{r.customerName}</td>
            <td className={`${MINI_TD} font-semibold tabular-nums ${amountClassName}`}>{fmtNum(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </ReportsTable>
  );
}

export default function SalesReportsTab({ userId, refreshTrigger }: SalesReportsTabProps) {
  const {
    commonFilters: filters,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    setFilterYear,
    setFilterMonth,
  } = useSalesModuleFilters();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>('prevMonth');
  const [customerView, setCustomerView] = useState<CustomerView>('main');
  const [activeTableTab, setActiveTableTab] = useState<ReportsTableTab>('top-customers');

  useEffect(() => {
    const fetchReports = async () => {
      if (!userId) { setLoading(false); return; }
      setLoading(true);
      try {
        const res = await fetch('/api/Sales/Reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, filters }),
        });
        if (!res.ok) throw new Error('Failed to fetch reports');
        setData(await res.json());
      } catch (err) {
        console.error('Reports fetch error:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [userId, filters, refreshTrigger]);

  const compareBlock = data?.customerViews?.[customerView]?.[compareMode];
  const compareLabel = data?.compareModes?.[compareMode]?.label ?? '';
  const kpiCompareLabel = getKpiCompareLabel(compareMode, compareLabel);
  const activeKpis = data?.kpiViews?.[compareMode] ?? data?.kpis;
  const reportingMode = resolveReportingMode(data?.reportingMode ?? filters.invoiceType);
  const reportingModeLabel =
    data?.reportingModeLabel ?? REPORTING_MODE_LABELS[reportingMode];
  const visibleKpiKeys = getVisibleKpiKeys(reportingMode);
  const showTargetInChart = shouldShowTargetInChart(reportingMode);
  const customerViewLabel = customerView === 'main' ? 'Main Customer' : 'Sub Customer';
  const chartCompareKey = compareMode === 'prevMonth' ? 'prevMonth' : 'lastYear';
  const chartCompareLabel = compareMode === 'prevMonth' ? 'Previous Month' : 'Same Period Last Year';
  const chartTitle = getChartTitle(reportingMode, compareMode);
  const chartActualLabel = getChartActualLabel(reportingMode);
  const customersTableTitle = getCustomersTableTitle(reportingMode);
  const amountTableSubtitle = getAmountTableSubtitle(reportingMode);
  const showSalesInvoicesTable = reportingMode !== 'returns';
  const showReturnInvoicesTable = reportingMode !== 'sales';
  const showTopReturnCustomersTable = reportingMode !== 'returns';

  const tableTabs = useMemo(() => {
    const tabs: { id: ReportsTableTab; label: string }[] = [];
    if (showSalesInvoicesTable) tabs.push({ id: 'sales-invoices', label: 'Sales Invoices' });
    if (showReturnInvoicesTable) tabs.push({ id: 'return-invoices', label: 'Returns' });
    tabs.push({ id: 'top-customers', label: 'Top Customers' });
    if (showTopReturnCustomersTable) tabs.push({ id: 'top-return-customers', label: 'Return Customers' });
    tabs.push(
      { id: 'growing', label: 'Growing' },
      { id: 'declining', label: 'Declining' },
      { id: 'at-risk', label: 'At-Risk' },
      { id: 'products', label: 'Products' },
      { id: 'categories', label: 'Categories' },
    );
    return tabs;
  }, [showSalesInvoicesTable, showReturnInvoicesTable, showTopReturnCustomersTable]);

  useEffect(() => {
    if (tableTabs.length > 0 && !tableTabs.some((t) => t.id === activeTableTab)) {
      setActiveTableTab(tableTabs[0].id);
    }
  }, [tableTabs, activeTableTab]);

  const activeTableMeta = useMemo(() => {
    switch (activeTableTab) {
      case 'sales-invoices':
        return { title: 'Top 10 Invoices by Value', subtitle: 'Sales invoices ranked by amount this period' };
      case 'return-invoices':
        return { title: 'Top 10 Returns by Value', subtitle: 'Return invoices ranked by amount this period' };
      case 'top-customers':
        return { title: customersTableTitle, subtitle: `${customerViewLabel} — ranked by revenue vs ${compareLabel}` };
      case 'top-return-customers':
        return { title: getReturnCustomersTableTitle(), subtitle: `${customerViewLabel} — ranked by return amount vs ${compareLabel}` };
      case 'growing':
        return { title: 'Top 10 Growing Customers', subtitle: `${customerViewLabel} — largest growth vs ${compareLabel}` };
      case 'declining':
        return { title: 'Top 10 Most Declining Customers', subtitle: `${customerViewLabel} — largest drop vs ${compareLabel}` };
      case 'at-risk':
        return { title: 'At-Risk Customers', subtitle: `${customerViewLabel} — active in ${compareLabel}, zero this period` };
      case 'products':
        return { title: 'Top 10 Products', subtitle: amountTableSubtitle };
      case 'categories':
        return { title: 'Top 10 Categories', subtitle: amountTableSubtitle };
      default:
        return { title: '', subtitle: '' };
    }
  }, [
    activeTableTab,
    customersTableTitle,
    customerViewLabel,
    compareLabel,
    amountTableSubtitle,
  ]);

  const monthRange = getMonthDateRange(filters.year, filters.month);
  const defaultRange = getDefaultMonthRange();
  const displayFrom = dateFrom || monthRange.from || defaultRange.from;
  const displayTo = dateTo || monthRange.to || defaultRange.to;

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    if (value) {
      setFilterYear('');
      setFilterMonth('');
      if (!dateTo) setDateTo(displayTo);
    }
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    if (value) {
      setFilterYear('');
      setFilterMonth('');
      if (!dateFrom) setDateFrom(displayFrom);
    }
  };

  const handleExport = useCallback(() => {
    if (!data || !compareBlock) return;
    const exportKpis = data.kpiViews?.[compareMode] ?? data.kpis;
    const sheets = [
      {
        name: 'Summary',
        data: [
          { Metric: 'Rep', Value: data.repDisplayName },
          { Metric: 'Reporting Mode', Value: reportingModeLabel },
          { Metric: 'Period', Value: data.periodLabel },
          { Metric: 'Compare vs', Value: kpiCompareLabel },
          { Metric: getKpiLabel('totalSales', reportingMode), Value: exportKpis.totalSales?.value },
          ...(exportKpis.targetAchievement
            ? [
                { Metric: 'Target Achievement %', Value: exportKpis.targetAchievement?.value },
                { Metric: 'Target Amount', Value: exportKpis.targetAchievement?.targetAmount },
              ]
            : []),
          ...(exportKpis.returnsRate
            ? [
                { Metric: 'Return Amount', Value: exportKpis.returnsRate?.grvAmount },
                { Metric: 'Return Amount %', Value: exportKpis.returnsRate?.value },
                { Metric: 'Return Invoices', Value: exportKpis.returnInvoices?.value },
                { Metric: 'Avg Return Value', Value: exportKpis.avgReturnValue?.value },
              ]
            : []),
          { Metric: getKpiLabel('invoices', reportingMode), Value: exportKpis.invoices?.value },
          { Metric: getKpiLabel('avgInvoiceValue', reportingMode), Value: exportKpis.avgInvoiceValue?.value },
          { Metric: 'Active Customers', Value: exportKpis.activeCustomers?.value },
          { Metric: 'New Customers', Value: exportKpis.newCustomers?.value },
        ],
      },
      {
        name: 'Monthly',
        data: data.monthlyComparison.map((r) => ({
          Month: r.month,
          Actual: r.actual,
          Target: r.target,
          [chartCompareLabel]: r[chartCompareKey as 'prevMonth' | 'lastYear'],
        })),
        options: { numericColumns: ['Actual', 'Target', chartCompareLabel] },
      },
      ...(data.topSalesInvoices?.length
        ? [{
            name: 'Top Sales Invoices',
            data: data.topSalesInvoices.map((r) => ({
              Rank: r.rank,
              Date: r.date,
              'Invoice No.': r.invoiceNumber,
              Customer: r.customerName,
              Amount: r.amount,
            })),
            options: { numericColumns: ['Amount'] },
          }]
        : []),
      ...(data.topReturnInvoices?.length
        ? [{
            name: 'Top Return Invoices',
            data: data.topReturnInvoices.map((r) => ({
              Rank: r.rank,
              Date: r.date,
              'Invoice No.': r.invoiceNumber,
              Customer: r.customerName,
              Amount: r.amount,
            })),
            options: { numericColumns: ['Amount'] },
          }]
        : []),
      {
        name: 'Top Customers',
        data: compareBlock.topCustomers.map((r) => ({
          Rank: r.rank,
          Customer: r.name,
          Invoices: r.invoices,
          Amount: r.amount,
          'Change %': r.comparePct,
          'Share %': r.sharePct,
        })),
        options: { numericColumns: ['Amount', 'Change %', 'Share %'] },
      },
      ...(reportingMode !== 'returns' && compareBlock.topReturnCustomers?.length
        ? [{
            name: 'Return Customers',
            data: compareBlock.topReturnCustomers.map((r) => ({
              Rank: r.rank,
              Customer: r.name,
              Invoices: r.invoices,
              Amount: r.amount,
              'Change %': r.comparePct,
              'Share %': r.sharePct,
            })),
            options: { numericColumns: ['Amount', 'Change %', 'Share %'] },
          }]
        : []),
      {
        name: 'Growing',
        data: compareBlock.topGrowing.map((r) => ({
          Rank: r.rank,
          Customer: r.name,
          Current: r.currentAmount,
          Compare: r.compareAmount,
          Change: r.changeAmount,
          'Change %': r.changePct,
        })),
        options: { numericColumns: ['Current', 'Compare', 'Change', 'Change %'] },
      },
      {
        name: 'Declining',
        data: compareBlock.topDeclining.map((r) => ({
          Rank: r.rank,
          Customer: r.name,
          Current: r.currentAmount,
          Compare: r.compareAmount,
          Change: r.changeAmount,
          'Change %': r.changePct,
        })),
        options: { numericColumns: ['Current', 'Compare', 'Change', 'Change %'], highlightNegativeInColumns: ['Change', 'Change %'] },
      },
      {
        name: 'At Risk',
        data: compareBlock.atRisk.map((r) => ({
          Rank: r.rank,
          Customer: r.name,
          'Last Active': r.compareAmount,
          Current: r.currentAmount,
        })),
        options: { numericColumns: ['Last Active', 'Current'] },
      },
      {
        name: 'Top Products',
        data: data.topProducts.map((r) => ({
          Rank: r.rank,
          Barcode: r.barcode,
          Product: r.name,
          QTY: r.qty,
          Amount: r.amount,
          'Share %': r.sharePct,
        })),
        options: { numericColumns: ['QTY', 'Amount', 'Share %'] },
      },
      {
        name: 'Top Categories',
        data: data.topCategories.map((r) => ({
          Rank: r.rank,
          Category: r.category,
          QTY: r.qty,
          Amount: r.amount,
          'Share %': r.sharePct,
        })),
        options: { numericColumns: ['QTY', 'Amount', 'Share %'] },
      },
    ];
    void exportSalesExcelWorkbook(sheets, `Sales_Reports_${data.periodLabel.replace(/\s+/g, '_')}`);
  }, [data, compareBlock, compareMode, chartCompareKey, chartCompareLabel, reportingMode, reportingModeLabel, kpiCompareLabel]);

  const handleExportPdf = useCallback(async () => {
    if (!data || !compareBlock || exportingPdf) return;
    setExportingPdf(true);
    const periodSlug = data.periodLabel.replace(/\s+/g, '_');
    toast.loading('Preparing reports ZIP...', { id: 'reports-zip' });
    try {
      const zipBlob = await generateSalesReportsZip({
        userId,
        data,
        filters,
        compareMode,
        customerView,
        dateFrom: displayFrom,
        dateTo: displayTo,
        onProgress: (current, total, label) => {
          toast.loading(`Generating PDFs (${current}/${total})${label ? ` — ${label}` : ''}...`, {
            id: 'reports-zip',
          });
        },
      });
      saveAs(zipBlob, `Sales_Reports_${periodSlug}.zip`);
      toast.dismiss('reports-zip');
      toast.success('Reports ZIP downloaded');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.dismiss('reports-zip');
      toast.error('Failed to export reports ZIP');
    } finally {
      setExportingPdf(false);
    }
  }, [
    data,
    compareBlock,
    compareMode,
    customerView,
    filters,
    displayFrom,
    displayTo,
    exportingPdf,
    userId,
  ]);

  const toolbar = (
    <div className="sticky top-0 z-20 w-full flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap flex-1 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="hidden sm:inline">From</span>
            <input
              type="date"
              value={displayFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
          </label>
          <span className="text-slate-300 font-light">—</span>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="hidden sm:inline">To</span>
            <input
              type="date"
              value={displayTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
          </label>
        </div>

        <div className="hidden sm:block w-px h-6 bg-slate-200 shrink-0" />

        {reportingModeLabel && (
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
            {reportingModeLabel}
          </span>
        )}

        <div className="hidden sm:block w-px h-6 bg-slate-200 shrink-0" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Compare vs:</span>
          {(['prevMonth', 'sameMonthLastYear'] as CompareMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCompareMode(mode)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                compareMode === mode
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {mode === 'prevMonth' ? 'Previous Month' : 'Same Month Last Year'}
            </button>
          ))}
          {compareLabel && (
            <span className="text-[11px] text-slate-400 whitespace-nowrap">({compareLabel})</span>
          )}
        </div>

        <div className="hidden sm:block w-px h-6 bg-slate-200 shrink-0" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">View:</span>
          {(['main', 'sub'] as CustomerView[]).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setCustomerView(view)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                customerView === view
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {view === 'main' ? 'Main Customer' : 'Sub Customer'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleExport}
          disabled={!data}
          className="flex items-center justify-center w-9 h-9 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg transition-colors shadow-sm"
          title="Export Excel"
        >
          <FileSpreadsheet className="w-4 h-4" />
        </button>
        <button
          onClick={() => void handleExportPdf()}
          disabled={!data || !compareBlock || exportingPdf}
          className="flex items-center justify-center w-9 h-9 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg transition-colors shadow-sm"
          title="Export PDF (ZIP)"
        >
          {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-full w-full bg-white">
        {toolbar}
        <SalesTabLoader />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-full w-full bg-white">
        {toolbar}
        <div className="p-12 text-center text-slate-500 font-medium">Failed to load reports. Try refreshing.</div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-white">
      {toolbar}

      <div className="w-full px-4 sm:px-6 py-5 space-y-5 pb-10">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {visibleKpiKeys.map((key) => {
            const kpi = activeKpis?.[key];
            if (!kpi) return null;
            const label = getKpiLabel(key, reportingMode);
            const color = KPI_COLORS[key] ?? 'navy';
            const { displayValue, sub: subText, subInline } = getKpiDisplay(key, kpi, activeKpis.totalSales);
            return (
              <KpiCard
                key={key}
                label={label}
                color={color}
                kpi={kpi}
                displayValue={displayValue}
                sub={subText}
                subInline={subInline}
                invertChangeColor={shouldInvertReturnKpiChange(key)}
                compareLabel={kpiCompareLabel}
              />
            );
          })}
        </div>

        {/* Monthly Chart */}
        <div className="bg-white border border-slate-200 rounded-[14px] p-5 shadow-sm">
          <div className="mb-4">
            <div className="text-sm font-bold text-slate-900">{chartTitle}</div>
            <div className="text-[11px] text-slate-500">Last 6 months comparison</div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data.monthlyComparison}
                margin={{ top: 32, right: 10, left: 0, bottom: 4 }}
                barGap={32}
                barCategoryGap="18%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 14, fontWeight: 700, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => v.toLocaleString('en-US')} />
                <Bar dataKey="actual" name={chartActualLabel} fill="#10B981" radius={[6, 6, 0, 0]} barSize={28}>
                  <LabelList
                    dataKey="actual"
                    position="top"
                    formatter={fmtBarLabel}
                    style={{ fontSize: 11, fontWeight: 800, fill: '#0F172A' }}
                    offset={6}
                  />
                </Bar>
                {showTargetInChart && (
                  <Bar dataKey="target" name="Target" fill="#0F172A" radius={[6, 6, 0, 0]} barSize={28}>
                    <LabelList
                      dataKey="target"
                      position="top"
                      formatter={fmtBarLabel}
                      style={{ fontSize: 11, fontWeight: 800, fill: '#0F172A' }}
                      offset={6}
                    />
                  </Bar>
                )}
                <Bar dataKey={chartCompareKey} name={chartCompareLabel} fill="#8B5CF6" radius={[6, 6, 0, 0]} barSize={28}>
                  <LabelList
                    dataKey={chartCompareKey}
                    position="top"
                    formatter={fmtBarLabel}
                    style={{ fontSize: 11, fontWeight: 800, fill: '#7C3AED' }}
                    offset={6}
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {data.dailySalesCalendars && data.dailySalesCalendars.length > 0 && (
          <ReportsDailyCalendar
            calendars={data.dailySalesCalendars}
            amountLabel={chartActualLabel}
          />
        )}

        {/* Report tables — tabbed */}
        <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm overflow-hidden">
          <div className="flex w-full gap-1 p-2 border-b border-slate-200 bg-slate-50/80">
            {tableTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTableTab(tab.id)}
                className={`flex-1 min-w-0 px-2 py-2 rounded-lg text-xs font-semibold text-center transition-colors ${
                  activeTableTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            <div className="mb-4">
              <div className="text-sm font-bold text-slate-900">{activeTableMeta.title}</div>
              {activeTableMeta.subtitle && (
                <div className="text-xs text-slate-500 mt-1">{activeTableMeta.subtitle}</div>
              )}
            </div>

            {activeTableTab === 'sales-invoices' && (
              <InvoiceRankTable rows={data.topSalesInvoices ?? []} />
            )}

            {activeTableTab === 'return-invoices' && (
              <InvoiceRankTable
                rows={data.topReturnInvoices ?? []}
                amountClassName="text-rose-700"
              />
            )}

            {activeTableTab === 'top-customers' && (
              compareBlock?.topCustomers?.length ? (
                <TopCustomersRankTable rows={compareBlock.topCustomers} variant="sales" />
              ) : <NoData title="NO CUSTOMER DATA" />
            )}

            {activeTableTab === 'top-return-customers' && (
              compareBlock?.topReturnCustomers?.length ? (
                <TopCustomersRankTable rows={compareBlock.topReturnCustomers} variant="returns" />
              ) : <NoData title="NO RETURN CUSTOMER DATA" />
            )}

            {activeTableTab === 'growing' && (
              compareBlock?.topGrowing?.length ? (
                <ReportsTable>
                  <ReportsTableHead headers={['#', 'Customer', 'Current', 'Compare', 'Change', 'Change %']} />
                  <tbody>
                    {compareBlock.topGrowing.map((r) => (
                      <tr key={r.name} className={MINI_TR}>
                        <td className={MINI_TD}><RankBadge rank={r.rank} /></td>
                        <td className={`${MINI_TD} font-medium text-slate-800`}>{r.name}</td>
                        <td className={`${MINI_TD} tabular-nums`}>{fmtNum(r.currentAmount)}</td>
                        <td className={`${MINI_TD} tabular-nums text-slate-400`}>{fmtNum(r.compareAmount)}</td>
                        <td className={`${MINI_TD} font-semibold tabular-nums text-emerald-600`}>+{fmtNum(r.changeAmount)}</td>
                        <td className={`${MINI_TD} font-semibold tabular-nums text-emerald-600`}>+{fmtPct(r.changePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </ReportsTable>
              ) : <NoData title="NO GROWTH DATA" />
            )}

            {activeTableTab === 'declining' && (
              compareBlock?.topDeclining?.length ? (
                <ReportsTable>
                  <ReportsTableHead headers={['#', 'Customer', 'Current', 'Compare', 'Change', 'Change %']} />
                  <tbody>
                    {compareBlock.topDeclining.map((r) => (
                      <tr key={r.name} className={MINI_TR}>
                        <td className={MINI_TD}><RankBadge rank={r.rank} /></td>
                        <td className={`${MINI_TD} font-medium text-slate-800`}>{r.name}</td>
                        <td className={`${MINI_TD} tabular-nums`}>{fmtNum(r.currentAmount)}</td>
                        <td className={`${MINI_TD} tabular-nums text-slate-400`}>{fmtNum(r.compareAmount)}</td>
                        <td className={`${MINI_TD} font-semibold tabular-nums text-rose-600`}>{fmtNum(r.changeAmount)}</td>
                        <td className={`${MINI_TD} font-semibold tabular-nums text-rose-600`}>{fmtPct(r.changePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </ReportsTable>
              ) : <NoData title="NO DECLINING DATA" />
            )}

            {activeTableTab === 'at-risk' && (
              compareBlock?.atRisk?.length ? (
                <ReportsTable>
                  <ReportsTableHead headers={['#', 'Customer', 'Last Active Amount', 'Current']} />
                  <tbody>
                    {compareBlock.atRisk.map((r) => (
                      <tr key={r.name} className={MINI_TR}>
                        <td className={MINI_TD}><RankBadge rank={r.rank} /></td>
                        <td className={`${MINI_TD} font-medium text-slate-800`}>
                          <span className="inline-flex items-center justify-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {r.name}
                          </span>
                        </td>
                        <td className={`${MINI_TD} tabular-nums text-amber-700 font-semibold`}>{fmtNum(r.compareAmount)}</td>
                        <td className={`${MINI_TD} tabular-nums text-rose-600 font-semibold`}>0</td>
                      </tr>
                    ))}
                  </tbody>
                </ReportsTable>
              ) : <NoData title="NO AT-RISK DATA" />
            )}

            {activeTableTab === 'products' && (
              data.topProducts?.length ? (
                <ReportsTable>
                  <ReportsTableHead headers={['#', 'Barcode', 'Product', 'QTY', 'Amount', 'Share']} />
                  <tbody>
                    {data.topProducts.map((r) => (
                      <tr key={`${r.barcode}-${r.rank}`} className={MINI_TR}>
                        <td className={MINI_TD}><RankBadge rank={r.rank} /></td>
                        <td className={`${MINI_TD} text-slate-400 font-mono text-xs`}>{r.barcode || '—'}</td>
                        <td className={`${MINI_TD} font-medium text-slate-800`}>{r.name}</td>
                        <td className={`${MINI_TD} tabular-nums text-slate-600`}>{fmtInt(r.qty)}</td>
                        <td className={`${MINI_TD} font-semibold tabular-nums text-emerald-700`}>{fmtNum(r.amount)}</td>
                        <td className={MINI_TD}>
                          <ShareBar pct={r.sharePct ?? 0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ReportsTable>
              ) : <NoData title="NO PRODUCT DATA" />
            )}

            {activeTableTab === 'categories' && (
              data.topCategories?.length ? (
                <ReportsTable>
                  <ReportsTableHead headers={['#', 'Category', 'QTY', 'Amount', 'Share']} />
                  <tbody>
                    {data.topCategories.map((r) => (
                      <tr key={r.category} className={MINI_TR}>
                        <td className={MINI_TD}><RankBadge rank={r.rank} /></td>
                        <td className={`${MINI_TD} font-medium text-slate-800`}>{r.category}</td>
                        <td className={`${MINI_TD} tabular-nums text-slate-600`}>{fmtInt(r.qty)}</td>
                        <td className={`${MINI_TD} font-semibold tabular-nums text-emerald-700`}>{fmtNum(r.amount)}</td>
                        <td className={MINI_TD}>
                          <ShareBar pct={r.sharePct ?? 0} color="purple" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ReportsTable>
              ) : <NoData title="NO CATEGORY DATA" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
