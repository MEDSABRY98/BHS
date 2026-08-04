'use client';

import SalesCollectionsChart from '../../Charts/SalesCollectionsChart';
import type { InsightsFilters, InsightsTrendPoint } from '../../Utils/InsightsTypes';
import { formatGeneratedDate, formatPeriodLabel } from '../PdfCaptureUtils';
import PdfPageShell from '../PdfPageShell';

interface SalesCollectionsPageProps {
  data: InsightsTrendPoint[];
  filters: InsightsFilters;
  pageNumber?: number;
  totalPages?: number;
  generatedAt?: string;
}

export default function SalesCollectionsPage({
  data,
  filters,
  pageNumber = 5,
  totalPages = 6,
  generatedAt,
}: SalesCollectionsPageProps) {
  return (
    <PdfPageShell
      title="Net Sales vs Collections"
      subtitle={`${formatPeriodLabel(filters)}  ·  As of ${filters.asOfDate}`}
      pageNumber={pageNumber}
      totalPages={totalPages}
      generatedAt={generatedAt ?? formatGeneratedDate()}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <SalesCollectionsChart data={data} forPdf />
      </div>
    </PdfPageShell>
  );
}
