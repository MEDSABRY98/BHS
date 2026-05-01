'use client';

import React, { useState, useEffect } from 'react';
import { Search, Package, RefreshCw, AlertCircle, ChevronDown, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import Loading from '../../01-Unified/Loading';
import NoData from '../../01-Unified/NoDataTab';
import { ICItem } from '@/lib/googleSheets';

export default function NormalCountTab() {
    const [data, setData] = useState<ICItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Counted' | 'Pending'>('All');
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async (isSilent = false) => {
        if (isSilent) setIsRefreshing(true);
        else setLoading(true);
        
        setError(null);
        try {
            const res = await fetch('/api/inventory/counting/normal-total');
            const json = await res.json();
            if (json.data) {
                setData(json.data);
            } else {
                throw new Error(json.error || 'Failed to load data');
            }
        } catch (e: any) {
            console.error('Failed to load normal IC total', e);
            setError(e.message);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Stats
    const totalItems = data.length;
    const countedItems = data.filter(item => item.totalQty > 0).length;
    const pendingItems = data.filter(item => item.totalQty === 0).length;

    const statusOptions = [
        { value: 'All', label: 'All Items' },
        { value: 'Counted', label: 'Counted' },
        { value: 'Pending', label: 'Pending' }
    ];
    const currentStatus = statusOptions.find(opt => opt.value === statusFilter);

    const filteredData = data.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query || (
            item.productName.toLowerCase().includes(query) ||
            item.productId.toLowerCase().includes(query) ||
            item.barcodeName.toLowerCase().includes(query)
        );

        const matchesStatus = statusFilter === 'All' ||
            (statusFilter === 'Counted' ? item.totalQty > 0 : item.totalQty === 0);

        return matchesSearch && matchesStatus;
    });

    const handleExport = () => {
        const exportData = filteredData.map((item, idx) => ({
            '#': idx + 1,
            'Barcode': item.barcodeName,
            'Product Name': item.productName,
            'Qty in Box': item.qtyInBox,
            'Total Qty': item.totalQty
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Normal Count');
        XLSX.writeFile(workbook, `Normal_Count_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (loading) return <Loading message="Loading Normal Inventory..." />;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-3xl border border-red-100">
                <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
                <h3 className="text-2xl font-black text-red-800 mb-2">Error Connection</h3>
                <p className="text-red-600 mb-8 max-w-md text-center font-medium">{error}</p>
                <button onClick={() => fetchData()} className="px-8 py-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-lg flex items-center gap-2 font-bold">
                    <RefreshCw className="w-5 h-5" /> Retry Sync
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Consolidated Filter Bar */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 p-4 flex flex-wrap items-center gap-4">
                {/* Stats */}
                <div className="flex gap-2">
                    <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
                        <span className="text-slate-400">Total:</span> {totalItems}
                    </div>
                    <div className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
                        <span className="text-slate-400">Counted:</span> {countedItems}
                    </div>
                    <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 flex items-center gap-2 font-bold text-xs whitespace-nowrap">
                        <span className="text-slate-400">Pending:</span> {pendingItems}
                    </div>
                </div>

                {/* Search - Growing to fill space */}
                <div className="relative flex-1 min-w-[200px] group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by Product Name or Barcode..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-transparent rounded-xl text-sm font-bold text-slate-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    />
                </div>

                {/* Custom Modern Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsStatusOpen(!isStatusOpen)}
                        className="min-w-[180px] bg-slate-50 border border-slate-200 text-slate-700 text-[13px] font-black rounded-xl px-5 py-3 flex items-center justify-between hover:bg-slate-100 transition-all outline-none group shadow-sm"
                    >
                        <span>{currentStatus?.label}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isStatusOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isStatusOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsStatusOpen(false)}></div>
                            <div className="absolute right-0 mt-3 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 py-2 z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-hidden">
                                {statusOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            setStatusFilter(opt.value as any);
                                            setIsStatusOpen(false);
                                        }}
                                        className={`w-full text-left px-5 py-3 text-sm font-bold transition-all ${statusFilter === opt.value
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Refresh Button */}
                    <button
                        onClick={() => fetchData(true)}
                        disabled={isRefreshing}
                        className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200/50 hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 group/refresh"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : 'group-hover/refresh:rotate-180'} transition-all duration-500`} />
                    </button>

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200/50 hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all group/export"
                        title="Export to Excel"
                    >
                        <FileSpreadsheet className="w-6 h-6 group-hover/export:rotate-12 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <tr>
                                <th className="px-6 py-5 text-center text-xs font-black uppercase tracking-widest text-white/90">#</th>
                                <th className="px-6 py-5 text-center text-xs font-black uppercase tracking-widest text-white/90">Barcode Name</th>
                                <th className="px-6 py-5 text-center text-xs font-black uppercase tracking-widest text-white/90">Product Name</th>
                                <th className="px-6 py-5 text-center text-xs font-black uppercase tracking-widest text-white/90">Qty In Box</th>
                                <th className="px-6 py-5 text-center text-xs font-black uppercase tracking-widest text-white/90">Total Qty</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.length > 0 ? (
                                filteredData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50 transition-all group">
                                        <td className="px-6 py-4 text-center text-sm font-bold text-slate-400 group-hover:text-blue-600 transition-colors">{idx + 1}</td>
                                        <td className="px-6 py-4 text-center text-base font-black text-slate-600 transition-colors group-hover:text-blue-700">{item.barcodeName}</td>
                                        <td className="px-6 py-4 text-center text-sm font-black text-slate-800">{item.productName}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-base font-black">
                                                {item.qtyInBox === 0 ? '-' : item.qtyInBox}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex px-4 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-lg font-black border border-blue-100 shadow-sm">
                                                {item.totalQty === 0 ? '-' : item.totalQty.toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-20">
                                        <NoData title="No Data Found" message={searchQuery ? "No results match your search query." : "No inventory counting data available."} />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                {filteredData.length > 0 && (
                    <div className="bg-slate-50/50 px-8 py-5 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-slate-500">
                                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <Package className="w-5 h-5 text-blue-500" />
                                </div>
                                <span className="text-sm font-bold">
                                    Showing <span className="text-slate-900">{filteredData.length}</span> items
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
