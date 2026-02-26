'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import SalesOverviewTab from '@/components/SalesOverviewTab';
import SalesTop10Tab from '@/components/SalesTop10Tab';
import SalesCustomersTab from '@/components/SalesCustomersTab';
import SalesInactiveCustomersTab from '@/components/SalesInactiveCustomersTab';
import SalesStatisticsTab from '@/components/SalesStatisticsTab';
import SalesDailySalesTab from '@/components/SalesDailySalesTab';
import SalesProductsTab from '@/components/SalesProductsTab';
import SalesDownloadFormTab from '@/components/SalesDownloadFormTab';
import SalesInvoiceDetailsTab from '@/components/SalesInvoiceDetailsTab';
import SalesComparisonTab from '@/components/SalesComparisonTab';
import Login from '@/components/Login';
import Loading from '@/components/Loading';
import { SalesInvoice } from '@/lib/googleSheets';
import { ArrowLeft, BarChart3, LogOut, User, FileUp, FileSpreadsheet, ChevronUp, ChevronDown, CheckCircle2, AlertCircle, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function SalesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('sales-overview');
  const [data, setData] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchData = async () => {
    try {
      setLoading(true);
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
    }
  };

  const handleUploadMapping = (mapping: Record<string, any>) => {
    setCustomerMapping(mapping);
    localStorage.setItem('salesCustomerMapping', JSON.stringify(mapping));
  };

  // Global Invoice Type Filter
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'all' | 'sales' | 'returns'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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

  // Apply Global Filter
  const globallyFilteredData = useMemo(() => {
    if (invoiceTypeFilter === 'all') return augmentedData;
    return augmentedData.filter(item => {
      const num = item.invoiceNumber?.trim().toUpperCase() || '';
      if (invoiceTypeFilter === 'sales') return num.startsWith('SAL');
      if (invoiceTypeFilter === 'returns') return num.startsWith('RSAL');
      return true;
    });
  }, [augmentedData, invoiceTypeFilter]);

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
    { id: 'sales-comparison', label: 'Comparison' },
    { id: 'sales-customers', label: 'Customers' },
    { id: 'sales-invoice-details', label: 'Invoice Details' },
    { id: 'sales-inactive-customers', label: 'Inactive' },
    { id: 'sales-statistics', label: 'Statistics' },
    { id: 'sales-daily-sales', label: 'Daily Sales' },
    { id: 'sales-products', label: 'Products' },
    { id: 'sales-download-form', label: 'Order Form' },
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
              onClick={fetchData}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'sales-overview':
        return <SalesOverviewTab data={globallyFilteredData} loading={loading} />;
      case 'sales-top10':
        return <SalesTop10Tab data={globallyFilteredData} loading={loading} />;
      case 'sales-comparison':
        return <SalesComparisonTab data={globallyFilteredData} loading={loading} />;
      case 'sales-customers':
        return <SalesCustomersTab data={globallyFilteredData} loading={loading} onUploadMapping={handleUploadMapping} />;
      case 'sales-invoice-details':
        return <SalesInvoiceDetailsTab data={globallyFilteredData} loading={loading} />;
      case 'sales-inactive-customers':
        return <SalesInactiveCustomersTab data={globallyFilteredData} loading={loading} />;
      case 'sales-statistics':
        return <SalesStatisticsTab data={globallyFilteredData} loading={loading} />;
      case 'sales-daily-sales':
        return <SalesDailySalesTab data={globallyFilteredData} loading={loading} />;
      case 'sales-products':
        return <SalesProductsTab data={globallyFilteredData} loading={loading} />;
      case 'sales-download-form':
        return <SalesDownloadFormTab data={globallyFilteredData} loading={loading} />;
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
                  <h1 className="text-xl font-black text-slate-800 tracking-tight hidden md:block">Sales Analysis</h1>
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
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${invoiceTypeFilter === 'all'
                  ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                  }`}
              >
                {invoiceTypeFilter === 'all' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4" />}
                <span className="hidden sm:inline">Mode: {invoiceTypeFilter === 'all' ? 'Standard' : invoiceTypeFilter.toUpperCase()}</span>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </button>

              {isFilterOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">Select View Mode</div>
                  <button
                    onClick={() => { setInvoiceTypeFilter('all'); setIsFilterOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold mb-1 transition-all ${invoiceTypeFilter === 'all' ? 'bg-green-50 text-green-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${invoiceTypeFilter === 'all' ? 'bg-green-500' : 'bg-slate-200'}`} />
                    All Invoices
                  </button>
                  <button
                    onClick={() => { setInvoiceTypeFilter('sales'); setIsFilterOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold mb-1 transition-all ${invoiceTypeFilter === 'sales' ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${invoiceTypeFilter === 'sales' ? 'bg-red-500' : 'bg-slate-200'}`} />
                    Sales Only
                  </button>
                  <button
                    onClick={() => { setInvoiceTypeFilter('returns'); setIsFilterOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${invoiceTypeFilter === 'returns' ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${invoiceTypeFilter === 'returns' ? 'bg-red-500' : 'bg-slate-200'}`} />
                    Returns Only
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <main ref={mainContentRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-8rem)]">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
}

