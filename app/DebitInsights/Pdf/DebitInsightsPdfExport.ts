'use client';

import { createElement, type ReactElement } from 'react';
import { InvoiceRow } from '@/types';
import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';
import { computeDebitInsightsMetrics, resolvePeriodRange, resolveEffectiveCustomers } from '../Utils/AsOfLedgerEngine';
import { applySalesNetOverlay } from '../Utils/SalesSourceOverlay';
import { toInputDate } from '../Utils/DateUtils';
import type {
  DebitInsightsMetrics,
  InsightsFilters,
  InsightsSalesOverlay,
} from '../Utils/InsightsTypes';
import { getInsightsSalesOverlayBatch } from '../Service/insights_sales_service';
import {
  capturePage,
  createOffScreenContainer,
  formatGeneratedDate,
  PDF_RENDER_WAIT_MS,
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

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildMetricsLocal(
  rows: InvoiceRow[],
  filters: InsightsFilters,
  salesOverlay?: InsightsSalesOverlay | null
): DebitInsightsMetrics {
  const metrics = computeDebitInsightsMetrics(rows, filters);
  if (filters.salesSource === 'sales' && salesOverlay) {
    return applySalesNetOverlay(metrics, salesOverlay);
  }
  return metrics;
}

function buildPages(
  metrics: DebitInsightsMetrics,
  filters: InsightsFilters,
  generatedAt: string
): ReactElement[] {
  const yoyChartData = metrics.currentYearTrend.map((cyPoint, index) => {
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
      data: yoyChartData,
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
      data: yoyChartData,
      filters,
      pageNumber: 5,
      totalPages: TOTAL_PAGES,
      generatedAt,
    }),
    createElement(CollectionRatePage, {
      key: 'collection-rate',
      data: yoyChartData,
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
      // Charts disable animation; shorter wait is enough and safer on live tabs
      await waitForRender(Math.min(PDF_RENDER_WAIT_MS, 900));
      const imgData = await capturePage(renderContainer);
      images.push(imgData);
      root.unmount();
      await yieldToBrowser();
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
  /** When set, only these scopes are exported. Cities should already be sorted. */
  selection?: {
    includeAll: boolean;
    cities: string[];
  };
  userId?: string;
  onProgress?: (current: number, total: number, label?: string) => void;
};

export async function exportDebitInsightsPdfZip(options: DebitInsightsZipOptions): Promise<void> {
  const { rows, filters, onProgress, userId, selection } = options;
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const dateStamp = fileDateStamp(new Date());

  const availableCities =
    filters.salesRep.length > 0
      ? [...filters.salesRep].sort((a, b) => a.localeCompare(b))
      : [...options.cities].sort((a, b) => a.localeCompare(b));

  const includeAll = selection ? selection.includeAll : true;
  const cities = selection
    ? [...selection.cities]
        .filter((city) => availableCities.includes(city))
        .sort((a, b) => a.localeCompare(b))
    : availableCities;

  if (!includeAll && cities.length === 0) {
    throw new Error('Select at least one PDF to export.');
  }

  const total = (includeAll ? 1 : 0) + cities.length;
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

    // Sales overlays: one lightweight server call (no debit rows over the wire).
    // Debit metrics stay fully client-side to avoid live payload/timeout failures.
    let allSalesOverlay: InsightsSalesOverlay | null = null;
    let salesByCity: Record<string, InsightsSalesOverlay> = {};

    if (filters.salesSource === 'sales') {
      const uid = String(userId || '').trim();
      if (!uid) {
        throw new Error('Unable to export Sales DB ZIP: user not found.');
      }
      const { from, to } = resolvePeriodRange(
        filters.asOfDate,
        filters.periodPreset,
        filters.periodFrom,
        filters.periodTo
      );
      const batch = await getInsightsSalesOverlayBatch({
        userId: uid,
        periodFrom: toInputDate(from),
        periodTo: toInputDate(to),
        cities,
        allCities: allFilters.salesRep,
        customers:
          filters.customers.length > 0 || (filters.customerTags?.length || 0) > 0
            ? resolveEffectiveCustomers(
                rows,
                filters.salesRep,
                filters.customers,
                filters.customerTags || []
              )
            : [],
      });
      allSalesOverlay = batch.all;
      salesByCity = batch.byCity;
    }

    if (includeAll) {
      const allMetrics = buildMetricsLocal(rows, allFilters, allSalesOverlay);
      const allBlob = await generateDebitInsightsPdfBlob(allMetrics, allFilters, container);
      zip.file(`Debit_Insights_All_${dateStamp}.pdf`, allBlob);
      tick('All');
      await yieldToBrowser();
    }

    for (const city of cities) {
      const cityFilters: InsightsFilters = {
        ...filters,
        salesRep: [city],
      };
      const cityMetrics = buildMetricsLocal(rows, cityFilters, salesByCity[city] ?? null);
      const cityBlob = await generateDebitInsightsPdfBlob(cityMetrics, cityFilters, container);
      zip.file(`Debit_Insights_${sanitizeFileName(city)}_${dateStamp}.pdf`, cityBlob);
      tick(city);
      await yieldToBrowser();
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
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
