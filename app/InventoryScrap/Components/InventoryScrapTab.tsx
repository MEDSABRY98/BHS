'use client';

import React, { useState, useEffect } from 'react';
import { fetchAllScrapEntries, fetchActiveScrapSession, upsertActiveScrapSession } from '../Service/inventory_scrap_service';
import RecordScrapTab from './RecordScrapTab';
import SessionsHistoryTab from './SessionsHistoryScrapTab';
import InventoryScrapReportTab from './ReportTab';
import SavedReportsTab from './SavedReportsTab';

interface ScrapEntry {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT BARCODE': string;
  'PRODUCT NAME': string;
  QTY: number;
  REASON: 'EXPIRED' | 'DAMAGED';
  CREATED_AT: string;
  SESSION_ID: string;
}

interface InventoryScrapTabProps {
  activeSubTab?: 'record' | 'sessions' | 'report' | 'history';
}

const calculateNextSessionId = (entries: { SESSION_ID: string }[], currentSessionId?: string) => {
  const sessionIds = new Set<string>();
  if (entries) {
    entries.forEach(e => {
      if (e.SESSION_ID) sessionIds.add(e.SESSION_ID);
    });
  }
  if (currentSessionId) {
    sessionIds.add(currentSessionId);
  }

  let maxNum = 0;
  sessionIds.forEach(id => {
    const match = id.match(/^S-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return `S-${String(nextNum).padStart(4, '0')}`;
};

export default function InventoryScrapTab({ activeSubTab = 'record' }: InventoryScrapTabProps) {
  const [scrapEntries, setScrapEntries] = useState<ScrapEntry[]>([]);
  const [isEntriesLoading, setIsEntriesLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<string>('');

  useEffect(() => {
    fetchScrapEntries();
  }, []);

  const initializeSession = async (loadedEntries: ScrapEntry[]) => {
    try {
      let session = await fetchActiveScrapSession();
      const isValidFormat = session && /^S-\d{4}$/.test(session);

      if (!isValidFormat) {
        session = calculateNextSessionId(loadedEntries);
        await upsertActiveScrapSession(session);
      }
      setCurrentSession(session || '');
    } catch (err) {
      console.error('Error initializing global session:', err);
    }
  };

  const fetchScrapEntries = async () => {
    try {
      setIsEntriesLoading(true);
      const entries = await fetchAllScrapEntries();
      setScrapEntries(entries as any);
      await initializeSession(entries as any);
    } catch (err) {
      console.error('Error fetching scrap entries:', err);
    } finally {
      setIsEntriesLoading(false);
    }
  };

  return (
    <div>
      {activeSubTab === 'record' ? (
        <RecordScrapTab
          scrapEntries={scrapEntries}
          isEntriesLoading={isEntriesLoading}
          fetchScrapEntries={fetchScrapEntries}
          currentSession={currentSession}
          setCurrentSession={setCurrentSession}
        />
      ) : activeSubTab === 'sessions' ? (
        <SessionsHistoryTab
          scrapEntries={scrapEntries}
          isEntriesLoading={isEntriesLoading}
          fetchScrapEntries={fetchScrapEntries}
          currentSession={currentSession}
        />
      ) : activeSubTab === 'report' ? (
        <InventoryScrapReportTab />
      ) : (
        <SavedReportsTab />
      )}
    </div>
  );
}
