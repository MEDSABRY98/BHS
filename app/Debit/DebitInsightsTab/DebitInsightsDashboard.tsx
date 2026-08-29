'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { InvoiceRow } from '@/types';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { useDebitInsightsMetrics } from './Hooks/UseDebitInsightsMetrics';
import { collectCustomers, collectCustomerTags, collectCustomerClassifications, resolveEffectiveCustomers, resolvePeriodRange } from './Utils/AsOfLedgerEngine';
import { InsightsFilters, InsightsSalesOverlay } from './Utils/InsightsTypes';
import { toInputDate } from './Utils/DateUtils';
import { applySalesNetOverlay } from './Utils/SalesSourceOverlay';
import InsightsFiltersPanel from './Model/InsightsFiltersPanel';
import InsightsKpiCards from './Cards/InsightsKpiCards';
import DebtTrendChart from './Charts/DebtTrendChart';
import SalesTrendChart from './Charts/SalesTrendChart';
import CollectionsTrendChart from './Charts/CollectionsTrendChart';
import CollectionRateChart from './Charts/CollectionRateChart';
import AgingBreakdownChart from './Charts/AgingBreakdownChart';
import { getInsightsSalesOverlay } from './Service/insights_sales_service';

export type DebitInsightsChromeState = {
  filtersActive: boolean;
  filtersPending: boolean;
};

interface DebitInsightsDashboardProps {
  data: InvoiceRow[];
  loading?: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
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
    customerClassifications: [],
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
    arraysEqual(a.customerClassifications || [], b.customerClassifications || []) &&
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
  onLoadingChange,
}: DebitInsightsDashboardProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<InsightsFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<InsightsFilters>(defaultFilters);
  const [isApplying, startTransition] = useTransition();
  const [salesOverlay, setSalesOverlay] = useState<InsightsSalesOverlay | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const debitMetrics = useDebitInsightsMetrics(data, appliedFilters);

  const metrics = useMemo(() => {
    if (appliedFilters.salesSource !== 'sales' || !salesOverlay) return debitMetrics;
    return applySalesNetOverlay(debitMetrics, salesOverlay);
  }, [appliedFilters.salesSource, debitMetrics, salesOverlay]);

  const salesReps = useMemo(() => debitMetrics.salesReps, [debitMetrics.salesReps]);
  const availableCustomers = useMemo(
    () => collectCustomers(data, (draftFilters.salesRep || [])),
    [data, draftFilters.salesRep]
  );
  const availableCustomerTags = useMemo(
    () => collectCustomerTags(data, draftFilters.salesRep),
    [data, draftFilters.salesRep]
  );
  const availableCustomerClassifications = useMemo(
    () => collectCustomerClassifications(data, draftFilters.salesRep),
    [data, draftFilters.salesRep]
  );

  const hasPendingChanges = !filtersEqual(draftFilters, appliedFilters);
  const filtersActive =
    appliedFilters.salesRep.length > 0 ||
    appliedFilters.customers.length > 0 ||
    (appliedFilters.customerTags?.length || 0) > 0 ||
    (appliedFilters.customerClassifications?.length || 0) > 0 ||
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
    onLoadingChange?.(true);

    const { from, to } = resolvePeriodRange(
      appliedFilters.asOfDate,
      appliedFilters.periodPreset,
      appliedFilters.periodFrom,
      appliedFilters.periodTo
    );

    const customers =
      appliedFilters.customers.length > 0 || (appliedFilters.customerTags?.length || 0) > 0 || (appliedFilters.customerClassifications?.length || 0) > 0
        ? resolveEffectiveCustomers(
            data,
            appliedFilters.salesRep,
            appliedFilters.customers,
            appliedFilters.customerTags || [],
            appliedFilters.customerClassifications || []
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
        if (!cancelled) {
          setSalesLoading(false);
          onLoadingChange?.(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, data]);

  const handleFilterChange = (next: InsightsFilters) => {
    if (!arraysEqual(next.salesRep, draftFilters.salesRep)) {
      const allowedCustomers = new Set(collectCustomers(data, next.salesRep));
      const allowedTags = new Set(collectCustomerTags(data, next.salesRep));
      const allowedClasses = new Set(collectCustomerClassifications(data, next.salesRep));
      next = {
        ...next,
        customers: next.customers.filter((customer) => allowedCustomers.has(customer)),
        customerTags: (next.customerTags || []).filter((tag) => allowedTags.has(tag)),
        customerClassifications: (next.customerClassifications || []).filter((c) => allowedClasses.has(c)),
      };
    }
    setDraftFilters(next);
  };

  const handleClearFilters = () => {
    startTransition(() => {
      const defaults = defaultFilters();
      setDraftFilters(defaults);
      setAppliedFilters(defaults);
      toast.success('Filters cleared.');
    });
  };

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

  if (!isMounted) {
    return <TabLoader />;
  }

  if (loading && data.length === 0) {
    return <TabLoader />;
  }

  if (!loading && data.length === 0) {
    return <NoData />;
  }

  const busy = isApplying || salesLoading;


  return (
    <div className="space-y-4 max-w-[1700px] mx-auto w-full">
      <InsightsFiltersPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={draftFilters}
        salesReps={salesReps}
        customers={availableCustomers}
        customerTags={availableCustomerTags}
        customerClassifications={availableCustomerClassifications}
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

      {busy && salesOverlay === null ? (
        <div className="absolute inset-0 z-[60] bg-[#F8F9FA] flex flex-col justify-center items-center rounded-2xl">
          <TabLoader className="!min-h-full flex-1" />
        </div>
      ) : (
        <>
          <InsightsKpiCards 
            metrics={metrics}
            onOpenFilters={() => setFiltersOpen(true)}
            onClearFilters={handleClearFilters}
            hasPendingChanges={hasPendingChanges}
            filtersActive={filtersActive}
          />

          <DebtTrendChart data={yoyChartData} />
          <AgingBreakdownChart breakdown={metrics.agingBreakdown} totalDebt={metrics.totalOpenDebt} />
          <SalesTrendChart data={yoyChartData} />
          <CollectionsTrendChart data={yoyChartData} />
          <CollectionRateChart data={yoyChartData} />
        </>
      )}
    </div>
  );
}
