'use client';

import React, { useState, useEffect } from 'react';
import { Search, History, RefreshCw, AlertCircle, Calendar, User, Home, ChevronDown, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import Loading from '../../01-Unified/Loading';
import NoData from '../../01-Unified/NoDataTab';
import { ICRecord } from '@/lib/googleSheets';

export default function NormalRecordTab() {
    const [data, setData] = useState<ICRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [userFilter, setUserFilter] = useState('All Users');
    const [warehouseFilter, setWarehouseFilter] = useState('All Warehouses');
    const [isUserOpen, setIsUserOpen] = useState(false);
    const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/inventory/counting/normal-record');
            const json = await res.json();
            if (json.data) {
                setData(json.data);
            } else {
                throw new Error(json.error || 'Failed to load data');
            }
        } catch (e: any) {
            console.error('Failed to load normal IC record', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const uniqueUsers = ['All Users', ...Array.from(new Set(data.map(item => item.user)))];
    const uniqueWarehouses = ['All Warehouses', ...Array.from(new Set(data.map(item => item.warehouse)))];

    const filteredData = data.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query || (
            item.productName.toLowerCase().includes(query) ||
            item.productId.toLowerCase().includes(query) ||
            item.barcodeName.toLowerCase().includes(query) ||
            item.user.toLowerCase().includes(query) ||
            item.warehouse.toLowerCase().includes(query)
        );

        const matchesUser = userFilter === 'All Users' || item.user === userFilter;
        const matchesWarehouse = warehouseFilter === 'All Warehouses' || item.warehouse === warehouseFilter;

        return matchesSearch && matchesUser && matchesWarehouse;
    });

    const handleExport = () => {
        const exportData = filteredData.map((item, idx) => ({
            '#': idx + 1,
            'Date': item.date,
            'User': item.user,
            'Warehouse': item.warehouse,
            'Barcode': item.barcodeName,
            'Product Name': item.productName,
            'Qty in Box': item.qtyInBox,
            'Count Details': item.countDetails,
            'Total Qty': item.totalQty
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Normal Record');
        XLSX.writeFile(workbook, `Normal_Record_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (loading) return <Loading message="Loading Normal Records..." />;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-3xl border border-red-100">
                <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
                <h3 className="text-2xl font-black text-red-800 mb-2">Error Connection</h3>
                <p className="text-red-600 mb-8 max-w-md text-center font-medium">{error}</p>
                <button onClick={fetchData} className="px-8 py-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-lg flex items-center gap-2 font-bold">
                    <RefreshCw className="w-5 h-5" /> Retry Sync
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Consolidated Filter Bar */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 p-4 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px] group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by Product, User, Warehouse..."
                        className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-transparent rounded-2xl text-base font-bold text-slate-700 placeholder:text-gray-300 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    />
                </div>

                {/* User Filter Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsUserOpen(!isUserOpen)}
                        className="min-w-[160px] bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black rounded-xl px-4 py-3.5 flex items-center justify-between hover:bg-slate-100 transition-all outline-none group shadow-sm"
                    >
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span>{userFilter}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isUserOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isUserOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsUserOpen(false)}></div>
                            <div className="absolute right-0 mt-3 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 py-2 z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-hidden max-h-[300px] overflow-y-auto">
                                {uniqueUsers.map((u) => (
                                    <button
                                        key={u}
                                        onClick={() => {
                                            setUserFilter(u);
                                            setIsUserOpen(false);
                                        }}
                                        className={`w-full text-left px-5 py-3 text-xs font-bold transition-all ${userFilter === u
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Warehouse Filter Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsWarehouseOpen(!isWarehouseOpen)}
                        className="min-w-[160px] bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black rounded-xl px-4 py-3.5 flex items-center justify-between hover:bg-slate-100 transition-all outline-none group shadow-sm"
                    >
                        <div className="flex items-center gap-2">
                            <Home className="w-4 h-4 text-slate-400" />
                            <span>{warehouseFilter}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isWarehouseOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isWarehouseOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsWarehouseOpen(false)}></div>
                            <div className="absolute right-0 mt-3 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 py-2 z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-hidden max-h-[300px] overflow-y-auto">
                                {uniqueWarehouses.map((w) => (
                                    <button
                                        key={w}
                                        onClick={() => {
                                            setWarehouseFilter(w);
                                            setIsWarehouseOpen(false);
                                        }}
                                        className={`w-full text-left px-5 py-3 text-xs font-bold transition-all ${warehouseFilter === w
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {w}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Export Button */}
                <button
                    onClick={handleExport}
                    className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200/50 hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all group/export"
                    title="Export to Excel"
                >
                    <FileSpreadsheet className="w-6 h-6 group-hover/export:rotate-12 transition-transform" />
                </button>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full border-collapse">
                        <thead className="bg-gradient-to-r from-slate-700 to-slate-900 text-white sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white/90">Date</th>
                                <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white/90">User</th>
                                <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white/90">Warehouse</th>
                                <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white/90">Barcode</th>
                                <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white/90">Product Name</th>
                                <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white/90">In Box</th>
                                <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white/90">Details</th>
                                <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest text-white/90">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.length > 0 ? (
                                filteredData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-all group border-b border-gray-50">
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[11px] font-bold text-slate-800">{item.date}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                                    {item.user.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-bold text-slate-600 truncate max-w-[100px]">{item.user}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="inline-flex px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase">
                                                {item.warehouse}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-xs font-black text-slate-700">{item.barcodeName}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-xs font-black text-slate-800 leading-tight">{item.productName}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-xs font-bold text-slate-600">{item.qtyInBox}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-[11px] font-bold text-slate-600 truncate max-w-[150px] inline-block" title={item.countDetails}>
                                                {item.countDetails}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="inline-flex px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black border border-blue-100 shadow-sm">
                                                {item.totalQty.toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="py-20">
                                        <NoData title="No Records Found" message={searchQuery ? "No results match your search query." : "No historical records available."} />
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
                                    <History className="w-5 h-5 text-slate-600" />
                                </div>
                                <span className="text-sm font-bold">
                                    Total Records: <span className="text-slate-900">{filteredData.length}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
