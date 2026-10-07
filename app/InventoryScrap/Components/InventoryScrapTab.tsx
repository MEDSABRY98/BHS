'use client';

import React, { useState, useEffect } from 'react';
import RecordScrapTab from './RecordScrapTab';
import SavedReportsTab from './SavedReportsTab';

interface InventoryScrapTabProps {
  activeSubTab?: 'record' | 'history';
}

export default function InventoryScrapTab({ activeSubTab = 'record' }: InventoryScrapTabProps) {
  const [shouldRefreshReports, setShouldRefreshReports] = useState(0);

  const handleReportSaved = () => {
    setShouldRefreshReports(prev => prev + 1);
  };

  return (
    <div>
      <div className={activeSubTab === 'record' ? 'block' : 'hidden'}>
        <RecordScrapTab onReportSaved={handleReportSaved} />
      </div>
      <div className={activeSubTab === 'history' ? 'block' : 'hidden'}>
        <SavedReportsTab refreshTrigger={shouldRefreshReports} />
      </div>
    </div>
  );
}
