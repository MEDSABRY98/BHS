'use client';

import AgingBreakdownChart from '../../Charts/AgingBreakdownChart';
import type { AgingBreakdown, InsightsFilters } from '../../Utils/InsightsTypes';
import { formatGeneratedDate, formatPeriodLabel } from '../PdfCaptureUtils';
import PdfPageShell from '../PdfPageShell';

interface AgingBreakdownPageProps {
  breakdown: AgingBreakdown;
  filters: InsightsFilters;
  pageNumber?: number;
  totalPages?: number;
  generatedAt?: string;
}

export default function AgingBreakdownPage({
  breakdown,
  filters,
  pageNumber = 4,
  totalPages = 6,
  generatedAt,
}: AgingBreakdownPageProps) {
  return (
    <PdfPageShell
      title="Aging Breakdown"
      subtitle={`${formatPeriodLabel(filters)}  ·  As of ${filters.asOfDate}`}
      pageNumber={pageNumber}
      totalPages={totalPages}
      generatedAt={generatedAt ?? formatGeneratedDate()}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <AgingBreakdownChart breakdown={breakdown} forPdf />
      </div>
    </PdfPageShell>
  );
}
