'use client';

import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';

export const SALES_TAB_LABELS: Record<string, string> = {
  'sales-overview': 'Overview',
  'sales-top10': 'Top 10',
  'sales-customers': 'Customers',
  'sales-customers-comparison': 'Comparison',
  'sales-inactive-customers': 'Inactive Customers',
  'sales-statistics': 'Statistics',
  'sales-reports': 'Reports',
  'sales-targets': 'Targets',
  'sales-daily-sales': 'Daily Sales',
  'sales-categories': 'Product Category',
  'sales-products': 'Products',
  'sales-new-listings': 'New Listings',
  'sales-download-form': 'Stock Report',
  'sales-my-customers': 'Set Customers',
};

export const SALES_STOCK_REPORT_TAB_LABELS: Record<string, string> = {
  customers: 'By Customers',
  products: 'By Product',
  margin: 'Customer Margin',
};

export const SALES_DAILY_SALES_TAB_LABELS: Record<string, string> = {
  'all-invoices': 'All Invoices',
  'sales-by-day': 'Sales By Day',
  'avg-sales-by-day': 'Avg Sales By Day',
};

export const SALES_CUSTOMER_DETAILS_TAB_LABELS: Record<string, string> = {
  summary: 'Summary',
  dashboard: 'Dashboard',
  subcustomers: 'Sub Customers',
  monthly: 'Monthly',
  categories: 'Categories',
  products: 'Products',
  invoices: 'Invoices',
};

export function trackSalesTab(tabId: string) {
  TrackModuleSubTab(SALES_TAB_LABELS[tabId] ?? tabId);
}

export function trackSalesNestedTab(
  parentTabId: string,
  nestedTabId: string,
  nestedLabels: Record<string, string>,
) {
  const parent = SALES_TAB_LABELS[parentTabId] ?? parentTabId;
  const nested = nestedLabels[nestedTabId] ?? nestedTabId;
  TrackModuleSubTab(`${parent} · ${nested}`);
}

export function trackSalesCustomerDetailsTab(parentTabId: string, tabId: string) {
  trackSalesNestedTab(parentTabId, tabId, SALES_CUSTOMER_DETAILS_TAB_LABELS);
}
