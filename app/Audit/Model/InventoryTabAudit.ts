'use client';

import { useEffect } from 'react';
import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';
import type { InventoryTabId } from '@/app/InventoryAnalysis/Utils/Sidebar';

const INVENTORY_TAB_LABELS: Record<InventoryTabId, string> = {
  products_balance: 'Products Balance',
  location_movements: 'Location Movements In/Out',
  category_balance: 'Categories Balance',
  categories: 'Categories Analysis',
  reports: 'Reports',
};

export const INVENTORY_WAREHOUSE_TAB_LABELS: Record<string, string> = {
  entry: 'Entry',
  edit: 'Edit Transaction',
  history: 'History',
  people: 'People Inventory',
};

export function useInventoryTabAudit(activeTab: InventoryTabId) {
  useModuleTabAudit(INVENTORY_TAB_LABELS[activeTab] ?? activeTab);
}

export function trackInventoryWarehouseTab(activeTab: string) {
  TrackModuleSubTab(`Categories Analysis · ${INVENTORY_WAREHOUSE_TAB_LABELS[activeTab] ?? activeTab}`);
}

export function useInventoryWarehouseTabAudit(activeTab: string) {
  useEffect(() => {
    trackInventoryWarehouseTab(activeTab);
  }, [activeTab]);
}
