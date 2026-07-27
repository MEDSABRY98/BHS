export type ReportFilters = {
  category?: string;
  fromDate?: string;
  toDate?: string;
};

export function filterSuffix(filters: ReportFilters): string {
  const parts: string[] = [];
  if (filters.category) parts.push('Category');
  if (filters.fromDate || filters.toDate) parts.push('Dated');
  return parts.length ? `_${parts.join('_')}` : '_All';
}

export function validateReportFilters(filters: ReportFilters): string | null {
  if (!filters.fromDate || !filters.toDate) {
    return 'Please select both From and To dates.';
  }
  if (new Date(filters.fromDate) > new Date(filters.toDate)) {
    return 'From date must be before or equal to To date.';
  }
  return null;
}
