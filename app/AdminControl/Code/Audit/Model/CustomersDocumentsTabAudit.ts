'use client';

import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';

export const CUSTOMERS_DOCUMENTS_VIEW = 'Customers Documents';

export function useCustomersDocumentsTabAudit(isReady: boolean = true) {
  useModuleTabAudit(isReady ? CUSTOMERS_DOCUMENTS_VIEW : null);
}
