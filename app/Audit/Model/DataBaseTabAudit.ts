'use client';

import { useEffect } from 'react';
import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';
import {
  findDatabaseNavItemByPath,
} from '@/app/DataBase/Utils/DatabaseHubConfig';

export type DataBaseProductsTabId = 'products' | 'categories';

export const DATABASE_HUB_VIEW = 'Database Hub';

export const DATABASE_PRODUCTS_TAB_LABELS: Record<DataBaseProductsTabId, string> = {
  products: 'Products',
  categories: 'Categories',
};

export function resolveDataBaseRouteLabel(pathname: string | null): string | null {
  if (!pathname?.startsWith('/DataBase')) return null;
  if (pathname === '/DataBase') return DATABASE_HUB_VIEW;

  return findDatabaseNavItemByPath(pathname)?.label ?? null;
}

export function useDataBaseRouteAudit(pathname: string | null) {
  useEffect(() => {
    const label = resolveDataBaseRouteLabel(pathname);
    if (label) TrackModuleSubTab(label);
  }, [pathname]);
}

export function useDataBaseProductsTabAudit(activeTab: DataBaseProductsTabId) {
  useModuleTabAudit(DATABASE_PRODUCTS_TAB_LABELS[activeTab]);
}
