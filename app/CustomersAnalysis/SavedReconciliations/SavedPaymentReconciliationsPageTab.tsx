'use client';

import type { PaymentReconciliationSessionSummary } from '../Service/debit_service';
import SavedPaymentReconciliationsTab from './SavedPaymentReconciliationsTab';
import { InvoiceRow } from '@/types';

interface SavedPaymentReconciliationsPageTabProps {
  data?: InvoiceRow[];
  refreshKey?: number;
  onOpenSession: (session: PaymentReconciliationSessionSummary) => void;
  onSessionsChanged?: () => void;
}

export default function SavedPaymentReconciliationsPageTab({
  data = [],
  refreshKey,
  onOpenSession,
  onSessionsChanged,
}: SavedPaymentReconciliationsPageTabProps) {
  return (
    <div className="p-6">
      <SavedPaymentReconciliationsTab
        data={data}
        refreshKey={refreshKey}
        onOpenSession={onOpenSession}
        onSessionsChanged={onSessionsChanged}
      />
    </div>
  );
}
