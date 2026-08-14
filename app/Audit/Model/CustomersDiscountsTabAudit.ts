'use client';

import { useEffect } from 'react';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';

export type CustomersDiscountsViewId = 'grid' | 'add' | 'details' | 'months' | 'stats' | 'values';
export type CustomersDiscountsDetailsTabId = 'details' | 'pending' | 'semi' | 'settled';
export type CustomersDiscountsMonthsTabId = 'pending' | 'semi' | 'settled';

export const DISCOUNTS_VIEW_LABELS: Record<CustomersDiscountsViewId, string> = {
  grid: 'Customers List',
  add: 'Add Discount',
  details: 'Customer Details',
  months: 'Months Overview',
  stats: 'Statistics',
  values: 'Values',
};

export const DISCOUNTS_DETAILS_TAB_LABELS: Record<CustomersDiscountsDetailsTabId, string> = {
  details: 'Discount Details',
  pending: 'Pending',
  semi: 'Semi Settled',
  settled: 'Settled',
};

export const DISCOUNTS_MONTHS_TAB_LABELS: Record<CustomersDiscountsMonthsTabId, string> = {
  pending: 'Pending',
  semi: 'Semi Settled',
  settled: 'Settled',
};

export function useCustomersDiscountsTabAudit(
  currentView: CustomersDiscountsViewId,
  detailsTab?: CustomersDiscountsDetailsTabId,
) {
  useEffect(() => {
    if (currentView === 'details' && detailsTab) {
      TrackModuleSubTab(`${DISCOUNTS_VIEW_LABELS.details} · ${DISCOUNTS_DETAILS_TAB_LABELS[detailsTab]}`);
      return;
    }
    TrackModuleSubTab(DISCOUNTS_VIEW_LABELS[currentView]);
  }, [currentView, detailsTab]);
}

export function trackCustomersDiscountsMonthsTab(tabId: CustomersDiscountsMonthsTabId) {
  TrackModuleSubTab(`${DISCOUNTS_VIEW_LABELS.months} · ${DISCOUNTS_MONTHS_TAB_LABELS[tabId]}`);
}
