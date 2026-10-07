'use client';

import { useEffect, useState } from 'react';
import { getDebitTransactionsPaginated } from '../Service/debit_service';
import { InvoiceRow } from '@/types';

export function useServerTransactions(options: {
  search: string;
  dateFrom: string;
  dateTo: string;
  pageIndex: number;
  pageSize: number;
  dataVersion: number;
  enabled?: boolean;
}) {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (options.enabled === false) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await getDebitTransactionsPaginated({
          search: options.search,
          dateFrom: options.dateFrom || undefined,
          dateTo: options.dateTo || undefined,
          limit: options.pageSize,
          offset: options.pageIndex * options.pageSize,
        });
        if (cancelled) return;
        setRows(result.data);
        setTotal(result.total);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    options.search,
    options.dateFrom,
    options.dateTo,
    options.pageIndex,
    options.pageSize,
    options.dataVersion,
    options.enabled,
  ]);

  return { rows, total, loading, error };
}
