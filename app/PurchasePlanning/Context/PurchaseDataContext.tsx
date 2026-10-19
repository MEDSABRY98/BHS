'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { bhs_supabas } from '@/lib/secureDb';

/**
 * The 4 planning months: the CURRENT month (sales so far) + the 3 months before it. Oldest first.
 * start / end are plain dates (yyyy-mm-dd) so the time zone never moves a sale into another month;
 * `end` is the first day of the NEXT month (use it with "<").
 */
export function getPlanningMonths(count = 4) {
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const ymd = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const today = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const year = d.getFullYear();
    const monthIndex = d.getMonth(); // 0-11
    months.push({
      key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      label: `${monthNames[monthIndex]}-${year.toString().slice(-2)}`,
      start: ymd(year, monthIndex),
      end: ymd(next.getFullYear(), next.getMonth()),
    });
  }
  return months;
}

/** PRODUCT PARENT ID: empty or 0 = the product has no parent (returns ''). */
export function cleanParentId(value: unknown): string {
  const v = String(value ?? '').trim();
  return v === '' || /^0+$/.test(v) ? '' : v;
}

export type PlanningMonth = {
  key: string;
  label: string;
  start: string;
  end: string;
};

export type ProductPurchaseRow = {
  id: string;
  productId: string; // SKU or internal ID
  parentId: string; // PRODUCT PARENT ID ('' = no parent)
  barcode: string;
  name: string;
  category: string;
  unit: string;
  stockQuantity: number;
  qtyInBox: number;
  monthlySales: Record<string, number>; // key -> total qty
  monthlyAverage: number;
};

export type PurchaseFilters = {
  categories: string[];
};

interface PurchaseDataContextValue {
  loading: boolean;
  error: string | null;
  products: ProductPurchaseRow[];
  months: PlanningMonth[];
  orderQuantities: Map<string, number>; // productId -> quantity
  setOrderQuantity: (productId: string, quantity: number) => void;
  globalFilters: PurchaseFilters;
  setGlobalFilters: React.Dispatch<React.SetStateAction<PurchaseFilters>>;
  uniqueCategories: string[];
  refresh: () => Promise<void>;
}

const PurchaseDataContext = createContext<PurchaseDataContextValue | null>(null);

export function PurchaseDataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductPurchaseRow[]>([]);
  const [orderQuantities, setOrderQuantities] = useState<Map<string, number>>(new Map());
  const [globalFilters, setGlobalFilters] = useState<PurchaseFilters>({ categories: [] });
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  
  const months = useMemo(() => getPlanningMonths(), []);

  const setOrderQuantity = (productId: string, quantity: number) => {
    setOrderQuantities(prev => {
      const next = new Map(prev);
      if (quantity <= 0) {
        next.delete(productId);
      } else {
        next.set(productId, quantity);
      }
      return next;
    });
  };

  const fetchPromiseRef = useRef<Promise<void> | null>(null);

  const fetchAllData = async () => {
    if (fetchPromiseRef.current) return fetchPromiseRef.current;
    
    setLoading(true);
    setError(null);
    
    const promise = (async () => {
      try {
      // 1. Fetch ALL products (Supabase returns max 1000 rows per request)
      const rawProducts: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error: prodError } = await bhs_supabas
          .from('bhs_PRODUCTS')
          .select('*')
          .order('ID', { ascending: true })
          .range(from, from + 999);
        if (prodError) throw prodError;
        rawProducts.push(...(data || []));
        if (!data || data.length < 1000) break;
      }

      // 2. Fetch Sales for the date range
      const oldestDate = months[0].start;
      const endExclusive = months[months.length - 1].end; // first day after the current month

      const { count, error: countError } = await bhs_supabas
        .from('web_Sales_DB')
        .select('*', { count: 'exact', head: true })
        .gte('INVOICE DATE', oldestDate)
        .lt('INVOICE DATE', endExclusive);
      
      if (countError) throw countError;

      const rawSales: any[] = [];
      if (count) {
        const step = 1000;
        const ranges = [];
        for (let i = 0; i < count; i += step) {
          ranges.push({ from: i, to: i + step - 1 });
        }

        for (let i = 0; i < ranges.length; i += 3) {
          const batch = ranges.slice(i, i + 3);
          const responses = await Promise.all(
            batch.map(r => 
              bhs_supabas
                .from('web_Sales_DB')
                .select('"INVOICE DATE", "PRODUCT ID", "QTY"')
                .gte('INVOICE DATE', oldestDate)
                .lt('INVOICE DATE', endExclusive)
                .order('ID', { ascending: true }) // fixed order: pages never overlap or skip rows
                .range(r.from, r.to)
            )
          );
          
          responses.forEach(res => {
            if (res.error) throw res.error;
            if (res.data) rawSales.push(...res.data);
          });
        }
      }
      
      // 3. Aggregate Sales
      // product ID -> month key -> qty
      const salesMap = new Map<string, Record<string, number>>();
      
      (rawSales || []).forEach(sale => {
        const prodId = sale['PRODUCT ID'];
        if (!prodId) return;
        
        const dateStr = sale['INVOICE DATE'];
        if (!dateStr) return;
        
        // yyyy-mm from the stored date itself (no time zone shift)
        const key = String(dateStr).slice(0, 7);
        
        // Find if this key is in our tracked months
        const trackedMonth = months.find(m => m.key === key);
        if (trackedMonth) {
          if (!salesMap.has(prodId)) salesMap.set(prodId, {});
          const record = salesMap.get(prodId)!;
          record[key] = (record[key] || 0) + (Number(sale['QTY']) || 0);
        }
      });

      // 4. Build Product Rows
      const processedProducts: ProductPurchaseRow[] = (rawProducts || [])
        .filter(p => p['IS_COUNTABLE'] === true && p['IS_ACTIVE'] !== false)
        .map(p => {
        const pId = p['PRODUCT ID'] || p['ID'] || '';
        const monthly = salesMap.get(pId) || {};
        
        let totalSales = 0;
        months.forEach(m => {
          totalSales += (monthly[m.key] || 0);
        });

        return {
          id: p['ID'] || pId,
          productId: pId,
          parentId: cleanParentId(p['PRODUCT PARENT ID']),
          barcode: p['PRODUCT BARCODE'] || '',
          name: p['PRODUCT NAME'] || '',
          category: p['PRODUCT CATEGORY'] || 'Uncategorized',
          unit: p['UNIT'] || '',
          stockQuantity: Number(p['STOCK QUANTITY']) || 0,
          qtyInBox: Number(p['QTY IN BOX']) || 0,
          monthlySales: monthly,
          monthlyAverage: totalSales / months.length
        };
      });

      const categories = new Set<string>();
      processedProducts.forEach(p => categories.add(p.category));
      setUniqueCategories(Array.from(categories).sort());

      setProducts(processedProducts);
    } catch (err: any) {
      console.error('Error fetching purchase planning data:', err);
      setError(err?.message || 'Failed to load data');
      } finally {
        setLoading(false);
        fetchPromiseRef.current = null;
      }
    })();
    
    fetchPromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    fetchAllData();
  }, [months]);

  return (
    <PurchaseDataContext.Provider value={{
      loading,
      error,
      products,
      months,
      orderQuantities,
      setOrderQuantity,
      globalFilters,
      setGlobalFilters,
      uniqueCategories,
      refresh: fetchAllData
    }}>
      {children}
    </PurchaseDataContext.Provider>
  );
}

export function usePurchaseData() {
  const ctx = useContext(PurchaseDataContext);
  if (!ctx) throw new Error('usePurchaseData must be used within PurchaseDataProvider');
  return ctx;
}
