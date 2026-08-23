'use client';

import SalesTrendChart from '../../Charts/SalesTrendChart';
import CollectionsTrendChart from '../../Charts/CollectionsTrendChart';
import type { InsightsFilters, YoYTrendPoint } from '../../Utils/InsightsTypes';
import { formatGeneratedDate, formatPeriodLabel } from '../PdfCaptureUtils';
import PdfPageShell from '../PdfPageShell';

interface SalesCollectionsPageProps {
  data: YoYTrendPoint[];
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
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <SalesTrendChart 
            data={data} 
            title={`Net Sales Trend`} 
            forPdf 
          />
        </div>
        <div style={{ flex: 1 }}>
          <CollectionsTrendChart 
            data={data} 
            title={`Collections Trend`} 
            forPdf 
          />
        </div>
      </div>
    </PdfPageShell>
  );
}
