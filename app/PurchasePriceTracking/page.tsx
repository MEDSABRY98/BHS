'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Loader2 } from 'lucide-react';
import Sidebar from './Utils/Sidebar';
import { bhs_supabase, fetchAllData } from '@/lib/supabase';
import ProductPriceHistory from './ProductPriceHistory';
import SupplierComparison from './SupplierComparison';
import SupplierHistory from './SupplierHistory';
import ReportsTab from './Reports/ReportsTab';

export type PurchaseRecord = {
  id: string;
  date: string;
  invoiceNumber: string;
  supplierId: string;
  productId: string;
  unitPrice: number;
  qty: number;
};

export type Supplier = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  name: string;
  barcode?: string;
};

export default function PurchasePriceTrackingPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('product-history');
  
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setIsLoading(true);
      
      const [purchasesData, suppliersData, productsData] = await Promise.all([
        fetchAllData(() => bhs_supabase.from('web_Suppliers_Purchase').select('*').order('ID', { ascending: true })),
        fetchAllData(() => bhs_supabase.from('bhs_SUPPLIERS').select('"SUPPLIER ID", "SUPPLIER NAME"').order('SUPPLIER ID', { ascending: true })),
        fetchAllData(() => bhs_supabase.from('bhs_PRODUCTS').select('"PRODUCT ID", "PRODUCT NAME", "PRODUCT BARCODE"').order('PRODUCT ID', { ascending: true }))
      ]);

      const excludedProductNames = ['PACKAGING'];
      
      const filteredProductsData = productsData.filter((p: any) => {
        const name = p['PRODUCT NAME'] ? String(p['PRODUCT NAME']).trim().toUpperCase() : '';
        return !excludedProductNames.includes(name);
      });

      const allowedProductIds = new Set(filteredProductsData.map((p: any) => String(p['PRODUCT ID']).trim()));

      const filteredPurchasesData = purchasesData.filter((p: any) => {
        const pId = String(p['PRODUCT ID'] || '').trim();
        return allowedProductIds.has(pId);
      });

      const mappedPurchases: PurchaseRecord[] = filteredPurchasesData.map((p: any) => ({
        id: p.ID,
        date: p.DATE ? String(p.DATE).split('T')[0] : '',
        invoiceNumber: p['INVOICE NUMBER'],
        supplierId: String(p['SUPPLIER ID'] || '').trim(),
        productId: String(p['PRODUCT ID'] || '').trim(),
        unitPrice: Number(p['UNIT PRICE']) || 0,
        qty: Number(p['QTY']) || 0,
      }));

      // Free/sample lines (unit price 0) stay in DB but skew price analytics — skip those rows only.
      setPurchases(mappedPurchases.filter((p) => p.unitPrice > 0));

      setSuppliers(
        suppliersData.map((s: any) => ({
          id: String(s['SUPPLIER ID'] || '').trim(),
          name: s['SUPPLIER NAME'] || 'Unknown Supplier',
        }))
      );

      setProducts(
        filteredProductsData.map((p: any) => ({
          id: String(p['PRODUCT ID'] || '').trim(),
          name: p['PRODUCT NAME'] || 'Unknown Product',
          barcode: p['PRODUCT BARCODE'] ? String(p['PRODUCT BARCODE']).trim() : undefined,
        }))
      );

      console.log("FETCHED PURCHASES (first 2):", JSON.stringify(purchasesData.slice(0, 2), null, 2));
      console.log("MAPPED PURCHASES (first 2):", JSON.stringify(purchasesData.slice(0, 2).map((p: any) => ({
          id: p.ID,
          date: p.DATE ? String(p.DATE).split('T')[0] : '',
          invoiceNumber: p['INVOICE NUMBER'],
          supplierId: String(p['SUPPLIER ID'] || '').trim(),
          productId: String(p['PRODUCT ID'] || '').trim(),
          unitPrice: Number(p['UNIT PRICE']) || 0,
          qty: Number(p['QTY']) || 0,
        })), null, 2));

    } catch (error) {
      console.error('Error fetching purchase tracking data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center h-full text-amber-500">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="font-bold tracking-widest uppercase">Loading Data...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'product-history':
        return <ProductPriceHistory purchases={purchases} suppliers={suppliers} products={products} />;
      case 'supplier-comparison':
        return <SupplierComparison purchases={purchases} suppliers={suppliers} products={products} />;
      case 'supplier-history':
        return <SupplierHistory purchases={purchases} suppliers={suppliers} products={products} />;
      case 'reports':
        return <ReportsTab purchases={purchases} suppliers={suppliers} products={products} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50">
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-[90%] mx-auto">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 animate-in fade-in duration-300">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-6 animate-pulse min-h-[200px]">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-200 w-14 h-14 rounded-2xl" />
                      <div className="flex-1 space-y-3">
                        <div className="bg-slate-200 w-3/4 h-6 rounded-lg" />
                        <div className="bg-slate-200 w-1/2 h-4 rounded-lg" />
                      </div>
                    </div>
                    <div className="mt-auto space-y-2">
                      <div className="bg-slate-100 w-full h-12 rounded-xl" />
                      <div className="bg-slate-100 w-full h-12 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div key={activeTab} className="animate-in fade-in zoom-in-[0.98] duration-500">
                {renderContent()}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
