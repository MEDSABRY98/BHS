'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import SalesOverviewTab from '@/components/SalesOverviewTab';
import SalesTop10Tab from '@/components/SalesTop10Tab';
import SalesCustomersTab from '@/components/SalesCustomersTab';
import SalesInactiveCustomersTab from '@/components/SalesInactiveCustomersTab';
import SalesStatisticsTab from '@/components/SalesStatisticsTab';
import SalesDailySalesTab from '@/components/SalesDailySalesTab';
import SalesProductsTab from '@/components/SalesProductsTab';
import SalesStockReportTab from '@/components/SalesStockReportTab';

import Login from '@/components/Login';
import Loading from '@/components/Loading';
import { SalesInvoice } from '@/lib/googleSheets';
import { ArrowLeft, BarChart3, LogOut, User, FileUp, FileSpreadsheet, ChevronUp, ChevronDown, CheckCircle2, AlertCircle, Filter, RefreshCcw, LayoutGrid, Calendar, Users, MoreVertical, Layers, TrendingUp, X, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';

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

  const formattedOptions = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const selectedOption = formattedOptions.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-500/20 transition-all text-xs flex items-center justify-between group text-left"
      >
        <span className={!value ? "text-slate-400 font-normal" : "truncate"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 group-hover:text-slate-600 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl py-2 animate-in zoom-in-95 fade-in duration-200 overflow-hidden max-h-60 overflow-y-auto no-scrollbar ring-1 ring-slate-100">
          {formattedOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full px-5 py-3 text-left text-xs font-bold transition-all hover:bg-green-50 hover:text-green-600 ${
                value === opt.value ? 'bg-green-50 text-green-600' : 'text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{opt.label}</span>
                {value === opt.value && <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>
            </button>
          ))}
          {formattedOptions.length === 0 && (
            <div className="px-5 py-3 text-xs text-slate-400 italic text-center">No options available</div>
          )}
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
  const [data, setData] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [customerMapping, setCustomerMapping] = useState<Record<string, any>>({});
  const mainContentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

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
        setCurrentUser(JSON.parse(savedUser));
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
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Enforce subtab permissions
  useEffect(() => {
    if (currentUser && currentUser.name !== 'MED Sabry') {
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
  }, [currentUser, activeTab]);

  // Reset scroll position when tab changes
  useEffect(() => {
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
      const response = await fetch('/api/sales');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to fetch sales data');
      }

      setData(result.data);

      // Find the latest date from INVOICE DATE column
      if (result.data && result.data.length > 0) {
        const dates = result.data
          .map((row: SalesInvoice) => row.invoiceDate ? new Date(row.invoiceDate).getTime() : 0)
          .filter((time: number) => !isNaN(time) && time > 0);

        if (dates.length > 0) {
          const maxDate = new Date(Math.max(...dates));
          setLastUpdated(maxDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }));
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching sales data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleUploadMapping = (mapping: Record<string, any>) => {
    setCustomerMapping(mapping);
    localStorage.setItem('salesCustomerMapping', JSON.stringify(mapping));
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



  // Inactive Customers Specific Filters
  const [inactiveDays, setInactiveDays] = useState('30');
  const [inactiveMinAmount, setInactiveMinAmount] = useState('');

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'mode' | 'timing' | 'outreach' | 'advanced'>('mode');

  // Augmented data based on customer mapping
  const augmentedData = useMemo(() => {
    if (Object.keys(customerMapping).length === 0) return data;

    return data.map(item => {
      const mapping = customerMapping[item.customerId];
      if (mapping) {
        return {
          ...item,
          customerMainName: mapping.customerMainName || item.customerMainName,
          customerName: mapping.customerName || item.customerName,
          area: mapping.area || item.area,
          market: mapping.market || item.market,
          merchandiser: mapping.merchandiser || item.merchandiser,
          salesRep: mapping.salesRep || item.salesRep,
        };
      }
      return item;
    });
  }, [data, customerMapping]);

  // Apply Comprehensive Global Filtering
  const globallyFilteredData = useMemo(() => {
    let filtered = [...augmentedData];

    // 1. Invoice Type Filter
    if (invoiceTypeFilter !== 'all') {
      filtered = filtered.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceTypeFilter === 'sales') return num.startsWith('SAL');
        if (invoiceTypeFilter === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }

    // 2. Year filter
    if (filterYear.trim()) {
      const yearNum = parseInt(filterYear.trim(), 10);
      if (!isNaN(yearNum)) {
        filtered = filtered.filter(item => {
          if (!item.invoiceDate) return false;
          const d = new Date(item.invoiceDate);
          return !isNaN(d.getTime()) && d.getFullYear() === yearNum;
        });
      }
    }

    // 3. Month filter
    if (filterMonth.trim()) {
      const monthNum = parseInt(filterMonth.trim(), 10);
      if (!isNaN(monthNum)) {
        filtered = filtered.filter(item => {
          if (!item.invoiceDate) return false;
          const d = new Date(item.invoiceDate);
          return !isNaN(d.getTime()) && d.getMonth() + 1 === monthNum;
        });
      }
    }

    // 4. Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(item => {
        if (!item.invoiceDate) return false;
        const itemDate = new Date(item.invoiceDate);
        if (isNaN(itemDate.getTime())) return false;
        if (dateFrom && itemDate < new Date(dateFrom)) return false;
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (itemDate > toDate) return false;
        }
        return true;
      });
    }

    // 5. Area, Market, Merchandiser, SalesRep
    if (filterArea) filtered = filtered.filter(item => item.area === filterArea);
    if (filterMarket) filtered = filtered.filter(item => item.market === filterMarket);
    if (filterMerchandiser) filtered = filtered.filter(item => item.merchandiser === filterMerchandiser);
    if (filterSalesRep) filtered = filtered.filter(item => item.salesRep === filterSalesRep);

    return filtered;
  }, [augmentedData, invoiceTypeFilter, filterYear, filterMonth, dateFrom, dateTo, filterArea, filterMarket, filterMerchandiser, filterSalesRep]);

  // geographyFilteredData (respects Area, Market, Rep, Merchandiser but IGNORES time)
  const geographyFilteredData = useMemo(() => {
    let filtered = [...augmentedData];
    if (filterArea) filtered = filtered.filter(item => item.area === filterArea);
    if (filterMarket) filtered = filtered.filter(item => item.market === filterMarket);
    if (filterMerchandiser) filtered = filtered.filter(item => item.merchandiser === filterMerchandiser);
    if (filterSalesRep) filtered = filtered.filter(item => item.salesRep === filterSalesRep);
    return filtered;
  }, [augmentedData, filterArea, filterMarket, filterMerchandiser, filterSalesRep]);

  // Unique values for dropdowns
  const uniqueValues = useMemo(() => {
    const areas = new Set<string>();
    const markets = new Set<string>();
    const merchandisers = new Set<string>();
    const salesReps = new Set<string>();
    const years = new Set<string>();

    augmentedData.forEach(item => {
      if (item.area) areas.add(item.area);
      if (item.market) markets.add(item.market);
      if (item.merchandiser) merchandisers.add(item.merchandiser);
      if (item.salesRep) salesReps.add(item.salesRep);
      if (item.invoiceDate) {
        const d = new Date(item.invoiceDate);
        if (!isNaN(d.getTime())) years.add(d.getFullYear().toString());
      }
    });

    return {
      areas: Array.from(areas).sort(),
      markets: Array.from(markets).sort(),
      merchandisers: Array.from(merchandisers).sort(),
      salesReps: Array.from(salesReps).sort(),
      years: Array.from(years).sort((a, b) => b.localeCompare(a))
    };
  }, [augmentedData]);

  const hasAnyFilter = useMemo(() => {
    return invoiceTypeFilter !== 'all' || filterYear || filterMonth || dateFrom || dateTo || filterArea || filterMarket || filterMerchandiser || filterSalesRep;
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
    // Don't reset comparison/inactive defaults as they are usually stable settings
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const dataRows = XLSX.utils.sheet_to_json(ws) as any[];

      const mapping: Record<string, any> = {};
      dataRows.forEach(row => {
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

      handleUploadMapping(mapping);
      alert('تم رفع بيانات العملاء بنجاح!');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      ['CUSTOMER ID', 'CUSTOMER MAIN NAME', 'CUSTOMER SUB NAME', 'AREA', 'MARKETS', 'MERCHANDISER', 'SALESREP'],
      ['12345', 'Main Company', 'Branch A', 'Cairo', 'Main Market', 'John Doe', 'Jane Smith']
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Customer_Mapping_Template.xlsx');
  };

  const allTabs = [
    { id: 'sales-overview', label: 'Overview' },
    { id: 'sales-top10', label: 'Top 10' },

    { id: 'sales-customers', label: 'Customers' },
    { id: 'sales-inactive-customers', label: 'Inactive' },
    { id: 'sales-statistics', label: 'Statistics' },
    { id: 'sales-daily-sales', label: 'Daily Sales' },
    { id: 'sales-products', label: 'Products' },
    { id: 'sales-download-form', label: 'Stock Report' },
  ];

  const renderTabContent = () => {
    if (loading) {
      return <Loading message="Loading Sales Analysis Data..." />;
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
      const perms = JSON.parse(currentUser?.role || '{}');
      if (perms.sales && Array.isArray(perms.sales) && currentUser?.name !== 'MED Sabry') {
        if (!perms.sales.includes(activeTab)) {
          return <div className="p-20 text-center text-slate-400 font-bold">You don't have permission to view this section.</div>;
        }
      }
    } catch (e) { }

    switch (activeTab) {
      case 'sales-overview':
        return <SalesOverviewTab data={globallyFilteredData} loading={loading} />;
      case 'sales-top10':
        return <SalesTop10Tab data={globallyFilteredData} loading={loading} />;

      case 'sales-customers':
        return <SalesCustomersTab data={globallyFilteredData} loading={loading} onUploadMapping={handleUploadMapping} />;

      case 'sales-inactive-customers':
        return (
          <SalesInactiveCustomersTab
            data={geographyFilteredData}
            loading={loading}
            // @ts-ignore
            days={inactiveDays}
            // @ts-ignore
            minAmount={inactiveMinAmount}
          />
        );
      case 'sales-statistics':
        return <SalesStatisticsTab data={globallyFilteredData} loading={loading} />;
      case 'sales-daily-sales':
        return <SalesDailySalesTab data={globallyFilteredData} loading={loading} />;
      case 'sales-products':
        return <SalesProductsTab data={globallyFilteredData} loading={loading} />;

      case 'sales-download-form':
        return <SalesStockReportTab data={globallyFilteredData} loading={loading} />;
      default:
        return <SalesOverviewTab data={globallyFilteredData} loading={loading} />;
    }
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-green-100 selection:text-green-900 pb-12">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-[98%] mx-auto px-4 py-3 flex flex-col xl:flex-row items-center justify-between gap-4 min-h-[5rem]">

          {/* Logo & Back */}
          <div className="flex items-center gap-4 shrink-0 w-full xl:w-auto justify-between xl:justify-start">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3 group relative">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gradient-to-br from-green-600 to-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-green-200 cursor-pointer active:scale-95 transition-transform hover:rotate-3"
                  title="Upload Customer Mapping Excel (Click Icon)"
                >
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black text-slate-800 tracking-tight hidden md:block">Sales Analysis</h1>
                    <button
                      onClick={() => fetchData(true)}
                      disabled={loading || isRefreshing}
                      className={`p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-green-600 hover:border-green-200 hover:bg-green-50 transition-all ${loading || isRefreshing ? 'opacity-50' : 'hover:scale-110 active:scale-95'}`}
                      title="Refresh Data"
                    >
                      <RefreshCcw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="text-[10px] text-green-600 font-bold hover:underline text-left -mt-1"
                  >
                    Download Excel Template
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="w-full xl:flex-1 flex items-center justify-center gap-2">
            <div
              ref={tabsRef}
              className="grid grid-cols-4 md:grid-cols-8 gap-2 w-fit h-[42px] overflow-y-auto no-scrollbar scroll-smooth"
            >
              {allTabs.map((tab) => {
                // Check for dynamic JSON permission structure
                try {
                  const perms = JSON.parse(currentUser?.role || '{}');
                  if (perms.sales && currentUser?.name !== 'MED Sabry') {
                    if (!perms.sales.includes(tab.id)) {
                      return null;
                    }
                  }
                } catch (e) {
                  // Default to full access
                }

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-36 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap text-center ${activeTab === tab.id
                      ? 'bg-green-600 text-white shadow-md shadow-green-200'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => tabsRef.current?.scrollBy({ top: -42, behavior: 'smooth' })}
                className="p-1 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-green-600 hover:border-green-200 transition-all shadow-sm"
                title="Scroll Up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => tabsRef.current?.scrollBy({ top: 42, behavior: 'smooth' })}
                className="p-1 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-green-600 hover:border-green-200 transition-all shadow-sm"
                title="Scroll Down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Spacer / User */}
          <div className="w-full xl:w-auto shrink-0 flex items-center justify-end">
            <div className="relative">
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
                  <span className="text-sm font-bold hidden sm:inline uppercase tracking-widest">Filters</span>
                </div>
                {hasAnyFilter && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                )}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <main ref={mainContentRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-8rem)] p-8">
          {renderTabContent()}
        </main>
      </div>

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
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Search & Filters</h3>
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
                  { id: 'mode', label: 'Reporting Mode', icon: LayoutGrid },
                  { id: 'timing', label: 'Timing & Periods', icon: Calendar },
                  { id: 'outreach', label: 'Team & Territory', icon: Users },
                  ...(activeTab === 'sales-inactive-customers' ? [{ id: 'advanced', label: 'Comprehensive Filters', icon: MoreVertical }] : [])
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilterTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeFilterTab === tab.id
                        ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 ring-4 ring-slate-900/10'
                        : 'text-slate-400 hover:bg-white hover:text-slate-600 border border-transparent hover:border-slate-100'
                      }`}
                  >
                    <tab.icon className={`w-4 h-4 ${activeFilterTab === tab.id ? 'text-white' : 'text-slate-400'}`} />
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
                            <p className={`font-black text-sm uppercase tracking-[0.2em] ${invoiceTypeFilter === t.id ? 'text-green-700' : 'text-slate-800'}`}>
                              {t.label}
                            </p>
                          </button>
                        ))}
                      </div>

                      {/* Loading Overlay inside the tab content area */}
                      {isFiltering && (
                          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-[50] flex items-center justify-center rounded-[40px] animate-in fade-in duration-200">
                              <div className="flex flex-col items-center gap-4">
                                  <div className="w-12 h-12 border-4 border-green-600/20 border-t-green-600 rounded-full animate-spin"></div>
                                  <p className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em]">Applying Mode...</p>
                              </div>
                          </div>
                      )}
                    </div>
                  )}

                  {activeFilterTab === 'timing' && (
                    <div className="space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Standard Period
                          </h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Year</label>
                              <ModernSelect 
                                value={filterYear} 
                                onChange={setFilterYear} 
                                options={uniqueValues.years} 
                                placeholder="All Years"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Month</label>
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
                          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <TrendingUp className="w-3 h-3" /> Custom Interval
                          </h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">From Date</label>
                              <input 
                                type="date" 
                                value={dateFrom} 
                                onChange={e => setDateFrom(e.target.value)} 
                                className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-green-500/20 focus:ring-4 focus:ring-green-500/5 transition-all text-xs" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">To Date</label>
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

                  {activeFilterTab === 'outreach' && (
                    <div className="space-y-10">
                      <div className="grid grid-cols-2 gap-x-12 gap-y-8 bg-slate-50 p-10 rounded-[40px] border border-slate-100">
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Area</label>
                           <ModernSelect 
                             value={filterArea} 
                             onChange={setFilterArea} 
                             options={[{ label: "All Areas", value: "" }, ...uniqueValues.areas.map(v => ({ label: v, value: v }))]} 
                             placeholder="All Areas"
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Market</label>
                           <ModernSelect 
                             value={filterMarket} 
                             onChange={setFilterMarket} 
                             options={[{ label: "All Markets", value: "" }, ...uniqueValues.markets.map(v => ({ label: v, value: v }))]} 
                             placeholder="All Markets"
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Merchandiser</label>
                           <ModernSelect 
                             value={filterMerchandiser} 
                             onChange={setFilterMerchandiser} 
                             options={[{ label: "All", value: "" }, ...uniqueValues.merchandisers.map(v => ({ label: v, value: v }))]} 
                             placeholder="All"
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sales Rep</label>
                           <ModernSelect 
                             value={filterSalesRep} 
                             onChange={setFilterSalesRep} 
                             options={[{ label: "All", value: "" }, ...uniqueValues.salesReps.map(v => ({ label: v, value: v }))]} 
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

