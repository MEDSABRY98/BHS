'use client';

import { useEffect, useState } from 'react';
import { getDebitPaymentsSummary } from '../Service/debit_service';

export function useDebitPaymentsSummary(options: {
  dateFrom?: string;
  dateTo?: string;
  dataVersion: number;
  enabled?: boolean;
}) {
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fromRpc, setFromRpc] = useState(false);

  useEffect(() => {
    if (options.enabled === false) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await getDebitPaymentsSummary({
          dateFrom: options.dateFrom || undefined,
          dateTo: options.dateTo || undefined,
        });
        if (cancelled) return;
        if (result?.success) {
          setTotalPayments(Number(result.totalPayments) || 0);
          setTotalAmount(Number(result.totalAmount) || 0);
          setFromRpc(true);
        }
      } catch {
        if (!cancelled) setFromRpc(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [options.dateFrom, options.dateTo, options.dataVersion, options.enabled]);

  return { totalPayments, totalAmount, loading, fromRpc };
}
