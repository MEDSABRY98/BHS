'use client';

import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, TrendingDown,
    RefreshCw, Box, ShoppingCart,
    ArrowLeftRight, Truck, Activity,
    Calendar, CalendarDays, Filter,
    Sparkles, X, Clock, AlertTriangle, AlertCircle, CheckCircle2
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface AnalysisData {
    summary: {
        sales: number;
        returns: number;
        returnsRate: string;
        netPurchases: number;
        netFlow: number;
        currentStock: number;
        minQ: number;
    };
    monthlyData: {
        monthKey: string;
        label: string;
        sales: number;
        returns: number;
        purchases: number;
    }[];
}

interface Props {
    productId: string;
    productName: string;
    barcode: string;
    onBack: () => void;
}

export default function ProductDetails({ productId, productName, barcode, onBack }: Props) {
    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [year, setYear] = useState('');
    const [month, setMonth] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [preset, setPreset] = useState('all');
    const [showInsights, setShowInsights] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (year) params.append('year', year);
                if (month) params.append('month', month);
                if (fromDate) params.append('from', fromDate);
                if (toDate) params.append('to', toDate);
                if (preset !== 'all') params.append('preset', preset);

                const res = await fetch(`/api/inventory/product-details/${encodeURIComponent(productId)}?${params.toString()}`);
                const json = await res.json();
                if (res.ok) {
                    setData(json.data);
                }
            } catch (err) {
                console.error('Error fetching details:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [productId, year, month, fromDate, toDate, preset]);

    const handlePreset = (p: string) => {
        setPreset(p);
        if (p !== 'all') {
            setYear('');
            setMonth('');
            setFromDate('');
            setToDate('');
        }
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-6 animate-pulse">
                <div className="p-4 bg-blue-50 rounded-full">
                    <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-slate-800 font-medium text-lg">Analyzing Trends</p>
                </div>
            </div>
        );
    }

    if (!data && !loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-slate-500">
                <Activity className="w-12 h-12 text-slate-200" />
                <p className="text-lg">No analytical data found for this product.</p>
                <button
                    onClick={onBack}
                    className="px-6 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-medium"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const { summary, monthlyData } = data;

    // --- Predictive Insights Logic ---
    const m3 = monthlyData.slice(0, 3);
    const avgSales3M = m3.reduce((sum, m) => sum + m.sales, 0) / (m3.length || 1);
    const dailySales = avgSales3M / 30;
    const coverageDays = dailySales > 0 ? summary.currentStock / dailySales : (summary.currentStock > 0 ? 999 : 0);
    const turnoverRatio = summary.currentStock > 0 ? summary.sales / summary.currentStock : (summary.sales > 0 ? 12 : 0);

    // Charts expect oldest to newest
    const chartData = [...monthlyData].reverse().map(m => ({
        month: m.label,
        Sales: m.sales,
        Returns: m.returns,
        Purchases: m.purchases
    }));

    const StatCard = ({ title, value, icon: Icon, color, subValue, isAvg, suffix }: any) => (
        <div className={`p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative ${isAvg ? 'bg-slate-50/50' : 'bg-white'}`}>
            <div className="flex items-center justify-between relative z-10 gap-4">
                {/* Left Side: Icon & Title */}
                <div className="flex items-center gap-3.5">
                    <div className={`p-3 rounded-2xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-500`}>
                        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] mb-0.5">{title}</h3>
                        <div className="flex items-center gap-2">
                             {isAvg && <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded leading-none">Monthly Avg</span>}
                             {subValue && <span className="text-[9px] font-black text-rose-500 uppercase bg-rose-50 px-1.5 py-0.5 rounded leading-none">{subValue}</span>}
                        </div>
                    </div>
                </div>

                {/* Right Side: Value */}
                <div className="text-right">
                    <p className={`text-2xl font-black tracking-tighter leading-none ${color.replace('bg-', 'text-').includes('slate') ? 'text-slate-800' : color.replace('bg-', 'text-')}`}>
                        {typeof value === 'number' ? Math.round(value).toLocaleString() : value}
                        {suffix && <span className="text-[11px] font-bold text-slate-400 ml-1 tracking-normal italic opacity-60">{suffix}</span>}
                    </p>
                </div>
            </div>

            {/* Background Decorative Icon */}
            <div className={`absolute -right-2 -bottom-2 opacity-[0.03] pointer-events-none group-hover:scale-125 group-hover:opacity-5 transition-all duration-1000`}>
                <Icon className={`w-24 h-24 ${color.replace('bg-', 'text-')}`} />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 p-8 bg-slate-50/30 min-h-screen">
            {/* Header section with back button and productName */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onBack}
                        className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 transition-all shadow-sm group"
                    >
                        <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                                {productName}
                            </h2>
                            <button 
                                onClick={() => setShowInsights(true)}
                                className="p-1.5 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 transition-all group/info animate-pulse"
                            >
                                <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                            <Box className="w-3.5 h-3.5 text-slate-200" />
                            <span>ID: {productId}</span>
                            <span className="text-slate-200">|</span>
                            <span>BC: {barcode}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Filter Presets Card */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
                        {['7days', '1month', '3months', '6months', 'all'].map((p) => (
                            <button
                                key={p}
                                onClick={() => handlePreset(p)}
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    preset === p 
                                        ? 'bg-slate-900 text-white shadow-lg' 
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {p === 'all' ? 'All' : p.replace('days', 'D').replace('month', 'M').replace('s', '')}
                            </button>
                        ))}
                    </div>

                    {/* Manual Filters */}
                    <div className="h-10 w-[1px] bg-slate-200 mx-2" />
                    
                    <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-2xl border border-slate-100 shadow-sm">
                        <Filter className="w-4 h-4 text-slate-300" />
                        <div className="flex flex-col border-r border-slate-100 pr-3 w-14">
                            <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1 text-center">Year</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={year}
                                onChange={(e) => { setYear(e.target.value.replace(/[^0-9]/g, '')); setPreset(''); }}
                                placeholder="YYYY"
                                className="bg-transparent border-none p-0 focus:ring-0 text-xs font-black text-slate-700 w-full text-center placeholder:text-slate-200"
                            />
                        </div>
                        <div className="flex flex-col w-14 pl-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1 text-center">Mon</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={month}
                                onChange={(e) => { 
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 12)) {
                                        setMonth(val);
                                        setPreset('');
                                    }
                                }}
                                placeholder="MM"
                                className="bg-transparent border-none p-0 focus:ring-0 text-xs font-black text-slate-700 w-full text-center placeholder:text-slate-200"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-2xl border border-slate-100 shadow-sm">
                        <CalendarDays className="w-4 h-4 text-slate-300" />
                        <div className="flex flex-col border-r border-slate-100 pr-3">
                            <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">From</span>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => { setFromDate(e.target.value); setPreset(''); }}
                                className="bg-transparent border-none p-0 focus:ring-0 text-xs font-bold text-slate-700 outline-none w-24"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">To</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => { setToDate(e.target.value); setPreset(''); }}
                                className="bg-transparent border-none p-0 focus:ring-0 text-xs font-bold text-slate-700 outline-none w-24"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={() => {
                            setPreset('all');
                            setYear(''); setMonth(''); setFromDate(''); setToDate('');
                        }}
                        className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* High-Density KPI Grid - Two Rows Layout */}
            <div className="flex flex-col gap-4">
                {/* Row 1: Inventory Health & Sales Performance */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <StatCard 
                        title="Live Stock"
                        value={summary.currentStock}
                        icon={Box}
                        color="bg-blue-600"
                    />
                    <StatCard 
                        title="Coverage"
                        value={coverageDays}
                        suffix="Days"
                        icon={Clock}
                        color={coverageDays < 15 ? "bg-rose-500" : "bg-blue-400"}
                    />
                    <StatCard 
                        title="Turnover"
                        value={turnoverRatio}
                        suffix="x/y"
                        icon={RefreshCw}
                        color="bg-emerald-500"
                    />
                    <StatCard 
                        title="Total Sales"
                        value={summary.sales}
                        subValue={`${summary.returnsRate}% RET`}
                        icon={ShoppingCart}
                        color="bg-rose-500"
                    />
                    <StatCard 
                        title="Sales Avg"
                        value={Math.round(summary.sales / (monthlyData.length || 1))}
                        icon={ShoppingCart}
                        color="bg-slate-500"
                        isAvg
                    />
                </div>

                {/* Row 2: Returns, Supply & Flow */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <StatCard 
                        title="Returns"
                        value={summary.returns}
                        icon={TrendingDown}
                        color="bg-amber-500"
                    />
                    <StatCard 
                        title="Returns Avg"
                        value={Math.round(summary.returns / (monthlyData.length || 1))}
                        icon={TrendingDown}
                        color="bg-slate-500"
                        isAvg
                    />
                    <StatCard 
                        title="Net Purchases"
                        value={summary.netPurchases}
                        icon={Truck}
                        color="bg-emerald-600"
                    />
                    <StatCard 
                        title="Buy Avg"
                        value={Math.round(summary.netPurchases / (monthlyData.length || 1))}
                        icon={Truck}
                        color="bg-slate-500"
                        isAvg
                    />
                    <StatCard 
                        title="Net Flow"
                        value={summary.netFlow}
                        icon={Activity}
                        color={summary.netFlow >= 0 ? "bg-blue-600" : "bg-rose-600"}
                    />
                </div>
            </div>

            {/* Movement Trends Chart */}
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-10">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h3 className="text-lg font-medium text-slate-800 tracking-tight">Movement Trends</h3>
                        <p className="text-slate-400 text-xs font-medium">Monthly performance over the last 12 months</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            <span className="text-[10px] font-medium text-slate-500 uppercase">Sales</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 border-dashed" />
                            <span className="text-[10px] font-medium text-slate-500 uppercase">Returns</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-medium text-slate-500 uppercase">Purchases</span>
                        </div>
                    </div>
                </div>

                <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 50, left: 10, bottom: 25 }}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#475569', fontSize: 16, fontWeight: 700 }}
                                dy={10}
                                padding={{ left: 40, right: 40 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                            />
                            <Tooltip
                                content={({ active, payload, label }: any) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white/90 backdrop-blur-md p-5 rounded-[24px] border border-slate-100 shadow-2xl min-w-[200px]">
                                                <p className="text-slate-700 text-sm font-bold border-b border-slate-50 mb-4 pb-2">{label}</p>
                                                <div className="flex flex-col gap-4">
                                                    {payload.map((entry: any, index: number) => (
                                                        <div key={index} className="flex items-center justify-between gap-6">
                                                            <div className="flex items-center gap-2">
                                                                <div 
                                                                    className="w-2 h-2 rounded-full" 
                                                                    style={{ backgroundColor: entry.color }} 
                                                                />
                                                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{entry.name}</span>
                                                            </div>
                                                            <span className="text-slate-900 text-xl font-black tracking-tighter">
                                                                {entry.value.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                                cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '5 5' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="Sales"
                                stroke="#10b981"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorSales)"
                                animationDuration={1000}
                            />
                            <Area
                                type="monotone"
                                dataKey="Purchases"
                                stroke="#0ea5e9"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorPurchases)"
                                animationDuration={1200}
                            />
                            <Area
                                type="monotone"
                                dataKey="Returns"
                                stroke="#ef4444"
                                strokeWidth={3}
                                strokeDasharray="5 5"
                                fillOpacity={1}
                                fill="url(#colorReturns)"
                                animationDuration={1400}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden border-b-0">
                <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-medium text-slate-800 tracking-tight">Monthly Breakdown</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-10 py-5 text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Reporting Period</th>
                                <th className="px-10 py-5 text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Sales Qty</th>
                                <th className="px-10 py-5 text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Returns Qty</th>
                                <th className="px-10 py-5 text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Net Purchases</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {monthlyData.map((m) => (
                                <tr key={m.monthKey} className="hover:bg-slate-50/70 transition-colors group">
                                    <td className="px-10 py-6 text-slate-600 font-medium text-sm text-center">{m.label}</td>
                                    <td className="px-10 py-6 text-center text-slate-800 font-medium text-base">
                                        {m.sales === 0 ? <span className="opacity-20">-</span> : m.sales.toLocaleString()}
                                    </td>
                                    <td className="px-10 py-6 text-center text-amber-500 font-medium text-base">
                                        {m.returns === 0 ? <span className="opacity-20">-</span> : m.returns.toLocaleString()}
                                    </td>
                                    <td className="px-10 py-6 text-center text-emerald-600 font-medium text-base">
                                        {m.purchases === 0 ? <span className="opacity-20">-</span> : m.purchases.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Smart Insights Modal */}
            {showInsights && data && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowInsights(false)} />
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl relative overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-blue-50/30">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-200">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Smart Stock Health</h3>
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Automated Product Diagnostics</p>
                                </div>
                            </div>
                            <button onClick={() => setShowInsights(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-8">
                            {(() => {
                                const { summary, monthlyData } = data;
                                // Analysis logic
                                const m3 = monthlyData.slice(0, 3);
                                const avgSales3M = m3.reduce((sum, m) => sum + m.sales, 0) / (m3.length || 1);
                                const avgPurchases3M = m3.reduce((sum, m) => sum + m.purchases, 0) / (m3.length || 1);
                                
                                const dailySales = avgSales3M / 30;
                                const coverageDays = dailySales > 0 ? summary.currentStock / dailySales : (summary.currentStock > 0 ? 999 : 0);
                                
                                // Turnover (Qty Sold in Period / Avg Inventory... or just Qty Sold / Current)
                                const turnoverRatio = summary.currentStock > 0 ? summary.sales / summary.currentStock : (summary.sales > 0 ? 12 : 0);
                                const daysPerTurn = turnoverRatio > 0 ? 365 / turnoverRatio : 0;

                                return (
                                    <>
                                        {/* Stock Level Card (New) */}
                                        <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-100 flex items-center justify-between overflow-hidden relative">
                                            <div className="relative z-10">
                                                <div className="flex items-center gap-2 mb-2 opacity-80">
                                                    <Box className="w-4 h-4 text-white" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Current Physical Stock</span>
                                                </div>
                                                <p className="text-5xl font-black tracking-tighter">
                                                    {summary.currentStock.toLocaleString()}
                                                    <span className="text-sm font-bold opacity-60 ml-2 tracking-normal">Pieces</span>
                                                </p>
                                            </div>
                                            <div className="absolute -right-4 -bottom-4 opacity-10">
                                                <Box className="w-32 h-32" />
                                            </div>
                                            <div className="relative z-10 text-right">
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">LIVE STOCK</span>
                                                {summary.minQ > 0 && (
                                                    <p className="text-[11px] mt-2 font-bold opacity-80 truncate">Min Required: {summary.minQ}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Coverage Stats */}
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100/50">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Clock className="w-4 h-4 text-blue-500" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Days of Coverage</span>
                                                </div>
                                                <p className={`text-4xl font-black tracking-tighter ${coverageDays < 15 ? 'text-rose-500' : 'text-slate-800'}`}>
                                                    {Math.round(coverageDays)}
                                                    <span className="text-sm font-bold text-slate-400 ml-2 tracking-normal">Days</span>
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-2 font-medium">Until zero stock at current pace</p>
                                            </div>

                                            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100/50">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <ArrowLeftRight className="w-4 h-4 text-emerald-500" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Turnover Rhythm</span>
                                                </div>
                                                <p className="text-4xl font-black text-slate-800 tracking-tighter">
                                                    {turnoverRatio.toFixed(1)}
                                                    <span className="text-sm font-bold text-slate-400 ml-2 tracking-normal">x / Year</span>
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-2 font-medium">Full stock turnover every {Math.round(daysPerTurn)} days</p>
                                            </div>
                                        </div>

                                        {/* AI Diagnostic Message */}
                                        <div className={`p-6 rounded-3xl border-2 ${
                                            coverageDays < 15 ? 'bg-rose-50 border-rose-100' : 
                                            coverageDays > 180 ? 'bg-indigo-50 border-indigo-100' :
                                            coverageDays < 30 ? 'bg-orange-50 border-orange-100' : 
                                            'bg-emerald-50 border-emerald-100'
                                        }`}>
                                            <div className="flex gap-4">
                                                <div className={`mt-1 ${
                                                    coverageDays < 15 ? 'text-rose-500' : 
                                                    coverageDays > 180 ? 'text-indigo-500' :
                                                    coverageDays < 30 ? 'text-orange-500' : 
                                                    'text-emerald-500'
                                                }`}>
                                                    {coverageDays < 15 ? <AlertCircle className="w-6 h-6" /> : 
                                                     coverageDays > 180 ? <TrendingDown className="w-6 h-6" /> :
                                                     coverageDays < 30 ? <Activity className="w-6 h-6" /> : 
                                                     <CheckCircle2 className="w-6 h-6" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-sm uppercase mb-1">Diagnostic Report</h4>
                                                    <p className="text-slate-600 text-sm leading-relaxed text-justify">
                                                        {coverageDays < 15 
                                                            ? `Critical Alert: At current sales velocity (${Math.round(avgSales3M)}/mo), your physical stock will be depleted in ${Math.round(coverageDays)} days. Urgent restocking is required despite any recent purchase activity.`
                                                            : coverageDays > 180
                                                            ? `Inventory Bloat Detected: You have ${Math.round(coverageDays)} days of coverage—far exceeding optimal levels. This represents tied-up capital. Recommendation: Cease all purchases and consider liquidating excess stock through promotions.`
                                                            : coverageDays > 60 && avgSales3M > avgPurchases3M
                                                            ? `Strategic Optimization: You are successfully utilizing existing buffer stock to meet market demand. Even though sales exceed recent purchases, your ${Math.round(coverageDays)} days of coverage provides a safe operational margin.`
                                                            : coverageDays < 30
                                                            ? `Precautionary Notice: Stock is entering a monitoring phase. While immediate action isn't mandatory, your current coverage (${Math.round(coverageDays)} days) suggests planning a purchase order within the next 2 weeks.`
                                                            : `System Healthy: Your current stock levels are perfectly synchronized with sales velocity. You have a robust ${Math.round(coverageDays)} days of coverage, maintaining an ideal balance.`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Summary Recommendation */}
                                        <div className="bg-slate-900 p-6 rounded-3xl text-white">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Strategy</span>
                                                    <p className="text-lg font-bold text-slate-100">
                                                        {coverageDays < 15 ? 'Critical Restock Required' : coverageDays < 45 ? 'Order Planning' : 'Maintenance Mode'}
                                                    </p>
                                                </div>
                                                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${coverageDays < 15 ? 'bg-rose-500 shadow-lg shadow-rose-900/40' : 'bg-blue-500'}`}>
                                                    {coverageDays < 15 ? 'ACTION' : 'MONITOR'}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
