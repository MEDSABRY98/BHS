'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

import InventoryProductsBalanceTab from './ProductsBalance/InventoryProductsBalanceTab';
import InventoryLocationMovementsTab from './LocationMovements/InventoryLocationMovementsTab';
import InventoryCategoryBalanceTab from './CategoryBalance/InventoryCategoryBalanceTab';
import InventoryProductOrdersTab from './CategoriesAnalysis/InventoryCategoriesTab';
import ReportsTab from './Reports/ReportsTab';
import InventorySidebar, { INVENTORY_ANALYSIS_TAB_IDS, type InventoryTabId } from './Utils/Sidebar';
import { getAllowedModuleTabIds } from '@/app/AdminControl/AdminControlTab';
import IADataBootstrap from './Utils/IADataBootstrap';
import { useInventoryTabAudit } from '@/app/Audit/Modules/InventoryTabAudit';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';

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
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [orderItems, setOrderItems] = useState<any[]>([]);

  useInventoryTabAudit(activeTab);

  useEffect(() => {
    if (!currentUser) return;
    const allowed = getAllowedModuleTabIds(currentUser, 'inventory', INVENTORY_ANALYSIS_TAB_IDS);
    if (allowed.length > 0 && !allowed.includes(activeTab)) {
      setActiveTab(allowed[0] as InventoryTabId);
      setMountedTabs((prev) => new Set(prev).add(allowed[0] as InventoryTabId));
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
        const allowed = getAllowedModuleTabIds(user, 'inventory', INVENTORY_ANALYSIS_TAB_IDS);
        if (allowed.length > 0 && !allowed.includes('products_balance')) {
          setActiveTab(allowed[0] as InventoryTabId);
          setMountedTabs(new Set([allowed[0] as InventoryTabId]));
        }
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
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    const allowed = getAllowedModuleTabIds(user, 'inventory', INVENTORY_ANALYSIS_TAB_IDS);
    if (allowed.length > 0 && !allowed.includes('products_balance')) {
      setActiveTab(allowed[0] as InventoryTabId);
      setMountedTabs(new Set([allowed[0] as InventoryTabId]));
    }
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
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <InventorySidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          currentUser={currentUser}
        />
      </aside>

      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <InventorySidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          currentUser={currentUser}
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
          <IADataBootstrap>
            {renderTabContent()}
          </IADataBootstrap>
        </div>
      </div>
    </div>
  );
}
