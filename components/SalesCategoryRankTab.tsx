'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Filter, Search, TrendingUp, Package, FileDown, Users, User, Calendar, MapPin, X, ChevronDown, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SalesCategoryRankTabProps {
    data: SalesInvoice[];
    loading: boolean;
}

interface RankingItem {
    name: string;
    area?: string;
    total: number;
    customerCount?: number;
    tags?: Record<string, number>;
}

export default function SalesCategoryRankTab({ data, loading }: SalesCategoryRankTabProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterArea, setFilterArea] = useState('');
    const [filterMarket, setFilterMarket] = useState('');
    const [filterMerchandiser, setFilterMerchandiser] = useState('');
    const [filterSalesRep, setFilterSalesRep] = useState('');

    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<'area' | 'market' | 'merchandiser' | 'salesrep' | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeSubTab, setActiveSubTab] = useState<'tags' | 'main' | 'sub'>('tags');
    const itemsPerPage = 50;

    const areaDropdownRef = useRef<HTMLDivElement>(null);
    const marketDropdownRef = useRef<HTMLDivElement>(null);
    const merchandiserDropdownRef = useRef<HTMLDivElement>(null);
    const salesRepDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(prev => prev === 'area' ? null : prev);
            }
            if (marketDropdownRef.current && !marketDropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(prev => prev === 'market' ? null : prev);
            }
            if (merchandiserDropdownRef.current && !merchandiserDropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(prev => prev === 'merchandiser' ? null : prev);
            }
            if (salesRepDropdownRef.current && !salesRepDropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(prev => prev === 'salesrep' ? null : prev);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterMonth, filterYear, dateFrom, dateTo, filterArea, filterMarket, filterMerchandiser, filterSalesRep, activeSubTab]);

    const filteredData = useMemo(() => {
        let filtered = data.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                (item.customerName?.toLowerCase().includes(searchLower) ||
                    item.customerMainName?.toLowerCase().includes(searchLower) ||
                    item.customerId?.toLowerCase().includes(searchLower) ||
                    item.productTag?.toLowerCase().includes(searchLower));
            return matchesSearch;
        });

        if (filterYear) {
            filtered = filtered.filter(item => item.invoiceDate && new Date(item.invoiceDate).getFullYear().toString() === filterYear);
        }
        if (filterMonth) {
            filtered = filtered.filter(item => item.invoiceDate && (new Date(item.invoiceDate).getMonth() + 1).toString() === filterMonth);
        }
        if (dateFrom || dateTo) {
            filtered = filtered.filter(item => {
                if (!item.invoiceDate) return false;
                const date = new Date(item.invoiceDate);
                if (dateFrom && date < new Date(dateFrom)) return false;
                if (dateTo && date > new Date(dateTo)) return false;
                return true;
            });
        }
        if (filterArea) filtered = filtered.filter(item => item.area === filterArea);
        if (filterMarket) filtered = filtered.filter(item => item.market === filterMarket);
        if (filterMerchandiser) filtered = filtered.filter(item => item.merchandiser === filterMerchandiser);
        if (filterSalesRep) filtered = filtered.filter(item => item.salesRep === filterSalesRep);

        return filtered;
    }, [data, searchTerm, filterMonth, filterYear, dateFrom, dateTo, filterArea, filterMarket, filterMerchandiser, filterSalesRep]);

    const tagSummaryData = useMemo<RankingItem[]>(() => {
        const tagMap = new Map<string, {
            tag: string;
            total: number;
            customers: Set<string>;
        }>();

        filteredData.forEach(item => {
            const tag = item.productTag || 'Uncategorized';
            const amount = item.amount || 0;
            const customer = item.customerName || 'Unknown';

            if (!tagMap.has(tag)) {
                tagMap.set(tag, { tag, total: 0, customers: new Set() });
            }

            const current = tagMap.get(tag)!;
            current.total += amount;
            current.customers.add(customer);
        });

        return Array.from(tagMap.values())
            .map(item => ({
                name: item.tag,
                total: item.total,
                customerCount: item.customers.size
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredData]);

    const { totalTagsSales, totalUniqueCustomers } = useMemo(() => {
        const totalSales = tagSummaryData.reduce((sum, item) => sum + item.total, 0);
        const uniqueCusts = new Set(filteredData.filter(d => d.productTag).map(d => d.customerName)).size;
        return { totalTagsSales: totalSales, totalUniqueCustomers: uniqueCusts };
    }, [tagSummaryData, filteredData]);

    const rankingData = useMemo<RankingItem[]>(() => {
        if (activeSubTab === 'tags') return tagSummaryData;

        const customerMap = new Map<string, {
            name: string;
            area: string;
            total: number;
            tags: Record<string, number>
        }>();

        filteredData.forEach(item => {
            const name = activeSubTab === 'main'
                ? (item.customerMainName || 'Unknown Main Customer')
                : (item.customerName || 'Unknown Sub Customer');
            const area = item.area || 'Unknown Area';
            const tag = item.productTag || 'Uncategorized';
            const amount = item.amount || 0;

            if (!customerMap.has(name)) {
                customerMap.set(name, { name, area, total: 0, tags: {} });
            }

            const current = customerMap.get(name)!;
            current.total += amount;
            current.tags[tag] = (current.tags[tag] || 0) + amount;
        });

        return Array.from(customerMap.values())
            .sort((a, b) => b.total - a.total);
    }, [filteredData, activeSubTab, tagSummaryData]);

    const getTagColor = (index: number) => {
        const colors = [
            { bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50' },
            { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
            { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
            { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' },
            { bg: 'bg-rose-500', text: 'text-rose-600', light: 'bg-rose-50' },
            { bg: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50' },
            { bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50' },
            { bg: 'bg-slate-500', text: 'text-slate-600', light: 'bg-slate-50' },
        ];
        return colors[index % colors.length];
    };

    const totalPages = Math.ceil(rankingData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return rankingData.slice(start, start + itemsPerPage);
    }, [rankingData, currentPage]);

    const handleExportExcel = (groupType: 'main' | 'sub' | 'tags') => {
        if (groupType === 'tags') {
            const excelData = tagSummaryData.map(item => ({
                'Category Tag': item.name,
                'Total Sales (AED)': item.total,
                'Customer Count': item.customerCount
            }));
            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Tags Summary");
            XLSX.writeFile(wb, `Sales_Category_Tags_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
            return;
        }

        const exportMap = new Map<string, {
            name: string;
            area: string;
            total: number;
            tags: Record<string, number>
        }>();

        filteredData.forEach(item => {
            const name = groupType === 'main'
                ? (item.customerMainName || item.customerName || 'Unknown Customer')
                : (item.customerName || 'Unknown Customer');
            const tag = item.productTag || 'Uncategorized';
            const amount = item.amount || 0;
            const area = item.area || '-';

            if (!exportMap.has(name)) {
                exportMap.set(name, { name, area, total: 0, tags: {} });
            }

            const current = exportMap.get(name)!;
            current.total += amount;
            current.tags[tag] = (current.tags[tag] || 0) + amount;
        });

        const exportRankingData = Array.from(exportMap.values())
            .sort((a, b) => b.total - a.total);

        const tagTotals: Record<string, number> = {};
        exportRankingData.forEach(customer => {
            Object.entries(customer.tags).forEach(([tag, amount]) => {
                tagTotals[tag] = (tagTotals[tag] || 0) + amount;
            });
        });

        const sortedTags = Object.entries(tagTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([tag]) => tag);

        const excelData = exportRankingData.map(customer => {
            const row: any = {
                'Customer Name': customer.name,
                'Area': customer.area,
                'Total Sales': customer.total
            };
            sortedTags.forEach(tag => {
                row[tag] = customer.tags[tag] || 0;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Category Ranking");
        XLSX.writeFile(wb, `Sales_${groupType === 'main' ? 'Main' : 'Sub'}_Category_Ranking_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const uniqueAreas = useMemo(() => Array.from(new Set(data.map(i => i.area).filter(Boolean) as string[])).sort(), [data]);
    const uniqueMarkets = useMemo(() => Array.from(new Set(data.map(i => i.market).filter(Boolean) as string[])).sort(), [data]);
    const uniqueMerchandisers = useMemo(() => Array.from(new Set(data.map(i => i.merchandiser).filter(Boolean) as string[])).sort(), [data]);
    const uniqueSalesReps = useMemo(() => Array.from(new Set(data.map(i => i.salesRep).filter(Boolean) as string[])).sort(), [data]);

    const formatAmount = (amt: number) => {
        if (Math.abs(amt) >= 1000) return (amt / 1000).toFixed(1) + 'K';
        return amt.toFixed(0);
    };

    const getTagStyles = (amount: number) => {
        if (amount < 0) return {
            bg: 'bg-white',
            border: 'border-rose-100',
            text: 'text-slate-800',
            subText: 'text-rose-600',
            pill: 'bg-rose-600',
            accent: 'border-l-rose-500'
        };
        return {
            bg: 'bg-white',
            border: 'border-indigo-100',
            text: 'text-slate-800',
            subText: 'text-indigo-600',
            pill: 'bg-indigo-600',
            accent: 'border-l-indigo-500'
        };
    };

    const hasActiveFilters = filterYear || filterMonth || dateFrom || dateTo || filterArea || filterMarket || filterMerchandiser || filterSalesRep;

    return (
        <div className="flex flex-col h-full relative">
            {/* Header & Controls */}
            <div className="px-8 py-5 border-b border-gray-100 bg-slate-50/50">
                <div className="grid grid-cols-3 items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-600 rounded-xl shadow-md shadow-green-100">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-lg font-black text-slate-800 tracking-tight whitespace-nowrap">Category Rank</h1>
                    </div>

                    <div className="flex items-center gap-4 justify-center min-w-[600px]">
                        <div className="relative group w-full max-w-[300px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                            <input
                                type="text"
                                placeholder={activeSubTab === 'tags' ? "Search tags..." : "Search customers..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all text-sm font-medium shadow-sm"
                            />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setIsFilterModalOpen(true)}
                                className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 group ${hasActiveFilters
                                    ? 'bg-green-600 text-white shadow-lg shadow-green-200 ring-2 ring-green-500/20'
                                    : 'bg-white text-gray-600 border border-gray-200 shadow-sm hover:border-green-500 hover:text-green-600'
                                    }`}
                            >
                                <Filter className={`w-5 h-5 ${hasActiveFilters ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
                                <span className="text-sm font-bold uppercase tracking-wider">Filters</span>
                                {hasActiveFilters && (
                                    <span className="flex h-2 w-2 rounded-full bg-white"></span>
                                )}
                            </button>

                            <button
                                onClick={() => handleExportExcel(activeSubTab)}
                                disabled={rankingData.length === 0}
                                title={`Export ${activeSubTab === 'tags' ? 'Tags Summary' : activeSubTab === 'main' ? 'Main Customers' : 'Sub Customers'} to Excel`}
                                className="p-2.5 rounded-xl shadow-md transition-all hover:scale-110 active:scale-95 shrink-0 ml-1 bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <FileDown className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="px-8 py-3 bg-white border-b border-gray-100 flex items-center justify-center gap-2 sticky top-0 z-30">
                <button
                    onClick={() => setActiveSubTab('tags')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-black transition-all ${activeSubTab === 'tags'
                        ? 'bg-slate-800 text-white shadow-lg'
                        : 'text-slate-400 hover:bg-slate-50'
                        }`}
                >
                    <Layers className="w-4 h-4" />
                    TAGS SUMMARY
                </button>
                <button
                    onClick={() => setActiveSubTab('main')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-black transition-all ${activeSubTab === 'main'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                        : 'text-slate-400 hover:bg-slate-50'
                        }`}
                >
                    <Users className="w-4 h-4" />
                    MAIN CUSTOMERS
                </button>
                <button
                    onClick={() => setActiveSubTab('sub')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-black transition-all ${activeSubTab === 'sub'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                        : 'text-slate-400 hover:bg-slate-50'
                        }`}
                >
                    <User className="w-4 h-4" />
                    SUB CUSTOMERS
                </button>
            </div>

            {/* Filter Modal */}
            {isFilterModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsFilterModalOpen(false)} />
                    <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col border border-white/20 animate-in fade-in zoom-in duration-300 overflow-hidden text-left">
                        <div className="px-8 py-6 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-green-100 rounded-2xl"><Filter className="w-6 h-6 text-green-600" /></div>
                                <h2 className="text-xl font-black text-gray-800 tracking-tight">Rank Filters</h2>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-6 h-6 text-gray-500" /></button>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 no-scrollbar min-h-[550px]">
                            <div className="space-y-12 pb-60">
                                <div className="space-y-6">
                                    <h3 className="text-sm font-black text-slate-400 font-mono uppercase tracking-[0.2em] flex items-center gap-3"><Calendar className="w-5 h-5 text-indigo-500" /> 01. Time Period</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-6 rounded-[24px] border border-slate-100">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Year</label>
                                            <input type="number" placeholder="YYYY" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold placeholder:text-slate-300 shadow-sm" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Month</label>
                                            <input type="number" placeholder="1-12" value={filterMonth} onChange={(e) => { const v = e.target.value; if (v === '' || (parseInt(v) >= 1 && parseInt(v) <= 12)) setFilterMonth(v); }} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold placeholder:text-slate-300 shadow-sm" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">From Date</label>
                                            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold shadow-sm" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">To Date</label>
                                            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold shadow-sm" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-sm font-black text-slate-400 font-mono uppercase tracking-[0.2em] flex items-center gap-3"><MapPin className="w-5 h-5 text-emerald-500" /> 02. Categorization</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 bg-emerald-50/30 p-8 rounded-[24px] border border-emerald-100/50">
                                        <div className="relative" ref={areaDropdownRef}>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Area</label>
                                            <button onClick={() => setOpenDropdown(openDropdown === 'area' ? null : 'area')} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between font-bold text-slate-700 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/5 transition-all shadow-sm group">
                                                <span className={`${filterArea ? 'text-slate-900' : 'text-slate-400'}`}>{filterArea || 'All Areas'}</span>
                                                <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'area' ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                                            </button>
                                            {openDropdown === 'area' && (
                                                <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                                    <div className="max-h-56 overflow-y-auto p-1.5 no-scrollbar">
                                                        <button onClick={() => { setFilterArea(''); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors font-bold text-sm">All Areas</button>
                                                        {uniqueAreas.map(a => <button key={a} onClick={() => { setFilterArea(a); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors font-bold text-sm border-t border-slate-50">{a}</button>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative" ref={salesRepDropdownRef}>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Sales Rep</label>
                                            <button onClick={() => setOpenDropdown(openDropdown === 'salesrep' ? null : 'salesrep')} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between font-bold text-slate-700 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/5 transition-all shadow-sm group">
                                                <span className={`${filterSalesRep ? 'text-slate-900' : 'text-slate-400'}`}>{filterSalesRep || 'All Representatives'}</span>
                                                <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'salesrep' ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                                            </button>
                                            {openDropdown === 'salesrep' && (
                                                <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                                    <div className="max-h-56 overflow-y-auto p-1.5 no-scrollbar">
                                                        <button onClick={() => { setFilterSalesRep(''); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors font-bold text-sm">All Reps</button>
                                                        {uniqueSalesReps.map(r => <button key={r} onClick={() => { setFilterSalesRep(r); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors font-bold text-sm border-t border-slate-50">{r}</button>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative" ref={marketDropdownRef}>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Market</label>
                                            <button onClick={() => setOpenDropdown(openDropdown === 'market' ? null : 'market')} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between font-bold text-slate-700 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/5 transition-all shadow-sm group">
                                                <span className={`${filterMarket ? 'text-slate-900' : 'text-slate-400'}`}>{filterMarket || 'All Markets'}</span>
                                                <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'market' ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                                            </button>
                                            {openDropdown === 'market' && (
                                                <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                                    <div className="max-h-56 overflow-y-auto p-1.5 no-scrollbar">
                                                        <button onClick={() => { setFilterMarket(''); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors font-bold text-sm">All Markets</button>
                                                        {uniqueMarkets.map(m => <button key={m} onClick={() => { setFilterMarket(m); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors font-bold text-sm border-t border-slate-50">{m}</button>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative" ref={merchandiserDropdownRef}>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Merchandiser</label>
                                            <button onClick={() => setOpenDropdown(openDropdown === 'merchandiser' ? null : 'merchandiser')} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between font-bold text-slate-700 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/5 transition-all shadow-sm group">
                                                <span className={`${filterMerchandiser ? 'text-slate-900' : 'text-slate-400'}`}>{filterMerchandiser || 'All Merchandisers'}</span>
                                                <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'merchandiser' ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                                            </button>
                                            {openDropdown === 'merchandiser' && (
                                                <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                                    <div className="max-h-56 overflow-y-auto p-1.5 no-scrollbar">
                                                        <button onClick={() => { setFilterMerchandiser(''); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors font-bold text-sm">All Merchandisers</button>
                                                        {uniqueMerchandisers.map(m => <button key={m} onClick={() => { setFilterMerchandiser(m); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors font-bold text-sm border-t border-slate-50">{m}</button>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <button onClick={() => { setFilterYear(''); setFilterMonth(''); setDateFrom(''); setDateTo(''); setFilterArea(''); setFilterMarket(''); setFilterMerchandiser(''); setFilterSalesRep(''); }} className="px-6 py-3 text-slate-500 hover:text-slate-800 font-black text-sm uppercase tracking-widest transition-colors flex items-center gap-2">Reset Defaults</button>
                            <button onClick={() => setIsFilterModalOpen(false)} className="px-8 py-3 bg-green-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-green-200 hover:bg-green-700 transition-all hover:-translate-y-0.5">Apply Filters</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Table Content */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="w-full">
                    {/* Table Header - Sticky */}
                    <div className="sticky top-0 z-20 bg-slate-800 text-white font-bold text-[10px] uppercase tracking-[0.2em] px-6 py-4 flex items-center gap-4 shadow-sm">
                        <div className="w-12 text-center opacity-70">#</div>
                        {activeSubTab === 'tags' ? (
                            <>
                                <div className="flex-[2] text-center">Category Tag Name</div>
                                <div className="flex-1 text-center">Total Sales (AED)</div>
                                <div className="flex-1 text-center">Customer Count</div>
                            </>
                        ) : (
                            <div className="flex-1 text-center">
                                {activeSubTab === 'main' ? 'Main Customer' : 'Sub Customer'} Details & Purchased Categories
                            </div>
                        )}
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-gray-100/50">
                        {paginatedData.map((item, index) => (
                            <div key={item.name} className={`flex items-stretch hover:bg-slate-50 transition-colors border-b border-gray-100/50 ${activeSubTab === 'tags' ? 'min-h-[70px]' : ''}`}>
                                <div className="w-12 flex items-center justify-center bg-slate-50/30 border-r border-gray-100 font-bold text-slate-400 text-xs shrink-0">
                                    {(currentPage - 1) * itemsPerPage + index + 1}
                                </div>

                                {activeSubTab === 'tags' ? (
                                    <div className="flex-1 flex items-center">
                                        <div className="flex-[2] px-6 text-center">
                                            <span className="text-lg font-black text-slate-800 tracking-tight">{item.name}</span>
                                        </div>
                                        <div className="flex-1 px-6 text-center">
                                            <span className={`text-xl font-black ${item.total < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                {item.total.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex-1 px-6 text-center">
                                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full text-slate-600 font-black text-sm">
                                                <Users className="w-4 h-4" />
                                                {item.customerCount}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Customer View (Main or Sub) - Portfolio Visualizer */
                                    <div className="flex-1 flex items-stretch min-h-[140px]">
                                        {/* Left Side: Profile Card */}
                                        <div className="w-[350px] p-6 border-r border-gray-50 flex flex-col justify-center items-start text-left bg-slate-50/40 shrink-0">
                                            <div className="flex items-center gap-3 mb-3 w-full">
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-100 shrink-0 capitalize">
                                                    {item.name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{activeSubTab.toUpperCase()}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                        <div className="flex items-center gap-1 min-w-0">
                                                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase truncate">{item.area}</span>
                                                        </div>
                                                    </div>
                                                    <h3 className="text-base font-black text-slate-800 tracking-tight leading-tight line-clamp-2" title={item.name}>
                                                        {item.name}
                                                    </h3>
                                                </div>
                                            </div>

                                            <div className="w-full flex items-center justify-between px-4 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Net Sales</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`text-xl font-black ${item.total < 0 ? 'text-red-600' : 'text-indigo-600'}`}>
                                                            {item.total.toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">AED</span>
                                                    </div>
                                                </div>
                                                {item.total !== 0 && (
                                                    <div className="p-2 bg-slate-50 rounded-xl">
                                                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Side: Sales Mix & Analytics */}
                                        <div className="flex-1 p-6 flex flex-col justify-center gap-5">
                                            {/* Detailed Distribution Grid */}
                                            <div className="flex flex-wrap gap-2">
                                                {item.tags && Object.entries(item.tags as Record<string, number>)
                                                    .sort((a, b) => b[1] - a[1])
                                                    .slice(0, 10) // Show top 10 tags
                                                    .map(([tag, amt], idx) => {
                                                        const color = getTagColor(idx);
                                                        const percentage = ((amt / Math.abs(item.total)) * 100).toFixed(0);
                                                        return (
                                                            <div key={tag} className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all group cursor-default w-[165px] shrink-0`}>
                                                                <div className={`w-2 h-2 rounded-full ${color.bg} shrink-0`} />
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span className="text-[11px] font-black text-slate-500 uppercase truncate" title={tag}>{tag}</span>
                                                                        <span className={`text-[11px] font-black ${color.text} shrink-0`}>{percentage}%</span>
                                                                    </div>
                                                                    <span className="text-sm font-black text-slate-800">{formatAmount(amt)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Totals Row (Bottom) for TAGS SUMMARY */}
                        {activeSubTab === 'tags' && tagSummaryData.length > 0 && (
                            <div className="flex items-stretch bg-slate-50 border-t-4 border-slate-200">
                                <div className="w-12 flex items-center justify-center bg-slate-100/50 border-r border-slate-200 font-black text-slate-400 text-xl shrink-0">
                                    ∑
                                </div>
                                <div className="flex-1 flex items-center py-4">
                                    <div className="flex-[2] px-6 text-center">
                                        <span className="text-xl font-black text-slate-800 tracking-tight uppercase">Grand Total</span>
                                    </div>
                                    <div className="flex-1 px-6 text-center">
                                        <span className={`text-2xl font-black ${totalTagsSales < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                            {totalTagsSales.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex-1 px-6 text-center">
                                        <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-slate-800 rounded-full text-white font-black text-base shadow-lg shadow-slate-200">
                                            <Users className="w-5 h-5" />
                                            {totalUniqueCustomers} Total Customers
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {rankingData.length === 0 && (
                            <div className="p-32 text-center bg-slate-50/10">
                                <div className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-100 border border-gray-100 inline-block">
                                    <Package className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                                    <p className="text-slate-500 font-black text-lg">No data found</p>
                                    <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {rankingData.length > itemsPerPage && (
                        <div className="px-8 py-6 bg-white border-t border-gray-100 flex items-center justify-between sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, rankingData.length)}</span> of <span className="text-slate-900">{rankingData.length}</span> {activeSubTab === 'tags' ? 'tags' : 'customers'}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl border border-gray-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-1 mx-2">
                                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;

                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${currentPage === pageNum
                                                    ? 'bg-green-600 text-white shadow-lg shadow-green-100'
                                                    : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-gray-200'
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl border border-gray-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
