'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Search, RefreshCw, FileCheck, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import Loading from '@/components/01-Unified/Loading';
import Login from '@/components/01-Unified/Login';
import CustomersDocumentsGrid from '@/components/06-CustomersDocuments/CustomersDocumentsGrid';

export default function CustomersDocumentsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state for missing documents
  const [missingFilters, setMissingFilters] = useState<{ [key: string]: boolean }>({
    creditApp: false,
    licence: false,
    trn: false,
    passport: false,
    id: false
  });

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
      const res = await fetch('/api/customers-documents');
      const result = await res.json();
      if (result.success) {
        setData(result.data);
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

    // 2. Missing Documents Filters
    Object.keys(missingFilters).forEach(key => {
      if (missingFilters[key]) {
        result = result.filter(item => getDocStatus(item[key]) === 'missing');
      }
    });

    return result;
  }, [data, searchQuery, missingFilters]);

  const handleUpdate = async (rowIndex: number, field: any, value: string) => {
    try {
      const newData = data.map(item => 
        item.rowIndex === rowIndex ? { ...item, [field]: value } : item
      );
      setData(newData);

      await fetch('/api/customers-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, [field]: value })
      });
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

  const exportToExcel = () => {
    const headers = ['Customer Name', 'Credit App', 'Licence', 'Licence Date', 'L. Days', 'TRN', 'Passport', 'Passport Date', 'P. Days', 'ID', 'ID Date', 'I. Days'];
    const rows = filteredData.map((item) => {
      const lDays = getDaysRemaining(item.licenceDate);
      const pDays = getDaysRemaining(item.passportDate);
      const iDays = getDaysRemaining(item.idDate);
      return [item.customerName, item.creditApp, item.licence, item.licenceDate, lDays !== null ? (lDays < 0 ? `${Math.abs(lDays)}d Expired` : `${lDays}d Left`) : '', item.trn, item.passport, item.passportDate, pDays !== null ? (pDays < 0 ? `${Math.abs(pDays)}d Expired` : `${pDays}d Left`) : '', item.id, item.idDate, iDays !== null ? (iDays < 0 ? `${Math.abs(iDays)}d Expired` : `${iDays}d Left`) : ''];
    });
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Documents');
    const wscols = [{wch: 35}, {wch: 12}, {wch: 12}, {wch: 15}, {wch: 15}, {wch: 12}, {wch: 12}, {wch: 15}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 15}];
    worksheet['!cols'] = wscols;
    XLSX.writeFile(workbook, `Customers_Documents_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isChecking) return <Loading />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const toggleFilter = (key: string) => {
    setMissingFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
             <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full mx-auto px-6 lg:px-12 pt-10">
        
        {/* Missing Documents Filter Bar */}
        <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="flex flex-wrap gap-4 justify-center">
              {[
                { id: 'creditApp', label: 'Missing Credit App' },
                { id: 'licence', label: 'Missing Licence' },
                { id: 'trn', label: 'Missing TRN' },
                { id: 'passport', label: 'Missing Passport' },
                { id: 'id', label: 'Missing ID Card' }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => toggleFilter(filter.id)}
                  className={`px-6 py-4 rounded-[1.5rem] text-xs font-black transition-all border shadow-sm flex items-center gap-4 w-[200px] justify-center ${
                    missingFilters[filter.id]
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200 scale-105 z-10'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${missingFilters[filter.id] ? 'bg-white animate-pulse' : 'bg-slate-200'}`} />
                  <span className="truncate">{filter.label}</span>
                </button>
              ))}
           </div>
        </div>

        <CustomersDocumentsGrid 
          data={filteredData}
          loading={loading}
          onUpdate={handleUpdate}
        />
      </div>
    </div>
  );
}
