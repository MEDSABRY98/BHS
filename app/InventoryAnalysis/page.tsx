'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

import InventoryProductsBalanceTab from './ProductsBalance/InventoryProductsBalanceTab';
import InventoryLocationMovementsTab from './LocationMovements/InventoryLocationMovementsTab';
import InventoryCategoryBalanceTab from './CategoryBalance/InventoryCategoryBalanceTab';
import InventoryProductOrdersTab from './CategoriesAnalysis/InventoryCategoriesTab';
import ReportsTab from './Reports/ReportsTab';
import InventorySidebar, { type InventoryTabId } from './Utils/Sidebar';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';

function TabPanel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div className={active ? undefined : 'hidden'} aria-hidden={!active}>
      {children}
    </div>
  );
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<InventoryTabId>('products_balance');
  const [mountedTabs, setMountedTabs] = useState<Set<InventoryTabId>>(
    () => new Set(['products_balance']),
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [orderItems, setOrderItems] = useState<any[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        JSON.parse(savedUser);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('currentUser');
      } finally {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('inventorySidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('inventorySidebarCollapsed', String(nextState));
  };

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const renderTabContent = () => (
    <>
      {mountedTabs.has('products_balance') && (
        <TabPanel active={activeTab === 'products_balance'}>
          <InventoryProductsBalanceTab />
        </TabPanel>
      )}
      {mountedTabs.has('location_movements') && (
        <TabPanel active={activeTab === 'location_movements'}>
          <InventoryLocationMovementsTab />
        </TabPanel>
      )}
      {mountedTabs.has('category_balance') && (
        <TabPanel active={activeTab === 'category_balance'}>
          <InventoryCategoryBalanceTab />
        </TabPanel>
      )}
      {mountedTabs.has('categories') && (
        <TabPanel active={activeTab === 'categories'}>
          <InventoryProductOrdersTab orderItems={orderItems} setOrderItems={setOrderItems} />
        </TabPanel>
      )}
      {mountedTabs.has('reports') && (
        <TabPanel active={activeTab === 'reports'}>
          <ReportsTab />
        </TabPanel>
      )}
    </>
  );

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0f172a] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <InventorySidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0f172a] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <InventorySidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <div className="lg:hidden p-4 flex items-center bg-white border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-bold text-slate-800">Inventory Analysis</span>
        </div>

        <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
