'use client';

import { useEffect } from 'react';
import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';

export type LposReportTabId = 'pending' | 'pending-customer' | 'delivered' | 'handover';

export const LPOS_ROUTE_LABELS: Record<string, string> = {
  '/LPOs': 'Dashboard',
  '/LPOs/Orders': 'Orders',
  '/LPOs/CreateOrders': 'Create Orders',
  '/LPOs/Reports': 'Reports',
  '/LPOs/InvoiceCancel': 'Invoice Cancel',
  '/LPOs/OrderDetails': 'Order Details',
};

export const LPOS_REPORT_TAB_LABELS: Record<LposReportTabId, string> = {
  pending: 'Pending Driver Invoices',
  'pending-customer': 'Pending Customer Invoices',
  delivered: 'Delivered Driver Invoices',
  handover: 'Daily Handover',
};

export const LPOS_ORDER_DETAILS_TAB_LABELS: Record<string, string> = {
  INFO: 'Order Info',
  ITEMS: 'Order Items',
  DELIVERY: 'Delivery',
  INVOICES: 'Invoices Status',
};

export function resolveLposRouteLabel(pathname: string | null): string | null {
  if (!pathname?.startsWith('/LPOs')) return null;
  if (pathname.startsWith('/LPOs/OrderDetails')) return LPOS_ROUTE_LABELS['/LPOs/OrderDetails'];
  const exact = LPOS_ROUTE_LABELS[pathname];
  if (exact) return exact;
  const match = Object.entries(LPOS_ROUTE_LABELS)
    .filter(([prefix]) => prefix !== '/LPOs')
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match?.[1] ?? 'LPOs';
}

export function useLposRouteAudit(pathname: string | null) {
  useEffect(() => {
    const label = resolveLposRouteLabel(pathname);
    if (label) TrackModuleSubTab(label);
  }, [pathname]);
}

export function useLposReportsTabAudit(activeTab: LposReportTabId) {
  useModuleTabAudit(LPOS_REPORT_TAB_LABELS[activeTab]);
}

export function useLposOrderDetailsTabAudit(activeTab: string) {
  useModuleTabAudit(LPOS_ORDER_DETAILS_TAB_LABELS[activeTab] ?? activeTab);
}
