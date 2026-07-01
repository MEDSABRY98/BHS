'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import SalesOverviewTab from './Components/SalesOverviewTab';
import SalesTop10Tab from './Components/SalesTop10Tab';
import SalesCustomersTab from './Components/SalesCustomersTab';
import SalesCustomersComparisonTab from './Components/SalesCustomersComparisonTab';
import SalesInactiveCustomersTab from './Components/SalesInactiveCustomersTab';
import SalesStatisticsTab from './Components/SalesStatisticsTab';
import SalesReportsTab from './Components/SalesReportsTab';
import SalesDailySalesTab from './Components/SalesDailySalesTab';
import SalesProductsTab from './Components/SalesProductsTab';
import SalesCategoriesTab from './Components/SalesCategoriesTab';
import SalesStockReportTab from './Components/SalesStockReportTab';
import SalesSidebar from './Components/SalesSidebar';
import SalesTabPanel from './Components/SalesTabPanel';
import SalesTabLoader from './Components/SalesTabLoader';
import SalesSetCustomersTab from './Components/SalesSetCustomersTab';
import SalesTargetsTab from './Components/SalesTargetsTab';
import SalesNewListingsTab from './Components/SalesNewListingsTab';
import { SalesFiltersProvider, SalesFilterButton } from './Model/SalesFilters';

import Login from '@/app/Components/Login';
import Loading from '@/app/Components/Loading';
import { SalesInvoice } from '@/lib/supabase';;
import { ArrowLeft, BarChart3, LogOut, User, FileUp, FileSpreadsheet, ChevronDown, AlertCircle, RefreshCcw, X, Users, Menu } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '@/app/Components/Notification';
import { exportSalesExcelTable } from '@/app/Sales/Export/SalesExcelExport';

const MAPPING_EXPORT_HEADERS = [
  'CUSTOMER ID',
  'CUSTOMER MAIN NAME',
  'CUSTOMER SUB NAME',
  'AREA',
  'MARKETS',
  'SALESREP',
  'MERCHANDISER',
] as const;

export default function SalesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('sales-overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['sales-overview']));
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [uniqueValues, setUniqueValues] = useState({
    areas: [] as string[],
    markets: [] as string[],
    merchandisers: [] as string[],
    salesReps: [] as string[],
    productTags: [] as string[],
    years: [] as string[]
  });
  const [customerMapping, setCustomerMapping] = useState<Record<string, any>>({});
  const mainContentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

        // Silently sync and update session from database to catch changes in isSalesManager or roles
        fetch('/DataBase/Users/api')
          .then(r => r.json())
          .then(data => {
            if (data?.users) {
              const fresh = data.users.find((u: any) => u.id === parsed.id || u.name === parsed.name);
              if (fresh) {
                const updatedUser = {
                  ...parsed,
                  role: fresh.role,
                  userAdmin: fresh.userAdmin,
                  isSalesManager: fresh.isSalesManager
                };
                setCurrentUser(updatedUser);
                localStorage.setItem('currentUser', JSON.stringify(updatedUser));
              }
            }
          })
          .catch(err => console.warn('Failed to auto-refresh user session:', err));
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
    if (currentUser) {
      const isManager = currentUser.name === 'MED Sabry' || currentUser.isSalesManager === true || currentUser.isSalesManager === 'TRUE';
      if (!isManager) {
        try {
          const perms = JSON.parse(currentUser.role || '{}');
          const allowedTabs = perms.sales;

          if (allowedTabs && Array.isArray(allowedTabs)) {
            if (!allowedTabs.includes(activeTab)) {
              if (allowedTabs.length > 0) {
                setActiveTab(allowedTabs[0]);
              }
            }
          }
        } catch (e) { }
      }
    }
  }, [currentUser, activeTab]);

  const salesUserId = useMemo(
    () => String(currentUser?.id || '').trim(),
    [currentUser?.id]
  );

  const isSalesManager = useMemo(() => {
    const userName = currentUser?.name?.trim().toLowerCase() || '';
    return (
      userName === 'med sabry' ||
      currentUser?.isSalesManager === true ||
      currentUser?.isSalesManager === 'TRUE'
    );
  }, [currentUser?.name, currentUser?.isSalesManager]);

  const showCosts = useMemo(() => {
    const userName = currentUser?.name?.toLowerCase() || '';
    const isManager = userName === 'med sabry' || currentUser?.isSalesManager === true || currentUser?.isSalesManager === 'TRUE';
    if (isManager) return true;
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
  }, [currentUser]);

  // Reset scroll position and track visited tabs when tab changes
  useEffect(() => {
    setVisitedTabs(prev => new Set([...prev, activeTab]));
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

  const fetchData = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else setLoading(true);

      const userId = salesUserId;

      if (!userId) {
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      const response = await fetch('/api/Sales/Metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, forceRefresh: silent })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to fetch metadata');
      }

      setUniqueValues(result.uniqueValues);
      setLastUpdated(result.lastUpdated);

      if (silent) {
        setRefreshTrigger(prev => prev + 1);
        toast.success('Sales data and cache refreshed successfully.');
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching sales metadata:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleUploadMapping = async (mapping: Record<string, any>) => {
    if (!isSalesManager) {
      toast.error('Only sales managers can upload customer mappings.');
      return;
    }

    // Save locally for immediate UI update
    setCustomerMapping(mapping);
    localStorage.setItem('salesCustomerMapping', JSON.stringify(mapping));

    const userId = salesUserId;

    if (!userId) {
      toast.error('User ID is missing. Please log in again.');
      return;
    }

    try {
      const response = await fetch('/api/Sales/Mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, mapping }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync mapping with database');
      }
      console.log('Mapping synced successfully to DB');
    } catch (error) {
      console.error('Failed to sync mapping:', error);
      toast.error('Local mapping saved, but failed to sync to database.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSalesManager) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const bstr = event.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const dataRows = XLSX.utils.sheet_to_json(ws) as any[];

      const mapping: Record<string, any> = {};
      dataRows.forEach(rawRow => {
        // Normalize keys to uppercase and trim spaces
        const row: Record<string, any> = {};
        Object.keys(rawRow).forEach(key => {
          row[key.toString().trim().toUpperCase()] = rawRow[key];
        });

        const id = row['CUSTOMER ID']?.toString().trim();
        if (id) {
          mapping[id] = {
            customerMainName: row['CUSTOMER MAIN NAME']?.toString().trim() || '',
            customerName: row['CUSTOMER SUB NAME']?.toString().trim() || '',
            area: row['AREA']?.toString().trim() || '',
            market: row['MARKETS']?.toString().trim() || '',
            merchandiser: row['MERCHANDISER']?.toString().trim() || '',
            salesRep: row['SALESREP']?.toString().trim() || '',
          };
        }
      });

      toast.loading('Saving and syncing mapping to database...', { id: 'mapping_upload' });
      await handleUploadMapping(mapping);
      toast.dismiss('mapping_upload');
      toast.success('Customer data uploaded and synced successfully!');

      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = async () => {
    const rows = [['12345', 'Main Company', 'Branch A', 'Cairo', 'Main Market', 'Jane Smith', 'John Doe']];
    await exportSalesExcelTable(
      [...MAPPING_EXPORT_HEADERS],
      rows,
      'Customer_Mapping_Template.xlsx',
      { sheetName: 'Template' }
    );
  };

  const downloadTemplateWithData = async () => {
    toast.loading('Fetching customer data...', { id: 'fetching_customers' });
    try {
      const userId = salesUserId;
      const [customersRes, mappingRes] = await Promise.all([
        fetch('/api/Sales/CustomersList'),
        userId
          ? fetch(`/api/Sales/MyCustomers?userId=${encodeURIComponent(userId)}`)
          : Promise.resolve(null),
      ]);

      if (!customersRes.ok) throw new Error('Failed to fetch customers');
      const result = await customersRes.json();
      const uniqueCustomers = result.uniqueCustomers;

      if (!uniqueCustomers || uniqueCustomers.length === 0) {
        toast.warning('No current customer data found to extract.');
        toast.dismiss('fetching_customers');
        return;
      }

      const mappingByCustomerId = new Map<string, Record<string, string>>();
      if (mappingRes?.ok) {
        const mappingResult = await mappingRes.json();
        (mappingResult.data || []).forEach((m: Record<string, string>) => {
          const id = String(m['CUSTOMER ID'] || m.ID || '').trim();
          if (id) mappingByCustomerId.set(id, m);
        });
      }

      const rows = uniqueCustomers.map((c: { id: string; mainName: string; subName: string }) => {
        const mapping = mappingByCustomerId.get(String(c.id).trim());
        return [
          c.id,
          c.mainName,
          c.subName,
          mapping?.['AREA'] || '',
          mapping?.['MARKET'] || '',
          mapping?.['SALES_REP'] || '',
          mapping?.['MERCHANDISER'] || '',
        ];
      });

      const fileName = `Customer_Mapping_With_Data_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`;
      await exportSalesExcelTable([...MAPPING_EXPORT_HEADERS], rows, fileName, {
        sheetName: 'Data Template',
      });
      toast.success('Template downloaded successfully!');
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to download template with data.');
    } finally {
      toast.dismiss('fetching_customers');
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
        <div className="flex items-center justify-center h-screen">
          <div className="text-center bg-red-50 p-6 rounded-lg">
            <p className="text-red-600 text-lg mb-4">Error loading sales data</p>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => fetchData()}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    // Check for dynamic JSON permission structure
    try {
      const isManager = currentUser?.name === 'MED Sabry' || currentUser?.isSalesManager === true || currentUser?.isSalesManager === 'TRUE';
      if (!isManager && currentUser?.role) {
        const perms = JSON.parse(currentUser.role);
        if (perms.sales && Array.isArray(perms.sales)) {
          if (!perms.sales.includes(activeTab)) {
            return <div className="p-20 text-center text-slate-400 font-bold">You don't have permission to view this section.</div>;
          }
        }
      }
    } catch (e) { }

    return (
      <div className="relative w-full">
        <SalesTabPanel tabId="sales-overview" activeTab={activeTab} isVisited={visitedTabs.has('sales-overview')}>
          <SalesOverviewTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-top10" activeTab={activeTab} isVisited={visitedTabs.has('sales-top10')}>
          <SalesTop10Tab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-customers" activeTab={activeTab} isVisited={visitedTabs.has('sales-customers')}>
          <SalesCustomersTab userId={salesUserId} onUploadMapping={handleUploadMapping} showCosts={showCosts} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-customers-comparison" activeTab={activeTab} isVisited={visitedTabs.has('sales-customers-comparison')}>
          <SalesCustomersComparisonTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-inactive-customers" activeTab={activeTab} isVisited={visitedTabs.has('sales-inactive-customers')}>
          <SalesInactiveCustomersTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-statistics" activeTab={activeTab} isVisited={visitedTabs.has('sales-statistics')}>
          <SalesStatisticsTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-reports" activeTab={activeTab} isVisited={visitedTabs.has('sales-reports')}>
          <SalesReportsTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-targets" activeTab={activeTab} isVisited={visitedTabs.has('sales-targets')}>
          <SalesTargetsTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-daily-sales" activeTab={activeTab} isVisited={visitedTabs.has('sales-daily-sales')}>
          <SalesDailySalesTab userId={salesUserId} showCosts={showCosts} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-products" activeTab={activeTab} isVisited={visitedTabs.has('sales-products')}>
          <SalesProductsTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-new-listings" activeTab={activeTab} isVisited={visitedTabs.has('sales-new-listings')}>
          <SalesNewListingsTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-categories" activeTab={activeTab} isVisited={visitedTabs.has('sales-categories')}>
          <SalesCategoriesTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-download-form" activeTab={activeTab} isVisited={visitedTabs.has('sales-download-form')}>
          <SalesStockReportTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-my-customers" activeTab={activeTab} isVisited={visitedTabs.has('sales-my-customers')}>
          <SalesSetCustomersTab userId={salesUserId} refreshTrigger={refreshTrigger} />
        </SalesTabPanel>
      </div>
    );
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <SalesFiltersProvider uniqueValues={uniqueValues} activeTab={activeTab}>
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0d1e16] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <SalesSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          lastUpdated={lastUpdated}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0d1e16] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <SalesSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          lastUpdated={lastUpdated}
          isCollapsed={false}
          onToggleCollapse={() => { }}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
          <div className="max-w-[98%] mx-auto px-4 py-3 flex items-center justify-between gap-4 min-h-[5rem]">
            {/* Left section: Hamburger for Mobile, Upload/Refresh for Desktop */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2.5 text-slate-600 hover:text-slate-900 lg:hidden rounded-xl hover:bg-slate-100 transition-all"
                title="Open Navigation Menu"
              >
                <Menu className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-3">
                {isSalesManager && (
                  <>
                    {/* Upload Modal Trigger — sales managers only */}
                    <div
                      onClick={() => setIsUploadModalOpen(true)}
                      className="bg-gradient-to-br from-green-600 to-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-green-200 cursor-pointer active:scale-95 transition-transform hover:rotate-3"
                      title="Upload / Download Templates"
                    >
                      <BarChart3 className="w-6 h-6" />
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".xlsx, .xls"
                      className="hidden"
                    />
                  </>
                )}

                {/* Refresh Data Button */}
                {isSalesManager && (
                  <button
                    onClick={() => fetchData(true)}
                    disabled={loading || isRefreshing}
                    className={`p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-green-600 hover:border-green-200 hover:bg-green-50 transition-all ${loading || isRefreshing ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}
                    title="Refresh Data"
                  >
                    <RefreshCcw className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Section: Filter */}
            <div className="flex items-center gap-3">
              <SalesFilterButton />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
          <main ref={mainContentRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-8rem)] p-8">
            {renderTabContent()}
          </main>
        </div>
      </div>

      {/* UPLOAD/DOWNLOAD MODAL — sales managers only */}
      {isSalesManager && isUploadModalOpen && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsUploadModalOpen(false)}
          />
          <div className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 overflow-hidden">
            <div className="bg-slate-50/80 backdrop-blur-sm px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-100">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Customer Data Management</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors group"
              >
                <X className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
              </button>
            </div>

            <div className="p-8 space-y-4">
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center justify-between p-5 bg-green-50/50 hover:bg-green-50 border border-green-100 hover:border-green-200 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-green-600 group-hover:scale-110 transition-transform">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900">Upload Excel File</p>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-400 -rotate-90" />
              </button>

              <button
                onClick={() => {
                  downloadTemplate();
                  setIsUploadModalOpen(false);
                }}
                className="w-full flex items-center justify-between p-5 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 hover:border-blue-200 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900">Download Blank Template</p>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-400 -rotate-90" />
              </button>

              <button
                onClick={() => {
                  downloadTemplateWithData();
                  setIsUploadModalOpen(false);
                }}
                className="w-full flex items-center justify-between p-5 bg-orange-50/50 hover:bg-orange-50 border border-orange-100 hover:border-orange-200 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-orange-600 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900">Download Template with Data</p>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-400 -rotate-90" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
    </SalesFiltersProvider>
  );
}

