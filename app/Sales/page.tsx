'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import SalesOverviewTab from './Overview/OverviewTab';
import SalesTop10Tab from './Top10/Top10Tab';
import SalesCustomersTab from './Customers/CustomersTab';
import SalesCustomersComparisonTab from './Comparison/ComparisonTab';
import SalesInactiveCustomersTab from './InactiveCustomers/InactiveCustomersTab';
import SalesStatisticsTab from './Statistics/StatisticsTab';
import SalesReportsTab from './Reports/ReportsTab';
import SalesDailySalesTab from './DailySales/DailySalesTab';
import SalesProductsTab from './Products/ProductsTab';
import SalesCategoriesTab from './Categories/CategoriesTab';
import SalesStockReportTab from './StockReport/StockReportTab';
import SalesSidebar from './Utils/Sidebar';
import SalesTabPanel from './Shared/TabPanel';
import SalesTabLoader from './Shared/TabLoader';
import SalesSetCustomersTab from './SetCustomers/SetCustomersTab';
import SalesTargetsTab from './Targets/TargetsTab';
import { fetchUsersList } from '@/app/DataBase/Service/database_service';
import SalesNewListingsTab from './NewListings/NewListingsTab';
import { SalesFiltersProvider, SalesFilterButton } from './Model/SalesFilters';
import { SalesDataProvider } from '@/app/Sales/Context/SalesDataContext';
import { SalesRawDataBridge } from '@/app/Sales/Context/SalesRawDataBridge';
import { SalesRefreshBridge } from '@/app/Sales/Context/SalesRefreshBridge';

import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { SalesInvoice, hasSalesDataAccess } from '@/lib/supabase';
import { ArrowLeft, BarChart3, LogOut, User, FileUp, FileSpreadsheet, ChevronDown, AlertCircle, X, Users, Menu } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '@/app/Components/Notification';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import { getAllowedReportTableTabIds } from '@/app/Sales/Reports/ReportsTableTabs';
import { getAllowedSalesTabIds, isSalesTabAllowed } from '@/app/Sales/Utils/salesTabPermissions';
import { getCustomersList, getMyCustomersData, batchSaveCustomerMapping } from '@/app/Sales/Service/sales_customers_service';
import { getSalesMetadata } from '@/app/Sales/Service/sales_core_service';

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

        // Silently sync and update session from database to catch permission or role changes
        fetchUsersList()
          .then(data => {
            if (data?.users) {
              const fresh = data.users.find((u: any) => u.id === parsed.id || u.name === parsed.name);
              if (fresh) {
                const updatedUser = {
                  ...parsed,
                  role: fresh.role,
                  userAdmin: fresh.userAdmin,
                  salesDataAccess: fresh.salesDataAccess,
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

  const allowedReportTableTabIds = useMemo(
    () => getAllowedReportTableTabIds(currentUser?.role, currentUser),
    [currentUser?.role, currentUser?.name, currentUser?.userAdmin]
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

  const handleUploadMapping = async (mapping: Record<string, any>) => {
    if (!userHasSalesDataAccess) {
      toast.error('Only users with sales data access can upload customer mappings.');
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
      await batchSaveCustomerMapping(userId, mapping);
      console.log('Mapping synced successfully to DB');
    } catch (error) {
      console.error('Failed to sync mapping:', error);
      toast.error('Local mapping saved, but failed to sync to database.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userHasSalesDataAccess) return;

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
      const [uniqueCustomers, myCustomersResult] = await Promise.all([
        getCustomersList(),
        userId
          ? getMyCustomersData(userId)
          : Promise.resolve(null),
      ]);

      if (!uniqueCustomers || uniqueCustomers.length === 0) {
        toast.warning('No current customer data found to extract.');
        toast.dismiss('fetching_customers');
        return;
      }

      const mappingByCustomerId = new Map<string, Record<string, string>>();
      if (myCustomersResult) {
        (myCustomersResult || []).forEach((m: Record<string, string>) => {
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
        <SalesTabPanel tabId="sales-top10" activeTab={activeTab} isVisited={visitedTabs.has('sales-top10')}>
          <SalesTop10Tab userId={salesUserId} />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-customers" activeTab={activeTab} isVisited={visitedTabs.has('sales-customers')}>
          <SalesCustomersTab userId={salesUserId} onUploadMapping={handleUploadMapping} showCosts={showCosts} />
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
        <SalesTabPanel tabId="sales-reports" activeTab={activeTab} isVisited={visitedTabs.has('sales-reports')}>
          <SalesReportsTab
            userId={salesUserId}
            allowedReportTableTabIds={allowedReportTableTabIds}
            showCosts={showCosts}
          />
        </SalesTabPanel>
        <SalesTabPanel tabId="sales-targets" activeTab={activeTab} isVisited={visitedTabs.has('sales-targets')}>
          <SalesTargetsTab userId={salesUserId} />
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
        <SalesTabPanel tabId="sales-my-customers" activeTab={activeTab} isVisited={visitedTabs.has('sales-my-customers')}>
          <SalesSetCustomersTab userId={salesUserId} />
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
      <SalesDataProvider initialVersion={refreshTrigger}>
        <SalesRefreshBridge refreshTrigger={refreshTrigger}>
          <SalesRawDataBridge userId={salesUserId}>
      <div className="flex min-h-screen bg-white text-black">
        {/* Sidebar - Desktop */}
        <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0d1e16] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
          <SalesSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentUser={currentUser}
            lastUpdated={lastUpdated}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            onUploadClick={() => setIsUploadModalOpen(true)}
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
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0d1e16] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <SalesSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentUser={currentUser}
            lastUpdated={lastUpdated}
            isCollapsed={false}
            onToggleCollapse={() => { }}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            onUploadClick={() => setIsUploadModalOpen(true)}
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

      {/* UPLOAD/DOWNLOAD MODAL — sales managers only */}
      {userHasSalesDataAccess && isUploadModalOpen && (
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
          </SalesRawDataBridge>
        </SalesRefreshBridge>
      </SalesDataProvider>
    </SalesFiltersProvider>
  );
}

