'use client';

import CollectionRateChart from '../../Charts/CollectionRateChart';
import type { InsightsFilters, InsightsTrendPoint } from '../../Utils/InsightsTypes';
import { formatGeneratedDate, formatPeriodLabel } from '../PdfCaptureUtils';
import PdfPageShell from '../PdfPageShell';

interface CollectionRatePageProps {
  data: InsightsTrendPoint[];
  filters: InsightsFilters;
  pageNumber?: number;
  totalPages?: number;
  generatedAt?: string;
}

export default function CollectionRatePage({
  data,
  filters,
  pageNumber = 6,
  totalPages = 6,
  generatedAt,
}: CollectionRatePageProps) {
  return (
    <PdfPageShell
      title="Collections Amount & Rate (Monthly)"
      subtitle={`${formatPeriodLabel(filters)}  ·  As of ${filters.asOfDate}`}
      pageNumber={pageNumber}
      totalPages={totalPages}
      generatedAt={generatedAt ?? formatGeneratedDate()}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <CollectionRateChart data={data} forPdf />
      </div>
    </PdfPageShell>
  );
}
