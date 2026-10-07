'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { bhs_supabas } from '@/lib/supabase';

// Helper to calculate the last 4 completed months
export function getLast4CompletedMonths() {
  const months = [];
  const today = new Date();
  // Start from the previous month
  today.setMonth(today.getMonth() - 1);
  
  for (let i = 0; i < 4; i++) {
    const year = today.getFullYear();
    const monthIndex = today.getMonth(); // 0-11
    
    // Create first day of month
    const start = new Date(year, monthIndex, 1);
    // Create last day of month
    const end = new Date(year, monthIndex + 1, 0);
    end.setHours(23, 59, 59, 999);
    
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const shortYear = year.toString().slice(-2);
    
    months.unshift({ // unshift to put oldest first
      key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      label: `${monthNames[monthIndex]}-${shortYear}`,
      start: start.toISOString(),
      end: end.toISOString()
    });
    
    today.setMonth(today.getMonth() - 1);
  }
  return months;
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
  const [products, setProducts] = useState<ProductPurchaseRow[]>([]);
  const [orderQuantities, setOrderQuantities] = useState<Map<string, number>>(new Map());
  const [globalFilters, setGlobalFilters] = useState<PurchaseFilters>({ categories: [] });
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  
  const months = useMemo(() => getLast4CompletedMonths(), []);

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
    
    const promise = (async () => {
      try {
      // 1. Fetch Products
      const { data: rawProducts, error: prodError } = await bhs_supabas
        .from('bhs_PRODUCTS')
        .select('*');
      if (prodError) throw prodError;

      // 2. Fetch Sales for the date range
      const oldestDate = months[0].start;
      const newestDate = months[months.length - 1].end;

      const { count, error: countError } = await bhs_supabas
        .from('web_Sales_DB')
        .select('*', { count: 'exact', head: true })
        .gte('INVOICE DATE', oldestDate)
        .lte('INVOICE DATE', newestDate);
      
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
                .lte('INVOICE DATE', newestDate)
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
        
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const monthIndex = date.getMonth() + 1;
        const key = `${year}-${String(monthIndex).padStart(2, '0')}`;
        
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
    } catch (err) {
      console.error('Error fetching purchase planning data:', err);
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
