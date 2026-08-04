'use client';

import { createElement, type ReactElement } from 'react';
import { InvoiceRow } from '@/types';
import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';
import type { DebitInsightsMetrics, InsightsFilters } from '../Utils/InsightsTypes';
import { computeDebitInsightsMetrics } from '../Service/insights_service';
import {
  capturePage,
  createOffScreenContainer,
  formatGeneratedDate,
  waitForRender,
} from './PdfCaptureUtils';
import CoverPage from './Pages/CoverPage';
import KpiPage from './Pages/KpiPage';
import DebtTrendPage from './Pages/DebtTrendPage';
import AgingBreakdownPage from './Pages/AgingBreakdownPage';
import SalesCollectionsPage from './Pages/SalesCollectionsPage';
import CollectionRatePage from './Pages/CollectionRatePage';

const TOTAL_PAGES = 6;

function fileDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').trim() || 'Unknown';
}

async function buildMetricsWithSalesSource(
  rows: InvoiceRow[],
  filters: InsightsFilters,
  userId?: string
): Promise<DebitInsightsMetrics> {
  return computeDebitInsightsMetrics({ rows, filters, userId });
}

function buildPages(
  metrics: DebitInsightsMetrics,
  filters: InsightsFilters,
  generatedAt: string
): ReactElement[] {
  return [
    createElement(CoverPage, { key: 'cover', filters, generatedAt }),
    createElement(KpiPage, {
      key: 'kpi',
      metrics,
      filters,
      pageNumber: 2,
      totalPages: TOTAL_PAGES,
      generatedAt,
    }),
    createElement(DebtTrendPage, {
      key: 'debt-trend',
      data: metrics.trendSeries,
      filters,
      pageNumber: 3,
      totalPages: TOTAL_PAGES,
      generatedAt,
    }),
    createElement(AgingBreakdownPage, {
      key: 'aging',
      breakdown: metrics.agingBreakdown,
      filters,
      pageNumber: 4,
      totalPages: TOTAL_PAGES,
      generatedAt,
    }),
    createElement(SalesCollectionsPage, {
      key: 'sales-collections',
      data: metrics.trendSeries,
      filters,
      pageNumber: 5,
      totalPages: TOTAL_PAGES,
      generatedAt,
    }),
    createElement(CollectionRatePage, {
      key: 'collection-rate',
      data: metrics.trendSeries,
      filters,
      pageNumber: 6,
      totalPages: TOTAL_PAGES,
      generatedAt,
    }),
  ];
}

export async function generateDebitInsightsPdfBlob(
  metrics: DebitInsightsMetrics,
  filters: InsightsFilters,
  container?: HTMLDivElement
): Promise<Blob> {
  const jsPDF = (await import('jspdf')).default;
  const ReactDOM = await import('react-dom/client');

  const generatedAt = formatGeneratedDate();
  const ownsContainer = !container;
  const renderContainer = container ?? createOffScreenContainer();
  const images: string[] = [];
  const pages = buildPages(metrics, filters, generatedAt);

  try {
    for (const page of pages) {
      const root = ReactDOM.createRoot(renderContainer);
      root.render(page);
      await waitForRender();
      const imgData = await capturePage(renderContainer);
      images.push(imgData);
      root.unmount();
    }

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();

    images.forEach((imgData, index) => {
      if (index > 0) pdf.addPage();
      const imgProps = (pdf as any).getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    });

    return pdf.output('blob');
  } finally {
    if (ownsContainer && renderContainer.parentNode) {
      renderContainer.parentNode.removeChild(renderContainer);
    }
  }
}

export type DebitInsightsZipOptions = {
  rows: InvoiceRow[];
  filters: InsightsFilters;
  cities: string[];
  userId?: string;
  onProgress?: (current: number, total: number, label?: string) => void;
};

export async function exportDebitInsightsPdfZip(options: DebitInsightsZipOptions): Promise<void> {
  const { rows, filters, onProgress, userId } = options;
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const dateStamp = fileDateStamp(new Date());

  const cities =
    filters.salesRep.length > 0
      ? [...filters.salesRep].sort((a, b) => a.localeCompare(b))
      : [...options.cities].sort((a, b) => a.localeCompare(b));

  const total = 1 + cities.length;
  let current = 0;
  const tick = (label?: string) => {
    current += 1;
    onProgress?.(current, total, label);
  };

  const container = createOffScreenContainer();

  try {
    const allFilters: InsightsFilters = {
      ...filters,
      salesRep: filters.salesRep.length > 0 ? filters.salesRep : [],
    };
    const allMetrics = await buildMetricsWithSalesSource(rows, allFilters, userId);
    const allBlob = await generateDebitInsightsPdfBlob(allMetrics, allFilters, container);
    zip.file(`Debit_Insights_All_${dateStamp}.pdf`, allBlob);
    tick('All');

    for (const city of cities) {
      const cityFilters: InsightsFilters = {
        ...filters,
        salesRep: [city],
      };
      const cityMetrics = await buildMetricsWithSalesSource(rows, cityFilters, userId);
      const cityBlob = await generateDebitInsightsPdfBlob(cityMetrics, cityFilters, container);
      zip.file(`Debit_Insights_${sanitizeFileName(city)}_${dateStamp}.pdf`, cityBlob);
      tick(city);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveTrackedAs(zipBlob, `Debit_Insights_${dateStamp}.zip`);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/** @deprecated Prefer exportDebitInsightsPdfZip for multi-city ZIP export */
export async function exportDebitInsightsPdf(
  metrics: DebitInsightsMetrics,
  filters: InsightsFilters
): Promise<void> {
  const blob = await generateDebitInsightsPdfBlob(metrics, filters);
  saveTrackedAs(blob, `Debit_Insights_${fileDateStamp(new Date())}.pdf`);
}
