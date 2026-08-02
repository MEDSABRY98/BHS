'use client';

import { useMemo, useState, useTransition } from 'react';
import { InvoiceRow } from '@/types';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { useDebitInsightsMetrics } from './Hooks/UseDebitInsightsMetrics';
import { collectCustomers } from './Utils/AsOfLedgerEngine';
import { InsightsFilters } from './Utils/InsightsTypes';
import { toInputDate } from './Utils/DateUtils';
import InsightsFiltersBar from './Module/InsightsFiltersBar';
import InsightsKpiCards from './Cards/InsightsKpiCards';
import DebtTrendChart from './Charts/DebtTrendChart';
import SalesCollectionsChart from './Charts/SalesCollectionsChart';
import CollectionRateChart from './Charts/CollectionRateChart';
import AgingBreakdownChart from './Charts/AgingBreakdownChart';

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
    arraysEqual(a.customers, b.customers)
  );
}

export default function DebitInsightsDashboard({
  data,
  loading,
}: DebitInsightsDashboardProps) {
  const [draftFilters, setDraftFilters] = useState<InsightsFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<InsightsFilters>(defaultFilters);
  const [isApplying, startTransition] = useTransition();
  const metrics = useDebitInsightsMetrics(data, appliedFilters);

  const salesReps = useMemo(() => metrics.salesReps, [metrics.salesReps]);
  const availableCustomers = useMemo(
    () => collectCustomers(data, draftFilters.salesRep),
    [data, draftFilters.salesRep]
  );
  const hasPendingChanges = !filtersEqual(draftFilters, appliedFilters);

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

  if (loading && data.length === 0) {
    return <TabLoader />;
  }

  if (!loading && data.length === 0) {
    return <NoData />;
  }

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
        hasPendingChanges={hasPendingChanges}
        isApplying={isApplying}
      />

      <InsightsKpiCards metrics={metrics} />

      <DebtTrendChart data={metrics.trendSeries} />
      <AgingBreakdownChart breakdown={metrics.agingBreakdown} />
      <SalesCollectionsChart data={metrics.trendSeries} />
      <CollectionRateChart data={metrics.trendSeries} />
    </div>
  );
}
