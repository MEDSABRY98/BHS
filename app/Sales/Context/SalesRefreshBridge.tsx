'use client';

import { useEffect } from 'react';
import { useSalesDataContext } from '@/app/Sales/Context/SalesDataContext';

export function SalesRefreshBridge({
  refreshTrigger,
  children,
}: {
  refreshTrigger: number;
  children: React.ReactNode;
}) {
  const { setDataVersion } = useSalesDataContext();

  useEffect(() => {
    setDataVersion(refreshTrigger);
  }, [refreshTrigger, setDataVersion]);

  return <>{children}</>;
}
