'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export const CUSTOMERS_DOCUMENTS_VIEW = 'Customers Documents';

export function useCustomersDocumentsTabAudit(isReady: boolean = true) {
  useModuleTabAudit(isReady ? CUSTOMERS_DOCUMENTS_VIEW : null);
}
