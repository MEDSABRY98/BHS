'use client';

import { useEffect } from 'react';
import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';

export type InvoicesTrackingReportTabId = 'pending' | 'pending-customer' | 'delivered' | 'handover';

export const INVOICES_TRACKING_ROUTE_LABELS: Record<string, string> = {
  '/InvoicesTracking': 'Dashboard',
  '/InvoicesTracking/Orders': 'Orders',
  '/InvoicesTracking/CreateOrders': 'Create Orders',
  '/InvoicesTracking/Reports': 'Reports',
  '/InvoicesTracking/InvoiceCancel': 'Invoice Cancel',
  '/InvoicesTracking/OrderDetails': 'Order Details',
};

export const INVOICES_TRACKING_REPORT_TAB_LABELS: Record<InvoicesTrackingReportTabId, string> = {
  pending: 'Pending Driver Invoices',
  'pending-customer': 'Pending Customer Invoices',
  delivered: 'Delivered Driver Invoices',
  handover: 'Daily Handover',
};

export const INVOICES_TRACKING_ORDER_DETAILS_TAB_LABELS: Record<string, string> = {
  INFO: 'Order Info',
  ITEMS: 'Order Items',
  DELIVERY: 'Delivery',
  INVOICES: 'Invoices Status',
};

export function resolveInvoicesTrackingRouteLabel(pathname: string | null): string | null {
  if (!pathname?.startsWith('/InvoicesTracking')) return null;
  if (pathname.startsWith('/InvoicesTracking/OrderDetails')) return INVOICES_TRACKING_ROUTE_LABELS['/InvoicesTracking/OrderDetails'];
  const exact = INVOICES_TRACKING_ROUTE_LABELS[pathname];
  if (exact) return exact;
  const match = Object.entries(INVOICES_TRACKING_ROUTE_LABELS)
    .filter(([prefix]) => prefix !== '/InvoicesTracking')
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match?.[1] ?? 'Invoices Tracking';
}

export function useInvoicesTrackingRouteAudit(pathname: string | null) {
  useEffect(() => {
    const label = resolveInvoicesTrackingRouteLabel(pathname);
    if (label) TrackModuleSubTab(label);
  }, [pathname]);
}

export function useInvoicesTrackingReportsTabAudit(activeTab: InvoicesTrackingReportTabId) {
  useModuleTabAudit(INVOICES_TRACKING_REPORT_TAB_LABELS[activeTab]);
}

export function useInvoicesTrackingOrderDetailsTabAudit(activeTab: string) {
  useModuleTabAudit(INVOICES_TRACKING_ORDER_DETAILS_TAB_LABELS[activeTab] ?? activeTab);
}
