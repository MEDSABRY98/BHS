import { generateSalesReports } from '@/app/Sales/Pdf/SalesReports';
import type {
  CompareMode,
  CustomerView,
  ReportsPayload,
  SalesReportsInput,
} from '@/app/Sales/Pdf/SalesReportsTypes';
import type { SalesCommonFilters } from '@/app/Sales/Model/SalesFilters';

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').trim() || 'Unknown';
}

async function fetchReportsPayload(
  userId: string,
  filters: SalesCommonFilters
): Promise<ReportsPayload> {
  const res = await fetch('/api/Sales/Reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, filters }),
  });
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}

async function fetchMappingPeople(
  userId: string
): Promise<{ salesReps: string[]; merchandisers: string[] }> {
  const res = await fetch('/api/Sales/Metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) return { salesReps: [], merchandisers: [] };
  const json = await res.json();
  return {
    salesReps: json.uniqueValues?.salesReps ?? [],
    merchandisers: json.uniqueValues?.merchandisers ?? [],
  };
}

function buildPdfInput(
  payload: ReportsPayload,
  options: {
    compareMode: CompareMode;
    customerView: CustomerView;
    filters: SalesCommonFilters;
    dateFrom?: string;
    dateTo?: string;
  }
): SalesReportsInput {
  const compareBlock = payload.customerViews[options.customerView][options.compareMode];
  const compareLabel = payload.compareModes[options.compareMode]?.label ?? '';
  return {
    data: payload,
    compareBlock,
    compareMode: options.compareMode,
    compareLabel,
    customerView: options.customerView,
    filters: options.filters,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
  };
}

export type SalesReportsZipOptions = {
  userId: string;
  data: ReportsPayload;
  filters: SalesCommonFilters;
  compareMode: CompareMode;
  customerView: CustomerView;
  dateFrom?: string;
  dateTo?: string;
  onProgress?: (current: number, total: number, label?: string) => void;
};

export async function generateSalesReportsZip(options: SalesReportsZipOptions): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const periodSlug = options.data.periodLabel.replace(/\s+/g, '_');

  const { salesReps, merchandisers } = await fetchMappingPeople(options.userId);
  const total = 1 + salesReps.length + merchandisers.length;
  let current = 0;

  const tick = (label?: string) => {
    current += 1;
    options.onProgress?.(current, total, label);
  };

  const overviewFilters: SalesCommonFilters = {
    ...options.filters,
    salesRep: '',
    merchandiser: '',
  };

  const overviewPayload =
    !options.filters.salesRep && !options.filters.merchandiser
      ? options.data
      : await fetchReportsPayload(options.userId, overviewFilters);

  const overviewBlob = await generateSalesReports(
    buildPdfInput(overviewPayload, { ...options, filters: overviewFilters })
  );
  zip.file(`Sales_Reports_All_${periodSlug}.pdf`, overviewBlob);
  tick('All');

  for (const rep of salesReps) {
    const repFilters: SalesCommonFilters = { ...options.filters, salesRep: rep, merchandiser: '' };
    const repPayload = await fetchReportsPayload(options.userId, repFilters);
    const blob = await generateSalesReports(
      buildPdfInput(repPayload, { ...options, filters: repFilters })
    );
    zip.file(`Sales_Rep_${sanitizeFileName(rep)}_${periodSlug}.pdf`, blob);
    tick(rep);
  }

  for (const merch of merchandisers) {
    const merchFilters: SalesCommonFilters = { ...options.filters, merchandiser: merch, salesRep: '' };
    const merchPayload = await fetchReportsPayload(options.userId, merchFilters);
    const blob = await generateSalesReports(
      buildPdfInput(merchPayload, { ...options, filters: merchFilters })
    );
    zip.file(`Merchandiser_${sanitizeFileName(merch)}_${periodSlug}.pdf`, blob);
    tick(merch);
  }

  return zip.generateAsync({ type: 'blob' });
}
