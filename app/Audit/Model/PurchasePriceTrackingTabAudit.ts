'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export const PURCHASE_TAB_LABELS: Record<string, string> = {
  'product-history': 'Product Price History',
  'supplier-comparison': 'Supplier Comparison',
  'supplier-history': 'Supplier History',
  reports: 'Reports',
};

export function usePurchasePriceTrackingTabAudit(activeTab: string) {
  useModuleTabAudit(PURCHASE_TAB_LABELS[activeTab] ?? activeTab);
}
