'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Search, RefreshCw, FileCheck, FileSpreadsheet, AlertCircle, Filter, X } from 'lucide-react';
import { exportDebitExcelTable } from '@/app/Debit/Utils/ExcelExport';
import Loading from '@/app/Components/Loading';
import Login from '@/app/Components/Auth/Login';
import FilterModal, { FilterState } from './Modals/FilterModal';
import CustomersDocumentsGrid from './Components/CustomersDocumentsGrid';
import { useCustomersDocumentsTabAudit } from '@/app/Audit/Model/CustomersDocumentsTabAudit';
import { getCustomersDocuments, updateCustomerDocument } from './Service/customers_documents_service';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';

export default function CustomersDocumentsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [docFilters, setDocFilters] = useState<{ [key: string]: FilterState }>({
    creditApp: 'all',
    licence: 'all',
    trn: 'all',
    passport: 'all',
    id: 'all',
  });

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  useCustomersDocumentsTabAudit(isAuthenticated);

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
  }, [refreshTrigger, isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await getCustomersDocuments();
      if (result.success) {
        setData(result.data as any);
      }
    } catch (error) {
      console.error('Error fetching customer documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDocStatus = (value: string) => {
    if (!value) return 'missing';
    const val = value.toString().toLowerCase().trim();
    if (val === 'no' || val === '0' || val === 'false' || val === '') return 'missing';
    return 'complete';
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    // 1. Text Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.customerName.toLowerCase().includes(q)
      );
    }

    // 2. Multi-state Document Filters
    Object.keys(docFilters).forEach(key => {
      if (docFilters[key] === 'missing') {
        result = result.filter(item => getDocStatus(item[key]) === 'missing');
      } else if (docFilters[key] === 'collected') {
        result = result.filter(item => getDocStatus(item[key]) === 'complete');
      }
    });

    return result;
  }, [data, searchQuery, docFilters]);

  const handleUpdate = async (rowIndex: string, field: any, value: string) => {
    try {
      const newData = data.map(item =>
        item.rowIndex === rowIndex ? { ...item, [field]: value } : item
      );
      setData(newData);

      await updateCustomerDocument(rowIndex, { [field]: value });
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const getDaysRemaining = (dateStr: string) => {
    if (!dateStr) return null;
    let d = dateStr;
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      d = `${year}-${month}-${day}`;
    }
    const expiryDate = new Date(d);
    if (isNaN(expiryDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getDaysPassed = (dateStr: string) => {
    if (!dateStr) return null;
    let d = dateStr;
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      d = `${year}-${month}-${day}`;
    }
    const startDate = new Date(d);
    if (isNaN(startDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const exportToExcel = async () => {
    const headers = ['Customer Name', 'Credit App', 'Date', 'C. Days', 'Licence', 'Licence Date', 'L. Days', 'TRN', 'Passport', 'ID'];
    const rows = filteredData.map((item) => {
      const lDays = getDaysRemaining(item.licenceDate);
      const cDays = getDaysPassed(item.creditAppDate);
      return [
        item.customerName,
        item.creditApp,
        item.creditAppDate,
        cDays !== null ? `${cDays}d Active` : '',
        item.licence,
        item.licenceDate,
        lDays !== null ? (lDays < 0 ? `${Math.abs(lDays)}d Expired` : `${lDays}d Left`) : '',
        item.trn,
        item.passport,
        item.id,
      ];
    });
    
    await exportDebitExcelTable(
      headers,
      rows,
      `Customers_Documents_${new Date().toISOString().split('T')[0]}`,
      {
        sheetName: 'Customer Documents',
        columnWidth: 14,
      }
    );
  };

  if (isChecking) return <Loading />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  // (Old toggleFilter removed)

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-12">
      {/* Navbar - Unified Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="w-full mx-auto px-6 py-4 flex items-center">
          {/* Left: Branding - Flex 1 to push center */}
          <div className="flex items-center gap-5 flex-1">
            <button
              onClick={() => window.location.href = '/'}
              className="p-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all active:scale-90"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Documents Tracking</h1>
            </div>
          </div>

          {/* Center: Search & Controls - Fixed width or max-width centered */}
          <div className="flex items-center justify-center gap-4 flex-1 max-w-2xl px-4">
            <div className="relative w-full">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Find customers by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-6 py-3.5 bg-slate-100/50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-[1.5rem] outline-none transition-all text-sm font-black shadow-inner placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className={`p-3 rounded-2xl transition-all shadow-sm flex items-center justify-center border ${Object.values(docFilters).some(v => v !== 'all') ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                title="Filters"
              >
                <Filter className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  setRefreshTrigger(prev => prev + 1);
                  const btn = document.getElementById('refresh-btn-icon');
                  if (btn) { btn.classList.add('animate-spin'); setTimeout(() => btn.classList.remove('animate-spin'), 1000); }
                }}
                className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95 shadow-sm"
              >
                <RefreshCw id="refresh-btn-icon" className="w-5 h-5 transition-transform duration-1000" />
              </button>

              <button
                onClick={exportToExcel}
                className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95 flex items-center justify-center"
                title="Export to Excel"
              >
                <FileSpreadsheet className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right: Meta Info - Flex 1 to balance center */}
          <div className="flex items-center justify-end gap-4 flex-1">
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full mx-auto px-6 lg:px-12 pt-10">

        <CustomersDocumentsGrid
          data={filteredData}
          loading={loading}
          onUpdate={handleUpdate}
        />
      </div>

      <FilterModal 
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        docFilters={docFilters}
        setDocFilters={setDocFilters}
      />
    </div>
  );
}
