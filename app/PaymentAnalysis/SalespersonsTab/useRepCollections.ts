import { useMemo } from 'react';
import type { InvoiceRow } from '@/types';
import { getPaymentCategory } from '../Utils/PaymentType';
import type { RepAllocation } from '../Context/PaymentAnalysisContext';

// ════════════════════════════════════════════════════════════════
//  Collections per sales rep.
//  The split of each payment between reps comes from the server
//  (getPaymentRepAllocation) and follows EXACTLY the Salesperson Analysis rules:
//   • a payment matched to sales invoices follows those invoices → the rep of the
//     invoice's sub customer
//   • the unapplied part / unmatched payments / refunds → split equally between the
//     reps of the customer's main name (2 reps = 50/50, 3 = a third each…)
//  A payment shared by 2 reps counts as one payment for each of them.
// ════════════════════════════════════════════════════════════════

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type Bucket = { net: number; payments: Set<string>; customers: Set<string> };
const newBucket = (): Bucket => ({ net: 0, payments: new Set(), customers: new Set() });

export type RepAgg = {
  rep: string;
  net: number;
  paymentCount: number;
  customerCount: number;
  averagePayment: number;
  monthlyAverage: number;
  share: number; // % of the total net
  months: { key: string; label: string; net: number; payments: number; customers: number }[];
  cities: { city: string; net: number; share: number; payments: number; customers: number }[];
};

export function sharesOf(row: InvoiceRow, alloc: RepAllocation): { rep: string; share: number }[] {
  if (alloc.mode === 'self') return [{ rep: alloc.rep || 'Me', share: 1 }];
  const list = alloc.allocation[String(row.id)];
  return list && list.length ? list : [{ rep: 'Unassigned', share: 1 }];
}

export function useRepCollections(paymentsData: InvoiceRow[], alloc: RepAllocation | null): RepAgg[] {
  return useMemo(() => {
    if (!alloc) return [];

    type Entry = Bucket & { months: Map<string, Bucket>; cities: Map<string, Bucket> };
    const reps = new Map<string, Entry>();

    paymentsData.forEach((row, idx) => {
      const category = getPaymentCategory(row);
      if (category === 'Other') return;
      const amount = category === 'Payment' ? Number(row.credit) || 0 : -(Number(row.debit) || 0);
      const rowKey = String(row.id ?? `row-${idx}`);
      const city = (row.city || 'UNKNOWN').trim() || 'UNKNOWN';
      const month = String(row.date ?? '').slice(0, 7);

      for (const { rep, share } of sharesOf(row, alloc)) {
        const entry = reps.get(rep) || { ...newBucket(), months: new Map(), cities: new Map() };
        const cityBucket = entry.cities.get(city) || newBucket();
        const monthBucket = month ? entry.months.get(month) || newBucket() : null;

        for (const target of [entry, cityBucket, monthBucket]) {
          if (!target) continue;
          target.net += amount * share;
          if (category === 'Payment') target.payments.add(rowKey);
          if (row.customerId) target.customers.add(row.customerId);
        }
        entry.cities.set(city, cityBucket);
        if (monthBucket) entry.months.set(month, monthBucket);
        reps.set(rep, entry);
      }
    });

    const total = Array.from(reps.values()).reduce((s, e) => s + e.net, 0);
    return Array.from(reps.entries())
      .map(([rep, e]): RepAgg => {
        const monthCount = e.months.size || 1;
        return {
          rep,
          net: e.net,
          paymentCount: e.payments.size,
          customerCount: e.customers.size,
          averagePayment: e.payments.size ? e.net / e.payments.size : 0,
          monthlyAverage: e.net / monthCount,
          share: total ? (e.net / total) * 100 : 0,
          months: Array.from(e.months.entries())
            .map(([key, b]) => {
              const [y, m] = key.split('-');
              return {
                key,
                label: `${MONTHS[Number(m) - 1] || m} ${y}`,
                net: b.net,
                payments: b.payments.size,
                customers: b.customers.size,
              };
            })
            .sort((a, b) => b.key.localeCompare(a.key)),
          cities: Array.from(e.cities.entries())
            .map(([city, b]) => ({
              city,
              net: b.net,
              share: e.net ? (b.net / e.net) * 100 : 0,
              payments: b.payments.size,
              customers: b.customers.size,
            }))
            .sort((a, b) => b.net - a.net),
        };
      })
      .sort((a, b) => b.net - a.net);
  }, [paymentsData, alloc]);
}
