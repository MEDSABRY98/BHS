'use client';

import React, { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/supabase';
import RecordScrapTab from './RecordScrapTab';
import SessionsHistoryTab from './SessionsHistoryScrapTab';

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
  activeSubTab?: 'record' | 'sessions';
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
      // Query active session globally from database settings table
      const { data: settingsData, error: settingsError } = await app_lpos_supabase
        .from('web_system_settings')
        .select('value')
        .eq('key', 'active_scrap_session');

      if (settingsError) throw settingsError;

      let session = settingsData && settingsData.length > 0 ? settingsData[0].value : null;
      const isValidFormat = session && /^S-\d{4}$/.test(session);

      if (!isValidFormat) {
        session = calculateNextSessionId(loadedEntries);
        // Save back to DB to establish global session
        await app_lpos_supabase
          .from('web_system_settings')
          .upsert({ key: 'active_scrap_session', value: session });
      }

      setCurrentSession(session || '');
    } catch (err) {
      console.error('Error initializing global session:', err);
    }
  };

  const fetchScrapEntries = async () => {
    try {
      setIsEntriesLoading(true);
      const { data, error } = await app_lpos_supabase
        .from('web_INVENTORY_SCRAB')
        .select(`
          ID,
          "PRODUCT ID",
          QTY,
          REASON,
          CREATED_AT,
          SESSION_ID,
          bhs_PRODUCTS (
            "PRODUCT NAME",
            "PRODUCT BARCODE"
          )
        `)
        .order('CREATED_AT', { ascending: false });

      if (error) throw error;
      
      const entries = (data || []).map((item: any) => ({
        ID: item.ID,
        'PRODUCT ID': item['PRODUCT ID'],
        'PRODUCT BARCODE': item.bhs_PRODUCTS?.['PRODUCT BARCODE'] || '',
        'PRODUCT NAME': item.bhs_PRODUCTS?.['PRODUCT NAME'] || 'Unknown Product',
        QTY: item.QTY,
        REASON: item.REASON,
        CREATED_AT: item.CREATED_AT,
        SESSION_ID: item.SESSION_ID
      }));

      setScrapEntries(entries);
      await initializeSession(entries);
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
      ) : (
        <SessionsHistoryTab
          scrapEntries={scrapEntries}
          isEntriesLoading={isEntriesLoading}
          fetchScrapEntries={fetchScrapEntries}
          currentSession={currentSession}
        />
      )}
    </div>
  );
}
