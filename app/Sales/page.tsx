'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import SalesOverviewTab from './Overview/OverviewTab';
import SalesPeriodsTab from './Periods/PeriodsTab';
import SalesTop10Tab from './Top10/Top10Tab';
import SalesCustomersTab from './Customers/CustomersTab';
import SalesCustomersComparisonTab from './Comparison/ComparisonTab';
import SalesInactiveCustomersTab from './InactiveCustomers/InactiveCustomersTab';
import SalesStatisticsTab from './Statistics/StatisticsTab';
import SalesDailySalesTab from './DailySales/DailySalesTab';
import SalesProductsTab from './Products/ProductsTab';
import SalesCategoriesTab from './Categories/CategoriesTab';
import SalesStockReportTab from './StockReport/StockReportTab';
import SalesSidebar from './Utils/Sidebar';
import SalesTabPanel from './Shared/TabPanel';
import SalesTabLoader from './Shared/TabLoader';

import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import SalesNewListingsTab from './NewListings/NewListingsTab';
import { SalesFiltersProvider, SalesFilterButton } from './Model/SalesFilters';
import { SalesDataProvider } from '@/app/Sales/Context/SalesDataContext';
import { SalesRawDataBridge } from '@/app/Sales/Context/SalesRawDataBridge';
import { SalesRefreshBridge } from '@/app/Sales/Context/SalesRefreshBridge';

import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { SalesInvoice, hasSalesDataAccess } from '@/lib/supabase';
import { ArrowLeft, BarChart3, LogOut, User, FileSpreadsheet, AlertCircle, X, Users, Menu } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { exportSalesExcelTable } from '@/app/Sales/Export/ExcelExport';
import { getAllowedSalesTabIds, isSalesTabAllowed } from '@/app/Sales/Utils/salesTabPermissions';
import { getCustomersList, getMyCustomersData, batchSaveCustomerMapping } from '@/app/Sales/Service/sales_customers_service';
import { syncAndGetSalesData, getLocalSalesData } from '@/app/Sales/Cache/SalesSyncService';
import { getSalesMetadata } from '@/app/Sales/Service/sales_core_service';
import { trackSalesTab } from '@/app/Audit/Model/SalesTabAudit';

export default function SalesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('sales-overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['sales-overview']));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [uniqueValues, setUniqueValues] = useState({
    areas: [] as string[],
    markets: [] as string[],
    merchandisers: [] as string[],
    salesReps: [] as string[],
    productTags: [] as string[],
    products: [] as string[],
    productCategoryByName: {} as Record<string, string>,
    customerMainNames: [] as string[],
    customerSubNames: [] as string[],
    customerTags: [] as string[],
    customerClasses: [] as string[],
    years: [] as string[]
  });
  const [customerMapping, setCustomerMapping] = useState<Record<string, any>>({});
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  useSyncLiveUser(setCurrentUser);

  // Load sidebar collapsed state on mount
  useEffect(() => {
    const stored = localStorage.getItem('salesSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('salesSidebarCollapsed', String(nextState));
  };

  // Load mapping from localStorage on mount
  useEffect(() => {
    const savedMapping = localStorage.getItem('salesCustomerMapping');
    if (savedMapping) {
      try {
        setCustomerMapping(JSON.parse(savedMapping));
      } catch (e) {
        console.error('Error parsing customer mapping:', e);
      }
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('currentUser');
      } finally {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentUser?.id) {
      fetchData();
      setRefreshTrigger(prev => prev + 1);
    }
  }, [isAuthenticated, currentUser?.id]);

  // Enforce subtab permissions
  useEffect(() => {
    if (!currentUser) return;

    const allowedTabs = getAllowedSalesTabIds(currentUser);
    if (allowedTabs.length === 0) return;

    if (!allowedTabs.includes(activeTab as typeof allowedTabs[number])) {
      setActiveTab(allowedTabs[0]);
    }
  }, [currentUser, activeTab]);

  const salesUserId = useMemo(
    () => String(currentUser?.id || '').trim(),
    [currentUser?.id]
  );

  const userHasSalesDataAccess = useMemo(
    () => hasSalesDataAccess(currentUser),
    [currentUser]
  );


  const showCosts = useMemo(() => {
    if (userHasSalesDataAccess) return true;
    try {
      const roleStr = currentUser?.role || '';
      if (!roleStr) return true;
      if (roleStr === 'Admin') return true;
      const perms = JSON.parse(roleStr);
      if (perms['sales-actions'] !== undefined) {
        return perms['sales-actions'].includes('view-costs');
      }
    } catch (e) { }
    return true; // default to true
  }, [currentUser, userHasSalesDataAccess]);

  // Reset scroll position and track visited tabs when tab changes
  useEffect(() => {
    setVisitedTabs(prev => new Set([...prev, activeTab]));
    trackSalesTab(activeTab);
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userPassword');
    setActiveTab('sales-overview');
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const userId = salesUserId;

      if (!userId) {
        setLoading(false);
        return;
      }

      const result = await getSalesMetadata(userId, false);

      setUniqueValues(result.uniqueValues);
      setLastUpdated(result.lastUpdated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching sales metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!salesUserId) return;
    try {
      toast.loading('Refreshing sales data...', { id: 'sales_refresh' });
      await syncAndGetSalesData(salesUserId);
      const result = await getSalesMetadata(salesUserId, true);
      setUniqueValues(result.uniqueValues);
      setLastUpdated(result.lastUpdated);
      setRefreshTrigger(prev => prev + 1);
      toast.success('Data refreshed successfully');
    } catch (err) {
      console.error('Error refreshing data:', err);
      toast.error('Failed to refresh data');
    } finally {
      toast.dismiss('sales_refresh');
    }
  };

  const renderTabContent = () => {
    if (!salesUserId) {
      return <SalesTabLoader />;
    }

    if (loading) {
      return <SalesTabLoader />;
    }

    if (error) {
      return (
        <TabFetchError
          message={error}
          onRetry={() => fetchData()}
          isRetrying={loading}
          className="min-h-screen"
        />
      );
    }

    if (!isSalesTabAllowed(currentUser, activeTab)) {
      return <div className="p-20 text-center text-slate-400 font-bold">You don&apos;t have permission to view this section.</div>;
    }

    return (
      <div className="relative w-full">
        <SalesTabPanel tabId="sales-overview" activeTab={activeTab} isVisited={visitedTabs.has('sales-overview')}>
          <SalesOverviewTab userId={salesUserId} showCosts={showCosts} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-periods" activeTab={activeTab} isVisited={visitedTabs.has('sales-periods')}>
          <SalesPeriodsTab userId={salesUserId} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-top10" activeTab={activeTab} isVisited={visitedTabs.has('sales-top10')}>
          <SalesTop10Tab userId={salesUserId} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-customers" activeTab={activeTab} isVisited={visitedTabs.has('sales-customers')}>
          <SalesCustomersTab userId={salesUserId} showCosts={showCosts} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-customers-comparison" activeTab={activeTab} isVisited={visitedTabs.has('sales-customers-comparison')}>
          <SalesCustomersComparisonTab userId={salesUserId} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-inactive-customers" activeTab={activeTab} isVisited={visitedTabs.has('sales-inactive-customers')}>
          <SalesInactiveCustomersTab userId={salesUserId} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-statistics" activeTab={activeTab} isVisited={visitedTabs.has('sales-statistics')}>
          <SalesStatisticsTab userId={salesUserId} showCosts={showCosts} />
        </SalesTabPanel>
        
        <SalesTabPanel tabId="sales-daily-sales" activeTab={activeTab} isVisited={visitedTabs.has('sales-daily-sales')}>
          <SalesDailySalesTab userId={salesUserId} showCosts={showCosts} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-products" activeTab={activeTab} isVisited={visitedTabs.has('sales-products')}>
          <SalesProductsTab userId={salesUserId} showCosts={showCosts} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-new-listings" activeTab={activeTab} isVisited={visitedTabs.has('sales-new-listings')}>
          <SalesNewListingsTab userId={salesUserId} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-categories" activeTab={activeTab} isVisited={visitedTabs.has('sales-categories')}>
          <SalesCategoriesTab userId={salesUserId} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-download-form" activeTab={activeTab} isVisited={visitedTabs.has('sales-download-form')}>
          <SalesStockReportTab userId={salesUserId} showCosts={showCosts} />
        </SalesTabPanel>
      </div>
    );
  };

  if (isChecking) {
    return <MainLoader />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <SalesFiltersProvider uniqueValues={uniqueValues} activeTab={activeTab}>
      <SalesDataProvider initialVersion={refreshTrigger}>
        <SalesRefreshBridge refreshTrigger={refreshTrigger}>
          <SalesRawDataBridge userId={salesUserId}>
      <div className="flex min-h-screen bg-white text-black">
        {/* Sidebar - Desktop */}
        <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
          <SalesSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentUser={currentUser}
            lastUpdated={lastUpdated}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            onRefresh={handleRefresh}
            hasSalesDataAccess={userHasSalesDataAccess}
            FilterNode={<SalesFilterButton inSidebar={true} isCollapsed={isSidebarCollapsed} />}
          />
        </aside>

        {/* Floating Mobile Menu Button */}
        {!isMobileSidebarOpen && (
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="lg:hidden fixed bottom-6 right-6 z-40 bg-green-600 text-white p-3 rounded-full shadow-xl shadow-green-900/20"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}

        {/* Mobile Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <SalesSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentUser={currentUser}
            lastUpdated={lastUpdated}
            isCollapsed={false}
            onToggleCollapse={() => { }}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            onRefresh={handleRefresh}
            hasSalesDataAccess={userHasSalesDataAccess}
            FilterNode={<SalesFilterButton inSidebar={true} isCollapsed={false} />}
          />
        </aside>

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
          {/* Main Content */}
          <main ref={mainContentRef} className="flex-1 w-full max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {renderTabContent()}
          </main>
        </div>

    </div>
          </SalesRawDataBridge>
        </SalesRefreshBridge>
      </SalesDataProvider>
    </SalesFiltersProvider>
  );
}

