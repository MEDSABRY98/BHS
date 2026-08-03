'use client';

import { useEffect } from 'react';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';
import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export const DEBIT_TAB_LABELS: Record<string, string> = {
  customers: 'Customers',
  'credit-limit': 'Credit Limit',
  'customers-group': 'Customers Group',
  'payment-reconciliation': 'Payment Reconciliation',
  'all-transactions': 'All Transactions',
  'customers-open-matches': 'Open Transactions',
  'payment-tracker': 'Payment Tracker',
  salesreps: 'Sales Reps',
  history: 'History',
  ages: 'Ages',
};

export const DEBIT_CUSTOMER_DETAILS_TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  invoices: 'Invoices',
  overdue: 'Overdue',
  ages: 'Ages',
  monthly: 'Monthly',
  notes: 'Notes',
};

export function useDebitTabAudit(activeTab: string) {
  useModuleTabAudit(DEBIT_TAB_LABELS[activeTab] ?? activeTab);
}

export function trackDebitCustomerDetailsTab(activeTab: string) {
  TrackModuleSubTab(`Customers · ${DEBIT_CUSTOMER_DETAILS_TAB_LABELS[activeTab] ?? activeTab}`);
}

export function useDebitCustomerDetailsTabAudit(activeTab: string) {
  useEffect(() => {
    trackDebitCustomerDetailsTab(activeTab);
  }, [activeTab]);
}
