'use client';

import React, { useState, useEffect } from 'react';
import Sidebar, { PURCHASE_PRICE_TAB_IDS } from './Utils/Sidebar';
import { getAllowedModuleTabIds, getCurrentUserFromStorage } from '@/app/AdminControl/AdminControlTab';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { bhs_supabase, fetchAllData } from '@/lib/supabase';
import ProductPriceHistory from './ProductPriceHistory/ProductPriceHistory';
import SupplierComparison from './SupplierComparison/SupplierComparison';
import SupplierHistory from './SupplierHistory/SupplierHistory';
import ReportsTab from './Reports/ReportsTab';
import {
  PurchaseFiltersProvider,
  PurchaseFilterButton,
  usePurchaseModuleFilters,
} from './Model/PurchaseFilters';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { usePurchasePriceTrackingTabAudit } from '@/app/Audit/Model/PurchasePriceTrackingTabAudit';

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
  category?: string;
};

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 animate-in fade-in duration-300">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-6 animate-pulse min-h-[200px]"
        >
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
  );
}

function PurchasePriceTrackingContent({
  activeTab,
  onPurchasePriceUpdated,
}: {
  activeTab: string;
  onPurchasePriceUpdated: (id: string, unitPrice: number) => void;
}) {
  const { filteredPurchases, suppliers, products } = usePurchaseModuleFilters();

  switch (activeTab) {
    case 'product-history':
      return (
        <ProductPriceHistory
          purchases={filteredPurchases}
          suppliers={suppliers}
          products={products}
          onPurchasePriceUpdated={onPurchasePriceUpdated}
        />
      );
    case 'supplier-comparison':
      return (
        <SupplierComparison purchases={filteredPurchases} suppliers={suppliers} products={products} />
      );
    case 'supplier-history':
      return (
        <SupplierHistory purchases={filteredPurchases} suppliers={suppliers} products={products} />
      );
    case 'reports':
      return <ReportsTab purchases={filteredPurchases} suppliers={suppliers} products={products} />;
    default:
      return null;
  }
}

function PurchasePriceTrackingLoaded({
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen,
  purchases,
  products,
  suppliers,
  onPurchasePriceUpdated,
  currentUser,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
  onPurchasePriceUpdated: (id: string, unitPrice: number) => void;
  currentUser?: any;
}) {
  return (
    <PurchaseFiltersProvider purchases={purchases} products={products} suppliers={suppliers}>
      <div className="flex h-screen overflow-hidden bg-slate-50/50">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          FilterNode={
            <PurchaseFilterButton inSidebar={true} isCollapsed={!isSidebarOpen} />
          }
        />

        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-[90%] mx-auto">
              <div key={activeTab} className="animate-in fade-in zoom-in-[0.98] duration-500">
                <PurchasePriceTrackingContent
                  activeTab={activeTab}
                  onPurchasePriceUpdated={onPurchasePriceUpdated}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </PurchaseFiltersProvider>
  );
}

export default function PurchasePriceTrackingPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('product-history');
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  usePurchasePriceTrackingTabAudit(activeTab);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const user = getCurrentUserFromStorage();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const allowed = getAllowedModuleTabIds(currentUser, 'purchase-price-tracking', PURCHASE_PRICE_TAB_IDS);
    if (allowed.length > 0 && !allowed.includes(activeTab)) setActiveTab(allowed[0]);
  }, [currentUser, activeTab]);

  async function fetchData() {
    try {
      setIsLoading(true);
      setLoadError(null);

      const [purchasesData, suppliersData, productsData] = await Promise.all([
        fetchAllData(() =>
          bhs_supabase.from('web_Suppliers_Purchase').select('*').order('ID', { ascending: true }),
        ),
        fetchAllData(() =>
          bhs_supabase
            .from('bhs_SUPPLIERS')
            .select('"SUPPLIER ID", "SUPPLIER NAME"')
            .order('SUPPLIER ID', { ascending: true }),
        ),
        fetchAllData(() =>
          bhs_supabase
            .from('bhs_PRODUCTS')
            .select('"PRODUCT ID", "PRODUCT NAME", "PRODUCT BARCODE", "PRODUCT CATEGORY"')
            .order('PRODUCT ID', { ascending: true }),
        ),
      ]);

      const excludedProductNames = ['PACKAGING'];

      const filteredProductsData = productsData.filter((p: any) => {
        const name = p['PRODUCT NAME'] ? String(p['PRODUCT NAME']).trim().toUpperCase() : '';
        return !excludedProductNames.includes(name);
      });

      const allowedProductIds = new Set(
        filteredProductsData.map((p: any) => String(p['PRODUCT ID']).trim()),
      );

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

      setPurchases(mappedPurchases.filter((p) => p.unitPrice > 0));

      setSuppliers(
        suppliersData.map((s: any) => ({
          id: String(s['SUPPLIER ID'] || '').trim(),
          name: s['SUPPLIER NAME'] || 'Unknown Supplier',
        })),
      );

      setProducts(
        filteredProductsData.map((p: any) => ({
          id: String(p['PRODUCT ID'] || '').trim(),
          name: p['PRODUCT NAME'] || 'Unknown Product',
          barcode: p['PRODUCT BARCODE'] ? String(p['PRODUCT BARCODE']).trim() : undefined,
          category: p['PRODUCT CATEGORY'] ? String(p['PRODUCT CATEGORY']).trim() : undefined,
        })),
      );
    } catch (error) {
      console.error('Error fetching purchase tracking data:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load purchase tracking data');
    } finally {
      setIsLoading(false);
    }
  }

  if (loadError && !isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-slate-50/50">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
        />
        <main className="flex-1 flex items-center justify-center p-8">
          <TabFetchError
            message={loadError}
            onRetry={() => void fetchData()}
            isRetrying={isLoading}
            className="min-h-[360px]"
          />
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-slate-50/50">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
        />

        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-[90%] mx-auto">
              <LoadingSkeleton />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <PurchasePriceTrackingLoaded
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      purchases={purchases}
      products={products}
      suppliers={suppliers}
      onPurchasePriceUpdated={(id, unitPrice) => {
        setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, unitPrice } : p)));
      }}
      currentUser={currentUser}
    />
  );
}
