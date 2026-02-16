'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    User,
    Users,
    FileText,
    PlusCircle,
    BarChart3,
    Search,
    ChevronLeft,
    CheckCircle2,
    ChevronDown,
    XCircle,
    DollarSign,
    ArrowLeft,
    LayoutGrid,
    Filter,
    Download,
    Printer,
    TrendingUp,
    Wallet,
    Clock,
    Activity,
    ArrowRight,
    FileDown,
    FileSpreadsheet
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    LineChart,
    Line,
    Legend
} from 'recharts';
import * as XLSX from 'xlsx';

function SearchableSelect({
    value,
    onChange,
    options,
    placeholder,
    className = ""
}: {
    value: string;
    onChange: (val: string) => void;
    options: string[];
    placeholder: string;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(value.toLowerCase())
    );

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className="relative group">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                />
                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-all pointer-events-none ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (filteredOptions.length > 0) && (
                <div className="absolute z-[100] w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-52 overflow-y-auto custom-scrollbar">
                        {filteredOptions.map((opt, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    onChange(opt);
                                    setIsOpen(false);
                                }}
                                className={`px-4 py-3 text-sm font-bold cursor-pointer transition-colors ${value === opt ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {opt}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

import { VisitCustomerEntry } from '@/types';

export default function VisitCustomersTab() {
    const [activeTab, setActiveTab] = useState<'registration' | 'customer-reports' | 'rep-reports'>('registration');
    const [viewMode, setViewMode] = useState<'details' | 'summary'>('details');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<VisitCustomerEntry[]>([]);
    const [customers, setCustomers] = useState<string[]>([]);
    const [salesReps, setSalesReps] = useState<string[]>([]);
    const [selectedRep, setSelectedRep] = useState<string | null>(null);

    const getTodayDate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Registration State (Multiple Entries)
    const [entries, setEntries] = useState<any[]>([
        {
            date: getTodayDate(),
            customerName: '',
            city: '',
            salesRepName: '',
            collectMoney: 'No',
            howMuchCollectMoney: '',
            notes: ''
        }
    ]);

    // List Filters
    const [customerFilter, setCustomerFilter] = useState('');
    const [repFilter, setRepFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [fromDateFilter, setFromDateFilter] = useState('');
    const [toDateFilter, setToDateFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                setCurrentUser(JSON.parse(savedUser));
            } catch (e) { }
        }
        fetchData();
        fetchMetadata();
    }, []);

    const fetchData = async () => {
        try {
            const response = await fetch('/api/visit-customers');
            if (response.ok) {
                const result = await response.json();
                setData(result);

                // Fetch Sales Reps directly from visit history as requested
                const uniqueReps = Array.from(new Set(result.map((row: any) => row.salesRepName))).filter(Boolean).sort() as string[];
                setSalesReps(uniqueReps);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchMetadata = async () => {
        try {
            const response = await fetch('/api/sheets');
            if (response.ok) {
                const result = await response.json();
                const sheetData = result.data || [];

                const uniqueCustomers = Array.from(new Set(sheetData.map((row: any) => row.customerName))).sort() as string[];
                setCustomers(uniqueCustomers);

                // Reps are now handled in fetchData from the visit history
            }
        } catch (error) {
            console.error('Error fetching metadata:', error);
        }
    };

    const handleBack = () => {
        window.location.href = '/';
    };

    const addRow = () => {
        setEntries([
            ...entries,
            {
                date: entries.length > 0 ? entries[entries.length - 1].date : getTodayDate(),
                customerName: '',
                city: '',
                salesRepName: entries.length > 0 ? entries[entries.length - 1].salesRepName : '',
                collectMoney: 'No',
                howMuchCollectMoney: '',
                notes: ''
            }
        ]);
    };

    const removeRow = (index: number) => {
        if (entries.length > 1) {
            setEntries(entries.filter((_, i) => i !== index));
        }
    };

    const handleEntryChange = (index: number, field: string, value: any) => {
        setEntries(prev => prev.map((entry, i) =>
            i === index ? { ...entry, [field]: value } : entry
        ));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        const invalidRows = entries.some(e => !e.customerName || !e.salesRepName);
        if (invalidRows) {
            alert('Please ensure all rows have a Customer and a Sales Representative selected.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/visit-customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entries.map(e => ({
                    ...e,
                    howMuchCollectMoney: e.collectMoney === 'Yes' ? parseFloat(e.howMuchCollectMoney) || 0 : 0
                })))
            });

            if (response.ok) {
                setEntries([
                    {
                        date: getTodayDate(),
                        customerName: '',
                        city: '',
                        salesRepName: '',
                        collectMoney: 'No',
                        howMuchCollectMoney: '',
                        notes: ''
                    }
                ]);
                fetchData();
            } else {
                throw new Error('Failed to save records');
            }
        } catch (error) {
            console.error('Error saving records:', error);
            alert('Error saving records. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadRepReport = async (repName: string) => {
        const repVisits = filteredData.filter(v => v.salesRepName === repName);
        if (repVisits.length === 0) {
            alert('No data available for this representative in the selected period.');
            return;
        }

        const totalVisits = repVisits.length;
        const totalCollected = repVisits.reduce((sum, v) => sum + (v.howMuchCollectMoney || 0), 0);
        const collectedVisits = repVisits.filter(v => v.collectMoney === 'Yes').length;
        const noCollectionVisits = totalVisits - collectedVisits;

        const uniqueDays = new Set(repVisits.map(v => v.date)).size;
        const avgPerDay = uniqueDays > 0 ? (totalVisits / uniqueDays).toFixed(1) : '0';

        const activeDates = Array.from(new Set(repVisits.map(v => v.date))).sort().reverse().slice(0, 7).reverse();
        const chartData = activeDates.map(dateStr => {
            const dayVisits = repVisits.filter(v => v.date === dateStr);
            return {
                date: dateStr,
                visits: dayVisits.length,
                amount: dayVisits.reduce((sum, v) => sum + (v.howMuchCollectMoney || 0), 0)
            };
        });

        // Determine filter period string
        let period = 'All Time';
        if (fromDateFilter && toDateFilter) period = `${fromDateFilter} to ${toDateFilter}`;
        else if (yearFilter && monthFilter) period = `${monthFilter}/${yearFilter}`;
        else if (yearFilter) period = `Year ${yearFilter}`;
        else if (monthFilter) period = `Month ${monthFilter}`;

        try {
            const { generateSalesRepReportPDF } = await import('@/lib/pdfUtils');
            const pdfBlob = await generateSalesRepReportPDF({
                repName,
                period,
                totalVisits,
                totalCollected,
                collectedVisits,
                noCollectionVisits,
                avgPerDay,
                chartData,
                visits: [...repVisits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            });

            const url = window.URL.createObjectURL(pdfBlob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${repName.replace(/\s+/g, '_')}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF report.');
        }
    };

    const filteredData = useMemo(() => {
        return data.filter(entry => {
            const matchesSearch = !searchQuery ||
                entry.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.salesRepName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.notes.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCustomer = !customerFilter || entry.customerName === customerFilter;
            const matchesRep = !repFilter || entry.salesRepName === repFilter;

            const entryDate = new Date(entry.date);
            const matchesYear = !yearFilter || entryDate.getFullYear().toString() === yearFilter;
            const matchesMonth = !monthFilter || (entryDate.getMonth() + 1).toString() === monthFilter;

            const parseInputDate = (input: string) => {
                const parts = input.split('-');
                if (parts.length === 3 && parts[0].length <= 2) {
                    // Assume DD-MM-YYYY
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
                return input; // Fallback to original
            };

            const formattedFrom = parseInputDate(fromDateFilter);
            const formattedTo = parseInputDate(toDateFilter);

            const matchesFromDate = !fromDateFilter || entry.date >= formattedFrom;
            const matchesToDate = !toDateFilter || entry.date <= formattedTo;

            return matchesSearch && matchesCustomer && matchesRep && matchesYear && matchesMonth && matchesFromDate && matchesToDate;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [data, searchQuery, customerFilter, repFilter, yearFilter, monthFilter, fromDateFilter, toDateFilter]);

    const stats = useMemo(() => {
        const totalVisits = filteredData.length;
        const totalCollected = filteredData.reduce((sum, entry) => sum + (entry.howMuchCollectMoney || 0), 0);
        const moneyCollectionVisits = filteredData.filter(entry => entry.collectMoney === 'Yes').length;

        return { totalVisits, totalCollected, moneyCollectionVisits };
    }, [filteredData]);

    const summaryData = useMemo(() => {
        const groupField = activeTab === 'customer-reports' ? 'customerName' : 'salesRepName';
        const grouped = filteredData.reduce((acc: any, curr: any) => {
            const key = curr[groupField] || 'Unknown';
            if (!acc[key]) {
                acc[key] = {
                    name: key,
                    totalVisits: 0,
                    totalCollected: 0,
                    lastVisit: '0000-00-00',
                    visitsWithCollection: 0
                };
            }
            acc[key].totalVisits += 1;
            acc[key].totalCollected += curr.howMuchCollectMoney || 0;
            if (curr.date > acc[key].lastVisit) acc[key].lastVisit = curr.date;
            if (curr.collectMoney === 'Yes') acc[key].visitsWithCollection += 1;
            return acc;
        }, {});
        return Object.values(grouped).sort((a: any, b: any) => b.totalVisits - a.totalVisits);
    }, [filteredData, activeTab]);

    const repDetails = useMemo(() => {
        if (!selectedRep) return null;

        const repVisits = filteredData.filter(v => v.salesRepName === selectedRep);
        const sortedVisits = [...repVisits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const totalVisits = repVisits.length;
        const totalCollected = repVisits.reduce((sum, v) => sum + (v.howMuchCollectMoney || 0), 0);
        const collectedVisits = repVisits.filter(v => v.collectMoney === 'Yes').length;
        const noCollectionVisits = totalVisits - collectedVisits;

        // Calculate Average Customers Per Day (Active Days only)
        const uniqueDays = new Set(repVisits.map(v => v.date)).size;
        const avgPerDay = uniqueDays > 0 ? (totalVisits / uniqueDays).toFixed(1) : '0';

        // Last 7 Days Chart Data (Calendar days ending Today)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset to start of day
        const chartData = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);

            // Format date as YYYY-MM-DD in local timezone
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const dayVisits = repVisits.filter(v => v.date === dateStr);
            const dayCollected = dayVisits.reduce((sum, v) => sum + (v.howMuchCollectMoney || 0), 0);

            chartData.push({
                name: d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' }), // Mon 10/02
                date: dateStr, // Add date for PDF
                visits: dayVisits.length,
                amount: dayCollected
            });
        }

        return {
            name: selectedRep,
            totalVisits,
            totalCollected,
            collectedVisits,
            noCollectionVisits,
            avgPerDay,
            chartData,
            visits: sortedVisits
        };
    }, [selectedRep, filteredData]);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Header */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm no-print">
                <div className="max-w-[1600px] mx-auto px-4 h-20 flex items-center justify-between gap-8">
                    {/* Left: Brand & Back */}
                    <div className="flex items-center gap-6">
                        <button
                            onClick={handleBack}
                            className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-pink-600" />
                            </div>
                            <h1 className="text-xl font-black text-slate-900 hidden md:block">Visit Customers</h1>
                        </div>
                    </div>

                    {/* Center: Tabs */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl w-full max-w-2xl">
                        {[
                            { id: 'registration', label: 'Registration', icon: PlusCircle },
                            { id: 'customer-reports', label: 'Customer Reports', icon: LayoutGrid },
                            { id: 'rep-reports', label: 'SalesRep Reports', icon: BarChart3 }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id as any);
                                    setCustomerFilter('');
                                    setRepFilter('');
                                    setYearFilter('');
                                    setMonthFilter('');
                                    setFromDateFilter('');
                                    setToDateFilter('');
                                    setSelectedRep(null);
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${activeTab === tab.id
                                    ? 'bg-white text-slate-900 shadow-md scale-105'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-pink-600' : ''}`} />
                                <span className="hidden sm:inline whitespace-nowrap">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Right: Spacer to keep tabs centered */}
                    <div className="hidden lg:block w-48"></div>
                </div>

                {/* Sub-Header / Filters & Stats (Only for Reports) */}
                {activeTab !== 'registration' && (
                    <div className="bg-slate-50 border-b border-slate-200 py-2 animate-in slide-in-from-top-2 duration-300">
                        <div className="max-w-[1800px] mx-auto px-6 flex flex-wrap items-center justify-center gap-8">

                            {/* 1. View Mode Switcher (Tabs) */}
                            <div className="flex items-center bg-white p-1 rounded-xl shadow-sm border border-slate-100 min-w-[400px]">
                                <button
                                    onClick={() => setViewMode('details')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'details' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <BarChart3 className="w-3.5 h-3.5" />
                                    Detailed Visits
                                </button>
                                <button
                                    onClick={() => setViewMode('summary')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'summary' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    Summary Numbers
                                </button>
                            </div>

                            <div className="w-px h-6 bg-slate-200 hidden md:block" />

                            {/* 2. Filters */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                                    <Filter className="w-3.5 h-3.5" /> Filters:
                                </div>
                                {activeTab === 'customer-reports' && (
                                    <SearchableSelect
                                        value={customerFilter}
                                        onChange={setCustomerFilter}
                                        options={customers}
                                        placeholder="All Customers"
                                        className="min-w-[280px]"
                                    />
                                )}
                                {activeTab === 'rep-reports' && (
                                    <SearchableSelect
                                        value={repFilter}
                                        onChange={setRepFilter}
                                        options={salesReps}
                                        placeholder="All Representatives"
                                        className="min-w-[280px]"
                                    />
                                )}

                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Year</p>
                                        <input
                                            type="number"
                                            value={yearFilter}
                                            onChange={(e) => setYearFilter(e.target.value)}
                                            placeholder="YYYY"
                                            className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Month</p>
                                        <input
                                            type="number"
                                            value={monthFilter}
                                            onChange={(e) => setMonthFilter(e.target.value)}
                                            placeholder="MM"
                                            className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">From</p>
                                        <input
                                            type="text"
                                            value={fromDateFilter}
                                            onChange={(e) => setFromDateFilter(e.target.value)}
                                            placeholder="DD-MM-YYYY"
                                            className="w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">To</p>
                                        <input
                                            type="text"
                                            value={toDateFilter}
                                            onChange={(e) => setToDateFilter(e.target.value)}
                                            placeholder="DD-MM-YYYY"
                                            className="w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="w-px h-6 bg-slate-200 hidden md:block" />

                            {/* 3. Stats */}
                            <div className="flex items-center gap-8 bg-white/50 px-6 py-1.5 rounded-2xl border border-slate-100">
                                <div className="text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Visits</p>
                                    <p className="text-lg font-black text-slate-900 leading-none">{stats.totalVisits}</p>
                                </div>
                                <div className="w-px h-6 bg-slate-200" />
                                <div className="text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Collected</p>
                                    <p className="text-lg font-black text-pink-600 leading-none">AED {stats.totalCollected.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content Area */}
            <main className="md:p-8 custom-scrollbar">
                <div className="max-w-[1800px] mx-auto space-y-8 pb-10">


                    {activeTab === 'registration' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-backwards">
                            <form onSubmit={handleSubmit} className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6 overflow-hidden">
                                <div className="overflow-x-auto min-h-[400px]">
                                    <table className="w-full border-separate border-spacing-y-3">
                                        <thead>
                                            <tr className="text-slate-900 text-[11px] font-black uppercase tracking-wider border-b border-slate-100 text-center">
                                                <th className="px-4 pb-2 text-left">#</th>
                                                <th className="px-4 pb-2 w-48">Date</th>
                                                <th className="px-4 pb-2 w-48">Sales Rep</th>
                                                <th className="px-4 pb-2 w-64">Customer</th>
                                                <th className="px-4 pb-2 w-40">City</th>
                                                <th className="px-4 pb-2 w-32">Collect?</th>
                                                <th className="px-4 pb-2 w-40">Amount</th>
                                                <th className="px-4 pb-2">Notes</th>
                                                <th className="px-4 pb-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.map((entry, idx) => (
                                                <tr key={idx} className="group animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                                    <td className="px-4 py-2 text-slate-400 text-xs font-black">{idx + 1}</td>
                                                    <td className="px-2">
                                                        <input
                                                            type="text"
                                                            value={entry.date}
                                                            placeholder="YYYY-MM-DD"
                                                            onChange={(e) => handleEntryChange(idx, 'date', e.target.value)}
                                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <SearchableSelect
                                                            value={entry.salesRepName}
                                                            onChange={(val) => handleEntryChange(idx, 'salesRepName', val)}
                                                            options={salesReps}
                                                            placeholder="Rep"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <SearchableSelect
                                                            value={entry.customerName}
                                                            onChange={(val) => handleEntryChange(idx, 'customerName', val)}
                                                            options={customers}
                                                            placeholder="Customer"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <input
                                                            type="text"
                                                            value={entry.city}
                                                            placeholder="City..."
                                                            onChange={(e) => handleEntryChange(idx, 'city', e.target.value)}
                                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <div className="flex bg-slate-50 rounded-xl p-1 gap-1">
                                                            {['Yes', 'No'].map(opt => (
                                                                <button
                                                                    key={opt}
                                                                    type="button"
                                                                    onClick={() => handleEntryChange(idx, 'collectMoney', opt)}
                                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${entry.collectMoney === opt
                                                                        ? 'bg-slate-900 text-white shadow-md'
                                                                        : 'text-slate-400 hover:text-slate-600'
                                                                        }`}
                                                                >
                                                                    {opt}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-2">
                                                        <div className={`relative transition-all duration-300 ${entry.collectMoney === 'Yes' ? 'opacity-100 scale-100' : 'opacity-30 scale-95 pointer-events-none'}`}>
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">AED</span>
                                                            <input
                                                                type="number"
                                                                value={entry.howMuchCollectMoney}
                                                                placeholder="0.00"
                                                                onChange={(e) => handleEntryChange(idx, 'howMuchCollectMoney', e.target.value)}
                                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-2">
                                                        <input
                                                            type="text"
                                                            value={entry.notes}
                                                            placeholder="Notes..."
                                                            onChange={(e) => handleEntryChange(idx, 'notes', e.target.value)}
                                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-slate-900 transition-all outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRow(idx)}
                                                            disabled={entries.length === 1}
                                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-0"
                                                        >
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={addRow}
                                        className="flex items-center gap-3 px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all group"
                                    >
                                        <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                                        Add Another Visit
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`flex-1 md:flex-none md:min-w-[300px] py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-slate-200 relative overflow-hidden ${loading
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                            : 'bg-slate-900 text-white hover:bg-black hover:translate-y-[-2px]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center gap-3">
                                            {loading ? (
                                                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="w-6 h-6" />
                                            )}
                                            <span>Save</span>
                                        </div>
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : selectedRep ? (
                        <SalesRepDetailView details={repDetails} onBack={() => setSelectedRep(null)} />
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {filteredData.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            {viewMode === 'details' ? (
                                                <table className="w-full text-center border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-900 text-white">
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Date</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Customer</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">City</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Representative</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Collect?</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Amount</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Notes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {filteredData.map((entry, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className="text-sm font-black text-slate-900">{entry.date}</span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{entry.customerName}</span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className="text-sm font-black text-slate-600">{entry.city || '---'}</span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className="text-sm font-black text-slate-500">{entry.salesRepName}</span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase ${entry.collectMoney === 'Yes'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : 'bg-slate-100 text-slate-500'
                                                                        }`}>
                                                                        {entry.collectMoney}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    {entry.howMuchCollectMoney > 0 ? (
                                                                        <span className="text-sm font-black text-pink-600">AED {entry.howMuchCollectMoney.toLocaleString()}</span>
                                                                    ) : (
                                                                        <span className="text-sm font-bold text-slate-300">---</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    <p className="text-sm font-bold text-slate-600 line-clamp-2 max-w-xs mx-auto">{entry.notes || '---'}</p>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <table className="w-full text-center border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-900 text-white">
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">
                                                                {activeTab === 'customer-reports' ? 'Customer Name' : 'Sales Representative'}
                                                            </th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Total Visits</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Collections</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Total Amount</th>
                                                            <th className="px-6 py-5 text-xs font-black uppercase tracking-wider">Last Visit</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {summaryData.map((row: any, idx: number) => (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <div className="flex justify-center">
                                                                        {activeTab === 'rep-reports' ? (
                                                                            <button
                                                                                onClick={() => setSelectedRep(row.name)}
                                                                                className="text-lg font-black text-slate-900 hover:text-pink-600 transition-colors flex items-center gap-2 group/btn"
                                                                            >
                                                                                {row.name}
                                                                                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all text-pink-500" />
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-lg font-black text-slate-900">{row.name}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <span className="text-lg font-black text-slate-900">{row.totalVisits}</span>
                                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">visits</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black ${row.visitsWithCollection > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                                                        {row.visitsWithCollection} / {row.totalVisits} Collected
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className="text-lg font-black text-pink-600">AED {row.totalCollected.toLocaleString()}</span>
                                                                </td>
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    <span className="text-sm font-bold text-slate-500">{row.lastVisit}</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[32px] p-20 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100">
                                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                        <Search className="w-12 h-12 text-slate-300" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">No Records Found</h3>
                                    <p className="text-slate-500 font-bold max-w-sm">No visits were found matching your current search or filters.</p>
                                    <button
                                        onClick={() => { setSearchQuery(''); setCustomerFilter(''); setRepFilter(''); }}
                                        className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all"
                                    >
                                        Clear All Filters
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>


            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                
                @media print {
                  .no-print { display: none !important; }
                  body { background: white !important; }
                }
            `}</style>
        </div>
    );
}

function SalesRepDetailView({ details, onBack }: { details: any; onBack: () => void }) {
    if (!details) return null;

    const handleDownloadPDF = async (details: any) => {
        try {
            const { generateSalesRepReportPDF } = await import('@/lib/pdfUtils');
            const pdfBlob = await generateSalesRepReportPDF({
                repName: details.name,
                period: 'All Time', // You can make this dynamic based on filters
                totalVisits: details.totalVisits,
                totalCollected: details.totalCollected,
                collectedVisits: details.collectedVisits,
                noCollectionVisits: details.noCollectionVisits,
                avgPerDay: details.avgPerDay,
                chartData: details.chartData,
                visits: details.visits
            });

            const url = window.URL.createObjectURL(pdfBlob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${details.name.replace(/\s+/g, '_')}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF report.');
        }
    };

    const handleDownloadExcel = (details: any) => {
        try {
            // Prepare data for Excel
            const excelData = details.visits.map((v: any) => ({
                'Date': v.date,
                'Customer Name': v.customerName,
                'City': v.city || '',
                'Collected?': v.collectMoney === 'Yes' ? 'Yes' : 'No',
                'Amount': v.howMuchCollectMoney > 0 ? v.howMuchCollectMoney : '',
                'Notes': v.notes || ''
            }));

            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Set column widths
            ws['!cols'] = [
                { wch: 12 },  // Date
                { wch: 35 },  // Customer Name
                { wch: 15 },  // City
                { wch: 12 },  // Collected?
                { wch: 12 },  // Amount
                { wch: 40 }   // Notes
            ];

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Visits');

            // Generate file and download
            XLSX.writeFile(wb, `${details.name.replace(/\s+/g, '_')}_Visits.xlsx`);
        } catch (error) {
            console.error('Error generating Excel:', error);
            alert('Failed to generate Excel report.');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <button
                        onClick={onBack}
                        className="w-fit flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-xl font-bold text-sm shadow-sm border border-slate-100 hover:text-slate-900 transition-all group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Summary
                    </button>
                    <div className="w-px h-8 bg-slate-200 hidden md:block" />
                    <h2 className="text-2xl font-black text-slate-900">SalesRep Stats: <span className="text-pink-600">{details.name}</span></h2>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleDownloadPDF(details)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-red-600 transition-all"
                    >
                        <FileDown className="w-4 h-4" />
                        PDF Report
                    </button>
                    <button
                        onClick={() => handleDownloadExcel(details)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-green-700 transition-all"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel Report
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                    { label: 'Unique Customers', value: new Set(details.visits.map((v: any) => v.customerName)).size, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'Total Visits', value: details.totalVisits, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'With Collection', value: details.collectedVisits, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'No Collection', value: details.noCollectionVisits, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-50' },
                    { label: 'Total Amount', value: `AED ${details.totalCollected.toLocaleString()}`, icon: Wallet, color: 'text-pink-600', bg: 'bg-pink-50' },
                    { label: 'Avg Visits/Day', value: details.avgPerDay, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                        <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Last 7 Days Trend</h3>
                            <p className="text-sm font-bold text-slate-400">Visits and collection amounts</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full" />
                                <span className="text-xs font-black text-slate-500 uppercase">Amount</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-slate-900 rounded-full" />
                                <span className="text-xs font-black text-slate-500 uppercase">Visits</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={details.chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 900 }}
                                    dy={10}
                                />
                                <YAxis yAxisId="amount" hide domain={[0, (dataMax: number) => dataMax]} />
                                <YAxis yAxisId="visits" hide domain={[0, (dataMax: number) => dataMax * 2]} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                    itemStyle={{ fontSize: '14px', fontWeight: '900' }}
                                />
                                <Bar
                                    dataKey="amount"
                                    fill="#ef4444"
                                    radius={[4, 4, 0, 0]}
                                    name="Collection (AED)"
                                    minPointSize={5}
                                    yAxisId="amount"
                                    label={{ position: 'top', fontSize: 14, fontWeight: 900, fill: '#ef4444', formatter: (val: any) => val > 0 ? val.toLocaleString() : '' }}
                                />
                                <Bar
                                    dataKey="visits"
                                    fill="#0f172a"
                                    radius={[4, 4, 0, 0]}
                                    name="Visits Count"
                                    minPointSize={10}
                                    yAxisId="visits"
                                    label={{ position: 'top', fontSize: 14, fontWeight: 900, fill: '#0f172a', formatter: (val: any) => val > 0 ? val : '' }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900 p-8 rounded-[32px] text-white flex flex-col justify-between overflow-hidden relative">
                    <div className="relative z-10">
                        <TrendingUp className="w-12 h-12 text-pink-500 mb-6" />
                        <h3 className="text-2xl font-black mb-2">Collection Rate</h3>
                        <p className="text-slate-400 font-bold mb-8">Performance based on total visits and collections.</p>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-black uppercase text-slate-500">Efficiency</span>
                                    <span className="text-2xl font-black text-white">{((details.collectedVisits / (details.totalVisits || 1)) * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-pink-500 transition-all duration-1000"
                                        style={{ width: `${(details.collectedVisits / (details.totalVisits || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900">Visits History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Date</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Customer</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">City</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Status</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Amount</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400 text-right">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {details.visits.map((v: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-900">{v.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-900">{v.customerName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-500">{v.city || '---'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${v.collectMoney === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {v.collectMoney === 'Yes' ? 'Collected' : 'No Collection'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-pink-600">
                                        {v.howMuchCollectMoney > 0 ? `AED ${v.howMuchCollectMoney.toLocaleString()}` : '---'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <p className="text-xs font-bold text-slate-500 max-w-xs">{v.notes || '---'}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
