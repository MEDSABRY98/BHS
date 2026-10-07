'use client';

import React from 'react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import { SalesRawDataProvider } from '@/app/Sales/Context/SalesRawDataContext';

export function SalesRawDataBridge({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const { commonFilters, invoiceTypeFilter } = useSalesModuleFilters();

  return (
    <SalesRawDataProvider
      userId={userId}
      filters={commonFilters}
      invoiceTypeFilter={invoiceTypeFilter}
    >
      {children}
    </SalesRawDataProvider>
  );
}
