'use client';

import DebtTrendChart from '../../Charts/DebtTrendChart';
import type { InsightsFilters, YoYTrendPoint } from '../../Utils/InsightsTypes';
import { formatGeneratedDate, formatPeriodLabel } from '../PdfCaptureUtils';
import PdfPageShell from '../PdfPageShell';

interface DebtTrendPageProps {
  data: YoYTrendPoint[];
  filters: InsightsFilters;
  pageNumber?: number;
  totalPages?: number;
  generatedAt?: string;
}

export default function DebtTrendPage({
  data,
  filters,
  pageNumber = 3,
  totalPages = 6,
  generatedAt,
}: DebtTrendPageProps) {
  return (
    <PdfPageShell
      title="Debt Trend (Monthly)"
      subtitle={`${formatPeriodLabel(filters)}  ·  As of ${filters.asOfDate}`}
      pageNumber={pageNumber}
      totalPages={totalPages}
      generatedAt={generatedAt ?? formatGeneratedDate()}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <DebtTrendChart data={data} forPdf />
      </div>
    </PdfPageShell>
  );
}
