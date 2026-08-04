'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { InvoiceRow } from '@/types';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { useDebitInsightsMetrics } from './Hooks/UseDebitInsightsMetrics';
import { collectCustomers } from './Utils/AsOfLedgerEngine';
import { InsightsFilters, InsightsSalesOverlay } from './Utils/InsightsTypes';
import { toInputDate } from './Utils/DateUtils';
import { applySalesNetOverlay } from './Utils/SalesSourceOverlay';
import InsightsFiltersBar from './Module/InsightsFiltersBar';
import InsightsKpiCards from './Cards/InsightsKpiCards';
import DebtTrendChart from './Charts/DebtTrendChart';
import SalesCollectionsChart from './Charts/SalesCollectionsChart';
import CollectionRateChart from './Charts/CollectionRateChart';
import AgingBreakdownChart from './Charts/AgingBreakdownChart';
import { exportDebitInsightsPdfZip } from './Export/PdfExport';
import { fetchSalesOverlayForFilters } from './Service/insights_service';

interface DebitInsightsDashboardProps {
  data: InvoiceRow[];
  loading: boolean;
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
    salesSource: 'debit',
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
}: DebitInsightsDashboardProps) {
  const [draftFilters, setDraftFilters] = useState<InsightsFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<InsightsFilters>(defaultFilters);
  const [isApplying, startTransition] = useTransition();
  const [exportingPdf, setExportingPdf] = useState(false);
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
  const hasPendingChanges = !filtersEqual(draftFilters, appliedFilters);

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
    void fetchSalesOverlayForFilters(appliedFilters, userId)
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
  }, [appliedFilters]);

  const handleFilterChange = (next: InsightsFilters) => {
    if (!arraysEqual(next.salesRep, draftFilters.salesRep)) {
      const allowed = new Set(collectCustomers(data, next.salesRep));
      next = {
        ...next,
        customers: next.customers.filter((customer) => allowed.has(customer)),
      };
    }
    setDraftFilters(next);
  };

  const handleExportPdf = async () => {
    if (exportingPdf || data.length === 0 || salesLoading) return;
    setExportingPdf(true);
    const loadingId = toast.loading('Generating ZIP...');
    try {
      await exportDebitInsightsPdfZip({
        rows: data,
        filters: appliedFilters,
        cities: salesReps,
        userId: readUserId(),
        onProgress: (current, total, label) => {
          toast.loading(`Generating PDF ${current}/${total}${label ? ` — ${label}` : ''}...`, {
            id: loadingId,
          });
        },
      });
      toast.dismiss(loadingId);
      toast.success('ZIP exported successfully.');
    } catch (error) {
      console.error('Debit Insights PDF export failed:', error);
      toast.dismiss(loadingId);
      toast.error('Failed to export ZIP.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading && data.length === 0) {
    return <TabLoader />;
  }

  if (!loading && data.length === 0) {
    return <NoData />;
  }

  const busy = isApplying || salesLoading;

  return (
    <div className="space-y-4">
      <InsightsFiltersBar
        filters={draftFilters}
        salesReps={salesReps}
        customers={availableCustomers}
        onChange={handleFilterChange}
        onApply={() => {
          startTransition(() => {
            setAppliedFilters(draftFilters);
            toast.success('Filters applied.');
          });
        }}
        onExportPdf={() => void handleExportPdf()}
        hasPendingChanges={hasPendingChanges}
        isApplying={busy}
        isExportingPdf={exportingPdf}
        canExportPdf={!loading && !salesLoading && data.length > 0}
      />

      {salesLoading && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
          Loading Sales DB metrics...
        </div>
      )}

      <InsightsKpiCards metrics={metrics} />

      <DebtTrendChart data={metrics.trendSeries} />
      <AgingBreakdownChart breakdown={metrics.agingBreakdown} />
      <SalesCollectionsChart data={metrics.trendSeries} />
      <CollectionRateChart data={metrics.trendSeries} />
    </div>
  );
}
