'use client';

import React from 'react';

/** Host bar for Count Reconciliation toolbar (portaled controls). Kept mounted while
 * other counting tabs are open so the portal target is not destroyed on tab switch. */
export default function CountingToolbar({
  showReconciliationToolbar = false,
}: {
  showReconciliationToolbar?: boolean;
}) {
  return (
    <div
      className={`bg-white p-4 rounded-3xl border border-gray-100 shadow-xl shadow-slate-200/50 ${
        showReconciliationToolbar ? '' : 'hidden'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div
          id="ic-reconciliation-toolbar-host"
          className="flex flex-wrap items-center gap-3 flex-1 min-w-0"
        />
      </div>
    </div>
  );
}
