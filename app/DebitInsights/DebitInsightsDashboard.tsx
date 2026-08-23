'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { InvoiceRow } from '@/types';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { useDebitInsightsMetrics } from './Hooks/UseDebitInsightsMetrics';
import { collectCustomers, collectCustomerTags, resolveEffectiveCustomers, resolvePeriodRange } from './Utils/AsOfLedgerEngine';
import { InsightsFilters, InsightsSalesOverlay } from './Utils/InsightsTypes';
import { toInputDate } from './Utils/DateUtils';
import { applySalesNetOverlay } from './Utils/SalesSourceOverlay';
import InsightsFiltersPanel from './Model/InsightsFiltersPanel';
import InsightsExportScopeModal, {
  type InsightsExportSelection,
} from './Model/InsightsExportScopeModal';
import InsightsKpiCards from './Cards/InsightsKpiCards';
import DebtTrendChart from './Charts/DebtTrendChart';
import SalesTrendChart from './Charts/SalesTrendChart';
import CollectionsTrendChart from './Charts/CollectionsTrendChart';
import CollectionRateChart from './Charts/CollectionRateChart';
import AgingBreakdownChart from './Charts/AgingBreakdownChart';
import { exportDebitInsightsPdfZip } from './Export/PdfExport';
import { getInsightsSalesOverlay } from './Service/insights_sales_service';

export type DebitInsightsChromeState = {
  filtersActive: boolean;
  filtersPending: boolean;
  exportingPdf: boolean;
  canExportPdf: boolean;
  onExportPdf: () => void;
};

interface DebitInsightsDashboardProps {
  data: InvoiceRow[];
  loading: boolean;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  onChromeChange?: (state: DebitInsightsChromeState) => void;
}

function defaultFilters(): InsightsFilters {
  const today = toInputDate(new Date());
  const yearStart = toInputDate(new Date(new Date().getFullYear(), 0, 1));
  return {
    asOfDate: today,
    periodPreset: 'trailing12m',
    periodFrom: yearStart,
    periodTo: today,
    salesRep: [],
    customers: [],
    customerTags: [],
    salesSource: 'sales',
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function filtersEqual(a: InsightsFilters, b: InsightsFilters): boolean {
  return (
    a.asOfDate === b.asOfDate &&
    a.periodPreset === b.periodPreset &&
    a.periodFrom === b.periodFrom &&
    a.periodTo === b.periodTo &&
    arraysEqual(a.salesRep, b.salesRep) &&
    arraysEqual(a.customers, b.customers) &&
    arraysEqual(a.customerTags || [], b.customerTags || []) &&
    a.salesSource === b.salesSource
  );
}

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

export default function DebitInsightsDashboard({
  data,
  loading,
  filtersOpen,
  onFiltersOpenChange,
  onChromeChange,
}: DebitInsightsDashboardProps) {
  const [draftFilters, setDraftFilters] = useState<InsightsFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<InsightsFilters>(defaultFilters);
  const [isApplying, startTransition] = useTransition();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportScopeOpen, setExportScopeOpen] = useState(false);
  const [salesOverlay, setSalesOverlay] = useState<InsightsSalesOverlay | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const debitMetrics = useDebitInsightsMetrics(data, appliedFilters);

  const metrics = useMemo(() => {
    if (appliedFilters.salesSource !== 'sales' || !salesOverlay) return debitMetrics;
    return applySalesNetOverlay(debitMetrics, salesOverlay);
  }, [appliedFilters.salesSource, debitMetrics, salesOverlay]);

  const salesReps = useMemo(() => debitMetrics.salesReps, [debitMetrics.salesReps]);
  const availableCustomers = useMemo(
    () => collectCustomers(data, draftFilters.salesRep),
    [data, draftFilters.salesRep]
  );
  const availableCustomerTags = useMemo(
    () => collectCustomerTags(data, draftFilters.salesRep),
    [data, draftFilters.salesRep]
  );
  const hasPendingChanges = !filtersEqual(draftFilters, appliedFilters);
  const filtersActive =
    appliedFilters.salesRep.length > 0 ||
    appliedFilters.customers.length > 0 ||
    (appliedFilters.customerTags?.length || 0) > 0 ||
    appliedFilters.salesSource !== 'debit' ||
    appliedFilters.periodPreset !== 'trailing12m';

  useEffect(() => {
    if (appliedFilters.salesSource !== 'sales') {
      setSalesOverlay(null);
      setSalesLoading(false);
      return;
    }

    let cancelled = false;
    const userId = readUserId();
    if (!userId) {
      setSalesOverlay(null);
      toast.error('Unable to load Sales DB: user not found.');
      return;
    }

    setSalesLoading(true);

    const { from, to } = resolvePeriodRange(
      appliedFilters.asOfDate,
      appliedFilters.periodPreset,
      appliedFilters.periodFrom,
      appliedFilters.periodTo
    );

    const customers =
      appliedFilters.customers.length > 0 || (appliedFilters.customerTags?.length || 0) > 0
        ? resolveEffectiveCustomers(
            data,
            appliedFilters.salesRep,
            appliedFilters.customers,
            appliedFilters.customerTags || []
          )
        : [];

    void getInsightsSalesOverlay({
      userId,
      periodFrom: toInputDate(from),
      periodTo: toInputDate(to),
      cities: appliedFilters.salesRep,
      customers,
    })
      .then((overlay) => {
        if (!cancelled) setSalesOverlay(overlay);
      })
      .catch((error) => {
        console.error('Sales overlay fetch failed:', error);
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
  }, [appliedFilters, data]);

  const handleFilterChange = (next: InsightsFilters) => {
    if (!arraysEqual(next.salesRep, draftFilters.salesRep)) {
      const allowedCustomers = new Set(collectCustomers(data, next.salesRep));
      const allowedTags = new Set(collectCustomerTags(data, next.salesRep));
      next = {
        ...next,
        customers: next.customers.filter((customer) => allowedCustomers.has(customer)),
        customerTags: (next.customerTags || []).filter((tag) => allowedTags.has(tag)),
      };
    }
    setDraftFilters(next);
  };

  const availableExportCities = useMemo(() => {
    const list =
      appliedFilters.salesRep.length > 0 ? appliedFilters.salesRep : salesReps;
    return [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [appliedFilters.salesRep, salesReps]);

  const handleExportPdf = async (selection: InsightsExportSelection) => {
    if (exportingPdf || data.length === 0 || salesLoading) return;
    if (!selection.includeAll && selection.cities.length === 0) {
      toast.error('Select at least one PDF to export.');
      return;
    }

    setExportingPdf(true);
    const loadingId = toast.loading('Generating ZIP...');
    try {
      await exportDebitInsightsPdfZip({
        rows: data,
        filters: appliedFilters,
        cities: salesReps,
        selection,
        userId: readUserId(),
        onProgress: (current, total, label) => {
          toast.loading(`Generating PDF ${current}/${total}${label ? ` — ${label}` : ''}...`, {
            id: loadingId,
          });
        },
      });
      toast.dismiss(loadingId);
      toast.success('ZIP exported successfully.');
      setExportScopeOpen(false);
    } catch (error) {
      console.error('Debit Insights PDF export failed:', error);
      toast.dismiss(loadingId);
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to export ZIP.';
      toast.error(message);
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    onChromeChange?.({
      filtersActive,
      filtersPending: hasPendingChanges,
      exportingPdf,
      canExportPdf: !loading && !salesLoading && data.length > 0,
      onExportPdf: () => setExportScopeOpen(true),
    });
  }, [
    filtersActive,
    hasPendingChanges,
    exportingPdf,
    loading,
    salesLoading,
    data.length,
    onChromeChange,
  ]);

  const yoyChartData = useMemo(() => {
    return metrics.currentYearTrend.map((cyPoint, index) => {
      const pyPoint = metrics.previousYearTrend[index];
      const cyCollectionRate = cyPoint.netSales > 0.01 ? (cyPoint.collections / cyPoint.netSales) * 100 : null;
      const pyCollectionRate = pyPoint && pyPoint.netSales > 0.01 ? (pyPoint.collections / pyPoint.netSales) * 100 : null;
      return {
        monthName: cyPoint.monthLabel.split(' ')[0] || cyPoint.monthLabel,
        monthIndex: index,
        cyOpenDebt: cyPoint.openDebt,
        pyOpenDebt: pyPoint?.openDebt || 0,
        cyNetSales: cyPoint.netSales,
        pyNetSales: pyPoint?.netSales || 0,
        cyCollections: cyPoint.collections,
        pyCollections: pyPoint?.collections || 0,
        cyCollectionRate,
        pyCollectionRate,
      };
    });
  }, [metrics.currentYearTrend, metrics.previousYearTrend]);

  if (loading && data.length === 0) {
    return <TabLoader />;
  }

  if (!loading && data.length === 0) {
    return <NoData />;
  }

  const busy = isApplying || salesLoading;


  return (
    <div className="space-y-4">
      <InsightsFiltersPanel
        open={filtersOpen}
        onClose={() => onFiltersOpenChange(false)}
        filters={draftFilters}
        salesReps={salesReps}
        customers={availableCustomers}
        customerTags={availableCustomerTags}
        onChange={handleFilterChange}
        onApply={() => {
          startTransition(() => {
            setAppliedFilters(draftFilters);
            toast.success('Filters applied.');
          });
        }}
        hasPendingChanges={hasPendingChanges}
        isApplying={busy}
      />

      <InsightsExportScopeModal
        open={exportScopeOpen}
        onClose={() => {
          if (!exportingPdf) setExportScopeOpen(false);
        }}
        cities={availableExportCities}
        isExporting={exportingPdf}
        onConfirm={(selection) => void handleExportPdf(selection)}
      />

      {salesLoading ? (
        <div className="py-20">
          <TabLoader />
        </div>
      ) : (
        <>
          <InsightsKpiCards metrics={metrics} />

          <DebtTrendChart data={yoyChartData} />
          <AgingBreakdownChart breakdown={metrics.agingBreakdown} />
          <SalesTrendChart data={yoyChartData} />
          <CollectionsTrendChart data={yoyChartData} />
          <CollectionRateChart data={yoyChartData} />
        </>
      )}
    </div>
  );
}
