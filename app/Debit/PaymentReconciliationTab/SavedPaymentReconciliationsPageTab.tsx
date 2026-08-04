'use client';

import type { PaymentReconciliationSessionSummary } from '../Service/debit_service';
import SavedPaymentReconciliationsTab from './SavedPaymentReconciliationsTab';

interface SavedPaymentReconciliationsPageTabProps {
  refreshKey?: number;
  onOpenSession: (session: PaymentReconciliationSessionSummary) => void;
  onSessionsChanged?: () => void;
}

export default function SavedPaymentReconciliationsPageTab({
  refreshKey,
  onOpenSession,
  onSessionsChanged,
}: SavedPaymentReconciliationsPageTabProps) {
  return (
    <div className="p-6">
      <SavedPaymentReconciliationsTab
        refreshKey={refreshKey}
        onOpenSession={onOpenSession}
        onSessionsChanged={onSessionsChanged}
      />
    </div>
  );
}
