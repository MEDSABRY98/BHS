'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import SalesOverviewTab from './Components/SalesOverviewTab';
import SalesTop10Tab from './Components/SalesTop10Tab';
import SalesCustomersTab from './Components/SalesCustomersTab';
import SalesCustomersComparisonTab from './Components/SalesCustomersComparisonTab';
import SalesInactiveCustomersTab from './Components/SalesInactiveCustomersTab';
import SalesStatisticsTab from './Components/SalesStatisticsTab';
import SalesDailySalesTab from './Components/SalesDailySalesTab';
import SalesProductsTab from './Components/SalesProductsTab';
import SalesCategoriesTab from './Components/SalesCategoriesTab';
import SalesStockReportTab from './Components/SalesStockReportTab';
import SalesSidebar from './Components/SalesSidebar';
import SalesSetCustomersTab from './Components/SalesSetCustomersTab';
import SalesNewListingsTab from './Components/SalesNewListingsTab';

import Login from '@/app/Components/Login';
import Loading from '@/app/Components/Loading';
import { SalesInvoice } from '@/lib/supabase';;
import { ArrowLeft, BarChart3, LogOut, User, FileUp, FileSpreadsheet, ChevronDown, CheckCircle2, AlertCircle, Filter, RefreshCcw, LayoutGrid, Calendar, Users, MoreVertical, Layers, TrendingUp, X, RotateCcw, ShoppingBag, Tag, Search, Menu } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '@/app/Components/Notification';

// Modern Select Component
const ModernSelect = ({
  value,
  onChange,
  options,
  placeholder = "Select Option",
  className = ""
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[] | string[];
  placeholder?: string;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const formattedOptions = options.map(opt =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const filteredOptions = formattedOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = formattedOptions.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-500/20 transition-all text-sm flex items-center justify-between group text-left"
      >
        <span className={!value ? "text-slate-400 font-normal" : "truncate"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 group-hover:text-slate-600 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl pb-2 animate-in zoom-in-95 fade-in duration-200 overflow-hidden ring-1 ring-slate-100 flex flex-col">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50 sticky top-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500/40 transition-all"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto no-scrollbar scroll-smooth">
            {filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-5 py-3 text-left text-xs font-bold transition-all hover:bg-green-50 hover:text-green-600 ${value === opt.value ? 'bg-green-50 text-green-600' : 'text-slate-600'
                  }`}
              >
                <div className="flex items-center justify-between font-outfit">
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-5 py-8 text-xs text-slate-400 italic text-center">
                <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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

  const isSalesManager = useMemo(
    () => currentUser?.isSalesManager === true || currentUser?.isSalesManager === 'TRUE',
    [currentUser?.isSalesManager]
  );

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

  // ── Background Build (fire & forget) ─────────────────────────
  // Triggers a cache rebuild on Supabase Storage without blocking the UI.
  // The current data stays visible while the build runs in the background.
  const triggerBackgroundBuild = () => {
    fetch('/api/Sales/Build', { method: 'POST' })
      .then(r => r.json())
      .then(d => console.log(`🏗️ Background build done: ${d.rows} rows`))
      .catch(e => console.warn('⚠️ Background build error:', e));
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
        toast.success('Data refreshed! Rebuilding cache in background...');
        // Fire background build so next cold start is instant
        triggerBackgroundBuild();
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

  // Centralized Filters
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'all' | 'sales' | 'returns'>('all');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterMarket, setFilterMarket] = useState('');
  const [filterMerchandiser, setFilterMerchandiser] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  const [filterProductTag, setFilterProductTag] = useState('');



  // Inactive Customers Specific Filters
  const [inactiveDays, setInactiveDays] = useState('30');
  const [inactiveMinAmount, setInactiveMinAmount] = useState('');

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'mode' | 'timing' | 'product' | 'outreach' | 'advanced'>('mode');

  // Removed heavy local calculations (augmentedData, globallyFilteredData, uniqueValues useMemo)
  // These are now handled entirely by the Server API!

  const hasAnyFilter = useMemo(() => {
    return invoiceTypeFilter !== 'all' || filterYear || filterMonth || dateFrom || dateTo || filterArea || filterMarket || filterMerchandiser || filterSalesRep || filterProductTag;
  }, [invoiceTypeFilter, filterYear, filterMonth, dateFrom, dateTo, filterArea, filterMarket, filterMerchandiser, filterSalesRep]);

  const resetFilters = () => {
    setInvoiceTypeFilter('all');
    setFilterYear('');
    setFilterMonth('');
    setDateFrom('');
    setDateTo('');
    setFilterArea('');
    setFilterMarket('');
    setFilterMerchandiser('');
    setFilterSalesRep('');
    setFilterProductTag('');
    // Don't reset comparison/inactive defaults as they are usually stable settings
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

  const downloadTemplate = () => {
    const template = [
      ['CUSTOMER ID', 'CUSTOMER MAIN NAME', 'CUSTOMER SUB NAME', 'AREA', 'MARKETS', 'SALESREP', 'MERCHANDISER'],
      ['12345', 'Main Company', 'Branch A', 'Cairo', 'Main Market', 'Jane Smith', 'John Doe']
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Customer_Mapping_Template.xlsx');
  };

  const downloadTemplateWithData = async () => {
    toast.loading('Fetching customer data...', { id: 'fetching_customers' });
    try {
      const response = await fetch('/api/Sales/CustomersList');
      if (!response.ok) throw new Error('Failed to fetch customers');
      const result = await response.json();
      const uniqueCustomers = result.uniqueCustomers;

      if (!uniqueCustomers || uniqueCustomers.length === 0) {
        toast.warning('No current customer data found to extract.');
        toast.dismiss('fetching_customers');
        return;
      }
      const headers = ['CUSTOMER ID', 'CUSTOMER MAIN NAME', 'CUSTOMER SUB NAME', 'AREA', 'MARKETS', 'SALESREP', 'MERCHANDISER'];
      const rows = uniqueCustomers.map((c: any) => [c.id, c.mainName, c.subName, '', '', '', '']);
      const template = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(template);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data Template');
      XLSX.writeFile(wb, `Customer_Mapping_With_Data_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
      toast.success('Template downloaded successfully!');
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to download template with data.');
    } finally {
      toast.dismiss('fetching_customers');
    }
  };

  const allTabs = [
    { id: 'sales-overview', label: 'Overview' },
    { id: 'sales-top10', label: 'Top 10' },

    { id: 'sales-customers', label: 'Customers' },
    { id: 'sales-customers-comparison', label: 'Comparison' },
    { id: 'sales-inactive-customers', label: 'Inactive' },
    { id: 'sales-statistics', label: 'Statistics' },
    { id: 'sales-daily-sales', label: 'Daily Sales' },
    { id: 'sales-categories', label: 'Category' },
    { id: 'sales-products', label: 'Products' },
    { id: 'sales-new-listings', label: 'New Listings' },
    { id: 'sales-download-form', label: 'Stock Report' },
    { id: 'sales-my-customers', label: 'Set Customers' },
  ];

  const renderTabContent = () => {
    if (!salesUserId) {
      return <Loading fullScreen={false} />;
    }

    if (loading) {
      return <Loading fullScreen={false} />;
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

    const commonFilters = {
      invoiceType: invoiceTypeFilter,
      year: filterYear,
      month: filterMonth,
      dateFrom,
      dateTo,
      area: filterArea,
      market: filterMarket,
      merchandiser: filterMerchandiser,
      salesRep: filterSalesRep,
      productTag: filterProductTag
    };

    return (
      <div className="relative w-full">
        {visitedTabs.has('sales-overview') && (
          <div className={activeTab === 'sales-overview' ? 'block' : 'hidden'}>
            <SalesOverviewTab filters={commonFilters} userId={salesUserId} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-top10') && (
          <div className={activeTab === 'sales-top10' ? 'block' : 'hidden'}>
            <SalesTop10Tab filters={commonFilters} userId={salesUserId} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-customers') && (
          <div className={activeTab === 'sales-customers' ? 'block' : 'hidden'}>
            <SalesCustomersTab filters={commonFilters} userId={salesUserId} onUploadMapping={handleUploadMapping} showCosts={showCosts} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-customers-comparison') && (
          <div className={activeTab === 'sales-customers-comparison' ? 'block' : 'hidden'}>
            <SalesCustomersComparisonTab filters={commonFilters} userId={salesUserId} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-inactive-customers') && (
          <div className={activeTab === 'sales-inactive-customers' ? 'block' : 'hidden'}>
            <SalesInactiveCustomersTab filters={commonFilters} userId={salesUserId} days={inactiveDays as any} minAmount={inactiveMinAmount as any} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-statistics') && (
          <div className={activeTab === 'sales-statistics' ? 'block' : 'hidden'}>
            <SalesStatisticsTab filters={commonFilters} userId={salesUserId} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-daily-sales') && (
          <div className={activeTab === 'sales-daily-sales' ? 'block' : 'hidden'}>
            <SalesDailySalesTab filters={commonFilters} invoiceTypeFilter={invoiceTypeFilter} userId={salesUserId} showCosts={showCosts} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-products') && (
          <div className={activeTab === 'sales-products' ? 'block' : 'hidden'}>
            <SalesProductsTab filters={commonFilters} userId={salesUserId} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-new-listings') && (
          <div className={activeTab === 'sales-new-listings' ? 'block' : 'hidden'}>
            <SalesNewListingsTab filters={commonFilters} userId={salesUserId} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-categories') && (
          <div className={activeTab === 'sales-categories' ? 'block' : 'hidden'}>
            <SalesCategoriesTab filters={commonFilters} userId={salesUserId} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-download-form') && (
          <div className={activeTab === 'sales-download-form' ? 'block' : 'hidden'}>
            <SalesStockReportTab filters={commonFilters} userId={salesUserId} refreshTrigger={refreshTrigger} />
          </div>
        )}
        {visitedTabs.has('sales-my-customers') && (
          <div className={activeTab === 'sales-my-customers' ? 'block' : 'hidden'}>
            <SalesSetCustomersTab userId={salesUserId} refreshTrigger={refreshTrigger} />
          </div>
        )}
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
                {currentUser?.name === 'MED Sabry' && (
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

            {/* Middle Section: Display Active Tab Label */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-lg font-extrabold text-slate-800 tracking-tight">
                {allTabs.find(tab => tab.id === activeTab)?.label || 'Sales Analysis'}
              </span>
            </div>

            {/* Right Section: Filter */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsFilterOpen(true)}
                className={`group relative p-3 rounded-xl transition-all duration-300 border shadow-sm ${!hasAnyFilter
                  ? 'bg-white border-slate-200 text-slate-400 hover:border-green-200 hover:text-green-600 hover:bg-green-50'
                  : 'bg-green-600 border-green-700 text-white shadow-lg shadow-green-200'
                  }`}
                title="Open Global Filters"
              >
                <div className="flex items-center gap-2">
                  <Filter className={`w-5 h-5 transition-transform group-hover:scale-110 ${hasAnyFilter ? 'animate-pulse' : ''}`} />
                </div>
                {hasAnyFilter && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                )}
              </button>
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

      {/* GLOBAL FILTER MODAL */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsFilterOpen(false)}
          />
          <div className="relative w-full max-w-5xl h-[850px] bg-white rounded-[40px] shadow-2xl border border-white/20 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 flex flex-col overflow-hidden">

            {/* Modal Header */}
            <div className="bg-slate-50/80 backdrop-blur-sm px-10 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-green-600 rounded-[18px] flex items-center justify-center shadow-lg shadow-green-100">
                  <Filter className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Search & Filters</h3>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={resetFilters}
                  title="Reset All Filters"
                  className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  title="Apply Filters"
                  className="p-3 bg-green-600 text-white rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 hover:scale-[1.05] active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-6 h-6" />
                </button>
                <div className="w-[1px] h-8 bg-slate-200 mx-2"></div>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="p-3 hover:bg-slate-100 rounded-xl transition-colors group"
                >
                  <X className="w-6 h-6 text-slate-300 group-hover:text-slate-600 transition-colors" />
                </button>
              </div>
            </div>

            {/* Modal Body - Tabbed Interface */}
            <div className="flex flex-col flex-1 bg-white">
              {/* Tab Navigation */}
              <div className="px-10 py-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
                {[
                  { id: 'mode', label: 'Reporting Mode' },
                  { id: 'timing', label: 'Timing & Periods' },
                  { id: 'product', label: 'Product Category' },
                  { id: 'outreach', label: 'Team & Territory' },
                  ...(activeTab === 'sales-inactive-customers' ? [{ id: 'advanced', label: 'Comprehensive Filters' }] : [])
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilterTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center px-2 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeFilterTab === tab.id
                      ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 ring-4 ring-slate-900/10'
                      : 'text-slate-400 hover:bg-white hover:text-slate-600 border border-transparent hover:border-slate-100'
                      }`}
                  >
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-10 overflow-y-auto custom-scrollbar flex-1 min-h-[450px] relative">
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {activeFilterTab === 'mode' && (
                    <div className="space-y-8 h-full flex flex-col justify-center">
                      <div className="grid grid-cols-3 gap-6">
                        {[
                          { id: 'all', label: 'NET SALES' },
                          { id: 'sales', label: 'SALES ONLY' },
                          { id: 'returns', label: 'GRV ONLY' }
                        ].map((t) => (
                          <button
                            key={t.id}
                            disabled={isFiltering}
                            onClick={() => {
                              if (invoiceTypeFilter === t.id) return;
                              setIsFiltering(true);
                              // Give UI a frame to show the loader
                              setTimeout(() => {
                                setInvoiceTypeFilter(t.id as any);
                                setIsFiltering(false);
                              }, 100);
                            }}
                            className={`flex flex-col items-center justify-center gap-4 text-center p-8 rounded-[40px] transition-all border-2 h-44 w-full ${invoiceTypeFilter === t.id
                              ? 'bg-green-50/50 border-green-600 shadow-2xl shadow-green-100/50'
                              : 'bg-white border-slate-100 hover:border-slate-300'
                              } ${isFiltering ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center shadow-lg transition-all ${invoiceTypeFilter === t.id ? 'bg-green-600 text-white shadow-green-200' : 'bg-slate-50 text-slate-400'
                              }`}>
                              {t.id === 'all' ? <CheckCircle2 className="w-7 h-7" /> : t.id === 'sales' ? <Layers className="w-7 h-7" /> : <RefreshCcw className="w-7 h-7" />}
                            </div>
                            <p className={`font-black text-base uppercase tracking-[0.2em] ${invoiceTypeFilter === t.id ? 'text-green-700' : 'text-slate-800'}`}>
                              {t.label}
                            </p>
                          </button>
                        ))}
                      </div>

                      {/* Loading Overlay inside the tab content area */}
                      {isFiltering && (
                        <div className="absolute inset-0 z-[50] rounded-[40px] overflow-hidden">
                          <Loading fullScreen={false} message="Applying Mode..." className="!absolute !inset-0 !min-h-0" />
                        </div>
                      )}
                    </div>
                  )}

                  {activeFilterTab === 'timing' && (
                    <div className="space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                          <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Standard Period
                          </h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">Year</label>
                              <ModernSelect
                                value={filterYear}
                                onChange={setFilterYear}
                                options={uniqueValues.years}
                                placeholder="All Years"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">Month</label>
                              <ModernSelect
                                value={filterMonth}
                                onChange={setFilterMonth}
                                options={[
                                  { label: "All Months", value: "" },
                                  ...Array.from({ length: 12 }, (_, i) => ({
                                    label: new Date(2000, i).toLocaleString('en-US', { month: 'long' }),
                                    value: (i + 1).toString()
                                  }))
                                ]}
                                placeholder="All Months"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <TrendingUp className="w-3 h-3" /> Custom Interval
                          </h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">From Date</label>
                              <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-green-500/20 focus:ring-4 focus:ring-green-500/5 transition-all text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-300 uppercase tracking-widest ml-1">To Date</label>
                              <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-green-500/20 focus:ring-4 focus:ring-green-500/5 transition-all text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFilterTab === 'product' && (
                    <div className="space-y-10">
                      <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                        <div className="space-y-4">
                          <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Tag className="w-3 h-3" /> Product Category (Tag)
                          </h5>
                          <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Select Category</label>
                              <ModernSelect
                                value={filterProductTag}
                                onChange={setFilterProductTag}
                                options={[{ label: "All Categories", value: "" }, ...uniqueValues.productTags.map(v => ({ label: v, value: v }))]}
                                placeholder="All Categories"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFilterTab === 'outreach' && (
                    <div className="space-y-10">
                      <div className="grid grid-cols-2 gap-x-12 gap-y-8 bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Area</label>
                          <ModernSelect
                            value={filterArea}
                            onChange={setFilterArea}
                            options={[{ label: "All Areas", value: "" }, ...uniqueValues.areas.map(v => ({ label: v, value: v }))]}
                            placeholder="All Areas"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Market</label>
                          <ModernSelect
                            value={filterMarket}
                            onChange={setFilterMarket}
                            options={[{ label: "All Markets", value: "" }, ...uniqueValues.markets.map(v => ({ label: v, value: v }))]}
                            placeholder="All Markets"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Sales Rep</label>
                          <ModernSelect
                            value={filterSalesRep}
                            onChange={setFilterSalesRep}
                            options={[{ label: "All", value: "" }, ...uniqueValues.salesReps.map(v => ({ label: v, value: v }))]}
                            placeholder="All"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Merchandiser</label>
                          <ModernSelect
                            value={filterMerchandiser}
                            onChange={setFilterMerchandiser}
                            options={[{ label: "All", value: "" }, ...uniqueValues.merchandisers.map(v => ({ label: v, value: v }))]}
                            placeholder="All"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFilterTab === 'advanced' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">


                      {activeTab === 'sales-inactive-customers' && (
                        <div className="bg-orange-50/50 p-10 rounded-[44px] border border-orange-100/50">
                          <h4 className="flex items-center gap-3 text-sm font-black text-orange-400 uppercase tracking-[0.3em] mb-10">
                            <span className="w-12 h-[2px] bg-orange-200"></span> Inactivity Logic
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tolerance Threshold (Days)</label>
                              <input type="number" value={inactiveDays} onChange={e => setInactiveDays(e.target.value)} placeholder="e.g. 30" className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none shadow-sm focus:ring-4 focus:ring-orange-500/5 transition-all" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Minimum Revenue Filter (AED)</label>
                              <input type="number" value={inactiveMinAmount} onChange={e => setInactiveMinAmount(e.target.value)} placeholder="e.g. 500" className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none shadow-sm focus:ring-4 focus:ring-orange-500/5 transition-all" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

