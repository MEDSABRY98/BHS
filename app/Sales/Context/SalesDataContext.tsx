'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface SalesDataContextValue {
  dataVersion: number;
  invalidateData: () => void;
  setDataVersion: (version: number) => void;
}

const SalesDataContext = createContext<SalesDataContextValue | null>(null);

export function SalesDataProvider({
  children,
  initialVersion = 0,
}: {
  children: React.ReactNode;
  initialVersion?: number;
}) {
  const [dataVersion, setDataVersion] = useState(initialVersion);

  const invalidateData = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({
      dataVersion,
      invalidateData,
      setDataVersion,
    }),
    [dataVersion, invalidateData]
  );

  return <SalesDataContext.Provider value={value}>{children}</SalesDataContext.Provider>;
}

export function useSalesDataContext(): SalesDataContextValue {
  const context = useContext(SalesDataContext);
  if (!context) {
    throw new Error('useSalesDataContext must be used within SalesDataProvider');
  }
  return context;
}
